import { getToken, getSessionUser } from '../enroll/_token.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  const url = new URL(request.url);
  const tx_ref = url.searchParams.get('tx_ref') || '';
  try {
    if (tx_ref) {
      var order = await env.DB.prepare(
        "SELECT * FROM store_orders WHERE tx_ref = ? AND status = 'completed'"
      ).bind(tx_ref).first();
      if (!order) {
        return new Response(JSON.stringify({ status: 'error', message: 'No valid purchase found' }), {
          status: 404, headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({
        status: 'ok',
        order: {
          tx_ref: order.tx_ref,
          item_type: order.item_type,
          item_name: order.item_name,
          item_variant: order.item_variant,
          amount: order.amount,
          currency: order.currency,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          created_at: order.created_at
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    // Library view: session token required; orders scoped to the token owner.
    // Never accept a client-supplied user_id or email (enumeration risk).
    const sessionUser = await getSessionUser(env.DB, getToken(request));
    if (!sessionUser) {
      return new Response(JSON.stringify({ status: 'error', message: 'Provide tx_ref or sign in' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }
    var userOrders = await env.DB.prepare(
      "SELECT * FROM store_orders WHERE user_id = ? AND status = 'completed' ORDER BY created_at DESC"
    ).bind(sessionUser.user_id).all();
    if (!userOrders.results || !userOrders.results.length) {
      return new Response(JSON.stringify({ status: 'error', message: 'No purchases found for this user' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({
      status: 'ok',
      orders: userOrders.results.map(function(o) {
        return {
          tx_ref: o.tx_ref,
          item_type: o.item_type,
          item_name: o.item_name,
          item_variant: o.item_variant,
          amount: o.amount,
          currency: o.currency,
          customer_name: o.customer_name,
          created_at: o.created_at
        };
      })
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
