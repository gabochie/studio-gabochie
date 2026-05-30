export async function onRequest(context) {
  const { request, env } = context;
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
    // Store in D1
    const tx_ref = formData.get('tx_ref') || '';
    const amount = parseFloat(formData.get('amount')) || 0;
    const db = env.DB;
    if (db && email) {
      await db.prepare(
        `INSERT INTO bookings (name, email, company, ad_type, message, status, payment_tx_ref, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(name, email, company, slot, message, tx_ref ? 'paid' : 'pending', tx_ref, amount).run();
    }

    // Forward to Formspree as email fallback
    const fp = new FormData();
    fp.append('name', name);
    fp.append('email', email);
    fp.append('_subject', 'Ad booking inquiry: ' + slot);
    fp.append('_next', 'https://gideonabochie.org/newsletter/advertise.html');
    await fetch('https://formspree.io/f/xgoplkoe', {
      method: 'POST', body: fp, headers: { 'Accept': 'application/json' }
    }).catch(function(){});

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
