export async function onRequest(context) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (context.request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (context.request.method !== 'GET') return new Response(JSON.stringify({ error: 'GET required' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
  const db = context.env.DB;
  if (!db) return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const { total, today } = await db.prepare('SELECT (SELECT COUNT(*) FROM guitar_waitlist) AS total, (SELECT COUNT(*) FROM guitar_waitlist WHERE date(registered_at) = date(\'now\')) AS today').first();
    return new Response(JSON.stringify({ status: 'ok', total: total || 0, today: today || 0 }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}
