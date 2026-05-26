export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const ct = request.headers.get('Content-Type') || '';
    let event_type = '', event_data = '', page = '', email = '';
    if (ct.includes('application/json')) {
      const raw = await request.text();
      let body;
      try { body = JSON.parse(raw); } catch (e) {
        return new Response(JSON.stringify({ status:'error', raw:'received:' + (raw || '').length + 'bytes:' + (raw || '').substring(0,200), parse_error:e.message }), { status:400, headers:{'Content-Type':'application/json'} });
      }
      event_type = body.event_type || '';
      event_data = typeof body.event_data === 'object' ? JSON.stringify(body.event_data) : String(body.event_data || '');
      page = body.page || '';
      email = body.email || '';
    } else {
      const fd = await request.formData();
      event_type = fd.get('event_type') || '';
      event_data = fd.get('event_data') || '';
      page = fd.get('page') || '';
      email = fd.get('email') || '';
    }
    if (!event_type) {
      return new Response(JSON.stringify({ error: 'event_type required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    await env.DB.prepare(
      'INSERT INTO events (event_type, event_data, page, email, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).bind(event_type, event_data, page, email).run();
    return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
