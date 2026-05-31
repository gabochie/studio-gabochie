import { requireAgentAuth } from './_auth.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Auth' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = requireAgentAuth(request, env);
  if (authErr) return authErr;

  try {
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    var activity = [];
    for (var di = 0; di < days.length; di++) {
      var dayStart = days[di] + 'T00:00:00.000Z';
      var dayEnd = days[di] + 'T23:59:59.999Z';

      var agentCount = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM agent_runs WHERE created_at >= ? AND created_at <= ?"
      ).bind(dayStart, dayEnd).first();

      var queueCount = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM agent_queue WHERE created_at >= ? AND created_at <= ?"
      ).bind(dayStart, dayEnd).first();

      var errorCount = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM agent_runs WHERE status = 'error' AND created_at >= ? AND created_at <= ?"
      ).bind(dayStart, dayEnd).first();

      var revenueTotal = await env.DB.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE status = 'completed' AND created_at >= ? AND created_at <= ?"
      ).bind(dayStart, dayEnd).first();

      activity.push({
        date: days[di],
        agent_runs: (agentCount && agentCount.count) || 0,
        queue_items: (queueCount && queueCount.count) || 0,
        errors: (errorCount && errorCount.count) || 0,
        revenue: (revenueTotal && revenueTotal.total) || 0
      });
    }

    return new Response(JSON.stringify({ status: 'ok', activity: activity }), {
      headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
