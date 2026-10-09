import { json, readBody } from '../_shared.js';
import { expresspaySubmit, expresspayCheckoutUrl, publicBase } from './_expresspay.js';

// POST /api/gateways/expresspay/create
// Body: { tx_ref, name?, email?, phone?, redirect? }
// Resolves the payable amount server-side from the pending row (never trusts
// the client), submits to ExpressPay, and returns a hosted checkout URL.
// redirect must be a same-origin path; tx_ref + status=pending are appended.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid body' }, 400);
  }
  const tx_ref = String((body && body.tx_ref) || '').trim();
  if (!tx_ref) return json({ status: 'error', message: 'tx_ref required' }, 400);
  if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);

  var redirect = String((body && body.redirect) || '/donate/');
  if (redirect.charAt(0) !== '/' || redirect.charAt(1) === '/') redirect = '/donate/';

  // Donations declare their own amount: stage a pending row when none exists.
  // Settlement always uses the ExpressPay-verified amount, never this value.
  if (/^(donate_|camp_)/.test(tx_ref)) {
    var declared = parseFloat(body && body.amount) || 0;
    if (!(declared > 0) || declared > 1000000) return json({ status: 'error', message: 'Invalid amount' }, 400);
    var dName = String((body && body.name) || '').trim().slice(0, 120);
    var dEmail = String((body && body.email) || '').trim().slice(0, 120);
    var dPhone = String((body && body.phone) || '').trim().slice(0, 20);
    if (!dEmail || dEmail.indexOf('@') < 0) return json({ status: 'error', message: 'A valid email is required' }, 400);
    try {
      await env.DB.prepare(
        `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, provider, created_at)
         VALUES (?, ?, 'GHS', ?, ?, ?, 'pending', 'expresspay', datetime('now'))
         ON CONFLICT(tx_ref) DO NOTHING`
      ).bind(tx_ref, declared, dName, dEmail, dPhone).run();
    } catch (_e) {}
  }

  var found = null;
  try {
    found = await resolvePendingTx(env.DB, tx_ref);
  } catch (_e) {
    return json({ status: 'error', message: 'Lookup failed' }, 500);
  }
  if (!found) return json({ status: 'error', message: 'Unknown or already-settled transaction' }, 404);

  var name = String((body && body.name) || found.name || '').trim();
  var email = String((body && body.email) || found.email || '').trim();
  var phone = String((body && body.phone) || found.phone || '').trim();
  if (!email || email.indexOf('@') < 0) return json({ status: 'error', message: 'A valid email is required' }, 400);

  var site = publicBase(env);
  var sep = redirect.indexOf('?') >= 0 ? '&' : '?';
  var redirectUrl = site + redirect + sep + 'tx_ref=' + encodeURIComponent(tx_ref) + '&status=pending';
  var postUrl = site + '/api/gateways/expresspay/callback';

  var nameParts = name.split(/\s+/).filter(Boolean);
  var submitted = await expresspaySubmit(env, {
    amount: found.amount,
    orderId: tx_ref,
    desc: found.desc,
    firstName: nameParts[0] || 'Valued',
    lastName: nameParts.slice(1).join(' ') || 'Customer',
    name: name,
    email: email,
    phone: phone,
    redirectUrl: redirectUrl,
    postUrl: postUrl
  });
  if (!submitted.ok) {
    return json({ status: 'error', message: 'Payment gateway unavailable', code: submitted.error }, 502);
  }
  try {
    await env.DB.prepare('INSERT INTO expresspay_tokens (tx_ref, token) VALUES (?, ?) ON CONFLICT(tx_ref) DO UPDATE SET token = excluded.token').bind(tx_ref, submitted.token).run();
  } catch (_e) {}
  return json({ status: 'ok', tx_ref: tx_ref, amount: found.amount, currency: 'GHS', checkout_url: expresspayCheckoutUrl(env, submitted.token) });
}

