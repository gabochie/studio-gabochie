// Shared outreach unsubscribe link builder.
// Token = hex(HMAC-SHA256(secret, email)); verified by /api/outreach/unsubscribe.
// Secret resolution must match that endpoint so links validate.
export function unsubscribeSecret(env) {
  return env.UNSUBSCRIBE_SECRET || env.TRACKING_JWT_SECRET || 'fallback-secret-change-me';
}

export async function buildUnsubscribeUrl(baseUrl, email, env) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(unsubscribeSecret(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(email));
  const token = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return baseUrl + '/api/outreach/unsubscribe?email=' + encodeURIComponent(email) + '&token=' + token;
}

export function unsubscribeFooter(url) {
  return (
    '<div style="margin-top:28px;padding-top:16px;border-top:1px solid #E2E8F0;text-align:center;font-family:sans-serif;font-size:11px;color:#94A3B8">' +
    'You are receiving this email from Studio Gabochie.<br>' +
    '<a href="' + url + '" style="color:#94A3B8;text-decoration:underline">Unsubscribe</a></div>'
  );
}

export function injectUnsubscribeAndPixel(html, footer, pixel) {
  if (html.indexOf('</body>') >= 0) return html.replace('</body>', footer + pixel + '</body>');
  return html + footer + pixel;
}
