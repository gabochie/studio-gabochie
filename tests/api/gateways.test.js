import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';
import { onRequest as moolreCreate } from '../../functions/api/gateways/moolre/create.js';
import { onRequest as moolreCallback } from '../../functions/api/gateways/moolre/callback.js';
import { onRequest as cryptoCreate } from '../../functions/api/gateways/crypto/create.js';
import { onRequest as cryptoWebhook } from '../../functions/api/gateways/crypto/webhook.js';
import { onRequest as manualCreate } from '../../functions/api/gateways/manual/create.js';

function post(url, body, env) {
  return buildContext(url, {
    method: 'POST',
    env: env,
    request: new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  });
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('Moolre gateway', function () {
  var realFetch;
  beforeEach(function () {
    realFetch = globalThis.fetch;
  });
  afterEach(function () {
    globalThis.fetch = realFetch;
  });

  it('creates a payment link and records pending donation', async function () {
    globalThis.fetch = async function (url, opts) {
      expect(String(url)).toBe('https://api.moolre.com/embed/link');
      var body = JSON.parse(opts.body);
      expect(body.type).toBe(1);
      expect(body.currency).toBe('GHS');
      expect(body.reusable).toBe('0');
      expect(body.externalref).toMatch(/^moolre_/);
      expect(body.accountnumber).toBe('12345');
      return jsonOk({ status: 1, code: 'POS09', message: 'OK', data: { authorization_url: 'https://pos.moolre.com/abc', reference: 'uuid-123' } });
    };
    var db = mockDb({ donations: [] });
    var ctx = post('http://localhost/api/gateways/moolre/create', { amount: 100, name: 'Ana', email: 'ana@test.com', phone: '+233501234567' }, { DB: db, MOOLRE_API_USER: 'user', MOOLRE_PUBLIC_KEY: 'pub', MOOLRE_ACCOUNT_NUMBER: '12345', MOOLRE_BASE_URL: 'https://api.moolre.com' });
    var res = await moolreCreate(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.authorization_url).toBe('https://pos.moolre.com/abc');
    expect(data.tx_ref).toMatch(/^moolre_/);
    expect(db._tables.donations).toHaveLength(1);
    expect(db._tables.donations[0].status).toBe('pending');
    expect(db._tables.donations[0].provider).toBe('moolre');
  });

  it('returns 502 when Moolre link creation fails', async function () {
    globalThis.fetch = async function () {
      return jsonOk({ status: 0, code: 'INP02', message: 'Transaction already exits!', data: [] });
    };
    var ctx = post('http://localhost/api/gateways/moolre/create', { amount: 50, name: 'Ana', email: 'ana@test.com' }, { MOOLRE_API_USER: 'user', MOOLRE_PUBLIC_KEY: 'pub', MOOLRE_BASE_URL: 'https://api.moolre.com' });
    var res = await moolreCreate(ctx);
    expect(res.status).toBe(502);
  });

  it('verifies and finalizes a pending donation on callback', async function () {
    var called = [];
    globalThis.fetch = async function (url, opts) {
      called.push(String(url));
      if (String(url).indexOf('/embed/link') >= 0) {
        return jsonOk({ status: 1, data: { authorization_url: 'https://pos.moolre.com/x' } });
      }
      if (String(url).indexOf('/open/transact/status') >= 0) {
        var b = JSON.parse(opts.body);
        if (b.idtype === 1) {
          return jsonOk({ status: 1, code: 'SS01', message: 'ok', data: { txstatus: 1, amount: '100', transactionid: 'TXN9', externalref: b.id }, go: null });
        }
      }
      return jsonOk({ status: 0, data: {} });
    };
    var db = mockDb({ donations: [], invoices: [] });
    // seed a pending donation
    db._tables.donations.push({ id: 1, tx_ref: 'moolre_abc', amount: 100, currency: 'GHS', donor_name: 'Ana', donor_email: 'ana@test.com', donor_phone: '', status: 'pending', provider: 'moolre', created_at: '2026-01-01' });
    var ctx = post('http://localhost/api/gateways/moolre/callback', { status: 1, code: 'P01', message: 'Transaction Successful', data: { externalref: 'moolre_abc' } }, { DB: db, MOOLRE_API_USER: 'user', MOOLRE_PUBLIC_KEY: 'pub', MOOLRE_ACCOUNT_NUMBER: '12345', MOOLRE_BASE_URL: 'https://api.moolre.com' });
    var res = await moolreCallback(ctx);
    expect(res.status).toBe(200);
    var updated = db._tables.donations.filter(function (r) { return r.tx_ref === 'moolre_abc'; })[0];
    expect(updated.status).toBe('successful');
    expect(updated.flw_id || updated.metadata).toBeTruthy();
    expect(called.some(function (u) { return u.indexOf('/open/transact/status') >= 0; })).toBe(true);
  });
});

describe('Crypto gateway', function () {
  var realFetch;
  beforeEach(function () {
    realFetch = globalThis.fetch;
  });
  afterEach(function () {
    globalThis.fetch = realFetch;
  });

  it('creates a hosted NOWPayments invoice when key configured', async function () {
    globalThis.fetch = async function (url, opts) {
      expect(String(url)).toBe('https://api.nowpayments.io/v1/invoice');
      var body = JSON.parse(opts.body);
      expect(opts.headers['x-api-key']).toBe('np-key');
      expect(body.price_currency).toBe('usd');
      expect(body.price_amount).toBeGreaterThan(0);
      expect(body.order_id).toMatch(/^crypto_/);
      return jsonOk({ id: 123, invoice_url: 'https://pay.nowpayments.io/invoice/abc' });
    };
    var db = mockDb({ donations: [] });
    var ctx = post('http://localhost/api/gateways/crypto/create', { amount: 100, name: 'Ben', email: 'ben@test.com' }, { DB: db, NOWPAYMENTS_API_KEY: 'np-key', GHS_USD_RATE: '15.0' });
    var res = await cryptoCreate(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.mode).toBe('invoice');
    expect(data.invoice_url).toContain('nowpayments');
    expect(db._tables.donations).toHaveLength(1);
    expect(db._tables.donations[0].provider).toBe('crypto');
  });

  it('falls back to manual addresses when NOWPayments not configured', async function () {
    var db = mockDb({ donations: [] });
    var ctx = post('http://localhost/api/gateways/crypto/create', { amount: 100, name: 'Ben', email: 'ben@test.com' }, { DB: db, CRYPTO_BTC_ADDRESS: 'bc1qabc', CRYPTO_USDT_ADDRESS: 'TRONabc' });
    var res = await cryptoCreate(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.mode).toBe('manual');
    expect(data.addresses.btc).toBe('bc1qabc');
    expect(data.addresses.usdt_trc20).toBe('TRONabc');
    expect(data.amount_usd).toBeGreaterThan(0);
    expect(data.memo).toBe(data.tx_ref);
  });

  it('rejects bad IPN signature', async function () {
    globalThis.fetch = realFetch;
    var ctx = buildContext('http://localhost/api/gateways/crypto/webhook', {
      method: 'POST',
      env: { NOWPAYMENTS_IPN_SECRET: 'secret' }
    });
    ctx.request = new Request('http://localhost/api/gateways/crypto/webhook', {
      method: 'POST',
      headers: { 'x-nowpayments-sig': 'wrong' },
      body: '{"payment_status":"finished"}'
    });
    var res = await cryptoWebhook(ctx);
    expect(res.status).toBe(401);
  });

  it('finalizes donation on confirmed IPN', async function () {
    // compute valid signature
    var sig = await (async function () {
      var key = await crypto.subtle.importKey('raw', new TextEncoder().encode('secret'), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
      var out = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('{"payment_status":"finished","order_id":"crypto_xyz","payment_id":"pay1"}'));
      return Array.from(new Uint8Array(out)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    })();
    var db = mockDb({ donations: [] });
    db._tables.donations.push({ id: 1, tx_ref: 'crypto_xyz', amount: 100, currency: 'GHS', donor_name: 'Ben', donor_email: 'ben@test.com', donor_phone: '', status: 'pending', provider: 'crypto', created_at: '2026-01-01' });
    var ctx = buildContext('http://localhost/api/gateways/crypto/webhook', {
      method: 'POST',
      env: { DB: db, NOWPAYMENTS_IPN_SECRET: 'secret' }
    });
    ctx.request = new Request('http://localhost/api/gateways/crypto/webhook', {
      method: 'POST',
      headers: { 'x-nowpayments-sig': sig },
      body: '{"payment_status":"finished","order_id":"crypto_xyz","payment_id":"pay1"}'
    });
    var res = await cryptoWebhook(ctx);
    expect(res.status).toBe(200);
    var updated = db._tables.donations.filter(function (r) { return r.tx_ref === 'crypto_xyz'; })[0];
    expect(updated.status).toBe('successful');
  });
});

describe('Manual MoMo gateway', function () {
  it('records pending donation and returns momo number', async function () {
    var db = mockDb({ donations: [] });
    var ctx = post('http://localhost/api/gateways/manual/create', { amount: 30, name: 'Cee', email: 'cee@test.com', phone: '+233559999999' }, { DB: db, MOMO_NUMBER: '0243262019' });
    var res = await manualCreate(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.momo_number).toBe('0243262019');
    expect(data.payout_display).toBe('0243 262 019');
    expect(data.tx_ref).toMatch(/^manual_/);
    expect(db._tables.donations).toHaveLength(1);
    expect(db._tables.donations[0].provider).toBe('manual');
    expect(db._tables.donations[0].status).toBe('pending');
  });
});