import { requireAgentAuth } from './_auth.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Auth' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = requireAgentAuth(request, env);
  if (authErr) return authErr;

  try {
    if (request.method === 'GET') {
      var agentTypes = (await env.DB.prepare("SELECT * FROM agent_types ORDER BY name").all()).results || [];
      return new Response(JSON.stringify({ status: 'ok', types: agentTypes }), {
        headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }

    if (request.method === 'POST') {
      var body = await request.json();
      var { type_id, name, config } = body;
      if (!type_id && !body.agent_type_name) return new Response(JSON.stringify({ status: 'error', message: 'type_id or agent_type_name required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

      var agentTypeId = type_id;
      if (!agentTypeId && body.agent_type_name) {
        var at = await env.DB.prepare("SELECT id FROM agent_types WHERE name = ?").bind(body.agent_type_name).first();
        if (!at) return new Response(JSON.stringify({ status: 'error', message: 'Unknown agent type' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
        agentTypeId = at.id;
      }

      var instanceName = name || ((await env.DB.prepare("SELECT name FROM agent_types WHERE id = ?").bind(agentTypeId).first()).name) + '-' + Date.now();
      var result = await env.DB.prepare(
        "INSERT INTO agent_instances (agent_type_id, name, status, config) VALUES (?, ?, 'idle', ?)"
      ).bind(agentTypeId, instanceName, JSON.stringify(config || {})).run();
      var agent = await env.DB.prepare("SELECT ai.*, at.name AS agent_type_name FROM agent_instances ai JOIN agent_types at ON ai.agent_type_id = at.id WHERE ai.id = ?").bind(result.meta.last_row_id).first();
      return new Response(JSON.stringify({ status: 'ok', agent }), {
        headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }

    if (request.method === 'PUT') {
      var url = new URL(request.url);
      var id = url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ status: 'error', message: 'Agent instance ID required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      var body = await request.json();
      var fields = []; var params = [];
      if (body.status !== undefined) { fields.push("status = ?"); params.push(body.status); }
      if (body.name !== undefined) { fields.push("name = ?"); params.push(body.name); }
      if (body.config !== undefined) { fields.push("config = ?"); params.push(JSON.stringify(body.config)); }
      if (body.total_runs !== undefined) { fields.push("total_runs = ?"); params.push(body.total_runs); }
      if (body.total_errors !== undefined) { fields.push("total_errors = ?"); params.push(body.total_errors); }
      if (body.status === 'idle' || body.status === 'busy' || body.status === 'error' || body.status === 'offline') {
        fields.push("last_run_at = datetime('now')");
      }
      if (!fields.length) return new Response(JSON.stringify({ status: 'error', message: 'No fields to update' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      params.push(id);
      await env.DB.prepare("UPDATE agent_instances SET " + fields.join(", ") + " WHERE id = ?").bind(...params).run();
      var updated = await env.DB.prepare("SELECT ai.*, at.name AS agent_type_name FROM agent_instances ai JOIN agent_types at ON ai.agent_type_id = at.id WHERE ai.id = ?").bind(id).first();
      return new Response(JSON.stringify({ status: 'ok', agent: updated }), {
        headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }

    if (request.method === 'DELETE') {
      var url = new URL(request.url);
      var id = url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ status: 'error', message: 'Agent instance ID required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      await env.DB.prepare("DELETE FROM agent_instances WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ status: 'ok', message: 'Agent deleted' }), {
        headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
