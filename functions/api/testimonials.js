export async function onRequest(context) {
  var db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    var items = await db.prepare('SELECT id, author, role, content, rating, created_at FROM testimonials WHERE active = 1 ORDER BY created_at DESC').all();
    return new Response(JSON.stringify({ status: 'ok', count: items.results.length, items: items.results }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
