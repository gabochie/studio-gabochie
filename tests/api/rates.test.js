import { describe, it, expect, afterEach, vi } from 'vitest';
import { onRequest, onRequestGet } from '../../functions/api/rates.js';
import { ghsToUsd } from '../../functions/api/gateways/_shared.js';

var LIVE = {
  result: 'success',
  time_last_update_utc: 'Mon, 23 Nov 2026 00:02:32 +0000',
  rates: { GHS: 12.955712, USD: 1.097534, EUR: 1, GBP: 0.838075, JPY: 160 }
};

function mockFetch(impl) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

function ok(data) {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

afterEach(function () { vi.unstubAllGlobals(); });

describe('GET /api/rates', function () {
  it('serves live rates with freshness metadata', async function () {
    mockFetch(async function () { return ok(LIVE); });
    var res = await onRequestGet();
    var body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.source).toBe('live');
    expect(body.stale).toBe(false);
    expect(body.rates.GHS).toBeCloseTo(12.955712, 5);
    expect(body.rates.GBP).toBeCloseTo(0.838075, 5);
    expect(body.as_of).toContain('2026-11-23');
    expect(Object.keys(body.rates).sort()).toEqual(['EUR', 'GBP', 'GHS', 'USD']);
    expect(res.headers.get('Cache-Control')).toContain('max-age=300');
  });

  it('serves cached rates when the provider is unavailable', async function () {
    mockFetch(async function () { throw new Error('network down'); });
    var res = await onRequestGet();
    var body = await res.json();
    expect(['cache', 'fallback']).toContain(body.source);
    expect(body.rates.USD).toBeGreaterThan(0);
    expect(body.rates.GHS).toBeGreaterThan(0);
  });

  it('rejects POST', async function () {
    var request = new Request('http://localhost/api/rates', { method: 'POST' });
    var res = await onRequest({ request: request });
    expect(res.status).toBe(405);
  });
});

describe('ghsToUsd', function () {
  it('uses a pinned GHS-per-USD rate with consistent fields', async function () {
    var out = await ghsToUsd(250, { GHS_USD_RATE: '15' });
    expect(out.usd).toBe(16.67);
    expect(out.rate).toBe(15);
    expect(out.ghsPerUsd).toBe(15);
    expect(out.source).toBe('pinned');
    expect(out.stale).toBe(false);
  });

  it('normalises the live rate to GHS per USD', async function () {
    mockFetch(async function () { return ok({ result: 'success', rates: { USD: 0.08471 } }); });
    var out = await ghsToUsd(1000, {});
    expect(out.usd).toBe(84.71);
    expect(out.rate).toBe(11.8);
    expect(out.source).toBe('live');
    expect(out.stale).toBe(false);
  });

  it('marks the emergency rate as stale', async function () {
    mockFetch(async function () { throw new Error('network down'); });
    var out = await ghsToUsd(1000, {});
    expect(out.rate).toBe(12);
    expect(out.stale).toBe(true);
    expect(out.source).toBe('fallback');
  });
});
