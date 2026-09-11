export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare(
        "SELECT * FROM books ORDER BY sort_order ASC"
      ).all();
      const items = results.map(function(b) {
        return { id: b.id, title: b.title, slug: b.slug, description: b.description, price: b.price, cover_url: b.cover_url, is_premium: b.is_premium, sort_order: b.sort_order };
      });
      return new Response(JSON.stringify({ status: 'ok', items: items }), {
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
