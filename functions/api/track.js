export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const { page, referrer } = await request.json();
    const cf = request.cf || {};
    const ip = request.headers.get('CF-Connecting-IP') || '';
    if (env.DB) {
      await env.DB.prepare(
        'INSERT INTO page_views (page, referrer, country, city, ip) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        page || '/', referrer || '',
        cf.country || '', cf.city || '', ip
      ).run();
    }
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
