import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as flwWebhook } from '../../functions/api/payments/flutterwave.js';

function webhook(body, env) {
  var url = 'http://localhost/api/payments/flutterwave';
  return buildContext(url, {
    method: 'POST',
    env: env,
    request: new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'verif-hash': 'flw-hash' },
      body: JSON.stringify(body)
    })
  });
}

describe('flutterwave fulfillment (phase 1)', function () {
  var realFetch;
  beforeEach(function () { realFetch = globalThis.fetch; });
  afterEach(function () { globalThis.fetch = realFetch; });

  it('completes pay-what-you-want bookpw_ purchases', async function () {
    globalThis.fetch = async function () { throw new Error('no network in test'); };
    var db = mockDb({ book_purchases: [
      { id: 1, tx_ref: 'bookpw_123', email: 'a@t.co', name: 'Ama', amount: 60, books: 'some-book', status: 'pending' }
    ], invoices: [] });
    var ctx = webhook({
      event: 'charge.completed',
      data: { id: 999, tx_ref: 'bookpw_123', amount: 60, currency: 'GHS', status: 'successful', customer: { name: 'Ama', email: 'a@t.co' } }
    }, { DB: db, FLW_SECRET_HASH: 'flw-hash' });
    var res = await flwWebhook(ctx);
    expect(res.status).toBe(200);
    expect(db._tables.book_purchases[0].status).toBe('completed');
  });

  it('rejects unsigned webhook calls', async function () {
    var db = mockDb({ book_purchases: [] });
    var url = 'http://localhost/api/payments/flutterwave';
    var ctx = buildContext(url, {
      method: 'POST',
      env: { DB: db, FLW_SECRET_HASH: 'flw-hash' },
      request: new Request(url, { method: 'POST', body: '{}' })
    });
    var res = await flwWebhook(ctx);
    expect(res.status).toBe(401);
  });
});
