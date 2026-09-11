export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const body = await request.json();
    const { tx_ref, email, name, amount, books } = body;
    if (!tx_ref || !email || !amount) {
      return new Response(JSON.stringify({ status: 'error', message: 'tx_ref, email, amount required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    await env.DB.prepare(
      `INSERT OR IGNORE INTO book_purchases (tx_ref, email, name, amount, books_purchased, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`
    ).bind(tx_ref, email, name || '', amount, books || '').run();
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
