import { json, readBody, ghsToUsd, newRef } from '../_shared.js';
import { getSessionUser } from '../../enroll/_token.js';

var PURPOSES = ['donation', 'course', 'books', 'tier', 'merch'];

var SUCCESS_URLS = {
  donation: function (site, p) { return site + '/donate.html?tx_ref=' + encodeURIComponent(p.tx_ref) + '&status=successful&amount=' + p.amount + '&name=' + encodeURIComponent(p.name) + '&email=' + encodeURIComponent(p.email) + '&phone=' + encodeURIComponent(p.phone); },
  course: function (site, p) { return site + '/dashboard/' + (p.access_token ? '?token=' + encodeURIComponent(p.access_token) : ''); },
  books: function (site, p) { return site + '/books/download?tx_ref=' + encodeURIComponent(p.domain_tx) + '&email=' + encodeURIComponent(p.email) + '&name=' + encodeURIComponent(p.name); },
  tier: function (site, p) { return site + '/member/?success=' + encodeURIComponent(p.tier || 'supporter'); },
  merch: function (site, p) { return site + '/merch/?order=' + encodeURIComponent(p.domain_tx) + '&status=successful'; }
};

var CANCEL_URLS = {
  donation: '/donate/', course: '/dashboard/', books: '/books/', tier: '/member/', merch: '/merch/'
};

