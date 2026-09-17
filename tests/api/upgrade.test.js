import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';
import { onRequest as upgrade } from '../../functions/api/enroll/upgrade.js';

function post(body, db) {
  return buildContext('http://localhost/api/enroll/upgrade', {
    method: 'POST',
    env: { DB: db, FLW_SECRET_KEY: 'flw-secret' },
    request: new Request('http://localhost/api/enroll/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok-123' },
      body: JSON.stringify(body || {})
    })
  });
}

function paidEnrollment() {
  return mockDb({
    enrollments: [
      { id: 1, program_id: 9, access_token: 'tok-123', status: 'sample', payment_ref: '', price: 250, full_content: '<p>all lessons</p>' }
    ]
  });
}

function freeEnrollment() {
  return mockDb({
    enrollments: [
      { id: 2, program_id: 5, access_token: 'tok-123', status: 'sample', payment_ref: '', price: 0, full_content: '<p>full content</p>' }
    ]
  });
}

function flwOk(txRef, amount) {
  globalThis.fetch = async function (url) {
    expect(String(url)).toContain('/v3/transactions/');
    return new Response(JSON.stringify({ status: 'success', data: { status: 'successful', tx_ref: txRef || 'upgrade_abc', amount: amount || 250, currency: 'GHS' } }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  };
}

describe('enroll upgrade', function () {
  var realFetch;
  beforeEach(function () { realFetch = globalThis.fetch; });
  afterEach(function () { globalThis.fetch = realFetch; });

  it('rejects upgrade without a payment reference for a paid program', async function () {
    var db = paidEnrollment();
    var res = await upgrade(post({}, db));
    expect(res.status).toBe(402);
    var data = await res.json();
    expect(data.code).toBe('MISSING_TX');
    expect(db._tables.enrollments[0].status).toBe('sample');
  });

  it('upgrades after Flutterwave verification succeeds', async function () {
    flwOk('upgrade_abc', 250);
    var db = paidEnrollment();
    var res = await upgrade(post({ tx_ref: 'upgrade_abc', transaction_id: 'txn-123' }, db));
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.full_content).toContain('all lessons');
    expect(db._tables.enrollments[0].status).toBe('active');
  });

  it('rejects a completed payment with a mismatched amount', async function () {
    flwOk('upgrade_abc', 80);
    var db = paidEnrollment();
    var res = await upgrade(post({ tx_ref: 'upgrade_abc', transaction_id: 'txn-222' }, db));
    expect(res.status).toBe(402);
    var data = await res.json();
    expect(data.code).toBe('AMOUNT_MISMATCH');
    expect(db._tables.enrollments[0].status).toBe('sample');
  });

  it('rejects a non-successful Flutterwave transaction', async function () {
    globalThis.fetch = async function () {
      return new Response(JSON.stringify({ status: 'success', data: { status: 'failed', tx_ref: 'upgrade_abc', amount: 250, currency: 'GHS' } }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    };
    var db = paidEnrollment();
    var res = await upgrade(post({ tx_ref: 'upgrade_abc', transaction_id: 'txn-333' }, db));
    expect(res.status).toBe(402);
    var data = await res.json();
    expect(data.code).toBe('PAYMENT_OPEN');
    expect(db._tables.enrollments[0].status).toBe('sample');
  });

  it('activates free programs without payment verification', async function () {
    var db = freeEnrollment();
    var res = await upgrade(post({}, db));
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(db._tables.enrollments[0].status).toBe('active');
  });

  it('returns already-upgraded for active enrollments', async function () {
    var db = mockDb({
      enrollments: [
        { id: 3, program_id: 9, access_token: 'tok-123', status: 'active', payment_ref: '', price: 250, full_content: '' }
      ]
    });
    var res = await upgrade(post({}, db));
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.message).toBe('Already upgraded');
  });
});