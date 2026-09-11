export async function onRequest(context) {
  const { env } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), { status: 501, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const registrations = await db.prepare(
      `SELECT id, name, email, phone, region, created_at FROM nationbuilding_registrations ORDER BY created_at DESC LIMIT 50`
    ).all();
    return new Response(JSON.stringify({ status: 'ok', registrations: registrations.results }), { headers: { 'Content-Type': 'application/json' } });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
