import { describe, it, expect } from 'vitest';
import { mockDb } from '../helpers/mock-cf.js';
import { onRequest as momoCreate } from '../../functions/api/gateways/momo/create.js';
import { onRequest as bankCreate } from '../../functions/api/gateways/bank/create.js';
import { onRequest as momoClaim } from '../../functions/api/gateways/momo/claim.js';
import { onRequest as momoClaimsAdmin } from '../../functions/api/admin/momo-claims.js';

/* ─── Helpers ─── */

function makeReq(url, opts) {
  opts = opts || {};
  var headers = Object.assign({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' }, opts.headers || {});
  var init = { method: opts.method || 'POST', headers: headers };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  return new Request(url, init);
}

function env(opts) {
  opts = opts || {};
  var db = mockDb({
    donations: opts.donations || [],
    book_purchases: opts.books || [],
    momo_manual_claims: opts.claims || [],
    events: []
  });
  return {
    DB: opts.db || db,
    MOMO_MANUAL_NUMBER: '0244000000',
    MOMO_MANUAL_NAME: 'Studio Gabochie',
    BANK_MANUAL_ACCOUNT_NUMBER: opts.bankNumber !== undefined ? opts.bankNumber : '1234567890123',
    BANK_MANUAL_BANK: 'GCB Bank',
    ADMIN_API_KEY: 'test-admin-key'
  };
}

/* ─── Create ─── */

describe('momo manual create', function () {
  it('rejects GET with 405', async function () {
    const res = await momoCreate({ request: makeReq('https://x.com/api/gateways/momo/create', { method: 'GET' }), env: env() });
    expect(res.status).toBe(405);
  });

  it('answers manual_unconfigured when MOMO_MANUAL_NUMBER is missing', async function () {
    const res = await momoCreate({
      request: makeReq('https://x.com/api/gateways/momo/create', { body: { amount: 10, email: 'a@b.com' } }),
      env: { DB: env().DB, BANK_MANUAL_ACCOUNT_NUMBER: '1', MOMO_MANUAL_NUMBER: '' }
    });
    const body = await res.json();
    expect(body.code).toBe('manual_unconfigured');
  });

  it('stages an open donation and returns the number + reference', async function () {
    const res = await momoCreate({
      request: makeReq('https://x.com/api/gateways/momo/create', { body: { amount: 25, name: 'Kwame', email: 'kwame@x.com', phone: '0244000001' } }),
      env: env()
    });
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.status).toBe('ok');
    expect(d.tx_ref.indexOf('momom_')).toBe(0);
    expect(d.destination).toBe('0244000000');
    expect(d.destination_label).toBe('MoMo number');
    expect(d.account_name).toBe('Studio Gabochie');
    expect(d.rail).toBe('momo');
    expect(d.amount).toBe(25);
  });

  it('rejects an open donation without a valid email', async function () {
    const res = await momoCreate({
      request: makeReq('https://x.com/api/gateways/momo/create', { body: { amount: 25, email: 'nope' } }),
      env: env()
    });
    expect(res.status).toBe(400);
  });

  it('resolves product tx_ref server-side (book purchase, amount never trusted from client)', async function () {
    const db = mockDb({
      donations: [],
      book_purchases: [{ tx_ref: 'books_abc', amount: 300, email: 'buy@x.com', name: 'Ama', status: 'pending' }],
      momo_manual_claims: [],
      events: []
    });
    const res = await momoCreate({
      request: makeReq('https://x.com/api/gateways/momo/create', { body: { tx_ref: 'books_abc', email: 'attacker@x.com', amount: 1 } }),
      env: env({ db: db })
    });
    const d = await res.json();
    expect(d.status).toBe('ok');
    expect(d.amount).toBe(300); // server-side amount, not the client's 1
    expect(d.tx_ref).toBe('books_abc');
  });

  it('404s an unknown or already-settled tx_ref', async function () {
    const res = await momoCreate({
      request: makeReq('https://x.com/api/gateways/momo/create', { body: { tx_ref: 'books_nope' } }),
      env: env()
    });
    expect(res.status).toBe(404);
  });
});

/* ─── Bank rail ─── */

describe('momo manual create (bank rail)', function () {
  it('answers manual_unconfigured when the bank secrets are missing', async function () {
    const res = await bankCreate({
      request: makeReq('https://x.com/api/gateways/bank/create', { body: { amount: 10, email: 'a@b.com' } }),
      env: { DB: env().DB, MOMO_MANUAL_NUMBER: '1', BANK_MANUAL_ACCOUNT_NUMBER: '' }
    });
    const body = await res.json();
    expect(body.code).toBe('manual_unconfigured');
  });

  it('stages an open donation with a bankm_ reference and bank details', async function () {
    const res = await bankCreate({
      request: makeReq('https://x.com/api/gateways/bank/create', { body: { amount: 300, name: 'Ama', email: 'ama@x.com' } }),
      env: env()
    });
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.status).toBe('ok');
    expect(d.tx_ref.indexOf('bankm_')).toBe(0);
    expect(d.destination).toBe('1234567890123');
    expect(d.destination_label).toBe('Account number');
    expect(d.network).toBe('GCB Bank');
    expect(d.rail).toBe('bank');
  });

  it('resolves product tx_ref server-side on the bank rail too', async function () {
    const res = await bankCreate({
      request: makeReq('https://x.com/api/gateways/bank/create', { body: { tx_ref: 'books_abc', email: 'attacker@x.com', amount: 1 } }),
      env: env({
        books: [{ tx_ref: 'books_abc', amount: 300, email: 'buy@x.com', name: 'Ama', status: 'pending' }]
      })
    });
    const d = await res.json();
    expect(d.status).toBe('ok');
    expect(d.amount).toBe(300);
  });
});

