import { sendBrevoEmail, queueEmail, daysFromNow } from '../email/_send.js';
import { queueWhatsApp } from '../_whatsapp.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function receiptHtml(name, txRef, amount) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">' +
    '<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">' +
    '<tr><td style="background:#0A1628;padding:32px;text-align:center">' +
    '<h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0">Studio Gabochie</h1>' +
    '<p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">Guitar Method — Full Access Unlocked</p></td></tr>' +
    '<tr><td style="padding:32px">' +
    '<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 20px">Dear ' + esc(name || 'Guitarist') + ',</p>' +
    '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Your payment of <strong style="color:#C9A84C">GHS ' + esc(amount) + '</strong> is confirmed. All 16 modules, 64 lessons, and 15+ Ghanaian songs are now yours — lifetime access, no hidden fees.</p>' +
    '<table width="100%" cellpadding="8" cellspacing="0" style="background:#F8FAFC;border-radius:8px;margin-bottom:24px">' +
    '<tr><td style="color:#64748B;font-size:12px;padding:8px 16px">Transaction</td><td style="color:#1E293B;font-size:13px;font-family:monospace;text-align:right;padding:8px 16px">' + esc(txRef) + '</td></tr>' +
    '<tr><td style="color:#64748B;font-size:12px;padding:8px 16px;border-top:1px solid #E2E8F0">Amount</td><td style="color:#C9A84C;font-size:15px;font-weight:700;text-align:right;padding:8px 16px;border-top:1px solid #E2E8F0">GHS ' + esc(amount) + '</td></tr>' +
    '</table>' +
    '<a href="https://studio.gabochie.com/guitar/learn/" style="display:inline-block;padding:14px 32px;background:#C9A84C;color:#0A1628;border-radius:8px;font-family:sans-serif;font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;margin-bottom:16px">Start Learning</a>' +
    '<p style="color:#64748B;font-size:12px;line-height:1.6;margin:0">Keep this email as your receipt. Questions? <a href="mailto:studio@gabochie.com" style="color:#C9A84C">studio@gabochie.com</a> · Full <a href="https://studio.gabochie.com/legal/refund.html" style="color:#C9A84C">refund policy</a>.</p>' +
    '</td></tr></table></td></tr></table></body></html>';
}

function nudgeHtml(name) {
  return '<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#FAFAFA;padding:40px 20px">' +
    '<h2 style="color:#0A1628">How is your first week going, ' + esc(name || 'friend') + '?</h2>' +
    '<p style="color:#475569;font-size:14px;line-height:1.7">Most guitarists quit in week one because nobody shows them the first win. Open the Guitar Method, finish Module 1, and reply to this email with a video of your first chord change — we reply to every single one.</p>' +
    '<p><a href="https://studio.gabochie.com/guitar/learn/" style="display:inline-block;padding:12px 28px;background:#C9A84C;color:#0A1628;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">Continue Learning</a></p>' +
    '<p style="color:#94A3B8;font-size:12px">Studio Gabochie · <a href="mailto:studio@gabochie.com" style="color:#C9A84C">studio@gabochie.com</a></p>' +
    '</body></html>';
}

// Send the guitar purchase receipt immediately + queue a day-3 practice nudge.
// Best-effort: never throws, never blocks the unlock.
export async function sendGuitarReceipt(env, details) {
  try {
    var email = details && details.email ? String(details.email) : '';
    if (!email || email.indexOf('@') < 0) return;
    var name = (details && details.name) || '';
    var txRef = (details && details.txRef) || '';
    var amount = (details && details.amount != null) ? String(details.amount) : '';
    await sendBrevoEmail(env, email, name, 'Guitar Unlocked — Your Receipt · Studio Gabochie', receiptHtml(name, txRef, amount));
    try {
      await queueEmail(env, email, name, 'Your first win is waiting — Studio Gabochie', nudgeHtml(name), 'guitar_nudge_3d', daysFromNow(3));
    } catch (_e) {}
    var phone = details && details.phone ? String(details.phone).replace(/[^0-9]/g, '') : '';
    if (phone && phone.length >= 9) {
      try {
        await queueWhatsApp(env, phone, 'Studio Gabochie: your Guitar Method payment (GHS ' + amount + ', ref ' + txRef + ') is confirmed. Start learning: https://studio.gabochie.com/guitar/learn/', 'guitar_receipt');
      } catch (_e) {}
    }
  } catch (_e) {}
}

// Resolve buyer contact for a guitar payment row (payment email, else user record).
export async function guitarBuyer(db, txRef, fallbackEmail) {
  var buyer = { email: fallbackEmail || '', name: '', phone: '' };
  try {
    var pay = await db.prepare('SELECT user_id, email FROM guitar_payments WHERE flw_tx_ref = ?').bind(txRef).first();
    var uid = pay && pay.user_id ? pay.user_id : 0;
    if (pay && pay.email) buyer.email = pay.email;
    if (uid) {
      var u = await db.prepare('SELECT name, email, phone FROM users WHERE id = ?').bind(uid).first();
      if (u) {
        if (!buyer.email && u.email) buyer.email = u.email;
        buyer.name = u.name || '';
        buyer.phone = u.phone || '';
      }
    }
    if (!buyer.email && fallbackEmail) buyer.email = fallbackEmail;
  } catch (_e) {}
  return buyer;
}
