// Deprecated: kept as a read-compat alias for /api/tiers.
// Legacy clients requesting the old plan shape get live unified_tiers data.
export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } });

  try {
    var rows = await env.DB.prepare("SELECT slug AS tier, name, description, monthly_price_ghs AS price_ghs, COALESCE(monthly_price_ghs / 12.5, 0) AS price_usd, features, sort_order FROM unified_tiers ORDER BY sort_order").all();
    var plans = rows.results.map(function(p) { return Object.assign({}, p, { description: p.description || '', features: JSON.parse(p.features || '[]') }); });
    return new Response(JSON.stringify({ status: 'ok', plans }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...cors } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
  }
}