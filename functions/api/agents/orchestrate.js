import { requireAgentAuth } from './_auth.js';
import { ensureAgentTables } from './_init.js';
import { runDueWorkflows } from './_workflows.js';
import { queueEmail } from '../email/_send.js';
import { callAI } from './_ai.js';
import { assertReadOnlySql } from './run.js';

var ALLOWED_ANALYTICS_TABLES = ['donations', 'subscriptions', 'subscribers', 'store_orders', 'events', 'students'];

function wrapEmailBody(name, content) {
  var htmlContent = content
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n\n/g, '<p style="font-family:Georgia,serif;font-size:16px;color:#475569;line-height:1.8;margin:0 0 16px">')
    .replace(/\n/g, '<br>');
  return '<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">' +
    '<table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">' +
    '<tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">' +
    '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Studio Gabochie</span>' +
    '</td></tr>' +
    '<tr><td style="padding:32px 0 24px">' +
    '<p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">' + (name ? 'Hi ' + String(name).replace(/</g, '&lt;') + ',' : 'Hello,') + '</p>' +
    '<div style="font-family:Georgia,serif;font-size:16px;color:#475569;line-height:1.8">' + htmlContent + '</div>' +
    '</td></tr>' +
    '<tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">' +
    '<p style="font-family:\'Courier Prime\',monospace;font-size:10px;color:#94A3B8;margin:0">Studio Gabochie &mdash; Accra, Ghana</p>' +
    '</td></tr></table></body></html>';
}

async function readOnlyQuery(db, sql) {
  // Agent-supplied queries are untrusted: SELECT only, no comments or stacked
  // statements, and at most 100 rows (enforced in assertReadOnlySql).
  var result = await db.prepare(assertReadOnlySql(sql)).all();
  return result.results || [];
}

