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