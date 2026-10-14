// Dynamic sitemap for D1-published blog posts.
// The static sitemap.xml only covers static URLs, so newly published posts
// would be invisible to crawlers. Registered in robots.txt alongside it.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  try {
    if (!env.DB) {
      return new Response('D1 not bound', { status: 501 });
    }
    const rows = await env.DB.prepare(
      "SELECT slug, updated_at, published_at, created_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 500"
    ).all();
    const urls = (rows.results || [])
      .filter(function (r) { return /^[a-z0-9-]+$/.test(r.slug || ''); })
      .map(function (r) {
        var lastmod = String(r.updated_at || r.published_at || r.created_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
        return '  <url><loc>https://studio.gabochie.com/blog/' + r.slug + '/</loc><lastmod>' + lastmod + '</lastmod><priority>0.8</priority><changefreq>monthly</changefreq></url>';
      })
      .join('\n');
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>';
    return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } });
  } catch (_err) {
    return new Response('Internal error', { status: 500 });
  }
}
