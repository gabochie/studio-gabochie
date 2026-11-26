import { resolveAccess, json, cors } from '../_entitlement.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (context.request.method !== 'GET') return json({ status: 'error', message: 'Method not allowed' }, 405);
  try {
    var access = await resolveAccess(context.env, context.request);
    return json(access, 200);
  } catch (err) {
    return json({ status: 'error', message: err.message || 'Internal error' }, 500);
  }
}
