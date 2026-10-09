import { json, readBody, finalizeDonation } from '../_shared.js';
import { verifyMoolre } from './_moolre.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    body = {};
  }

  if (env.DB) {
    const data = body.data || {};
    const ref = data.externalref || body.externalref || '';
    const txid = data.transactionid || (body.reference || '');

    // Require the merchant reference: never credit the "most recent pending"
    // row, which misattributes concurrent donors' payments.
    if (!ref) return json({ error: 'Missing externalref' }, 400);
    const row = await env.DB.prepare('SELECT * FROM donations WHERE tx_ref = ?').bind(ref).first();
    if (row) {
      const v = await verifyMoolre(env, { externalref: row.tx_ref, transactionid: txid });
      if (v.success) {
        await finalizeDonation(env, {
          tx_ref: row.tx_ref,
          amount: v.amount || row.amount,
          currency: row.currency,
          donor_name: row.donor_name,
          donor_email: row.donor_email,
          donor_phone: row.donor_phone,
          gateway: 'moolre',
          gateway_txid: v.transactionid || row.flw_id
        });
      }
    }
  }

  return json({ status: 'ok' });
}