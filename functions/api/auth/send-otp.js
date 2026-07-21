import { genToken } from './_hash.js';

function sanitize(s) { return (s || '').replace(/<[^>]*>/g, '').trim(); }

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
    var email = sanitize(body.email || '').toLowerCase();
    if (!email || !email.includes('@') || email.length > 254) {
      return new Response(JSON.stringify({ status: 'error', message: 'Valid email required' }), {
        status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
      });
    }
    var existingUser = await db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();
    var isNew = !existingUser;
    var code = String(Math.floor(100000 + Math.random() * 900000));
    var expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    await db.prepare(
      'UPDATE otp_codes SET used = 1 WHERE identifier = ? AND used = 0'
    ).bind(email).run();
    await db.prepare(
      'INSERT INTO otp_codes (identifier, code, expires_at) VALUES (?, ?, ?)'
    ).bind(email, code, expiresAt).run();
    if (env.BREVO_API_KEY) {
      try {
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'Studio by Gabochie', email: 'newsletter@gabochie.com' },
            to: [{ email: email, name: '' }],
            subject: isNew ? 'Confirm your email — Studio by Gabochie' : 'Your login code — Studio by Gabochie',
            htmlContent: '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px"><table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)"><tr><td style="background:#0A1628;padding:32px;text-align:center"><h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">Studio by Gabochie</h1></td></tr><tr><td style="padding:32px;text-align:center"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">' + (isNew ? 'Welcome! Enter this code to create your account:' : 'Enter this code to log in to your account:') + '</p><div style="background:#F8FAFC;border:2px dashed #C9A84C;border-radius:12px;padding:24px;margin:24px 0;display:inline-block"><span style="font-family:monospace;font-size:36px;font-weight:700;color:#0A1628;letter-spacing:8px">' + code + '</span></div><p style="color:#94A3B8;font-size:12px;line-height:1.5;margin:24px 0 0">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p></td></tr><tr><td style="padding:16px 32px;border-top:1px solid #E2E8F0"><p style="color:#94A3B8;font-size:10px;margin:0">Studio by Gabochie &mdash; Accra, Ghana</p></td></tr></table></td></tr></table></body></html>'
          })
        });
      } catch (_e) {}
    }
    return new Response(JSON.stringify({ status: 'ok', is_new: isNew }), {
      headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
    });
  }
}
