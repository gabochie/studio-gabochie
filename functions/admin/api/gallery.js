import { requireAdmin } from '../_auth.js';

function json(r, status) {
  return new Response(JSON.stringify(r), {
    status: status || 200, headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'D1 not bound' }, 501);
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  try {
    if (request.method === 'GET') {
      if (id) {
        const row = await env.DB.prepare('SELECT * FROM gallery WHERE id = ?').bind(id).first();
        return json(row || null);
      }
      const { results } = await env.DB.prepare(
        'SELECT * FROM gallery ORDER BY sort_order ASC, created_at DESC'
      ).all();
      return json({ status: 'ok', count: results.length, items: results });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { title, description, image_url, category, sort_order } = body;
      if (!title || !image_url) return json({ error: 'title and image_url required' }, 400);
      const { results } = await env.DB.prepare(
        `INSERT INTO gallery (title, description, image_url, category, sort_order) VALUES (?, ?, ?, ?, ?) RETURNING *`
      ).bind(title, description || '', image_url, category || '', sort_order || 0).all();
      return json(results[0], 201);
    }

    if (request.method === 'PUT' && id) {
      const body = await request.json();
      const { title, description, image_url, category, sort_order, active } = body;
      await env.DB.prepare(
        `UPDATE gallery SET title = ?, description = ?, image_url = ?, category = ?, sort_order = ?, active = ? WHERE id = ?`
      ).bind(title, description || '', image_url, category || '', sort_order || 0, active !== undefined ? (active ? 1 : 0) : 1, id).run();
      return json({ status: 'ok', updated: id });
    }

    if (request.method === 'DELETE' && id) {
      await env.DB.prepare('DELETE FROM gallery WHERE id = ?').bind(id).run();
      return json({ status: 'ok', deleted: id });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ status: 'error', message: err.message || 'Internal error' }, 500);
  }
}
