import { getToken, getSessionUser } from '../enroll/_token.js';

export async function onRequest(context) {
  var { request, env } = context;
  var cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), { status: 405, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  var db = env.DB;
  if (!db) return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), { status: 501, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

  try {
    var token = getToken(request);
    if (!token) return new Response(JSON.stringify({ status: 'error', message: 'Not authenticated' }), { status: 401, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

    var session = await getSessionUser(db, token);
    if (!session) return new Response(JSON.stringify({ status: 'error', message: 'Invalid session' }), { status: 401, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

    var body = await request.json();
    var planTier = (body.tier || '').toLowerCase();
    if (!planTier || (planTier !== 'premium' && planTier !== 'vip')) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid plan tier. Choose premium or vip.' }), { status: 400, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
    }

    var plan = await db.prepare('SELECT id, tier, name, price_ghs, features FROM membership_plans WHERE tier = ?').bind(planTier).first();
    if (!plan) return new Response(JSON.stringify({ status: 'error', message: 'Plan not found' }), { status: 404, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });

    var tx_ref = 'memb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    var amount = plan.price_ghs;

    await db.prepare(
      "INSERT INTO subscriptions (email, name, tier, amount, currency, status, tx_ref, created_at) VALUES (?, ?, ?, ?, 'GHS', 'pending', ?, datetime('now'))"
    ).bind(session.email, session.name || '', planTier, amount, tx_ref).run();

    return new Response(JSON.stringify({
      status: 'ok',
      tx_ref: tx_ref,
      amount: amount,
      currency: 'GHS',
      plan_name: plan.name,
      plan_tier: plan.tier,
      customer: { email: session.email, name: session.name || '' }
    }), { headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: err.message }), { status: 500, headers: Object.assign({ 'Content-Type': 'application/json' }, cors) });
  }
}