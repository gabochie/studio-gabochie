import { requireAdmin } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const { code, tier } = await request.json();
    if (!code || !tier) {
      return new Response(JSON.stringify({ status: 'error', message: 'code and tier required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    // Mark all unclaimed referrals at this tier as claimed
    await env.DB.prepare(
      "UPDATE referrals SET reward_claimed = 1, reward_tier = ? WHERE referrer_code = ? AND reward_claimed = 0"
    ).bind(tier, code).run();

    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Reward approved for ' + code + ' at tier ' + tier
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
