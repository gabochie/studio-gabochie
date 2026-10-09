import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb } from '../helpers/mock-cf.js';

import { settlePaidTx } from '../../functions/api/gateways/_settle.js';

describe('shared settlement (phase: expresspay migration)', function () {
  var realFetch;
  beforeEach(function () {
    realFetch = globalThis.fetch;
    globalThis.fetch = async function () { throw new Error('no network in test'); };
  });
  afterEach(function () { globalThis.fetch = realFetch; });

  function env(db) {
    return { DB: db };
  }

  it('completes pay-what-you-want bookpw_ purchases', async function () {
    var db = mockDb({
      donations: [],
      book_purchases: [
        { id: 1, tx_ref: 'bookpw_123', email: 'a@t.co', name: 'Ama', amount: 60, books: 'some-book', status: 'pending' }
      ],
      invoices: []
    });
    await settlePaidTx(env(db), db, {
      tx_ref: 'bookpw_123', amount: 60, currency: 'GHS', status: 'successful',
      event: 'charge.completed', name: 'Ama', email: 'a@t.co', phone: '',
      gateway: 'expresspay', gatewayTxId: 'EXP1', raw: {}
    });
    expect(db._tables.book_purchases[0].status).toBe('completed');
  });

  it('activates a tier subscription and membership', async function () {
    var db = mockDb({
      donations: [],
      subscriptions: [
        { id: 1, tx_ref: 'tier_abc', amount: 99, email: 'a@t.co', name: 'Ama', tier: 'scholar', status: 'pending' }
      ],
      users: [{ id: 5, name: 'Ama', email: 'a@t.co', membership_tier: 'free' }],
      invoices: []
    });
    await settlePaidTx(env(db), db, {
      tx_ref: 'tier_abc', amount: 99, currency: 'GHS', status: 'successful',
      event: 'charge.completed', name: 'Ama', email: 'a@t.co', phone: '',
      gateway: 'expresspay', gatewayTxId: 'EXP2', raw: {}
    });
    expect(db._tables.subscriptions[0].status).toBe('active');
    expect(db._tables.users[0].membership_tier).toBe('premium');
  });

  it('ignores non-completed events', async function () {
    var db = mockDb({
      donations: [],
      subscriptions: [
        { id: 1, tx_ref: 'tier_abc', amount: 99, email: 'a@t.co', name: 'Ama', tier: 'scholar', status: 'pending' }
      ]
    });
    await settlePaidTx(env(db), db, {
      tx_ref: 'tier_abc', amount: 99, currency: 'GHS', status: 'failed',
      event: 'charge.failed', name: 'Ama', email: 'a@t.co', phone: '',
      gateway: 'expresspay', gatewayTxId: 'EXP3', raw: {}
    });
    expect(db._tables.subscriptions[0].status).toBe('pending');
  });
});
