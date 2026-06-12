import { callAI } from '../agents/_ai.js';

var corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

var REVENUE_SQL = "SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as txns, SUM(amount) as total, AVG(amount) as avg FROM donations WHERE status = 'successful' AND created_at >= datetime('now', '-12 months') GROUP BY month ORDER BY month";
var SUBSCRIBER_SQL = "SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as total FROM subscribers WHERE created_at >= datetime('now', '-12 months') GROUP BY month ORDER BY month";
var PAGEVIEW_SQL = "SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as total FROM page_views WHERE created_at >= datetime('now', '-12 months') GROUP BY month ORDER BY month";
var DONATION_EVENTS_SQL = "SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as total FROM events WHERE event_type = 'donation_started' AND created_at >= datetime('now', '-12 months') GROUP BY month ORDER BY month";
var SUBSCRIPTIONS_SQL = "SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as new_subs, COALESCE(SUM(amount), 0) as revenue FROM subscriptions WHERE status = 'active' AND created_at >= datetime('now', '-12 months') GROUP BY month ORDER BY month";
var TOP_PAGES_SQL = "SELECT page, COUNT(*) as views FROM page_views WHERE created_at >= datetime('now', '-30 days') GROUP BY page ORDER BY views DESC LIMIT 10";

export async function onRequest(context) {
  var { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  try {
    // Fetch all historical data in parallel
    var [revenue, subscribers, pageviews, donationEvents, subscriptions, topPages] = await Promise.all([
      env.DB.prepare(REVENUE_SQL).all().then(function(r) { return r.results || []; }).catch(function() { return []; }),
      env.DB.prepare(SUBSCRIBER_SQL).all().then(function(r) { return r.results || []; }).catch(function() { return []; }),
      env.DB.prepare(PAGEVIEW_SQL).all().then(function(r) { return r.results || []; }).catch(function() { return []; }),
      env.DB.prepare(DONATION_EVENTS_SQL).all().then(function(r) { return r.results || []; }).catch(function() { return []; }),
      env.DB.prepare(SUBSCRIPTIONS_SQL).all().then(function(r) { return r.results || []; }).catch(function() { return []; }),
      env.DB.prepare(TOP_PAGES_SQL).all().then(function(r) { return r.results || []; }).catch(function() { return []; }),
    ]);

    // Build summary for AI
    var totalRevenue = revenue.reduce(function(s, r) { return s + (r.total || 0); }, 0);
    var totalSubs = subscribers.reduce(function(s, r) { return s + (r.total || 0); }, 0);
    var totalViews = pageviews.reduce(function(s, r) { return s + (r.total || 0); }, 0);
    var recentRevenue = revenue.slice(-3);

    var summary = [
      'GideonAbochie Studio — 12-Month Analytics Summary\n',
      'Monthly Revenue (GHS): ' + JSON.stringify(revenue),
      'Monthly New Subscribers: ' + JSON.stringify(subscribers),
      'Monthly Page Views: ' + JSON.stringify(pageviews),
      'Monthly Donation Events: ' + JSON.stringify(donationEvents),
      'Monthly Subscription Revenue: ' + JSON.stringify(subscriptions),
      '\nTotals:',
      '  12-Month Revenue: GHS ' + totalRevenue.toFixed(2),
      '  New Subscribers: ' + totalSubs,
      '  Page Views: ' + totalViews,
      '\nRecent 3 Months Revenue: ' + JSON.stringify(recentRevenue),
      '\nTop Pages (Last 30 Days): ' + JSON.stringify(topPages),
    ].join('\n');

    // Generate AI-powered predictions
    var systemPrompt = 'You are a predictive analytics AI for GideonAbochie Studio. Analyze the historical data and provide concise, data-driven insights. Output valid JSON only.';
    var userPrompt = 'Analyze this 12-month data and respond with JSON only:\n' + summary + '\n\nRespond with: { "revenue_forecast": { "next_month": number, "next_quarter": number, "confidence": "high/medium/low", "trend": "up/down/stable" }, "subscriber_forecast": { "next_month": number, "next_quarter": number, "trend": "up/down/stable" }, "insights": ["insight1", "insight2", "insight3"], "anomalies": ["anomaly1"] || [], "recommendations": ["rec1", "rec2"] }';

    var result = await callAI(env, systemPrompt, userPrompt, { model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 1500 });

    var forecast = {};
    try { forecast = JSON.parse(result.content); } catch (e) { forecast = { error: 'Failed to parse forecast' }; }

    return new Response(JSON.stringify({
      status: 'ok',
      historical: {
        revenue: revenue,
        subscribers: subscribers,
        pageviews: pageviews,
        donationEvents: donationEvents,
        subscriptions: subscriptions,
        topPages: topPages,
        totals: { revenue: totalRevenue, subscribers: totalSubs, pageViews: totalViews }
      },
      forecast: forecast
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}
