import { getToken } from '../enroll/_token.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  try {
    var body = {};
    var token = getToken(request, body);
    if (!token) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing token' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    var enrollment = await env.DB.prepare(
      'SELECT e.id FROM enrollments e WHERE e.access_token = ?'
    ).bind(token).first();
    if (!enrollment) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), { status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    var rows = (await env.DB.prepare(
      'SELECT id, score, total, passed, attempted_at FROM quiz_attempts WHERE enrollment_id = ? ORDER BY attempted_at DESC'
    ).bind(enrollment.id).all()).results || [];
    var latestPassed = rows.length > 0 ? rows.some(function(r) { return r.passed === 1; }) : false;
    return new Response(JSON.stringify({ status: 'ok', attempts: rows, latest_passed: latestPassed }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
