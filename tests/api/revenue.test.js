import { describe, it, expect } from 'vitest';
import { onRequest } from '../../functions/admin/api/revenue.js';

function ctx(opts) {
  opts = opts || {};
  var headers = {};
  if (!opts.noAuth) headers['X-Admin-Key'] = 'test-admin-key';
  return {
    request: new Request('http://localhost/admin/api/revenue', { headers: headers }),
    env: { DB: opts.noDb ? undefined : stubDb(opts), ADMIN_API_KEY: 'test-admin-key' }
  };
}

function stubDb(opts) {
  opts = opts || {};
  return {
    prepare: function (sql) {
      var s = sql.toLowerCase();
      var chain = {
        bind: function () { return chain; },
        all: async function () {
          if (s.indexOf('from service_inquiries') >= 0 && s.indexOf('group by service') >= 0) {
            return { results: [
              { service: 'Consultation — Anchor Session — one hour', count: 2, last_at: '2026-11-20 10:00:00' },
              { service: 'Consultation — Coaching Sprint — 4 sessions', count: 1, last_at: '2026-11-21 10:00:00' }
            ] };
          }
          if (s.indexOf('from service_inquiries') >= 0 && s.indexOf('group by source') >= 0) {
            return { results: [
              { source: 'money-ghana-assessment', count: 2 },
              { source: 'direct', count: 1 }
            ] };
          }
          if (s.indexOf('from momo_manual_claims') >= 0 && s.indexOf('group by status') >= 0) {
            return { results: [{ status: 'submitted', count: 3 }] };
          }
          return { results: [] };
        },
        first: async function () {
          if (s.indexOf('from subscriptions') >= 0) return { mrr: 450, count: 9 };
          if (s.indexOf("status = 'new'") >= 0 && s.indexOf('from service_inquiries') >= 0) return { count: 2 };
          if (s.indexOf('from donations') >= 0 && s.indexOf('as settled') >= 0) {
            return { settled: 1200, pending: 300, failed: 50, count: 12, last_at: '2026-11-22 12:00:00' };
          }
          if (s.indexOf('as settled') >= 0) {
            if (opts.breakTable && s.indexOf('from ' + opts.breakTable) >= 0) throw new Error('no such table');
            return { settled: 100, pending: 20, failed: 5, count: 2, last_at: '2026-11-21 12:00:00' };
          }
          return {};
        }
      };
      return chain;
    }
  };
}

describe('GET /admin/api/revenue', function () {
  it('requires admin auth', async function () {
    var res = await onRequest(ctx({ noAuth: true }));
    expect(res.status).toBe(403);
  });

  it('reports missing D1', async function () {
    var res = await onRequest(ctx({ noDb: true }));
    expect(res.status).toBe(501);
  });

  it('combines verified streams and separates pipeline/manual money', async function () {
    var res = await onRequest(ctx());
    expect(res.status).toBe(200);
    var d = await res.json();
    expect(d.status).toBe('ok');
    expect(d.currency).toBe('GHS');
    expect(d.streams.length).toBe(6);
    // 1200 donations + 5 other streams x 100
    expect(d.totals.settled).toBe(1700);
    expect(d.totals.pending).toBe(400);
    expect(d.totals.failed).toBe(75);
    expect(d.totals.mrr).toBe(450);
    expect(d.monthly.length).toBe(12);
    // 2 anchors x 1500 + 1 sprint x 5000; leads are never settled revenue
    expect(d.consultation.potential).toBe(8000);
    expect(d.consultation.leads).toBe(3);
    expect(d.consultation.by_source).toEqual([
      { source: 'money-ghana-assessment', count: 2 },
      { source: 'direct', count: 1 }
    ]);
    expect(d.reconciliation.unverified_donations).toBe(300);
    expect(d.reconciliation.manual_claims.submitted).toBe(3);
    expect(d.manual_channels.map(function (c) { return c.key; })).toEqual(['selar', 'consultation']);
    expect(d.verification_rule).toMatch(/server re-verified only/);
  });

  it('keeps working when a single revenue table is missing', async function () {
    var res = await onRequest(ctx({ breakTable: 'store_orders' }));
    expect(res.status).toBe(200);
    var d = await res.json();
    expect(d.status).toBe('ok');
    var store = d.streams.find(function (s) { return s.key === 'store'; });
    expect(store.settled).toBe(0);
    expect(d.totals.settled).toBe(1600);
  });
});
