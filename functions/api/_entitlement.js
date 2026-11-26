// Shared server-side entitlement resolver for the 2027 Year Package.
// Never trust a client-supplied tier or email — resolve from the session token.
import { getToken } from './enroll/_token.js';

export const RESOURCE_SLUG = '2027-year-package';
export const PREMIUM_TIERS = ['premium', 'vip', 'founding'];
export const TRIAL_WEEKS = [1, 2];

export function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function locked(tier, reason) {
  return { status: 'ok', access: 'locked', tier: tier || 'free', days_left: 0,
           trial_weeks: TRIAL_WEEKS, reason: reason || '' };
}

function daysBetween(until) {
  var t = Date.parse(String(until).replace(' ', 'T') + 'Z');
  if (!isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t - Date.now()) / 86400000));
}

export async function resolveAccess(env, request) {
  var token = getToken(request);
  if (!token) return locked('free', 'no_session');
  if (!env.DB) return locked('free', 'no_db');

  var user = await env.DB.prepare(
    'SELECT s.user_id, s.expires_at, u.membership_tier, u.membership_expires_at ' +
    'FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?'
  ).bind(token).first().catch(function () { return null; });
  if (!user) return locked('free', 'invalid_session');
  if (user.expires_at && user.expires_at < now()) return locked('free', 'session_expired');

  var tier = user.membership_tier || 'free';
  var exp = String(user.membership_expires_at || '');
  var premium = PREMIUM_TIERS.indexOf(tier) !== -1 && (!exp || exp > now());
  if (premium) {
    return { status: 'ok', access: 'full', tier: tier, days_left: 0,
             trial_weeks: TRIAL_WEEKS, reason: '' };
  }

  var ent = await env.DB.prepare(
    'SELECT access_until, source FROM resource_entitlements ' +
    'WHERE user_id = ? AND resource_slug = ?'
  ).bind(user.user_id, RESOURCE_SLUG).first().catch(function () { return null; });

  if (ent && ent.source === 'trial' && ent.access_until && ent.access_until > now()) {
    return { status: 'ok', access: 'trial', tier: tier,
             days_left: daysBetween(ent.access_until), trial_weeks: TRIAL_WEEKS, reason: '' };
  }
  return locked(tier, ent && ent.source === 'trial' ? 'trial_expired' : 'no_entitlement');
}

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors())
  });
}
