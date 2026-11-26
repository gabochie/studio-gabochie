import { describe, it, expect, afterEach, vi } from 'vitest';
import { mockDb } from '../helpers/mock-cf.js';

import { verifyAccessJwt } from '../../functions/api/admin/_access-jwt.js';
import { checkRateLimit } from '../../functions/api/_rate-limit.js';
import { verifyTurnstile } from '../../functions/api/_turnstile.js';
import { requireAdmin } from '../../functions/admin/_auth.js';
import { requireAdminAuth } from '../../functions/api/admin/_admin-auth.js';
import { onRequest as sendNewsletter } from '../../functions/admin/api/newsletter/send.js';

afterEach(function () {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ───────────────────────── SEC-04: Access JWT claim checks ───────────────── */

function b64url(value) {
  var bytes = new TextEncoder().encode(value);
  var binary = '';
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sigB64url(buffer) {
  var bytes = new Uint8Array(buffer);
  var binary = '';
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signingKeys() {
  return crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify']
  );
}

async function jwt(header, payload, privateKey) {
  var input = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
  var signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(input));
  return input + '.' + sigB64url(signature);
}

function claims(overrides) {
  var now = Math.floor(Date.now() / 1000);
  return Object.assign({
    sub: 'admin-1', email: 'admin@example.com', name: 'Admin',
    iss: 'https://acme.cloudflareaccess.com',
    aud: 'aud-123', iat: now, exp: now + 600
  }, overrides || {});
}

function jwtEnv(overrides) {
  return Object.assign({ CF_ACCESS_TEAM: 'acme', CF_ACCESS_AUD: 'aud-123' }, overrides || {});
}

function jwtRequest(token) {
  return new Request('https://studio.gabochie.com/api/admin/summary', {
    headers: { 'Cf-Access-Jwt-Assertion': token }
  });
}

describe('SEC-04 Access JWT claim validation', function () {
  var keys;
  var jwk;

  async function setupValidSigner() {
    keys = await signingKeys();
    jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
    jwk.kid = 'test-kid';
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    vi.stubGlobal('fetch', vi.fn(async function () {
      return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
    }));
  }

  async function verify(payload, env) {
    var token = await jwt({ alg: 'RS256', typ: 'JWT', kid: 'test-kid' }, payload, keys.privateKey);
    return verifyAccessJwt(jwtRequest(token), env || jwtEnv());
  }

  it('accepts an exactly matching token (team slug or full issuer URL form)', async function () {
    await setupValidSigner();
    expect(await verify(claims())).toMatchObject({ sub: 'admin-1', email: 'admin@example.com' });
    expect(await verify(claims(), jwtEnv({ CF_ACCESS_TEAM: 'https://acme.cloudflareaccess.com/' }))).not.toBe(null);
  });

  it('rejects a lookalike issuer instead of using substring matching', async function () {
    await setupValidSigner();
    expect(await verify(claims({ iss: 'https://acme.cloudflareaccess.com.evil.test' }))).toBe(null);
    expect(await verify(claims({ iss: 'https://evil.test/?next=https://acme.cloudflareaccess.com' }))).toBe(null);
  });

  it('requires aud and matches it exactly (string or array)', async function () {
    await setupValidSigner();
    expect(await verify(claims({ aud: undefined }))).toBe(null);
    expect(await verify(claims({ aud: 'prefix-aud-123-suffix' }))).toBe(null);
    expect(await verify(claims({ aud: ['other', 'aud-123'] }))).not.toBe(null);
    expect(await verify(claims({ aud: ['aud-123-extra'] }))).toBe(null);
  });

  it('requires an unexpired exp and still honours nbf', async function () {
    await setupValidSigner();
    var now = Math.floor(Date.now() / 1000);
    expect(await verify(claims({ exp: undefined }))).toBe(null);
    expect(await verify(claims({ exp: now - 1 }))).toBe(null);
    expect(await verify(claims({ nbf: now + 600 }))).toBe(null);
  });
});

/* ───────────────────────── SEC-10: fail-closed helpers ───────────────────── */

describe('SEC-10 rate limiter fails closed on database errors', function () {
  it('denies when prepare() throws', async function () {
    var db = { prepare: function () { throw new Error('D1 unavailable'); } };
    expect(await checkRateLimit(db, '203.0.113.7', 'login', 10, 60)).toBe(false);
  });

  it('denies when the COUNT query rejects', async function () {
    var db = {
      prepare: function () {
        return {
          bind: function () {
            return { first: async function () { throw new Error('read failure'); }, run: async function () { return {}; } };
          }
        };
      }
    };
    expect(await checkRateLimit(db, '203.0.113.8', 'momo_claim', 5, 300)).toBe(false);
  });

  it('still allows a healthy database below the limit', async function () {
    expect(await checkRateLimit(mockDb({ events: [] }), '203.0.113.9', 'login', 10, 60)).toBe(true);
  });
});

describe('SEC-10 Turnstile fails closed', function () {
  var request = new Request('https://studio.gabochie.com/api/subscribe', {
    method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.10' }
  });

  it('denies when the secret is not configured', async function () {
    expect(await verifyTurnstile({}, request, 'tok')).toBe(false);
    expect(await verifyTurnstile(undefined, request, 'tok')).toBe(false);
  });

  it('denies when the token is missing', async function () {
    expect(await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, request, '')).toBe(false);
  });

  it('denies a non-2xx siteverify response even if its body claims success', async function () {
    vi.stubGlobal('fetch', vi.fn(async function () {
      return new Response(JSON.stringify({ success: true }), { status: 503 });
    }));
    expect(await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, request, 'tok')).toBe(false);
  });

  it('denies a network failure', async function () {
    vi.stubGlobal('fetch', vi.fn(async function () { throw new Error('offline'); }));
    expect(await verifyTurnstile({ TURNSTILE_SECRET: 'sec' }, request, 'tok')).toBe(false);
  });
});

