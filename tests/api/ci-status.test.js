import { describe, it, expect } from 'vitest';
import { mockDb } from '../helpers/mock-cf.js';
import { onRequest } from '../../functions/api/admin/ci/status.js';

function req(url, opts) {
  opts = opts || {};
  return new Request(url, {
    method: opts.method || 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
}

function env(overrides) {
  return Object.assign({ DB: mockDb({ ci_reports: [] }), CI_WEBHOOK_SECRET: 'ci-secret-123' }, overrides || {});
}

describe('CI status webhook', function () {
  it('accepts the exact CI secret and stores a report', async function () {
    const e = env();
    const res = await onRequest({
      request: req('https://example.com/api/admin/ci/status', {
        headers: { 'X-CI-Secret': 'ci-secret-123' },
        body: { run_id: '42', status: 'success', test_count: 517, test_passed: 517, test_failed: 0, coverage_pct: 82.4, branch: 'main', triggered_by: 'push' }
      }),
      env: e
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(e.DB._tables.ci_reports).toHaveLength(1);
    expect(e.DB._tables.ci_reports[0].run_id).toBe('42');
    expect(e.DB._tables.ci_reports[0].coverage_pct).toBe(82.4);
  });

  it('rejects wrong-length and same-length secrets identically', async function () {
    for (const secret of ['wrong', 'ci-secret-124', 'ci-secret-1234']) {
      const res = await onRequest({
        request: req('https://example.com/api/admin/ci/status', {
          headers: { 'X-CI-Secret': secret },
          body: { run_id: '1' }
        }),
        env: env()
      });
      expect(res.status).toBe(403);
      expect((await res.json()).message).toBe('Unauthorized');
    }
  });

  it('rejects missing secret configuration and missing run_id', async function () {
    const noSecret = await onRequest({
      request: req('https://example.com/api/admin/ci/status', {
        headers: { 'X-CI-Secret': 'anything' }, body: { run_id: '1' }
      }),
      env: env({ CI_WEBHOOK_SECRET: '' })
    });
    expect(noSecret.status).toBe(403);

    const noRun = await onRequest({
      request: req('https://example.com/api/admin/ci/status', {
        headers: { 'X-CI-Secret': 'ci-secret-123' }, body: {}
      }),
      env: env()
    });
    expect(noRun.status).toBe(400);
  });

  it('serves the latest report to an admin key', async function () {
    const row = { run_id: '7', status: 'success', coverage_pct: 80, created_at: '2026-11-24 10:00:00' };
    const res = await onRequest({
      request: req('https://example.com/api/admin/ci/status', {
        method: 'GET', headers: { 'X-Admin-Key': 'admin-key' }
      }),
      env: env({ ADMIN_API_KEY: 'admin-key', DB: mockDb({ ci_reports: [row] }) })
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', report: row });
  });
});
