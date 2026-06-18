export async function onRequest(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ delivery_fee_local: 20, delivery_fee_upcountry: 50, delivery_free_threshold: 0 }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
  try {
    const rows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('merch_delivery_fee_local','merch_delivery_fee_upcountry','merch_delivery_free_threshold')").all();
    const map = {};
    for (const r of rows.results || []) map[r.key] = r.value;
    return new Response(JSON.stringify({
      delivery_fee_local: parseFloat(map.merch_delivery_fee_local) || 20,
      delivery_fee_upcountry: parseFloat(map.merch_delivery_fee_upcountry) || 50,
      delivery_free_threshold: parseFloat(map.merch_delivery_free_threshold) || 0
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (_e) {
    return new Response(JSON.stringify({ delivery_fee_local: 20, delivery_fee_upcountry: 50, delivery_free_threshold: 0 }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
}
