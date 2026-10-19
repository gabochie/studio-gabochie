/**
 * Outreach Metrics API
 * GET /api/admin/outreach/metrics?period=7d
 * Returns funnel metrics for email outreach
 */
export async function onRequest(context) {
  const { request, env } = context;
  
  // Verify admin auth
  const authError = await requireAdminAuth(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '7d';
  const days = parsePeriod(period);

  const since = new Date(Date.now() - days * 86400000).toISOString();

  try {
    // Overall email funnel
    const emailStats = await getEmailFunnel(env, since);
    
    // By workflow
    const workflowStats = await getWorkflowStats(env, since);
    
    // By day (for charts)
    const dailyStats = await getDailyStats(env, since);

    // Contact list stats
    const contactStats = await getContactStats(env);

    return new Response(JSON.stringify({
      period,
      since,
      email: emailStats,
      workflows: workflowStats,
      daily: dailyStats,
      contacts: contactStats
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    console.error('Metrics error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch metrics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function getEmailFunnel(env, since) {
  const total = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM email_queue WHERE created_at >= ?`
  ).bind(since).first();

  const sent = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM email_queue WHERE sent_at >= ?`
  ).bind(since).first();

  const delivered = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM email_queue WHERE status = 'delivered' AND sent_at >= ?`
  ).bind(since).first();

  const opened = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM email_queue WHERE opened_at >= ?`
  ).bind(since).first();

  const clicked = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM email_queue WHERE clicked_at >= ?`
  ).bind(since).first();

  const bounced = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM email_queue WHERE status IN ('bounced', 'soft_bounced') AND sent_at >= ?`
  ).bind(since).first();

  const complained = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM email_queue WHERE status = 'complained' AND sent_at >= ?`
  ).bind(since).first();

  const unsubscribed = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM email_queue WHERE status = 'unsubscribed' AND sent_at >= ?`
  ).bind(since).first();

  const failed = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM email_queue WHERE status = 'failed' AND created_at >= ?`
  ).bind(since).first();

  const queued = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM email_queue WHERE status = 'pending'`
  ).first();

  const sentCnt = sent?.cnt || 0;
  const deliveredCnt = delivered?.cnt || 0;
  const openedCnt = opened?.cnt || 0;
  const clickedCnt = clicked?.cnt || 0;

  return {
    queued: queued?.cnt || 0,
    sent: sentCnt,
    delivered: deliveredCnt,
    opened: openedCnt,
    clicked: clickedCnt,
    bounced: bounced?.cnt || 0,
    complained: complained?.cnt || 0,
    unsubscribed: unsubscribed?.cnt || 0,
    failed: failed?.cnt || 0,
    rates: {
      delivery: sentCnt ? Math.round((deliveredCnt / sentCnt) * 10000) / 100 : 0,
      open: deliveredCnt ? Math.round((openedCnt / deliveredCnt) * 10000) / 100 : 0,
      click: openedCnt ? Math.round((clickedCnt / openedCnt) * 10000) / 100 : 0,
      clickToDelivery: deliveredCnt ? Math.round((clickedCnt / deliveredCnt) * 10000) / 100 : 0,
      bounce: sentCnt ? Math.round(((bounced?.cnt || 0) / sentCnt) * 10000) / 100 : 0,
      complaint: sentCnt ? Math.round(((complained?.cnt || 0) / sentCnt) * 10000) / 100 : 0
    }
  };
}

async function getWorkflowStats(env, since) {
  const workflows = await env.DB.prepare(
    `SELECT name, trigger_type FROM workflows WHERE status = 'active'`
  ).all();

  const results = {};
  
  for (const wf of workflows.results || []) {
    // Get emails sent for this workflow (by email_type tag)
    const stats = await env.DB.prepare(
      `SELECT 
         COUNT(*) as sent,
         SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
         SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
         SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
         SUM(CASE WHEN status IN ('bounced', 'soft_bounced') THEN 1 ELSE 0 END) as bounced,
         SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) as unsubscribed
       FROM email_queue 
       WHERE email_type = ? AND created_at >= ?`
    ).bind(wf.name, since).first();

    results[wf.name] = stats || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
  }

  return results;
}

async function getDailyStats(env, since) {
  const rows = await env.DB.prepare(
    `SELECT 
       date(created_at) as day,
       COUNT(*) as queued,
       SUM(CASE WHEN sent_at IS NOT NULL THEN 1 ELSE 0 END) as sent,
       SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
       SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked
     FROM email_queue 
     WHERE created_at >= ?
     GROUP BY date(created_at)
     ORDER BY day ASC`
  ).bind(since).all();

  return rows.results || [];
}

async function getContactStats(env) {
  const total = await env.DB.prepare(`SELECT COUNT(*) as cnt FROM cold_outreach`).first();
  const byStatus = await env.DB.prepare(
    `SELECT status, COUNT(*) as cnt FROM cold_outreach GROUP BY status`
  ).all();
  const byCategory = await env.DB.prepare(
    `SELECT category, COUNT(*) as cnt FROM cold_outreach WHERE category != '' GROUP BY category ORDER BY cnt DESC LIMIT 10`
  ).all();

  return {
    total: total?.cnt || 0,
    byStatus: byStatus.results || [],
    topCategories: byCategory.results || []
  };
}

function parsePeriod(str) {
  const match = str.match(/^(\d+)([dwmy])$/);
  if (!match) return 7;
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 'd': return value;
    case 'w': return value * 7;
    case 'm': return value * 30;
    case 'y': return value * 365;
    default: return 7;
  }
}

// Reuse admin auth from existing module
async function requireAdminAuth(request, env) {
  const adminKey = request.headers.get('X-Admin-Key');
  if (!adminKey || adminKey !== env.ADMIN_API_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return null;
}