import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';
import { onRequest as accessHandler } from '../../functions/api/year-package/access.js';
import { onRequest as contentHandler } from '../../functions/api/year-package/content.js';
import { onRequest as trialHandler } from '../../functions/api/year-package/trial.js';

var FUTURE = '2099-01-01 00:00:00';
var PAST = '2020-01-01 00:00:00';

function userSession(tier, expires) {
  return {
    token: 'tok-' + tier + '-' + expires,
    user_id: 7,
    expires_at: FUTURE,
    membership_tier: tier,
    membership_expires_at: expires
  };
}

function ctx(path, handler, tables, token, method, body) {
  var c = buildContext('http://localhost' + path, {
    env: { DB: mockDb(Object.assign({ resource_entitlements: [] }, tables)) }
  });
  var headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  c.request = new Request('http://localhost' + path, {
    method: method || 'GET',
    headers: headers,
    body: body
  });
  c._handler = handler;
  return c;
}

async function run(c) {
  return c._handler(c);
}

describe('/api/year-package — entitlement gate', function () {
  it('locks a request with no session', async function () {
    var res = await run(ctx('/api/year-package/access', accessHandler, {}, ''));
    var d = await res.json();
    expect(d.access).toBe('locked');
    expect(d.reason).toBe('no_session');
  });

  it('grants full access to an unexpired premium member', async function () {
    var s = userSession('premium', FUTURE);
    var res = await run(ctx('/api/year-package/access', accessHandler,
      { sessions: [s] }, s.token));
    var d = await res.json();
    expect(d.access).toBe('full');
  });

  it('locks an expired premium member', async function () {
    var s = userSession('premium', PAST);
    var res = await run(ctx('/api/year-package/access', accessHandler,
      { sessions: [s] }, s.token));
    var d = await res.json();
    expect(d.access).toBe('locked');
  });

  it('does not grant full access to supporter-tier members', async function () {
    var s = userSession('supporter', FUTURE);
    var res = await run(ctx('/api/year-package/access', accessHandler,
      { sessions: [s] }, s.token));
    var d = await res.json();
    expect(d.access).toBe('locked');
  });

  it('grants trial access while the entitlement is active', async function () {
    var s = userSession('free', '');
    var res = await run(ctx('/api/year-package/access', accessHandler, {
      sessions: [s],
      resource_entitlements: [{ user_id: 7, resource_slug: '2027-year-package',
                                access_until: FUTURE, source: 'trial' }]
    }, s.token));
    var d = await res.json();
    expect(d.access).toBe('trial');
    expect(d.trial_weeks).toEqual([1, 2]);
  });

  it('reports trial_expired once the 14 days have passed', async function () {
    var s = userSession('free', '');
    var res = await run(ctx('/api/year-package/access', accessHandler, {
      sessions: [s],
      resource_entitlements: [{ user_id: 7, resource_slug: '2027-year-package',
                                access_until: PAST, source: 'trial' }]
    }, s.token));
    var d = await res.json();
    expect(d.access).toBe('locked');
    expect(d.reason).toBe('trial_expired');
  });

  it('serves 52 weeks and all resources to a full member', async function () {
    var s = userSession('vip', FUTURE);
    var res = await run(ctx('/api/year-package/content', contentHandler,
      { sessions: [s] }, s.token));
    var d = await res.json();
    expect(d.weeks.length).toBe(52);
    expect(d.resources.length).toBeGreaterThan(10);
  });

  it('serves only Weeks 1–2 during the trial', async function () {
    var s = userSession('free', '');
    var res = await run(ctx('/api/year-package/content', contentHandler, {
      sessions: [s],
      resource_entitlements: [{ user_id: 7, resource_slug: '2027-year-package',
                                access_until: FUTURE, source: 'trial' }]
    }, s.token));
    var d = await res.json();
    expect(d.weeks.length).toBe(2);
    expect(d.weeks.map(function (w) { return w.n; })).toEqual([1, 2]);
    expect(d.resources.length).toBe(0);
  });

  it('refuses content to a locked member', async function () {
    var res = await run(ctx('/api/year-package/content', contentHandler, {}, ''));
    expect(res.status).toBe(403);
    var d = await res.json();
    expect(d.weeks.length).toBe(0);
  });

  it('requires a session to start a trial', async function () {
    var res = await run(ctx('/api/year-package/trial', trialHandler, {}, '',
      'POST', '{}'));
    expect(res.status).toBe(401);
  });

  it('does not let a used trial restart', async function () {
    var s = userSession('free', '');
    var res = await run(ctx('/api/year-package/trial', trialHandler, {
      sessions: [s],
      resource_entitlements: [{ user_id: 7, resource_slug: '2027-year-package',
                                access_until: PAST, source: 'trial' }]
    }, s.token, 'POST', '{}'));
    expect(res.status).toBe(409);
  });
});
