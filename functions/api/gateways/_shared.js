import { generateInvoice } from '../invoices/generate.js';
import { queueEmail, donationImpactFollowup, daysFromNow } from '../email/_send.js';

export function json(data, status) {
  status = status || 200;
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

export function readBody(request) {
  return request.json();
}

export function round2(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

export function newRef(prefix) {
  return (prefix || 'pay_') + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// GHS -> USD conversion for crypto invoices. Prefer env rate, then live API, then default.
export async function ghsToUsd(amountGhs, env) {
  const amount = round2(amountGhs);
  const envRate = parseFloat(env.GHS_USD_RATE);
  if (envRate && envRate > 0) {
    return { usd: round2(amount / envRate), rate: envRate };
  }
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/GHS');
    if (res.ok) {
      const data = await res.json();
      const r = data && data.rates && data.rates.USD;
      if (r && r > 0) {
        return { usd: round2(amount * r), rate: r };
      }
    }
  } catch (_e) {}
  const dflt = 0.066;
  return { usd: round2(amount * dflt), rate: dflt };
}

// Send a short purpose-built confirmation email via Brevo (best-effort).
async function sendCryptoMail(env, to, name, subject, lines, cta) {
  if (!env.BREVO_API_KEY || !to || to.indexOf('@') < 0) return;
  try {
    var items = (lines || []).map(function (l) {
      return '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 12px">' + l + '</p>';
    }).join('');
    var btn = cta ? '<a href="' + cta.url + '" style="display:inline-block;padding:14px 32px;background:#C9A84C;color:#0A1628;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">' + cta.label + '</a>' : '';
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">' +
      '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">' +
      '<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">' +
      '<tr><td style="background:#0A1628;padding:28px;text-align:center"><h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:22px;margin:0">Studio Gabochie</h1></td></tr>' +
      '<tr><td style="padding:28px"><p style="color:#1E293B;font-size:15px;margin:0 0 12px">Dear ' + (name || 'Friend') + ',</p>' + items +
      (btn ? '<p style="margin:20px 0 0">' + btn + '</p>' : '') +
      '</td></tr></table></td></tr></table></body></html>';
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'Studio Gabochie', email: 'newsletter@gabochie.com' },
        to: [{ email: to, name: name || '' }],
        subject: subject,
        htmlContent: html
      })
    });
  } catch (_e) {}
}

