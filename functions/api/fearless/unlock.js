// POST {code, email} -> {status, token, expires_at}
// Redeems a printed-book unlock code into a 90-day streaming token.
// Codes are minted offline (site/mint_codes.py) and imported to D1 fearless_codes.
import { checkRateLimit } from '../_rate-limit.js';

function genToken() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var t = '';
  for (var i = 0; i < 40; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

function expiry(days) {
  var d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export async function onRequest(context) {
  var req = context.request, env = context.env;
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    var body = await req.json();
    var code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
    var email = String(body.email || '').slice(0, 120);
    if (!code) {
      return new Response(JSON.stringify({ status: 'error', message: 'Enter your printed code.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    var ip = req.headers.get('CF-Connecting-IP') || '';
    if (!await checkRateLimit(env.DB, ip, 'fearless_unlock', 10, 60)) {
      return new Response(JSON.stringify({ status: 'error', message: 'Too many tries. Wait a minute.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }
    var row = await env.DB.prepare('SELECT code, status FROM fearless_codes WHERE code = ?').bind(code).first();
    if (!row) {
      return new Response(JSON.stringify({ status: 'error', message: 'Code not recognised. Check the printing inside your booklet.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (row.status !== 'active') {
      return new Response(JSON.stringify({ status: 'error', message: 'This code was already redeemed.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    var token = genToken();
    var exp = expiry(90);
    await env.DB.prepare('INSERT INTO fearless_tokens (token, code, email, expires_at) VALUES (?, ?, ?, ?)').bind(token, code, email, exp).run();
    await env.DB.prepare("UPDATE fearless_codes SET status = 'redeemed', issued_to = ?, redeemed_at = datetime('now') WHERE code = ?").bind(email, code).run();
    return new Response(JSON.stringify({ status: 'ok', token: token, expires_at: exp }), { headers: { 'Content-Type': 'application/json' } });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
