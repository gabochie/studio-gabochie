export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ status: 'error', message: 'D1 not bound' }), {
      status: 501, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug') || '';
    const email = url.searchParams.get('email') || '';
    const tx_ref = url.searchParams.get('tx_ref') || '';

    if (!slug) {
      return new Response(JSON.stringify({ status: 'error', message: 'Missing slug parameter' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const book = await env.DB.prepare(
      "SELECT * FROM books WHERE slug = ?"
    ).bind(slug).first();

    if (!book || !book.file_url) {
      return new Response(JSON.stringify({ status: 'error', message: 'Book not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Access control: tx_ref (purchase) takes priority; email fallback for free books
    let authorized = false;
    if (tx_ref) {
      const purchase = await env.DB.prepare(
        "SELECT * FROM book_purchases WHERE tx_ref = ? AND status = 'completed'"
      ).bind(tx_ref).first();
      if (purchase) authorized = true;
    }
    if (!authorized && !book.is_premium && email) {
      const subscriber = await env.DB.prepare(
        "SELECT * FROM subscribers WHERE email = ?"
      ).bind(email).first();
      if (subscriber) authorized = true;
    }
    if (!authorized) {
      const msg = book.is_premium ? 'This book requires a valid purchase. Please visit the books page to purchase the premium bundle.' : 'Please submit your email on the books page to download this free book.';
      const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access Required</title><style>body{font-family:system-ui,sans-serif;background:#0A1628;color:#CBD5E1;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}.card{background:#0F1E38;border:1px solid #1E3250;border-radius:16px;padding:40px 32px;max-width:420px;text-align:center}h1{font-size:28px;color:#F1F5F9;margin:0 0 8px}h1 span{color:#C9A84C}p{color:#6B7F9A;line-height:1.7;margin:0 0 24px}.btn{display:inline-block;background:#C9A84C;color:#0A1628;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;padding:14px 32px;border-radius:8px}</style></head><body><div class="card"><h1>Access <span>Required</span></h1><p>' + msg + '</p><a href="/books/" class="btn">Go to Books</a></div></body></html>';
      return new Response(html, { status: 403, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    const assetUrl = new URL(request.url);
    assetUrl.pathname = book.file_url;
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl));

    if (!assetResponse.ok) {
      return new Response(JSON.stringify({ status: 'error', message: 'File not found on server' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }

    const fileName = book.file_url.split('/').pop();
    const ext = fileName.split('.').pop().toLowerCase();
    const contentTypes = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', html: 'text/html' };
    const headers = new Headers(assetResponse.headers);
    headers.set('Content-Type', contentTypes[ext] || 'application/octet-stream');
    headers.set('Content-Disposition', 'inline; filename="' + fileName + '"');
    headers.set('X-Robots-Tag', 'noindex');

    return new Response(assetResponse.body, { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