/* ───────────────────────── SEC-17: one auth rule for both trees ──────────── */

describe('SEC-17 admin auth is identical across URL trees', function () {
  it('accepts the same console admin session through both helpers', async function () {
    var db = mockDb({
      sessions: [{ token: 'console-tok', user_id: 1, expires_at: '2999-01-01 00:00:00', role: 'admin' }],
      users: [{ id: 1, role: 'admin' }]
    });
    var req = new Request('https://studio.gabochie.com/admin/api/summary', {
      headers: { Cookie: 'ga_admin=console-tok' }
    });
    expect(await requireAdmin(req, { DB: db })).toBe(null);
    expect(await requireAdminAuth(req, { DB: db })).toBe(null);
  });

  it('rejects the same forged session through both helpers', async function () {
    var db = mockDb({ sessions: [], users: [] });
    var req = new Request('https://studio.gabochie.com/admin/api/summary', {
      headers: { Cookie: 'ga_admin=forged' }
    });
    expect(await requireAdmin(req, { DB: db, CF_ACCESS_TEAM: 'acme' })).not.toBe(null);
    expect(await requireAdminAuth(req, { DB: db, CF_ACCESS_TEAM: 'acme' })).not.toBe(null);
  });
});

/* ───────────────────────── DAT-30: suppressed test sends ─────────────────── */

function newsletterRequest(testEmail) {
  return new Request('https://studio.gabochie.com/admin/api/newsletter/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'admin-key' },
    body: JSON.stringify({ subject: 'Issue', html: '<p>{{NAME}}</p>', test_email: testEmail })
  });
}

describe('DAT-30 admin test send honours suppression', function () {
  it('refuses a suppressed address without contacting Brevo', async function () {
    var db = mockDb({
      suppression_list: [{ email: 'suppressed@example.com', reason: 'unsubscribe' }],
      subscribers: [{ email: 'suppressed@example.com', name: 'Bot', edition: 'GH', ref_code: 'X' }]
    });
    var fetchSpy = vi.fn(async function () { return new Response('{}', { status: 200 }); });
    vi.stubGlobal('fetch', fetchSpy);
    var res = await sendNewsletter({
      request: newsletterRequest('suppressed@example.com'),
      env: { DB: db, ADMIN_API_KEY: 'admin-key', BREVO_API_KEY: 'brevo-key' }
    });
    expect(res.status).toBe(403);
    expect((await res.json()).message).toMatch(/suppress/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('still sends to a non-suppressed test address', async function () {
    var db = mockDb({
      suppression_list: [{ email: 'suppressed@example.com', reason: 'unsubscribe' }],
      subscribers: [{ email: 'ok@example.com', name: 'Ada', edition: 'GH', ref_code: 'X' }]
    });
    var fetchSpy = vi.fn(async function () { return new Response('{}', { status: 200 }); });
    vi.stubGlobal('fetch', fetchSpy);
    var res = await sendNewsletter({
      request: newsletterRequest('ok@example.com'),
      env: { DB: db, ADMIN_API_KEY: 'admin-key', BREVO_API_KEY: 'brevo-key' }
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ok');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
