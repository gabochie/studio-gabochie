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
    const signature = request.headers.get('verif-hash');
    const expectedHash = env.FLW_SECRET_HASH;
    if (!signature || (expectedHash && signature !== expectedHash)) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid signature' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    const body = await request.json();
    const { event, data } = body;
    if (event !== 'charge.completed' && event !== 'transfer.completed') {
      return new Response(JSON.stringify({ status: 'ok', message: 'Ignored event' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const tx_ref = data.tx_ref || '';
    const amount = parseFloat(data.amount) || 0;
    const currency = data.currency || 'GHS';
    const status = data.status || 'pending';
    const flw_id = String(data.id || '');
    const customer = data.customer || {};
    const donor_name = customer.name || customer.fullName || data.full_name || '';
    const donor_email = customer.email || data.email || '';
    const created_at = data.created_at || new Date().toISOString();
    await db.prepare(
      `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, status, flw_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tx_ref) DO UPDATE SET status = excluded.status, flw_id = excluded.flw_id`
    ).bind(tx_ref, amount, currency, donor_name, donor_email, status, flw_id, created_at).run();

    // If this is an ad booking payment, update the booking status
    if (tx_ref.startsWith('booking_')) {
      const bookingId = tx_ref.replace('booking_', '').split('_')[0];
      if (bookingId) {
        await db.prepare(
          `UPDATE bookings SET status = ?, payment_tx_ref = ? WHERE id = ?`
        ).bind('active', tx_ref, bookingId).run();
      }
    }
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
