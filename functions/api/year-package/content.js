import { CONTENT } from './_content.js';
import { resolveAccess, json, cors, TRIAL_WEEKS } from '../_entitlement.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (context.request.method !== 'GET') return json({ status: 'error', message: 'Method not allowed' }, 405);
  try {
    var access = await resolveAccess(context.env, context.request);
    var meta = CONTENT.meta;
    if (access.access === 'full') {
      return json({ status: 'ok', access: access, meta: meta,
                    weeks: CONTENT.weeks, resources: CONTENT.resources }, 200);
    }
    if (access.access === 'trial') {
      var weeks = CONTENT.weeks.filter(function (w) { return TRIAL_WEEKS.indexOf(w.n) !== -1; });
      return json({ status: 'ok', access: access, meta: meta,
                    weeks: weeks, resources: [] }, 200);
    }
    return json({ status: 'error', message: 'Start the 14-day trial or upgrade to open this resource.',
                  access: access, meta: meta, weeks: [], resources: [] }, 403);
  } catch (err) {
    return json({ status: 'error', message: err.message || 'Internal error' }, 500);
  }
}
