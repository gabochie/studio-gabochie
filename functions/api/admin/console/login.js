// POST /api/admin/console/login — named-account login for super admins / admins.
// GET is not allowed; the console page uses /session for whoami.
import { verifyPassword } from '../../auth/_hash.js';
import { checkRateLimit } from '../../_rate-limit.js';
import { createConsoleSession, consoleCookie, logConsoleAction } from '../_console-session.js';

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {})
  });
}

export async function onRequest(context) {
  var { request, env } = context;
  if (request.method !== 'POST') {
    return json({ status: 'error', message: 'Method not allowed' }, 405);
  }
  var db = env.DB;
  if (!db) return json({ status: 'error', message: 'D1 not bound' }, 501);

  try {
    var body = await request.json();
    var email = String(body.email || '').trim().toLowerCase();
    var password = String(body.password || '');
    if (!email || !password) return json({ status: 'error', message: 'Email and password required' }, 400);

    var ip = request.headers.get('CF-Connecting-IP') || '';
    if (!await checkRateLimit(db, ip, 'console-login', 5, 60)) {
      return json({ status: 'error', message: 'Too many attempts. Try again later.' }, 429);
    }

    var user = await db.prepare(
      'SELECT id, name, email, role, password_hash FROM users WHERE email = ?'
    ).bind(email).first();

    // Uniform rejection — never reveal whether the email exists.
    if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) {
      return json({ status: 'error', message: 'Invalid email or password' }, 401);
    }

    // First-run: seeded super admin has no password yet — must claim via /console.
    if (!user.password_hash) {
      return json({ status: 'error', code: 'claim_required', message: 'First-time setup required. Claim this account with the email code.' }, 403);
    }

    var valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      await logConsoleAction(db, 'console_login_failed', { actorEmail: email, ip: ip });
      return json({ status: 'error', message: 'Invalid email or password' }, 401);
    }

    var token = await createConsoleSession(db, user.id);
    await db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(user.id).run();
    await logConsoleAction(db, 'console_login', { actorEmail: email, ip: ip });

    return json(
      { status: 'ok', user: { name: user.name, email: user.email, role: user.role } },
      200,
      { 'Set-Cookie': consoleCookie(token, 12 * 60 * 60) }
    );
  } catch (_err) {
    return json({ status: 'error', message: 'Internal error' }, 500);
  }
}
