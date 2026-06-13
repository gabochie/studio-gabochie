import { getUser, json } from '../_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  const user = await getUser(context);
  if (!user) return json({unlocked: false});
  const payment = await db.prepare("SELECT status FROM guitar_payments WHERE user_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1").bind(user.id).first();
  return json({unlocked: !!payment, trialModules: 3});
}
