import { requireAdminAuth } from './_admin-auth.js';
import { ensureAdminTables } from '../agents/_init.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;
  await ensureAdminTables(env.DB);

  try {
    if (request.method === 'GET') {
      var results = (await env.DB.prepare("SELECT * FROM settings ORDER BY key").all()).results || [];
      var prefs = {};
      results.forEach(function(r){ prefs[r.key] = r.value; });
      return new Response(JSON.stringify({ status: 'ok', preferences: prefs }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'PUT') {
      var body = await request.json();
      if (!body.key) return new Response(JSON.stringify({ status: 'error', message: 'key required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").bind(body.key, String(body.value || '')).run();
      return new Response(JSON.stringify({ status: 'ok', key: body.key, value: body.value }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
