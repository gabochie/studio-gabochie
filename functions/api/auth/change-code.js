import { hashCode, genSalt } from './_hash.js';
function sanitize(s) { return (s || '').replace(/<[^>]*>/g, '').trim(); }

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
    var currentCode = (body.current_code || '').trim();
    var newCode = sanitize(body.new_code);
    if (!email || !currentCode || !newCode) {
      return new Response(JSON.stringify({ status: 'error', message: 'Email, current code, and new code are required' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (newCode.length < 4) {
      return new Response(JSON.stringify({ status: 'error', message: 'New code must be at least 4 characters' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (newCode.length > 100) {
      return new Response(JSON.stringify({ status: 'error', message: 'New code too long' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var student = await db.prepare(
      'SELECT id, access_code, salt FROM students WHERE email = ?'
    ).bind(email).first();
    if (!student) {
      return new Response(JSON.stringify({ status: 'error', message: 'Current access code is incorrect' }), {
        status: 401, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var valid = false;
    if (student.salt) {
      var hashed = await hashCode(currentCode, student.salt);
      valid = hashed === student.access_code;
    } else {
      valid = currentCode === student.access_code;
    }
    if (!valid) {
      return new Response(JSON.stringify({ status: 'error', message: 'Current access code is incorrect' }), {
        status: 401, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var newSalt = genSalt();
    var newHashed = await hashCode(newCode, newSalt);
    await db.prepare(
      'UPDATE students SET access_code = ?, salt = ? WHERE id = ?'
    ).bind(newHashed, newSalt, student.id).run();
    return new Response(JSON.stringify({ status: 'ok', message: 'Access code updated' }), {
      headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
