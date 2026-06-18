import { requireAdminAuth } from './_admin-auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const body = await request.json();
    const { key, value } = body;
    if (!key || value === undefined) {
      return new Response(JSON.stringify({ error: 'Missing key or value' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    await db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(key, String(value)).run();
    return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
