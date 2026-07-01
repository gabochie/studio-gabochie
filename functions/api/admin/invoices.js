import { requireAdminAuth } from './_admin-auth.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  try {
    if (request.method === 'GET') {
      var url = new URL(request.url);
      var type = url.searchParams.get('type') || '';
      var status = url.searchParams.get('status') || '';
      var search = url.searchParams.get('search') || '';
      var limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 500);
      var offset = parseInt(url.searchParams.get('offset')) || 0;

      var sql = 'SELECT * FROM invoices WHERE 1=1';
      var params = [];
      if (type) { sql += ' AND invoice_type = ?'; params.push(type); }
      if (status) { sql += ' AND status = ?'; params.push(status); }
      if (search) { sql += ' AND (customer_name LIKE ? OR customer_email LIKE ? OR invoice_number LIKE ?)'; var s = '%' + search + '%'; params.push(s, s, s); }
      sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      var countSql = sql.replace(/SELECT \*.*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/LIMIT \? OFFSET \?/, '');
      var countParams = params.slice(0, -2);
      var total = (await env.DB.prepare(countSql).bind(...countParams).first()).total || 0;
      var results = (await env.DB.prepare(sql).bind(...params).all()).results || [];

      var typeCounts = (await env.DB.prepare('SELECT invoice_type, COUNT(*) as c FROM invoices GROUP BY invoice_type ORDER BY c DESC').all()).results || [];
      var statusCounts = (await env.DB.prepare('SELECT status, COUNT(*) as c FROM invoices GROUP BY status').all()).results || [];

      return new Response(JSON.stringify({ status: 'ok', items: results, total: total, types: typeCounts, statuses: statusCounts }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    if (request.method === 'PUT') {
      url = new URL(request.url);
      var id = url.searchParams.get('id');
      var body = await request.json();
      if (!id) return new Response(JSON.stringify({ status: 'error', message: 'ID required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      var fields = []; params = [];
      if (body.status) { fields.push('status = ?'); params.push(body.status); }
      if (body.notes !== undefined) { fields.push('notes = ?'); params.push(body.notes); }
      if (!fields.length) return new Response(JSON.stringify({ status: 'error', message: 'No fields to update' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
      params.push(id);
      await env.DB.prepare('UPDATE invoices SET ' + fields.join(', ') + ' WHERE id = ?').bind(...params).run();
      return new Response(JSON.stringify({ status: 'ok' }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
