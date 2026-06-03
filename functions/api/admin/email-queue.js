import { requireAdminAuth } from './_admin-auth.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  var authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  try {
    var url = new URL(request.url);
    var limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 100);
    var status = url.searchParams.get('status') || '';

    var where = status ? "WHERE sent_at IS " + (status === 'sent' ? "NOT NULL" : "NULL") : "";
    var total = (await env.DB.prepare("SELECT COUNT(*) as c FROM email_queue " + where).first()).c || 0;
    var sentCount = (await env.DB.prepare("SELECT COUNT(*) as c FROM email_queue WHERE sent_at IS NOT NULL").first()).c || 0;
    var pendingCount = (await env.DB.prepare("SELECT COUNT(*) as c FROM email_queue WHERE sent_at IS NULL").first()).c || 0;

    var rows = (await env.DB.prepare(
      "SELECT * FROM email_queue " + where + " ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all()).results || [];

    return new Response(JSON.stringify({
      status: 'ok',
      items: rows,
      total: total,
      stats: { sent: sentCount, pending: pendingCount }
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
