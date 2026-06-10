import { requireAdmin } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  try {
    if (request.method === 'GET') {
      if (id) {
        const row = await env.DB.prepare('SELECT * FROM programs WHERE id = ?').bind(id).first();
        return new Response(JSON.stringify(row || null), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const rows = await env.DB.prepare("SELECT * FROM programs ORDER BY sort_order ASC, id ASC").all();
      return new Response(JSON.stringify({ status: 'ok', count: rows.results.length, items: rows.results }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { title, slug, tagline, description, duration, price, price_label, sample_content, full_content, status } = body;
      if (!title || !slug) {
        return new Response(JSON.stringify({ error: 'Title and slug required' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      const sort = body.sort_order || 0;
      await env.DB.prepare(
        'INSERT INTO programs (title, slug, tagline, description, duration, price, price_label, sample_content, full_content, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(title, slug, tagline || '', description || '', duration || 'Self-paced', price || 0, price_label || 'Free', sample_content || '', full_content || '', status || 'active', sort).run();
      return new Response(JSON.stringify({ status: 'ok', message: 'Program created' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'PATCH' && id) {
      const body = await request.json();
      const sets = [];
      const vals = [];
      ['title','slug','tagline','description','duration','price','price_label','sample_content','full_content','status','sort_order'].forEach(function(f) {
        if (body[f] !== undefined) { sets.push(f + ' = ?'); vals.push(body[f]); }
      });
      if (sets.length > 0) {
        vals.push(id);
        await env.DB.prepare('UPDATE programs SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals).run();
      }
      return new Response(JSON.stringify({ status: 'ok', updated: id }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'DELETE' && id) {
      const enrollmentCount = await env.DB.prepare(
        'SELECT COUNT(*) AS cnt FROM enrollments WHERE program_id = ?'
      ).bind(id).first();
      if (enrollmentCount && enrollmentCount.cnt > 0) {
        return new Response(JSON.stringify({
          status: 'error',
          message: 'Cannot delete: ' + enrollmentCount.cnt + ' student(s) enrolled. Remove or reassign enrollments first.'
        }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }
      await env.DB.prepare('DELETE FROM programs WHERE id = ?').bind(id).run();
      return new Response(JSON.stringify({ status: 'ok', deleted: id }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'DELETE' && !id) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing program ID' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message || 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
