import { genToken } from './_hash.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
  try {
    var body = await request.json();
    var email = (body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ status: 'error', message: 'Valid email required' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var student = await db.prepare(
      'SELECT id, name FROM students WHERE email = ?'
    ).bind(email).first();
    if (!student) {
      return new Response(JSON.stringify({ status: 'error', message: 'No account found with this email' }), {
        status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var resetToken = genToken();
    var expiresAt = new Date(Date.now() + 3600000).toISOString();
    await db.prepare(
      'UPDATE students SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?'
    ).bind(resetToken, expiresAt, student.id).run();
    if (env.BREVO_API_KEY) {
      var resetUrl = 'https://studio.gabochie.com/dashboard/reset-code.html?token=' + resetToken + '&email=' + encodeURIComponent(email);
      var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif">' +
        '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">' +
        '<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">' +
        '<tr><td style="background:#0A1628;padding:32px;text-align:center">' +
        '<h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">Studio by Gabochie</h1>' +
        '<p style="color:#6B7F9A;font-size:12px;margin:8px 0 0">Reset Your Access Code</p></td></tr>' +
        '<tr><td style="padding:32px">' +
        '<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Dear ' + (student.name || 'Student') + ',</p>' +
        '<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px">Click the button below to set a new access code for your account. This link expires in 1 hour.</p>' +
        '<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:0 0 24px">' +
        '<a href="' + resetUrl + '" style="display:inline-block;padding:14px 32px;border-radius:8px;background:#C9A84C;color:#0A1628;font-family:Georgia,serif;font-size:14px;font-weight:700;text-decoration:none">Reset Access Code</a>' +
        '</td></tr></table>' +
        '<p style="color:#64748B;font-size:13px;line-height:1.6;margin:0">If the button doesn\'t work, copy this link into your browser:</p>' +
        '<p style="color:#C9A84C;font-size:12px;font-family:monospace;word-break:break-all;margin:8px 0 0">' + resetUrl + '</p>' +
        '</td></tr>' +
        '<tr><td style="padding:16px 32px;border-top:1px solid #E2E8F0">' +
        '<p style="color:#94A3B8;font-size:10px;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p></td></tr>' +
        '</table></td></tr></table></body></html>';
      try {
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'Studio by Gabochie', email: 'newsletter@gabochie.com' },
            to: [{ email: email, name: student.name || '' }],
            subject: 'Reset Your Access Code — Studio by Gabochie',
            htmlContent: html
          })
        });
      } catch (_e) {}
    }
    return new Response(JSON.stringify({ status: 'ok', message: 'Reset link sent to your email' }), {
      headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
