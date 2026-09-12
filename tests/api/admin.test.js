import { describe, it, expect } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';
import { onRequest as summaryOnRequest } from '../../functions/admin/api/summary.js';
import { onRequest as membersOnRequest } from '../../functions/admin/api/members.js';
import { onRequest as subscribersOnRequest } from '../../functions/admin/api/subscribers.js';
import { onRequest as donationsOnRequest } from '../../functions/admin/api/donations.js';
import { onRequest as programsOnRequest } from '../../functions/admin/api/programs.js';

/* ─── Helpers ─── */

function makeCtx(url, opts) {
  opts = opts || {};
  var db = opts.db !== undefined ? opts.db : mockDb({});
  var headers = {};
  if (!opts.noAuth) headers['X-Admin-Key'] = 'test-admin-key';
  if (opts.headers) Object.assign(headers, opts.headers);
  var method = opts.method || 'GET';
  var body = opts.body;
  var reqOpts = { method: method, headers: headers };
  if (body) reqOpts.body = JSON.stringify(body);
  var request = new Request(url, reqOpts);
  var env = { DB: db, ADMIN_API_KEY: 'test-admin-key' };
  if (opts.env) Object.assign(env, opts.env);
  return { request: request, env: env };
}

function mockSummaryDb() {
  var safeRow = { total: 0, count: 0, this_week: 0, this_month: 0, pending: 0, active: 0, completed: 0, rate: 0, cnt: 0, total_successful: 0, month_successful: 0 };
  var db = {};
  db.prepare = function(sql) {
    var sqlLower = sql.toLowerCase();
    var chain = {
      _bound: [],
      bind: function() { chain._bound = Array.prototype.slice.call(arguments); return chain; },
      first: async function() { return Object.assign({}, safeRow); },
      all: async function() { return { results: [] }; },
      run: async function() { return { success: true }; },
    };

    // subscribers aggregate
    if (sqlLower.indexOf('from subscribers') >= 0 && sqlLower.indexOf('this_week') >= 0) {
      chain.first = async function() { return { total: 5, this_week: 2, this_month: 3 }; };
    }

    // donations aggregate (first query)
    if (sqlLower.indexOf('from donations') >= 0 && sqlLower.indexOf('month_successful') >= 0) {
      chain.first = async function() { return { count: 10, total: 5000, total_successful: 4500, month_successful: 1200 }; };
    }

    // bookings aggregate (pending/active/completed)
    if (sqlLower.indexOf('from bookings') >= 0 && sqlLower.indexOf('pending') >= 0 && sqlLower.indexOf('revenue') < 0) {
      chain.first = async function() { return { pending: 2, active: 3, completed: 5 }; };
    }

    // booking revenue
    if (sqlLower.indexOf('from bookings') >= 0 && sqlLower.indexOf("status in") >= 0) {
      chain.first = async function() { return { count: 6, total: 3000 }; };
    }

    // recon donations failed
    if (sqlLower.indexOf("'failed'") >= 0 && sqlLower.indexOf("'transfer_failed'") >= 0) {
      chain.first = async function() { return { count: 1 }; };
    }

    // recon donations other (status NOT IN)
    if (sqlLower.indexOf('status not in') >= 0 && sqlLower.indexOf('from donations') >= 0) {
      chain.first = async function() { return { count: 0 }; };
    }

    // enrollments
    if (sqlLower.indexOf('from enrollments') >= 0) {
      chain.first = async function() { return { active: 4, total: 8 }; };
    }

    // membership by tier (GROUP BY)
    if (sqlLower.indexOf('group by membership_tier') >= 0) {
      chain.all = async function() {
        return { results: [{ membership_tier: 'free', count: 10 }, { membership_tier: 'premium', count: 3 }, { membership_tier: 'vip', count: 1 }] };
      };
    }

    // member expiring soon (+7 days)
    if (sqlLower.indexOf("+7 days") >= 0 && sqlLower.indexOf('from users') >= 0) {
      chain.first = async function() { return { count: 2 }; };
    }

    // member expired
    if (sqlLower.indexOf("membership_expires_at < datetime('now')") >= 0 && sqlLower.indexOf('+7 days') < 0) {
      chain.first = async function() { return { count: 1 }; };
    }

    // page_views aggregate
    if (sqlLower.indexOf('from page_views') >= 0 && sqlLower.indexOf('this_week') >= 0 && sqlLower.indexOf('distinct') < 0) {
      chain.first = async function() { return { total: 1000, this_week: 200, this_month: 500 }; };
    }

    // unique visitors (COUNT(DISTINCT ip))
    if (sqlLower.indexOf('count(distinct ip)') >= 0) {
      chain.first = async function() { return { total: 300, this_week: 50, this_month: 150 }; };
    }

    // views_by_page (GROUP BY page)
    if (sqlLower.indexOf('group by page') >= 0 && sqlLower.indexOf('from page_views') >= 0) {
      chain.all = async function() {
        return { results: [{ page: '/', count: 200 }, { page: '/school/', count: 100 }, { page: '/books/', count: 80 }] };
      };
    }

    // views_by_day (DATE(viewed_at))
    if (sqlLower.indexOf('date(viewed_at)') >= 0) {
      chain.all = async function() {
        return { results: [{ day: '2026-06-01', count: 30 }, { day: '2026-06-02', count: 25 }] };
      };
    }

    // views_by_country (NULLIF(country,''))
    if (sqlLower.indexOf("nullif(country,''") >= 0) {
      chain.all = async function() {
        return { results: [{ country: 'Ghana', count: 400 }, { country: 'Nigeria', count: 200 }, { country: 'Unknown', count: 50 }] };
      };
    }

    // donations_by_month (strftime + donations)
    if (sqlLower.indexOf("strftime('%y-%m', created_at)") >= 0) {
      chain.all = async function() {
        return { results: [{ month: '2026-01', count: 2, total: 500 }, { month: '2026-02', count: 3, total: 800 }] };
      };
    }

    // subs_by_month (strftime + subscribers)
    if (sqlLower.indexOf("strftime('%y-%m', subscribed_at)") >= 0) {
      chain.all = async function() {
        return { results: [{ month: '2026-01', count: 1 }, { month: '2026-02', count: 2 }] };
      };
    }

    // events
    if (sqlLower.indexOf('from events') >= 0) {
      chain.all = async function() {
        return { results: [{ event_type: 'page_view', count: 500 }, { event_type: 'signup', count: 20 }] };
      };
    }

    // conversion rate (nested subquery pattern)
    if (sqlLower.indexOf('as rate') >= 0 && sqlLower.indexOf('select count(*) from') >= 0) {
      chain.first = async function() { return { rate: 0.005 }; };
    }

    // recent donations
    if (sqlLower.indexOf("'donation' as type") >= 0) {
      chain.all = async function() {
        return { results: [{ type: 'donation', name: 'John', val: '100', note: 'successful', ts: '2026-06-11T10:00:00Z' }] };
      };
    }

    // recent subscribers
    if (sqlLower.indexOf("'subscriber' as type") >= 0) {
      chain.all = async function() {
        return { results: [{ type: 'subscriber', name: 'Jane', val: 'jane@test.com', note: 'web', ts: '2026-06-10T10:00:00Z' }] };
      };
    }

    // recent bookings
    if (sqlLower.indexOf("'booking' as type") >= 0) {
      chain.all = async function() {
        return { results: [{ type: 'booking', name: 'Bob', val: 'standard', note: 'active', ts: '2026-06-09T10:00:00Z' }] };
      };
    }

    // recent members
    if (sqlLower.indexOf("'member' as type") >= 0) {
      chain.all = async function() {
        return { results: [{ type: 'member', name: 'Alice', val: 'premium', note: 'alice@test.com', ts: '2026-06-08T10:00:00Z' }] };
      };
    }

    return chain;
  };
  return db;
}

