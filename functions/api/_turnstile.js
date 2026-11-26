// Canonical server-side verification for Cloudflare Turnstile.
//
// The browser embeds the widget and gets a `cf-turnstile-response` token; this
// module is the only place that talks to Cloudflare's siteverify endpoint, so
// the secret never reaches the client. Verdicts:
//
//   - No TURNSTILE_SECRET configured -> reject. An unconfigured deploy is a
//     configuration error, not a reason to let auth/payment/claim traffic in.
//   - Missing/empty token -> reject.
//   - siteverify returns success -> allow, anything else -> reject.
//   - siteverify unreachable or non-2xx -> reject (fail closed).
export async function verifyTurnstile(env, request, token) {
  if (!env || !env.TURNSTILE_SECRET) return false;
  if (!token || !String(token).trim()) return false;
  var ip = '';
  try {
    ip = (request && request.headers && request.headers.get('CF-Connecting-IP')) || '';
  } catch (_e) {}

  var body = new URLSearchParams();
  body.set('secret', env.TURNSTILE_SECRET);
  body.set('response', String(token));
  if (ip) body.set('remoteip', ip);

  try {
    var resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    if (!resp) return false;
    // Non-2xx responses are never a successful challenge verdict.
    if (resp.ok === false || (typeof resp.status === 'number' && (resp.status < 200 || resp.status >= 300))) return false;
    var result = await resp.json();
    return !!(result && result.success);
  } catch (_e) {
    return false;
  }
}

// Pull the token out of whichever shape the handler already parsed.
// kind: 'form' reads FormData, otherwise a JSON body.
export function turnstileToken(body, kind) {
  if (!body) return '';
  if (kind === 'form') {
    try { return body.get('cf-turnstile-response') || ''; } catch (_e) { return ''; }
  }
  return body['cf-turnstile-response'] || body.cf_turnstile_token || '';
}
