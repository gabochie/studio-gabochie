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
  try {
    if (request.method === 'GET') {
      const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'coming_soon'").first();
      return new Response(JSON.stringify({ status: 'ok', active: row?.value === 'true' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (request.method === 'POST') {
      const body = await request.json();
      const active = body.active === true;
      await env.DB.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = 'coming_soon'")
        .bind(active ? 'true' : 'false').run();
      return new Response(JSON.stringify({ status: 'ok', active }), {
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
