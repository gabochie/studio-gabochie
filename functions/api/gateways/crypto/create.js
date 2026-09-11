import { json, readBody, newRef, ghsToUsd } from '../_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid JSON body' }, 400);
  }

  const amountGhs = parseFloat(body.amount);
  if (!amountGhs || amountGhs <= 0) return json({ status: 'error', message: 'Invalid amount' }, 400);

  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim() || '';
  if (!email || !email.includes('@')) return json({ status: 'error', message: 'A valid email is required' }, 400);

  const tx_ref = 'crypto_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const { usd, rate } = await ghsToUsd(amountGhs, env);

  // Mandate for backwards compat even when env.DB missing
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, provider, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 'crypto', datetime('now'))
         ON CONFLICT(tx_ref) DO UPDATE SET amount = excluded.amount, donor_name = excluded.donor_name, donor_email = excluded.donor_email, donor_phone = excluded.donor_phone, status = 'pending', provider = 'crypto'`
      ).bind(tx_ref, amountGhs, 'GHS', name, email, phone).run();
    } catch (_e) {}
  }

  // When NOWPayments is configured, delegate checkout to a hosted invoice.
  if (env.NOWPAYMENTS_API_KEY) {
    try {
      const site = env.PUBLIC_BASE_URL || 'https://studio.gabochie.com';
      const resp = await fetch('https://api.nowpayments.io/v1/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.NOWPAYMENTS_API_KEY },
        body: JSON.stringify({
          price_amount: usd,
          price_currency: 'usd',
          order_id: tx_ref,
          order_description: 'Donation to Studio Gabochie',
          ipn_callback_url: site + '/api/gateways/crypto/webhook',
          success_url: site + '/donate.html?tx_ref=' + encodeURIComponent(tx_ref) + '&status=successful&amount=' + amountGhs + '&name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email) + '&phone=' + encodeURIComponent(phone),
          cancel_url: site + '/donate/',
          is_fixed_rate: true
        })
      });
      const inv = await resp.json();
      if (inv.invoice_url) {
        return json({ status: 'ok', mode: 'invoice', tx_ref, invoice_url: inv.invoice_url, amount_usd: usd, rate });
      }
    } catch (_e) {}
  }

  // Manual fallback: return on-chain addresses for the donor to pay directly.
  const addresses = {
    btc: env.CRYPTO_BTC_ADDRESS || '',
    usdt_trc20: env.CRYPTO_USDT_ADDRESS || ''
  };
  return json({
    status: 'ok',
    mode: 'manual',
    tx_ref,
    amount_ghs: amountGhs,
    amount_usd: usd,
    rate,
    addresses,
    memo: tx_ref
  });
}