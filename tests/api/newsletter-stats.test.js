import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockDb, buildContext } from '../helpers/mock-cf.js';

import { onRequest as stats } from '../../functions/admin/api/newsletter/stats.js';

function adminGet(db, extraEnv) {
  var url = 'http://localhost/admin/api/newsletter/stats';
  return buildContext(url, {
    method: 'GET',
    env: Object.assign({ DB: db, ADMIN_API_KEY: 'admin-key', BREVO_API_KEY: 'brevo-key' }, extraEnv || {}),
    request: new Request(url, { headers: { 'X-Admin-Key': 'admin-key' } })
  });
}

describe('newsletter stats (phase 3)', function () {
  var realFetch;
  beforeEach(function () { realFetch = globalThis.fetch; });
  afterEach(function () { globalThis.fetch = realFetch; });

  it('serves cached engagement snapshots', async function () {
    globalThis.fetch = async function (url) {
      if (String(url).indexOf('statistics') >= 0) throw new Error('statistics must come from cache');
      return new Response(JSON.stringify({ count: 0, campaigns: [] }), { status: 200 });
    };
    var cached = { delivered: 100, opens: 40, unique_opens: 30, clicks: 10, unique_clicks: 8, bounces: 1, complaints: 0, open_rate: 30, click_rate: 8, daily: [] };
    var db = mockDb({
      brevo_stats_cache: [{ cache_key: 'smtp_30d', payload: JSON.stringify(cached), updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19) }],
      newsletter_issues: []
    });
    var res = await stats(adminGet(db));
    expect(res.status).toBe(200);
    var data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.engagement.delivered).toBe(100);
    expect(data.engagement.open_rate).toBe(30);
  });

  it('fetches, shapes, and caches Brevo reports', async function () {
    var urls = [];
    globalThis.fetch = async function (url) {
      urls.push(String(url));
      if (String(url).indexOf('aggregatedReport') >= 0 && String(url).indexOf('tag=') < 0) {
        return new Response(JSON.stringify({ delivered: 200, opens: 100, uniqueOpens: 60, clicks: 20, uniqueClicks: 15, hardBounces: 2, softBounces: 1, spamReports: 0, unsubscribed: 1 }), { status: 200 });
      }
      if (String(url).indexOf('/reports') >= 0) {
        return new Response(JSON.stringify({ reports: [{ date: '2026-10-09', delivered: 50, uniqueOpens: 20, uniqueClicks: 5 }] }), { status: 200 });
      }
      if (String(url).indexOf('tag=newsletter-issue-7') >= 0) {
        return new Response(JSON.stringify({ delivered: 90, uniqueOpens: 45, uniqueClicks: 9, hardBounces: 0, softBounces: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };
    var db = mockDb({
      brevo_stats_cache: [],
      newsletter_issues: [{ id: 3, issue_number: 7, subject: 'Hi', subscriber_count: 90, sent_count: 90, failed_count: 0, status: 'sent', sent_at: '2026-10-04' }]
    });
    var res = await stats(adminGet(db));
    var data = await res.json();
    expect(data.engagement.delivered).toBe(200);
    expect(data.engagement.open_rate).toBe(30);
    expect(data.engagement.daily).toHaveLength(1);
    expect(data.issues[0].engagement.opens).toBe(45);
    expect(db._tables.brevo_stats_cache.length).toBeGreaterThanOrEqual(2);
  });

  it('requires admin auth', async function () {
    var db = mockDb({});
    var url = 'http://localhost/admin/api/newsletter/stats';
    var ctx = buildContext(url, {
      method: 'GET',
      env: { DB: db, ADMIN_API_KEY: 'admin-key', BREVO_API_KEY: 'brevo-key' },
      request: new Request(url)
    });
    var res = await stats(ctx);
    expect([401, 403]).toContain(res.status);
  });
});