/* ─── Claim ─── */

describe('momo manual claim', function () {
  it('rejects a junk transaction ID', async function () {
    const res = await momoClaim({
      request: makeReq('https://x.com/api/gateways/momo/claim', { body: { tx_ref: 'momom_abc', momo_txn_id: 'x' } }),
      env: env()
    });
    expect(res.status).toBe(400);
    const d = await res.json();
    expect(d.message).toContain('transaction ID');
  });

  it('rejects a foreign tx_ref prefix', async function () {
    const res = await momoClaim({
      request: makeReq('https://x.com/api/gateways/momo/claim', { body: { tx_ref: 'evil_hack', momo_txn_id: '1234567890' } }),
      env: env()
    });
    expect(res.status).toBe(400);
  });

  it('records a valid claim', async function () {
    const res = await momoClaim({
      request: makeReq('https://x.com/api/gateways/momo/claim', { body: { tx_ref: 'momom_abc', momo_txn_id: '1234567890', payer_number: '0244000001' } }),
      env: env()
    });
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.status).toBe('ok');
    expect(d.message).toContain('confirming');
  });
});

/* ─── Admin confirm / reject ─── */

describe('momo manual admin', function () {
  it('blocks unauthenticated access', async function () {
    const res = await momoClaimsAdmin({ request: makeReq('https://x.com/api/admin/momo-claims', { method: 'GET' }), env: env() });
    expect(res.status).toBe(403);
  });

  it('lists claims for an authorized admin', async function () {
    const res = await momoClaimsAdmin({
      request: makeReq('https://x.com/api/admin/momo-claims', { method: 'GET', headers: { 'X-Admin-Key': 'test-admin-key' } }),
      env: env({ claims: [{ id: 1, tx_ref: 'momom_abc', momo_txn_id: '1234567890', status: 'submitted' }] })
    });
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.items.length).toBe(1);
    expect(d.items[0].tx_ref).toBe('momom_abc');
  });

  it('rejects a claim', async function () {
    const res = await momoClaimsAdmin({
      request: makeReq('https://x.com/api/admin/momo-claims', { body: { tx_ref: 'momom_abc', action: 'reject' }, headers: { 'X-Admin-Key': 'test-admin-key' } }),
      env: env({ claims: [{ id: 1, tx_ref: 'momom_abc', momo_txn_id: '1234567890', status: 'submitted' }] })
    });
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.action).toBe('rejected');
  });

  it('refuses to decide a claim twice', async function () {
    const res = await momoClaimsAdmin({
      request: makeReq('https://x.com/api/admin/momo-claims', { body: { tx_ref: 'momom_abc', action: 'confirm' }, headers: { 'X-Admin-Key': 'test-admin-key' } }),
      env: env({ claims: [{ id: 1, tx_ref: 'momom_abc', momo_txn_id: '1234567890', status: 'confirmed' }] })
    });
    expect(res.status).toBe(409);
  });

  it('confirms a pending donation claim through the shared settlement', async function () {
    const res = await momoClaimsAdmin({
      request: makeReq('https://x.com/api/admin/momo-claims', { body: { tx_ref: 'momom_abc', action: 'confirm' }, headers: { 'X-Admin-Key': 'test-admin-key' } }),
      env: env({
        claims: [{ id: 1, tx_ref: 'momom_abc', momo_txn_id: '1234567890', status: 'submitted' }],
        donations: [{ tx_ref: 'momom_abc', amount: 25, currency: 'GHS', donor_name: 'Kwame', donor_email: 'kwame@x.com', donor_phone: '0244000001', status: 'pending', provider: 'momo_manual' }]
      })
    });
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.status).toBe('ok');
    expect(d.action).toBe('confirmed');
    expect(d.purpose).toBe('donation');
  });

  it('rejects a missing or invalid action', async function () {
    const res = await momoClaimsAdmin({
      request: makeReq('https://x.com/api/admin/momo-claims', { body: { tx_ref: 'momom_abc' }, headers: { 'X-Admin-Key': 'test-admin-key' } }),
      env: env()
    });
    expect(res.status).toBe(400);
  });
});
