/*
 * GET /api/rates — single canonical FX source for every public price display.
 *
 * The browser used to call open.er-api.com directly from every page. That made
 * each page load depend on a third party, had no timeout and no freshness
 * signal, and every page shipped its own stale hard-coded fallback. This
 * endpoint keeps one live fetch at the edge, caches it briefly, and always
 * tells the caller whether the numbers are live, cached or an emergency
 * fallback.
 *
 * Shape:
 *   { status: 'ok', base: 'EUR',
 *     rates: { GHS, USD, EUR, GBP },
 *     as_of: ISO string | null,
 *     source: 'live' | 'cache' | 'fallback',
 *     stale: boolean,
 *     fetched_at: ISO string | null }
 *
 * This is a DISPLAY service. It never starts, settles or verifies a payment.
 */

var SOURCE_URL = 'https://open.er-api.com/v6/latest/EUR';
var TTL_MS = 6 * 60 * 60 * 1000; // refresh at most every 6 hours per isolate
var SUPPORTED = ['GHS', 'USD', 'EUR', 'GBP'];

// Emergency-only values captured 2026-11-23. Always returned with stale:true
// and source:'fallback'. Never use these to settle or reconcile money.
var FALLBACK = { GHS: 12.955712, USD: 1.097534, EUR: 1, GBP: 0.838075 };

var cached = null; // { rates, as_of, fetched_at }

function headers() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400'
  };
}

function payload(rates, asOf, source, stale, fetchedAt) {
  return {
    status: 'ok',
    base: 'EUR',
    rates: rates,
    as_of: asOf,
    source: source,
    stale: stale,
    fetched_at: fetchedAt
  };
}

function safeDate(value) {
  if (!value) return null;
  var d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function pickRates(raw) {
  if (!raw || !raw.rates) return null;
  var out = {};
  for (var i = 0; i < SUPPORTED.length; i++) {
    var key = SUPPORTED[i];
    var value = Number(raw.rates[key]);
    if (!value || value <= 0) return null;
    out[key] = value;
  }
  return out;
}

async function fetchLive() {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 4000);
  try {
    var res = await fetch(SOURCE_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return null;
    var data = await res.json();
    if (data && data.result && data.result !== 'success') return null;
    var rates = pickRates(data);
    if (!rates) return null;
    return { rates: rates, as_of: safeDate(data.time_last_update_utc), fetched_at: new Date().toISOString() };
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequestGet() {
  var live = await fetchLive();
  if (live) {
    cached = live;
    return new Response(JSON.stringify(payload(live.rates, live.as_of, 'live', false, live.fetched_at)), { headers: headers() });
  }

  if (cached) {
    var stale = Date.now() - new Date(cached.fetched_at).getTime() > TTL_MS;
    return new Response(JSON.stringify(payload(cached.rates, cached.as_of, 'cache', stale, cached.fetched_at)), { headers: headers() });
  }

  return new Response(JSON.stringify(payload(FALLBACK, null, 'fallback', true, null)), { headers: headers() });
}

export async function onRequest(context) {
  if (context && context.request && context.request.method === 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405, headers: headers()
    });
  }
  return onRequestGet();
}