async function processQueueItem(db, env, item) {
  var startedAt = new Date().toISOString();
  var payload = {};
  var result = '';
  var error = '';
  var durationMs = 0;
  var subAgentCount = 0;
  var agentInstance = null;

  try {
    try {
      payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : (item.payload || {});
    } catch (_) { payload = {}; }

    // Conditional claim: two overlapping cron ticks can never process the
    // same queue item twice.
    var claim = await db.prepare(
      "UPDATE agent_queue SET status = 'in_progress', started_at = datetime('now') WHERE id = ? AND status = 'pending'"
    ).bind(item.id).run();
    if (!claim || !claim.meta || claim.meta.changes === 0) {
      return { status: 'skip', result: 'not claimed' };
    }

    var agentType = await db.prepare('SELECT * FROM agent_types WHERE name = ?').bind(item.agent_type).first();
    if (!agentType) throw new Error('Unknown agent type: ' + item.agent_type);

    agentInstance = await db.prepare(
      "SELECT * FROM agent_instances WHERE agent_type_id = ? AND status = 'idle' LIMIT 1"
    ).bind(agentType.id).first();
    if (agentInstance) {
      var instClaim = await db.prepare(
        "UPDATE agent_instances SET status = 'busy', last_run_at = datetime('now'), total_runs = total_runs + 1 WHERE id = ? AND status = 'idle'"
      ).bind(agentInstance.id).run();
      if (!instClaim || !instClaim.meta || instClaim.meta.changes === 0) agentInstance = null;
    }
    if (!agentInstance) {
      var newInstance = await db.prepare(
        "INSERT INTO agent_instances (agent_type_id, name, status, last_run_at, total_runs) VALUES (?, ?, 'busy', datetime('now'), 1)"
      ).bind(agentType.id, agentType.name + '-' + Date.now()).run();
      agentInstance = { id: newInstance.meta.last_row_id };
    }

    var prompt = await db.prepare(
      'SELECT * FROM agent_prompts WHERE agent_type = ? ORDER BY id LIMIT 1'
    ).bind(item.agent_type).first();

    var aiResult = null;

    if (item.agent_type === 'content' && payload.prompt) {
      var systemMsg = (prompt && prompt.system_prompt) || 'You are a content creator for Studio Gabochie.';
      aiResult = await callAI(env, systemMsg, payload.prompt, { model: prompt && prompt.model, temperature: prompt && prompt.temperature, max_tokens: prompt && prompt.max_tokens });
      if (aiResult && aiResult.content) {
        result = aiResult.content;
        if (payload.save_as_task) {
          await db.prepare(
            "INSERT INTO tasks (title, description, phase, status, source, priority) VALUES (?, ?, 8, 'pending', 'agent', 'medium')"
          ).bind((payload.task_title || 'AI Generated Content'), aiResult.content.substring(0, 500)).run();
        }
      }
    } else if (item.agent_type === 'outreach' && payload.action === 'send_newsletter') {
      var contacts = (await db.prepare(
        "SELECT * FROM cold_outreach WHERE status = 'pending' ORDER BY id LIMIT ?"
      ).bind(Math.min(payload.batch_size || 10, 50)).all()).results || [];
      var sentCount = 0;
      var failCount = 0;
      var newsletterPrompt = await db.prepare(
        "SELECT * FROM agent_prompts WHERE agent_type = 'outreach' AND prompt_key = 'cold_newsletter'"
      ).first();
      if (!newsletterPrompt) {
        error = 'cold_newsletter prompt not found — run setup.js first';
        result = 'Aborted — missing cold_newsletter prompt in agent_prompts table';
      } else {
        for (var c of contacts) {
          var userMsg = newsletterPrompt.user_template || '';
          userMsg = userMsg.replace('{{name}}', c.name || 'there');
          userMsg = userMsg.replace('{{category}}', c.category || 'business');
          userMsg = userMsg.replace('{{region}}', c.region || 'Ghana');
          var sysMsg = newsletterPrompt.system_prompt || 'You are a cold email outreach specialist.';
          var aiRes = await callAI(env, sysMsg, userMsg, {
            model: newsletterPrompt.model || 'gpt-4o-mini',
            temperature: newsletterPrompt.temperature || 0.7,
            max_tokens: newsletterPrompt.max_tokens || 500
          });
          if (aiRes && aiRes.content && !aiRes.error) {
            var toEmail = c.email || '';
            var toName = c.name || '';
            if (toEmail) {
              try {
                await queueEmail(env, toEmail, toName, 'Discover Studio Gabochie', wrapEmailBody(toName, aiRes.content), 'agent');
              } catch (_qe) { failCount++; continue; }
            }
            await db.prepare(
              "UPDATE cold_outreach SET status = 'contacted', contacted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'pending'"
            ).bind(c.id).run();
            sentCount++;
          } else {
            failCount++;
          }
        }
      }
      result = 'Sent ' + sentCount + ', failed ' + failCount + ' of ' + contacts.length + ' contacts';
      subAgentCount = sentCount;
    } else if (item.agent_type === 'outreach' && payload.action === 'send_reminder') {
      var subData = [];
      if (payload.query) {
        try { subData = await readOnlyQuery(db, payload.query); }
        catch (qErr) { error = qErr.message; }
      }
      var outreachPrompt = prompt ? prompt.user_template.replace('{{count}}', String(subData.length)) : 'Send outreach to ' + subData.length + ' contacts';
      aiResult = await callAI(env, (prompt && prompt.system_prompt) || 'You are an outreach specialist.', outreachPrompt, { model: prompt && prompt.model });
      result = (aiResult && aiResult.content) || 'Outreach completed';
      for (var s of subData.slice(0, 10)) {
        if (!error && s.email) {
          try {
            await queueEmail(env, s.email, s.name || '', 'Re-engagement from Studio Gabochie', wrapEmailBody(s.name, (aiResult && aiResult.content) || ''), 'agent');
          } catch (_qe) {}
        }
      }
    } else if (item.agent_type === 'outreach' && payload.query) {
      try {
        var queryResult = await readOnlyQuery(db, payload.query);
        result = 'Query returned ' + queryResult.length + ' pending contacts';
        subAgentCount = queryResult.length;
      } catch (qErr2) {
        error = qErr2.message;
      }
    } else if (item.agent_type === 'analytics') {
      var requested = payload.tables || ['donations', 'subscriptions', 'subscribers', 'store_orders'];
      var tables = requested.filter(function (t) { return ALLOWED_ANALYTICS_TABLES.indexOf(t) >= 0; });
      var metrics = {};
      for (var tbl of tables) {
        var count = await db.prepare('SELECT COUNT(*) as c FROM ' + tbl).first();
        metrics[tbl] = (count && count.c) || 0;
      }
      var revenue = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE status = 'completed' AND created_at > datetime('now', '-30 days')").first();
      metrics.revenue_30d = (revenue && revenue.total) || 0;
      var promptText = prompt ? prompt.user_template.replace('{{metrics}}', JSON.stringify(metrics)) : 'Analyze: ' + JSON.stringify(metrics);
      aiResult = await callAI(env, (prompt && prompt.system_prompt) || 'You are a data analyst.', promptText, { model: prompt && prompt.model });
      result = (aiResult && aiResult.content) || 'Analysis completed';
      if (payload.save_report) {
        await db.prepare(
          "INSERT INTO tasks (title, description, phase, status, source, priority) VALUES (?, ?, 8, 'done', 'agent', 'medium')"
        ).bind('Analytics Report: ' + new Date().toISOString().slice(0, 10), (aiResult && aiResult.content) || '').run();
      }
    } else if (item.agent_type === 'fulfillment') {
      var pendingOrders = (await db.prepare(
        "SELECT * FROM store_orders WHERE status = 'pending' LIMIT 20"
      ).all()).results || [];
      for (var order of pendingOrders) {
        var orderClaim = await db.prepare("UPDATE store_orders SET status = 'completed' WHERE id = ? AND status = 'pending'").bind(order.id).run();
        if (!orderClaim || !orderClaim.meta || orderClaim.meta.changes === 0) continue;
        try {
          await queueEmail(env, order.customer_email || '', order.customer_name || '', 'Your order from Studio Gabochie is complete', wrapEmailBody(order.customer_name, 'Thank you for your purchase! Your order is now complete.'), 'agent');
        } catch (_qe) {}
      }
      result = 'Processed ' + pendingOrders.length + ' pending orders';
    } else if (item.agent_type === 'task_processor') {
      var pendingTasks = (await db.prepare(
        "SELECT * FROM agent_queue WHERE status = 'pending' AND agent_type != 'task_processor' ORDER BY priority DESC, created_at ASC LIMIT 5"
      ).all()).results || [];
      for (var t of pendingTasks) {
        await db.prepare(
          'INSERT INTO agent_queue (agent_type, workflow_id, priority, payload) VALUES (?, ?, ?, ?)'
        ).bind(t.agent_type, t.workflow_id || 0, t.priority, t.payload).run();
        var dispatch = await db.prepare("UPDATE agent_queue SET status = 'dispatched' WHERE id = ? AND status = 'pending'").bind(t.id).run();
        if (dispatch && dispatch.meta && dispatch.meta.changes > 0) subAgentCount++;
      }
      result = 'Dispatched ' + subAgentCount + ' pending items';
    } else if (item.agent_type === 'orchestrator') {
      var wfId = payload.workflow_id;
      if (wfId) {
        var steps = (await db.prepare(
          'SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order'
        ).bind(wfId).all()).results || [];
        for (var si of steps) {
          if (!si.agent_type || si.agent_type === 'orchestrator') continue;
          var stepConfig = typeof si.config === 'string' ? JSON.parse(si.config) : (si.config || {});
          await db.prepare(
            'INSERT INTO agent_queue (agent_type, workflow_id, priority, payload) VALUES (?, ?, ?, ?)'
          ).bind(si.agent_type, wfId, 2, JSON.stringify(stepConfig)).run();
          subAgentCount++;
        }
        result = 'Dispatched ' + subAgentCount + ' of ' + steps.length + ' steps for workflow #' + wfId;
      } else {
        result = 'No workflow_id in orchestrator payload';
      }
    } else {
      result = 'No handler for agent type: ' + item.agent_type;
    }

    if (aiResult && aiResult.error) error = aiResult.error;
    durationMs = new Date().getTime() - new Date(startedAt).getTime();

    await db.prepare(
      "UPDATE agent_queue SET status = ?, result = ?, error = ?, completed_at = datetime('now') WHERE id = ? AND status = 'in_progress'"
    ).bind(error ? 'error' : 'completed', result ? result.substring(0, 10000) : '', error ? error.substring(0, 1000) : '', item.id).run();

    if (agentInstance && agentInstance.id) {
      await db.prepare(
        'INSERT INTO agent_runs (agent_instance_id, workflow_id, queue_item_id, status, result, error, duration_ms, response_summary, sub_agent_count, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))'
      ).bind(agentInstance.id, item.workflow_id || 0, item.id, error ? 'error' : 'completed', result ? result.substring(0, 5000) : '', error ? error.substring(0, 1000) : '', durationMs, (aiResult && aiResult.content) ? aiResult.content.substring(0, 500) : result.substring(0, 500), subAgentCount, startedAt).run();
    }

    return { status: error ? 'error' : 'completed', result, error, duration_ms: durationMs };
  } catch (err) {
    error = String((err && err.message) || err);
    durationMs = new Date().getTime() - new Date(startedAt).getTime();
    await db.prepare("UPDATE agent_queue SET status = 'error', error = ?, completed_at = datetime('now') WHERE id = ? AND status = 'in_progress'").bind(error.substring(0, 1000), item.id).run();
    return { status: 'error', error, duration_ms: durationMs };
  } finally {
    // Always release the agent instance, including on early errors, so it can
    // accept the next queue item.
    if (agentInstance && agentInstance.id) {
      try {
        await db.prepare("UPDATE agent_instances SET status = 'idle' WHERE id = ? AND status = 'busy'").bind(agentInstance.id).run();
      } catch (_e) {}
    }
  }
}

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Auth' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = requireAgentAuth(request, env);
  if (authErr) return authErr;
  await ensureAgentTables(env.DB);

  try {
    var body = await request.json();
    var maxItems = Math.min(Math.max(parseInt((body && body.max_items) || 5, 10) || 5, 1), 20);

    // Self-driving workflow tick: enqueue steps for any active workflow whose
    // cron/interval schedule is due. Guarded so a workflow error never blocks
    // direct agent-queue processing.
    var workflowsTriggered = null;
    try {
      workflowsTriggered = await runDueWorkflows(env.DB, new Date());
    } catch (wfErr) {
      workflowsTriggered = { error: wfErr.message };
    }

    var pendingItems = (await env.DB.prepare(
      "SELECT * FROM agent_queue WHERE status = 'pending' AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY priority DESC, created_at ASC LIMIT ?"
    ).bind(maxItems).all()).results || [];

    var results = [];
    for (var item of pendingItems) {
      var r = await processQueueItem(env.DB, env, item);
      results.push({ queue_item_id: item.id, agent_type: item.agent_type, status: r.status, duration_ms: r.duration_ms, error: r.error || null });
    }

    var pendingCount = await env.DB.prepare("SELECT COUNT(*) as c FROM agent_queue WHERE status = 'pending'").first();
    return new Response(JSON.stringify({
      status: 'ok',
      processed: results.length,
      workflows_triggered: workflowsTriggered,
      total_pending: (pendingCount && pendingCount.c) || 0,
      results: results
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error', detail: err.message }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