// Finalize any crypto payment by tx_ref: read purpose from the donations
// row metadata and run the matching activation. Idempotent.
export async function finalizeCryptoPayment(env, opts) {
  var db = env.DB;
  if (!db) return { status: 'error', message: 'DB not bound' };
  var tx_ref = opts.tx_ref || '';
  var gateway_txid = opts.gateway_txid || '';
  if (!tx_ref) return { status: 'error', message: 'tx_ref required' };
  var row = await db.prepare('SELECT * FROM donations WHERE tx_ref = ?').bind(tx_ref).first().catch(function () { return null; });
  if (!row) return { status: 'error', message: 'Unknown payment' };
  if (row.status === 'successful') return { status: 'ok', already: true, purpose: 'donation' };
  var meta = {};
  try { meta = JSON.parse(row.meta || row.metadata || '{}'); } catch (_e) {}
  var purpose = meta.purpose || 'donation';
  var email = row.donor_email || '';
  var name = row.donor_name || '';
  var amount = parseFloat(row.amount) || 0;

  if (purpose === 'course' && meta.enrollment_id) {
    await db.prepare("UPDATE enrollments SET status = 'active', payment_ref = COALESCE(NULLIF(payment_ref, ''), ?) WHERE id = ?").bind(tx_ref, meta.enrollment_id).run();
    try { await generateInvoice(env, 'course', 'enrollments', { name: name, email: email, phone: row.donor_phone, amount: amount, currency: row.currency || 'GHS', tx_ref: tx_ref, items: [{ description: 'Course Full Access', quantity: 1, unit_price: amount, total: amount }] }); } catch (_) {}
    await sendCryptoMail(env, email, name, 'Course Unlocked — Studio Gabochie',
      ['Your crypto payment of <strong>' + (row.currency || 'GHS') + ' ' + amount.toFixed(2) + '</strong> is confirmed. Full course access is now active.'],
      { url: 'https://studio.gabochie.com/dashboard/', label: 'Open Your Dashboard' });
    await markDonationRow(env, tx_ref, gateway_txid);
    return { status: 'ok', purpose: purpose };
  }
  if (purpose === 'books' && meta.book_tx) {
    await db.prepare("UPDATE book_purchases SET status = 'completed' WHERE tx_ref = ?").bind(meta.book_tx).run();
    try { await generateInvoice(env, 'books', 'book_purchases', { name: name, email: email, phone: row.donor_phone, amount: amount, currency: row.currency || 'GHS', tx_ref: meta.book_tx, items: [{ description: 'Book Purchase', quantity: 1, unit_price: amount, total: amount }] }); } catch (_) {}
    await sendCryptoMail(env, email, name, 'Your Books Are Ready — Studio Gabochie',
      ['Your crypto payment of <strong>' + (row.currency || 'GHS') + ' ' + amount.toFixed(2) + '</strong> is confirmed. Your download link is unique to this purchase — do not share it.'],
      { url: 'https://studio.gabochie.com/books/download?tx_ref=' + encodeURIComponent(meta.book_tx), label: 'Download Your Books' });
    await markDonationRow(env, tx_ref, gateway_txid);
    return { status: 'ok', purpose: purpose };
  }
  if (purpose === 'tier' && meta.tier_tx) {
    var sub = await db.prepare('SELECT email, tier, name FROM subscriptions WHERE tx_ref = ?').bind(meta.tier_tx).first().catch(function () { return null; });
    if (sub) {
      var membershipMap = { supporter: 'supporter', scholar: 'premium', patron: 'vip', founding: 'founding' };
      var newTier = membershipMap[sub.tier] || 'free';
      var tierUser = await db.prepare('SELECT id FROM users WHERE email = ?').bind(sub.email).first().catch(function () { return null; });
      var tierNames = { supporter: 'Supporter', scholar: 'Scholar', patron: 'Patron', founding: 'Founding Partner' };
      var displayName = tierNames[sub.tier] || 'Supporter';
      var expiresAt = (sub.tier === 'founding' || sub.tier === 'supporter') ? "datetime('now', '+1 year')" : "datetime('now', '+1 month')";
      if (tierUser && newTier !== 'free' && newTier !== 'supporter') {
        await db.prepare('UPDATE users SET membership_tier = ?, membership_expires_at = ' + expiresAt + ' WHERE id = ?').bind(newTier, tierUser.id).run();
      }
      await db.prepare("UPDATE subscriptions SET status = 'active', flw_id = ? WHERE tx_ref = ?").bind(gateway_txid, meta.tier_tx).run();
      try { await generateInvoice(env, 'tier', 'subscriptions', { name: sub.name, email: sub.email, phone: '', amount: amount, currency: row.currency || 'GHS', tx_ref: meta.tier_tx, items: [{ description: displayName + ' Tier', quantity: 1, unit_price: amount, total: amount }] }); } catch (_) {}
      await sendCryptoMail(env, sub.email, sub.name, 'Welcome to the ' + displayName + ' Tier — Studio Gabochie',
        ['Your crypto payment is confirmed. Your <strong>' + displayName + '</strong> tier is now active. Thank you for supporting the mission.'],
        { url: 'https://studio.gabochie.com/member/', label: 'Go to Membership' });
    }
    await markDonationRow(env, tx_ref, gateway_txid);
    return { status: 'ok', purpose: purpose };
  }
  if (purpose === 'merch' && meta.order_tx) {
    await db.prepare("UPDATE store_orders SET status = 'completed' WHERE tx_ref = ?").bind(meta.order_tx).run();
    try {
      var ord = await db.prepare('SELECT item_name, item_variant FROM store_orders WHERE tx_ref = ?').bind(meta.order_tx).first().catch(function () { return null; });
      var slugMap = { 'School of Creativity T-Shirt': 'soc-tshirt', 'Nation Builder Tee': 'nation-builder-tee', 'Studio Logo Hoodie': 'studio-hoodie', 'Wisdom Collection Cap': 'wisdom-cap', 'Wisdom Cap': 'wisdom-cap' };
      if (ord && ord.item_name && slugMap[ord.item_name] && ord.item_variant) {
        await db.prepare('UPDATE inventory SET quantity = MAX(quantity - 1, 0) WHERE product_slug = ? AND size = ? AND quantity > 0').bind(slugMap[ord.item_name], ord.item_variant).run();
      }
    } catch (_e) {}
    try { await generateInvoice(env, 'store', 'store_orders', { name: name, email: email, phone: row.donor_phone, amount: amount, currency: row.currency || 'GHS', tx_ref: meta.order_tx, items: [{ description: 'Store Purchase', quantity: 1, unit_price: amount, total: amount }] }); } catch (_) {}
    await sendCryptoMail(env, email, name, 'Purchase Confirmed — Studio Gabochie',
      ['Your crypto payment of <strong>' + (row.currency || 'GHS') + ' ' + amount.toFixed(2) + '</strong> is confirmed.'],
      { url: 'https://studio.gabochie.com/merch/?order=' + encodeURIComponent(meta.order_tx) + '&status=successful', label: 'View Your Order' });
    await markDonationRow(env, tx_ref, gateway_txid);
    return { status: 'ok', purpose: purpose };
  }

  if ((purpose === 'guitar' || meta.guitar) && meta.user_id) {
    const gp = await db.prepare("SELECT id, flw_tx_ref FROM guitar_payments WHERE user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1").bind(meta.user_id).first().catch(function () { return null; });
    if (gp) {
      await db.prepare("UPDATE guitar_payments SET status = 'completed', flw_tx_ref = ? WHERE id = ?").bind(gp.flw_tx_ref || gateway_txid || tx_ref, gp.id).run();
    }
    try {
      await db.prepare('INSERT OR IGNORE INTO guitar_user_stats (user_id) VALUES (?)').bind(meta.user_id).run();
    } catch (_e) {}
    try { await generateInvoice(env, 'course', 'guitar_payments', { name: name, email: email, phone: row.donor_phone, amount: amount, currency: row.currency || 'GHS', tx_ref: tx_ref, items: [{ description: 'Guitar Full Access', quantity: 1, unit_price: amount, total: amount }] }); } catch (_) {}
    await sendCryptoMail(env, email, name, 'Guitar Unlocked — Studio Gabochie',
      ['Your crypto payment of <strong>' + (row.currency || 'GHS') + ' ' + amount.toFixed(2) + '</strong> is confirmed. All 16 modules and the full song library are now unlocked.'],
      { url: 'https://studio.gabochie.com/guitar/learn/', label: 'Start Learning' });
    await markDonationRow(env, tx_ref, gateway_txid);
    return { status: 'ok', purpose: 'guitar' };
  }

  // Default: plain donation (existing behavior).
  await finalizeDonation(env, {
    tx_ref: tx_ref, amount: amount, currency: row.currency || 'GHS',
    donor_name: name, donor_email: email, donor_phone: row.donor_phone || '',
    gateway: 'crypto', gateway_txid: gateway_txid
  });
  return { status: 'ok', purpose: 'donation' };
}

