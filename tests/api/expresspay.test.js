import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as expCreate } from '../../functions/api/gateways/expresspay/create.js';
import { onRequest as expCallback } from '../../functions/api/gateways/expresspay/callback.js';
import { onRequest as expStatus } from '../../functions/api/gateways/expresspay/status.js';

function post(url, body, env) {
  return buildContext(url, {
    method: 'POST',
    env: env,
    request: new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  });
}

function get(url, env) {
  return buildContext(url, { method: 'GET', env: env, request: new Request(url) });
}

function expEnv(db, overrides) {
  return Object.assign({ DB: db, EXPRESSPAY_MERCHANT_ID: 'mid', EXPRESSPAY_API_KEY: 'key' }, overrides || {});
}

describe('expresspay gateway', function () {
  var realFetch;
  beforeEach(function () { realFetch = globalThis.fetch; });
  afterEach(function () { globalThis.fetch = realFetch; });

  it('creates a checkout from a pending tier row', async function () {
    globalThis.fetch = async function (url) {
      expect(String(url)).toContain('/submit.php');
      return new Response(JSON.stringify({ status: 1, 'order-id': 'tier_abc', token: 'tok123' }), { status: 200 });
    };
    var db = mockDb({
      subscriptions: [{ id: 1, tx_ref: 'tier_abc', amount: 50, email: 'a@t.co', name: 'Ama', tier: 'supporter', status: 'pending' }],
      expresspay_tokens: []
    });
    var res = await expCreate(post('http://localhost/api/gateways/expresspay/create',
      { tx_ref: 'tier_abc', redirect: '/member/' }, expEnv(db)));
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.amount).toBe(50);
    expect(data.checkout_url).toContain('checkout.php?token=tok123');
    expect(db._tables.expresspay_tokens).toHaveLength(1);
  });

  it('rejects unknown or settled transactions', async function () {
    var db = mockDb({ subscriptions: [] });
    var res = await expCreate(post('http://localhost/api/gateways/expresspay/create',
      { tx_ref: 'tier_nope', redirect: '/member/' }, expEnv(db)));
    expect(res.status).toBe(404);
  });

  it('rejects off-site redirect targets', async function () {
    var db = mockDb({
      subscriptions: [{ id: 1, tx_ref: 'tier_abc', amount: 50, email: 'a@t.co', name: 'Ama', tier: 'supporter', status: 'pending' }]
    });
    globalThis.fetch = async function () {
      return new Response(JSON.stringify({ status: 1, token: 'tok9' }), { status: 200 });
    };
    var res = await expCreate(post('http://localhost/api/gateways/expresspay/create',
      { tx_ref: 'tier_abc', redirect: 'https://evil.com/x' }, expEnv(db)));
    var data = await res.json();
    expect(res.status).toBe(200);
    expect(data.checkout_url).toBeTruthy();
  });

  it('fails closed without credentials', async function () {
    var db = mockDb({
      subscriptions: [{ id: 1, tx_ref: 'tier_abc', amount: 50, email: 'a@t.co', name: 'Ama', tier: 'supporter', status: 'pending' }]
    });
    var res = await expCreate(post('http://localhost/api/gateways/expresspay/create',
      { tx_ref: 'tier_abc' }, { DB: db }));
    expect(res.status).toBe(502);
  });

  it('callback settles an approved MoMo payment after re-query', async function () {
    globalThis.fetch = async function (url) {
      expect(String(url)).toContain('/query.php');
      return new Response(JSON.stringify({ result: 1, 'result-text': 'Success', 'order-id': 'donate_x1', token: 'tok1', currency: 'GHS', amount: '100.00', 'transaction-id': 'EXP99' }), { status: 200 });
    };
    var db = mockDb({
      donations: [{ id: 1, tx_ref: 'donate_x1', amount: 100, currency: 'GHS', donor_name: 'Ben', donor_email: 'ben@t.co', donor_phone: '', status: 'pending', provider: 'expresspay', created_at: '2026-01-01' }],
      expresspay_tokens: [{ tx_ref: 'donate_x1', token: 'tok1' }]
    });
    var ctx = buildContext('http://localhost/api/gateways/expresspay/callback', {
      method: 'POST',
      env: expEnv(db),
      request: new Request('http://localhost/api/gateways/expresspay/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'order-id=donate_x1&token=tok1'
      })
    });
    var res = await expCallback(ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).settled).toBe(true);
    expect(db._tables.donations[0].status).toBe('successful');
  });

  it('callback refuses on amount mismatch', async function () {
    globalThis.fetch = async function () {
      return new Response(JSON.stringify({ result: 1, 'order-id': 'donate_x1', token: 'tok1', currency: 'GHS', amount: '1.00', 'transaction-id': 'EXP00' }), { status: 200 });
    };
    var db = mockDb({
      donations: [{ id: 1, tx_ref: 'donate_x1', amount: 100, currency: 'GHS', donor_name: 'Ben', donor_email: 'ben@t.co', donor_phone: '', status: 'pending', provider: 'expresspay', created_at: '2026-01-01' }],
      expresspay_tokens: [{ tx_ref: 'donate_x1', token: 'tok1' }]
    });
    var ctx = buildContext('http://localhost/api/gateways/expresspay/callback', {
      method: 'POST',
      env: expEnv(db),
      request: new Request('http://localhost/api/gateways/expresspay/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'order-id': 'donate_x1', token: 'tok1' })
      })
    });
    var res = await expCallback(ctx);
    expect(res.status).toBe(402);
    expect(db._tables.donations[0].status).toBe('pending');
  });

  it('status endpoint reports approval without secrets', async function () {
    globalThis.fetch = async function () {
      return new Response(JSON.stringify({ result: 1, 'order-id': 'tier_abc', token: 'tok123', currency: 'GHS', amount: '50.00' }), { status: 200 });
    };
    var db = mockDb({ expresspay_tokens: [{ tx_ref: 'tier_abc', token: 'tok123' }] });
    var res = await expStatus(get('http://localhost/api/gateways/expresspay/status?tx_ref=tier_abc', expEnv(db)));
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.approved).toBe(true);
    expect(data.amount).toBe(50);
  });
});
