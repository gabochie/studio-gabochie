import { json } from '../_utils.js';
import { sendGuitarReceipt, guitarBuyer } from '../_receipt.js';

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
    const flwId = body.data.id;

    // Verify with Flutterwave before unlocking: never trust the webhook body alone.
    if (!context.env.FLW_SECRET_KEY || !flwId) {
      return json({error:'Verification unavailable'}, 503);
    }
    try {
      const verifyResp = await fetch(
        `https://api.flutterwave.com/v3/transactions/${flwId}/verify`,
        { headers: { 'Authorization': 'Bearer ' + context.env.FLW_SECRET_KEY } }
      );
      if (!verifyResp.ok) return json({error:'Verification failed'}, 502);
      const verifyData = await verifyResp.json();
      const v = (verifyData.status === 'success' && verifyData.data) ? verifyData.data : null;
      if (!v || v.status !== 'successful' || v.tx_ref !== txRef) {
        return json({error:'Transaction not confirmed'}, 402);
      }
    } catch (_e) {
      return json({error:'Verification failed'}, 502);
    }

    await db.prepare("UPDATE guitar_payments SET status = 'completed' WHERE flw_tx_ref = ?").bind(txRef).run();

    const payment = await db.prepare("SELECT user_id FROM guitar_payments WHERE flw_tx_ref = ?").bind(txRef).first();
    if (payment?.user_id) {
      await db.prepare(
        `INSERT INTO guitar_user_stats (user_id, total_xp, level, updated_at)
         VALUES (?, 0, 1, datetime('now'))
         ON CONFLICT(user_id) DO NOTHING`
      ).bind(payment.user_id).run();
    }
    var buyer = await guitarBuyer(db, txRef, (body.data && body.data.customer && body.data.customer.email) || '');
    var verifiedAmount = (body.data && body.data.amount) || '';
    await sendGuitarReceipt(context.env, { email: buyer.email, name: buyer.name, phone: buyer.phone, txRef: txRef, amount: verifiedAmount });
  }

  return json({ok:true});
}
