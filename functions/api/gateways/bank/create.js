import { json, readBody } from '../_shared.js';
import { checkRateLimit } from '../../_rate-limit.js';
import { manualRailCreate } from '../_manual-rail.js';

// Manual bank transfer — direct-to-account rail (no gateway).
// The customer transfers to the owner's bank account shown at checkout,
// then submits their transfer reference via /api/gateways/momo/claim
// (shared claim queue with rail='bank').
// Nothing settles automatically: an admin confirms each claim in the admin
// queue, which routes through the shared settlement machinery.
// Secrets: BANK_MANUAL_ACCOUNT_NUMBER + BANK_MANUAL_BANK (required),
//          BANK_MANUAL_ACCOUNT_NAME (default 'Studio Gabochie').
// All logic lives in ../_manual-rail.js (shared with the MoMo rail).
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!await checkRateLimit(env.DB, ip, 'bank_create', 5, 60)) {
    return json({ status: 'error', message: 'Too many requests. Try again later.' }, 429);
  }
  let body;
  try {
    body = await readBody(request);
  } catch (_e) {
    return json({ status: 'error', message: 'Invalid JSON body' }, 400);
  }
  const r = await manualRailCreate(env, body, 'bank');
  return json(r.body, r.http);
}
