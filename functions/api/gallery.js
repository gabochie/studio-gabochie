export async function onRequest(context) {
  var db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    var items = await db.prepare('SELECT id, title, description, image_url, category, sort_order FROM gallery WHERE active = 1 ORDER BY sort_order ASC, created_at DESC').all();
    return new Response(JSON.stringify({ status: 'ok', count: items.results.length, items: items.results }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
