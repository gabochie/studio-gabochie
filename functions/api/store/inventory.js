export async function onRequest(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ items: [] }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
  try {
    const rows = await db.prepare('SELECT product_slug, size, quantity FROM inventory ORDER BY product_slug, size').all();
    return new Response(JSON.stringify({ items: rows.results || [] }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (_e) {
    return new Response(JSON.stringify({ items: [] }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }
}
