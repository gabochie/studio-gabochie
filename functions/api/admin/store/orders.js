import { requireAdminAuth } from '../_admin-auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get('status') || '';
      const deliveryStatus = url.searchParams.get('delivery_status') || '';
      let sql = 'SELECT * FROM store_orders';
      const conditions = [];
      const params = [];
      if (status) { conditions.push('status = ?'); params.push(status); }
      if (deliveryStatus) { conditions.push('delivery_status = ?'); params.push(deliveryStatus); }
      if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' ORDER BY created_at DESC LIMIT 200';
      const rows = await db.prepare(sql).bind(...params).all();
      return new Response(JSON.stringify({ orders: rows.results || [] }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const { id, delivery_status, courier_name, tracking_info } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing order id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const updates = [];
      const params = [];
      if (delivery_status !== undefined) { updates.push('delivery_status = ?'); params.push(delivery_status); }
      if (courier_name !== undefined) { updates.push('courier_name = ?'); params.push(courier_name); }
      if (tracking_info !== undefined) { updates.push('tracking_info = ?'); params.push(tracking_info); }
      if (updates.length === 0) {
        return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      params.push(id);
      await db.prepare('UPDATE store_orders SET ' + updates.join(', ') + ' WHERE id = ?').bind(...params).run();
      return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
}
