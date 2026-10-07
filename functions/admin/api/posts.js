import { requireAdmin } from '../_auth.js';

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200, headers: { 'Content-Type': 'application/json' }
  });
}

// Admin post listing (includes drafts). Writes live in /api/posts.js.
export async function onRequest(context) {
  var { request, env } = context;
  if (!env.DB) return json({ error: 'D1 not bound' }, 501);
  var authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    var url = new URL(request.url);
    var slug = url.searchParams.get('slug') || '';
    if (slug) {
      var post = await env.DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(slug).first();
      if (!post) return json({ error: 'Not found' }, 404);
      return json(post);
    }
    var rows = await env.DB.prepare(
      'SELECT id, slug, title, excerpt, html, cover_image, tags, faqs, status, author, published_at, updated_at, created_at FROM posts ORDER BY updated_at DESC LIMIT 100'
    ).all();
    return json({ status: 'ok', items: rows.results || [] });
  } catch (err) {
    return json({ status: 'error', message: err.message || 'Internal error' }, 500);
  }
}
