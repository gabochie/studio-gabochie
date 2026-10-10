import { requireAdmin } from '../../_auth.js';

async function brevoGet(env, path) {
  const resp = await fetch('https://api.brevo.com/v3' + path, { headers: { 'api-key': env.BREVO_API_KEY } });
  if (!resp.ok) throw new Error('Brevo ' + resp.status);
  return resp.json();
}

async function readCache(env, key, maxAgeMin) {
  try {
    if (!env.DB) return null;
    const row = await env.DB.prepare('SELECT payload, updated_at FROM brevo_stats_cache WHERE cache_key = ?').bind(key).first();
    if (!row || !row.payload) return null;
    const ageMin = (Date.now() - new Date(String(row.updated_at).replace(' ', 'T') + 'Z').getTime()) / 60000;
    if (ageMin > maxAgeMin) return null;
    return JSON.parse(row.payload);
  } catch (_e) {
    return null;
  }
}

async function writeCache(env, key, payload) {
  try {
    if (!env.DB) return;
    await env.DB.prepare(
      'INSERT INTO brevo_stats_cache (cache_key, payload, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, updated_at = datetime(\'now\')'
    ).bind(key, JSON.stringify(payload)).run();
  } catch (_e) {}
}

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

    // SMTP engagement: 30-day aggregate + per-day series (cached 1h)
    let engagement = await readCache(env, 'smtp_30d', 60);
    if (!engagement) {
      try {
        const [agg, daily] = await Promise.all([
          brevoGet(env, '/smtp/statistics/aggregatedReport?days=30'),
          brevoGet(env, '/smtp/statistics/reports?days=10')
        ]);
        engagement = {
          delivered: agg.delivered || 0,
          opens: agg.opens || 0,
          unique_opens: agg.uniqueOpens || 0,
          clicks: agg.clicks || 0,
          unique_clicks: agg.uniqueClicks || 0,
          bounces: (agg.hardBounces || 0) + (agg.softBounces || 0),
          complaints: agg.spamReports || 0,
          unsubscribed: agg.unsubscribed || 0,
          open_rate: agg.delivered ? (100 * (agg.uniqueOpens || 0) / agg.delivered) : 0,
          click_rate: agg.delivered ? (100 * (agg.uniqueClicks || 0) / agg.delivered) : 0,
          daily: (daily.reports || []).map(function (r) {
            return { date: r.date, delivered: r.delivered || 0, opens: r.uniqueOpens || 0, clicks: r.uniqueClicks || 0 };
          })
        };
        await writeCache(env, 'smtp_30d', engagement);
      } catch (_e) {
        engagement = null;
      }
    }

    // Per-issue engagement via send tags (only tagged sends report here)
    let issues = await issueProgress(env);
    try {
      const taggable = issues.filter(function (r) { return r.status === 'sent' || r.status === 'sending'; }).slice(0, 5);
      for (const issue of taggable) {
        const cacheKey = 'issue_' + issue.issue_number;
        let per = await readCache(env, cacheKey, 360);
        if (!per) {
          try {
            const rep = await brevoGet(env, '/smtp/statistics/aggregatedReport?days=90&tag=' + encodeURIComponent('newsletter-issue-' + issue.issue_number));
            per = {
              delivered: rep.delivered || 0,
              opens: rep.uniqueOpens || 0,
              clicks: rep.uniqueClicks || 0,
              bounces: (rep.hardBounces || 0) + (rep.softBounces || 0)
            };
            await writeCache(env, cacheKey, per);
          } catch (_e) {
            per = null;
          }
        }
        if (per) issue.engagement = per;
      }
    } catch (_e) {}

    return new Response(JSON.stringify({
      status: 'ok',
      contacts,
      campaigns,
      open_rate: openRate,
      click_rate: clickRate,
      engagement: engagement,
      issues: issues
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
