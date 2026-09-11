import { requireAdmin } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  try {
    if (request.method === 'GET') {
      if (id) {
        const row = await env.DB.prepare('SELECT * FROM newsletter_templates WHERE id = ?').bind(id).first();
        return new Response(JSON.stringify(row || null), { headers: { 'Content-Type': 'application/json' } });
      }
      const rows = await env.DB.prepare('SELECT id, name, subject, created_at, updated_at FROM newsletter_templates ORDER BY updated_at DESC').all();
      return new Response(JSON.stringify({ status: 'ok', items: rows.results }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { name, subject, blocks, template_id } = body;
      if (!name || !blocks) {
        return new Response(JSON.stringify({ status: 'error', message: 'name and blocks required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (template_id) {
        await env.DB.prepare(
          "UPDATE newsletter_templates SET name = ?, subject = ?, blocks = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(name, subject || '', JSON.stringify(blocks), template_id).run();
        return new Response(JSON.stringify({ status: 'ok', id: template_id }), { headers: { 'Content-Type': 'application/json' } });
      }
      const result = await env.DB.prepare(
        "INSERT INTO newsletter_templates (name, subject, blocks) VALUES (?, ?, ?)"
      ).bind(name, subject || '', JSON.stringify(blocks)).run();
      return new Response(JSON.stringify({ status: 'ok', id: result.meta?.last_row_id }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'DELETE') {
      if (!id) {
        return new Response(JSON.stringify({ status: 'error', message: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      await env.DB.prepare('DELETE FROM newsletter_templates WHERE id = ?').bind(id).run();
      return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
