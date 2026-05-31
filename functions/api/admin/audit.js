import { requireAdminAuth } from './_admin-auth.js';
import { ensureAdminTables } from '../agents/_init.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;
  await ensureAdminTables(env.DB);

  try {
    if (request.method === 'GET') {
      var limit = parseInt(new URL(request.url).searchParams.get('limit') || '50');
      var results = (await env.DB.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?").bind(limit).all()).results || [];
      return new Response(JSON.stringify({ status: 'ok', items: results }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'POST') {
      var body = await request.json();
      var { action, entity_type, entity_id, admin_key, details } = body;
      if (!action) return new Response(JSON.stringify({ status: 'error', message: 'action required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      await env.DB.prepare(
        "INSERT INTO audit_log (action, entity_type, entity_id, admin_key, ip, details) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(action, entity_type || '', entity_id || '', admin_key || '', request.headers.get('CF-Connecting-IP') || '', JSON.stringify(details || {})).run();
      return new Response(JSON.stringify({ status: 'ok' }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
