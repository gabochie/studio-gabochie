export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  const url = new URL(request.url);
  const tx_ref = url.searchParams.get('tx_ref') || '';
  const email = url.searchParams.get('email') || '';
  const userId = url.searchParams.get('user_id') || '';
  try {
    if (userId) {
      var userOrders = await env.DB.prepare(
        "SELECT * FROM store_orders WHERE user_id = ? AND status = 'completed' ORDER BY created_at DESC"
      ).bind(parseInt(userId)).all();
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
    }
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
    if (email) {
      var orders = await env.DB.prepare(
        "SELECT * FROM store_orders WHERE customer_email = ? AND status = 'completed' ORDER BY created_at DESC"
      ).bind(email).all();
      if (!orders.results || !orders.results.length) {
        return new Response(JSON.stringify({ status: 'error', message: 'No purchases found for this email' }), {
          status: 404, headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({
        status: 'ok',
        orders: orders.results.map(function(o) {
          return {
            tx_ref: o.tx_ref,
            item_type: o.item_type,
            item_name: o.item_name,
            item_variant: o.item_variant,
            amount: o.amount,
            currency: o.currency,
            created_at: o.created_at
          };
        })
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ status: 'error', message: 'Provide tx_ref or email' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
