import { verifyPassword, genToken } from '../auth/_hash.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } });

  try {
    var { email, password } = await request.json();
    if (!email || !password) return new Response(JSON.stringify({ status: 'error', message: 'Email and password required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

    var db = env.DB;
    var user = await db.prepare('SELECT id, name, email, password_hash, membership_tier, membership_expires_at FROM users WHERE email = ?').bind(email).first();
    if (!user || !user.password_hash) return new Response(JSON.stringify({ status: 'error', message: 'Invalid email or password' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });

    var valid = await verifyPassword(password, user.password_hash);
    if (!valid) return new Response(JSON.stringify({ status: 'error', message: 'Invalid email or password' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });

    var token = genToken();
    await db.prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").bind(user.id, token).run();
    await db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(user.id).run();

    return new Response(JSON.stringify({ status: 'ok', user: { id: user.id, name: user.name, email: user.email, membership_tier: user.membership_tier }, token }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
  }
}
