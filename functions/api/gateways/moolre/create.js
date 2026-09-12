import { json, readBody } from '../_shared.js';
import { moolreBase, moolreHeaders, publicBase } from './_moolre.js';

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
  const currency = (body.currency || 'GHS').toUpperCase();
  if (!email || !email.includes('@')) return json({ status: 'error', message: 'A valid email is required' }, 400);

  const tx_ref = 'moolre_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const base = moolreBase(env);
  const headers = moolreHeaders(env);
  const site = publicBase(env);
  const callbackUrl = site + '/api/gateways/moolre/callback';
  const redirectUrl = site + '/donate.html?tx_ref=' + encodeURIComponent(tx_ref) +
    '&status=successful&amount=' + amount +
    '&name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email) + '&phone=' + encodeURIComponent(phone);

  let linkData;
  try {
    const resp = await fetch(base + '/embed/link', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 1,
        amount: String(amount),
        email: env.MOOLRE_BUSINESS_EMAIL || 'studio@gabochie.com',
        externalref: tx_ref,
        callback: callbackUrl,
        redirect: redirectUrl,
        reusable: '0',
        expiration_time: 1440,
        currency,
        accountnumber: env.MOOLRE_ACCOUNT_NUMBER || ''
      })
    });
    const data = await resp.json();
    if (data.status !== 1 || !data.data || !data.data.authorization_url) {
      return json({ status: 'error', message: (data && data.message) || 'Failed to create payment link' }, 502);
    }
    linkData = data.data;
  } catch (_e) {
    return json({ status: 'error', message: 'Payment gateway unavailable' }, 502);
  }

  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, provider, flw_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 'moolre', ?, datetime('now'))
         ON CONFLICT(tx_ref) DO UPDATE SET amount = excluded.amount, currency = excluded.currency, donor_name = excluded.donor_name, donor_email = excluded.donor_email, donor_phone = excluded.donor_phone, status = 'pending', provider = 'moolre', flw_id = excluded.flw_id`
      ).bind(tx_ref, amount, currency, name, email, phone, linkData.reference || '').run();
    } catch (_e) {}
  }

  return json({ status: 'ok', tx_ref, authorization_url: linkData.authorization_url, reference: linkData.reference });
}