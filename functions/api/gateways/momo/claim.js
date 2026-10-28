import { json, readBody } from '../_shared.js';
import { checkRateLimit } from '../../_rate-limit.js';

// Customer submits the MTN MoMo transaction ID after paying to the manual
// MoMo number. This only RECORDS the claim — no money state changes here.
// Settlement happens exclusively through the admin-confirmed
// POST /api/admin/momo-claims flow (anti-fraud: fake screenshots stay pending).
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'momo_claim', 5, 300)) {
    return json({ status: 'error', message: 'Too many requests. Try again later.' }, 429);
  }
  if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);

  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid JSON body' }, 400);
  }

  const tx_ref = String((body && body.tx_ref) || '').trim();
  const momoTxnId = String((body && body.momo_txn_id) || '').trim();
  const payerNumber = String((body && body.payer_number) || '').trim();
  if (!/^momom_|^(donate_|camp_|tier_|memb_|sub_|upgrade_|books_|bookpw_|store_|GUITAR_|guitar_|booking_)/.test(tx_ref)) {
    return json({ status: 'error', message: 'Invalid reference' }, 400);
  }
  // MTN MoMo transaction IDs are typically 8-16 digits; accept 6-24 alphanumerics
  // to tolerate format changes while blocking junk.
  if (!/^[A-Za-z0-9._-]{6,24}$/.test(momoTxnId)) {
    return json({ status: 'error', message: 'Enter the MoMo transaction ID from your payment confirmation SMS (e.g. 1234567890).' }, 400);
  }
  if (payerNumber && !/^[0-9+\s-]{9,15}$/.test(payerNumber)) {
    return json({ status: 'error', message: 'Enter a valid phone number or leave it blank.' }, 400);
  }

  try {
    // One live claim per reference; re-submitting updates the details.
    await env.DB.prepare(
      `INSERT INTO momo_manual_claims (tx_ref, momo_txn_id, payer_number, status) VALUES (?, ?, ?, 'submitted')
       ON CONFLICT(tx_ref) DO UPDATE SET
         momo_txn_id = excluded.momo_txn_id,
         payer_number = excluded.payer_number,
         status = 'submitted',
         submitted_at = datetime('now')`
    ).bind(tx_ref, momoTxnId, payerNumber).run();
  } catch (_e) {
    return json({ status: 'error', message: 'Could not record your payment. Please try again.' }, 500);
  }

  try {
    await env.DB.prepare(`INSERT INTO events (event_type, event_data, page) VALUES (?, ?, ?)`)
      .bind('momo_claim_submitted', 'tx:' + tx_ref, 'momo-manual').run();
  } catch (_e) {}

  return json({ status: 'ok', message: 'Payment received — we are confirming it now. You will get an email receipt once confirmed (usually within a few hours).' });
}
