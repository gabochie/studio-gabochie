export async function onRequest(context) {
  const { request, env } = context;
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
      click_rate: clickRate
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
