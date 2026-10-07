import { requireAdmin } from '../admin/_auth.js';

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function sanitize(s, max) {
  s = String(s || '').trim();
  return max ? s.slice(0, max) : s;
}

function cleanHtml(html) {
  // Admin-authored HTML, but never store executable scripts.
  return String(html || '').replace(/<script[\s\S]*?<\/script\s*>/gi, '');
}

function parseList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      var p = JSON.parse(v);
      if (Array.isArray(p)) return p;
    } catch (_e) {}
    return v.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  return [];
}

function parseFaqs(v) {
  if (Array.isArray(v)) {
    return v.filter(function (f) { return f && (f.q || f.question); }).map(function (f) {
      return { q: String(f.q || f.question || '').slice(0, 300), a: String(f.a || f.answer || '').slice(0, 2000) };
    });
  }
  return [];
}

export async function onRequest(context) {
  var { request, env } = context;
  if (!env.DB) return json({ error: 'D1 not bound' }, 501);
  var url = new URL(request.url);

  try {
    if (request.method === 'GET') {
      var slug = url.searchParams.get('slug') || '';
      var tag = url.searchParams.get('tag') || '';
      var limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 50);
      if (slug) {
        var post = await env.DB.prepare(
          "SELECT slug, title, excerpt, html, cover_image, tags, faqs, author, published_at, updated_at FROM posts WHERE slug = ? AND status = 'published'"
        ).bind(slug).first();
        if (!post) return json({ status: 'error', message: 'Not found' }, 404);
        return json({ status: 'ok', post: post });
      }
      var rows;
      if (tag) {
        rows = await env.DB.prepare(
          "SELECT slug, title, excerpt, cover_image, tags, author, published_at FROM posts WHERE status = 'published' AND tags LIKE ? ORDER BY published_at DESC LIMIT ?"
        ).bind('%' + tag + '%', limit).all();
      } else {
        rows = await env.DB.prepare(
          "SELECT slug, title, excerpt, cover_image, tags, author, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT ?"
        ).bind(limit).all();
      }
      return json({ status: 'ok', posts: rows.results || [] });
    }

    // Writes require admin key.
    var authErr = await requireAdmin(request, env);
    if (authErr) return authErr;

    if (request.method === 'POST') {
      var body = await request.json();
      var newSlug = sanitize(body.slug, 120).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
      var title = sanitize(body.title, 200);
      if (!newSlug || !title) return json({ error: 'slug and title required' }, 400);
      var now = new Date().toISOString();
      var status = body.status === 'published' ? 'published' : 'draft';
      var publishedAt = sanitize(body.published_at, 30) || (status === 'published' ? now : '');
      var res = await env.DB.prepare(
        `INSERT INTO posts (slug, title, excerpt, html, cover_image, tags, faqs, status, author, published_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        newSlug, title, sanitize(body.excerpt, 500), cleanHtml(body.html),
        sanitize(body.cover_image, 500), JSON.stringify(parseList(body.tags)),
        JSON.stringify(parseFaqs(body.faqs)),
        status, sanitize(body.author, 120) || 'Gideon Abochie', publishedAt, now
      ).run();
      return json({ status: 'ok', id: res.meta.last_row_id, slug: newSlug }, 201);
    }

    if (request.method === 'PUT') {
      var put = await request.json();
      var putSlug = sanitize(put.slug, 120);
      if (!putSlug) return json({ error: 'slug required' }, 400);
      var existing = await env.DB.prepare('SELECT id, published_at FROM posts WHERE slug = ?').bind(putSlug).first();
      if (!existing) return json({ error: 'Not found' }, 404);
      var newStatus = put.status === 'published' ? 'published' : 'draft';
      var newPublished = sanitize(put.published_at, 30) || existing.published_at || (newStatus === 'published' ? new Date().toISOString() : '');
      await env.DB.prepare(
        `UPDATE posts SET title = ?, excerpt = ?, html = ?, cover_image = ?, tags = ?, faqs = ?, status = ?, author = ?, published_at = ?, updated_at = datetime('now') WHERE slug = ?`
      ).bind(
        sanitize(put.title, 200), sanitize(put.excerpt, 500), cleanHtml(put.html),
        sanitize(put.cover_image, 500), JSON.stringify(parseList(put.tags)), JSON.stringify(parseFaqs(put.faqs)),
        newStatus, sanitize(put.author, 120) || 'Gideon Abochie', newPublished, putSlug
      ).run();
      return json({ status: 'ok', slug: putSlug });
    }

    if (request.method === 'DELETE') {
      var delSlug = sanitize(url.searchParams.get('slug'), 120);
      if (!delSlug) return json({ error: 'slug required' }, 400);
      await env.DB.prepare('DELETE FROM posts WHERE slug = ?').bind(delSlug).run();
      return json({ status: 'ok', deleted: delSlug });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ status: 'error', message: err.message || 'Internal error' }, 500);
  }
}
