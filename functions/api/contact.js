export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'POST' }
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
    const payload = { name, email, book, timestamp: new Date().toISOString() };
    const fp = new FormData();
    fp.append('name', name);
    fp.append('email', email);
    fp.append('_subject', book || 'New contact form submission');
    fp.append('_next', formData.get('_next') || 'https://gideonabochie.org');
    await fetch('https://formspree.io/f/xgoplkoe', {
      method: 'POST', body: fp, headers: { 'Accept': 'application/json' }
    });
    return new Response(JSON.stringify({ status: 'ok', data: payload }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
