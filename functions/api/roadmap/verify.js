export async function onRequest(context) {
  var db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  var { request } = context;
  var url = new URL(request.url);

  if (request.method === 'GET') {
    try {
      var rows = await db.prepare('SELECT phase, verified_at, verified_by FROM phase_verifications ORDER BY phase').all();
      return new Response(JSON.stringify({ status: 'ok', phases: rows.results || [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ status: 'error', message: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  if (request.method === 'PUT') {
    try {
      var body = await request.json();
      var phase = parseInt(body.phase);
      if (!phase) {
        return new Response(JSON.stringify({ status: 'error', message: 'Missing phase' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      await db.prepare('INSERT OR IGNORE INTO phase_verifications (phase, verified_by) VALUES (?, ?)')
        .bind(phase, body.verified_by || 'admin').run();
      return new Response(JSON.stringify({ status: 'ok', phase: phase, verified: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ status: 'error', message: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { 'Content-Type': 'application/json' }
  });
}
