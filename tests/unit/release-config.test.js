import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import yaml from 'js-yaml';
import { main as revenueCheckMain } from '../../scripts/check-revenue-config.mjs';

const root = new URL('../../', import.meta.url);
function read(rel) {
  return readFileSync(new URL(rel, root), 'utf8');
}
function json(rel) {
  return JSON.parse(read(rel));
}
function workflow(name) {
  return yaml.load(read('.github/workflows/' + name));
}

const REQUIRED_JOBS = [
  'lint-js', 'lint-html', 'html-validator', 'a11y', 'test-unit',
  'coverage', 'test-e2e', 'audit', 'secrets', 'assets'
];

describe('release configuration', function () {
  it('serializes deploys and gates deploy on every required check', function () {
    const ci = workflow('ci.yml');
    expect(ci.concurrency).toEqual({ group: 'deploy-main', 'cancel-in-progress': false });
    expect(ci.jobs.deploy).toBeTruthy();
    const needs = ci.jobs.deploy.needs;
    for (const job of REQUIRED_JOBS) {
      expect(ci.jobs[job], 'missing job ' + job).toBeTruthy();
      expect(needs, 'deploy.needs missing ' + job).toContain(job);
    }
    expect(needs).toContain('e2e-fullstack');
    expect(needs).toContain('protection-policy-check');
  });

  it('has no suppressed failures in CI', function () {
    const source = read('.github/workflows/ci.yml');
    expect(source.includes('|| true')).toBe(false);
    expect(source.includes('|| echo')).toBe(false);
    expect(source).not.toMatch(/npm run predeploy\s*\|\|/);
    expect(source).not.toMatch(/npm run db:setup\s*\|\|/);
  });

  it('blocks on predeploy, DB setup, migration verification and smoke tests', function () {
    const source = read('.github/workflows/ci.yml');
    expect(source).toContain('run: npm run predeploy');
    expect(source).toContain('run: npm run db:setup');
    expect(source).toContain('Verify migrations');
    expect(source).toContain('Post-deploy smoke test');
    expect(source).toContain('/api/db/ping');
    for (const page of ['/support/', '/school/', '/books/', '/guitar/']) {
      expect(source).toContain(page);
    }
  });

  it('runs a full-stack E2E job and fails on skipped tests', function () {
    const ci = workflow('ci.yml');
    const job = ci.jobs['e2e-fullstack'];
    expect(job).toBeTruthy();
    const source = JSON.stringify(job);
    expect(source).toContain('wrangler pages dev');
    expect(source).toContain('mock-expresspay.cjs');
    expect(source).toContain('/api/db/setup');
    expect(source).toContain('/api/guitar/setup');
    expect(source).toContain('tests/e2e/onboarding.spec.js');
    expect(source).toContain('--reporter=json');
    expect(source).toContain('skipped');
    for (const binding of [
      'CI_WEBHOOK_SECRET=local-ci-secret',
      'PUBLIC_BASE_URL=http://localhost:8788',
      'EXPRESSPAY_BASE_URL=http://localhost:8790/api',
      'EXPRESSPAY_MERCHANT_ID=ci-test-merchant',
      'EXPRESSPAY_API_KEY=ci-test-api-key'
    ]) {
      expect(source, 'missing binding ' + binding).toContain(binding);
    }
  });

  it('validates HTML offline instead of the rate-limited W3C endpoint', function () {
    const ci = workflow('ci.yml');
    const source = JSON.stringify(ci.jobs['html-validator']);
    expect(source).toContain('html-validate@11.22.1');
    expect(source).not.toContain('html-validator-cli');
  });

  it('fails the dashboard post when the endpoint rejects it', function () {
    const ci = workflow('ci.yml');
    const report = JSON.stringify(ci.jobs.report);
    expect(report).toContain('--fail-with-body');
    expect(report).toContain('numTotalTests');
    expect(report).toContain('coverage-summary.json');
    expect(report).toContain('toJSON(needs)');
  });

  it('audits moderate advisories and uses `&&` in the local deploy script', function () {
    const pkg = json('package.json');
    expect(pkg.scripts.audit).toContain('--audit-level=moderate');
    expect(pkg.scripts.deploy).not.toContain(';');
    expect(pkg.scripts.deploy).toContain('npm run predeploy &&');
    expect(pkg.scripts.deploy).toContain('&& npm run db:setup');
    expect(pkg.devDependencies.playwright).toBeTruthy();
    expect(pkg.devDependencies['@playwright/test']).toBeTruthy();
    expect(pkg.dependencies && pkg.dependencies.playwright).toBeUndefined();
    expect(pkg.overrides.ajv['fast-uri']).toBe('3.1.9');
    expect(parseFloat(String(pkg.devDependencies.vitest).replace(/^\^/, ''))).toBeGreaterThanOrEqual(4.1);
  });

  it('never publishes local secrets or test artifacts', function () {
    const ignore = read('.assetsignore');
    for (const pattern of ['.dev.vars', '.env', '*.log', 'coverage/**', 'test-results/**', 'node_modules/**', '.git/**', 'playwright-report/**']) {
      expect(ignore, 'missing ignore pattern ' + pattern).toContain(pattern);
    }
  });

  it('enforces coverage thresholds on ops-critical code', function () {
    const config = read('vitest.config.js');
    expect(config).toMatch(/lines:\s*80/);
    expect(config).toMatch(/branches:\s*65/);
    expect(config).toContain('functions/api/admin/ci/status.js');
    expect(config).toContain('functions/admin/api/qa/scan.js');
    expect(config).toContain('scripts/');
  });

  it('treats CI retries as failures', function () {
    expect(read('playwright.config.js')).toContain('process.env.CI ? 0');
  });

  it('pins actions and verifies the gitleaks download', function () {
    for (const name of readdirSync(new URL('.github/workflows', root))) {
      const source = read('.github/workflows/' + name);
      for (const match of source.matchAll(/uses:\s*([^\s#]+)(?:[^\n]*)/g)) {
        expect(match[1], name + ': ' + match[1]).toMatch(/@[0-9a-f]{40}$/);
      }
    }
    const scan = read('.github/workflows/secret-scan.yml');
    expect(scan).toContain('sha256sum --check');
    expect(scan).toContain('Baseline audit');
    expect(workflow('secret-scan.yml').jobs.gitleaks.steps.length).toBeGreaterThanOrEqual(4);
  });

  it('sends the cron secret in a header', function () {
    const cron = read('.github/workflows/email-cron.yml');
    expect(cron).toContain('X-Cron-Secret:');
    expect(cron).not.toContain('?secret=');
  });

  it('exercises the revenue config CLI (covered ops script)', function () {
    const log = vi.spyOn(console, 'log').mockImplementation(function () {});
    try {
      expect(revenueCheckMain(['--json'])).toBe(0);
      const report = JSON.parse(log.mock.calls[0][0]);
      expect(report.summary.required).toBeGreaterThan(0);
      expect(report.slots.length).toBeGreaterThan(0);
      log.mockClear();
      expect(revenueCheckMain([])).toBe(0);
      expect(log.mock.calls[0][0]).toContain('Revenue checkout readiness');
    } finally {
      log.mockRestore();
    }
  });
});
