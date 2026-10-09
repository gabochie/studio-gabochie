import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as expCallback } from '../../functions/api/gateways/expresspay/callback.js';

function expEnv(db) {
  return { DB: db, EXPRESSPAY_MERCHANT_ID: 'mid', EXPRESSPAY_API_KEY: 'key', BREVO_API_KEY: 'brevo-key' };
}

function guitarDb() {
  return mockDb({
    donations: [],
    guitar_payments: [{ id: 1, user_id: 7, email: 'g@t.co', status: 'pending', flw_tx_ref: 'GUITAR_x1', amount: 99 }],
    guitar_user_stats: [],
    users: [{ id: 7, name: 'Gina', email: 'g@t.co', phone: '+233551234567' }],
    email_queue: [],
    whatsapp_queue: [],
    expresspay_tokens: [{ tx_ref: 'GUITAR_x1', token: 'tok-g' }],
    invoices: []
  });
}

function callbackCtx(db, payload) {
  var url = 'http://localhost/api/gateways/expresspay/callback';
  return buildContext(url, {
    method: 'POST',
    env: expEnv(db),
    request: new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  });
}

describe('guitar receipts via expresspay (phase: migration)', function () {
  var realFetch;
  var brevoCalls;
  beforeEach(function () {
    realFetch = globalThis.fetch;
    brevoCalls = [];
  });
  afterEach(function () { globalThis.fetch = realFetch; });

  it('settles a GUITAR_ payment: unlocks, receipts, nudges, whatsapps', async function () {
    globalThis.fetch = async function (url) {
      var u = String(url);
      if (u.indexOf('/query.php') >= 0) {
        return new Response(JSON.stringify({ result: 1, 'result-text': 'Success', 'order-id': 'GUITAR_x1', token: 'tok-g', currency: 'GHS', amount: '99.00', 'transaction-id': 'EXP77' }), { status: 200 });
      }
      if (u.indexOf('api.brevo.com') >= 0) {
        brevoCalls.push(u);
        return new Response(JSON.stringify({ messageId: 'm1' }), { status: 200 });
      }
      throw new Error('unexpected ' + u);
    };
    var db = guitarDb();
    var res = await expCallback(callbackCtx(db, { 'order-id': 'GUITAR_x1', token: 'tok-g' }));
    expect(res.status).toBe(200);
    expect((await res.json()).settled).toBe(true);
    expect(db._tables.guitar_payments[0].status).toBe('completed');
    expect(brevoCalls.length).toBeGreaterThanOrEqual(1);
    expect(db._tables.email_queue.filter(function (r) { return r.email_type === 'guitar_nudge_3d'; })).toHaveLength(1);
    expect(db._tables.whatsapp_queue).toHaveLength(1);
  });

  it('does not unlock on amount mismatch', async function () {
    globalThis.fetch = async function (url) {
      var u = String(url);
      if (u.indexOf('/query.php') >= 0) {
        return new Response(JSON.stringify({ result: 1, 'order-id': 'GUITAR_x1', token: 'tok-g', currency: 'GHS', amount: '1.00', 'transaction-id': 'EXP00' }), { status: 200 });
      }
      throw new Error('unexpected ' + u);
    };
    var db = guitarDb();
    var res = await expCallback(callbackCtx(db, { 'order-id': 'GUITAR_x1', token: 'tok-g' }));
    expect(res.status).toBe(402);
    expect(db._tables.guitar_payments[0].status).toBe('pending');
  });
});
