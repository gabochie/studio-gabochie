import { json, readBody } from '../_shared.js';
import { moolreBase, moolreHeaders, publicBase } from './_moolre.js';
import { checkRateLimit } from '../../_rate-limit.js';
import { resolvePendingTx } from '../expresspay/create.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'moolre_create', 5, 60)) {
    return json({ status: 'error', message: 'Too many requests. Try again later.' }, 429);
  }
  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid JSON body' }, 400);
  }

  // Two modes:
  //  - tx_ref supplied (guitar, tiers, books, store, upgrades...): the amount
  //    is resolved server-side from the pending row and never trusted from the
  //    client. No donation row is staged.
  //  - no tx_ref (open donation): a moolre_ ref is generated and a pending
  //    donation row is staged; settlement uses the Moolre-verified amount.
  const clientRef = String((body && body.tx_ref) || '').trim();
  let tx_ref, amount, name, email, phone, currency, stageDonation;
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
    currency = String((body && body.currency) || 'GHS').toUpperCase();
    stageDonation = false;
  } else {
    amount = parseFloat(body && body.amount);
    if (!amount || amount <= 0) return json({ status: 'error', message: 'Invalid amount' }, 400);
    name = String((body && body.name) || '').trim();
    email = String((body && body.email) || '').trim();
    phone = String((body && body.phone) || '').trim();
    currency = String((body && body.currency) || 'GHS').toUpperCase();
    tx_ref = 'moolre_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    stageDonation = true;
  }
  if (!email || !email.includes('@')) return json({ status: 'error', message: 'A valid email is required' }, 400);

  const base = moolreBase(env);
  const headers = moolreHeaders(env);
  const site = publicBase(env);
  const callbackUrl = site + '/api/gateways/moolre/callback';
  // Callers may return the donor to their own same-origin page (e.g. the church
  // Give page). Rejected unless it is a single-slash root-relative path.
  var redirectPath = (body.redirect && body.redirect.charAt(0) === '/' && body.redirect.charAt(1) !== '/') ? body.redirect : '/donate.html';
  const redirectUrl = site + redirectPath + (redirectPath.indexOf('?') >= 0 ? '&' : '?') + 'tx_ref=' + encodeURIComponent(tx_ref) +
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
      /* HTTP 200 + status:'error' — Cloudflare masks 5xx bodies, hiding this JSON
         from the client (see the expresspay/create note from the 2026-10-27 audit). */
      return json({ status: 'error', message: (data && data.message) || 'Mobile money is briefly unavailable — please pay with crypto or try again in a few minutes.', code: data && data.code });
    }
    linkData = data.data;
  } catch (_e) {
    return json({ status: 'error', message: 'Mobile money is briefly unavailable — please pay with crypto or try again in a few minutes.', code: 'moolre_unreachable' });
  }

  if (stageDonation) {
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