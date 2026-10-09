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
    // tx_ref only: the unguessable receipt reference emailed to the buyer.
    // Email lookup removed (purchase enumeration risk); the receipt email
    // always contains the download link.
    if (!tx_ref) {
      return new Response(JSON.stringify({ status: 'error', message: 'Provide tx_ref (see your receipt email)' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    let purchase = await env.DB.prepare(
      "SELECT * FROM book_purchases WHERE tx_ref = ? AND status = 'completed'"
    ).bind(tx_ref).first();
    if (!purchase) {
      return new Response(JSON.stringify({ status: 'error', message: 'No valid purchase found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    // Mark downloaded
    await env.DB.prepare("UPDATE book_purchases SET downloaded = downloaded + 1 WHERE id = ?").bind(purchase.id).run();
    const books = await env.DB.prepare(
      "SELECT id, title, slug, description, price, cover_url, is_premium, sort_order FROM books WHERE slug != 'premium-bundle' ORDER BY sort_order ASC"
    ).all();
    return new Response(JSON.stringify({ status: 'ok', books: books.results, purchase: { tx_ref: purchase.tx_ref, email: purchase.email, amount: purchase.amount } }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
