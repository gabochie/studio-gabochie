import { requireAdmin } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    var days = 30;
    var url = new URL(request.url);
    if (url.searchParams.get('days')) days = parseInt(url.searchParams.get('days')) || 30;

    // Device breakdown
    var devices = await env.DB.prepare(
      "SELECT COALESCE(NULLIF(device_type,''), 'Unknown') AS device, COUNT(*) AS count FROM page_views WHERE viewed_at >= datetime('now', '-' || ? || ' days') AND device_type IS NOT NULL AND device_type != '' GROUP BY device ORDER BY count DESC"
    ).bind(days).all();

    // Traffic source breakdown
    var sources = await env.DB.prepare(
      "SELECT COALESCE(NULLIF(source,''), 'Direct') AS source, COUNT(*) AS count FROM page_views WHERE viewed_at >= datetime('now', '-' || ? || ' days') AND source IS NOT NULL AND source != '' GROUP BY source ORDER BY count DESC"
    ).bind(days).all();

    // Top referrer domains (grouped by domain)
    var topReferrers = await env.DB.prepare(
      "SELECT referrer, COUNT(*) AS count FROM page_views WHERE viewed_at >= datetime('now', '-' || ? || ' days') AND referrer IS NOT NULL AND referrer != '' GROUP BY referrer ORDER BY count DESC LIMIT 15"
    ).bind(days).all();

    // Countries
    var countries = await env.DB.prepare(
      "SELECT COALESCE(NULLIF(country,''), 'Unknown') AS country, COUNT(*) AS count FROM page_views WHERE viewed_at >= datetime('now', '-' || ? || ' days') AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 20"
    ).bind(days).all();

    // Total tracked views in period
    var totals = await env.DB.prepare(
      "SELECT COUNT(*) AS total, COUNT(DISTINCT ip) AS uniques FROM page_views WHERE viewed_at >= datetime('now', '-' || ? || ' days')"
    ).bind(days).first();

    // Daily trend (for sparkline)
    var daily = await env.DB.prepare(
      "SELECT DATE(viewed_at) AS day, COUNT(*) AS count, COUNT(DISTINCT ip) AS uniques FROM page_views WHERE viewed_at >= datetime('now', '-' || ? || ' days') GROUP BY day ORDER BY day"
    ).bind(days).all();

    return new Response(JSON.stringify({
      status: 'ok',
      period: days,
      totals: { total: totals.total, uniques: totals.uniques || 0 },
      devices: devices.results.map(function(d) { return { type: d.device, count: d.count, pct: totals.total ? Math.round((d.count / totals.total) * 100) : 0 }; }),
      sources: sources.results.map(function(s) { return { source: s.source, count: s.count, pct: totals.total ? Math.round((s.count / totals.total) * 100) : 0 }; }),
      countries: countries.results.map(function(c) { return { country: c.country, count: c.count, pct: totals.total ? Math.round((c.count / totals.total) * 100) : 0 }; }),
      top_referrers: topReferrers.results,
      daily: daily.results
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
