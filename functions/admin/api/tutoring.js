import { requireAdmin } from '../_auth.js';

var CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  var authError = await requireAdmin(request, env);
  if (authError) return authError;

  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...CORS } });

  var url = new URL(request.url);
  var id = url.searchParams.get('id') || '';
  var type = url.searchParams.get('type') || 'tutors';

  // GET — list tutors or bookings
  if (request.method === 'GET') {
    if (type === 'bookings') {
      var status = url.searchParams.get('status') || '';
      var conds = []; var params = [];
      if (status) { conds.push('b.status = ?'); params.push(status); }
      var where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';
      var items = await env.DB.prepare("SELECT b.*, t.name as tutor_name, t.slug as tutor_slug FROM tutoring_bookings b LEFT JOIN tutors t ON b.tutor_id = t.id" + where + " ORDER BY b.created_at DESC LIMIT 100").bind(...params).all();
      return new Response(JSON.stringify({ status: 'ok', items: items.results || [] }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    if (type === 'waitlist') {
      var role = url.searchParams.get('role') || '';
      var conds = []; var params = [];
      if (role) { conds.push('role = ?'); params.push(role); }
      var where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';
      var items = await env.DB.prepare("SELECT * FROM tutoring_waitlist" + where + " ORDER BY created_at DESC LIMIT 200").bind(...params).all();
      return new Response(JSON.stringify({ status: 'ok', items: items.results || [] }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    if (id) {
      var tutor = await env.DB.prepare("SELECT * FROM tutors WHERE id = ?").bind(id).first();
      if (!tutor) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
      return new Response(JSON.stringify({ status: 'ok', tutor: tutor }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    var s = url.searchParams.get('status') || '';
    var conds = []; var params = [];
    if (s) { conds.push('status = ?'); params.push(s); }
    var where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';
    var items = await env.DB.prepare("SELECT * FROM tutors" + where + " ORDER BY created_at DESC LIMIT 100").bind(...params).all();
    return new Response(JSON.stringify({ status: 'ok', items: items.results || [] }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  // PUT — update tutor status or fields
  if (request.method === 'PUT') {
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    var body = await request.json();
    var { status: newStatus, featured, hourly_rate } = body;

    var fields = []; var params = [];
    if (newStatus) { fields.push("status = ?"); params.push(newStatus); }
    if (featured !== undefined) { fields.push("featured = ?"); params.push(featured); }
    if (hourly_rate !== undefined) { fields.push("hourly_rate = ?"); params.push(hourly_rate); }
    if (!fields.length) return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

    fields.push("updated_at = datetime('now')");
    params.push(id);
    await env.DB.prepare("UPDATE tutors SET " + fields.join(', ') + " WHERE id = ?").bind(...params).run();

    var updated = await env.DB.prepare("SELECT * FROM tutors WHERE id = ?").bind(id).first();
    return new Response(JSON.stringify({ status: 'ok', tutor: updated }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  // DELETE
  if (request.method === 'DELETE') {
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    await env.DB.prepare("DELETE FROM tutors WHERE id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM tutoring_bookings WHERE tutor_id = ?").bind(id).run();
    return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });
}