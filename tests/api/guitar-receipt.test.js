import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as payverify } from '../../functions/api/guitar/payverify.js';
import { onRequest as paywebhook } from '../../functions/api/guitar/paywebhook.js';
import { onRequest as flwGuitarWebhook } from '../../functions/api/guitar/enroll/webhook.js';

function post(url, body, env, headers) {
  return buildContext(url, {
    method: 'POST',
    env: env,
    request: new Request(url, { method: 'POST', headers: headers || {}, body: JSON.stringify(body) })
  });
}

function rawPost(url, raw, env, headers) {
  return buildContext(url, {
    method: 'POST',
    env: env,
    request: new Request(url, { method: 'POST', headers: headers || {}, body: raw })
  });
}

describe('guitar receipts (phase 3)', function () {
  var realFetch;
  var brevoCalls;
  beforeEach(function () {
    realFetch = globalThis.fetch;
    brevoCalls = [];
  });
  afterEach(function () { globalThis.fetch = realFetch; });

  function paystackOk() {
    globalThis.fetch = async function (url) {
      var u = String(url);
      if (u.indexOf('api.paystack.co') >= 0) {
        return new Response(JSON.stringify({ status: true, data: { status: 'success', reference: 'GUITAR_x1', amount: 9900, customer: { email: 'g@t.co' } } }), { status: 200 });
      }
      if (u.indexOf('api.brevo.com') >= 0) {
        brevoCalls.push(u);
        return new Response(JSON.stringify({ messageId: 'm1' }), { status: 200 });
      }
      throw new Error('unexpected ' + u);
    };
  }

  function guitarDb() {
    return mockDb({
      guitar_payments: [{ id: 1, user_id: 7, email: 'g@t.co', status: 'pending', flw_tx_ref: 'GUITAR_x1', amount: 99 }],
      guitar_user_stats: [],
      users: [{ id: 7, name: 'Gina', email: 'g@t.co', phone: '+233551234567' }],
      email_queue: [],
      whatsapp_queue: []
    });
  }

  it('payverify unlocks and emails a receipt', async function () {
    paystackOk();
    var db = guitarDb();
    var res = await payverify(post('http://localhost/api/guitar/payverify', { reference: 'GUITAR_x1' }, { DB: db, PAYSTACK_SECRET_KEY: 'psk', BREVO_API_KEY: 'brevo-key' }));
    expect(res.status).toBe(200);
    expect(db._tables.guitar_payments[0].status).toBe('completed');
    expect(brevoCalls.length).toBe(1);
    expect(db._tables.email_queue.filter(function (r) { return r.email_type === 'guitar_nudge_3d'; })).toHaveLength(1);
    expect(db._tables.whatsapp_queue).toHaveLength(1);
  });

  it('paywebhook unlocks and emails a receipt', async function () {
    paystackOk();
    var raw = '{"event":"charge.success","data":{"reference":"GUITAR_x1","amount":9900,"customer":{"email":"g@t.co"}}}';
    var key = await crypto.subtle.importKey('raw', new TextEncoder().encode('psk'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
    var hex = Array.from(new Uint8Array(sig)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    var db = guitarDb();
    var res = await paywebhook(rawPost('http://localhost/api/guitar/paywebhook', raw, { DB: db, PAYSTACK_SECRET_KEY: 'psk', BREVO_API_KEY: 'brevo-key' }, { 'x-paystack-signature': hex }));
    expect(res.status).toBe(200);
    expect(db._tables.guitar_payments[0].status).toBe('completed');
    expect(brevoCalls.length).toBe(1);
  });

  it('flutterwave guitar webhook verifies, unlocks, and emails', async function () {
    globalThis.fetch = async function (url) {
      var u = String(url);
      if (u.indexOf('api.flutterwave.com') >= 0) {
        return new Response(JSON.stringify({ status: 'success', data: { status: 'successful', tx_ref: 'GUITAR_x1', amount: 99, currency: 'GHS' } }), { status: 200 });
      }
      if (u.indexOf('api.brevo.com') >= 0) {
        brevoCalls.push(u);
        return new Response(JSON.stringify({ messageId: 'm1' }), { status: 200 });
      }
      throw new Error('unexpected ' + u);
    };
    var db = guitarDb();
    var body = { event: 'charge.completed', data: { id: 4242, tx_ref: 'GUITAR_x1', amount: 99, currency: 'GHS', customer: { email: 'g@t.co' } } };
    var res = await flwGuitarWebhook(post('http://localhost/api/guitar/enroll/webhook', body, { DB: db, FLW_SECRET_HASH: 'h', FLW_SECRET_KEY: 'k', BREVO_API_KEY: 'brevo-key' }, { 'verif-hash': 'h' }));
    expect(res.status).toBe(200);
    expect(db._tables.guitar_payments[0].status).toBe('completed');
    expect(brevoCalls.length).toBe(1);
  });
});
