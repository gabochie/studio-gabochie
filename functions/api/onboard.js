function sanitize(val, maxLen) {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/<[^>]*>/g, '').slice(0, maxLen || 255);
}

const VALID_TAGS = [
  'newsletter', 'school', 'nationbuilding',
  'book_download', 'book_bundle',
  'donation', 'patron', 'sponsor', 'partner', 'dashboard',
  'contact'
];

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const ct = request.headers.get('Content-Type') || '';
    let email = '', name = '', tag = '';
    if (ct.includes('application/json')) {
      const body = await request.json();
      email = sanitize(body.email, 320);
      name = sanitize(body.name, 255);
      tag = sanitize(body.tag, 50);
    } else {
      const fd = await request.formData();
      email = sanitize(fd.get('email'), 320);
      name = sanitize(fd.get('name'), 255);
      tag = sanitize(fd.get('tag'), 50);
    }
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!tag || !VALID_TAGS.includes(tag)) {
      tag = 'other';
    }
    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'D1 not bound' }), {
        status: 501, headers: { 'Content-Type': 'application/json' }
      });
    }
    const existing = await env.DB.prepare(
      'SELECT id, onboarding_tag FROM subscribers WHERE email = ?'
    ).bind(email).first();
    if (existing) {
      if (!existing.onboarding_tag) {
        await env.DB.prepare(
          'UPDATE subscribers SET onboarding_tag = ?, name = COALESCE(NULLIF(?, \'\'), name) WHERE email = ?'
        ).bind(tag, name, email).run();
      }
    } else {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO subscribers (name, email, source, onboarding_tag, subscribed_at, metadata) VALUES (?, ?, ?, ?, datetime(\'now\'), ?)'
      ).bind(name, email, tag, tag, JSON.stringify({ onboarded_at: new Date().toISOString() })).run();
    }
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
