export async function onRequest(context) {
  const db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const result = await db.prepare('SELECT 1 AS ok').first();
    return new Response(JSON.stringify({ status: 'ok', d1: 'connected', db: result.ok }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
