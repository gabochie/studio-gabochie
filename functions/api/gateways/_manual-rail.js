// Shared engine for the manual direct-to-wallet rails (MTN MoMo + bank transfer).
// A customer pays to the owner's public number/account, submits the payment
// reference via the claim endpoint, and NOTHING settles until the owner
// confirms the claim in the admin queue — fake screenshots stay pending.
// Secrets per rail:
//   momo: MOMO_MANUAL_NUMBER (+ MOMO_MANUAL_NAME, MOMO_MANUAL_NETWORK)
//   bank: BANK_MANUAL_ACCOUNT_NUMBER, BANK_MANUAL_BANK (+ BANK_MANUAL_ACCOUNT_NAME)
import { resolvePendingTx } from './expresspay/create.js';
import { getSessionUser } from '../enroll/_token.js';

var GUITAR_PLAN_RANK = { bronze: 1, silver: 2, gold: 3, apprentice: 4, full: 4 };
var GUITAR_PLAN_FALLBACK = { bronze: 299, silver: 199, gold: 299, apprentice: 699, full: 299 };

async function guitarPlanPrice(db, plan) {
  try {
    const row = plan === 'full'
      ? await db.prepare("SELECT value FROM settings WHERE key = 'guitar_price'").first()
      : await db.prepare('SELECT value FROM settings WHERE key = ?').bind('guitar_price_' + plan).first();
    if (row && parseInt(row.value)) return parseInt(row.value);
  } catch (_e) {}
  return GUITAR_PLAN_FALLBACK[plan] || 299;
}

async function guitarOwnedRank(db, userId) {
  try {
    const res = await db.prepare("SELECT plan FROM guitar_payments WHERE user_id = ? AND status = 'completed'").bind(userId).all();
    let rank = 0;
    for (const p of (res && res.results) || []) {
      const r = p.plan ? (GUITAR_PLAN_RANK[p.plan] || 0) : 4; // legacy rows unlocked everything
      if (r > rank) rank = r;
    }
    return rank;
  } catch (_e) { return 0; }
}

export function railConfig(rail) {
  if (rail === 'bank') {
    return {
      rail: 'bank',
      provider: 'bank_manual',
      destinationSecret: 'BANK_MANUAL_ACCOUNT_NUMBER',
      destinationLabel: 'Account number',
      nameSecret: 'BANK_MANUAL_ACCOUNT_NAME',
      networkSecret: 'BANK_MANUAL_BANK',
      defaultNetwork: 'Bank transfer'
    };
  }
  return {
    rail: 'momo',
    provider: 'momo_manual',
    destinationSecret: 'MOMO_MANUAL_NUMBER',
    destinationLabel: 'MoMo number',
    nameSecret: 'MOMO_MANUAL_NAME',
    networkSecret: 'MOMO_MANUAL_NETWORK',
    defaultNetwork: 'MTN'
  };
}

