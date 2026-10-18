/**
 * Outreach Unsubscribe Endpoint
 * GET /api/outreach/unsubscribe?email=...&token=...
 * Validates HMAC token, adds to suppression list
 */

async function verifyToken(email, token, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  const data = encoder.encode(email);
  const sigBuffer = hexToBuffer(token);
  
  return await crypto.subtle.verify('HMAC', key, sigBuffer, data);
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

function unsubscribePage(message, isError = false) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe — Studio Gabochie</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'DM Sans',sans-serif;background:#0A1628;color:#CBD5E1;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#0F1E38;border:1px solid #1E3250;border-radius:16px;padding:40px;max-width:480px;width:100%;text-align:center}
    .icon{width:64px;height:64px;border-radius:50%;background:rgba(201,168,76,.15);border:1px solid #C9A84C;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:28px;color:#C9A84C}
    h1{font-family:'Barlow Condensed',sans-serif;font-size:28px;text-transform:uppercase;color:#F1F5F9;margin-bottom:12px}
    p{font-size:15px;line-height:1.7;color:#8A9BB5;margin-bottom:24px}
    .btn{display:inline-block;padding:12px 28px;border-radius:8px;background:#C9A84C;color:#0A1628;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;transition:background .2s}
    .btn:hover{background:#D9B85C}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✉</div>
    <h1>${isError ? 'Error' : 'Unsubscribed'}</h1>
    <p>${message}</p>
    <a href="https://studio.gabochie.com" class="btn">Return to Studio Gabochie</a>
  </div>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  if (!email || !token) {
    return new Response(unsubscribePage('Invalid link. Email and token required.', true), {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  const secret = env.UNSUBSCRIBE_SECRET || env.TRACKING_JWT_SECRET || 'fallback-secret-change-me';
  
  let valid = false;
  try {
    valid = await verifyToken(email, token, secret);
  } catch (err) {
    console.error('Token verification error:', err);
  }

  if (!valid) {
    return new Response(unsubscribePage('Invalid or expired unsubscribe link.', true), {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  try {
    // Add to suppression list
    await env.DB.prepare(
      `INSERT OR REPLACE INTO suppression_list (email, reason, created_at)
       VALUES (?, 'unsubscribe', datetime('now'))`
    ).bind(email).run();

    // Update any pending emails
    await env.DB.prepare(
      `UPDATE email_queue SET status = 'unsubscribed', updated_at = datetime('now')
       WHERE to_email = ? AND status IN ('pending', 'sending')`
    ).bind(email).run();

    // Update cold_outreach if exists
    await env.DB.prepare(
      `UPDATE cold_outreach SET status = 'unsubscribed', updated_at = datetime('now')
       WHERE email = ?`
    ).bind(email).run();

    return new Response(unsubscribePage('You have been successfully unsubscribed from outreach emails. You will no longer receive outreach emails from Studio Gabochie.'), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (err) {
    console.error('Unsubscribe error:', err);
    return new Response(unsubscribePage('An error occurred. Please try again or contact support.', true), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}