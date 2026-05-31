import { requireAgentAuth } from './_auth.js';
import { ensureAgentTables } from './_init.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Auth' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = requireAgentAuth(request, env);
  if (authErr) return authErr;
  await ensureAgentTables(env.DB);

  try {
    var agents = await env.DB.prepare(
      "SELECT ai.*, at.name AS agent_type_name, at.description FROM agent_instances ai JOIN agent_types at ON ai.agent_type_id = at.id ORDER BY ai.created_at"
    ).all();

    var queuePending = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM agent_queue WHERE status = 'pending'"
    ).first();

    var queueInProgress = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM agent_queue WHERE status = 'in_progress'"
    ).first();

    var runsRecent = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM agent_runs WHERE created_at > datetime('now', '-24 hours')"
    ).first();

    var runsErrors = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM agent_runs WHERE status = 'error' AND created_at > datetime('now', '-24 hours')"
    ).first();

    var revenue = await env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE status = 'completed' AND created_at > datetime('now', '-30 days')"
    ).first();

    var latestRuns = await env.DB.prepare(
      "SELECT ar.*, at.name as agent_type_name FROM agent_runs ar JOIN agent_instances ai ON ar.agent_instance_id = ai.id JOIN agent_types at ON ai.agent_type_id = at.id ORDER BY ar.created_at DESC LIMIT 10"
    ).all();

    return new Response(JSON.stringify({
      status: 'ok',
      agents: agents.results || [],
      queue: { pending: (queuePending && queuePending.count) || 0, in_progress: (queueInProgress && queueInProgress.count) || 0 },
      runs: { last_24h: (runsRecent && runsRecent.count) || 0, errors_24h: (runsErrors && runsErrors.count) || 0 },
      revenue_30d: (revenue && revenue.total) || 0,
      latest_runs: latestRuns.results || []
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
