import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';
import { onRequest as ghipssCreate } from '../../functions/api/gateways/ghipss/create.js';
import { onRequest as moolreCallback } from '../../functions/api/gateways/moolre/callback.js';

function post(url, body, env) {
  return buildContext(url, {
    method: 'POST',
    env: env,
    request: new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.51' },
      body: JSON.stringify(body)
    })
  });
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

var baseEnv = { MOOLRE_API_USER: 'user', MOOLRE_PUBLIC_KEY: 'pub', MOOLRE_ACCOUNT_NUMBER: '12345', MOOLRE_BASE_URL: 'https://api.moolre.com' };

describe('GhIPSS Instant Pay gateway (Moolre Bank Collections)', function () {
  var realFetch;
  beforeEach(function () {
    realFetch = globalThis.fetch;
  });
  afterEach(function () {
    globalThis.fetch = realFetch;
  });

  it('creates a virtual bank account and records pending donation', async function () {
    globalThis.fetch = async function (url, opts) {
      expect(String(url)).toBe('https://api.moolre.com/open/account/create');
      var body = JSON.parse(opts.body);
      expect(body.type).toBe(9);
      expect(body.currency).toBe('GHS');
      expect(body.firstname).toBe('Ana');
      expect(body.lastname).toBe('Mensah');
      expect(body.email).toBe('ana@test.com');
      expect(body.phone).toBe('+233501234567');
      expect(body.accountnumber).toBe('12345');
      expect(body.externalref).toMatch(/^ghipss_/);
      return jsonOk({ status: 1, code: 'AD19', message: 'Account No. Creation Successful', data: { accountno: '0014730001001', accountname: 'Ana Mensah MoolrePay', bankname: 'First Atlantic Bank', externalref: body.externalref }, go: null });
    };
    var db = mockDb({ donations: [] });
    var ctx = post('http://localhost/api/gateways/ghipss/create', { amount: 100, name: 'Ana Mensah', email: 'ana@test.com', phone: '+233501234567' }, Object.assign({ DB: db }, baseEnv));
    var res = await ghipssCreate(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.accountno).toBe('0014730001001');
    expect(data.bank_name).toBe('First Atlantic Bank');
    expect(data.accountname).toBe('Ana Mensah MoolrePay');
    expect(data.tx_ref).toMatch(/^ghipss_/);
    expect(db._tables.donations).toHaveLength(1);
    expect(db._tables.donations[0].status).toBe('pending');
    expect(db._tables.donations[0].provider).toBe('ghipss');
    expect(db._tables.donations[0].flw_id).toBe('0014730001001');
  });

  it('requires a phone number (Moolre account holder field)', async function () {
    var db = mockDb({ donations: [] });
    var ctx = post('http://localhost/api/gateways/ghipss/create', { amount: 50, name: 'Ana', email: 'ana@test.com' }, Object.assign({ DB: db }, baseEnv));
    var res = await ghipssCreate(ctx);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toMatch(/phone/i);
    expect(db._tables.donations).toHaveLength(0);
  });

  it('returns 502 when account creation fails', async function () {
    globalThis.fetch = async function () {
      return jsonOk({ status: 0, code: 'AD32', message: 'Account No. Creation Failed', data: 'all', go: null });
    };
    var ctx = post('http://localhost/api/gateways/ghipss/create', { amount: 50, name: 'Ana', email: 'ana@test.com', phone: '+233501234567' }, baseEnv);
    var res = await ghipssCreate(ctx);
    expect(res.status).toBe(502);
  });

  it('returns 502 when Moolre is unreachable', async function () {
    globalThis.fetch = async function () {
      throw new Error('network down');
    };
    var ctx = post('http://localhost/api/gateways/ghipss/create', { amount: 50, name: 'Ana', email: 'ana@test.com', phone: '+233501234567' }, baseEnv);
    var res = await ghipssCreate(ctx);
    expect(res.status).toBe(502);
  });

  it('verifies and finalizes a pending ghipss donation via the Moolre callback', async function () {
    globalThis.fetch = async function (url, opts) {
      if (String(url).indexOf('/open/transact/status') >= 0) {
        var b = JSON.parse(opts.body);
        if (b.idtype === 1) {
          return jsonOk({ status: 1, code: 'SS01', message: 'ok', data: { txstatus: 1, amount: '100', transactionid: 'TXN-GIP-1', externalref: b.id }, go: null });
        }
      }
      return jsonOk({ status: 0, data: {} });
    };
    var db = mockDb({ donations: [], invoices: [] });
    db._tables.donations.push({ id: 1, tx_ref: 'ghipss_abc', amount: 100, currency: 'GHS', donor_name: 'Ana', donor_email: 'ana@test.com', donor_phone: '+233501234567', status: 'pending', provider: 'ghipss', flw_id: '0014730001001', created_at: '2026-01-01' });
    var ctx = post('http://localhost/api/gateways/moolre/callback', { status: 1, code: 'P01', message: 'Transaction Successful', data: { externalref: 'ghipss_abc' } }, Object.assign({ DB: db }, baseEnv));
    var res = await moolreCallback(ctx);
    expect(res.status).toBe(200);
    var updated = db._tables.donations.filter(function (r) { return r.tx_ref === 'ghipss_abc'; })[0];
    expect(updated.status).toBe('successful');
    expect(String(updated.flw_id)).toContain('TXN-GIP-1');
  });

  it('resolves the amount server-side for product flows (tx_ref supplied)', async function () {
    globalThis.fetch = async function () {
      return jsonOk({ status: 1, code: 'AD19', message: 'ok', data: { accountno: '0099930001001', accountname: 'Valued Customer MoolrePay', bankname: 'First Atlantic Bank', externalref: 'tier_test1' }, go: null });
    };
    var db = mockDb({ donations: [], subscriptions: [] });
    db._tables.subscriptions.push({ id: 1, tx_ref: 'tier_test1', amount: 30, currency: 'GHS', name: 'Ana', email: 'ana@test.com', tier: 'supporter', status: 'pending', created_at: '2026-01-01' });
    var ctx = post('http://localhost/api/gateways/ghipss/create', { tx_ref: 'tier_test1', name: 'Ana', email: 'ana@test.com', phone: '+233501234567' }, Object.assign({ DB: db }, baseEnv));
    var res = await ghipssCreate(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.tx_ref).toBe('tier_test1');
    // No donation row staged for product flows.
    expect(db._tables.donations).toHaveLength(0);
  });
});
