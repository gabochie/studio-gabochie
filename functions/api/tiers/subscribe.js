import { getToken, getSessionUser } from '../enroll/_token.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  if (!env.DB) return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  try {
    var token = getToken(request);
    var sessionUser = token ? await getSessionUser(env.DB, token) : null;

    var body = await request.json();
    var slug = (body.tier || '').toLowerCase().trim();
    var email = body.email || (sessionUser ? sessionUser.email : '');
    var name = body.name || (sessionUser ? sessionUser.name : '');
    var phone = body.phone || '';
    var interval = body.interval === 'yearly' ? 'yearly' : 'monthly';

    if (!slug) return new Response(JSON.stringify({ status: 'error', message: 'tier required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    if (!email) return new Response(JSON.stringify({ status: 'error', message: 'email required' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

    var tier = await env.DB.prepare("SELECT slug, name, monthly_price_ghs, yearly_price_ghs, flw_plan_id FROM unified_tiers WHERE slug = ?").bind(slug).first();
    if (!tier) return new Response(JSON.stringify({ status: 'error', message: 'Invalid tier' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

    if (slug === 'free') return new Response(JSON.stringify({ status: 'error', message: 'Free tier cannot be subscribed' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

    var amount = interval === 'yearly' ? tier.yearly_price_ghs : tier.monthly_price_ghs;
    if (amount <= 0) {
      interval = 'yearly';
      amount = tier.yearly_price_ghs;
      if (amount <= 0) return new Response(JSON.stringify({ status: 'error', message: 'Tier has no payable price' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    var isRecurring = slug === 'supporter';
    var planId = '';
    if (isRecurring) {
      planId = interval === 'yearly' ? (env.FLW_PLAN_PATRON || '160303') : (env.FLW_PLAN_SUPPORTER || '160302');
    }

    var tx_ref = 'tier_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    var inter = interval === 'yearly' ? 'yearly' : 'monthly';

    await env.DB.prepare(
      "INSERT INTO subscriptions (email, name, tier, amount, currency, flw_plan_id, status, tx_ref, created_at) VALUES (?, ?, ?, ?, 'GHS', ?, 'pending', ?, datetime('now'))"
    ).bind(email, name, slug, amount, planId, tx_ref).run();

    return new Response(JSON.stringify({
      status: 'ok',
      tx_ref: tx_ref,
      amount: amount,
      currency: 'GHS',
      plan_id: planId,
      is_recurring: isRecurring,
      interval: inter,
      tier_slug: slug,
      customer: { email: email, name: name, phone: phone }
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}
