import { requireAgentAuth } from './_auth.js';
import { ensureAgentTables } from './_init.js';

async function callAI(env, prompt, options) {
  var apiKey = options && options.api_key || env.OPENAI_API_KEY || env.AI_API_KEY || '';
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
          { role: 'system', content: (options && options.systemPrompt) || 'You are a helpful AI assistant for GideonAbochie Studio.' },
          { role: 'user', content: prompt }
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

async function queryD1(db, sql, params) {
  try {
    var result = await db.prepare(sql).bind(...(params || [])).all();
    return { rows: result.results || [] };
  } catch (err) {
    return { error: err.message };
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
    var { action, agent_type, prompt, options, sql, params, queue_item_id, ai_key } = body;

    if (action === 'call_ai') {
      var promptTemplate = null;
      if (options && options.prompt_key) {
        promptTemplate = await env.DB.prepare(
          "SELECT * FROM agent_prompts WHERE agent_type = ? AND prompt_key = ?"
        ).bind(agent_type || '', options.prompt_key).first();
      }
      var callOpts = Object.assign({
        model: (options && options.model) || (promptTemplate && promptTemplate.model),
        temperature: (options && options.temperature) || (promptTemplate && promptTemplate.temperature),
        max_tokens: (options && options.max_tokens) || (promptTemplate && promptTemplate.max_tokens),
        systemPrompt: (options && options.systemPrompt) || (promptTemplate && promptTemplate.system_prompt)
      }, ai_key ? { api_key: ai_key } : {});
      var result = await callAI(env, prompt, callOpts);
      if (result.error) return new Response(JSON.stringify({ status: 'error', message: result.error }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      if (queue_item_id) {
        await env.DB.prepare("UPDATE agent_queue SET status = 'completed', result = ?, completed_at = datetime('now') WHERE id = ?").bind(JSON.stringify({ content: result.content, usage: result.usage }), queue_item_id).run();
      }
      return new Response(JSON.stringify({ status: 'ok', content: result.content, usage: result.usage }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (action === 'query_d1') {
      if (!sql) return new Response(JSON.stringify({ status: 'error', message: 'SQL query required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      var result = await queryD1(env.DB, sql, params);
      if (result.error) return new Response(JSON.stringify({ status: 'error', message: result.error }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      return new Response(JSON.stringify({ status: 'ok', rows: result.rows }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (action === 'queue_email') {
      var { to_email, to_name, subject, html_content, email_type, scheduled_at } = body;
      if (!to_email || !subject) return new Response(JSON.stringify({ status: 'error', message: 'to_email and subject required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      await env.DB.prepare(
        "INSERT INTO email_queue (to_email, to_name, subject, html_content, email_type, scheduled_at) VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))"
      ).bind(to_email, to_name || '', subject, html_content || '', email_type || 'agent', scheduled_at || null).run();
      return new Response(JSON.stringify({ status: 'ok', message: 'Email queued' }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (action === 'query_cold_outreach') {
      var { status, category, campaign, limit, offset } = body;
      var conds = []; var bindings = [];
      if (status) { conds.push('status = ?'); bindings.push(status); }
      if (category) { conds.push('category = ?'); bindings.push(category); }
      if (campaign) { conds.push('campaign = ?'); bindings.push(campaign); }
      var where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';
      var lim = Math.min(limit || 50, 500);
      var off = offset || 0;
      var result = await queryD1(env.DB, "SELECT * FROM cold_outreach" + where + " ORDER BY id LIMIT ? OFFSET ?", bindings.concat([lim, off]));
      if (result.error) return new Response(JSON.stringify({ status: 'error', message: result.error }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      return new Response(JSON.stringify({ status: 'ok', rows: result.rows }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (action === 'create_task') {
      var { title, description, phase, priority } = body;
      if (!title || !title.trim()) return new Response(JSON.stringify({ status: 'error', message: 'Title required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      var taskResult = await env.DB.prepare(
        "INSERT INTO tasks (title, description, phase, status, source, priority) VALUES (?, ?, ?, 'pending', 'agent', ?)"
      ).bind(title.trim(), description || '', phase || 8, priority || 'medium').run();
      return new Response(JSON.stringify({ status: 'ok', task_id: taskResult.meta.last_row_id, message: 'Task created' }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (action === 'spawn_sub_agent') {
      var { parent_run_id, sub_agent_type, sub_prompt } = body;
      if (!sub_agent_type) return new Response(JSON.stringify({ status: 'error', message: 'sub_agent_type required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      await env.DB.prepare(
        "INSERT INTO agent_queue (agent_type, priority, payload) VALUES (?, ?, ?)"
      ).bind(sub_agent_type, 1, JSON.stringify({ prompt: sub_prompt, parent_run_id: parent_run_id || 0 })).run();
      if (parent_run_id) {
        await env.DB.prepare("UPDATE agent_runs SET sub_agent_count = sub_agent_count + 1 WHERE id = ?").bind(parent_run_id).run();
      }
      return new Response(JSON.stringify({ status: 'ok', message: 'Sub-agent spawned' }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ status: 'error', message: 'Unknown action: ' + action }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
