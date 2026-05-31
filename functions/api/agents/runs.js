import { requireAgentAuth } from './_auth.js';
import { ensureAgentTables } from './_init.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Auth' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = requireAgentAuth(request, env);
  if (authErr) return authErr;
  await ensureAgentTables(env.DB);

  try {
    if (request.method === 'GET') {
      var url = new URL(request.url);
      var agentId = url.searchParams.get('agent_id') || '';
      var status = url.searchParams.get('status') || '';
      var limit = parseInt(url.searchParams.get('limit') || '50');
      var sql = "SELECT ar.*, at.name AS agent_type_name FROM agent_runs ar JOIN agent_instances ai ON ar.agent_instance_id = ai.id JOIN agent_types at ON ai.agent_type_id = at.id";
      var conditions = [];
      var params = [];
      if (agentId) { conditions.push("ar.agent_instance_id = ?"); params.push(agentId); }
      if (status) { conditions.push("ar.status = ?"); params.push(status); }
      if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
      sql += " ORDER BY ar.created_at DESC LIMIT ?";
      params.push(limit);
      var results = (await env.DB.prepare(sql).bind(...params).all()).results || [];
      return new Response(JSON.stringify({ status: 'ok', items: results, count: results.length }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'POST') {
      var body = await request.json();
      var { agent_instance_id, workflow_id, queue_item_id, status, result, error, duration_ms, prompt_used, response_summary, sub_agent_count } = body;
      if (!agent_instance_id) return new Response(JSON.stringify({ status: 'error', message: 'agent_instance_id required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      var runId = (await env.DB.prepare(
        "INSERT INTO agent_runs (agent_instance_id, workflow_id, queue_item_id, status, result, error, duration_ms, prompt_used, response_summary, sub_agent_count, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), CASE WHEN ? IN ('completed','error') THEN datetime('now') ELSE '' END)"
      ).bind(agent_instance_id, workflow_id || 0, queue_item_id || 0, status || 'completed', result || '', error || '', duration_ms || 0, prompt_used || '', response_summary || '', sub_agent_count || 0, status || 'completed').run()).meta.last_row_id;
      var run = await env.DB.prepare("SELECT * FROM agent_runs WHERE id = ?").bind(runId).first();
      return new Response(JSON.stringify({ status: 'ok', run }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
