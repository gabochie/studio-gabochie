import { getToken } from './_token.js';

function genToken() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var r = '';
  for (var i = 0; i < 24; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'ga_' + Date.now().toString(36) + '_' + r;
}

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
  try {
    var body = await request.json();
    var token = getToken(request, body);
    if (!token) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing token' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var enrollment = await db.prepare(
      'SELECT id FROM enrollments WHERE access_token = ?'
    ).bind(token).first();
    if (!enrollment) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), {
        status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var newToken = genToken();
    var expiresAt = new Date(Date.now() + 7776000000).toISOString();
    await db.prepare(
      'UPDATE enrollments SET access_token = ?, token_expires_at = ? WHERE id = ?'
    ).bind(newToken, expiresAt, enrollment.id).run();
    return new Response(JSON.stringify({
      status: 'ok',
      access_token: newToken,
      token_expires_at: expiresAt
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
