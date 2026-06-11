export async function onRequest(context) {
  var { request, env, params } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  try {
    var slug = params && params.slug;
    if (!slug) return new Response(JSON.stringify({ error: 'Slug required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

    var campaign = await env.DB.prepare(
      "SELECT *, COALESCE((SELECT SUM(amount) FROM donations WHERE campaign_id = campaigns.id AND status = 'successful'), 0) as raised_amount FROM campaigns WHERE slug = ?"
    ).bind(slug).first();

    if (!campaign) return new Response(JSON.stringify({ error: 'Campaign not found' }), { status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

    var recentDonations = await env.DB.prepare(
      "SELECT donor_name, amount, currency, created_at FROM donations WHERE campaign_id = ? AND status = 'successful' ORDER BY created_at DESC LIMIT 20"
    ).bind(campaign.id).all();

    var donorCount = await env.DB.prepare(
      "SELECT COUNT(DISTINCT donor_email) as c FROM donations WHERE campaign_id = ? AND status = 'successful'"
    ).bind(campaign.id).first();

    var pct = campaign.goal_amount > 0 ? Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100)) : 0;

    return new Response(JSON.stringify({
      status: 'ok',
      campaign: {
        id: campaign.id, name: campaign.name, slug: campaign.slug, description: campaign.description,
        goal_amount: campaign.goal_amount, raised_amount: campaign.raised_amount,
        currency: campaign.currency, type: campaign.type,
        cover_image: campaign.cover_image,
        start_date: campaign.start_date, end_date: campaign.end_date,
        progress_pct: pct,
        donor_count: (donorCount && donorCount.c) || 0,
        recent_donations: (recentDonations.results || []).slice(0, 10)
      }
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