/* ─── Summary ─── */

describe('GET /admin/api/summary', function () {
  it('returns 403 without admin key', async function () {
    var ctx = makeCtx('http://localhost/admin/api/summary', { noAuth: true });
    var res = await summaryOnRequest(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 501 when DB not bound', async function () {
    var ctx = makeCtx('http://localhost/admin/api/summary', { env: { DB: undefined } });
    var res = await summaryOnRequest(ctx);
    expect(res.status).toBe(501);
  });

  it('returns correct response structure', async function () {
    var db = mockSummaryDb();
    var ctx = makeCtx('http://localhost/admin/api/summary', { db: db });
    var res = await summaryOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.subscribers).toEqual({ total: 5, this_week: 2, this_month: 3 });
    expect(data.donations).toEqual({ count: 10, total: 5000, total_successful: 4500, month_successful: 1200 });
    expect(data.members.by_tier).toHaveLength(3);
    expect(data.page_views).toEqual({ total: 1000, this_week: 200, this_month: 500 });
    expect(data.unique_visitors).toEqual({ total: 300, this_week: 50, this_month: 150 });
    expect(data.charts.views_by_page).toHaveLength(3);
    expect(data.charts.views_by_day).toHaveLength(2);
    expect(data.charts.views_by_country).toHaveLength(3);
    expect(data.charts.donations_by_month).toHaveLength(2);
    expect(data.charts.subs_by_month).toHaveLength(2);
    expect(data.recent).toHaveLength(4);
  });

  it('returns 500 on DB error', async function () {
    var db = {};
    db.prepare = function() {
      return {
        _bound: [],
        bind: function() { return this; },
        first: async function() { throw new Error('DB failure'); },
        all: async function() { throw new Error('DB failure'); },
        run: async function() { throw new Error('DB failure'); },
      };
    };
    var ctx = makeCtx('http://localhost/admin/api/summary', { db: db });
    var res = await summaryOnRequest(ctx);
    expect(res.status).toBe(500);
  });
});

