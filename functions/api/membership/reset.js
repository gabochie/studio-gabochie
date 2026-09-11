import { hashPassword } from '../auth/_hash.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } });

  try {
    var { token, email, new_password } = await request.json();
    if (!token || !email || !new_password) {
      return new Response(JSON.stringify({ status: 'error', message: 'Token, email, and new password are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
    }
    if (new_password.length < 6) {
      return new Response(JSON.stringify({ status: 'error', message: 'Password must be at least 6 characters' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    var db = env.DB;
    if (!db) return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...cors } });

    var emailClean = email.trim().toLowerCase();
    var user = await db.prepare('SELECT id, name, reset_token, reset_token_expires_at FROM users WHERE email = ?').bind(emailClean).first();
    if (!user || !user.reset_token || user.reset_token !== token) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid reset link' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });
    }
    if (user.reset_token_expires_at && new Date(user.reset_token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ status: 'error', message: 'Reset link has expired. Request a new one.' }), { status: 410, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    var pwHash = await hashPassword(new_password);
    await db.prepare("UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?").bind(pwHash, user.id).run();

    return new Response(JSON.stringify({ status: 'ok', message: 'Password reset successfully' }), { headers: { 'Content-Type': 'application/json', ...cors } });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
  }
}
