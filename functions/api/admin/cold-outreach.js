import { requireAdminAuth } from './_admin-auth.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  try {
    if (request.method === 'GET') {
      var url = new URL(request.url);
      var status = url.searchParams.get('status') || '';
      var category = url.searchParams.get('category') || '';
      var campaign = url.searchParams.get('campaign') || '';
      var search = url.searchParams.get('search') || '';
      var page = parseInt(url.searchParams.get('page')) || 1;
      var limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 500);
      var offset = (page - 1) * limit;

      var conds = []; var params = [];
      if (status) { conds.push('co.status = ?'); params.push(status); }
      if (category) { conds.push('co.category = ?'); params.push(category); }
      if (campaign) { conds.push('co.campaign = ?'); params.push(campaign); }
      if (search) { conds.push("(co.name LIKE ? OR co.email LIKE ? OR co.phone LIKE ?)"); var s = '%' + search + '%'; params.push(s, s, s); }
      var where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';

      var countResult = await env.DB.prepare("SELECT COUNT(*) as total FROM cold_outreach co" + where).bind(...params).first();
      var total = countResult ? countResult.total : 0;
      var results = await env.DB.prepare("SELECT co.* FROM cold_outreach co" + where + " ORDER BY co.id LIMIT ? OFFSET ?").bind(...params, limit, offset).all();
      var stats = await env.DB.prepare("SELECT status, COUNT(*) as c FROM cold_outreach GROUP BY status").all();
      var categories = await env.DB.prepare("SELECT category, COUNT(*) as c FROM cold_outreach WHERE category != '' AND category IS NOT NULL GROUP BY category ORDER BY c DESC").all();

      return new Response(JSON.stringify({
        status: 'ok',
        items: results.results || [],
        total: total,
        page: page,
        limit: limit,
        pages: Math.ceil(total / limit),
        stats: stats.results || [],
        categories: categories.results || []
      }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'PUT') {
      var body = await request.json();
      var { id, status, campaign, notes, response } = body;
      if (!id) return new Response(JSON.stringify({ status: 'error', message: 'id required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

      var fields = []; var params = [];
      if (status !== undefined) { fields.push('status = ?'); params.push(status);
        if (status === 'contacted') fields.push("contacted_at = datetime('now')");
      }
      if (campaign !== undefined) { fields.push('campaign = ?'); params.push(campaign); }
      if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
      if (response !== undefined) { fields.push('response = ?'); params.push(response); }
      if (!fields.length) return new Response(JSON.stringify({ status: 'error', message: 'No fields to update' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      fields.push("updated_at = datetime('now')");
      params.push(id);
      await env.DB.prepare("UPDATE cold_outreach SET " + fields.join(', ') + " WHERE id = ?").bind(...params).run();
      var updated = await env.DB.prepare("SELECT * FROM cold_outreach WHERE id = ?").bind(id).first();
      return new Response(JSON.stringify({ status: 'ok', item: updated }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
