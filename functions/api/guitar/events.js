export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  try {
    const body = await request.json();
    const { event_type, metadata } = body;
    if (!event_type) {
      return new Response(JSON.stringify({ status: 'error', message: 'event_type required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const validTypes = ['registration_complete','buy_click','start_free','paywall_view','lesson_complete'];
    if (!validTypes.includes(event_type)) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid event_type' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    let userId = null;
    const auth = request.headers.get('Authorization') || '';
    if (auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      try {
        const session = await db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime("now")').first(token);
        if (session) userId = session.user_id;
      } catch(_) {}
    }

    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || '';
    const ua = request.headers.get('User-Agent') || '';
    const pageUrl = request.headers.get('Referer') || '';
    const source = request.headers.get('X-Source') || '';

    await db.prepare(
      `INSERT INTO guitar_conversion_events (user_id, event_type, page_url, source, metadata, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, event_type, pageUrl, source, JSON.stringify(metadata || {}), ip, ua).run();

    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
