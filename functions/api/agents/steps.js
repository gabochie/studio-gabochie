import { requireAgentAuth } from './_auth.js';
import { ensureAgentTables } from './_init.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Auth' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = requireAgentAuth(request, env);
  if (authErr) return authErr;
  await ensureAgentTables(env.DB);

  try {
    var url = new URL(request.url);
    var workflowId = url.searchParams.get('workflow_id');

    if (request.method === 'GET') {
      if (!workflowId) return new Response(JSON.stringify({ status: 'error', message: 'workflow_id required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      var steps = (await env.DB.prepare("SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order").bind(workflowId).all()).results || [];
      return new Response(JSON.stringify({ status: 'ok', items: steps }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'POST') {
      var body = await request.json();
      if (!workflowId) return new Response(JSON.stringify({ status: 'error', message: 'workflow_id required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      var { step_type, agent_type, config, timeout_seconds } = body;
      if (!step_type) return new Response(JSON.stringify({ status: 'error', message: 'step_type required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      var maxOrder = await env.DB.prepare("SELECT COALESCE(MAX(step_order), 0) as m FROM workflow_steps WHERE workflow_id = ?").bind(workflowId).first();
      var nextOrder = (maxOrder ? maxOrder.m : 0) + 1;
      var result = await env.DB.prepare(
        "INSERT INTO workflow_steps (workflow_id, step_order, step_type, agent_type, config, timeout_seconds) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(workflowId, nextOrder, step_type, agent_type || '', JSON.stringify(config || {}), timeout_seconds || 60).run();
      var step = await env.DB.prepare("SELECT * FROM workflow_steps WHERE id = ?").bind(result.meta.last_row_id).first();
      return new Response(JSON.stringify({ status: 'ok', step }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'PUT') {
      var stepId = url.searchParams.get('id');
      if (!stepId) return new Response(JSON.stringify({ status: 'error', message: 'Step ID required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      var body = await request.json();
      var fields = [];
      var params = [];
      if (body.step_type !== undefined) { fields.push("step_type = ?"); params.push(body.step_type); }
      if (body.agent_type !== undefined) { fields.push("agent_type = ?"); params.push(body.agent_type); }
      if (body.config !== undefined) { fields.push("config = ?"); params.push(JSON.stringify(body.config)); }
      if (body.timeout_seconds !== undefined) { fields.push("timeout_seconds = ?"); params.push(body.timeout_seconds); }
      if (body.step_order !== undefined) { fields.push("step_order = ?"); params.push(body.step_order); }
      if (!fields.length) return new Response(JSON.stringify({ status: 'error', message: 'No fields to update' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      params.push(stepId);
      await env.DB.prepare("UPDATE workflow_steps SET " + fields.join(", ") + " WHERE id = ?").bind(...params).run();
      var step = await env.DB.prepare("SELECT * FROM workflow_steps WHERE id = ?").bind(stepId).first();
      return new Response(JSON.stringify({ status: 'ok', step }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'DELETE') {
      var stepId = url.searchParams.get('id');
      if (!stepId) return new Response(JSON.stringify({ status: 'error', message: 'Step ID required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      await env.DB.prepare("DELETE FROM workflow_steps WHERE id = ?").bind(stepId).run();
      return new Response(JSON.stringify({ status: 'ok', message: 'Step deleted' }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
