export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  if (!env.DB) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  try {
    var tiers = await env.DB.prepare("SELECT slug, name, description, monthly_price_ghs, yearly_price_ghs, features, badge, sort_order FROM unified_tiers ORDER BY sort_order ASC").all();
    var flwKey = env.FLW_PUBLIC_KEY || 'FLWPUBK-6b8e97034170a30c3e07c20e4eab58af-X';
    return new Response(JSON.stringify({
      status: 'ok',
      tiers: (tiers.results || []).map(function(t) {
        var parsed;
        try { parsed = JSON.parse(t.features); } catch(e) { parsed = []; }
        return {
          slug: t.slug,
          name: t.name,
          description: t.description,
          monthly_price_ghs: t.monthly_price_ghs,
          yearly_price_ghs: t.yearly_price_ghs,
          features: parsed,
          badge: t.badge,
          sort_order: t.sort_order
        };
      }),
      currency: 'GHS',
      public_key: flwKey
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
