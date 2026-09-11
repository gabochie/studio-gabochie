import { hashCode, genSalt, genToken } from './_hash.js';
import { checkRateLimit } from '../_rate-limit.js';

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
  var ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'login', 10, 60)) {
    return new Response(JSON.stringify({ status: 'error', message: 'Too many attempts. Try again later.' }), {
      status: 429, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
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
    if (!email) {
      return new Response(JSON.stringify({ status: 'error', message: 'Email is required' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var student = await db.prepare(
      'SELECT id, name, email, access_code, salt FROM students WHERE email = ?'
    ).bind(email).first();

    // If not in students table, try users table (guitar-only users)
    var user;
    if (!student) {
      user = await db.prepare('SELECT id, name, email FROM users WHERE email = ?').bind(email).first();
      if (!user || !accessCode) {
        return new Response(JSON.stringify({ status: 'error', message: 'Invalid email or access code' }), {
          status: 401, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
        });
      }
    } else {
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
    }

    // Create/find a users record and generate session token
    if (!user) {
      user = await db.prepare('SELECT id, name, email FROM users WHERE email = ?').bind(email).first();
    }
    if (!user) {
      var r = await db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').bind(student ? student.name : email, email).run();
      user = { id: r.meta.last_row_id, name: student ? student.name : email, email: email };
    }
    var token = genToken();
    await db.prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").bind(user.id, token).run();

    var enrollments = await db.prepare(
      `SELECT e.access_token, e.status, p.title AS program_title, p.slug AS program_slug
       FROM enrollments e JOIN programs p ON e.program_id = p.id
       WHERE e.student_email = ?
       ORDER BY e.enrolled_at DESC`
    ).bind(email).all();
    return new Response(JSON.stringify({
      status: 'ok',
      student: { id: user.id, name: user.name, email: user.email },
      token: token,
      enrollments: enrollments.results || []
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
