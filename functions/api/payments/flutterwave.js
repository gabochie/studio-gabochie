export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const body = await request.json();
    const { tx_ref, amount, currency, status, customer, id: flw_id } = body;
    if (!tx_ref || !status) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing required fields' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    const donor_name = customer?.name || '';
    const donor_email = customer?.email || '';
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, status, flw_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tx_ref) DO UPDATE SET status = excluded.status, flw_id = excluded.flw_id`
    ).bind(tx_ref, amount || 0, currency || 'GHS', donor_name, donor_email, status, flw_id || '', now).run();
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
