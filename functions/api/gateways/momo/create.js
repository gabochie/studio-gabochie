import { json, readBody } from '../_shared.js';
import { checkRateLimit } from '../../_rate-limit.js';
import { manualRailCreate } from '../_manual-rail.js';

// Manual MTN Mobile Money — direct-to-wallet rail (no gateway).
// The customer sends money to the dedicated MoMo number shown at checkout,
// then submits the MoMo transaction ID via /api/gateways/momo/claim.
// Nothing settles automatically: an admin confirms each claim in the admin
// queue, which routes through the shared settlement machinery.
// Secrets: MOMO_MANUAL_NUMBER (required to enable the rail),
//          MOMO_MANUAL_NAME (account name shown, default 'Studio Gabochie'),
//          MOMO_MANUAL_NETWORK (default 'MTN').
// All logic lives in ../_manual-rail.js (shared with the bank rail).
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'momo_create', 5, 60)) {
    return json({ status: 'error', message: 'Too many requests. Try again later.' }, 429);
  }
  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid JSON body' }, 400);
  }
  const r = await manualRailCreate(env, body, 'momo');
  return json(r.body, r.http);
}
