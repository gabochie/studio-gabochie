import { hashCode, genSalt } from '../auth/_hash.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try { body = await request.json(); } catch (_e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const { name, email, company } = body;
  if (!name || !email) {
    return new Response(JSON.stringify({ error: 'Name and email are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if sponsor already exists
  const existing = await env.DB.prepare(
    'SELECT id, access_code FROM sponsors WHERE email = ?'
  ).bind(normalizedEmail).first();
  if (existing) {
    return new Response(JSON.stringify({
      status: 'ok', message: 'You already have a sponsor account',
      access_code: existing.access_code
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Generate access code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const gen = (len) => {
    let r = '';
    for (let i = 0; i < len; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
    return r;
  };
  const accessCode = `SPON-${gen(4)}-${gen(4)}`;
  const salt = genSalt();
  const hashed = await hashCode(accessCode, salt);
  const stored = salt + ':' + hashed;

  try {
    await env.DB.prepare(
      'INSERT INTO sponsors (email, company, access_code) VALUES (?, ?, ?)'
    ).bind(normalizedEmail, company || '', stored).run();
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return new Response(JSON.stringify({ error: 'A sponsor with this email already exists' }), {
        status: 409, headers: { 'Content-Type': 'application/json' }
      });
    }
    throw e;
  }

  return new Response(JSON.stringify({
    status: 'ok',
    message: 'Sponsor account created',
    access_code: accessCode,
    email: normalizedEmail
  }), { headers: { 'Content-Type': 'application/json' } });
}
