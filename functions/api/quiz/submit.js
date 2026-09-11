import { getToken, getSessionUser } from '../enroll/_token.js';

var PASS_THRESHOLD = 0.7;

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  try {
    var body = await request.json();
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
    var answers = body.answers || {};
    var questions = (await env.DB.prepare(
      'SELECT id, correct_answer FROM quiz_questions WHERE program_id = ? ORDER BY sort_order ASC, id ASC'
    ).bind(enrollment.program_id).all()).results || [];
    if (!questions.length) {
      return new Response(JSON.stringify({ status: 'error', message: 'No questions for this program' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }
    var score = 0;
    questions.forEach(function(q) {
      if (answers[q.id] !== undefined && answers[q.id] === q.correct_answer) score++;
    });
    var total = questions.length;
    var pct = total > 0 ? score / total : 0;
    var passed = pct >= PASS_THRESHOLD ? 1 : 0;
    await env.DB.prepare(
      'INSERT INTO quiz_attempts (enrollment_id, score, total, passed) VALUES (?, ?, ?, ?)'
    ).bind(enrollment.id, score, total, passed).run();
    return new Response(JSON.stringify({
      status: 'ok',
      score: score,
      total: total,
      passed: passed === 1,
      pass_threshold: Math.round(PASS_THRESHOLD * 100)
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
