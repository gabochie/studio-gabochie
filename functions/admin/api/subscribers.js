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
  const scope = url.searchParams.get('scope');
  try {
    if (request.method === 'GET') {
      if (id) {
        var row = await env.DB.prepare('SELECT * FROM subscribers WHERE id = ?').bind(id).first();
        return new Response(JSON.stringify(row || null), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      var search = url.searchParams.get('q') || '';
      var group = url.searchParams.get('group') || '';
      if (group === 'edition') {
        var editionRows = await env.DB.prepare(
          "SELECT COALESCE(NULLIF(edition,''), 'ROW') AS edition, COUNT(*) AS count FROM subscribers GROUP BY edition ORDER BY count DESC"
        ).all();
        var editions = {};
        editionRows.results.forEach(function(r){ editions[r.edition] = r.count; });
        return new Response(JSON.stringify({ status: 'ok', editions }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      var rows;
      var scopeSql = scope === 'newsletter' ? " AND source = 'newsletter_subdomain'" : '';
      if (search) {
        rows = await env.DB.prepare(
          "SELECT * FROM subscribers WHERE (email LIKE ? OR name LIKE ?)" + scopeSql + " ORDER BY subscribed_at DESC"
        ).bind('%' + search + '%', '%' + search + '%').all();
      } else {
        rows = await env.DB.prepare("SELECT * FROM subscribers WHERE 1=1" + scopeSql + " ORDER BY subscribed_at DESC").all();
      }
      return new Response(JSON.stringify({ status: 'ok', count: rows.results.length, items: rows.results }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (request.method === 'DELETE' && id) {
      await env.DB.prepare('DELETE FROM subscribers WHERE id = ?').bind(id).run();
      return new Response(JSON.stringify({ status: 'ok', deleted: id }), {
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
