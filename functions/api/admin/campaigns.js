import { requireAdminAuth } from './_admin-auth.js';

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign';
}

export async function onRequest(context) {
  var { request, env } = context;
  var cors = corsHeaders();
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  try {
    // ── GET: list campaigns ──
    if (request.method === 'GET') {
      var url = new URL(request.url);
      var status = url.searchParams.get('status') || '';
      var page = parseInt(url.searchParams.get('page')) || 1;
      var limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 500);
      var offset = (page - 1) * limit;

      var where = status ? ' WHERE c.status = ?' : '';
      var params = status ? [status] : [];

      var countResult = await env.DB.prepare("SELECT COUNT(*) as total FROM campaigns c" + where).bind(...params).first();
      var total = countResult ? countResult.total : 0;

      var items = await env.DB.prepare(
        "SELECT c.*, COALESCE((SELECT SUM(amount) FROM donations WHERE campaign_id = c.id AND status = 'successful'), 0) as raised_amount FROM campaigns c" + where + " ORDER BY c.created_at DESC LIMIT ? OFFSET ?"
      ).bind(...params, limit, offset).all();

      var campaignsWithPct = (items.results || []).map(function(c) {
        var pct = c.goal_amount > 0 ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100)) : 0;
        return Object.assign(c, { progress_pct: pct });
      });

      return new Response(JSON.stringify({
        status: 'ok',
        items: campaignsWithPct,
        total: total,
        page: page,
        limit: limit,
        pages: Math.ceil(total / limit)
      }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    // ── POST: create campaign ──
    if (request.method === 'POST') {
      var body = await request.json();
      if (!body.name) return new Response(JSON.stringify({ status: 'error', message: 'name required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

      var slug = body.slug || slugify(body.name);
      var existing = await env.DB.prepare("SELECT id FROM campaigns WHERE slug = ?").bind(slug).first();
      if (existing) slug = slug + '-' + Date.now();

      var result = await env.DB.prepare(
        "INSERT INTO campaigns (name, slug, description, goal_amount, currency, type, status, cover_image, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(body.name, slug, body.description || '', body.goal_amount || 0, body.currency || 'GHS', body.type || 'donation', body.status || 'draft', body.cover_image || '', body.start_date || '', body.end_date || '').run();

      var campaign = await env.DB.prepare("SELECT * FROM campaigns WHERE id = ?").bind(result.meta.last_row_id).first();
      return new Response(JSON.stringify({ status: 'ok', campaign: campaign }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    // ── PUT: update campaign ──
    if (request.method === 'PUT') {
      var putBody = await request.json();
      var putId = putBody.id;
      var putName = putBody.name;
      var putStatus = putBody.status;
      var putSlug = putBody.slug;
      if (!putId) return new Response(JSON.stringify({ status: 'error', message: 'id required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

      var updFields = []; var updParams = [];
      if (putName !== undefined) { updFields.push('name = ?'); updParams.push(putName); }
      if (putSlug !== undefined) { updFields.push('slug = ?'); updParams.push(putSlug); }
      if (putBody.description !== undefined) { updFields.push('description = ?'); updParams.push(putBody.description); }
      if (putBody.goal_amount !== undefined) { updFields.push('goal_amount = ?'); updParams.push(putBody.goal_amount); }
      if (putBody.currency !== undefined) { updFields.push('currency = ?'); updParams.push(putBody.currency); }
      if (putBody.type !== undefined) { updFields.push('type = ?'); updParams.push(putBody.type); }
      if (putStatus !== undefined) { updFields.push('status = ?'); updParams.push(putStatus); }
      if (putBody.cover_image !== undefined) { updFields.push('cover_image = ?'); updParams.push(putBody.cover_image); }
      if (putBody.start_date !== undefined) { updFields.push('start_date = ?'); updParams.push(putBody.start_date); }
      if (putBody.end_date !== undefined) { updFields.push('end_date = ?'); updParams.push(putBody.end_date); }
      if (!updFields.length) return new Response(JSON.stringify({ status: 'error', message: 'No fields to update' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

      updFields.push("updated_at = datetime('now')");
      updParams.push(putId);
      await env.DB.prepare("UPDATE campaigns SET " + updFields.join(', ') + " WHERE id = ?").bind(...updParams).run();

      var updated = await env.DB.prepare("SELECT * FROM campaigns WHERE id = ?").bind(putId).first();
      return new Response(JSON.stringify({ status: 'ok', campaign: updated }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    // ── DELETE: archive campaign ──
    if (request.method === 'DELETE') {
      var delUrl = new URL(request.url);
      var delId = delUrl.searchParams.get('id');
      if (!delId) return new Response(JSON.stringify({ status: 'error', message: 'id required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      await env.DB.prepare("UPDATE campaigns SET status = 'archived' WHERE id = ?").bind(delId).run();
      return new Response(JSON.stringify({ status: 'ok', deleted: delId }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
