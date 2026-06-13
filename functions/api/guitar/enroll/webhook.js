import { json } from '../_utils.js';

export async function onRequest(context) {
  if (context.request.method !== 'POST') return json({error:'Method not allowed'}, 405);
  const db = context.env.DB;
  const body = await context.request.json();

  const hash = context.request.headers.get('verif-hash');
  if (!hash || hash !== context.env.FLW_SECRET_HASH) {
    return json({error:'Invalid hash'}, 401);
  }

  if (body.event === 'charge.completed' && body.data?.tx_ref?.startsWith('GUITAR_')) {
    const txRef = body.data.tx_ref;
    const email = body.data?.customer?.email;
    const name = body.data?.customer?.name || email?.split('@')[0] || 'Student';

    await db.prepare("UPDATE guitar_payments SET status = 'completed' WHERE flw_tx_ref = ?").bind(txRef).run();

    const payment = await db.prepare("SELECT user_id FROM guitar_payments WHERE flw_tx_ref = ?").bind(txRef).first();
    if (payment?.user_id) {
      await db.prepare(
        `INSERT INTO guitar_user_stats (user_id, total_xp, level, updated_at)
         VALUES (?, 0, 1, datetime('now'))
         ON CONFLICT(user_id) DO NOTHING`
      ).bind(payment.user_id).run();
    }
  }

  return json({ok:true});
}
