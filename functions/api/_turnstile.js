// Canonical server-side verification for Cloudflare Turnstile.
//
// The browser embeds the widget and gets a `cf-turnstile-response` token; this
// module is the only place that talks to Cloudflare's siteverify endpoint, so
// the secret never reaches the client. Verdicts:
//
//   - No TURNSTILE_SECRET configured -> allow. The widget only renders when a
//     sitekey is present, so this path exists so an unconfigured deploy (or a
//     local run without secrets) never locks real users out of the forms.
//   - Missing/empty token -> reject.
//   - siteverify returns success -> allow, anything else -> reject.
//   - siteverify unreachable -> allow, matching checkRateLimit's fail-open
//     posture so a Cloudflare blip cannot block legitimate submissions.
export async function verifyTurnstile(env, request, token) {
  if (!env || !env.TURNSTILE_SECRET) return true;
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
    var result = await resp.json();
    return !!(result && result.success);
  } catch (_e) {
    return true;
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
