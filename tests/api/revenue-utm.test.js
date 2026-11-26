import { describe, it, expect } from 'vitest';
import { onRequest } from '../../functions/admin/api/revenue.js';

// D1 returns the COALESCE'd alias; stub it directly because the generic mockDb
// groups by raw row properties and cannot evaluate COALESCE.
function stubDb() {
  return {
    prepare: function (sql) {
      var s = String(sql).toLowerCase();
      return {
        bind: function () { return this; },
        all: async function () {
          if (s.indexOf('group by source') !== -1) {
            return { results: [
              { source: 'money-ghana-assessment / assessment-d24', count: 2 },
              { source: 'money-ghana-assessment?utm_source=instagram&utm_medium=social&utm_campaign=assessment-d24', count: 1 },
              { source: 'direct', count: 1 }
            ] };
          }
          return { results: [] };
        },
        first: async function () { return {}; }
      };
    }
  };
}

describe('consultation UTM attribution in /admin/api/revenue', function () {
  it('parses structured UTMs from referral strings without a schema change', async function () {
    var res = await onRequest({
      request: new Request('http://localhost/admin/api/revenue', {
        headers: { 'X-Admin-Key': 'test-admin-key' }
      }),
      env: { DB: stubDb(), ADMIN_API_KEY: 'test-admin-key' }
    });
    expect(res.status).toBe(200);
    var body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.consultation.by_source).toEqual([
      { source: 'money-ghana-assessment', count: 3 },
      { source: 'direct', count: 1 }
    ]);

    var campaignOnly = body.consultation.by_utm.filter(function (row) {
      return row.utm_campaign === 'assessment-d24' && !row.utm_source;
    })[0];
    expect(campaignOnly.count).toBe(2);
    var full = body.consultation.by_utm.filter(function (row) {
      return row.utm_source === 'instagram' && row.utm_medium === 'social';
    })[0];
    expect(full.utm_campaign).toBe('assessment-d24');
    expect(full.count).toBe(1);
  });
});
