import { requireAgentAuth } from './_auth.js';

async function callAI(env, systemPrompt, userPrompt, options) {
  var apiKey = env.OPENAI_API_KEY || env.AI_API_KEY || '';
  if (!apiKey) return { error: 'No AI API key configured' };
  var model = (options && options.model) || 'gpt-4o-mini';
  var temperature = (options && options.temperature) || 0.7;
  var maxTokens = (options && options.max_tokens) || 1024;
  try {
    var res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt || 'You are a helpful AI assistant for GideonAbochie Studio.' },
          { role: 'user', content: userPrompt }
        ],
        temperature: temperature,
        max_tokens: maxTokens
      })
    });
    var data = await res.json();
    if (data.error) return { error: data.error.message };
    return { content: data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content, usage: data.usage };
  } catch (err) {
    return { error: err.message };
  }
}

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
    var tools = (await db.prepare("SELECT * FROM agent_tools WHERE agent_type_id = ? AND enabled = 1").bind(agentType.id).all()).results || [];

    if (item.agent_type === 'content' && payload.prompt) {
      var systemMsg = (prompt && prompt.system_prompt) || 'You are a content creator for GideonAbochie Studio.';
      aiResult = await callAI(env, systemMsg, payload.prompt, { model: prompt && prompt.model, temperature: prompt && prompt.temperature, max_tokens: prompt && prompt.max_tokens });
      if (aiResult && aiResult.content) {
        result = aiResult.content;
        if (payload.save_as_task) {
          await db.prepare(
            "INSERT INTO tasks (title, description, phase, status, source, priority) VALUES (?, ?, 8, 'pending', 'agent', 'medium')"
          ).bind((payload.task_title || 'AI Generated Content'), aiResult.content.substring(0, 500)).run();
        }
      }
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
          await db.prepare(
            "INSERT INTO email_queue (to_email, to_name, subject, html_content, email_type) VALUES (?, ?, ?, ?, 'agent')"
          ).bind(s.email || '', s.name || '', 'Re-engagement from GideonAbochie Studio', (aiResult && aiResult.content) || '', 'agent').run();
        }
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
        await db.prepare(
          "INSERT INTO email_queue (to_email, to_name, subject, html_content, email_type) VALUES (?, ?, ?, ?, 'agent')"
        ).bind(order.customer_email || '', order.customer_name || '', 'Your order from GideonAbochie Studio is complete', '<p>Thank you for your purchase!</p>', 'agent').run();
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

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Auth' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = requireAgentAuth(request, env);
  if (authErr) return authErr;

  try {
    var body = await request.json();
    var maxItems = (body && body.max_items) || 5;

    var pendingItems = (await env.DB.prepare(
      "SELECT * FROM agent_queue WHERE status = 'pending' AND (scheduled_at IS NULL OR scheduled_at <= datetime('now')) ORDER BY priority DESC, created_at ASC LIMIT ?"
    ).bind(maxItems).all()).results || [];

    var results = [];
    for (var item of pendingItems) {
      var r = await processQueueItem(env.DB, env, item);
      results.push({ queue_item_id: item.id, agent_type: item.agent_type, status: r.status, duration_ms: r.duration_ms, error: r.error || null });
    }

    return new Response(JSON.stringify({
      status: 'ok',
      processed: results.length,
      total_pending: (await env.DB.prepare("SELECT COUNT(*) as c FROM agent_queue WHERE status = 'pending'").first()).c,
      results: results
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