async function markDonationRow(env, tx_ref, gateway_txid) {
  try {
    await env.DB.prepare("UPDATE donations SET status = 'successful', provider = 'crypto', flw_id = ? WHERE tx_ref = ?").bind(gateway_txid || '', tx_ref).run();
  } catch (_e) {}
}

// Mark a pending donation successful: update row, send receipt email, schedule impact followup.
export async function finalizeDonation(env, opts) {
  const { tx_ref, amount, currency, donor_name, donor_email, donor_phone, gateway, gateway_txid } = opts;
  const db = env.DB;
  if (!db) return { status: 'ok', message: 'DB not bound; donation not recorded' };

  await db.prepare(
    `UPDATE donations SET
       status = 'successful',
       provider = ?,
       flw_id = ?,
       metadata = ?
     WHERE tx_ref = ?`
  ).bind(
    gateway || '',
    gateway_txid || '',
    JSON.stringify({ gateway: gateway || '', gateway_txid: gateway_txid || '' }),
    tx_ref
  ).run();

  const invNum = await generateInvoice(env, 'donation', 'donations', {
    name: donor_name, email: donor_email, phone: donor_phone,
    amount, currency, tx_ref,
    items: [{ description: 'Donation', quantity: 1, unit_price: amount, total: amount }]
  }).catch(() => '');

  if (donor_email && donor_email !== 'donor@anonymous.invalid' && donor_email !== '—' && env.BREVO_API_KEY) {
    try {
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const invLink = invNum ? '<p style="margin:12px 0 0"><a href="https://studio.gabochie.com/api/invoices/' + invNum + '?token=' + invNum + '" style="color:#C9A84C;text-decoration:underline;font-size:13px">View Invoice &rsaquo;</a></p>' : '';
      const receiptHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">
        <tr><td style="background:#0A1628;padding:32px;text-align:center">
        <h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">Studio Gabochie</h1>
        <p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">Donation Receipt</p>
        </td></tr>
        <tr><td style="padding:32px">
        <p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 20px">Dear ${donor_name || 'Friend'},</p>
        <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Thank you for your generous gift of <strong style="color:#C9A84C">${currency || 'GHS'} ${Number(amount).toFixed(2)}</strong>. Your support makes every book, video, and teaching possible.</p>
        <table width="100%" cellpadding="8" cellspacing="0" style="background:#F8FAFC;border-radius:8px;margin-bottom:24px">
        <tr><td style="color:#64748B;font-size:12px;padding:8px 16px">Receipt No.</td><td style="color:#1E293B;font-size:13px;font-weight:600;font-family:monospace;text-align:right;padding:8px 16px">${tx_ref}</td></tr>
        <tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Date</td><td style="color:#1E293B;font-size:13px;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">${dateStr}</td></tr>
        <tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Amount</td><td style="color:#C9A84C;font-size:15px;font-weight:700;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">${currency || 'GHS'} ${Number(amount).toFixed(2)}</td></tr>
        <tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Status</td><td style="color:#22C55E;font-size:13px;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">Confirmed</td></tr>
        </table>
        <p style="color:#64748B;font-size:12px;line-height:1.6;margin:0 0 6px">This receipt was issued automatically. Keep it for your records.</p>
        ${invLink}
        <p style="color:#94A3B8;font-size:11px;line-height:1.5;margin:0">Studio Gabochie &mdash; Accra, Ghana &bull; <a href="mailto:studio@gabochie.com" style="color:#C9A84C">studio@gabochie.com</a></p>
        </td></tr></table></td></tr></table></body></html>`;

      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'Studio Gabochie', email: 'newsletter@gabochie.com' },
          to: [{ email: donor_email, name: donor_name || '' }],
          subject: 'Your Donation Receipt — Studio Gabochie',
          htmlContent: receiptHtml
        })
      });
      await queueEmail(env, donor_email, donor_name, 'Your Impact in Action', donationImpactFollowup(donor_name), 'donation_impact', daysFromNow(3));
    } catch (_e) {}
  }
  return { status: 'ok' };
}