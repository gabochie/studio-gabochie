/**
 * Scheduler Worker
 * Runs every 5 minutes via cron trigger
 * Evaluates workflow triggers and enqueues agent tasks
 */
export default {
  async scheduled(controller, env, ctx) {
    try {
      const now = new Date().toISOString();

      // Get active workflows with schedule triggers
      const workflows = await env.DB.prepare(
        `SELECT * FROM workflows 
         WHERE is_active = 1 
         AND trigger_type IN ('schedule', 'interval')
         AND (next_run IS NULL OR next_run <= ?)`
      ).bind(now).all();

      if (!workflows.results || workflows.results.length === 0) {
        console.log('No workflows due to run');
        return;
      }

      console.log(`Evaluating ${workflows.results.length} due workflows`);

      for (const wf of workflows.results) {
        await evaluateWorkflow(wf, now, env);
      }

    } catch (err) {
      console.error('Scheduler error:', err);
    }
  }
};

async function evaluateWorkflow(wf, now, env) {
  const config = JSON.parse(wf.trigger_config || '{}');
  let shouldRun = false;
  let nextRun = null;

  if (wf.trigger_type === 'schedule' && config.cron) {
    // Cron expression evaluation (simplified - check if current time matches)
    shouldRun = matchesCron(config.cron, new Date(now));
    nextRun = getNextCronRun(config.cron, new Date(now));
  } else if (wf.trigger_type === 'interval' && config.every) {
    // Interval-based (e.g., "24h", "1h", "30m")
    const lastRun = wf.last_run ? new Date(wf.last_run) : null;
    const intervalMs = parseInterval(config.every);
    
    if (!lastRun || (new Date(now).getTime() - lastRun.getTime()) >= intervalMs) {
      shouldRun = true;
    }
    nextRun = new Date(new Date(now).getTime() + intervalMs).toISOString();
  }

  if (shouldRun) {
    console.log(`Triggering workflow: ${wf.name}`);
    
    // Enqueue detection step for each workflow step
    const steps = await env.DB.prepare(
      `SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order ASC`
    ).bind(wf.id).all();

    if (steps.results && steps.results.length > 0) {
      // Enqueue first step (detect)
      const firstStep = steps.results[0];
      await env.DB.prepare(
        `INSERT INTO agent_queue (agent_type, action, payload, status, created_at)
         VALUES (?, ?, ?, 'pending', datetime('now'))`
      ).bind(firstStep.agent_type, firstStep.action, JSON.stringify(firstStep.payload_config || {})).run();
    }

    // Update workflow last_run and next_run
    await env.DB.prepare(
      `UPDATE workflows SET last_run = ?, next_run = ? WHERE id = ?`
    ).bind(now, nextRun, wf.id).run();

    console.log(`Enqueued workflow: ${wf.name}`);
  }
}

function matchesCron(cronExpr, date) {
  // Simplified cron matching - supports basic expressions
  // Format: "minute hour day month day-of-week"
  // Example: "0 9 * * 1" = 9:00 AM every Monday
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  const d = date;
  const dMinute = d.getMinutes();
  const dHour = d.getHours();
  const dDayOfMonth = d.getDate();
  const dMonth = d.getMonth() + 1; // 1-12
  const dDayOfWeek = d.getDay(); // 0-6 (0=Sunday)

  return matchField(minute, dMinute) &&
         matchField(hour, dHour) &&
         matchField(dayOfMonth, dDayOfMonth) &&
         matchField(month, dMonth) &&
         matchField(dayOfWeek, dDayOfWeek);
}

function matchField(pattern, value) {
  if (pattern === '*') return true;
  if (pattern.includes(',')) {
    return pattern.split(',').some(p => matchField(p.trim(), value));
  }
  if (pattern.includes('/')) {
    const [base, step] = pattern.split('/');
    if (base === '*') return value % parseInt(step) === 0;
    return value % parseInt(step) === 0 && value >= parseInt(base);
  }
  if (pattern.includes('-')) {
    const [start, end] = pattern.split('-').map(Number);
    return value >= start && value <= end;
  }
  return parseInt(pattern) === value;
}

function getNextCronRun(cronExpr, fromDate) {
  // Simplified: just add 1 minute and find next match (not perfect but works for common cases)
  const testDate = new Date(fromDate.getTime() + 60000);
  for (let i = 0; i < 10080; i++) { // Search up to 1 week
    if (matchesCron(cronExpr, testDate)) {
      return testDate.toISOString();
    }
    testDate.setMinutes(testDate.getMinutes() + 1);
  }
  return new Date(fromDate.getTime() + 86400000).toISOString(); // Fallback: 24h
}

function parseInterval(str) {
  // Parse "24h", "1h", "30m", "7d" etc.
  const match = str.match(/^(\d+)([hdm])$/);
  if (!match) return 86400000; // Default 24h
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 'h': return value * 3600000;
    case 'm': return value * 60000;
    case 'd': return value * 86400000;
    default: return 86400000;
  }
}