// Look up a pending payable by tx_ref prefix. Returns
// { amount, name, email, phone, desc } or null when unknown/settled.
export async function resolvePendingTx(db, tx_ref) {
  var row, amount;
  if (/^(donate_|camp_)/.test(tx_ref)) {
    row = await db.prepare("SELECT amount, currency, donor_name, donor_email, donor_phone, status FROM donations WHERE tx_ref = ?").bind(tx_ref).first();
    if (!row || row.status === 'completed' || row.status === 'successful') return null;
    amount = parseFloat(row.amount) || 0;
    if (!(amount > 0)) return null;
    return { amount: amount, name: row.donor_name || '', email: row.donor_email || '', phone: row.donor_phone || '', desc: tx_ref.indexOf('camp_') === 0 ? 'Campaign donation — Studio Gabochie' : 'Donation — Studio Gabochie' };
  }
  if (/^(tier_|memb_|sub_)/.test(tx_ref)) {
    row = await db.prepare('SELECT amount, email, name, status FROM subscriptions WHERE tx_ref = ?').bind(tx_ref).first();
    if (!row || row.status === 'active') return null;
    amount = parseFloat(row.amount) || 0;
    if (!(amount > 0)) return null;
    return { amount: amount, name: row.name || '', email: row.email || '', phone: '', desc: 'Membership tier — Studio Gabochie' };
  }
  if (/^upgrade_/.test(tx_ref)) {
    row = await db.prepare('SELECT e.status, e.payment_ref, p.price FROM enrollments e JOIN programs p ON e.program_id = p.id WHERE e.payment_ref = ?').bind(tx_ref).first();
    if (!row || row.status === 'active') return null;
    amount = parseFloat(row.price) || 0;
    if (!(amount > 0)) return null;
    var who = await db.prepare('SELECT student_name, student_email FROM enrollments WHERE payment_ref = ?').bind(tx_ref).first();
    return { amount: amount, name: (who && who.student_name) || '', email: (who && who.student_email) || '', phone: '', desc: 'Course full access — Studio Gabochie' };
  }
  if (/^(books_|bookpw_)/.test(tx_ref)) {
    row = await db.prepare('SELECT amount, email, name, status FROM book_purchases WHERE tx_ref = ?').bind(tx_ref).first();
    if (!row || row.status === 'completed') return null;
    amount = parseFloat(row.amount) || 0;
    if (!(amount > 0)) return null;
    return { amount: amount, name: row.name || '', email: row.email || '', phone: '', desc: 'Books — Studio Gabochie' };
  }
  if (/^store_/.test(tx_ref)) {
    row = await db.prepare('SELECT amount, delivery_fee, customer_email, customer_name, status FROM store_orders WHERE tx_ref = ?').bind(tx_ref).first();
    if (!row || row.status === 'completed') return null;
    amount = (parseFloat(row.amount) || 0) + (parseFloat(row.delivery_fee) || 0);
    if (!(amount > 0)) return null;
    return { amount: amount, name: row.customer_name || '', email: row.customer_email || '', phone: '', desc: 'Store order — Studio Gabochie' };
  }
  if (/^GUITAR_/.test(tx_ref)) {
    row = await db.prepare('SELECT amount, user_id, email, status FROM guitar_payments WHERE flw_tx_ref = ?').bind(tx_ref).first();
    if (!row || row.status === 'completed') return null;
    amount = parseFloat(row.amount) || 99;
    var buyer = { name: '', email: row.email || '', phone: '' };
    if (row.user_id) {
      try {
        var u = await db.prepare('SELECT name, email, phone FROM users WHERE id = ?').bind(row.user_id).first();
        if (u) buyer = { name: u.name || '', email: u.email || row.email || '', phone: u.phone || '' };
      } catch (_e) {}
    }
    return { amount: amount, name: buyer.name, email: buyer.email, phone: buyer.phone, desc: 'Guitar Method full access — Studio Gabochie' };
  }
  if (/^booking_/.test(tx_ref)) {
    row = await db.prepare('SELECT amount, email, name, status FROM bookings WHERE payment_tx_ref = ?').bind(tx_ref).first();
    if (!row || row.status === 'confirmed') return null;
    amount = parseFloat(row.amount) || 0;
    if (!(amount > 0)) return null;
    return { amount: amount, name: row.name || '', email: row.email || '', phone: '', desc: 'Ad booking — Studio Gabochie' };
  }
  return null;
}
