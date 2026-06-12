import { checkRateLimit } from './_rate-limit.js';

var CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json', ...CORS } });

  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });

  var ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'career_resource', 5, 300)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), { status: 429, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  try {
    var body = await request.json();
    var email = (body.email || '').trim().toLowerCase();
    var name = (body.name || '').trim();
    var resource_slug = (body.resource_slug || '').trim();

    if (!email || !name) {
      return new Response(JSON.stringify({ error: 'name and email required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    if (resource_slug && !/^[a-z0-9_-]+$/.test(resource_slug)) {
      return new Response(JSON.stringify({ error: 'Invalid resource' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    await env.DB.prepare("INSERT INTO career_resource_leads (email, name, resource_slug) VALUES (?, ?, ?)").bind(email, name, resource_slug).run();

    return new Response(JSON.stringify({ status: 'ok', message: 'Access granted! Redirecting to resource...' }), { status: 201, headers: { 'Content-Type': 'application/json', ...CORS } });

  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return new Response(JSON.stringify({ status: 'ok', message: 'Already have your email. Redirecting...' }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
    }
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
}
