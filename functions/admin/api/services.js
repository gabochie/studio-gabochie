import { requireAdmin } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  try {
    if (request.method === 'GET') {
      if (id) {
        const row = await env.DB.prepare('SELECT * FROM service_inquiries WHERE id = ?').bind(id).first();
        return new Response(JSON.stringify(row || null), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const search = url.searchParams.get('q') || '';
      const serviceFilter = url.searchParams.get('service') || '';
      let sql = "SELECT * FROM service_inquiries WHERE 1=1";
      let params = [];
      if (search) {
        sql += " AND (name LIKE ? OR email LIKE ? OR company LIKE ? OR description LIKE ?)";
        var s = '%' + search + '%';
        params.push(s, s, s, s);
      }
      if (serviceFilter) {
        sql += " AND service = ?";
        params.push(serviceFilter);
      }
      sql += " ORDER BY created_at DESC";
      const rows = await env.DB.prepare(sql).bind(...params).all();
      return new Response(JSON.stringify({ status: 'ok', count: rows.results.length, items: rows.results }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (request.method === 'PATCH' && id) {
      const body = await request.json();
      const { status: newStatus, notes } = body;
      if (newStatus) {
        await env.DB.prepare('UPDATE service_inquiries SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(newStatus, id).run();
      }
      if (notes !== undefined) {
        await env.DB.prepare('UPDATE service_inquiries SET notes = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(notes, id).run();
      }
      return new Response(JSON.stringify({ status: 'ok', updated: id }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
