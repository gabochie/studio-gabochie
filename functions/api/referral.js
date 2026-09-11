const REWARD_TIERS = [
  { min: 3,  tier: 'footer',      label: 'Footer Banner Ad (1 issue)', value: 'GH¢2,000' },
  { min: 10, tier: 'leaderboard', label: 'Leaderboard Banner Ad (1 issue)', value: 'GH¢2,500' },
  { min: 50, tier: 'premium',     label: 'Premium Package (1 month)', value: 'GH¢10,000' },
];

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';

  if (!code || !code.startsWith('GA-')) {
    return new Response(JSON.stringify({ status: 'error', message: 'Valid referral code required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify code exists
    const subscriber = await env.DB.prepare(
      'SELECT id, name, email, edition FROM subscribers WHERE ref_code = ?'
    ).bind(code).first();

    if (!subscriber) {
      return new Response(JSON.stringify({ status: 'error', message: 'Referral code not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Count referrals
    const countRow = await env.DB.prepare(
      'SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_code = ?'
    ).bind(code).first();
    const referralCount = countRow ? countRow.cnt : 0;

    // Get recent referrals
    const recent = await env.DB.prepare(
      'SELECT referred_name, referred_country, referred_at FROM referrals WHERE referrer_code = ? ORDER BY referred_at DESC LIMIT 10'
    ).bind(code).all();

    // Determine earned and claimed rewards
    let earned = [];
    for (const tier of REWARD_TIERS) {
      if (referralCount >= tier.min) {
        const claimed = await env.DB.prepare(
          'SELECT COUNT(*) AS cnt, COALESCE(SUM(reward_claimed),0) AS claimed_count FROM referrals WHERE referrer_code = ? AND reward_tier = ?'
        ).bind(code, tier.tier).first();
        const isClaimed = claimed && claimed.claimed_count > 0;
        earned.push({
          tier: tier.tier,
          label: tier.label,
          value: tier.value,
          unlocked: true,
          claimed: !!isClaimed,
          needed: 0
        });
      }
    }

    // Calculate next reward progress
    let nextReward = null;
    for (const tier of REWARD_TIERS) {
      if (referralCount < tier.min) {
        nextReward = {
          tier: tier.tier,
          label: tier.label,
          value: tier.value,
          progress: referralCount,
          needed: tier.min,
          remaining: tier.min - referralCount
        };
        break;
      }
    }

    return new Response(JSON.stringify({
      status: 'ok',
      code,
      subscriber: subscriber.name || 'Anonymous',
      total_referrals: referralCount,
      earned_rewards: earned,
      next_reward: nextReward,
      recent: recent.results || []
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
