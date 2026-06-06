import { requireAgentAuth } from './_auth.js';
import { ensureAgentTables } from './_init.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Auth' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = requireAgentAuth(request, env);
  if (authErr) return authErr;
  await ensureAgentTables(env.DB);

  try {
    if (request.method === 'GET') {
      var url = new URL(request.url);
      var status = url.searchParams.get('status') || '';
      var agentType = url.searchParams.get('agent_type') || '';
      var sql = "SELECT * FROM agent_queue";
      var conditions = [];
      var params = [];
      if (status) { conditions.push("status = ?"); params.push(status); }
      if (agentType) { conditions.push("agent_type = ?"); params.push(agentType); }
      if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
      sql += " ORDER BY priority DESC, created_at ASC LIMIT 50";
      var results = (await env.DB.prepare(sql).bind(...params).all()).results || [];
      return new Response(JSON.stringify({ status: 'ok', items: results, count: results.length }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'POST') {
      var body = await request.json();
      var { agent_type, workflow_id, priority, payload, scheduled_at } = body;
      if (!agent_type) return new Response(JSON.stringify({ status: 'error', message: 'agent_type required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      var result = await env.DB.prepare(
        "INSERT INTO agent_queue (agent_type, workflow_id, priority, payload, scheduled_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(agent_type, workflow_id || 0, priority || 0, JSON.stringify(payload || {}), scheduled_at || null).run();
      var item = await env.DB.prepare("SELECT * FROM agent_queue WHERE id = ?").bind(result.meta.last_row_id).first();
      return new Response(JSON.stringify({ status: 'ok', item }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'PUT') {
      url = new URL(request.url);
      var id = url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ status: 'error', message: 'Queue item ID required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      body = await request.json();
      var fields = []; params = [];
      if (body.status !== undefined) { fields.push("status = ?"); params.push(body.status); }
      if (body.result !== undefined) { fields.push("result = ?"); params.push(JSON.stringify(body.result)); }
      if (body.error !== undefined) { fields.push("error = ?"); params.push(body.error); }
      if (body.status === 'in_progress') fields.push("started_at = datetime('now')");
      if (body.status === 'completed' || body.status === 'error') fields.push("completed_at = datetime('now')");
      if (!fields.length) return new Response(JSON.stringify({ status: 'error', message: 'No fields to update' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      params.push(id);
      await env.DB.prepare("UPDATE agent_queue SET " + fields.join(", ") + " WHERE id = ?").bind(...params).run();
      item = await env.DB.prepare("SELECT * FROM agent_queue WHERE id = ?").bind(id).first();
      return new Response(JSON.stringify({ status: 'ok', item }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
