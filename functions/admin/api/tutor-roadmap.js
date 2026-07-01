import { requireAdmin } from '../_auth.js';

var CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  var authError = await requireAdmin(request, env);
  if (authError) return authError;

  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...CORS } });

  if (request.method === 'GET') {
    try {
      var rows = await env.DB.prepare("SELECT * FROM tutor_roadmap_tasks ORDER BY sort_order ASC").all();
      var items = rows.results || [];

      var phases = {};
      var counts = { total: 0, completed: 0, in_progress: 0, planned: 0, skipped: 0 };
      items.forEach(function(r) {
        var p = r.phase;
        if (!phases[p]) phases[p] = { phase: p, phase_name: r.phase_name, phase_icon: r.phase_icon, tasks: [], timeline: r.timeline || '', depends_on: r.depends_on || '' };
        phases[p].tasks.push(r);
        counts.total++;
        if (r.status === 'completed') counts.completed++;
        else if (r.status === 'in_progress') counts.in_progress++;
        else if (r.status === 'skipped') counts.skipped++;
        else counts.planned++;
        if (r.timeline) phases[p].timeline = r.timeline;
      });

      var phaseOrder = ['phase_0', 'phase_1', 'phase_2', 'phase_3', 'phase_4'];
      var phaseList = phaseOrder.map(function(po) { return phases[po] || null; }).filter(Boolean);

      var pct = counts.total ? Math.round(counts.completed / counts.total * 100) : 0;

      return new Response(JSON.stringify({
        status: 'ok',
        phases: phaseList,
        counts: counts,
        percent: pct
      }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
    }
  }

  if (request.method === 'PUT') {
    try {
      var body = await request.json();
      var id = parseInt(body.id) || 0;
      var status = (body.status || '').trim();

      if (!id || !status) {
        return new Response(JSON.stringify({ error: 'id and status required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      }

      var valid = ['planned', 'in_progress', 'completed', 'skipped'];
      if (!valid.includes(status)) {
        return new Response(JSON.stringify({ error: 'Invalid status. Must be: ' + valid.join(', ') }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
      }

      await env.DB.prepare("UPDATE tutor_roadmap_tasks SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(status, id).run();
      return new Response(JSON.stringify({ status: 'ok', message: 'Task updated' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });
}
