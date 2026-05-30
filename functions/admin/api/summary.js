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
    const subs = await env.DB.prepare(
      "SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN subscribed_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END), 0) AS this_week, COALESCE(SUM(CASE WHEN subscribed_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END), 0) AS this_month FROM subscribers"
    ).first();

    const donations = await env.DB.prepare(
      "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total, COALESCE(SUM(CASE WHEN status = 'successful' THEN amount ELSE 0 END), 0) AS total_successful, COALESCE(SUM(CASE WHEN status = 'successful' AND created_at >= datetime('now', '-30 days') THEN amount ELSE 0 END), 0) AS month_successful FROM donations"
    ).first();

    const bookings = await env.DB.prepare(
      "SELECT COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0) AS pending, COALESCE(SUM(CASE WHEN status='active' THEN 1 ELSE 0 END),0) AS active, COALESCE(SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END),0) AS completed FROM bookings"
    ).first();

    // Booking revenue
    const bookingRevenue = await env.DB.prepare(
      "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM bookings WHERE status IN ('paid', 'active', 'completed')"
    ).first();

    // Reconciliation: failed and other donation statuses
    const reconDonationsFailed = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM donations WHERE status IN ('failed', 'transfer_failed', 'refund_failed')"
    ).first();
    const reconDonationsOther = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM donations WHERE status NOT IN ('successful', 'failed', 'transfer_failed', 'refund_failed') AND status != ''"
    ).first();

    const enrollments = await env.DB.prepare(
      "SELECT COALESCE(SUM(CASE WHEN status='active' THEN 1 ELSE 0 END),0) AS active, COUNT(*) AS total FROM enrollments"
    ).first();

    const views = await env.DB.prepare(
      "SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN viewed_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END), 0) AS this_week, COALESCE(SUM(CASE WHEN viewed_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END), 0) AS this_month FROM page_views"
    ).first();

    const viewsByPage = await env.DB.prepare(
      "SELECT page, COUNT(*) AS count FROM page_views WHERE viewed_at >= datetime('now', '-30 days') GROUP BY page ORDER BY count DESC LIMIT 10"
    ).all();

    const viewsByDay = await env.DB.prepare(
      "SELECT DATE(viewed_at) AS day, COUNT(*) AS count FROM page_views WHERE viewed_at >= datetime('now', '-30 days') GROUP BY day ORDER BY day"
    ).all();

    const viewsByCountry = await env.DB.prepare(
      "SELECT COALESCE(NULLIF(country,''), 'Unknown') AS country, COUNT(*) AS count FROM page_views WHERE viewed_at >= datetime('now', '-30 days') AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 20"
    ).all();

    const uniqueVisitors = await env.DB.prepare(
      "SELECT COUNT(DISTINCT ip) AS total, COALESCE(COUNT(DISTINCT CASE WHEN viewed_at >= datetime('now', '-7 days') THEN ip END), 0) AS this_week, COALESCE(COUNT(DISTINCT CASE WHEN viewed_at >= datetime('now', '-30 days') THEN ip END), 0) AS this_month FROM page_views WHERE ip IS NOT NULL AND ip != ''"
    ).first();

    const donationsByMonth = await env.DB.prepare(
      "SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count, COALESCE(SUM(CASE WHEN status='successful' THEN amount ELSE 0 END), 0) AS total FROM donations WHERE created_at >= datetime('now', '-12 months') GROUP BY month ORDER BY month"
    ).all();

    const subsByMonth = await env.DB.prepare(
      "SELECT strftime('%Y-%m', subscribed_at) AS month, COUNT(*) AS count FROM subscribers WHERE subscribed_at >= datetime('now', '-12 months') GROUP BY month ORDER BY month"
    ).all();

    // Event funnel (last 30 days)
    const events = await env.DB.prepare(
      "SELECT event_type, COUNT(*) AS count FROM events WHERE created_at >= datetime('now', '-30 days') GROUP BY event_type ORDER BY count DESC"
    ).all();

    // Subscriber conversion rate (this month subs / page views)
    const conversion = await env.DB.prepare(
      "SELECT COALESCE((SELECT COUNT(*) FROM subscribers WHERE subscribed_at >= datetime('now', '-30 days')) * 1.0 / NULLIF((SELECT COUNT(*) FROM page_views WHERE viewed_at >= datetime('now', '-30 days')), 0), 0) AS rate"
    ).first();

    let recent = [];
    const recentDonations = await env.DB.prepare(
      "SELECT 'donation' AS type, donor_name AS name, amount AS val, status AS note, created_at AS ts FROM donations ORDER BY created_at DESC LIMIT 5"
    ).all();
    const recentSubs = await env.DB.prepare(
      "SELECT 'subscriber' AS type, name, email AS val, source AS note, subscribed_at AS ts FROM subscribers ORDER BY subscribed_at DESC LIMIT 5"
    ).all();
    const recentBookings = await env.DB.prepare(
      "SELECT 'booking' AS type, name, ad_type AS val, status AS note, created_at AS ts FROM bookings ORDER BY created_at DESC LIMIT 5"
    ).all();
    recent = [...recentDonations.results, ...recentSubs.results, ...recentBookings.results]
      .sort((a,b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 10);

    return new Response(JSON.stringify({
      status: 'ok',
      recon_donations_failed: reconDonationsFailed.count,
      recon_donations_other: reconDonationsOther.count,
      subscribers: { total: subs.total, this_week: subs.this_week, this_month: subs.this_month },
      donations: {
        count: donations.count,
        total: donations.total,
        total_successful: donations.total_successful,
        month_successful: donations.month_successful
      },
      bookings: { pending: bookings.pending, active: bookings.active, completed: bookings.completed, revenue: bookingRevenue.total, paid_count: bookingRevenue.count },
      enrollments: { total: enrollments.total, active: enrollments.active },
      page_views: { total: views.total, this_week: views.this_week, this_month: views.this_month },
      unique_visitors: {
        total: uniqueVisitors.total,
        this_week: uniqueVisitors.this_week,
        this_month: uniqueVisitors.this_month
      },
      events: { items: events.results },
      conversion: { rate: conversion.rate },
      charts: {
        views_by_day: viewsByDay.results,
        views_by_page: viewsByPage.results,
        views_by_country: viewsByCountry.results,
        donations_by_month: donationsByMonth.results,
        subs_by_month: subsByMonth.results
      },
      recent
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
