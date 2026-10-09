// ExpressPay Merchant API (redirect flow: submit -> checkout -> query/post-url).
// Docs: https://expresspaygh.com/developers/docs/accept-payments/merchant-api
// Env: EXPRESSPAY_MERCHANT_ID, EXPRESSPAY_API_KEY,
//      EXPRESSPAY_LIVE=1 for production (default: sandbox), or EXPRESSPAY_BASE_URL override.

export function expresspayBase(env) {
  if (env.EXPRESSPAY_BASE_URL) return String(env.EXPRESSPAY_BASE_URL).replace(/\/$/, '');
  if (env.EXPRESSPAY_LIVE === '1' || env.EXPRESSPAY_LIVE === 'true') return 'https://expresspaygh.com/api';
  return 'https://sandbox.expresspaygh.com/api';
}

function formBody(params) {
  return Object.keys(params)
    .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k] == null ? '' : String(params[k])); })
    .join('&');
}

// Step 1: submit an order, get back a checkout token.
// Returns { ok, token, orderId } or { ok:false, error }.
export async function expresspaySubmit(env, opts) {
  try {
    var merchantId = env.EXPRESSPAY_MERCHANT_ID || '';
    var apiKey = env.EXPRESSPAY_API_KEY || '';
    if (!merchantId || !apiKey) return { ok: false, error: 'gateway_not_configured' };
    var resp = await fetch(expresspayBase(env) + '/submit.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({
        'merchant-id': merchantId,
        'api-key': apiKey,
        currency: 'GHS',
        amount: Number(opts.amount).toFixed(2),
        'order-id': opts.orderId,
        'order-desc': (opts.desc || 'Studio Gabochie').slice(0, 250),
        'redirect-url': opts.redirectUrl,
        'post-url': opts.postUrl,
        firstname: (opts.firstName || opts.name || 'Valued').slice(0, 32),
        lastname: (opts.lastName || 'Customer').slice(0, 64),
        email: opts.email || '',
        phonenumber: opts.phone || ''
      })
    });
    var data = await resp.json();
    if (data && (data.status === 1 || data.status === '1') && data.token) {
      return { ok: true, token: data.token, orderId: data['order-id'] || opts.orderId };
    }
    return { ok: false, error: 'submit_rejected', detail: (data && (data.message || data.status)) || 'unknown' };
  } catch (_e) {
    return { ok: false, error: 'gateway_unavailable' };
  }
}

// Step 4a: query a transaction by its checkout token.
// Returns { approved, pending, amount, currency, orderId, transactionId, resultText }.
export async function expresspayQuery(env, token) {
  try {
    var merchantId = env.EXPRESSPAY_MERCHANT_ID || '';
    var apiKey = env.EXPRESSPAY_API_KEY || '';
    if (!merchantId || !apiKey || !token) return { approved: false, pending: false, error: 'missing_config' };
    var resp = await fetch(expresspayBase(env) + '/query.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody({ 'merchant-id': merchantId, 'api-key': apiKey, token: token })
    });
    var data = await resp.json();
    var result = data ? parseInt(data.result, 10) : 0;
    return {
      approved: result === 1,
      pending: result === 4,
      amount: data ? parseFloat(data.amount) || 0 : 0,
      currency: (data && data.currency) || 'GHS',
      orderId: (data && (data['order-id'] || data.order_id)) || '',
      transactionId: (data && (data['transaction-id'] || data.transaction_id)) || '',
      token: (data && data.token) || token,
      resultText: (data && (data['result-text'] || data.result_text)) || ''
    };
  } catch (_e) {
    return { approved: false, pending: false, error: 'gateway_unavailable' };
  }
}

export function expresspayCheckoutUrl(env, token) {
  return expresspayBase(env) + '/checkout.php?token=' + encodeURIComponent(token);
}

export function publicBase(env) {
  return (env.PUBLIC_BASE_URL || 'https://studio.gabochie.com').replace(/\/$/, '');
}
