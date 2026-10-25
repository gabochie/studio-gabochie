import { getUser, json } from '../_utils.js';

// Ranks are cumulative (bronze 1 -> silver 2 -> gold 3 -> apprentice/full 4).
// `unlocked` keeps its legacy meaning (everything open) so older pages and
// clients behave exactly as before; tiered pages read the *_Unlocked flags.
const PLAN_RANK = { bronze: 1, silver: 2, gold: 3, apprentice: 4, full: 4 };
const TIER_NAMES = { 0: 'none', 1: 'bronze', 2: 'silver', 3: 'gold', 4: 'apprentice' };

export async function onRequest(context) {
  const db = context.env.DB;
  const user = await getUser(context);
  if (!user) return json({unlocked: false, tier: 'none', bronzeUnlocked: false, silverUnlocked: false, goldUnlocked: false});

  let rank = 0;
  try {
    const { results } = await db.prepare(
      "SELECT plan, status FROM guitar_payments WHERE user_id = ? AND status = 'completed'"
    ).bind(user.id).all();
    for (const p of results || []) {
      const r = p.plan ? (PLAN_RANK[p.plan] || 0) : PLAN_RANK.full; // legacy rows (no plan) = full unlock
      if (r > rank) rank = r;
    }
  } catch (_) { rank = 0; }

  let freeModules = 3;
  try {
    const row = await db.prepare("SELECT value FROM settings WHERE key = 'guitar_free_modules'").first();
    if (row) freeModules = parseInt(row.value) || 3;
  } catch (_) {}

  return json({
    unlocked: rank >= 4, // legacy semantics: all 16 modules + everything
    tier: TIER_NAMES[rank],
    bronzeUnlocked: rank >= 1, // modules 1-5 (after the free preview)
    silverUnlocked: rank >= 2, // modules 6-11 + the song library
    goldUnlocked: rank >= 3,   // modules 12-16
    songLibraryUnlocked: rank >= 2,
    freeModules
  });
}
