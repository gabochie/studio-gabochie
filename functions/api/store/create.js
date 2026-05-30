export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const body = await request.json();
    const { item_type, item_name, item_variant, amount, customer_name, customer_email } = body;
    if (!item_type || !item_name || !amount || !customer_email) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const tx_ref = 'store_' + item_type + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const currency = body.currency || 'GHS';
    await db.prepare(
      `INSERT INTO store_orders (tx_ref, item_type, item_name, item_variant, amount, currency, customer_name, customer_email, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(tx_ref, item_type, item_name, item_variant || '', amount, currency, customer_name, customer_email).run();
    return new Response(JSON.stringify({ status: 'ok', tx_ref, amount, currency }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
