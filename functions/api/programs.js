export async function onRequest(context) {
  var { request, env } = context;
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    var programs = await db.prepare(
      'SELECT id, title, slug, tagline, description, duration, price, price_label, status, sort_order FROM programs ORDER BY sort_order ASC'
    ).all();
    return new Response(JSON.stringify({
      status: 'ok',
      programs: programs.results || []
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
