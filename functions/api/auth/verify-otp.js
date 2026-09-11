import { genToken } from './_hash.js';

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
    var email = sanitize(body.email || '').toLowerCase();
    var code = sanitize(body.code || '');
    var name = sanitize(body.name || '');
    if (!email || !code) {
      return new Response(JSON.stringify({ status: 'error', message: 'Email and code required' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var otpRecord = await db.prepare(
      "SELECT id, code, expires_at, used, attempts FROM otp_codes WHERE identifier = ? AND used = 0 ORDER BY created_at DESC LIMIT 1"
    ).bind(email).first();
    if (!otpRecord) {
      return new Response(JSON.stringify({ status: 'error', message: 'No OTP found for this email. Request a new code.' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (otpRecord.expires_at < new Date().toISOString().replace('T', ' ').slice(0, 19)) {
      await db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').bind(otpRecord.id).run();
      return new Response(JSON.stringify({ status: 'error', message: 'Code has expired. Request a new one.' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var attempts = (otpRecord.attempts || 0) + 1;
    await db.prepare('UPDATE otp_codes SET attempts = ? WHERE id = ?').bind(attempts, otpRecord.id).run();
    if (attempts > 5) {
      await db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').bind(otpRecord.id).run();
      return new Response(JSON.stringify({ status: 'error', message: 'Too many attempts. Request a new code.' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    if (otpRecord.code !== code) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid code. Please try again.' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    await db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').bind(otpRecord.id).run();
    var user = await db.prepare('SELECT id, name, email, phone, email_verified FROM users WHERE email = ?').bind(email).first();
    var isNew = false;
    if (!user) {
      isNew = true;
      var displayName = name || email.split('@')[0];
      await db.prepare(
        'INSERT INTO users (name, email, email_verified, last_login_at) VALUES (?, ?, 1, datetime(\'now\'))'
      ).bind(displayName, email).run();
      user = await db.prepare('SELECT id, name, email, email_verified FROM users WHERE email = ?').bind(email).first();
    } else {
      await db.prepare(
        "UPDATE users SET email_verified = 1, last_login_at = datetime('now') WHERE id = ?"
      ).bind(user.id).run();
    }
    var token = genToken();
    var expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    await db.prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, token, expiresAt).run();
    return new Response(JSON.stringify({
      status: 'ok',
      session_token: token,
      user: { id: user.id, name: user.name, email: user.email, email_verified: user.email_verified, is_new: isNew }
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
