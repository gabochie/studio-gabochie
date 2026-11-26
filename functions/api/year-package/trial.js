import { getToken } from '../enroll/_token.js';
import { resolveAccess, json, cors, RESOURCE_SLUG } from '../_entitlement.js';

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

export async function onRequest(context) {
  var { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (request.method !== 'POST') return json({ status: 'error', message: 'Method not allowed' }, 405);

  try {
    if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);
    var token = getToken(request);
    if (!token) return json({ status: 'error', message: 'Please log in to start the trial.' }, 401);

    var session = await env.DB.prepare(
      'SELECT user_id, expires_at FROM sessions WHERE token = ?'
    ).bind(token).first().catch(function () { return null; });
    if (!session || (session.expires_at && session.expires_at < now())) {
      return json({ status: 'error', message: 'Session expired. Please log in again.' }, 401);
    }

    var current = await resolveAccess(env, request);
    if (current.access === 'full') {
      return json({ status: 'ok', message: 'Already included in your membership.',
                    access: current }, 200);
    }
    if (current.access === 'trial') {
      return json({ status: 'ok', message: 'Trial already active.', access: current }, 200);
    }
    if (current.reason === 'trial_expired') {
      return json({ status: 'error',
                    message: 'Your 14-day trial has already been used. Upgrade to continue.' }, 409);
    }

    // One trial per user. ON CONFLICT makes concurrent requests idempotent;
    // the UNIQUE(user_id, resource_slug) constraint in the migration enforces it.
    await env.DB.prepare(
      'INSERT INTO resource_entitlements ' +
      '(user_id, resource_slug, access_until, source, created_at) ' +
      'VALUES (?, ?, datetime(\'now\', \'+14 days\'), \'trial\', datetime(\'now\')) ' +
      'ON CONFLICT(user_id, resource_slug) DO NOTHING'
    ).bind(session.user_id, RESOURCE_SLUG).run();

    var access = await resolveAccess(env, request);
    return json({ status: 'ok', message: 'Trial started. Weeks 1–2 are open.', access: access }, 200);
  } catch (err) {
    return json({ status: 'error', message: err.message || 'Internal error' }, 500);
  }
}