// Returns { http, body } — the create response for the requested rail.
export async function manualRailCreate(env, body, rail) {
  const cfg = railConfig(rail);
  const destination = String(env[cfg.destinationSecret] || '').trim();
  if (!destination) {
    return { http: 200, body: { status: 'error', message: 'This payment option is being set up — please pay with crypto or another method for now.', code: 'manual_unconfigured' } };
  }

  // Two modes, mirroring moolre/create.js:
  //  - tx_ref supplied (guitar, tiers, books, store, upgrades...): the amount
  //    is resolved server-side from the pending row and never trusted from the
  //    client. No donation row is staged.
  //  - no tx_ref (open donation): a momom_/bankm_ ref is generated and a pending
  //    donation row is staged; settlement happens on admin confirmation.
  // Guitar token mode (purpose 'guitar' + session token): mirrors
  // crypto/create.js — prices the plan server-side and stages both a metadata
  // donation row and a pending guitar_payments row for the unlock check.
  const clientRef = String((body && body.tx_ref) || '').trim();
  const refPrefix = rail === 'bank' ? 'bankm_' : 'momom_';
  let tx_ref, amount, name, email, phone, currency, stageDonation;
  let meta = { purpose: body && body.purpose === 'guitar' ? 'guitar' : 'donation' };

  if (clientRef) {
    if (!env.DB) return { http: 501, body: { status: 'error', message: 'D1 not bound' } };
    let found = null;
    try {
      found = await resolvePendingTx(env.DB, clientRef);
    } catch (_e) {
      return { http: 500, body: { status: 'error', message: 'Lookup failed' } };
    }
    if (!found) return { http: 404, body: { status: 'error', message: 'Unknown or already-settled transaction' } };
    tx_ref = clientRef;
    amount = found.amount;
    name = String((body && body.name) || found.name || '').trim();
    email = String((body && body.email) || found.email || '').trim();
    phone = String((body && body.phone) || found.phone || '').trim();
    currency = String((body && body.currency) || 'GHS').toUpperCase();
    stageDonation = false;
  } else if ((body && body.purpose) === 'guitar') {
    if (!env.DB) return { http: 501, body: { status: 'error', message: 'D1 not bound' } };
    const gToken = (body.token || '').trim();
    if (!gToken) return { http: 401, body: { status: 'error', message: 'Login required' } };
    let gUser = null;
    try { gUser = await getSessionUser(env.DB, gToken); } catch (_e) {}
    if (!gUser) return { http: 401, body: { status: 'error', message: 'Login required' } };
    let gPlan = (body.plan || 'full'); // legacy clients = full unlock
    if (!GUITAR_PLAN_RANK[gPlan]) gPlan = 'full';
    const gRank = await guitarOwnedRank(env.DB, gUser.user_id);
    if (gRank >= GUITAR_PLAN_RANK[gPlan]) return { http: 200, body: { status: 'ok', already: true, message: 'Already unlocked' } };
    if (gPlan === 'silver' && gRank < 1) return { http: 400, body: { status: 'error', message: 'Complete your Bronze registration first — seek first the system.' } };
    if (gPlan === 'gold' && gRank < 2) return { http: 400, body: { status: 'error', message: 'Complete Silver first, or take Apprentice for the full path.' } };
    amount = await guitarPlanPrice(env.DB, gPlan);
    if (!amount || amount <= 0) return { http: 400, body: { status: 'error', message: 'Nothing payable' } };
    name = gUser.name || String((body && body.name) || '').trim();
    email = gUser.email || String((body && body.email) || '').trim();
    phone = String((body && body.phone) || '').trim();
    currency = 'GHS';
    tx_ref = refPrefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    stageDonation = true;
    meta = { purpose: 'guitar', guitar: true, user_id: gUser.user_id, guitarPlan: gPlan };
    try {
      await env.DB.prepare(
        "INSERT INTO guitar_payments (user_id, email, status, flw_tx_ref, amount, plan) VALUES (?, ?, 'pending', ?, ?, ?)"
      ).bind(gUser.user_id, email, tx_ref, amount, gPlan).run();
    } catch (_e) {}
  } else {
    amount = parseFloat(body && body.amount);
    if (!amount || amount <= 0) return { http: 400, body: { status: 'error', message: 'Invalid amount' } };
    name = String((body && body.name) || '').trim();
    email = String((body && body.email) || '').trim();
    phone = String((body && body.phone) || '').trim();
    currency = String((body && body.currency) || 'GHS').toUpperCase();
    tx_ref = refPrefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    stageDonation = true;
  }
  if (!email || !email.includes('@')) return { http: 400, body: { status: 'error', message: 'A valid email is required' } };

  if (stageDonation) {
    try {
      await env.DB.prepare(
        `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, provider, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'))
         ON CONFLICT(tx_ref) DO UPDATE SET amount = excluded.amount, currency = excluded.currency, donor_name = excluded.donor_name, donor_email = excluded.donor_email, donor_phone = excluded.donor_phone, status = 'pending', provider = excluded.provider, metadata = excluded.metadata`
      ).bind(tx_ref, amount, currency, name, email, phone, cfg.provider, JSON.stringify(meta)).run();
    } catch (_e) {
      // Pre-migration DBs without the metadata column: stage without it.
      try {
        await env.DB.prepare(
          `INSERT INTO donations (tx_ref, amount, currency, donor_name, donor_email, donor_phone, status, provider, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
           ON CONFLICT(tx_ref) DO UPDATE SET amount = excluded.amount, currency = excluded.currency, donor_name = excluded.donor_name, donor_email = excluded.donor_email, donor_phone = excluded.donor_phone, status = 'pending', provider = excluded.provider`
        ).bind(tx_ref, amount, currency, name, email, phone, cfg.provider).run();
      } catch (_e2) {}
    }
  }

  return {
    http: 200,
    body: {
      status: 'ok',
      tx_ref,
      amount,
      currency,
      rail: cfg.rail,
      destination: destination,
      destination_label: cfg.destinationLabel,
      account_name: String(env[cfg.nameSecret] || 'Studio Gabochie').trim(),
      network: String(env[cfg.networkSecret] || cfg.defaultNetwork).trim()
    }
  };
}
