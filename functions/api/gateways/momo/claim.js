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
  const rail = (body && body.rail) === 'bank' ? 'bank' : 'momo';
  if (!/^(momom_|bankm_)|^(donate_|camp_|tier_|memb_|sub_|upgrade_|books_|bookpw_|store_|GUITAR_|guitar_|booking_)/.test(tx_ref)) {
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
    var existing = await env.DB.prepare('SELECT status FROM momo_manual_claims WHERE tx_ref = ?').bind(tx_ref).first();
    if (existing && existing.status && existing.status !== 'submitted') {
      return json({ status: 'error', message: 'This payment reference has already been ' + existing.status + '.' }, 409);
    }
    if (existing) {
      // Guard the state transition in SQL too: a concurrent admin decision
      // must never be overwritten by a late customer re-submission.
      var updated = await env.DB.prepare(
        `UPDATE momo_manual_claims SET momo_txn_id = ?, payer_number = ?, rail = ?, submitted_at = datetime('now')
         WHERE tx_ref = ? AND status = ?`
      ).bind(momoTxnId, payerNumber, rail, tx_ref, 'submitted').run();
      if (!updated || !updated.meta || !updated.meta.changes) {
        return json({ status: 'error', message: 'This claim has already been decided.' }, 409);
      }
    } else {
      await env.DB.prepare(
        `INSERT INTO momo_manual_claims (tx_ref, momo_txn_id, payer_number, rail, status) VALUES (?, ?, ?, ?, 'submitted')`
      ).bind(tx_ref, momoTxnId, payerNumber, rail).run();
    }
  } catch (_e) {
    return json({ status: 'error', message: 'Could not record your payment. Please try again.' }, 500);
  }

  try {
    await env.DB.prepare(`INSERT INTO events (event_type, event_data, page) VALUES (?, ?, ?)`)
      .bind('momo_claim_submitted', 'tx:' + tx_ref, 'momo-manual').run();
  } catch (_e) {}

  return json({ status: 'ok', message: 'Payment received — we are confirming it now. You will get an email receipt once confirmed (usually within a few hours).' });
}
