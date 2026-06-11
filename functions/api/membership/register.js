import { hashPassword, genToken } from '../auth/_hash.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } });

  try {
    var { name, email, password } = await request.json();
    if (!email || !password) return new Response(JSON.stringify({ status: 'error', message: 'Email and password required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
    if (password.length < 6) return new Response(JSON.stringify({ status: 'error', message: 'Password must be at least 6 characters' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

    var db = env.DB;
    var existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return new Response(JSON.stringify({ status: 'error', message: 'Email already registered' }), { status: 409, headers: { 'Content-Type': 'application/json', ...cors } });

    var pwHash = await hashPassword(password);
    var result = await db.prepare(
      "INSERT INTO users (name, email, password_hash, membership_tier, email_verified) VALUES (?, ?, ?, 'free', 1)"
    ).bind(name || email.split('@')[0], email, pwHash).run();
    var userId = result.meta.last_row_id;

    var token = genToken();
    await db.prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").bind(userId, token).run();

    return new Response(JSON.stringify({ status: 'ok', user: { id: userId, name: name || email.split('@')[0], email, membership_tier: 'free' }, token }), { status: 201, headers: { 'Content-Type': 'application/json', ...cors } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
  }
}
