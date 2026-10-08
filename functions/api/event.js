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
    var parsedJson = null;
    if (ct.includes('application/json')) {
      const raw = await request.text();
      try { parsedJson = JSON.parse(raw); } catch (_e) {
        return new Response(JSON.stringify({ status:'error', message:'Invalid JSON body' }), { status:400, headers:{'Content-Type':'application/json'} });
      }
    } else {
      // sendBeacon posts text/plain: accept a JSON body regardless of content-type
      var formCopy = request.clone();
      try {
        const rawText = await request.text();
        if (rawText.trim().startsWith('{')) parsedJson = JSON.parse(rawText);
      } catch (_e) {}
      if (!parsedJson) {
        const fd = await formCopy.formData();
        event_type = fd.get('event_type') || '';
        event_data = fd.get('event_data') || '';
        page = fd.get('page') || '';
        email = fd.get('email') || '';
      }
    }
    if (parsedJson) {
      event_type = parsedJson.event_type || '';
      event_data = typeof parsedJson.event_data === 'object' ? JSON.stringify(parsedJson.event_data) : String(parsedJson.event_data || '');
      page = parsedJson.page || '';
      email = parsedJson.email || '';
    }
    if (!event_type) {
      return new Response(JSON.stringify({ error: 'event_type required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    await env.DB.prepare(
      'INSERT INTO events (event_type, event_data, page, email, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).bind(event_type, event_data, page, email).run();
    return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json' } });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
