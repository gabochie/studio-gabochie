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
    const phone = formData.get('phone') || '';
    const company = formData.get('company') || '';
    const slot = formData.get('slot') || '';
    const message = formData.get('message') || '';
    const spam = formData.get('_gotcha');
    if (spam) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    const payload = { name, email, phone, company, slot, message, timestamp: new Date().toISOString() };
    const fp = new FormData();
    fp.append('name', name);
    fp.append('email', email);
    fp.append('_subject', 'Ad booking inquiry: ' + slot);
    fp.append('_next', 'https://gideonabochie.org/newsletter/advertise.html');
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
