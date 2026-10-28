import { json, readBody } from '../_shared.js';
import { checkRateLimit } from '../../_rate-limit.js';
import { resolvePendingTx } from '../expresspay/create.js';
import { getSessionUser } from '../../enroll/_token.js';

// Manual MTN Mobile Money — direct-to-wallet rail (no gateway).
// The customer sends money to the dedicated MoMo number shown at checkout,
// then submits the MoMo transaction ID via /api/gateways/momo/claim.
// Nothing settles automatically: an admin confirms each claim in the panel
// (POST /api/admin/momo-claims), which routes through the shared settlePaidTx.
// Secrets: MOMO_MANUAL_NUMBER (required to enable the rail),
//          MOMO_MANUAL_NAME (account name shown, default 'Studio Gabochie'),
//          MOMO_MANUAL_NETWORK (default 'MTN').
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'momo_create', 5, 60)) {
    return json({ status: 'error', message: 'Too many requests. Try again later.' }, 429);
  }
  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid JSON body' }, 400);
  }

  const momoNumber = String(env.MOMO_MANUAL_NUMBER || '').trim();
  if (!momoNumber) {
    return json({ status: 'error', message: 'MTN MoMo direct is being set up — please pay with crypto or another method for now.', code: 'momo_unconfigured' });
  }

  // Two modes, mirroring moolre/create.js:
  //  - tx_ref supplied (guitar, tiers, books, store, upgrades...): the amount
  //    is resolved server-side from the pending row and never trusted from the
  //    client. No donation row is staged.
  //  - no tx_ref (open donation): a momom_ ref is generated and a pending
  //    donation row is staged; settlement happens on admin confirmation.
  // Guitar token mode (purpose 'guitar' + session token): mirrors
  // crypto/create.js — prices the plan server-side and stages both a metadata
  // donation row and a pending guitar_payments row for the unlock check.
  const clientRef = String((body && body.tx_ref) || '').trim();
  let tx_ref, amount, name, email, phone, currency, stageDonation, meta = { purpose: body && body.purpose === 'guitar' ? 'guitar' : 'donation' };
  if (clientRef) {
    if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);
    let found = null;
    try {
      found = await resolvePendingTx(env.DB, clientRef);
    } catch (_e) {
      return json({ status: 'error', message: 'Lookup failed' }, 500);
    }
    if (!found) return json({ status: 'error', message: 'Unknown or already-settled transaction' }, 404);
    tx_ref = clientRef;
    amount = found.amount;
    name = String((body && body.name) || found.name || '').trim();
    email = String((body && body.email) || found.email || '').trim();
    phone = String((body && body.phone) || found.phone || '').trim();
    currency = String((body && body.currency) || 'GHS').toUpperCase();
    stageDonation = false;
  } else if ((body && body.purpose) === 'guitar') {
    // Guitar unlock via session token — mirrors crypto/create.js validation.
    if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);
    const gToken = (body.token || '').trim();
    if (!gToken) return json({ status: 'error', message: 'Login required' }, 401);
    let gUser = null;
    try { gUser = await getSessionUser(env.DB, gToken); } catch (_e) {}
    if (!gUser) return json({ status: 'error', message: 'Login required' }, 401);
    var GUITAR_PLAN_RANK = { bronze: 1, silver: 2, gold: 3, apprentice: 4, full: 4 };
    let gPlan = (body.plan || 'full');
    if (!GUITAR_PLAN_RANK[gPlan]) gPlan = 'full';
    // Rank + price checks reuse the crypto endpoint's logic via its own helpers
    // would duplicate code — here we read the same settings keys directly.
    async function guitarPlanPrice(db, plan) {
      try {
        const row = plan === 'full'
          ? await db.prepare("SELECT value FROM settings WHERE key = 'guitar_price'").first()
          : await db.prepare('SELECT value FROM settings WHERE key = ?').bind('guitar_price_' + plan).first();
        if (row && parseInt(row.value)) return parseInt(row.value);
      } catch (_e) {}
      return { bronze: 299, silver: 199, gold: 299, apprentice: 699, full: 299 }[plan] || 299;
    }
    async function guitarOwnedRank(db, userId) {
      try {
        const res = await db.prepare("SELECT plan FROM guitar_payments WHERE user_id = ? AND status = 'completed'").bind(userId).all();
        let rank = 0;
        for (const p of (res && res.results) || []) {
          const r = p.plan ? (GUITAR_PLAN_RANK[p.plan] || 0) : 4;
          if (r > rank) rank = r;
        }
        return rank;
      } catch (_e) { return 0; }
    }
    const gRank = await guitarOwnedRank(env.DB, gUser.user_id);
    if (gRank >= GUITAR_PLAN_RANK[gPlan]) return json({ status: 'ok', already: true, message: 'Already unlocked' });
    if (gPlan === 'silver' && gRank < 1) return json({ status: 'error', message: 'Complete your Bronze registration first — seek first the system.' }, 400);
    if (gPlan === 'gold' && gRank < 2) return json({ status: 'error', message: 'Complete Silver first, or take Apprentice for the full path.' }, 400);
    amount = await guitarPlanPrice(env.DB, gPlan);
    if (!amount || amount <= 0) return json({ status: 'error', message: 'Nothing payable' }, 400);
    name = gUser.name || String((body && body.name) || '').trim();
    email = gUser.email || String((body && body.email) || '').trim();
    phone = String((body && body.phone) || '').trim();
    currency = 'GHS';
    tx_ref = 'momom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    stageDonation = true;
    meta = { purpose: 'guitar', guitar: true, user_id: gUser.user_id, guitarPlan: gPlan };
    try {
      await env.DB.prepare(
        "INSERT INTO guitar_payments (user_id, email, status, flw_tx_ref, amount, plan) VALUES (?, ?, 'pending', ?, ?, ?)"
      ).bind(gUser.user_id, email, tx_ref, amount, gPlan).run();
    } catch (_e) {}
  } else {
    amount = parseFloat(body && body.amount);
    if (!amount || amount <= 0) return json({ status: 'error', message: 'Invalid amount' }, 400);
    name = String((body && body.name) || '').trim();
    email = String((body && body.email) || '').trim();
    phone = String((body && body.phone) || '').trim();
    currency = String((body && body.currency) || 'GHS').toUpperCase();
    tx_ref = 'momom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    stageDonation = true;
  }
  if (!email || !email.includes('@')) return json({ status: 'error', message: 'A valid email is required' }, 400);

  if (stageDonation) {
    try {
      await env.DB.prepare(
        `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, provider, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 'momo_manual', ?, datetime('now'))
         ON CONFLICT(tx_ref) DO UPDATE SET amount = excluded.amount, currency = excluded.currency, donor_name = excluded.donor_name, donor_email = excluded.donor_email, donor_phone = excluded.donor_phone, status = 'pending', provider = 'momo_manual', metadata = excluded.metadata`
      ).bind(tx_ref, amount, currency, name, email, phone, JSON.stringify(meta)).run();
    } catch (_e) {
      // Pre-migration DBs without the metadata column: stage without it.
      try {
        await env.DB.prepare(
          `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, provider, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', 'momo_manual', datetime('now'))
           ON CONFLICT(tx_ref) DO UPDATE SET amount = excluded.amount, currency = excluded.currency, donor_name = excluded.donor_name, donor_email = excluded.donor_email, donor_phone = excluded.donor_phone, status = 'pending', provider = 'momo_manual'`
        ).bind(tx_ref, amount, currency, name, email, phone).run();
      } catch (_e2) {}
    }
  }

  return json({
    status: 'ok',
    tx_ref,
    amount,
    currency,
    momo_number: momoNumber,
    momo_name: String(env.MOMO_MANUAL_NAME || 'Studio Gabochie').trim(),
    network: String(env.MOMO_MANUAL_NETWORK || 'MTN').trim()
  });
}
