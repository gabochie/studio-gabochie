import { json } from '../_shared.js';
import { expresspayQuery } from './_expresspay.js';
import { settlePaidTx } from '../_settle.js';
import { resolvePendingTx } from './create.js';

// POST /api/gateways/expresspay/callback
// ExpressPay post-url: invoked when a pending (usually MoMo) payment completes.
// Payload shape is not strictly documented, so accept form-encoded or JSON
// with any of: order-id / order_id / orderId (= our tx_ref), token,
// transaction-id. We always re-query ExpressPay before settling, and always
// answer 200 quickly (except genuine misuse) so ExpressPay stops retrying.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let params = {};
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.indexOf('application/json') >= 0) {
      params = await request.json();
    } else {
      const text = await request.text();
      params = Object.fromEntries(new URLSearchParams(text));
    }
  } catch (_e) {
    params = {};
  }
  const orderId = params['order-id'] || params.order_id || params.orderId || params.orderID || '';
  let token = params.token || '';
  const tx_ref = String(orderId || '').trim();
  if (!tx_ref && !token) return json({ status: 'ok' });
  if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);

  if (!token) {
    try {
      const row = await env.DB.prepare('SELECT token FROM expresspay_tokens WHERE tx_ref = ?').bind(tx_ref).first();
      if (row && row.token) token = row.token;
    } catch (_e) {}
  }
  if (!token) return json({ status: 'ok' });

  const q = await expresspayQuery(env, token);
  if (!q.approved) return json({ status: 'ok', pending: !!q.pending });

  let expected = null;
  let contact = { name: '', email: '', phone: '' };
  try {
    const f = await resolvePendingTx(env.DB, tx_ref || q.orderId);
    if (!f) return json({ status: 'ok', note: 'already settled or unknown' });
    expected = f.amount;
    contact = f;
  } catch (_e) {
    return json({ status: 'error', message: 'Lookup failed' }, 500);
  }
  if (expected != null && Math.abs(q.amount - expected) > 0.01) {
    return json({ status: 'error', message: 'Amount mismatch' }, 402);
  }
  await settlePaidTx(env, env.DB, {
    tx_ref: tx_ref || q.orderId,
    amount: q.amount,
    currency: q.currency || 'GHS',
    status: 'successful',
    event: 'charge.completed',
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    gateway: 'expresspay',
    gatewayTxId: q.transactionId
  });
  return json({ status: 'ok', settled: true });
}
