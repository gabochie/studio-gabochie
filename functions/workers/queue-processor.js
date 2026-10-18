/**
 * Agent Queue Processor Worker
 * Runs every minute via cron trigger
 * Processes pending items in agent_queue
 */
import { ensureAgentTables } from '../api/agents/_init.js';

async function processQueueItem(db, env, item) {
  var startedAt = new Date().toISOString();
  var payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : (item.payload || {});
  var result = '';
  var error = '';
  var durationMs = 0;
  var subAgentCount = 0;

  try {
    await db.prepare("UPDATE agent_queue SET status = 'in_progress', started_at = datetime('now') WHERE id = ?").bind(item.id).run();

    var agentType = await db.prepare("SELECT * FROM agent_types WHERE name = ?").bind(item.agent_type).first();
    if (!agentType) throw new Error('Unknown agent type: ' + item.agent_type);

    var agentInstance = await db.prepare(
      "SELECT * FROM agent_instances WHERE agent_type_id = ? AND status = 'idle' LIMIT 1"
    ).bind(agentType.id).first();
    if (!agentInstance) {
      var newInstance = await db.prepare(
        "INSERT INTO agent_instances (agent_type_id, name, status) VALUES (?, ?, 'busy')"
      ).bind(agentType.id, agentType.name + '-' + Date.now()).run();
      agentInstance = await db.prepare("SELECT * FROM agent_instances WHERE id = ?").bind(newInstance.meta.last_row_id).first();
    } else {
      await db.prepare("UPDATE agent_instances SET status = 'busy', last_run_at = datetime('now'), total_runs = total_runs + 1 WHERE id = ?").bind(agentInstance.id).run();
    }

    var prompt = await db.prepare(
      "SELECT * FROM agent_prompts WHERE agent_type = ? ORDER BY id LIMIT 1"
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
      ).bind(payload.batch_size || 10).all()).results || [];
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
              "UPDATE cold_outreach SET status = 'contacted', contacted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
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
      var subData = null;
      if (payload.query) {
        subData = (await db.prepare(payload.query).all()).results || [];
      }
      var outreachPrompt = prompt ? prompt.user_template.replace('{{count}}', String(subData ? subData.length : 0)) : 'Send outreach to ' + (subData ? subData.length : 0) + ' contacts';
      aiResult = await callAI(env, (prompt && prompt.system_prompt) || 'You are an outreach specialist.', outreachPrompt, { model: prompt && prompt.model });
      result = (aiResult && aiResult.content) || 'Outreach completed';
      if (subData && subData.length > 0) {
        for (var s of subData.slice(0, 10)) {
          try {
            await queueEmail(env, s.email || '', s.name || '', 'Re-engagement from Studio Gabochie', wrapEmailBody(s.name, (aiResult && aiResult.content) || ''), 'agent');
          } catch (_qe) {}
        }
      }
    } else if (item.agent_type === 'outreach' && payload.query) {
      var queryResult = (await db.prepare(payload.query).all()).results || [];
      result = 'Query returned ' + queryResult.length + ' pending contacts';
      subAgentCount = queryResult.length;
      // If query returns contacts, enqueue send_newsletter step
      if (queryResult.length > 0) {
        await db.prepare(
          "INSERT INTO agent_queue (agent_type, workflow_id, priority, payload, scheduled_at, created_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))"
        ).bind('outreach', item.workflow_id || 0, 2, JSON.stringify({action:'send_newsletter',batch_size:10}), datetime('now'), datetime('now')).run();
      }
    } else if (item.agent_type === 'analytics') {
      var tables = payload.tables || ['donations', 'subscriptions', 'subscribers', 'store_orders'];
      var metrics = {};
      for (var tbl of tables) {
        var count = await db.prepare("SELECT COUNT(*) as c FROM " + tbl).first();
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
        await db.prepare("UPDATE store_orders SET status = 'completed' WHERE id = ?").bind(order.id).run();
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
          "INSERT INTO agent_queue (agent_type, workflow_id, priority, payload) VALUES (?, ?, ?, ?)"
        ).bind(t.agent_type, t.workflow_id || 0, t.priority, t.payload).run();
        await db.prepare("UPDATE agent_queue SET status = 'dispatched' WHERE id = ?").bind(t.id).run();
        subAgentCount++;
      }
      result = 'Dispatched ' + subAgentCount + ' pending items';
    } else if (item.agent_type === 'orchestrator') {
      var wfId = payload.workflow_id;
      if (wfId) {
        var steps = (await db.prepare(
          "SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order"
        ).bind(wfId).all()).results || [];
        for (var si of steps) {
          if (si.agent_type === 'orchestrator') continue;
          var stepConfig = typeof si.config === 'string' ? JSON.parse(si.config) : (si.config || {});
          await db.prepare(
            "INSERT INTO agent_queue (agent_type, workflow_id, priority, payload) VALUES (?, ?, ?, ?)"
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

    if (aiResult && aiResult.error) {
      error = aiResult.error;
    }

    durationMs = new Date().getTime() - new Date(startedAt).getTime();

    await db.prepare(
      "UPDATE agent_queue SET status = ?, result = ?, error = ?, completed_at = datetime('now') WHERE id = ?"
    ).bind(error ? 'error' : 'completed', result ? result.substring(0, 10000) : '', error ? error.substring(0, 1000) : '', item.id).run();

    await db.prepare(
      "INSERT INTO agent_runs (agent_instance_id, workflow_id, queue_item_id, status, result, error, duration_ms, response_summary, sub_agent_count, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(agentInstance.id, item.workflow_id || 0, item.id, error ? 'error' : 'completed', result ? result.substring(0, 5000) : '', error ? error.substring(0, 1000) : '', durationMs, (aiResult && aiResult.content) ? aiResult.content.substring(0, 500) : result.substring(0, 500), subAgentCount, startedAt).run();

    await db.prepare("UPDATE agent_instances SET status = 'idle', last_run_at = datetime('now') WHERE id = ?").bind(agentInstance.id).run();

    return { status: error ? 'error' : 'completed', result, error, duration_ms: durationMs };
  } catch (err) {
    error = err.message;
    durationMs = new Date().getTime() - new Date(startedAt).getTime();
    await db.prepare("UPDATE agent_queue SET status = 'error', error = ?, completed_at = datetime('now') WHERE id = ?").bind(error ? error.substring(0, 1000) : 'Unknown error', item.id).run();
    return { status: 'error', error, duration_ms: durationMs };
  }
}

function wrapEmailBody(name, content) {
  var htmlContent = content
    .replace(/</g, '<').replace(/>/g, '>')
    .replace(/\n\n/g, '<p style="font-family:Georgia,serif;font-size:16px;color:#475569;line-height:1.8;margin:0 0 16px">')
    .replace(/\n/g, '<br>');
  return '<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">' +
    '<table align="center" width="560" style="background:#fff;border-radius:8px;padding:40px">' +
    '<tr><td style="text-align:center;padding-bottom:20px;border-bottom:1px solid #E2E6ED">' +
    '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:.45em;color:#C9A84C;text-transform:uppercase">Studio Gabochie</span>' +
    '</td></tr>' +
    '<tr><td style="padding:32px 0 24px">' +
    '<p style="font-family:Georgia,serif;font-size:16px;color:#6B7F9A;line-height:1.7;margin:0 0 16px">' + (name ? 'Hi ' + name.replace(/</g,'<') + ',' : 'Hello,') + '</p>' +
    '<div style="font-family:Georgia,serif;font-size:16px;color:#475569;line-height:1.8">' + htmlContent + '</div>' +
    '</td></tr>' +
    '<tr><td style="text-align:center;padding-top:20px;border-top:1px solid #E2E6ED">' +
    '<p style="font-family:\'Courier Prime\',monospace;font-size:10px;color:#94A3B8;margin:0">Studio Gabochie &mdash; Accra, Ghana</p>' +
    '</td></tr></table></body></html>';
}

async function callAI(env, system, prompt, options) {
  var apiKey = env.OPENAI_API_KEY || env.AI_API_KEY;
  if (!apiKey) return { error: 'No AI API key configured' };
  var model = options?.model || 'gpt-4o-mini';
  var temperature = options?.temperature || 0.7;
  var max_tokens = options?.max_tokens || 1000;

  try {
    var resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        temperature: temperature,
        max_tokens: max_tokens
      })
    });
    var data = await resp.json();
    if (!resp.ok) return { error: data.error?.message || 'AI API error' };
    return { content: data.choices?.[0]?.message?.content || '' };
  } catch (err) {
    return { error: err.message };
  }
}

async function queueEmail(env, toEmail, toName, subject, htmlContent, emailType) {
  if (!toEmail) return;
  await env.DB.prepare(
    `INSERT INTO email_queue (to_email, to_name, subject, html_content, email_type, scheduled_at, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(toEmail, toName || '', subject, htmlContent, emailType || 'agent', datetime('now')).run();
}

export default {
  async scheduled(controller, env, ctx) {
    if (!env.DB) return;
    
    try {
      // Process up to 10 pending items per run
      var pendingItems = (await env.DB.prepare(
        "SELECT * FROM agent_queue WHERE status = 'pending' AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY priority DESC, created_at ASC LIMIT 10"
      ).all()).results || [];

      console.log('Queue processor: processing ' + pendingItems.length + ' items');

      for (var item of pendingItems) {
        await processQueueItem(env.DB, env, item);
      }
    } catch (err) {
      console.error('Queue processor error:', err);
    }
  }
};