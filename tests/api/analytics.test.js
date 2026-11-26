import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../functions/api/agents/_ai.js', function () {
  return {
    callAI: vi.fn(async function () {
      return { content: JSON.stringify({ insights: ['ok'], recommendations: ['keep going'] }) };
    })
  };
});
vi.mock('../../functions/api/admin/_admin-auth.js', function () {
  return { requireAdminAuth: vi.fn(async function () { return null; }) };
});

import { onRequest } from '../../functions/api/ai/analytics.js';

function context(db) {
  return {
    request: new Request('http://localhost/api/ai/analytics', {
      headers: { 'X-Admin-Key': 'test-admin-key' }
    }),
    env: { DB: db, ADMIN_API_KEY: 'test-admin-key' }
  };
}

function dbFor(sqls, failTable) {
  return {
    prepare: function (sql) {
      sqls.push(sql);
      return {
        all: async function () {
          if (failTable && sql.indexOf('FROM ' + failTable) !== -1) throw new Error('no such column: broken');
          if (sql.indexOf('FROM subscribers') !== -1) return { results: [{ month: '2026-11', total: 4 }] };
          if (sql.indexOf('FROM page_views') !== -1) return { results: [{ month: '2026-11', total: 25 }] };
          if (sql.indexOf("'assessment_start'") !== -1) {
            return { results: [
              { event_type: 'assessment_start', total: 10 },
              { event_type: 'assessment_complete', total: 6 },
              { event_type: 'assessment_unlock', total: 2 }
            ] };
          }
          return { results: [] };
        }
      };
    }
  };
}

describe('GET /api/ai/analytics', function () {
  var sqls;

  beforeEach(function () { sqls = []; });

  it('uses the real date columns and exposes assessment funnel counts', async function () {
    var res = await onRequest(context(dbFor(sqls)));
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.historical.assessmentEvents).toEqual({
      assessment_start: 10, assessment_complete: 6, assessment_unlock: 2
    });

    var subscriberSql = sqls.filter(function (s) { return s.indexOf('FROM subscribers') !== -1; })[0];
    var pageviewSql = sqls.filter(function (s) { return s.indexOf('FROM page_views') !== -1 && s.indexOf('GROUP BY page') === -1; })[0];
    var topPagesSql = sqls.filter(function (s) { return s.indexOf('GROUP BY page') !== -1; })[0];
    expect(subscriberSql).toContain("strftime('%Y-%m', subscribed_at)");
    expect(subscriberSql).not.toContain('subscribers WHERE created_at');
    expect(pageviewSql).toContain("strftime('%Y-%m', viewed_at)");
    expect(pageviewSql).toContain('viewed_at >= datetime(');
    expect(topPagesSql).toContain('viewed_at >= datetime(');
  });

  it('surfaces core D1 errors instead of reporting zero metrics', async function () {
    var res = await onRequest(context(dbFor(sqls, 'page_views')));
    expect(res.status).toBe(500);
    var body = await res.json();
    expect(body.error).toMatch(/no such column/);
  });
});
