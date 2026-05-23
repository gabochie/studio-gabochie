export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  const referer = request.headers.get('Referer') || '';
  if (!referer.includes('/admin/')) {
    return new Response(JSON.stringify({ status: 'error', message: 'Unauthorized' }), {
      status: 403, headers: { 'Content-Type': 'application/json' }
    });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  try {
    if (request.method === 'GET') {
      if (id) {
        const row = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();
        return new Response(JSON.stringify(row || null), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const search = url.searchParams.get('q') || '';
      let rows;
      if (search) {
        rows = await env.DB.prepare(
          "SELECT * FROM bookings WHERE name LIKE ? OR email LIKE ? OR company LIKE ? ORDER BY created_at DESC"
        ).bind('%' + search + '%', '%' + search + '%', '%' + search + '%').all();
      } else {
        rows = await env.DB.prepare("SELECT * FROM bookings ORDER BY created_at DESC").all();
      }
      return new Response(JSON.stringify({ status: 'ok', count: rows.results.length, items: rows.results }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (request.method === 'PATCH' && id) {
      const body = await request.json();
      const { status: newStatus } = body;
      if (newStatus) {
        await env.DB.prepare('UPDATE bookings SET status = ? WHERE id = ?').bind(newStatus, id).run();
      }
      return new Response(JSON.stringify({ status: 'ok', updated: id }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