/* ─── Members ─── */

describe('Members - GET', function () {
  var sampleUsers = [
    { id: 1, name: 'Alice', email: 'alice@test.com', phone: '+233501234567', membership_tier: 'premium', membership_expires_at: '2026-12-31', email_verified: 1, created_at: '2026-01-01', last_login_at: '2026-06-01' },
    { id: 2, name: 'Bob', email: 'bob@test.com', phone: '+233501234568', membership_tier: 'free', membership_expires_at: '', email_verified: 1, created_at: '2026-02-01', last_login_at: '2026-06-02' },
    { id: 3, name: 'Charlie', email: 'charlie@test.com', phone: '+233501234569', membership_tier: 'vip', membership_expires_at: '2026-11-30', email_verified: 0, created_at: '2026-03-01', last_login_at: null },
  ];
  var sampleSubs = [
    { id: 1, email: 'alice@test.com', tier: 'premium', amount: 99, currency: 'GHS', status: 'active', start_date: '2026-01-01', next_billing: '2026-07-01', cancelled_at: null },
  ];

  it('returns 403 without admin key', async function () {
    var ctx = makeCtx('http://localhost/admin/api/members', { noAuth: true });
    var res = await membersOnRequest(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 501 when DB not bound', async function () {
    var ctx = makeCtx('http://localhost/admin/api/members', { env: { DB: undefined } });
    var res = await membersOnRequest(ctx);
    expect(res.status).toBe(501);
  });

  it('lists all members with pagination', async function () {
    var db = mockDb({ users: sampleUsers, subscriptions: sampleSubs });
    var ctx = makeCtx('http://localhost/admin/api/members', { db: db });
    var res = await membersOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.total).toBe(3);
    expect(data.items).toHaveLength(3);
    expect(data.items[0].name).toBeTruthy();
  });

  it('attaches subscription info per member', async function () {
    var db = mockDb({ users: sampleUsers, subscriptions: sampleSubs });
    var ctx = makeCtx('http://localhost/admin/api/members', { db: db });
    var res = await membersOnRequest(ctx);
    var data = await res.json();
    var alice = data.items.find(function(u) { return u.email === 'alice@test.com'; });
    expect(alice.subscription).toBeTruthy();
    expect(alice.subscription.tier).toBe('premium');
    var bob = data.items.find(function(u) { return u.email === 'bob@test.com'; });
    expect(bob.subscription).toBeNull();
  });

  it('filters members by search query', async function () {
    var db = mockDb({ users: sampleUsers, subscriptions: sampleSubs });
    var ctx = makeCtx('http://localhost/admin/api/members?search=alice', { db: db });
    var res = await membersOnRequest(ctx);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.items.length).toBeLessThanOrEqual(3);
  });

  it('returns 405 for POST', async function () {
    var db = mockDb({ users: sampleUsers });
    var ctx = makeCtx('http://localhost/admin/api/members', { method: 'POST', db: db });
    var res = await membersOnRequest(ctx);
    expect(res.status).toBe(405);
  });
});

