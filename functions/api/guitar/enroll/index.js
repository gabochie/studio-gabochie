import { getUser, json } from '../_utils.js';

// Tier ladder — "Seek first the system."
// Registration (Bronze) -> Silver -> Gold, or Apprentice (all-in, any time).
// Access is cumulative: owning a higher rung also opens every lower band,
// and Silver/Gold require the rungs below (server-enforced) so the ladder
// is always climbed in order. `full` is the legacy single-unlock plan kept
// for backward compatibility (any client that does not send a plan).
const PLAN_RANK = { bronze: 1, silver: 2, gold: 3, apprentice: 4, full: 4 };
const PLAN_NAMES = {
  bronze: 'Bronze — Registration (the foundation)',
  silver: 'Silver — Songcraft (your first songs)',
  gold: 'Gold — Expression (the finish line)',
  apprentice: 'Guitar Apprentice — all 16 modules, lifetime',
  full: 'Full Access — lifetime'
};
const PLAN_FALLBACK = { bronze: 299, silver: 199, gold: 299, apprentice: 699 };
const PLAN_PRICE_KEYS = {
  bronze: 'guitar_price_bronze',
  silver: 'guitar_price_silver',
  gold: 'guitar_price_gold',
  apprentice: 'guitar_price_apprentice'
};

async function loadPrices(db) {
  const prices = { ...PLAN_FALLBACK, full: PLAN_FALLBACK.bronze };
  try {
    const keys = ['guitar_price', ...Object.values(PLAN_PRICE_KEYS)];
    const placeholders = keys.map(() => '?').join(',');
    const { results } = await db.prepare(
      `SELECT key, value FROM settings WHERE key IN (${placeholders})`
    ).bind(...keys).all();
    for (const row of results || []) {
      const v = parseInt(row.value);
      if (!(v > 0)) continue;
      if (row.key === 'guitar_price') { prices.bronze = v; prices.full = v; }
      else {
        const plan = row.key.replace('guitar_price_', '');
        if (PLAN_FALLBACK[plan] !== undefined) prices[plan] = v;
      }
    }
  } catch (_) {}
  return prices;
}

async function ownedRank(db, userId) {
  const { results } = await db.prepare(
    "SELECT plan, status FROM guitar_payments WHERE user_id = ? AND status = 'completed'"
  ).bind(userId).all();
  let rank = 0;
  for (const p of results || []) {
    // Legacy rows created before tiered payments have no plan — they unlocked everything.
    const r = p.plan ? (PLAN_RANK[p.plan] || 0) : PLAN_RANK.full;
    if (r > rank) rank = r;
  }
  return rank;
}

export async function onRequest(context) {
  const db = context.env.DB;
  const req = context.request;
  const user = await getUser(context);
  if (!user) return json({error:'Auth required'}, 401);

  const prices = await loadPrices(db);
  let currency = 'GHS';
  try {
    const cRow = await db.prepare("SELECT value FROM settings WHERE key = 'guitar_currency_symbol'").first();
    if (cRow && cRow.value) currency = cRow.value;
  } catch (_) {}

  if (req.method === 'POST') {
    let plan;
    try { plan = ((await req.json()) || {}).plan; } catch (_) { plan = null; }
    if (!PLAN_RANK[plan]) plan = 'full'; // legacy clients unlock everything
    const rank = PLAN_RANK[plan];

    const owned = await ownedRank(db, user.id);
    if (owned !== null && owned >= rank) return json({ok: true, alreadyUnlocked: true});

    if (plan === 'silver' && owned < 1)
      return json({error:'Complete your Bronze registration first — seek first the system.'}, 400);
    if (plan === 'gold' && owned < 2)
      return json({error:'Complete Silver first, or take Apprentice for the full path.'}, 400);

    const price = plan === 'full' ? prices.full : prices[plan];
    const tx_ref = 'GUITAR_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    await db.prepare("INSERT INTO guitar_payments (user_id, email, status, flw_tx_ref, amount, plan) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.id, user.email, 'pending', tx_ref, price, plan).run();
    return json({tx_ref, plan, amount: price, currency, message: 'Proceed to payment to unlock: ' + PLAN_NAMES[plan]});
  }
  return json({error:'Method not allowed'}, 405);
}
