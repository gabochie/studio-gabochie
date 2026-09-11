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
      var workflows = (await env.DB.prepare(
        "SELECT w.*, COUNT(ws.id) as step_count FROM workflows w LEFT JOIN workflow_steps ws ON w.id = ws.workflow_id GROUP BY w.id ORDER BY w.created_at DESC"
      ).all()).results || [];
      for (var w of workflows) {
        var wfSteps = (await env.DB.prepare("SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order").bind(w.id).all()).results || [];
        w.steps = wfSteps;
      }
      return new Response(JSON.stringify({ status: 'ok', items: workflows }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'POST') {
      var body = await request.json();
      var { name, description, trigger_type, trigger_config, steps } = body;
      if (!name || !name.trim()) return new Response(JSON.stringify({ status: 'error', message: 'Name required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      var tc = JSON.stringify(trigger_config || {});
      var result = await env.DB.prepare(
        "INSERT INTO workflows (name, description, trigger_type, trigger_config) VALUES (?, ?, ?, ?)"
      ).bind(name.trim(), description || '', trigger_type || 'manual', tc).run();
      var workflowId = result.meta.last_row_id;
      if (steps && Array.isArray(steps)) {
        for (var i = 0; i < steps.length; i++) {
          var s = steps[i];
          await env.DB.prepare(
            "INSERT INTO workflow_steps (workflow_id, step_order, step_type, config, agent_type, timeout_seconds) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(workflowId, i + 1, s.step_type || 'task', JSON.stringify(s.config || {}), s.agent_type || '', s.timeout_seconds || 60).run();
        }
      }
      var workflow = await env.DB.prepare("SELECT * FROM workflows WHERE id = ?").bind(workflowId).first();
      return new Response(JSON.stringify({ status: 'ok', workflow }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'PUT') {
      var url = new URL(request.url);
      var id = url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ status: 'error', message: 'Workflow ID required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      body = await request.json();
      var fields = [];
      var params = [];
      if (body.name !== undefined) { fields.push("name = ?"); params.push(body.name); }
      if (body.description !== undefined) { fields.push("description = ?"); params.push(body.description); }
      if (body.status !== undefined) { fields.push("status = ?"); params.push(body.status); }
      if (body.trigger_type !== undefined) { fields.push("trigger_type = ?"); params.push(body.trigger_type); }
      if (body.trigger_config !== undefined) { fields.push("trigger_config = ?"); params.push(JSON.stringify(body.trigger_config)); }
      if (body.revenue_tracked !== undefined) { fields.push("revenue_tracked = ?"); params.push(body.revenue_tracked); }
      if (body.total_runs !== undefined) { fields.push("total_runs = ?"); params.push(body.total_runs); }
      if (body.last_run_at !== undefined) { fields.push("last_run_at = ?"); params.push(body.last_run_at); }
      if (fields.length === 0) return new Response(JSON.stringify({ status: 'error', message: 'No fields to update' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      params.push(id);
      await env.DB.prepare("UPDATE workflows SET " + fields.join(", ") + " WHERE id = ?").bind(...params).run();
      workflow = await env.DB.prepare("SELECT * FROM workflows WHERE id = ?").bind(id).first();
      return new Response(JSON.stringify({ status: 'ok', workflow }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'DELETE') {
      url = new URL(request.url);
      id = url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ status: 'error', message: 'Workflow ID required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      await env.DB.prepare("DELETE FROM workflow_steps WHERE workflow_id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM workflows WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ status: 'ok', message: 'Workflow deleted' }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
