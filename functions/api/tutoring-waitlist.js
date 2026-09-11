import { checkRateLimit } from './_rate-limit.js';

var CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });

  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...CORS } });

  var ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'tutoring-waitlist', 3, 300)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  try {
    var body = await request.json();
    var name = (body.name || '').trim();
    var email = (body.email || '').trim();
    var phone = (body.phone || '').trim();
    var role = (body.role || 'both').trim();
    var subjects = body.subjects || [];

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'name and email required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    var validRoles = ['student', 'tutor', 'both'];
    if (!validRoles.includes(role)) role = 'both';

    if (!Array.isArray(subjects)) subjects = [];

    var existing = await env.DB.prepare("SELECT id FROM tutoring_waitlist WHERE email = ?").bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ status: 'ok', message: "You're already on the waitlist! We'll notify you when we launch." }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    await env.DB.prepare("INSERT INTO tutoring_waitlist (name, email, phone, role, subjects) VALUES (?, ?, ?, ?, ?)").bind(name, email, phone, role, JSON.stringify(subjects)).run();

    return new Response(JSON.stringify({ status: 'ok', message: "You're on the waitlist! We'll keep you posted on our launch." }), { status: 201, headers: { 'Content-Type': 'application/json', ...CORS } });
  } catch (_err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}
