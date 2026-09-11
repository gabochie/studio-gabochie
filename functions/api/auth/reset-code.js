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
    var token = (body.token || '').trim();
    var email = (body.email || '').trim().toLowerCase();
    var newCode = (body.new_code || '').trim();
    if (!token || !email || !newCode) {
      return new Response(JSON.stringify({ status: 'error', message: 'Token, email, and new code are required' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (newCode.length < 4) {
      return new Response(JSON.stringify({ status: 'error', message: 'New code must be at least 4 characters' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var student = await db.prepare(
      'SELECT id, name, reset_token, reset_token_expires_at FROM students WHERE email = ?'
    ).bind(email).first();
    if (!student) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid reset link' }), {
        status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (!student.reset_token || student.reset_token !== token) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid reset link' }), {
        status: 401, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (student.reset_token_expires_at && new Date(student.reset_token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ status: 'error', message: 'Reset link has expired. Request a new one.' }), {
        status: 410, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var salt = genSalt();
    var hashed = await hashCode(newCode, salt);
    await db.prepare(
      'UPDATE students SET access_code = ?, salt = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?'
    ).bind(hashed, salt, student.id).run();
    return new Response(JSON.stringify({ status: 'ok', message: 'Access code reset successfully' }), {
      headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
