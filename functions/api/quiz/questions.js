import { getToken, getSessionUser } from '../enroll/_token.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  try {
    var body = request.method === 'POST' ? await request.json() : {};
    var token = getToken(request, body);
    if (!token) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing token' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    var enrollment = await env.DB.prepare(
      'SELECT e.id, e.program_id FROM enrollments e WHERE e.access_token = ?'
    ).bind(token).first();
    if (!enrollment) {
      var session = await getSessionUser(env.DB, token);
      if (session) {
        enrollment = await env.DB.prepare(
          'SELECT e.id, e.program_id FROM enrollments e WHERE e.user_id = ? ORDER BY e.enrolled_at DESC LIMIT 1'
        ).bind(session.user_id).first();
        if (!enrollment) {
          enrollment = await env.DB.prepare(
            'SELECT e.id, e.program_id FROM enrollments e WHERE e.student_email = ? ORDER BY e.enrolled_at DESC LIMIT 1'
          ).bind(session.email).first();
        }
      }
    }
    if (!enrollment) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), { status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    var rows = (await env.DB.prepare(
      'SELECT id, question, options, sort_order FROM quiz_questions WHERE program_id = ? ORDER BY sort_order ASC, id ASC'
    ).bind(enrollment.program_id).all()).results || [];
    return new Response(JSON.stringify({ status: 'ok', questions: rows }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
