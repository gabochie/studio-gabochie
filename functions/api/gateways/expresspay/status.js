import { json } from '../_shared.js';
import { expresspayQuery } from './_expresspay.js';

// GET /api/gateways/expresspay/status?tx_ref=...
// Receipt pages poll this after the ExpressPay redirect: it re-queries
// ExpressPay and reports approved/pending without exposing any secrets.
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const url = new URL(request.url);
  const tx_ref = (url.searchParams.get('tx_ref') || '').trim();
  if (!tx_ref) return json({ status: 'error', message: 'tx_ref required' }, 400);
  if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);
  let token = '';
  try {
    const row = await env.DB.prepare('SELECT token FROM expresspay_tokens WHERE tx_ref = ?').bind(tx_ref).first();
    if (row && row.token) token = row.token;
  } catch (_e) {}
  if (!token) return json({ status: 'error', message: 'Unknown transaction' }, 404);
  const q = await expresspayQuery(env, token);
  return json({ status: 'ok', approved: q.approved, pending: q.pending, amount: q.amount, currency: q.currency, result: q.resultText || '' });
}
