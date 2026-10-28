// Admin API for manual MTN MoMo claims.
//   GET  /api/admin/momo-claims          — list claims (pending first, then recent)
//   POST /api/admin/momo-claims          — { tx_ref, action: 'confirm' | 'reject' }
// Confirm routes through the shared settlePaidTx: money state + receipt email +
// access grants happen exactly as a gateway callback would produce them.
// Every decision requires an authenticated admin (all three auth layers apply).
import { requireAdminAuth } from './_admin-auth.js';
import { getConsoleUser, logConsoleAction } from './_console-session.js';
import { settlePaidTx } from '../gateways/_settle.js';
import { finalizeCryptoPayment } from '../gateways/_shared.js';
import { resolvePendingTx } from '../gateways/expresspay/create.js';
import { json } from '../gateways/_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;
  if (!env.DB) return json({ status: 'error', message: 'D1 not bound' }, 501);

  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 200);
      const rows = await env.DB.prepare(
        `SELECT tx_ref, rail, momo_txn_id, payer_number, status, submitted_at, decided_at, decided_by
         FROM momo_manual_claims ORDER BY CASE WHEN status = 'submitted' THEN 0 ELSE 1 END, id DESC LIMIT ?`
      ).bind(limit).all();
      return json({ status: 'ok', items: (rows && rows.results) || [] });
    } catch (_e) {
      return json({ status: 'error', message: 'Could not load claims' }, 500);
    }
  }

  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch (_e) {
      return json({ status: 'error', message: 'Invalid JSON body' }, 400);
    }
    const tx_ref = String((body && body.tx_ref) || '').trim();
    const action = String((body && body.action) || '').trim();
    if (!tx_ref || (action !== 'confirm' && action !== 'reject')) {
      return json({ status: 'error', message: 'tx_ref and action (confirm|reject) required' }, 400);
    }

    // Resolve the acting admin for the audit trail.
    var adminEmail = '';
    try {
      const u = await getConsoleUser(env.DB, request);
      if (u) adminEmail = u.email;
    } catch (_e) {}

    const claim = await env.DB.prepare(
      'SELECT tx_ref, momo_txn_id, payer_number, status FROM momo_manual_claims WHERE tx_ref = ?'
    ).bind(tx_ref).first();
    if (!claim) return json({ status: 'error', message: 'Unknown claim' }, 404);
    if (claim.status !== 'submitted') {
      return json({ status: 'error', message: 'Claim already ' + claim.status }, 409);
    }

    if (action === 'reject') {
      await env.DB.prepare("UPDATE momo_manual_claims SET status = 'rejected', decided_at = datetime('now'), decided_by = ? WHERE tx_ref = ?")
        .bind(adminEmail, tx_ref).run();
      await logConsoleAction(env.DB, 'momo_claim_rejected', { actorEmail: adminEmail, entityType: 'momo_manual_claim', entityId: tx_ref, details: { momo_txn_id: claim.momo_txn_id } });
      return json({ status: 'ok', action: 'rejected' });
    }

    // confirm — resolve the pending row for amount + identity, then settle.
    let found = null;
    try { found = await resolvePendingTx(env.DB, tx_ref); } catch (_e) {}
    if (!found) {
      // Metadata-staged rows (guitar token mode) are not visible to
      // resolvePendingTx — route them through the crypto finalizer, which
      // reads purpose from the donation row's metadata and completes the
      // guitar unlock / emails the buyer. Keep the provider label honest.
      const staged = await env.DB.prepare(
        "SELECT metadata FROM donations WHERE tx_ref = ? AND status = 'pending' AND provider = 'momo_manual'"
      ).bind(tx_ref).first().catch(() => null);
      if (staged) {
        const fin = await finalizeCryptoPayment(env, { tx_ref: tx_ref, gateway_txid: claim.momo_txn_id });
        if (fin && fin.status === 'ok') {
          try { await env.DB.prepare("UPDATE donations SET provider = ? WHERE tx_ref = ?").bind(claim.rail === 'bank' ? 'bank_manual' : 'momo_manual', tx_ref).run(); } catch (_e) {}
          await env.DB.prepare("UPDATE momo_manual_claims SET status = 'confirmed', decided_at = datetime('now'), decided_by = ? WHERE tx_ref = ?")
            .bind(adminEmail, tx_ref).run();
          await logConsoleAction(env.DB, 'momo_claim_confirmed', { actorEmail: adminEmail, entityType: 'momo_manual_claim', entityId: tx_ref, details: { momo_txn_id: claim.momo_txn_id } });
          return json({ status: 'ok', action: 'confirmed', purpose: fin.purpose || 'donation' });
        }
        return json({ status: 'error', message: 'Settlement failed — check the logs and try again.' }, 500);
      }
      // resolvePendingTx returns null when the row is already settled — idempotent no-op.
      await env.DB.prepare("UPDATE momo_manual_claims SET status = 'confirmed', decided_at = datetime('now'), decided_by = ? WHERE tx_ref = ?")
        .bind(adminEmail, tx_ref).run();
      return json({ status: 'ok', action: 'confirmed', note: 'Transaction was already settled — claim marked confirmed.' });
    }

    await settlePaidTx(env, env.DB, {
      tx_ref: tx_ref,
      amount: found.amount,
      currency: 'GHS',
      name: found.name,
      email: found.email,
      phone: found.phone,
      gateway: claim.rail === 'bank' ? 'bank_manual' : 'momo_manual',
      gatewayTxId: claim.momo_txn_id,
      event: 'charge.completed',
      raw: {}
    });
    await env.DB.prepare("UPDATE momo_manual_claims SET status = 'confirmed', decided_at = datetime('now'), decided_by = ? WHERE tx_ref = ?")
      .bind(adminEmail, tx_ref).run();
    await logConsoleAction(env.DB, 'momo_claim_confirmed', { actorEmail: adminEmail, entityType: 'momo_manual_claim', entityId: tx_ref, details: { amount: found.amount, momo_txn_id: claim.momo_txn_id } });

    return json({ status: 'ok', action: 'confirmed', amount: found.amount, email: found.email });
  }

  return json({ status: 'error', message: 'Method not allowed' }, 405);
}
