export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.SUBSCRIBERS;

  // GET — admin subscriber listing (protected by referer check)
  if (request.method === 'GET') {
    if (!kv) {
      return new Response(JSON.stringify({ status: 'error', message: 'KV not bound' }), {
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
      const list = await kv.list({ prefix: 'subscriber:' });
      const items = [];
      for (const key of list.keys) {
        const val = await kv.get(key.name);
        if (val) items.push(JSON.parse(val));
      }
      items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return new Response(JSON.stringify({ status: 'ok', count: items.length, items }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ status: 'error', message: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST — form submission
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'GET, POST' }
    });
  }
  try {
    const formData = await request.formData();
    const name = formData.get('name') || '';
    const email = formData.get('email') || '';
    const book = formData.get('book') || formData.get('_subject') || '';
    const spam = formData.get('_gotcha');
    if (spam) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    const payload = { name, email, book, timestamp: new Date().toISOString(), source: book };

    // Store in KV if bound
    if (kv && email) {
      await kv.put('subscriber:' + email, JSON.stringify(payload));
    }

    // Forward to Formspree as email fallback
    const fp = new FormData();
    fp.append('name', name);
    fp.append('email', email);
    fp.append('_subject', book || 'New contact form submission');
    fp.append('_next', formData.get('_next') || 'https://gideonabochie.org');
    await fetch('https://formspree.io/f/xgoplkoe', {
      method: 'POST', body: fp, headers: { 'Accept': 'application/json' }
    }).catch(function(){});

    return new Response(JSON.stringify({ status: 'ok', data: payload }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
