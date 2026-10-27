// POST /api/admin/console/claim — email a one-time code to a seeded, passwordless admin account.
// PUT  /api/admin/console/claim — verify code + set first password, log in.
// Only accounts with role super_admin/admin AND empty password_hash can claim.
import { hashPassword } from '../../auth/_hash.js';
import { checkRateLimit } from '../../_rate-limit.js';
import { createConsoleSession, consoleCookie, logConsoleAction } from '../_console-session.js';

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {})
  });
}

function claimable(user) {
  return user && (user.role === 'super_admin' || user.role === 'admin') && !user.password_hash;
}

export async function onRequest(context) {
  var { request, env } = context;
  if (request.method !== 'POST' && request.method !== 'PUT') {
    return json({ status: 'error', message: 'Method not allowed' }, 405);
  }
  var db = env.DB;
  if (!db) return json({ status: 'error', message: 'D1 not bound' }, 501);

  try {
    var body = await request.json();
    var email = String(body.email || '').trim().toLowerCase();
    if (!email || email.length > 254) return json({ status: 'error', message: 'Valid email required' }, 400);

    var ip = request.headers.get('CF-Connecting-IP') || '';

    if (request.method === 'POST') {
      if (!await checkRateLimit(db, ip, 'console-claim', 3, 300)) {
        return json({ status: 'error', message: 'Too many attempts. Try again later.' }, 429);
      }
      var user = await db.prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ?').bind(email).first();
      if (!claimable(user)) {
        // Generic response — no account-state disclosure.
        return json({ status: 'ok', message: 'If this account can be claimed, a code has been sent.' });
      }
      var code = String(Math.floor(100000 + Math.random() * 900000));
      var expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      await db.prepare('UPDATE otp_codes SET used = 1 WHERE identifier = ? AND used = 0').bind(email).run();
      await db.prepare('INSERT INTO otp_codes (identifier, code, expires_at) VALUES (?, ?, ?)').bind(email, code, expiresAt).run();

      if (env.BREVO_API_KEY) {
        try {
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
            body: JSON.stringify({
              sender: { name: 'Studio Gabochie', email: 'newsletter@gabochie.com' },
              to: [{ email: email, name: user.name || '' }],
              subject: 'Claim your Super Admin account — Studio Gabochie',
              htmlContent: '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F6FA;font-family:Georgia,serif"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px"><table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)"><tr><td style="background:#0A1628;padding:32px;text-align:center"><h1 style="font-family:Georgia,serif;color:#C9A84C;font-size:24px;margin:0;letter-spacing:-.02em">Studio Gabochie</h1></td></tr><tr><td style="padding:32px;text-align:center"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Enter this code to claim your <strong>Super Admin</strong> account:</p><div style="background:#F8FAFC;border:2px dashed #C9A84C;border-radius:12px;padding:24px;margin:24px 0;display:inline-block"><span style="font-family:monospace;font-size:36px;font-weight:700;color:#0A1628;letter-spacing:8px">' + code + '</span></div><p style="color:#94A3B8;font-size:12px;line-height:1.5;margin:24px 0 0">This code expires in 15 minutes and can be used once. If you did not request this, ignore this email — the account stays locked.</p></td></tr><tr><td style="padding:16px 32px;border-top:1px solid #E2E8F0"><p style="color:#94A3B8;font-size:10px;margin:0">Studio Gabochie &mdash; Accra, Ghana</p></td></tr></table></td></tr></table></body></html>'
            })
          });
        } catch (_e) {}
      }
      await logConsoleAction(db, 'console_claim_code_sent', { actorEmail: email, ip: ip });
      return json({ status: 'ok', message: 'If this account can be claimed, a code has been sent.' });
    }

    // PUT — verify code, set password, log in
    var password = String(body.password || '');
    var code2 = String(body.code || '').trim();
    if (!/^\d{6}$/.test(code2)) return json({ status: 'error', message: 'Valid 6-digit code required' }, 400);
    if (password.length < 8) return json({ status: 'error', message: 'Password must be at least 8 characters' }, 400);
    if (!await checkRateLimit(db, ip, 'console-claim-verify', 5, 300)) {
      return json({ status: 'error', message: 'Too many attempts. Try again later.' }, 429);
    }

    var user2 = await db.prepare('SELECT id, name, email, role, password_hash FROM users WHERE email = ?').bind(email).first();
    if (!claimable(user2)) return json({ status: 'error', message: 'This account cannot be claimed. Log in with your password instead.' }, 403);

    var otp = await db.prepare(
      "SELECT id, code, expires_at, attempts FROM otp_codes WHERE identifier = ? AND code = ? AND used = 0 ORDER BY id DESC LIMIT 1"
    ).bind(email, code2).first();
    if (!otp) {
      await logConsoleAction(db, 'console_claim_bad_code', { actorEmail: email, ip: ip });
      return json({ status: 'error', message: 'Invalid or expired code' }, 401);
    }
    if (otp.expires_at && otp.expires_at <= new Date().toISOString().replace('T', ' ').slice(0, 19)) {
      return json({ status: 'error', message: 'Code expired. Request a new one.' }, 401);
    }
    if ((otp.attempts || 0) >= 5) return json({ status: 'error', message: 'Too many wrong attempts. Request a new code.' }, 429);

    var stored = await hashPassword(password);
    await db.prepare('UPDATE users SET password_hash = ?, last_login_at = datetime(\'now\') WHERE id = ?').bind(stored, user2.id).run();
    await db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').bind(otp.id).run();
    var token = await createConsoleSession(db, user2.id);
    await logConsoleAction(db, 'console_claimed', { actorEmail: email, ip: ip, details: { role: user2.role } });

    return json(
      { status: 'ok', user: { name: user2.name, email: user2.email, role: user2.role } },
      200,
      { 'Set-Cookie': consoleCookie(token, 12 * 60 * 60) }
    );
  } catch (_err) {
    return json({ status: 'error', message: 'Internal error' }, 500);
  }
}