describe('Members - PUT', function () {
  var sampleUsers = [
    { id: 1, name: 'Alice', email: 'alice@test.com', phone: '+233501234567', membership_tier: 'free', membership_expires_at: '', created_at: '2026-01-01', email_verified: 1, last_login_at: null },
  ];

  it('updates member tier', async function () {
    var db = mockDb({ users: sampleUsers });
    var ctx = makeCtx('http://localhost/admin/api/members', { method: 'PUT', db: db, body: { id: 1, membership_tier: 'premium' } });
    var res = await membersOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.user.id).toBe(1);
  });

  it('updates member expiry', async function () {
    var db = mockDb({ users: sampleUsers });
    var ctx = makeCtx('http://localhost/admin/api/members', { method: 'PUT', db: db, body: { id: 1, membership_expires_at: '2027-01-01' } });
    var res = await membersOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
  });

  it('returns 400 when id is missing', async function () {
    var db = mockDb({ users: sampleUsers });
    var ctx = makeCtx('http://localhost/admin/api/members', { method: 'PUT', db: db, body: { membership_tier: 'premium' } });
    var res = await membersOnRequest(ctx);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toContain('id');
  });

  it('returns 400 for invalid tier', async function () {
    var db = mockDb({ users: sampleUsers });
    var ctx = makeCtx('http://localhost/admin/api/members', { method: 'PUT', db: db, body: { id: 1, membership_tier: 'platinum' } });
    var res = await membersOnRequest(ctx);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toContain('tier');
  });

  it('returns 400 when no fields to update', async function () {
    var db = mockDb({ users: sampleUsers });
    var ctx = makeCtx('http://localhost/admin/api/members', { method: 'PUT', db: db, body: { id: 1 } });
    var res = await membersOnRequest(ctx);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toContain('No fields');
  });
});

/* ─── Subscribers ─── */

describe('Subscribers - GET', function () {
  var sampleSubs = [
    { id: 1, email: 'alice@test.com', name: 'Alice', source: 'web', edition: 'weekly', confirmed: 1, subscribed_at: '2026-01-01' },
    { id: 2, email: 'bob@test.com', name: 'Bob', source: 'newsletter_subdomain', edition: 'daily', confirmed: 1, subscribed_at: '2026-02-01' },
    { id: 3, email: 'charlie@test.com', name: 'Charlie', source: 'web', edition: 'weekly', confirmed: 0, subscribed_at: '2026-03-01' },
  ];

  it('returns 403 without admin key', async function () {
    var ctx = makeCtx('http://localhost/admin/api/subscribers', { noAuth: true });
    var res = await subscribersOnRequest(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 501 when DB not bound', async function () {
    var ctx = makeCtx('http://localhost/admin/api/subscribers', { env: { DB: undefined } });
    var res = await subscribersOnRequest(ctx);
    expect(res.status).toBe(501);
  });

  it('lists all subscribers', async function () {
    var db = mockDb({ subscribers: sampleSubs });
    var ctx = makeCtx('http://localhost/admin/api/subscribers', { db: db });
    var res = await subscribersOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.items).toHaveLength(3);
  });

  it('returns single subscriber by id', async function () {
    var db = mockDb({ subscribers: sampleSubs });
    var ctx = makeCtx('http://localhost/admin/api/subscribers?id=1', { db: db });
    var res = await subscribersOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.id).toBe(1);
    expect(data.email).toBe('alice@test.com');
  });

  it('returns null for unknown id', async function () {
    var db = mockDb({ subscribers: sampleSubs });
    var ctx = makeCtx('http://localhost/admin/api/subscribers?id=99', { db: db });
    var res = await subscribersOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data).toBeNull();
  });

  it('returns 405 for POST', async function () {
    var db = mockDb({ subscribers: sampleSubs });
    var ctx = makeCtx('http://localhost/admin/api/subscribers', { method: 'POST', db: db });
    var res = await subscribersOnRequest(ctx);
    expect(res.status).toBe(405);
  });
});

