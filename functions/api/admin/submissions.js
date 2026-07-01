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
      var results = (await env.DB.prepare("SELECT * FROM contact_submissions ORDER BY created_at DESC LIMIT 100").all()).results || [];
      return new Response(JSON.stringify({ status: 'ok', items: results }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'PUT') {
      var url = new URL(request.url);
      var id = url.searchParams.get('id');
      var body = await request.json();
      if (!id) return new Response(JSON.stringify({ status: 'error', message: 'ID required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      var fields = []; var params = [];
      if (body.status) { fields.push("status = ?"); params.push(body.status); }
      if (!fields.length) return new Response(JSON.stringify({ status: 'error', message: 'No fields to update' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      params.push(id);
      await env.DB.prepare("UPDATE contact_submissions SET " + fields.join(", ") + " WHERE id = ?").bind(...params).run();
      return new Response(JSON.stringify({ status: 'ok' }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
