import { requireAdmin } from '../../_auth.js';

const REWARD_TIERS = [
  { min: 3,  tier: 'footer',      label: 'Footer Banner (1 issue)' },
  { min: 10, tier: 'leaderboard', label: 'Leaderboard Banner (1 issue)' },
  { min: 50, tier: 'premium',     label: 'Premium Package (1 month)' },
];

export async function onRequest(context) {
  const { request, env } = context;
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    // Get all subscribers with ref_codes and their referral counts
    const referrers = await env.DB.prepare(
      "SELECT s.id, s.name, s.email, s.ref_code, COUNT(r.id) AS referral_count FROM subscribers s LEFT JOIN referrals r ON r.referrer_code = s.ref_code WHERE s.ref_code != '' GROUP BY s.id HAVING referral_count > 0 ORDER BY referral_count DESC"
    ).all();

    let totalReferrals = 0;
    let pendingRewards = 0;
    let results = [];

    for (const row of referrers.results) {
      const code = row.ref_code;
      const count = row.referral_count;
      totalReferrals += count;

      let nextTier = null;
      let canClaim = false;
      let claimed = false;

      for (const tier of REWARD_TIERS) {
        if (count >= tier.min) {
          // Check if already claimed at this tier
          const claimedRow = await env.DB.prepare(
            "SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_code = ? AND reward_tier = ? AND reward_claimed = 1"
          ).bind(code, tier.tier).first();
          if (!claimedRow || claimedRow.cnt === 0) {
            nextTier = tier;
            canClaim = true;
            pendingRewards++;
            break;
          }
          claimed = true;
        }
      }

      results.push({
        id: row.id,
        name: row.name || 'Anonymous',
        email: row.email,
        code: code,
        count: count,
        next_reward: nextTier ? nextTier.label : (claimed ? 'All claimed' : '—'),
        tier: nextTier ? nextTier.tier : '',
        can_claim: canClaim,
        reward_approved: claimed
      });
    }

    return new Response(JSON.stringify({
      status: 'ok',
      total_referrers: results.length,
      total_referrals: totalReferrals,
      pending_rewards: pendingRewards,
      referrers: results
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
