import { hashCode, genSalt } from './_hash.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
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
    var email = (body.email || '').trim().toLowerCase();
    var accessCode = (body.access_code || '').trim();
    if (!email || !accessCode) {
      return new Response(JSON.stringify({ status: 'error', message: 'Email and access code are required' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var student = await db.prepare(
      'SELECT id, name, email, access_code, salt FROM students WHERE email = ?'
    ).bind(email).first();
    if (!student) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid email or access code' }), {
        status: 401, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var valid = false;
    if (student.salt) {
      var hashed = await hashCode(accessCode, student.salt);
      valid = hashed === student.access_code;
    } else {
      valid = accessCode === student.access_code;
      if (valid) {
        var salt = genSalt();
        hashed = await hashCode(accessCode, salt);
        await db.prepare(
          'UPDATE students SET access_code = ?, salt = ? WHERE id = ?'
        ).bind(hashed, salt, student.id).run();
      }
    }
    if (!valid) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid email or access code' }), {
        status: 401, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var enrollments = await db.prepare(
      `SELECT e.access_token, e.status, p.title AS program_title, p.slug AS program_slug
       FROM enrollments e JOIN programs p ON e.program_id = p.id
       WHERE e.student_email = ?
       ORDER BY e.enrolled_at DESC`
    ).bind(email).all();
    return new Response(JSON.stringify({
      status: 'ok',
      student: { id: student.id, name: student.name, email: student.email },
      enrollments: enrollments.results || []
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
