/**
 * Workflow scheduling helpers.
 *
 * Used by the live /api/agents/orchestrate path. Cloudflare Pages does NOT run
 * Worker `scheduled` handlers (the old functions/workers/*.js entry modules
 * were dead), so the real trigger is the hourly GitHub Action that POSTs to
 * /api/agents/orchestrate; that endpoint calls runDueWorkflows() so the workflow
 * chain becomes self-driving instead of polling an empty agent_queue.
 *
 * Canonical schema (see ./_init.js):
 *   workflows(id, name, status, trigger_type, trigger_config, total_runs, last_run_at, ...)
 *   workflow_steps(id, workflow_id, step_order, step_type, config, agent_type, ...)
 *   agent_queue(agent_type, workflow_id, priority, payload, status, created_at, ...)
 *
 * trigger_type values in production are 'cron' | 'manual' | 'event'
 * (older code assumed 'schedule' | 'interval' and a non-existent `is_active`
 * column — both handled here). trigger_config for cron: {"schedule":"0 * * * *"}.
 */

function matchField(pattern, value) {
  if (pattern === '*') return true;
  if (pattern.includes(',')) {
    return pattern.split(',').some((p) => matchField(p.trim(), value));
  }
  if (pattern.includes('/')) {
    const [base, step] = pattern.split('/');
    const n = parseInt(step, 10);
    if (!n) return false;
    if (base === '*') return value % n === 0;
    return value >= parseInt(base, 10) && value % n === 0;
  }
  if (pattern.includes('-')) {
    const [start, end] = pattern.split('-').map(Number);
    return value >= start && value <= end;
  }
  return parseInt(pattern, 10) === value;
}

// Standard 5-field cron (minute hour dom month dow), evaluated in UTC.
export function matchesCron(cronExpr, date) {
  const parts = String(cronExpr || '').trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return (
    matchField(minute, date.getUTCMinutes()) &&
    matchField(hour, date.getUTCHours()) &&
    matchField(dayOfMonth, date.getUTCDate()) &&
    matchField(month, date.getUTCMonth() + 1) &&
    matchField(dayOfWeek, date.getUTCDay())
  );
}

// Most recent cron match at-or-before `fromDate`, or null if none within
// `maxMinutes`. Used to de-dupe repeated ticks inside the same scheduled window.
export function prevCronMatch(cronExpr, fromDate, maxMinutes = 8 * 24 * 60) {
  const t = new Date(fromDate.getTime());
  t.setUTCSeconds(0, 0);
  for (let i = 0; i < maxMinutes; i++) {
    if (matchesCron(cronExpr, t)) return t;
    t.setUTCMinutes(t.getUTCMinutes() - 1);
  }
  return null;
}

// Parse "24h", "1h", "30m", "7d" into milliseconds.
export function parseInterval(str) {
  const match = String(str || '').match(/^(\d+)\s*([hdm])$/i);
  if (!match) return 86400000;
  const value = parseInt(match[1], 10);
  switch (match[2].toLowerCase()) {
    case 'h': return value * 3600000;
    case 'm': return value * 60000;
    case 'd': return value * 86400000;
    default: return 86400000;
  }
}

// SQLite datetime('now') is "YYYY-MM-DD HH:MM:SS" in UTC (no timezone marker).
function parseDbDate(value) {
  if (!value) return null;
  const s = String(value);
  const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function workflowDue(wf, now = new Date()) {
  let config = {};
  try {
    config = typeof wf.trigger_config === 'string'
      ? JSON.parse(wf.trigger_config || '{}')
      : (wf.trigger_config || {});
  } catch (_) { config = {}; }

  const last = parseDbDate(wf.last_run_at);
  const tt = String(wf.trigger_type || '').toLowerCase();

  if (tt === 'interval' && config.every) {
    return !last || (now.getTime() - last.getTime()) >= parseInterval(config.every);
  }

  const cron = config.schedule || config.cron;
  if ((tt === 'cron' || tt === 'schedule') && cron) {
    const prev = prevCronMatch(cron, now);
    if (!prev) return false;
    return !last || last.getTime() < prev.getTime();
  }

  return false;
}

/**
 * For every active, due workflow, enqueue its non-orchestrator steps into
 * agent_queue and stamp last_run_at / total_runs. Returns a small report.
 */
export async function runDueWorkflows(db, now = new Date()) {
  const report = { checked: 0, triggered: [], enqueued: 0 };
  if (!db) return report;

  const wfs = await db.prepare(
    `SELECT * FROM workflows
      WHERE status = 'active'
        AND trigger_type IN ('cron', 'schedule', 'interval')`
  ).all();

  const rows = (wfs && wfs.results) || [];
  report.checked = rows.length;

  for (const wf of rows) {
    if (!workflowDue(wf, now)) continue;

    const steps = (await db.prepare(
      `SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order ASC`
    ).bind(wf.id).all()).results || [];

    let enqueued = 0;
    for (const step of steps) {
      if (step.agent_type === 'orchestrator') continue; // monitors are waiters, not tasks
      const payload = typeof step.config === 'string'
        ? (step.config || '{}')
        : JSON.stringify(step.config || {});
      await db.prepare(
        `INSERT INTO agent_queue (agent_type, workflow_id, priority, payload, status, created_at)
         VALUES (?, ?, 2, ?, 'pending', datetime('now'))`
      ).bind(step.agent_type, wf.id, payload).run();
      enqueued++;
    }

    await db.prepare(
      `UPDATE workflows SET last_run_at = datetime('now'), total_runs = COALESCE(total_runs, 0) + 1 WHERE id = ?`
    ).bind(wf.id).run();

    report.triggered.push({ id: wf.id, name: wf.name, steps_enqueued: enqueued });
    report.enqueued += enqueued;
  }

  return report;
}
