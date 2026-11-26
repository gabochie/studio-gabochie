import { describe, it, expect, afterEach, vi } from 'vitest';
import { mockDb } from '../helpers/mock-cf.js';
import { onRequest } from '../../functions/admin/api/qa/scan.js';

afterEach(function () {
  vi.unstubAllGlobals();
});

function req(url, opts) {
  opts = opts || {};
  return new Request(url, {
    method: opts.method || 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
}

function env(tables, overrides) {
  return Object.assign({
    DB: mockDb(tables || { quality_runs: [], quality_reports: [] }),
    CI_WEBHOOK_SECRET: 'ci-secret-123'
  }, overrides || {});
}

function htmlPage(good) {
  var meta = good ? '<meta name="description" content="A good description">' : '';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
    '<title>Test page</title>' + meta + '</head><body>hello</body></html>';
}

describe('QA scan status polling', function () {
  it('returns critical-page failures separately for a completed run', async function () {
    const tables = {
      quality_runs: [{ id: 3, status: 'completed', total_checks: 8, passed_checks: 6, failed_checks: 2, warn_checks: 0 }],
      quality_reports: [
        { run_id: 3, page_url: 'https://studio.gabochie.com/', check_name: 'meta_description', status: 'fail' },
        { run_id: 3, page_url: 'https://studio.gabochie.com/support/', check_name: 'page_status', status: 'fail' },
        { run_id: 3, page_url: 'https://studio.gabochie.com/blog/post/', check_name: 'doctype', status: 'fail' }
      ]
    };
    const res = await onRequest({
      request: req('https://example.com/admin/api/qa/scan?run_id=3', {
        method: 'GET', headers: { 'X-CI-Secret': 'ci-secret-123' }
      }),
      env: env(tables)
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run_status).toBe('completed');
    expect(body.failed).toBe(2);
    expect(body.critical_failed).toBe(2);
    expect(body.critical_pages).toContain('https://studio.gabochie.com/');
    expect(body.critical_pages).not.toContain('https://studio.gabochie.com/blog/post/');
    expect(body.critical_failures).toHaveLength(2);
  });

  it('validates run_id and rejects unknown runs', async function () {
    const bad = await onRequest({
      request: req('https://example.com/admin/api/qa/scan?run_id=abc', {
        method: 'GET', headers: { 'X-CI-Secret': 'ci-secret-123' }
      }),
      env: env()
    });
    expect(bad.status).toBe(400);
    const missing = await onRequest({
      request: req('https://example.com/admin/api/qa/scan?run_id=99', {
        method: 'GET', headers: { 'X-CI-Secret': 'ci-secret-123' }
      }),
      env: env()
    });
    expect(missing.status).toBe(404);
  });

  it('rejects a same-length wrong CI secret', async function () {
    const res = await onRequest({
      request: req('https://example.com/admin/api/qa/scan?run_id=1', {
        method: 'GET', headers: { 'X-CI-Secret': 'ci-secret-124' }
      }),
      env: env({ quality_runs: [], quality_reports: [] }, { ADMIN_API_KEY: 'admin-key' })
    });
    expect(res.status).toBe(403);
  });

  it('rejects unsupported methods', async function () {
    const res = await onRequest({
      request: req('https://example.com/admin/api/qa/scan', {
        method: 'PUT', headers: { 'X-CI-Secret': 'ci-secret-123' }
      }),
      env: env()
    });
    expect(res.status).toBe(405);
  });
});

describe('QA scan run', function () {
  it('counts failures on critical pages only', async function () {
    const sitemap = '<?xml version="1.0"?><urlset>' +
      '<url><loc>https://studio.gabochie.com/</loc></url>' +
      '<url><loc>https://studio.gabochie.com/blog/minor-post/</loc></url></urlset>';
    vi.stubGlobal('fetch', async function (input) {
      const url = String(input);
      if (url.endsWith('/sitemap.xml')) return new Response(sitemap, { status: 200 });
      if (url === 'https://studio.gabochie.com/') return new Response(htmlPage(false), { status: 200 });
      return new Response(htmlPage(false), { status: 200 });
    });
    const res = await onRequest({
      request: req('https://example.com/admin/api/qa/scan', {
        headers: { 'X-CI-Secret': 'ci-secret-123' }, body: { trigger: 'deploy' }
      }),
      env: env()
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.run_id).toBe(1);
    expect(body.failed).toBeGreaterThanOrEqual(2);
    expect(body.critical_failed).toBeGreaterThanOrEqual(1);
    expect(body.critical_pages).toContain('https://studio.gabochie.com/');
    expect(body.critical_pages).not.toContain('https://studio.gabochie.com/blog/minor-post/');
  });
});
