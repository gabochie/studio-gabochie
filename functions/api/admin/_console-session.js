// Super admin / staff console session helpers.
// Named accounts (role 'admin' | 'super_admin' on the users table) log in at
// /console/ and get a ga_admin session cookie. This cookie authorizes
// /api/admin/* routes via requireAdminAuth's third fallback.
import { genToken } from '../auth/_hash.js';

export var CONSOLE_COOKIE = 'ga_admin';
export var CONSOLE_ROLES = ['super_admin', 'admin'];

export function getConsoleToken(request) {
  var cookie = request.headers.get('Cookie') || '';
  var m = cookie.match(/(?:^|;\s*)ga_admin=([^;]+)/);
  return m ? m[1] : '';
}

// Returns the authenticated admin user row, or null.
export async function getConsoleUser(db, request) {
  var token = getConsoleToken(request);
  if (!token) return null;
  try {
    var row = await db.prepare(
      "SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')"
    ).bind(token).first();
    if (!row || CONSOLE_ROLES.indexOf(row.role) === -1) return null;
    return row;
  } catch (_e) {
    return null;
  }
}

export async function createConsoleSession(db, userId) {
  var token = genToken();
  await db.prepare(
    "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, datetime('now', '+12 hours'))"
  ).bind(userId, token).run();
  return token;
}

export function consoleCookie(token, maxAgeSeconds) {
  return CONSOLE_COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + (maxAgeSeconds || 0);
}

export function clearConsoleCookie() {
  return CONSOLE_COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

// Audit trail entry for sensitive console actions.
export async function logConsoleAction(db, action, opts) {
  opts = opts || {};
  try {
    await db.prepare(
      "INSERT INTO audit_log (action, entity_type, entity_id, admin_key, ip, details) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      action, opts.entityType || 'console', opts.entityId || '',
      opts.actorEmail || '', opts.ip || '', JSON.stringify(opts.details || {})
    ).run();
  } catch (_e) {}
}
