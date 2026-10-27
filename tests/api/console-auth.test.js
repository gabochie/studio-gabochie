import { describe, it, expect } from 'vitest';
import { mockDb } from '../helpers/mock-cf.js';
import { onRequest as loginOnRequest } from '../../functions/api/admin/console/login.js';
import { onRequest as sessionOnRequest } from '../../functions/api/admin/console/session.js';
import { onRequest as claimOnRequest } from '../../functions/api/admin/console/claim.js';
import { requireAdminAuth } from '../../functions/api/admin/_admin-auth.js';
import { hashPassword } from '../../functions/api/auth/_hash.js';

/* ─── Helpers ─── */

function makeReq(url, opts) {
  opts = opts || {};
  var headers = Object.assign({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' }, opts.headers || {});
  var init = { method: opts.method || 'POST', headers: headers };
  if (opts.body) init.body = JSON.stringify(opts.body);
  return new Request(url, init);
}

function superAdminRow(passwordHash) {
  return { id: 1, name: 'Gideon Abochie', email: 'gid@gabochie.com', role: 'super_admin', password_hash: passwordHash || '' };
}

function memberRow() {
  return { id: 2, name: 'Member', email: 'member@example.com', role: 'member', password_hash: '' };
}

function db(opts) {
  opts = opts || {};
  return mockDb({
    users: opts.users || [],
    sessions: opts.sessions || [],
    otp_codes: opts.otp_codes || [],
    events: opts.events || [],
    audit_log: opts.audit_log || []
  });
}

/* ─── Login ─── */

describe('console login', function () {
  it('rejects GET with 405', async function () {
    var res = await loginOnRequest({ request: makeReq('https://x.com/api/admin/console/login', { method: 'GET' }), env: { DB: db() } });
    expect(res.status).toBe(405);
  });

  it('rejects unknown email with uniform 401', async function () {
    var res = await loginOnRequest({
      request: makeReq('https://x.com/api/admin/console/login', { body: { email: 'nobody@x.com', password: 'whatever1' } }),
      env: { DB: db({ users: [superAdminRow()] }) }
    });
    expect(res.status).toBe(401);
    var body = await res.json();
    expect(body.message).toBe('Invalid email or password');
  });

  it('rejects member-role accounts (role gate)', async function () {
    var hash = await hashPassword('SomePass123');
    var res = await loginOnRequest({
      request: makeReq('https://x.com/api/admin/console/login', { body: { email: 'member@example.com', password: 'SomePass123' } }),
      env: { DB: db({ users: [Object.assign(memberRow(), { password_hash: hash })] }) }
    });
    expect(res.status).toBe(401);
  });

  it('flags claim_required for a seeded passwordless admin', async function () {
    var res = await loginOnRequest({
      request: makeReq('https://x.com/api/admin/console/login', { body: { email: 'gid@gabochie.com', password: 'AnyPass123' } }),
      env: { DB: db({ users: [superAdminRow()] }) }
    });
    expect(res.status).toBe(403);
    var body = await res.json();
    expect(body.code).toBe('claim_required');
  });

  it('rejects a wrong password with 401', async function () {
    var hash = await hashPassword('CorrectPass1');
    var res = await loginOnRequest({
      request: makeReq('https://x.com/api/admin/console/login', { body: { email: 'gid@gabochie.com', password: 'WrongPass99' } }),
      env: { DB: db({ users: [superAdminRow(hash)] }) }
    });
    expect(res.status).toBe(401);
  });

  it('logs in a valid super admin and sets the ga_admin cookie', async function () {
    var hash = await hashPassword('CorrectPass1');
    var res = await loginOnRequest({
      request: makeReq('https://x.com/api/admin/console/login', { body: { email: 'gid@gabochie.com', password: 'CorrectPass1' } }),
      env: { DB: db({ users: [superAdminRow(hash)] }) }
    });
    expect(res.status).toBe(200);
    var setCookie = res.headers.get('Set-Cookie') || '';
    expect(setCookie).toContain('ga_admin=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    var body = await res.json();
    expect(body.user.role).toBe('super_admin');
    expect(body.user.email).toBe('gid@gabochie.com');
  });
});

/* ─── Session (whoami / logout) ─── */

describe('console session', function () {
  it('returns 401 without a cookie', async function () {
    var res = await sessionOnRequest({ request: makeReq('https://x.com/api/admin/console/session', { method: 'GET' }), env: { DB: db() } });
    expect(res.status).toBe(401);
  });

  it('returns whoami for a valid session', async function () {
    var env = { DB: db({ sessions: [Object.assign({ id: 1, user_id: 1, token: 'tok123', expires_at: '2999-01-01 00:00:00' }, superAdminRow())] }) };
    var res = await sessionOnRequest({
      request: makeReq('https://x.com/api/admin/console/session', { method: 'GET', headers: { Cookie: 'ga_admin=tok123' } }),
      env: env
    });
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.user.email).toBe('gid@gabochie.com');
    expect(body.user.role).toBe('super_admin');
  });

  it('refuses a session whose user is only a member', async function () {
    var env = { DB: db({ sessions: [Object.assign({ id: 1, user_id: 2, token: 'tok123', expires_at: '2999-01-01 00:00:00' }, memberRow())] }) };
    var res = await sessionOnRequest({
      request: makeReq('https://x.com/api/admin/console/session', { method: 'GET', headers: { Cookie: 'ga_admin=tok123' } }),
      env: env
    });
    expect(res.status).toBe(401);
  });

  it('logout clears the cookie', async function () {
    var res = await sessionOnRequest({
      request: makeReq('https://x.com/api/admin/console/session', { method: 'DELETE', headers: { Cookie: 'ga_admin=tok123' } }),
      env: { DB: db() }
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie') || '').toContain('Max-Age=0');
  });
});

/* ─── Claim (first-run password setup) ─── */

describe('console claim', function () {
  it('answers generically for non-claimable accounts', async function () {
    var hash = await hashPassword('AlreadySet1');
    var res = await claimOnRequest({
      request: makeReq('https://x.com/api/admin/console/claim', { body: { email: 'gid@gabochie.com' } }),
      env: { DB: db({ users: [superAdminRow(hash)] }) }
    });
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok'); // generic — no account-state disclosure
  });

  it('issues a code for a passwordless admin and verifies it', async function () {
    var env = { DB: db({ users: [superAdminRow()] }) };
    var post = await claimOnRequest({
      request: makeReq('https://x.com/api/admin/console/claim', { body: { email: 'gid@gabochie.com' } }),
      env: env
    });
    expect(post.status).toBe(200);

    // Simulate the code that was stored (mock DB has no persistence — seed it directly)
    var env2 = { DB: db({ users: [superAdminRow()], otp_codes: [{ id: 1, identifier: 'gid@gabochie.com', code: '123456', expires_at: '2999-01-01 00:00:00', used: 0, attempts: 0 }] }) };
    var put = await claimOnRequest({
      request: makeReq('https://x.com/api/admin/console/claim', { method: 'PUT', body: { email: 'gid@gabochie.com', code: '123456', password: 'BrandNewPass1' } }),
      env: env2
    });
    expect(put.status).toBe(200);
    expect(put.headers.get('Set-Cookie') || '').toContain('ga_admin=');
    var body = await put.json();
    expect(body.user.role).toBe('super_admin');
  });

  it('rejects a wrong code with 401', async function () {
    var res = await claimOnRequest({
      request: makeReq('https://x.com/api/admin/console/claim', { method: 'PUT', body: { email: 'gid@gabochie.com', code: '000000', password: 'BrandNewPass1' } }),
      env: { DB: db({ users: [superAdminRow()], otp_codes: [{ id: 1, identifier: 'gid@gabochie.com', code: '123456', expires_at: '2999-01-01 00:00:00', used: 0, attempts: 0 }] }) }
    });
    expect(res.status).toBe(401);
  });

  it('rejects short passwords', async function () {
    var res = await claimOnRequest({
      request: makeReq('https://x.com/api/admin/console/claim', { method: 'PUT', body: { email: 'gid@gabochie.com', code: '123456', password: 'short' } }),
      env: { DB: db({ users: [superAdminRow()] }) }
    });
    expect(res.status).toBe(400);
  });
});

/* ─── requireAdminAuth accepts role sessions ─── */

describe('requireAdminAuth console-session fallback', function () {
  it('authorizes all admin APIs for a valid super_admin cookie session', async function () {
    var env = { DB: db({ sessions: [Object.assign({ id: 1, user_id: 1, token: 'tok123', expires_at: '2999-01-01 00:00:00' }, superAdminRow())] }) };
    var req = makeReq('https://x.com/api/admin/preferences', { method: 'GET', headers: { Cookie: 'ga_admin=tok123' } });
    var err = await requireAdminAuth(req, env);
    expect(err).toBe(null);
  });

  it('still blocks a session whose user is only a member', async function () {
    var env = { DB: db({ sessions: [Object.assign({ id: 1, user_id: 2, token: 'tok123', expires_at: '2999-01-01 00:00:00' }, memberRow())] }), ADMIN_API_KEY: 'test-admin-key' };
    var req = makeReq('https://x.com/api/admin/preferences', { method: 'GET', headers: { Cookie: 'ga_admin=tok123' } });
    var err = await requireAdminAuth(req, env);
    expect(err).not.toBe(null);
    expect(err.status).toBe(403);
  });

  it('blocks with no credentials at all', async function () {
    var env = { DB: db(), ADMIN_API_KEY: 'test-admin-key' };
    var req = makeReq('https://x.com/api/admin/preferences', { method: 'GET' });
    var err = await requireAdminAuth(req, env);
    expect(err).not.toBe(null);
    expect(err.status).toBe(403);
  });
});
