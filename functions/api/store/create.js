import { checkRateLimit } from '../_rate-limit.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const allowed = await checkRateLimit(db, ip, 'store_create', 10, 60);
  if (!allowed) {
    return new Response(JSON.stringify({ status: 'error', message: 'Too many requests' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const body = await request.json();
    const { item_type, item_name, item_variant, amount, customer_name, customer_email, user_id, phone, shipping_city, shipping_region, shipping_digital_address, delivery_fee } = body;
    if (!item_type || !item_name || !amount || !customer_email) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const tx_ref = 'store_' + item_type + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const currency = body.currency || 'GHS';
    const uid = parseInt(user_id) || 0;
    const df = parseFloat(delivery_fee) || 0;
    const shipAddr = body.shipping_address || '';
    await db.prepare(
      `INSERT INTO store_orders (tx_ref, item_type, item_name, item_variant, amount, currency, customer_name, customer_email, user_id, status, customer_phone, shipping_address, shipping_city, shipping_region, shipping_digital_address, delivery_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
    ).bind(tx_ref, item_type, item_name, item_variant || '', amount, currency, customer_name, customer_email, uid, phone || '', shipAddr, shipping_city || '', shipping_region || '', shipping_digital_address || '', df).run();
    return new Response(JSON.stringify({ status: 'ok', tx_ref, amount: parseFloat(amount) + df, currency }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
