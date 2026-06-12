import { checkRateLimit } from './_rate-limit.js';

var CATEGORIES = ['jobs', 'services', 'products', 'events', 'housing', 'community'];

var corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  var url = new URL(request.url);

  // GET — fetch approved listings (public)
  if (request.method === 'GET') {
    var category = url.searchParams.get('category') || '';
    var featured = url.searchParams.get('featured') || '';
    var limit = parseInt(url.searchParams.get('limit')) || 50;

    var conds = ["status = 'approved'", "expires_at > datetime('now')"];
    var params = [];
    if (category && CATEGORIES.includes(category)) { conds.push('category = ?'); params.push(category); }
    if (featured === '1') { conds.push('featured = 1'); }

    var sql = "SELECT id, title, description, category, listing_type, price, contact_name, contact_email, contact_phone, location, website, featured, created_at FROM classifieds WHERE " + conds.join(' AND ') + " ORDER BY featured DESC, created_at DESC LIMIT ?";
    params.push(limit);

    try {
      var result = await env.DB.prepare(sql).bind(...params).all();
      return new Response(JSON.stringify({ status: 'ok', items: result.results || [] }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
  }

  // POST — submit a new listing (public)
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  var ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'classifieds', 3, 300)) {
    return new Response(JSON.stringify({ error: 'Too many submissions. Try again later.' }), { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    var body = await request.json();
    var title = (body.title || '').trim();
    var description = (body.description || '').trim();
    var category = body.category || 'jobs';
    var price = (body.price || '').trim();
    var contact_name = (body.contact_name || '').trim();
    var contact_email = (body.contact_email || '').trim();
    var contact_phone = (body.contact_phone || '').trim();
    var location = (body.location || '').trim();
    var website = (body.website || '').trim();

    if (!title || !contact_name || (!contact_email && !contact_phone)) {
      return new Response(JSON.stringify({ error: 'title, contact_name, and contact_email or contact_phone required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (title.length > 200 || description.length > 2000) {
      return new Response(JSON.stringify({ error: 'title max 200 chars, description max 2000 chars' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (!CATEGORIES.includes(category)) {
      return new Response(JSON.stringify({ error: 'Invalid category. Use: ' + CATEGORIES.join(', ') }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    var result = await env.DB.prepare(
      "INSERT INTO classifieds (title, description, category, price, contact_name, contact_email, contact_phone, location, website, status, listing_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'free')"
    ).bind(title, description, category, price, contact_name, contact_email, contact_phone, location, website).run();

    return new Response(JSON.stringify({ status: 'ok', id: result.meta.last_row_id, message: 'Listing submitted for review. We will notify you once approved.' }), {
      status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}