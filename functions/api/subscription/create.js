export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const body = await request.json();
    const { tier, name, email, plan_id, amount, currency } = body;
    if (!tier || !email) {
      return new Response(JSON.stringify({ error: 'Missing required fields: tier, email' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    const tx_ref = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const planConfig = {
      monthly: { amount: 50, interval: 'monthly' },
      annual: { amount: 500, interval: 'yearly' },
      founding: { amount: 2500, interval: 'yearly' }
    };
    const cfg = planConfig[tier] || planConfig.monthly;
    const finalAmount = amount || cfg.amount;
    const finalCurrency = currency || 'GHS';
    const finalPlanId = plan_id || '';
    await db.prepare(
      `INSERT INTO subscriptions (email, name, tier, amount, currency, flw_plan_id, status, tx_ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))`
    ).bind(email, name || '', tier, finalAmount, finalCurrency, finalPlanId, tx_ref).run();
    return new Response(JSON.stringify({
      status: 'ok',
      tx_ref,
      amount: finalAmount,
      currency: finalCurrency,
      plan_id: finalPlanId,
      customer: { email, name: name || '', phone: body.phone || '' }
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
