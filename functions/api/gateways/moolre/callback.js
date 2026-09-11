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
    // Refresh status of any pending Moolre donations when Moolre pings us without a reference.
    const data = body.data || {};
    const ref = data.externalref || body.externalref || '';
    const txid = data.transactionid || (body.reference || '');

    let row = null;
    if (ref && env.DB) {
      row = await env.DB.prepare('SELECT * FROM donations WHERE tx_ref = ?').bind(ref).first();
    }
    if ((!row || !ref) && env.DB) {
      // Fall back to most recent pending moolre donation for this provider
      row = await env.DB.prepare(
        "SELECT * FROM donations WHERE provider = 'moolre' AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
      ).first();
    }
    if (row) {
      const v = await verifyMoolre(env, { externalref: ref || row.tx_ref, transactionid: txid });
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