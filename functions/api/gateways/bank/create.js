import { json, readBody } from '../_shared.js';
import { checkRateLimit } from '../../_rate-limit.js';

// POST /api/gateways/bank/create
// Stages a pending bank-transfer donation and returns the account details.
// Body: { amount, name, email, phone? }
// Settlement is manual: admin confirms in admin/donations.html, which fires
// the receipt via finalizeDonation.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'bank_create', 5, 60)) {
    return json({ status: 'error', message: 'Too many requests. Try again later.' }, 429);
  }
  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid JSON body' }, 400);
  }

  const amount = parseFloat(body.amount);
  if (!amount || amount <= 0 || amount > 1000000) return json({ status: 'error', message: 'Invalid amount' }, 400);

  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 120);
  const phone = String(body.phone || '').trim().slice(0, 20) || '';
  if (!email || email.indexOf('@') < 0) return json({ status: 'error', message: 'A valid email is required' }, 400);

  const tx_ref = 'bank_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, provider, created_at)
         VALUES (?, ?, 'GHS', ?, ?, ?, 'pending', 'bank', datetime('now'))
         ON CONFLICT(tx_ref) DO UPDATE SET amount = excluded.amount, donor_name = excluded.donor_name, donor_email = excluded.donor_email, donor_phone = excluded.donor_phone, status = 'pending', provider = 'bank'`
      ).bind(tx_ref, amount, name, email, phone).run();
    } catch (_e) {}
  }

  const configured = !!(env.BANK_NAME && env.BANK_ACCOUNT_NUMBER);
  return json({
    status: 'ok',
    tx_ref,
    configured,
    bank_name: env.BANK_NAME || '',
    account_name: env.BANK_ACCOUNT_NAME || 'Studio Gabochie',
    account_number: env.BANK_ACCOUNT_NUMBER || '',
    bank_branch: env.BANK_BRANCH || '',
    amount_ghs: amount,
    currency: 'GHS',
    note: 'Transfer this amount to the account above using the reference. We confirm bank gifts manually within 48 hours and email your receipt.'
  });
}
