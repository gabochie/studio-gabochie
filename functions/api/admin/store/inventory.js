import { requireAdminAuth } from '../_admin-auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  if (request.method === 'GET') {
    try {
      const rows = await db.prepare('SELECT * FROM inventory ORDER BY product_slug, size').all();
      return new Response(JSON.stringify({ items: rows.results || [] }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { id, quantity } = body;
      if (!id || quantity === undefined) {
        return new Response(JSON.stringify({ error: 'Missing id or quantity' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      await db.prepare("UPDATE inventory SET quantity = ?, updated_at = datetime('now') WHERE id = ?").bind(parseInt(quantity) || 0, id).run();
      return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
}
