import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as tiersIndex } from '../../functions/api/tiers/index.js';
import { onRequest as tiersSubscribe } from '../../functions/api/tiers/subscribe.js';

var TIERS = [
  { slug: 'free', name: 'Free', monthly_price_ghs: 0, yearly_price_ghs: 0, features: '[]', badge: '', sort_order: 0, flw_plan_id: '' },
  { slug: 'supporter', name: 'Supporter', monthly_price_ghs: 50, yearly_price_ghs: 500, features: '[]', badge: '', sort_order: 1, flw_plan_id: '' },
  { slug: 'scholar', name: 'Scholar', monthly_price_ghs: 99, yearly_price_ghs: 990, features: '[]', badge: 'Most Popular', sort_order: 2, flw_plan_id: '' },
  { slug: 'patron', name: 'Patron', monthly_price_ghs: 299, yearly_price_ghs: 2990, features: '[]', badge: '', sort_order: 3, flw_plan_id: '' },
  { slug: 'founding', name: 'Founding Partner', monthly_price_ghs: 0, yearly_price_ghs: 5000, features: '[]', badge: 'Flagship', sort_order: 4, flw_plan_id: '' },
];

function getCtx(envExtra) {
  return buildContext('http://localhost/api/tiers', {
    env: Object.assign({ DB: mockDb({ unified_tiers: TIERS, subscriptions: [] }) }, envExtra),
  });
}

function postSubscribe(ctx, body) {
  ctx.request = new Request('http://localhost/api/tiers/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return tiersSubscribe(ctx);
}

describe('GET /api/tiers billing flags', function () {
  it('marks supporter recurring and scholar/patron one-time by default', async function () {
    var ctx = getCtx();
    ctx.request = new Request('http://localhost/api/tiers', { method: 'GET' });
    var res = await tiersIndex(ctx);
    expect(res.status).toBe(200);
    var body = await res.json();
    var bySlug = {};
    body.tiers.forEach(function (t) { bySlug[t.slug] = t; });
    expect(bySlug.supporter.monthly_recurring).toBe(true);
    expect(bySlug.supporter.yearly_recurring).toBe(true);
    expect(bySlug.scholar.monthly_recurring).toBe(false);
    expect(bySlug.patron.monthly_recurring).toBe(false);
    expect(bySlug.founding.yearly_recurring).toBe(true);
    expect(bySlug.free.monthly_recurring).toBe(false);
  });

  it('marks scholar recurring when its plan env var is set', async function () {
    var ctx = getCtx({ FLW_PLAN_SCHOLAR_MONTHLY: '170001' });
    ctx.request = new Request('http://localhost/api/tiers', { method: 'GET' });
    var body = await (await tiersIndex(ctx)).json();
    var bySlug = {};
    body.tiers.forEach(function (t) { bySlug[t.slug] = t; });
    expect(bySlug.scholar.monthly_recurring).toBe(true);
    expect(bySlug.scholar.yearly_recurring).toBe(false);
  });
});

describe('pre-migration DBs without flw_plan_id', function () {
  function legacyDb() {
    var inner = mockDb({ unified_tiers: TIERS, subscriptions: [] });
    var realPrepare = inner.prepare.bind(inner);
    inner.prepare = function (sql) {
      if (/FROM unified_tiers.*flw_plan_id|flw_plan_id.*FROM unified_tiers/.test(sql)) {
        return { bind: function () {
          return {
            first: async function () { throw new Error('no such column: flw_plan_id'); },
            all: async function () { throw new Error('no such column: flw_plan_id'); },
          };
        } };
      }
      return realPrepare(sql);
    };
    return inner;
  }

  it('GET /api/tiers degrades gracefully without the column', async function () {
    var ctx = buildContext('http://localhost/api/tiers', { env: { DB: legacyDb() } });
    ctx.request = new Request('http://localhost/api/tiers', { method: 'GET' });
    var res = await tiersIndex(ctx);
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
    var bySlug = {};
    body.tiers.forEach(function (t) { bySlug[t.slug] = t; });
    expect(bySlug.supporter.monthly_recurring).toBe(true);
    expect(bySlug.scholar.monthly_recurring).toBe(false);
  });

  it('POST /api/tiers/subscribe degrades gracefully without the column', async function () {
    var ctx = buildContext('http://localhost/api/tiers/subscribe', { env: { DB: legacyDb() } });
    ctx.request = new Request('http://localhost/api/tiers/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'supporter', email: 'a@x.com', interval: 'monthly' }),
    });
    var res = await tiersSubscribe(ctx);
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.is_recurring).toBe(true);
    expect(body.plan_id).toBe('160302');
  });
});

describe('POST /api/tiers/subscribe plan wiring', function () {
  it('supporter monthly uses the supporter plan and recurs', async function () {
    var body = await (await postSubscribe(getCtx(), { tier: 'supporter', email: 'a@x.com', interval: 'monthly' })).json();
    expect(body.status).toBe('ok');
    expect(body.is_recurring).toBe(true);
    expect(body.plan_id).toBe('160302');
    expect(body.amount).toBe(50);
  });

  it('supporter yearly keeps the legacy annual plan', async function () {
    var body = await (await postSubscribe(getCtx(), { tier: 'supporter', email: 'a@x.com', interval: 'yearly' })).json();
    expect(body.status).toBe('ok');
    expect(body.is_recurring).toBe(true);
    expect(body.plan_id).toBe('160303');
    expect(body.amount).toBe(500);
  });

  it('scholar is one-time until a plan is configured, then recurs', async function () {
    var plain = await (await postSubscribe(getCtx(), { tier: 'scholar', email: 'a@x.com', interval: 'monthly' })).json();
    expect(plain.status).toBe('ok');
    expect(plain.is_recurring).toBe(false);
    expect(plain.plan_id).toBe('');

    var wired = await (await postSubscribe(getCtx({ FLW_PLAN_SCHOLAR_MONTHLY: '170001' }), { tier: 'scholar', email: 'a@x.com', interval: 'monthly' })).json();
    expect(wired.status).toBe('ok');
    expect(wired.is_recurring).toBe(true);
    expect(wired.plan_id).toBe('170001');
  });

  it('founding resolves to the founding plan (yearly-only)', async function () {
    var body = await (await postSubscribe(getCtx(), { tier: 'founding', email: 'a@x.com', interval: 'monthly' })).json();
    expect(body.status).toBe('ok');
    expect(body.interval).toBe('yearly');
    expect(body.is_recurring).toBe(true);
    expect(body.plan_id).toBe('160304');
    expect(body.amount).toBe(5000);
  });
});
