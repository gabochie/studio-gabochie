import { requireAdmin } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    if (!env.BREVO_API_KEY) {
      return new Response(JSON.stringify({
        status: 'not_configured',
        message: 'BREVO_API_KEY not set'
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Get contact count from Brevo (list ID 2)
    let contacts = 0;
    try {
      const listResp = await fetch('https://api.brevo.com/v3/contacts/lists/2/contacts?limit=1', {
        headers: { 'api-key': env.BREVO_API_KEY }
      });
      if (listResp.ok) {
        const listData = await listResp.json();
        contacts = listData.count || 0;
      }
    } catch (_e) {}

    // Get campaign stats (recent 5)
    let campaigns = 0;
    let openRate = '—';
    let clickRate = '—';
    try {
      const campResp = await fetch('https://api.brevo.com/v3/emailCampaigns?limit=5&sort=desc', {
        headers: { 'api-key': env.BREVO_API_KEY }
      });
      if (campResp.ok) {
        const campData = await campResp.json();
        campaigns = campData.count || 0;
        if (campData.campaigns && campData.campaigns.length > 0) {
          const latest = campData.campaigns[0];
          openRate = (latest.statistics?.uniqueOpens?.rate || 0).toFixed(1) + '%';
          clickRate = (latest.statistics?.clickers?.rate || 0).toFixed(1) + '%';
        }
      }
    } catch (_e) {}

    return new Response(JSON.stringify({
      status: 'ok',
      contacts,
      campaigns,
      open_rate: openRate,
      click_rate: clickRate,
      issues: await issueProgress(env)
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function issueProgress(env) {
  try {
    if (!env.DB) return [];
    const { results } = await env.DB.prepare(
      'SELECT id, issue_number, subject, subscriber_count, sent_count, failed_count, status, sent_at FROM newsletter_issues ORDER BY issue_number DESC LIMIT 10'
    ).all();
    return (results || []).map(function (r) {
      return {
        issue_number: r.issue_number,
        subject: r.subject,
        status: r.status || 'sent',
        subscribed: r.subscriber_count || 0,
        sent: r.sent_count || 0,
        failed: r.failed_count || 0,
        sent_at: r.sent_at
      };
    });
  } catch (_e) {
    return [];
  }
}
