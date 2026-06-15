import { getUser, json } from '../_utils.js';

export async function onRequest(context) {
  const db = context.env.DB;
  const user = await getUser(context);
  if (!user) return json({unlocked: false});
  const payment = await db.prepare("SELECT status FROM guitar_payments WHERE user_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1").bind(user.id).first();
  let freeModules = 3;
  try {
    const row = await db.prepare("SELECT value FROM settings WHERE key = 'guitar_free_modules'").first();
    if (row) freeModules = parseInt(row.value) || 3;
  } catch (_) {}
  return json({unlocked: !!payment, freeModules});
}
