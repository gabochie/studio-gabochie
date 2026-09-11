import { checkRateLimit } from './_rate-limit.js';

var CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...CORS } });

  // GET — not needed publicly
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });

  var ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'career', 3, 300)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  try {
    var body = await request.json();
    var name = (body.name || '').trim();
    var email = (body.email || '').trim();
    var phone = (body.phone || '').trim();
    var job_title = (body.job_title || '').trim();
    var cv_url = (body.cv_url || '').trim();
    var cover_letter = (body.cover_letter || '').trim();

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'name and email required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    await env.DB.prepare("INSERT INTO career_applications (job_title, name, email, phone, cv_url, cover_letter) VALUES (?, ?, ?, ?, ?, ?)").bind(job_title, name, email, phone, cv_url, cover_letter).run();

    return new Response(JSON.stringify({ status: 'ok', message: 'Application received. We will review and get back to you.' }), { status: 201, headers: { 'Content-Type': 'application/json', ...CORS } });

  } catch (_err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}