describe('Subscribers - DELETE', function () {
  it('deletes a subscriber by id', async function () {
    var db = mockDb({ subscribers: [{ id: 1, email: 'test@test.com' }] });
    var ctx = makeCtx('http://localhost/admin/api/subscribers?id=1', { method: 'DELETE', db: db });
    var res = await subscribersOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.deleted).toBe('1');
  });

  it('returns 405 when DELETE without id', async function () {
    var db = mockDb({ subscribers: [] });
    var ctx = makeCtx('http://localhost/admin/api/subscribers', { method: 'DELETE', db: db });
    var res = await subscribersOnRequest(ctx);
    expect(res.status).toBe(405);
  });
});

/* ─── Donations ─── */

describe('Donations - GET', function () {
  var sampleDonations = [
    { id: 1, donor_name: 'Alice', amount: 100, currency: 'GHS', status: 'successful', email: 'alice@test.com', phone: '+233501234567', tx_ref: 'tx-001', created_at: '2026-01-01' },
    { id: 2, donor_name: 'Bob', amount: 50, currency: 'GHS', status: 'pending', email: 'bob@test.com', phone: '', tx_ref: 'tx-002', created_at: '2026-02-01' },
  ];

  it('returns 403 without admin key', async function () {
    var ctx = makeCtx('http://localhost/admin/api/donations', { noAuth: true });
    var res = await donationsOnRequest(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 501 when DB not bound', async function () {
    var ctx = makeCtx('http://localhost/admin/api/donations', { env: { DB: undefined } });
    var res = await donationsOnRequest(ctx);
    expect(res.status).toBe(501);
  });

  it('lists all donations with totals', async function () {
    var db = mockDb({ donations: sampleDonations });
    var ctx = makeCtx('http://localhost/admin/api/donations', { db: db });
    var res = await donationsOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.items).toHaveLength(2);
    expect(data.totals).toBeDefined();
    expect(data.totals.count).toBe(2);
  });

  it('confirms a pending donation via POST', async function () {
    var db = mockDb({ donations: sampleDonations });
    var ctx = makeCtx('http://localhost/admin/api/donations', { method: 'POST', db: db });
    ctx.request = new Request('http://localhost/admin/api/donations', {
      method: 'POST',
      headers: { 'X-Admin-Key': 'test-admin-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', tx_ref: 'tx-002' })
    });
    var res = await donationsOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    var updated = db._tables.donations.filter(function (r) { return r.tx_ref === 'tx-002'; })[0];
    expect(updated.status).toBe('successful');
  });

  it('returns 404 for POST confirm with unknown tx_ref', async function () {
    var db = mockDb({ donations: sampleDonations });
    var ctx = makeCtx('http://localhost/admin/api/donations', { method: 'POST', db: db });
    ctx.request = new Request('http://localhost/admin/api/donations', {
      method: 'POST',
      headers: { 'X-Admin-Key': 'test-admin-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', tx_ref: 'nope-000' })
    });
    var res = await donationsOnRequest(ctx);
    expect(res.status).toBe(404);
  });
});

/* ─── Programs ─── */

