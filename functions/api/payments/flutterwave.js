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
    if (!signature) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing signature' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    // Verify signature against FLW_SECRET_HASH
    const expectedHash = env.FLW_SECRET_HASH;
    if (expectedHash && signature !== expectedHash) {
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
    const flw_id = String(data.id || '');
    const amount = parseFloat(data.amount) || 0;
    const currency = data.currency || 'GHS';
    const status = data.status || 'pending';
    const customer = data.customer || {};
    const donor_name = customer.name || customer.fullName || data.full_name || '';
    const donor_email = customer.email || data.email || '';
    const created_at = data.created_at || new Date().toISOString();

    // Verify transaction with Flutterwave API
    let verifiedAmount = amount;
    let verifiedStatus = status;
    let verifiedCurrency = currency;
    if (env.FLW_SECRET_KEY && flw_id) {
      try {
        const verifyResp = await fetch(
          `https://api.flutterwave.com/v3/transactions/${flw_id}/verify`,
          { headers: { 'Authorization': 'Bearer ' + env.FLW_SECRET_KEY } }
        );
        if (verifyResp.ok) {
          const verifyData = await verifyResp.json();
          if (verifyData.status === 'success' && verifyData.data) {
            verifiedAmount = parseFloat(verifyData.data.amount) || verifiedAmount;
            verifiedCurrency = verifyData.data.currency || verifiedCurrency;
            verifiedStatus = verifyData.data.status || verifiedStatus;
          }
        }
      } catch (_e) {}
    }

    await db.prepare(
      `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, status, flw_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tx_ref) DO UPDATE SET
         amount = excluded.amount,
         currency = excluded.currency,
         status = excluded.status,
         flw_id = excluded.flw_id`
    ).bind(tx_ref, verifiedAmount, verifiedCurrency, donor_name, donor_email, verifiedStatus, flw_id, created_at).run();

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
