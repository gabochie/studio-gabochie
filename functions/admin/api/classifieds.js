import { requireAdmin } from '../_auth.js';

var CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  var authError = requireAdmin(request, env);
  if (authError) return authError;

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  var url = new URL(request.url);
  var id = url.searchParams.get('id') || '';

  // GET — list all or single
  if (request.method === 'GET') {
    if (id) {
      var item = await env.DB.prepare("SELECT * FROM classifieds WHERE id = ?").bind(id).first();
      if (!item) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
      return new Response(JSON.stringify({ status: 'ok', item: item }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    var status = url.searchParams.get('status') || '';
    var category = url.searchParams.get('category') || '';
    var search = url.searchParams.get('search') || '';
    var page = parseInt(url.searchParams.get('page')) || 1;
    var limit = parseInt(url.searchParams.get('limit')) || 50;
    var offset = (page - 1) * limit;

    var conds = []; var params = [];
    if (status) { conds.push('c.status = ?'); params.push(status); }
    if (category) { conds.push('c.category = ?'); params.push(category); }
    if (search) { conds.push("(c.title LIKE ? OR c.contact_name LIKE ? OR c.contact_email LIKE ?)"); var s = '%' + search + '%'; params.push(s, s, s); }
    var where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';

    var countResult = await env.DB.prepare("SELECT COUNT(*) as total FROM classifieds c" + where).bind(...params).first();
    var total = countResult ? countResult.total : 0;
    var items = await env.DB.prepare("SELECT c.* FROM classifieds c" + where + " ORDER BY c.created_at DESC LIMIT ? OFFSET ?").bind(...params, limit, offset).all();
    var stats = await env.DB.prepare("SELECT status, COUNT(*) as c FROM classifieds GROUP BY status").all();

    return new Response(JSON.stringify({
      status: 'ok', items: items.results || [], total: total, page: page, limit: limit,
      pages: Math.ceil(total / limit), stats: stats.results || []
    }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  // PUT — update status or fields
  if (request.method === 'PUT') {
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    var body = await request.json();
    var { status: newStatus, featured } = body;

    var fields = []; var params = [];
    if (newStatus) { fields.push("status = ?"); params.push(newStatus); }
    if (featured !== undefined) { fields.push("featured = ?"); params.push(featured); }
    if (!fields.length) return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });

    fields.push("updated_at = datetime('now')");
    params.push(id);
    await env.DB.prepare("UPDATE classifieds SET " + fields.join(', ') + " WHERE id = ?").bind(...params).run();

    var updated = await env.DB.prepare("SELECT * FROM classifieds WHERE id = ?").bind(id).first();
    return new Response(JSON.stringify({ status: 'ok', item: updated }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  // DELETE
  if (request.method === 'DELETE') {
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    await env.DB.prepare("DELETE FROM classifieds WHERE id = ?").bind(id).run();
    return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });
}