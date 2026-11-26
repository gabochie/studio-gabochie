import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as brevoWebhook } from '../../functions/api/webhooks/brevo.js';
import { onRequest as expresspayCallback } from '../../functions/api/gateways/expresspay/callback.js';
import { onRequest as cryptoVerify } from '../../functions/api/gateways/crypto/verify.js';
import { onRequest as momoClaim } from '../../functions/api/gateways/momo/claim.js';
import { settlePaidTx } from '../../functions/api/gateways/_settle.js';
import { requireAdminAuth } from '../../functions/api/admin/_admin-auth.js';
import { requireAdmin } from '../../functions/admin/_auth.js';
import { onRequest as session } from '../../functions/api/auth/session.js';
import { getToken as getEnrollToken } from '../../functions/api/enroll/_token.js';
import { onRequest as middleware } from '../../functions/_middleware.js';

async function hmacHex(payload, secret) {
  var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function post(url, body, headers) {
  return new Request(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '9.8.7.6' }, headers || {}),
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

describe('SEC-02 Brevo webhook signature', function () {
  var body;

  beforeEach(function () { body = JSON.stringify([{ type: 'delivered', email: 'a@t.co', tag: ['msg_1'] }]); });

  it('rejects a missing signature when a secret is configured', async function () {
    var res = await brevoWebhook({ request: post('https://x.com/api/webhooks/brevo', body), env: { DB: mockDb({ email_queue: [] }), BREVO_WEBHOOK_SECRET: 's3cret' } });
    expect(res.status).toBe(401);
  });

  it('rejects an invalid signature and accepts a valid one', async function () {
    var env = { DB: mockDb({ email_queue: [] }), BREVO_WEBHOOK_SECRET: 's3cret' };
    var bad = await brevoWebhook({ request: post('https://x.com/api/webhooks/brevo', body, { 'X-Mailin-Signature': '0'.repeat(64) }), env: env });
    expect(bad.status).toBe(401);

    var sig = await hmacHex(body, 's3cret');
    var good = await brevoWebhook({ request: post('https://x.com/api/webhooks/brevo', body, { 'X-Mailin-Signature': sig }), env: env });
    expect(good.status).toBe(200);
    expect((await good.json()).received).toBe(true);
  });
});

describe('SEC-03 ExpressPay provider-derived reference', function () {
  var realFetch;

  beforeEach(function () { realFetch = globalThis.fetch; });
  afterEach(function () { globalThis.fetch = realFetch; });

  it('rejects a caller reference that differs from the provider order id', async function () {
    globalThis.fetch = async function () {
      return new Response(JSON.stringify({ result: 1, 'order-id': 'donate_real', token: 'tok1', currency: 'GHS', amount: '10.00' }), { status: 200 });
    };
    var db = mockDb({ donations: [{ tx_ref: 'donate_real', amount: 10, status: 'pending' }], expresspay_tokens: [{ tx_ref: 'donate_real', token: 'tok1' }] });
    var res = await expresspayCallback(buildContext('https://x.com/api/gateways/expresspay/callback', {
      method: 'POST',
      env: { DB: db, EXPRESSPAY_MERCHANT_ID: 'mid', EXPRESSPAY_API_KEY: 'key' },
      request: post('https://x.com/api/gateways/expresspay/callback', 'order-id=donate_attacker&token=tok1', { 'Content-Type': 'application/x-www-form-urlencoded' })
    }));
    expect(res.status).toBe(400);
    expect(db._tables.donations[0].status).toBe('pending');
  });

  it('rejects a token whose stored reference differs from the provider order id', async function () {
    globalThis.fetch = async function () {
      return new Response(JSON.stringify({ result: 1, 'order-id': 'donate_real', token: 'tok1', currency: 'GHS', amount: '10.00' }), { status: 200 });
    };
    var db = mockDb({ donations: [{ tx_ref: 'donate_real', amount: 10, status: 'pending' }], expresspay_tokens: [{ tx_ref: 'donate_other', token: 'tok1' }] });
    var res = await expresspayCallback(buildContext('https://x.com/api/gateways/expresspay/callback', {
      method: 'POST',
      env: { DB: db, EXPRESSPAY_MERCHANT_ID: 'mid', EXPRESSPAY_API_KEY: 'key' },
      request: post('https://x.com/api/gateways/expresspay/callback', 'token=tok1', { 'Content-Type': 'application/x-www-form-urlencoded' })
    }));
    expect(res.status).toBe(400);
  });
});

describe('SEC-06 crypto transaction hash reuse', function () {
  it('rejects a hash already used by a successful row', async function () {
    var db = mockDb({
      donations: [
        { tx_ref: 'crypto_new', amount: 100, status: 'pending', provider: 'crypto' },
        { tx_ref: 'crypto_old', amount: 100, status: 'successful', provider: 'crypto', flw_id: '0xdeadbeef' }
      ]
    });
    var res = await cryptoVerify(buildContext('https://x.com/api/gateways/crypto/verify', {
      method: 'POST',
      env: { DB: db },
      request: post('https://x.com/api/gateways/crypto/verify', { tx_ref: 'crypto_new', chain: 'ethereum', tx_hash: '0xdeadbeef' })
    }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('TX_ALREADY_USED');
  });
});

describe('SEC-08 admin key fallback removal', function () {
  it('ignores ADMIN_KEY in both admin auth helpers', async function () {
    var request = new Request('https://x.com/api/admin/x', { headers: { 'X-Admin-Key': 'legacy' } });
    var env = { ADMIN_KEY: 'legacy' };
    expect(await requireAdminAuth(request, env)).not.toBe(null);
    expect(await requireAdmin(request, env)).not.toBe(null);
  });

  it('still accepts the dedicated ADMIN_API_KEY', async function () {
    var request = new Request('https://x.com/api/admin/x', { headers: { 'X-Admin-Key': 'dedicated' } });
    expect(await requireAdminAuth(request, { ADMIN_API_KEY: 'dedicated' })).toBe(null);
    expect(await requireAdmin(request, { ADMIN_API_KEY: 'dedicated' })).toBe(null);
  });
});

describe('SEC-09 MoMo terminal claims', function () {
  it('returns 409 for a confirmed claim without mutating it', async function () {
    var db = mockDb({ momo_manual_claims: [{ id: 1, tx_ref: 'momom_abc', momo_txn_id: 'OLD12345', status: 'confirmed' }], events: [] });
    var res = await momoClaim({
      request: post('https://x.com/api/gateways/momo/claim', { tx_ref: 'momom_abc', momo_txn_id: 'NEW12345', payer_number: '0244000000' }),
      env: { DB: db }
    });
    expect(res.status).toBe(409);
    expect(db._tables.momo_manual_claims[0].momo_txn_id).toBe('OLD12345');
  });
});

describe('SEC-12 credentials are never read from query strings', function () {
  it('auth/session ignores ?token=', async function () {
    var db = mockDb({ sessions: [{ user_id: 1, token: 'secret', expires_at: '2999-01-01 00:00:00' }], users: [{ id: 1, name: 'A', email: 'a@t.co' }] });
    var queryOnly = await session({ request: new Request('https://x.com/api/auth/session?token=secret'), env: { DB: db } });
    expect(queryOnly.status).toBe(401);
    var header = await session({ request: new Request('https://x.com/api/auth/session', { headers: { Authorization: 'Bearer secret' } }), env: { DB: db } });
    expect(header.status).toBe(200);
  });

  it('enroll token helper ignores ?token=', function () {
    expect(getEnrollToken(new Request('https://x.com/api/enroll?token=secret'), {})).toBe('');
    expect(getEnrollToken(new Request('https://x.com/api/enroll', { headers: { Authorization: 'Bearer secret' } }), {})).toBe('secret');
  });
});

describe('SEC-15 settlement claim is idempotent', function () {
  var realFetch;
  beforeEach(function () { realFetch = globalThis.fetch; globalThis.fetch = async function () { return new Response('{}', { status: 200 }); }; });
  afterEach(function () { globalThis.fetch = realFetch; });

  it('does not reissue invoices/receipts on a replayed callback', async function () {
    var donation = { id: 1, tx_ref: 'donate_x', amount: 100, currency: 'GHS', donor_name: 'Ana', donor_email: 'ana@t.co', donor_phone: '', status: 'pending', provider: 'expresspay' };
    var db = mockDb({ donations: [donation], invoices: [], email_queue: [] });
    var env = { DB: db, BREVO_API_KEY: 'key' };
    var p = { tx_ref: 'donate_x', amount: 100, currency: 'GHS', status: 'successful', event: 'charge.completed', name: 'Ana', email: 'ana@t.co', phone: '', gateway: 'expresspay', gatewayTxId: 'EXP1' };
    await settlePaidTx(env, db, p);
    await settlePaidTx(env, db, p);
    expect(db._tables.donations[0].status).toBe('successful');
    expect(db._tables.invoices).toHaveLength(1);
  });
});

describe('SEC-16 middleware origin parsing and admin gate', function () {
  function ctx(url, init, env) {
    return buildContext(url, {
      request: new Request(url, init),
      env: env,
      next: async function () { return new Response('ok'); }
    });
  }

  it('requires an exact Origin on mutating requests', async function () {
    var env = { DB: mockDb({ settings: [] }) };
    expect((await middleware(ctx('https://studio.gabochie.com/api/contact', { method: 'POST' }, env))).status).toBe(403);
    expect((await middleware(ctx('https://studio.gabochie.com/api/contact', { method: 'POST', headers: { Origin: 'https://evil-studio.gabochie.com' } }, env))).status).toBe(403);
    expect((await middleware(ctx('https://studio.gabochie.com/api/contact', { method: 'POST', headers: { Origin: 'https://studio.gabochie.com' } }, env))).status).toBe(200);
  });

  it('allows provider-verified callbacks without an Origin', async function () {
    var env = { DB: mockDb({ settings: [] }) };
    var req = new Request('https://studio.gabochie.com/api/webhooks/brevo', { method: 'POST', headers: { 'X-Mailin-Signature': 'abc' } });
    var res = await middleware(ctx('https://studio.gabochie.com/api/webhooks/brevo', { method: 'POST', headers: { 'X-Mailin-Signature': 'abc' } }, env));
    expect(req.headers.get('X-Mailin-Signature')).toBe('abc');
    expect(res.status).toBe(200);
  });

  it('allows CI secret database setup without an Origin', async function () {
    var env = { DB: mockDb({ settings: [] }) };
    expect((await middleware(ctx('https://studio.gabochie.com/api/db/setup', { method: 'POST' }, env))).status).toBe(403);
    var res = await middleware(ctx('https://studio.gabochie.com/api/db/setup', { method: 'POST', headers: { 'X-CI-Secret': 'ci-secret' } }, env));
    expect(res.status).toBe(200);
  });

  it('no longer treats a bare CF_Authorization cookie as an admin session', async function () {
    var env = { DB: mockDb({ sessions: [], settings: [] }) };
    var res = await middleware(ctx('https://studio.gabochie.com/admin/', { headers: { Cookie: 'CF_Authorization=forged' } }, env));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/login/');
  });
});
