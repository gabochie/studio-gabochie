export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  try {
    var campaigns = await env.DB.prepare(
      "SELECT *, COALESCE((SELECT SUM(amount) FROM donations WHERE campaign_id = campaigns.id AND status = 'successful'), 0) as raised_amount FROM campaigns WHERE status = 'active' AND (end_date IS NULL OR end_date >= date('now')) ORDER BY created_at DESC"
    ).all();

    return new Response(JSON.stringify({
      status: 'ok',
      items: (campaigns.results || []).map(function(c) {
        var pct = c.goal_amount > 0 ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100)) : 0;
        return { id: c.id, name: c.name, slug: c.slug, description: c.description, goal_amount: c.goal_amount, raised_amount: c.raised_amount, currency: c.currency, type: c.type, cover_image: c.cover_image, start_date: c.start_date, end_date: c.end_date, progress_pct: pct, created_at: c.created_at };
      })
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
