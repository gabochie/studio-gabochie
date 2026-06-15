import { getUser, json } from '../_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const user = await getUser(context);
  if (!user) return json({error:'Auth required'}, 401);

  let price = 250, currency = 'GHS';
  try {
    const pRow = await db.prepare("SELECT value FROM settings WHERE key = 'guitar_price'").first();
    if (pRow) price = parseInt(pRow.value) || 250;
    const cRow = await db.prepare("SELECT value FROM settings WHERE key = 'guitar_currency_symbol'").first();
    if (cRow) currency = cRow.value;
  } catch (_) {}

  if (req.method === 'POST') {
    const existing = await db.prepare("SELECT id, status FROM guitar_payments WHERE user_id = ? ORDER BY id DESC LIMIT 1").bind(user.id).first();
    if (existing && existing.status === 'completed') return json({ok:true, alreadyUnlocked: true});

    const tx_ref = 'GUITAR_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    await db.prepare("INSERT INTO guitar_payments (user_id, email, status, flw_tx_ref, amount, plan) VALUES (?, ?, ?, ?, ?, ?)").bind(user.id, user.email, 'pending', tx_ref, price, 'full').run();
    return json({tx_ref, amount: price, currency, message: 'Proceed to payment to unlock all modules'});
  }
  return json({error:'Method not allowed'}, 405);
}
