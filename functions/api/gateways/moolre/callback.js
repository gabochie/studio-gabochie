import { json, readBody, finalizeDonation } from '../_shared.js';
import { verifyMoolre } from './_moolre.js';
import { settlePaidTx } from '../_settle.js';
import { resolvePendingTx } from '../expresspay/create.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    body = {};
  }
  if (!env.DB) return json({ status: 'ok' });

  const data = body.data || {};
  // Require the merchant reference: never credit the "most recent pending"
  // row, which misattributes concurrent donors' payments.
  const ref = String(data.externalref || body.externalref || '').trim();
  const txid = data.transactionid || (body.reference || '');
  if (!ref) return json({ error: 'Missing externalref' }, 400);

  const v = await verifyMoolre(env, { externalref: ref, transactionid: txid });
  if (!v.success) return json({ status: 'ok', pending: true });

  // Open donations stamp a `moolre_`/`ghipss_` ref (GhIPSS virtual accounts)
  // and settle against the staged row.
  if (ref.indexOf('moolre_') === 0 || ref.indexOf('ghipss_') === 0) {
    const row = await env.DB.prepare('SELECT * FROM donations WHERE tx_ref = ?').bind(ref).first();
    if (row) {
      await finalizeDonation(env, {
        tx_ref: row.tx_ref,
        amount: v.amount || row.amount,
        currency: row.currency,
        donor_name: row.donor_name,
        donor_email: row.donor_email,
        donor_phone: row.donor_phone,
        gateway: ref.indexOf('ghipss_') === 0 ? 'ghipss' : 'moolre',
        gateway_txid: v.transactionid || row.flw_id
      });
    }
    return json({ status: 'ok' });
  }

  // Otherwise resolve the payable (guitar, tiers, books, store, upgrades...)
  // server-side. Null means it is unknown or already settled, so there is
  // nothing left to credit.
  let found = null;
  try {
    found = await resolvePendingTx(env.DB, ref);
  } catch (_e) {
    return json({ status: 'error', message: 'Lookup failed' }, 500);
  }
  if (!found) return json({ status: 'ok', note: 'already settled or unknown' });

  const paidAmount = v.amount != null && v.amount !== '' ? parseFloat(v.amount) : found.amount;
  if (found.amount && Math.abs(paidAmount - found.amount) > 0.5) {
    return json({ status: 'error', message: 'Amount mismatch' }, 402);
  }

  await settlePaidTx(env, env.DB, {
    tx_ref: ref,
    amount: paidAmount || found.amount,
    currency: 'GHS',
    status: 'successful',
    event: 'charge.completed',
    name: found.name || '',
    email: found.email || '',
    phone: found.phone || '',
    gateway: 'moolre',
    gatewayTxId: v.transactionid || txid || ''
  });
  return json({ status: 'ok', settled: true });
}