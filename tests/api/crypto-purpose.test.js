import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as cryptoCreate } from '../../functions/api/gateways/crypto/create.js';
import { onRequest as cryptoWebhook } from '../../functions/api/gateways/crypto/webhook.js';
import { onRequest as cryptoVerify } from '../../functions/api/gateways/crypto/verify.js';

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

// Signed webhook context: computes a valid NOWPayments HMAC over the raw body.
async function signedWebhook(rawBody, db) {
  var key = await crypto.subtle.importKey('raw', new TextEncoder().encode('secret'), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  var out = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  var sig = Array.from(new Uint8Array(out)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  var url = 'http://localhost/api/gateways/crypto/webhook';
  var ctx = buildContext(url, { method: 'POST', env: { DB: db, NOWPAYMENTS_IPN_SECRET: 'secret' } });
  ctx.request = new Request(url, { method: 'POST', headers: { 'x-nowpayments-sig': sig }, body: rawBody });
  return ctx;
}

function baseDb() {
  return mockDb({
    donations: [],
    enrollments: [
      { id: 11, program_id: 9, access_token: 'ga_enroll1', status: 'sample', student_name: 'Ama', student_email: 'ama@test.com', payment_ref: '' }
    ],
    programs: [{ id: 9, price: 250, title: 'Systems Thinking' }],
    subscriptions: [
      { tx_ref: 'tier_abc', amount: 99, email: 'ama@test.com', name: 'Ama', tier: 'scholar', status: 'pending' }
    ],
    book_purchases: [
      { tx_ref: 'books_xyz', amount: 300, email: 'ama@test.com', name: 'Ama', status: 'pending', books: 'premium-bundle' }
    ],
    store_orders: [
      { tx_ref: 'store_123', amount: 120, delivery_fee: 20, customer_email: 'ama@test.com', customer_name: 'Ama', status: 'pending', item_name: 'Nation Builder Tee', item_variant: 'M' }
    ],
    users: [{ id: 5, name: 'Ama', email: 'ama@test.com', membership_tier: 'free' }]
  });
}

describe('crypto create (purpose-aware)', function () {
  var realFetch;
  beforeEach(function () { realFetch = globalThis.fetch; });
  afterEach(function () { globalThis.fetch = realFetch; });

  it('creates a course invoice from the enrollment record, ignoring client amount', async function () {
    globalThis.fetch = async function (url, opts) {
      expect(String(url)).toBe('https://api.nowpayments.io/v1/invoice');
      var b = JSON.parse(opts.body);
      expect(b.price_amount).toBe(16.67); // 250 GHS / 15 rate
      return jsonOk({ invoice_url: 'https://nowpayments.io/abc' });
    };
    var db = baseDb();
    var ctx = post('http://localhost/api/gateways/crypto/create',
      { purpose: 'course', enrollment_token: 'ga_enroll1', amount: 1 },
      { DB: db, NOWPAYMENTS_API_KEY: 'np-key', GHS_USD_RATE: '15.0' });
    var data = await (await cryptoCreate(ctx)).json();
    expect(data.status).toBe('ok');
    expect(data.mode).toBe('invoice');
    expect(data.purpose).toBe('course');
    expect(data.amount_ghs).toBe(250);
    expect(data.success_url).toContain('/dashboard/?token=ga_enroll1');
    var row = db._tables.donations[0];
    expect(JSON.parse(row.metadata).purpose).toBe('course');
    expect(JSON.parse(row.metadata).enrollment_id).toBe(11);
  });

  it('rejects unknown enrollments and completed tiers', async function () {
    var db = baseDb();
    var r1 = await (await cryptoCreate(post('http://localhost/api/gateways/crypto/create',
      { purpose: 'course', enrollment_token: 'nope' }, { DB: db }))).json();
    expect(r1.status).toBe('error');
    db._tables.subscriptions[0].status = 'active';
    var r2 = await (await cryptoCreate(post('http://localhost/api/gateways/crypto/create',
      { purpose: 'tier', tx_ref: 'tier_abc' }, { DB: db }))).json();
    expect(r2.status).toBe('ok');
    expect(r2.already).toBe(true);
  });

  it('returns manual EVM/Solana addresses when NOWPayments is absent', async function () {
    var db = baseDb();
    var ctx = post('http://localhost/api/gateways/crypto/create',
      { purpose: 'tier', tx_ref: 'tier_abc' },
      { DB: db, GHS_USD_RATE: '15.0', CRYPTO_EVM_ADDRESS: '0xabc', CRYPTO_SOL_ADDRESS: 'sol1' });
    var data = await (await cryptoCreate(ctx)).json();
    expect(data.status).toBe('ok');
    expect(data.mode).toBe('manual');
    expect(data.purpose).toBe('tier');
    expect(data.amount_ghs).toBe(99);
    expect(data.addresses.evm).toBe('0xabc');
    expect(data.addresses.sol).toBe('sol1');
    expect(data.success_url).toContain('/member/?success=scholar');
  });

  it('creates merch invoices including the delivery fee', async function () {
    globalThis.fetch = async function () { return jsonOk({ invoice_url: 'https://nowpayments.io/m' }); };
    var db = baseDb();
    var ctx = post('http://localhost/api/gateways/crypto/create',
      { purpose: 'merch', tx_ref: 'store_123' },
      { DB: db, NOWPAYMENTS_API_KEY: 'np-key', GHS_USD_RATE: '15.0' });
    var data = await (await cryptoCreate(ctx)).json();
    expect(data.status).toBe('ok');
    expect(data.amount_ghs).toBe(140);
    expect(data.success_url).toContain('/merch/?order=store_123');
  });
});

describe('crypto guitar unlocks', function () {
  var realFetch;
  beforeEach(function () { realFetch = globalThis.fetch; });
  afterEach(function () { globalThis.fetch = realFetch; });

  function guitarDb() {
    return mockDb({
      donations: [],
      guitar_payments: [],
      users: [{ id: 5, name: 'Ama', email: 'ama@test.com' }],
      sessions: [{ user_id: 5, token: 'sess-abc', expires_at: '2099-01-01', email: 'ama@test.com', name: 'Ama' }],
      settings: []
    });
  }

  it('requires login for guitar purpose', async function () {
    var db = guitarDb();
    var r = await (await cryptoCreate(post('http://localhost/api/gateways/crypto/create',
      { purpose: 'guitar' }, { DB: db }))).json();
    expect(r.status).toBe('error');
    var r2 = await (await cryptoCreate(post('http://localhost/api/gateways/crypto/create',
      { purpose: 'guitar', token: 'bad-token' }, { DB: db }))).json();
    expect(r2.status).toBe('error');
  });

  it('creates a guitar invoice at the standard price with a pending payment row', async function () {
    globalThis.fetch = async function () { return jsonOk({ invoice_url: 'https://nowpayments.io/g' }); };
    var db = guitarDb();
    var ctx = post('http://localhost/api/gateways/crypto/create',
      { purpose: 'guitar', token: 'sess-abc' },
      { DB: db, NOWPAYMENTS_API_KEY: 'np-key', GHS_USD_RATE: '15.0' });
    var data = await (await cryptoCreate(ctx)).json();
    expect(data.status).toBe('ok');
    expect(data.purpose).toBe('guitar');
    expect(data.amount_ghs).toBe(99);
    expect(data.success_url).toContain('/guitar/learn/');
    expect(db._tables.guitar_payments.length).toBe(1);
    expect(db._tables.guitar_payments[0].status).toBe('pending');
  });

  it('reports already-unlocked for paid guitar users', async function () {
    var db = guitarDb();
    db._tables.guitar_payments.push({ id: 1, user_id: 5, status: 'completed' });
    var r = await (await cryptoCreate(post('http://localhost/api/gateways/crypto/create',
      { purpose: 'guitar', token: 'sess-abc' }, { DB: db }))).json();
    expect(r.status).toBe('ok');
    expect(r.already).toBe(true);
  });

  it('webhook completes the guitar unlock', async function () {
    var db = guitarDb();
    db._tables.guitar_payments.push({ id: 1, user_id: 5, status: 'pending', flw_tx_ref: 'crypto_g1' });
    db._tables.donations.push({
      id: 1, tx_ref: 'crypto_g1', amount: 99, currency: 'GHS',
      donor_name: 'Ama', donor_email: 'ama@test.com', donor_phone: '',
      status: 'pending', provider: 'crypto',
      metadata: JSON.stringify({ purpose: 'guitar', user_id: 5 })
    });
    var ctx = await signedWebhook('{"order_id":"crypto_g1","payment_status":"finished","payment_id":"np-9"}', db);
    var data = await (await cryptoWebhook(ctx)).json();
    expect(data.status).toBe('ok');
    expect(db._tables.guitar_payments[0].status).toBe('completed');
    expect(db._tables.donations[0].status).toBe('successful');
  });
});

describe('crypto webhook routing', function () {
  it('activates a course enrollment on settlement', async function () {
    var db = baseDb();
    db._tables.donations.push({
      id: 1, tx_ref: 'crypto_c1', amount: 250, currency: 'GHS',
      donor_name: 'Ama', donor_email: 'ama@test.com', donor_phone: '',
      status: 'pending', provider: 'crypto',
      metadata: JSON.stringify({ purpose: 'course', enrollment_id: 11 })
    });
    var ctx = await signedWebhook('{"order_id":"crypto_c1","payment_status":"finished","payment_id":"np-1"}', db);
    var data = await (await cryptoWebhook(ctx)).json();
    expect(data.status).toBe('ok');
    expect(db._tables.enrollments[0].status).toBe('active');
    expect(db._tables.donations[0].status).toBe('successful');
  });

  it('ignores unsettled IPN events', async function () {
    var db = baseDb();
    var ctx = await signedWebhook('{"order_id":"crypto_c1","payment_status":"waiting"}', db);
    var data = await (await cryptoWebhook(ctx)).json();
    expect(data.status).toBe('ok');
  });
});

describe('crypto verify (on-chain)', function () {
  var realFetch;
  beforeEach(function () { realFetch = globalThis.fetch; });
  afterEach(function () { globalThis.fetch = realFetch; });

  function btcFetch(outputs) {
    return async function (url) {
      var u = String(url);
      if (u.indexOf('coingecko') >= 0) return jsonOk({ bitcoin: { usd: 100000 } });
      if (u.indexOf('blockchair') >= 0) {
        return jsonOk({ data: { hash1: { transaction: { block_id: 800000 }, outputs: outputs } } });
      }
      throw new Error('unexpected ' + u);
    };
  }

  function verifyDb() {
    return mockDb({
      donations: [{
        id: 1, tx_ref: 'crypto_v1', amount: 150, currency: 'GHS',
        donor_name: 'Ama', donor_email: 'ama@test.com', donor_phone: '',
        status: 'pending', provider: 'crypto', metadata: JSON.stringify({ purpose: 'donation' })
      }]
    });
  }

  it('confirms a covering BTC payment and finalizes', async function () {
    globalThis.fetch = btcFetch([{ recipient: 'bc1qours', value: 10000 }]);
    var db = verifyDb();
    var ctx = post('http://localhost/api/gateways/crypto/verify',
      { tx_ref: 'crypto_v1', chain: 'bitcoin', tx_hash: 'hash1' },
      { DB: db, CRYPTO_BTC_ADDRESS: 'bc1qours', GHS_USD_RATE: '15.0' });
    var res = await cryptoVerify(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.asset).toBe('BTC');
    expect(db._tables.donations[0].status).toBe('successful');
  });

  it('rejects wrong-recipient and underpaid transactions', async function () {
    globalThis.fetch = btcFetch([{ recipient: 'bc1qstranger', value: 50000 }]);
    var db = verifyDb();
    var ctx = post('http://localhost/api/gateways/crypto/verify',
      { tx_ref: 'crypto_v1', chain: 'bitcoin', tx_hash: 'hash1' },
      { DB: db, CRYPTO_BTC_ADDRESS: 'bc1qours', GHS_USD_RATE: '15.0' });
    var res = await cryptoVerify(ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('RECIPIENT_MISMATCH');

    globalThis.fetch = btcFetch([{ recipient: 'bc1qours', value: 100 }]);
    var db2 = verifyDb();
    var ctx2 = post('http://localhost/api/gateways/crypto/verify',
      { tx_ref: 'crypto_v1', chain: 'bitcoin', tx_hash: 'hash1' },
      { DB: db2, CRYPTO_BTC_ADDRESS: 'bc1qours', GHS_USD_RATE: '15.0' });
    expect((await (await cryptoVerify(ctx2)).json()).code).toBe('UNDERPAID');
  });

  it('rejects unknown chains and unconfigured addresses', async function () {
    var db = verifyDb();
    var ctx = post('http://localhost/api/gateways/crypto/verify',
      { tx_ref: 'crypto_v1', chain: 'dogecoin', tx_hash: 'h' }, { DB: db });
    expect((await (await cryptoVerify(ctx)).json()).code).toBe('UNKNOWN_CHAIN');

    var ctx2 = post('http://localhost/api/gateways/crypto/verify',
      { tx_ref: 'crypto_v1', chain: 'solana', tx_hash: 'h' }, { DB: db });
    expect((await (await cryptoVerify(ctx2)).json()).code).toBe('NO_ADDRESS_CONFIGURED');
  });
});
