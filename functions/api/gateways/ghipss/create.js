import { json, readBody } from '../_shared.js';
import { moolreBase, moolreHeaders } from '../moolre/_moolre.js';
import { checkRateLimit } from '../../_rate-limit.js';
import { resolvePendingTx } from '../expresspay/create.js';

// GhIPSS Instant Pay rail: a per-transaction virtual bank account created via
// Moolre's Bank Collections API (type 9). The donor transfers from any Ghana
// bank app; interbank transfers clear through GhIPSS in seconds and land in
// the Moolre wallet. Confirmation reuses the Moolre callback/webhook — the
// virtual account carries our tx_ref as its externalref, so settlement flows
// through the same verified path as Moolre collections.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'ghipss_create', 5, 60)) {
    return json({ status: 'error', message: 'Too many requests. Try again later.' }, 429);
  }
  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid JSON body' }, 400);
  }

  // Two modes, mirroring the Moolre rail:
  //  - tx_ref supplied (guitar, tiers, books, store, upgrades...): the amount
  //    is resolved server-side from the pending row and never trusted from the
  //    client. No donation row is staged.
  //  - no tx_ref (open donation): a ghipss_ ref is generated and a pending
  //    donation row is staged; settlement uses the Moolre-verified amount.
  const clientRef = String((body && body.tx_ref) || '').trim();
  let tx_ref, amount, name, email, phone, stageDonation;
  if (clientRef) {
    if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);
    let found = null;
    try {
      found = await resolvePendingTx(env.DB, clientRef);
    } catch (_e) {
      return json({ status: 'error', message: 'Lookup failed' }, 500);
    }
    if (!found) return json({ status: 'error', message: 'Unknown or already-settled transaction' }, 404);
    tx_ref = clientRef;
    amount = found.amount;
    name = String((body && body.name) || found.name || '').trim();
    email = String((body && body.email) || found.email || '').trim();
    phone = String((body && body.phone) || found.phone || '').trim();
    stageDonation = false;
  } else {
    amount = parseFloat(body && body.amount);
    if (!amount || amount <= 0) return json({ status: 'error', message: 'Invalid amount' }, 400);
    name = String((body && body.name) || '').trim();
    email = String((body && body.email) || '').trim();
    phone = String((body && body.phone) || '').trim();
    tx_ref = 'ghipss_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    stageDonation = true;
  }
  if (!email || !email.includes('@')) return json({ status: 'error', message: 'A valid email is required' }, 400);
  // Moolre's Bank Collections API requires a phone number for the account holder.
  if (!phone) return json({ status: 'error', message: 'A phone number is required for bank transfer' }, 400);

  const parts = (name || 'Valued Customer').split(/\s+/).filter(Boolean);
  let acct;
  try {
    const resp = await fetch(moolreBase(env) + '/open/account/create', {
      method: 'POST',
      headers: moolreHeaders(env),
      body: JSON.stringify({
        type: 9,
        currency: 'GHS',
        amount: amount,
        firstname: parts[0] || 'Valued',
        lastname: parts.slice(1).join(' ') || 'Customer',
        phone: phone,
        email: email,
        externalref: tx_ref,
        accountnumber: env.MOOLRE_ACCOUNT_NUMBER || ''
      })
    });
    const data = await resp.json();
    if (data.status !== 1 || !data.data || !data.data.accountno) {
      return json({ status: 'error', message: (data && data.message) || 'Failed to create bank account' }, 502);
    }
    acct = data.data;
  } catch (_e) {
    return json({ status: 'error', message: 'Payment gateway unavailable' }, 502);
  }

  if (stageDonation) {
    try {
      await env.DB.prepare(
        `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, provider, flw_id, created_at)
         VALUES (?, ?, 'GHS', ?, ?, ?, 'pending', 'ghipss', ?, datetime('now'))
         ON CONFLICT(tx_ref) DO UPDATE SET amount = excluded.amount, currency = excluded.currency, donor_name = excluded.donor_name, donor_email = excluded.donor_email, donor_phone = excluded.donor_phone, status = 'pending', provider = 'ghipss', flw_id = excluded.flw_id`
      ).bind(tx_ref, amount, name, email, phone, acct.accountno || '').run();
    } catch (_e) {}
  }

  return json({ status: 'ok', tx_ref, bank_name: acct.bankname || 'Bank transfer', accountno: acct.accountno, accountname: acct.accountname, amount: amount });
}
