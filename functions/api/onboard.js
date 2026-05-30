export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  const validTags = [
    'newsletter', 'school', 'workshop', 'nationbuilding',
    'book_download', 'book_bundle', 'art', 'merch', 'music',
    'donation', 'patron', 'sponsor', 'partner', 'dashboard',
    'contact'
  ];
  try {
    const ct = request.headers.get('Content-Type') || '';
    let email = '', name = '', tag = '';
    if (ct.includes('application/json')) {
      const body = await request.json();
      email = body.email || '';
      name = body.name || '';
      tag = body.tag || '';
    } else {
      const fd = await request.formData();
      email = fd.get('email') || '';
      name = fd.get('name') || '';
      tag = fd.get('tag') || '';
    }
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!tag || !validTags.includes(tag)) {
      tag = 'other';
    }
    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'D1 not bound' }), {
        status: 501, headers: { 'Content-Type': 'application/json' }
      });
    }
    // Check if subscriber exists
    const existing = await env.DB.prepare(
      'SELECT id, onboarding_tag FROM subscribers WHERE email = ?'
    ).bind(email).first();
    if (existing) {
      // Only set tag if they don't already have one (preserve first touch)
      if (!existing.onboarding_tag) {
        await env.DB.prepare(
          'UPDATE subscribers SET onboarding_tag = ? WHERE email = ?'
        ).bind(tag, email).run();
      }
    } else {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO subscribers (name, email, source, onboarding_tag, subscribed_at, metadata) VALUES (?, ?, ?, ?, datetime(\'now\'), ?)'
      ).bind(name, email, tag, tag, JSON.stringify({ onboarded_at: new Date().toISOString() })).run();
    }
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
