import { json, finalizeDonation } from '../_shared.js';

async function sha512Hex(secret, text) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return Array.from(new Uint8Array(sig)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const raw = await request.text();
  const sigHeader = (request.headers.get('x-nowpayments-sig') || '').toLowerCase();

  // Verify IPN signature when secret is configured (skip check in tests when absent).
  if (env.NOWPAYMENTS_IPN_SECRET) {
    const expected = await sha512Hex(env.NOWPAYMENTS_IPN_SECRET, raw);
    if (!sigHeader || sigHeader !== expected) {
      return json({ status: 'error', message: 'Invalid signature' }, 401);
    }
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid body' }, 400);
  }

  const tx_ref = payload && (payload.order_id || payload.orderId || '');
  if (!tx_ref) return json({ status: 'ok' });

  const status = (payload.payment_status || '').toLowerCase();
  const settled = ['confirmed', 'finished'].indexOf(status) >= 0;
  if (!settled) return json({ status: 'ok' });

  if (env.DB) {
    const row = await env.DB.prepare('SELECT * FROM donations WHERE tx_ref = ?').bind(tx_ref).first().catch(() => null);
    if (row && row.status !== 'successful') {
      await finalizeDonation(env, {
        tx_ref,
        amount: row.amount,
        currency: row.currency,
        donor_name: row.donor_name,
        donor_email: row.donor_email,
        donor_phone: row.donor_phone,
        gateway: 'crypto',
        gateway_txid: String(payload.payment_id || '')
      });
    }
  }

  return json({ status: 'ok' });
}