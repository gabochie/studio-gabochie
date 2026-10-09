import { settlePaidTx } from '../gateways/_settle.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const signature = request.headers.get('verif-hash');
    if (!signature) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing signature' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    const expectedHash = env.FLW_SECRET_HASH;
    if (!expectedHash || signature !== expectedHash) {
      return new Response(JSON.stringify({ status: 'error', message: 'Invalid signature' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    const body = await request.json();
    const { event, data } = body;
    const tx_ref = data.tx_ref || '';
    const flw_id = String(data.id || '');
    const amount = parseFloat(data.amount) || 0;
    const currency = data.currency || 'GHS';
    const rawStatus = data.status || 'pending';
    const customer = data.customer || {};
    const donor_name = customer.name || customer.fullName || data.full_name || '';
    const donor_email = customer.email || data.email || '';
    const donor_phone = customer.phone || data.phone || '';

    // Map Flutterwave event types to canonical statuses
    const eventStatusMap = {
      'charge.completed': 'successful',
      'charge.failed': 'failed',
      'charge.chargeback': 'chargeback',
      'charge.chargeback.reversed': 'chargeback_reversed',
      'refund.completed': 'refunded',
      'refund.failed': 'refund_failed',
      'transfer.completed': 'successful',
      'transfer.failed': 'transfer_failed'
    };
    let canonicalStatus = eventStatusMap[event] || rawStatus;

    // Verify transaction with Flutterwave API (only for completed charges)
    let verifiedAmount = amount;
    let verifiedStatus = canonicalStatus;
    let verifiedCurrency = currency;
    if ((event === 'charge.completed' || event === 'charge.failed') && env.FLW_SECRET_KEY && flw_id) {
      try {
        const verifyResp = await fetch(
          `https://api.flutterwave.com/v3/transactions/${flw_id}/verify`,
          { headers: { 'Authorization': 'Bearer ' + env.FLW_SECRET_KEY } }
        );
        if (verifyResp.ok) {
          const verifyData = await verifyResp.json();
          if (verifyData.status === 'success' && verifyData.data) {
            verifiedAmount = parseFloat(verifyData.data.amount) || verifiedAmount;
            verifiedCurrency = verifyData.data.currency || verifiedCurrency;
            verifiedStatus = verifyData.data.status || verifiedStatus;
          }
        }
      } catch (_e) {}
    }

    // Settlement lives in the shared gateway module (Flutterwave webhook,
    // ExpressPay callback, and Moolre callback all settle through it).
    await settlePaidTx(env, db, {
      tx_ref: tx_ref,
      amount: verifiedAmount,
      currency: verifiedCurrency,
      status: verifiedStatus,
      event: event,
      name: donor_name,
      email: donor_email,
      phone: donor_phone,
      gateway: 'flutterwave',
      gatewayTxId: flw_id,
      raw: data
    });

    // Flutterwave recurring subscription payment notifications (plan lifecycle
    // events, not one-time charges).
    if (tx_ref.startsWith('sub_') && data.subscription_id && event !== 'charge.completed') {
      const subStatus = verifiedStatus === 'successful' ? 'active' : (verifiedStatus === 'failed' ? 'past_due' : verifiedStatus);
      const nextBilling = data.next_payment_date || data.next_charge_date || '';
      await db.prepare(
        `UPDATE subscriptions SET status = ?, next_billing = ? WHERE flw_subscription_id = ?`
      ).bind(subStatus, nextBilling, String(data.subscription_id)).run();
    }

    return new Response(JSON.stringify({ status: 'ok', event, canonicalStatus }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
