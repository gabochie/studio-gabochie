import { json, readBody } from '../_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid JSON body' }, 400);
  }

  const amount = parseFloat(body.amount);
  if (!amount || amount <= 0) return json({ status: 'error', message: 'Invalid amount' }, 400);

  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim() || '';

  const tx_ref = 'manual_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const momoNumber = env.MOMO_NUMBER || '0243262019';

  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, provider, created_at)
         VALUES (?, ?, 'GHS', ?, ?, ?, 'pending', 'manual', datetime('now'))
         ON CONFLICT(tx_ref) DO UPDATE SET amount = excluded.amount, donor_name = excluded.donor_name, donor_email = excluded.donor_email, donor_phone = excluded.donor_phone, status = 'pending', provider = 'manual'`
      ).bind(tx_ref, amount, name, email, phone).run();
    } catch (_e) {}
  }

  return json({
    status: 'ok',
    tx_ref,
    momo_number: momoNumber,
    payout_display: momoNumber.slice(0, 4) + ' ' + momoNumber.slice(4, 7) + ' ' + momoNumber.slice(7),
    amount_ghs: amount,
    currency: 'GHS',
    note: 'Send this amount via Mobile Money (MoMo). We will confirm your gift manually within 24 hours.'
  });
}