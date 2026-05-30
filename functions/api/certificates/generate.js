import { getToken } from '../enroll/_token.js';

function genCode() {
  var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var r = '';
  for (var i = 0; i < 4; i++) { for (var j = 0; j < 4; j++) r += c.charAt(Math.floor(Math.random() * c.length)); if (i < 3) r += '-'; }
  return r;
}

export async function onRequest(context) {
  var { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    var body = await request.json();
    var token = getToken(request, body);
    if (!token) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing token' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    var enrollment = await db.prepare(
      'SELECT e.id, e.student_name, e.student_email, e.status, p.title AS program_title, p.slug AS program_slug FROM enrollments e JOIN programs p ON e.program_id = p.id WHERE e.access_token = ?'
    ).bind(token).first();
    if (!enrollment) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid token' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    // Check all modules completed
    var total = await db.prepare(
      'SELECT COUNT(*) AS c FROM modules WHERE program_id = (SELECT program_id FROM enrollments WHERE id = ?)'
    ).bind(enrollment.id).first();
    var done = await db.prepare(
      'SELECT COUNT(*) AS c FROM module_completions WHERE enrollment_id = ?'
    ).bind(enrollment.id).first();
    if (!total || !done || done.c < total.c) {
      return new Response(JSON.stringify({ status: 'error', message: 'Complete all modules first' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    // Check if certificate already exists
    var existing = await db.prepare(
      'SELECT certificate_code FROM certificates WHERE enrollment_id = ?'
    ).bind(enrollment.id).first();
    if (existing) {
      return new Response(JSON.stringify({ status: 'ok', certificate_code: existing.certificate_code, existing: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // Generate unique code
    var code = genCode();
    var retries = 0;
    while (retries < 10) {
      var dup = await db.prepare('SELECT id FROM certificates WHERE certificate_code = ?').bind(code).first();
      if (!dup) break;
      code = genCode();
      retries++;
    }
    await db.prepare(
      'INSERT INTO certificates (enrollment_id, student_name, student_email, program_title, program_slug, certificate_code) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(enrollment.id, enrollment.student_name, enrollment.student_email, enrollment.program_title, enrollment.program_slug, code).run();
    return new Response(JSON.stringify({ status: 'ok', certificate_code: code, existing: false }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
