// Dynamic sitemap for D1-published blog posts.
// The static sitemap.xml only covers static URLs, so newly published posts
// would be invisible to crawlers. Registered in robots.txt alongside it.
function xml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function dbDate(value, fallback) {
  var s = String(value || '').replace('T', ' ').replace('Z', '').slice(0, 19);
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) s = String(fallback || '').slice(0, 19);
  return s.slice(0, 10);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { 'Allow': 'GET' } });
  }
  try {
    if (!env.DB) {
      return new Response('D1 not bound', { status: 501 });
    }
    // setup.js normalises legacy ISO timestamps to SQLite's datetime format,
    // so the lexicographic gate below is valid for both seeded and legacy rows.
    const rows = await env.DB.prepare(
      "SELECT slug, updated_at, published_at, created_at FROM posts WHERE status = 'published' " +
      "AND published_at != '' AND published_at <= datetime('now') ORDER BY published_at DESC LIMIT 500"
    ).all();
    var today = new Date().toISOString().slice(0, 10);
    const urls = (rows.results || [])
      .filter(function (r) { return /^[a-z0-9-]+$/.test(r.slug || ''); })
      .map(function (r) {
        var lastmod = dbDate(r.updated_at, dbDate(r.published_at, r.created_at)) || today;
        return '  <url><loc>https://studio.gabochie.com/blog/' + xml(r.slug) + '/</loc><lastmod>' + xml(lastmod) + '</lastmod><priority>0.8</priority><changefreq>monthly</changefreq></url>';
      })
      .join('\n');
    const body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>';
    return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=UTF-8', 'Cache-Control': 'public, max-age=3600' } });
  } catch (_err) {
    return new Response('Internal error', { status: 500 });
  }
}
