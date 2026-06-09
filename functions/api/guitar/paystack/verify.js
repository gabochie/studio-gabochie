export async function onRequest(context) {
  const { request, env } = context;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), { status: 501, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  const secretKey = env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return new Response(JSON.stringify({ error: 'Paystack not configured' }), { status: 501, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  try {
    const { reference } = await request.json();
    if (!reference) {
      return new Response(JSON.stringify({ error: 'Reference required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const psResp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    const psData = await psResp.json();

    if (!psData.status || psData.data.status !== 'success') {
      return new Response(JSON.stringify({ error: 'Payment not verified', details: psData.message || '' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const txRef = psData.data.reference;
    const email = psData.data.customer?.email || '';
    const amount = psData.data.amount / 100;

    await db.prepare("UPDATE guitar_payments SET status = 'completed' WHERE flw_tx_ref = ?").bind(txRef).run();

    let payment = await db.prepare("SELECT user_id FROM guitar_payments WHERE flw_tx_ref = ?").bind(txRef).first();
    if (!payment) {
      const user = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
      if (user) {
        await db.prepare("INSERT INTO guitar_payments (user_id, email, status, flw_tx_ref, amount, plan) VALUES (?, ?, 'completed', ?, ?, 'full')").bind(user.id, email, txRef, amount).run();
        payment = { user_id: user.id };
      }
    }
    if (payment?.user_id) {
      await db.prepare(
        `INSERT INTO guitar_user_stats (user_id, total_xp, level, updated_at)
         VALUES (?, 0, 1, datetime('now'))
         ON CONFLICT(user_id) DO NOTHING`
      ).bind(payment.user_id).run();
    }

    return new Response(JSON.stringify({ status: 'ok', message: 'Payment verified and modules unlocked' }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}
