import { requireAdmin } from '../_auth.js';

function json(r, status) {
  return new Response(JSON.stringify(r), {
    status: status || 200, headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'D1 not bound' }, 501);
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  try {
    if (request.method === 'GET') {
      if (id) {
        const row = await env.DB.prepare('SELECT * FROM testimonials WHERE id = ?').bind(id).first();
        return json(row || null);
      }
      const { results } = await env.DB.prepare(
        'SELECT * FROM testimonials ORDER BY created_at DESC'
      ).all();
      return json({ status: 'ok', count: results.length, items: results });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { author, role, content, rating } = body;
      if (!author || !content) return json({ error: 'author and content required' }, 400);
      const { results } = await env.DB.prepare(
        `INSERT INTO testimonials (author, role, content, rating) VALUES (?, ?, ?, ?) RETURNING *`
      ).bind(author, role || '', content, rating || 5).all();
      return json(results[0], 201);
    }

    if (request.method === 'PUT' && id) {
      const body = await request.json();
      const { author, role, content, rating, active } = body;
      await env.DB.prepare(
        `UPDATE testimonials SET author = ?, role = ?, content = ?, rating = ?, active = ? WHERE id = ?`
      ).bind(author, role || '', content, rating || 5, active !== undefined ? (active ? 1 : 0) : 1, id).run();
      return json({ status: 'ok', updated: id });
    }

    if (request.method === 'DELETE' && id) {
      await env.DB.prepare('DELETE FROM testimonials WHERE id = ?').bind(id).run();
      return json({ status: 'ok', deleted: id });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ status: 'error', message: err.message || 'Internal error' }, 500);
  }
}
