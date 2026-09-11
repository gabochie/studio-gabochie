import { requireAdmin } from '../_auth.js';

export async function onRequest(context) {
  var { request, env } = context;
  var db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    // Waitlist stats
    var waitlistCount = 0, waitlistToday = 0, waitlistRecent = [];
    try {
      var wl = await db.prepare('SELECT COUNT(*) AS cnt FROM guitar_waitlist').first();
      waitlistCount = wl ? wl.cnt : 0;
      var wlToday = await db.prepare("SELECT COUNT(*) AS cnt FROM guitar_waitlist WHERE date(registered_at) = date('now')").first();
      waitlistToday = wlToday ? wlToday.cnt : 0;
      var wlRecent = await db.prepare('SELECT w.id, w.name, w.email, w.phone, w.skill_level, w.registered_at FROM guitar_waitlist w ORDER BY w.registered_at DESC LIMIT 20').all();
      waitlistRecent = wlRecent.results || [];
    } catch(_) {}

    // Payment stats
    var totalPayments = 0, paymentSum = 0, pendingPayments = 0, paymentsRecent = [];
    try {
      var t = await db.prepare("SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total FROM guitar_payments WHERE status = 'completed'").first();
      if (t) { totalPayments = t.cnt || 0; paymentSum = t.total || 0; }
      var p = await db.prepare("SELECT COUNT(*) AS cnt FROM guitar_payments WHERE status = 'pending'").first();
      pendingPayments = p ? p.cnt : 0;
      var pr = await db.prepare('SELECT p.id, p.email, p.status, p.amount, p.flw_tx_ref, p.created_at FROM guitar_payments p ORDER BY p.created_at DESC LIMIT 20').all();
      paymentsRecent = pr.results || [];
    } catch(_) {}

    // User stats
    var totalStudents = 0, totalSessions = 0, totalPracticeMin = 0, topStudents = [];
    try {
      var s = await db.prepare("SELECT COUNT(*) AS cnt, COALESCE(SUM(total_sessions),0) AS sess, COALESCE(SUM(total_practice_min),0) AS mins FROM guitar_user_stats").first();
      if (s) { totalStudents = s.cnt || 0; totalSessions = s.sess || 0; totalPracticeMin = s.mins || 0; }
      var top = await db.prepare('SELECT u.name, u.email, gs.total_xp, gs.level, gs.streak, gs.total_sessions, gs.total_practice_min FROM guitar_user_stats gs JOIN users u ON gs.user_id = u.id ORDER BY gs.total_xp DESC LIMIT 10').all();
      topStudents = top.results || [];
    } catch(_) {}

    // Conversion events
    var eventsByType = [], eventsToday = 0, eventsRecent = [];
    try {
      var ebt = await db.prepare("SELECT event_type, COUNT(*) AS cnt FROM guitar_conversion_events GROUP BY event_type ORDER BY cnt DESC").all();
      eventsByType = ebt.results || [];
      var et = await db.prepare("SELECT COUNT(*) AS cnt FROM guitar_conversion_events WHERE date(created_at) = date('now')").first();
      eventsToday = et ? et.cnt : 0;
      var er = await db.prepare('SELECT id, event_type, page_url, source, user_id, created_at FROM guitar_conversion_events ORDER BY created_at DESC LIMIT 30').all();
      eventsRecent = er.results || [];
    } catch(_) {}

    // Streak stats
    var streak7 = 0, streak14 = 0, streak30 = 0;
    try {
      var s7 = await db.prepare("SELECT COUNT(*) AS cnt FROM guitar_user_stats WHERE streak >= 7").first();
      streak7 = s7 ? s7.cnt : 0;
      var s14 = await db.prepare("SELECT COUNT(*) AS cnt FROM guitar_user_stats WHERE streak >= 14").first();
      streak14 = s14 ? s14.cnt : 0;
      var s30 = await db.prepare("SELECT COUNT(*) AS cnt FROM guitar_user_stats WHERE streak >= 30").first();
      streak30 = s30 ? s30.cnt : 0;
    } catch(_) {}

    return new Response(JSON.stringify({
      status: 'ok',
      waitlist: { total: waitlistCount, today: waitlistToday, recent: waitlistRecent },
      payments: { total: totalPayments, sum: paymentSum, pending: pendingPayments, recent: paymentsRecent },
      students: { total: totalStudents, total_sessions: totalSessions, total_practice_min: totalPracticeMin,
        top: topStudents, streak7, streak14, streak30 },
      events: { byType: eventsByType, today: eventsToday, recent: eventsRecent }
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
