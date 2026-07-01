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

  // GET — list applications
  if (request.method === 'GET') {
    var items = await env.DB.prepare("SELECT * FROM career_applications ORDER BY created_at DESC LIMIT 100").all();
    return new Response(JSON.stringify({ status: 'ok', items: items.results || [] }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  // PUT — update status
  if (request.method === 'PUT') {
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    var body = await request.json();
    var { status: newStatus } = body;
    if (!newStatus) return new Response(JSON.stringify({ error: 'status required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    await env.DB.prepare("UPDATE career_applications SET status = ? WHERE id = ?").bind(newStatus, id).run();
    return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  if (request.method === 'DELETE') {
    if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    await env.DB.prepare("DELETE FROM career_applications WHERE id = ?").bind(id).run();
    return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });
}