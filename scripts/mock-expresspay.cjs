// Mock ExpressPay gateway for local E2E testing.
// Speaks the Merchant API contract from functions/api/gateways/expresspay/_expresspay.js:
//   POST /api/submit.php  -> { status: 1, token: '...', 'order-id': '...' }
//   POST /api/query.php   -> { result: '1'|'2'|'4', amount, currency, 'order-id', 'transaction-id', token }
//   GET  /checkout.php?token=... -> hosted checkout page; "Pay" triggers OUR callback
//          (hardcoded local base, never the prod PUBLIC_BASE_URL) then redirects to the
//          redirect-url with status params, like the real hosted checkout does.
// Control: POST /__reset (clears tokens), GET /__tokens (debug dump).
// Default outcome per token: APPROVED. Override via /__set?token=..&result=2|4.
const http = require('http');
const crypto = require('crypto');

const PORT = 8790;
const LOCAL_SITE = 'http://localhost:8788'; // our local Pages dev (callback target)
const tokens = new Map(); // token -> { amount, orderId, redirectUrl, postUrl, resultOverride }

function parseForm(body) {
  const out = {};
  for (const [k, v] of new URLSearchParams(body)) out[k] = v;
  return out;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    try {
      // ── control endpoints ──
      if (url.pathname === '/__reset') {
        tokens.clear();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('{"ok":true}');
      }
      if (url.pathname === '/__set') {
        const t = tokens.get(url.searchParams.get('token'));
        if (t) t.resultOverride = url.searchParams.get('result') || '1';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: !!t }));
      }
      if (url.pathname === '/__tokens') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([...tokens.entries()], null, 1));
      }

      // ── submit.php: create a checkout token ──
      if (url.pathname === '/api/submit.php') {
        const p = parseForm(body);
        const token = 'mocktok_' + crypto.randomBytes(6).toString('hex');
        tokens.set(token, {
          amount: parseFloat(p['amount'] || '0'),
          orderId: p['order-id'] || '',
          redirectUrl: p['redirect-url'] || '',
          postUrl: p['post-url'] || '',
          resultOverride: null
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 1, token: token, 'order-id': p['order-id'] || '' }));
      }

      // ── query.php: gateway-side transaction status ──
      if (url.pathname === '/api/query.php') {
        const p = parseForm(body);
        const t = tokens.get(p['token'] || '');
        if (!t) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ result: '2', 'result-text': 'unknown token' }));
        }
        const result = t.resultOverride || '1';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          result: result,
          amount: t.amount.toFixed(2),
          currency: 'GHS',
          'order-id': t.orderId,
          'transaction-id': 'mocktx_' + crypto.randomBytes(4).toString('hex'),
          token: p['token'] || '',
          'result-text': result === '1' ? 'Approved' : (result === '4' ? 'Pending' : 'Declined')
        }));
      }

      // ── checkout.php: hosted checkout simulation ──
      if (url.pathname === '/api/checkout.php' || url.pathname === '/checkout.php') {
        const token = url.searchParams.get('token') || '';
        const t = tokens.get(token);
        if (!t) { res.writeHead(404); return res.end('unknown token'); }
        const result = t.resultOverride || '1';
        // Simulate the buyer paying: the gateway then POSTs to our post-url
        // (server-to-server) and redirects the browser to the redirect-url.
        const page = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0A1628;color:#fff">
<h1>Mock ExpressPay checkout</h1>
<p>order ${t.orderId} · GHS ${t.amount.toFixed(2)} · outcome: ${result === '1' ? 'APPROVE' : result === '4' ? 'PENDING' : 'DECLINE'}</p>
<button id="pay" style="padding:12px 24px;font-size:16px">Pay now</button>
<script>
document.getElementById('pay').addEventListener('click', async function () {
  const cb = await fetch('${LOCAL_SITE}/api/gateways/expresspay/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'order-id': ${JSON.stringify(t.orderId)}, token: ${JSON.stringify(token)}, 'transaction-id': 'mocktx_browser_' + Date.now() })
  });
  window.location.href = ${JSON.stringify(t.redirectUrl)} + '&mock_cb=' + cb.status;
});
</script></body></html>`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(page);
      }

      res.writeHead(404); res.end('not found');
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
});
server.listen(PORT, () => console.log('Mock ExpressPay on http://localhost:' + PORT));