var DESCRIPTIONS = {
  donation: 'Donation to Studio Gabochie',
  course: 'Course Full Access — Studio Gabochie',
  books: 'Book Purchase — Studio Gabochie',
  tier: 'Membership Tier — Studio Gabochie',
  merch: 'Store Purchase — Studio Gabochie'
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid JSON body' }, 400);
  }

  const purpose = PURPOSES.indexOf(body.purpose) >= 0 ? body.purpose : 'donation';
  const site = env.PUBLIC_BASE_URL || 'https://studio.gabochie.com';

  // Resolve amount + identity from server-side records. Never trust client amounts
  // for non-donation purposes.
  let amountGhs = 0;
  let name = (body.name || '').trim();
  let email = (body.email || '').trim();
  let phone = (body.phone || '').trim() || '';
  let meta = { purpose: purpose };
  let access_token = '';
  let domain_tx = '';
  let tier = '';

  if (purpose === 'donation') {
    amountGhs = parseFloat(body.amount);
    if (!amountGhs || amountGhs <= 0) return json({ status: 'error', message: 'Invalid amount' }, 400);
    if (!email || !email.includes('@')) return json({ status: 'error', message: 'A valid email is required' }, 400);
  } else if (purpose === 'course') {
    if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);
    const enrollment_token = (body.enrollment_token || '').trim();
    if (!enrollment_token) return json({ status: 'error', message: 'enrollment_token required' }, 400);
    let enr = await env.DB.prepare(
      'SELECT id, program_id, student_name, student_email, status, access_token FROM enrollments WHERE access_token = ?'
    ).bind(enrollment_token).first().catch(() => null);
    if (!enr) {
      // Fall back to session token → latest enrollment (dashboard passes either token type).
      try {
        const sess = await getSessionUser(env.DB, enrollment_token);
        if (sess) {
          enr = await env.DB.prepare(
            'SELECT id, program_id, student_name, student_email, status, access_token FROM enrollments WHERE user_id = ? ORDER BY enrolled_at DESC LIMIT 1'
          ).bind(sess.user_id).first().catch(() => null);
          if (!enr) {
            enr = await env.DB.prepare(
              'SELECT id, program_id, student_name, student_email, status, access_token FROM enrollments WHERE student_email = ? ORDER BY enrolled_at DESC LIMIT 1'
            ).bind(sess.email).first().catch(() => null);
          }
        }
      } catch (_e) {}
    }
    if (!enr) return json({ status: 'error', message: 'Unknown enrollment' }, 404);
    if (enr.status === 'active') return json({ status: 'ok', already: true, message: 'Already upgraded' });
    const prog = await env.DB.prepare(
      'SELECT price, title FROM programs WHERE id = ?'
    ).bind(enr.program_id).first().catch(() => null);
    amountGhs = Number((prog && prog.price) || 0);
    if (!amountGhs || amountGhs <= 0) return json({ status: 'error', message: 'Course has no payable price' }, 400);
    name = enr.student_name || name;
    email = enr.student_email || email;
    access_token = enr.access_token;
    meta.enrollment_id = enr.id;
  } else {
    if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);
    domain_tx = (body.tx_ref || '').trim();
    if (!domain_tx) return json({ status: 'error', message: 'tx_ref required' }, 400);
    if (purpose === 'books') {
      const b = await env.DB.prepare('SELECT tx_ref, amount, email, name, status FROM book_purchases WHERE tx_ref = ?').bind(domain_tx).first().catch(() => null);
      if (!b) return json({ status: 'error', message: 'Unknown purchase' }, 404);
      if (b.status === 'completed') return json({ status: 'ok', already: true, message: 'Already completed' });
      amountGhs = Number(b.amount) || 0;
      name = b.name || name; email = b.email || email;
      meta.book_tx = b.tx_ref;
    } else if (purpose === 'tier') {
      const s = await env.DB.prepare('SELECT tx_ref, amount, email, name, tier, status FROM subscriptions WHERE tx_ref = ?').bind(domain_tx).first().catch(() => null);
      if (!s) return json({ status: 'error', message: 'Unknown subscription' }, 404);
      if (s.status === 'active') return json({ status: 'ok', already: true, message: 'Already active' });
      amountGhs = Number(s.amount) || 0;
      name = s.name || name; email = s.email || email; tier = s.tier || '';
      meta.tier_tx = s.tx_ref;
    } else if (purpose === 'merch') {
      const o = await env.DB.prepare('SELECT tx_ref, amount, delivery_fee, customer_email, customer_name, status FROM store_orders WHERE tx_ref = ?').bind(domain_tx).first().catch(() => null);
      if (!o) return json({ status: 'error', message: 'Unknown order' }, 404);
      if (o.status === 'completed') return json({ status: 'ok', already: true, message: 'Already completed' });
      amountGhs = (Number(o.amount) || 0) + (Number(o.delivery_fee) || 0);
      name = o.customer_name || name; email = o.customer_email || email;
      meta.order_tx = o.tx_ref;
    }
    if (!amountGhs || amountGhs <= 0) return json({ status: 'error', message: 'Nothing payable' }, 400);
    if (!email || !email.includes('@')) return json({ status: 'error', message: 'A valid email is required' }, 400);
  }

  const tx_ref = newRef('crypto_');
  const { usd, rate } = await ghsToUsd(amountGhs, env);

  // Accounting row for every crypto payment (idempotency + purpose routing).
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, provider, metadata, created_at)
         VALUES (?, ?, 'GHS', ?, ?, ?, 'pending', 'crypto', ?, datetime('now'))
         ON CONFLICT(tx_ref) DO UPDATE SET amount = excluded.amount, donor_name = excluded.donor_name, donor_email = excluded.donor_email, donor_phone = excluded.donor_phone, status = 'pending', provider = 'crypto', metadata = excluded.metadata`
      ).bind(tx_ref, amountGhs, name, email, phone, JSON.stringify(meta)).run();
    } catch (_e) {
      // Pre-migration DBs without the metadata column: record without purpose routing.
      try {
        await env.DB.prepare(
          `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, provider, created_at)
           VALUES (?, ?, 'GHS', ?, ?, ?, 'pending', 'crypto', datetime('now'))
           ON CONFLICT(tx_ref) DO UPDATE SET amount = excluded.amount, donor_name = excluded.donor_name, donor_email = excluded.donor_email, donor_phone = excluded.donor_phone, status = 'pending', provider = 'crypto'`
        ).bind(tx_ref, amountGhs, name, email, phone).run();
      } catch (_e2) {}
    }
  }

  const cbParams = { tx_ref, amount: amountGhs, name, email, phone, access_token, domain_tx, tier };

  // When NOWPayments is configured, delegate checkout to a hosted invoice.
  if (env.NOWPAYMENTS_API_KEY) {
    try {
      const resp = await fetch('https://api.nowpayments.io/v1/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.NOWPAYMENTS_API_KEY },
        body: JSON.stringify({
          price_amount: usd,
          price_currency: 'usd',
          order_id: tx_ref,
          order_description: DESCRIPTIONS[purpose],
          ipn_callback_url: site + '/api/gateways/crypto/webhook',
          success_url: SUCCESS_URLS[purpose](site, cbParams),
          cancel_url: site + CANCEL_URLS[purpose],
          is_fixed_rate: true
        })
      });
      const inv = await resp.json();
      if (inv.invoice_url) {
        return json({ status: 'ok', mode: 'invoice', purpose, tx_ref, invoice_url: inv.invoice_url, amount_usd: usd, amount_ghs: amountGhs, rate, success_url: SUCCESS_URLS[purpose](site, cbParams) });
      }
    } catch (_e) {}
  }

  // Manual fallback: return on-chain addresses for the donor to pay directly,
  // then POST /api/gateways/crypto/verify with the tx hash for auto-confirm.
  const addresses = {
    btc: env.CRYPTO_BTC_ADDRESS || '',
    usdt_trc20: env.CRYPTO_USDT_ADDRESS || '',
    evm: env.CRYPTO_EVM_ADDRESS || '',
    sol: env.CRYPTO_SOL_ADDRESS || ''
  };
  return json({
    status: 'ok',
    mode: 'manual',
    purpose,
    tx_ref,
    amount_ghs: amountGhs,
    amount_usd: usd,
    rate,
    addresses,
    memo: tx_ref,
    success_url: SUCCESS_URLS[purpose](site, cbParams)
  });
}
