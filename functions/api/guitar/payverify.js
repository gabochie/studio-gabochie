import { json, corsHeaders } from './_utils.js';
import { sendGuitarReceipt, guitarBuyer } from './_receipt.js';

// Paystack callback verification for the guitar course paywall.
// The checkout pages (school/guitar/waitlist, school/guitar/songs) POST the
// Paystack reference here after a successful popup charge, then unlock the
// user by completing their pending guitar_payments row.
//
// When PAYSTACK_SECRET_KEY is configured the reference is verified
// server-side against Paystack. Without a secret key we fall back to
// settling only references we actually issued (an existing pending row),
// which still stops arbitrary/unknown references from unlocking the course.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return json({ status: 'error', error: 'POST required' }, 405);

  const db = env.DB;
  if (!db) return json({ status: 'error', error: 'D1 not bound' }, 501);

  let body;
  try {
    body = await request.json();
  } catch (_e) {
    return json({ status: 'error', error: 'Invalid JSON body' }, 400);
  }
  const reference = String(body.reference || '').trim();
  if (!reference) return json({ status: 'error', error: 'reference required' }, 400);

  let pending;
  try {
    pending = await db.prepare('SELECT id, user_id, email, amount, status FROM guitar_payments WHERE flw_tx_ref = ?').bind(reference).first();
  } catch (_e) {
    pending = null;
  }
  if (pending && pending.status === 'completed') return json({ status: 'ok', already: true });
  if (!pending) return json({ status: 'error', error: 'Unknown transaction reference' }, 404);

  const secret = env.PAYSTACK_SECRET_KEY || '';
  let amount = Number(pending.amount) || 0;
  let email = pending.email || '';
  let verifiedVia = 'reference';

  if (secret) {
    let verified = null;
    try {
      const vr = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
        headers: { Authorization: 'Bearer ' + secret, Accept: 'application/json' }
      });
      verified = await vr.json().catch(() => null);
    } catch (_e) {
      return json({ status: 'error', error: 'Verification provider error, try again shortly' }, 502);
    }
    const d = verified && verified.data;
    if (!verified || !verified.status || !d || d.status !== 'success') {
      return json({ status: 'error', error: 'Payment not verified', details: (d && d.gateway_response) || (verified && verified.message) || '' }, 400);
    }
    amount = (Number(d.amount) || 0) / 100 || amount;
    if (d.customer && d.customer.email) email = d.customer.email;
    verifiedVia = 'paystack';
  }

  await db.prepare("UPDATE guitar_payments SET status = 'completed' WHERE flw_tx_ref = ?").bind(reference).run();

  if (pending.user_id) {
    try {
      await db.prepare("INSERT INTO guitar_user_stats (user_id, total_xp, level, updated_at) VALUES (?, 0, 1, datetime('now')) ON CONFLICT(user_id) DO NOTHING").bind(pending.user_id).run();
    } catch (_e) {}
  }

  try {
    const buyer = await guitarBuyer(db, reference, email);
    await sendGuitarReceipt(env, { email: buyer.email, name: buyer.name, phone: buyer.phone, txRef: reference, amount: amount });
  } catch (_e) {}

  return json({ status: 'ok', verified: verifiedVia });
}
