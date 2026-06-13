import { json } from './_utils.js';

export async function onRequest(context) {
  if (context.request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const db = context.env.DB;
  const secretKey = context.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return json({ error: 'Paystack not configured' }, 501);

  const body = await context.request.text();
  const signature = context.request.headers.get('x-paystack-signature');
  const expectedSig = await crypto.subtle.importKey('raw', new TextEncoder().encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
    .then(sig => Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join(''));

  if (signature !== expectedSig) return json({ error: 'Invalid signature' }, 401);

  const event = JSON.parse(body);
  if (event.event === 'charge.success' && event.data?.reference?.startsWith('GUITAR_')) {
    const txRef = event.data.reference;
    const email = event.data.customer?.email || '';
    const amount = event.data.amount / 100;

    const existing = await db.prepare("SELECT id FROM guitar_payments WHERE flw_tx_ref = ? AND status = 'completed'").bind(txRef).first();
    if (existing) return json({ ok: true });

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
      await db.prepare("INSERT INTO guitar_user_stats (user_id, total_xp, level) VALUES (?, 0, 1) ON CONFLICT(user_id) DO NOTHING").bind(payment.user_id).run();
    }
  }

  return json({ ok: true });
}
