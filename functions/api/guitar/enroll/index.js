import { getUser, json } from '../_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const user = await getUser(context);
  if (!user) return json({error:'Auth required'}, 401);

  if (req.method === 'POST') {
    const existing = await db.prepare("SELECT id, status FROM guitar_payments WHERE user_id = ? ORDER BY id DESC LIMIT 1").bind(user.id).first();
    if (existing && existing.status === 'completed') return json({ok:true, alreadyUnlocked: true});

    const tx_ref = 'GUITAR_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    await db.prepare("INSERT INTO guitar_payments (user_id, email, status, flw_tx_ref, amount, plan) VALUES (?, ?, ?, ?, 250, ?)").bind(user.id, user.email, 'pending', tx_ref, 'full').run();
    return json({tx_ref, amount: 250, currency: 'GHS', message: 'Proceed to payment to unlock all modules'});
  }
  return json({error:'Method not allowed'}, 405);
}