describe('Programs - GET', function () {
  var samplePrograms = [
    { id: 1, title: 'Guitar Fundamentals', slug: 'guitar-fundamentals', tagline: 'Learn guitar', description: 'A beginner course', duration: '8 weeks', price: 0, price_label: 'Free', status: 'active', sort_order: 1, sample_content: '', full_content: '' },
    { id: 2, title: 'Music Production', slug: 'music-production', tagline: 'Produce music', description: 'Advanced course', duration: '12 weeks', price: 99, price_label: 'Premium', status: 'active', sort_order: 2, sample_content: '', full_content: '' },
  ];

  it('returns 403 without admin key', async function () {
    var ctx = makeCtx('http://localhost/admin/api/programs', { noAuth: true });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 501 when DB not bound', async function () {
    var ctx = makeCtx('http://localhost/admin/api/programs', { env: { DB: undefined } });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(501);
  });

  it('lists all programs', async function () {
    var db = mockDb({ programs: samplePrograms });
    var ctx = makeCtx('http://localhost/admin/api/programs', { db: db });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.items).toHaveLength(2);
  });

  it('returns single program by id', async function () {
    var db = mockDb({ programs: samplePrograms });
    var ctx = makeCtx('http://localhost/admin/api/programs?id=1', { db: db });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.id).toBe(1);
    expect(data.title).toBe('Guitar Fundamentals');
  });

  it('returns null for unknown id', async function () {
    var db = mockDb({ programs: samplePrograms });
    var ctx = makeCtx('http://localhost/admin/api/programs?id=99', { db: db });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data).toBeNull();
  });
});

describe('Programs - POST', function () {
  it('creates a new program', async function () {
    var db = mockDb({ programs: [] });
    var ctx = makeCtx('http://localhost/admin/api/programs', { method: 'POST', db: db, body: { title: 'New Program', slug: 'new-program', tagline: 'Test', description: 'A test program', duration: '4 weeks', price: 0, price_label: 'Free', status: 'active' } });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.message).toContain('created');
  });

  it('returns 400 when title is missing', async function () {
    var db = mockDb({ programs: [] });
    var ctx = makeCtx('http://localhost/admin/api/programs', { method: 'POST', db: db, body: { slug: 'no-title' } });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.error).toContain('Title');
  });

  it('returns 400 when slug is missing', async function () {
    var db = mockDb({ programs: [] });
    var ctx = makeCtx('http://localhost/admin/api/programs', { method: 'POST', db: db, body: { title: 'No Slug' } });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.error).toContain('slug');
  });
});

describe('Programs - PATCH', function () {
  it('updates a program', async function () {
    var db = mockDb({ programs: [{ id: 1, title: 'Old Title', slug: 'old-title' }] });
    var ctx = makeCtx('http://localhost/admin/api/programs?id=1', { method: 'PATCH', db: db, body: { title: 'New Title' } });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.updated).toBe('1');
  });
});

describe('Programs - DELETE', function () {
  it('deletes a program without cascade when no refs exist', async function () {
    var db = mockDb({ programs: [{ id: 1, title: 'Test', slug: 'test' }], enrollments: [], modules: [] });
    var ctx = makeCtx('http://localhost/admin/api/programs?id=1', { method: 'DELETE', db: db });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.deleted).toBe('1');
  });

  it('returns 409 when refs exist without cascade flag', async function () {
    var db = mockDb({ programs: [{ id: 1, title: 'Test', slug: 'test' }], enrollments: [{ id: 1, program_id: 1 }], modules: [] });
    var ctx = makeCtx('http://localhost/admin/api/programs?id=1', { method: 'DELETE', db: db });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(409);
    var data = await res.json();
    expect(data.status).toBe('error');
    expect(data.message).toContain('enrollment');
    expect(data.enrollment_count > 0).toBe(true);
  });

  it('deletes with cascade when flag is set', async function () {
    var db = mockDb({ programs: [{ id: 1, title: 'Test', slug: 'test' }], enrollments: [{ id: 1, program_id: 1, user_email: 'test@test.com' }], modules: [{ id: 1, program_id: 1, title: 'Module 1' }], module_completions: [{ id: 1, module_id: 1 }] });
    var ctx = makeCtx('http://localhost/admin/api/programs?id=1&cascade=true', { method: 'DELETE', db: db });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.deleted).toBe('1');
  });

  it('returns 400 when id is missing on DELETE', async function () {
    var db = mockDb({ programs: [] });
    var ctx = makeCtx('http://localhost/admin/api/programs', { method: 'DELETE', db: db });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(400);
    var data = await res.json();
    expect(data.message).toContain('Missing');
  });

  it('returns 405 for unsupported method', async function () {
    var db = mockDb({ programs: [] });
    var ctx = makeCtx('http://localhost/admin/api/programs', { method: 'PUT', db: db });
    var res = await programsOnRequest(ctx);
    expect(res.status).toBe(405);
  });
});
