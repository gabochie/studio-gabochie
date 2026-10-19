import { requireAdmin } from '../_auth.js';

// Admin-only view of email engagement.
//
// Surfaces the `tracking_events` table (open / click) that the pixel and click
// redirect have been writing all along but nothing read, plus an email_queue
// funnel and a per-contact drill-down so you can answer "who got it, opened it,
// clicked it" for one person without leaving the dashboard.

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const email = (url.searchParams.get('email') || '').trim().toLowerCase();
    if (email) return json(await contactProfile(env.DB, email));

    const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10) || 30, 365);
    const since = '-' + days + ' days';

    const funnel = await env.DB.prepare(
      `SELECT
         COUNT(*) AS queued,
         COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) AS sent,
         COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered,
         COALESCE(SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS opened,
         COALESCE(SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS clicked,
         COALESCE(SUM(CASE WHEN status IN ('failed', 'bounced') THEN 1 ELSE 0 END), 0) AS failed
       FROM email_queue
       WHERE created_at >= datetime('now', ?)`
    ).bind(since).first();

    const byType = await env.DB.prepare(
      `SELECT COALESCE(NULLIF(email_type,''), 'other') AS email_type, COUNT(*) AS queued,
              COALESCE(SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END),0) AS sent,
              COALESCE(SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END),0) AS opened,
              COALESCE(SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END),0) AS clicked
       FROM email_queue WHERE created_at >= datetime('now', ?)
       GROUP BY email_type ORDER BY queued DESC LIMIT 20`
    ).bind(since).all();

    const trackingByType = await env.DB.prepare(
      `SELECT event_type, COUNT(*) AS count FROM tracking_events
       WHERE created_at >= datetime('now', ?) GROUP BY event_type ORDER BY count DESC`
    ).bind(since).all();

    const trackingAllTime = await env.DB.prepare(
      'SELECT event_type, COUNT(*) AS count FROM tracking_events GROUP BY event_type ORDER BY count DESC'
    ).all();

    const recentEvents = await env.DB.prepare(
      `SELECT t.id, t.message_id, t.event_type, t.event_data, t.created_at,
              q.to_email, q.subject, q.email_type
         FROM tracking_events t
         LEFT JOIN email_queue q ON q.id = t.message_id
        ORDER BY t.created_at DESC LIMIT 50`
    ).all();

    const suppression = await env.DB.prepare(
      'SELECT COALESCE(NULLIF(reason,\'\'), \'other\') AS reason, COUNT(*) AS count FROM suppression_list GROUP BY reason ORDER BY count DESC'
    ).all();

    const byDay = await env.DB.prepare(
      `SELECT DATE(created_at) AS day,
              COUNT(*) AS queued,
              COALESCE(SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END),0) AS sent,
              COALESCE(SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END),0) AS opened,
              COALESCE(SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END),0) AS clicked
       FROM email_queue WHERE created_at >= datetime('now', ?)
       GROUP BY day ORDER BY day`
    ).bind(since).all();

    const suppressed = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM suppression_list').first();

    return json({
      status: 'ok',
      days: days,
      funnel: funnel || {},
      by_type: byType.results || [],
      tracking_by_type: trackingByType.results || [],
      tracking_all_time: trackingAllTime.results || [],
      recent_events: recentEvents.results || [],
      suppression: { total: (suppressed && suppressed.cnt) || 0, by_reason: suppression.results || [] },
      by_day: byDay.results || []
    });
  } catch (_err) {
    return json({ status: 'error', message: 'Internal error' }, 500);
  }
}

async function contactProfile(db, email) {
  const cold = await db.prepare(
    'SELECT id, name, campaign, source, status, category, region FROM cold_outreach WHERE email = ? LIMIT 1'
  ).bind(email).first();

  const sub = await db.prepare(
    'SELECT id, name, source, edition, subscribed_at, lotl_daily, confirmed FROM subscribers WHERE email = ? LIMIT 1'
  ).bind(email).first();

  const sends = await db.prepare(
    `SELECT id, subject, email_type, status, scheduled_at, sent_at, opened_at, clicked_at, last_error
       FROM email_queue WHERE LOWER(to_email) = ? ORDER BY created_at DESC LIMIT 100`
  ).bind(email).all();

  const ids = (sends.results || []).map(function (r) { return r.id; });
  let events = [];
  if (ids.length) {
    const placeholders = ids.map(function () { return '?'; }).join(',');
    const ev = await db.prepare(
      `SELECT t.id, t.message_id, t.event_type, t.event_data, t.created_at
         FROM tracking_events t WHERE t.message_id IN (${placeholders})
        ORDER BY t.created_at DESC LIMIT 100`
    ).bind.apply(null, ids);
    const res = await ev.all();
    events = res.results || [];
  }

  const opens = (sends.results || []).filter(function (r) { return !!r.opened_at; }).length;
  const clicks = (sends.results || []).filter(function (r) { return !!r.clicked_at; }).length;
  const delivered = (sends.results || []).filter(function (r) { return r.status === 'sent' || r.status === 'delivered'; }).length;

  const suppressed = await db.prepare('SELECT reason, created_at FROM suppression_list WHERE LOWER(email) = ?').bind(email).first();

  return {
    status: 'ok',
    email: email,
    cold_outreach: cold || null,
    subscriber: sub || null,
    suppression: suppressed || null,
    summary: {
      sends: (sends.results || []).length,
      delivered: delivered,
      opened: opens,
      clicked: clicks,
      suppressed: !!suppressed
    },
    sends: sends.results || [],
    events: events
  };
}
