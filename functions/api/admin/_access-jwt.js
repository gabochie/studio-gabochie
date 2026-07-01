// Cloudflare Access JWT verification
// Requires env.CF_ACCESS_TEAM (e.g. "gideonabochie") and env.CF_ACCESS_AUD (Access app AUD tag)

var keyCache = null;
var keyCacheTime = 0;

function base64UrlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), function(c) { return c.charCodeAt(0); });
}

function base64UrlToString(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

function parseJwtPayload(payload) {
  try { return JSON.parse(base64UrlToString(payload)); }
  catch (e) { return null; }
}

async function fetchPublicKeys(team, env) {
  var url = 'https://' + team + '.cloudflareaccess.com/cdn-cgi/access/certs';
  // Try KV cache first if available
  if (env.GA_KV) {
    try {
      var cached = await env.GA_KV.get('cf_access_jwks', { type: 'text' });
      if (cached) return JSON.parse(cached).keys;
    } catch (e) {}
  }
  var res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch Access public keys: ' + res.status);
  var data = await res.json();
  var keys = data.keys || [];
  // Cache in KV if available
  if (env.GA_KV && keys.length) {
    try { await env.GA_KV.put('cf_access_jwks', JSON.stringify({ keys: keys }), { expirationTtl: 300 }); }
    catch (e) {}
  }
  return keys;
}

function findKey(keys, kid) {
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].kid === kid) return keys[i];
  }
  return null;
}

async function importJwk(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

export async function verifyAccessJwt(request, env) {
  var team = env.CF_ACCESS_TEAM;
  var aud = env.CF_ACCESS_AUD;
  if (!team || !aud) return null;

  // Extract JWT from header, cookie, or Authorization header
  var jwt = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  if (!jwt) {
    var cookie = request.headers.get('Cookie') || '';
    var m = cookie.match(/CF_Authorization=([^;]+)/);
    if (m) jwt = decodeURIComponent(m[1]);
  }
  if (!jwt) {
    var auth = request.headers.get('Authorization') || '';
    if (auth.startsWith('Bearer ')) jwt = auth.slice(7);
  }
  if (!jwt) return null;

  var parts = jwt.split('.');
  if (parts.length !== 3) return null;

  // Parse header to get kid
  var header = parseJwtPayload(parts[0]);
  if (!header || !header.kid) return null;

  // Fetch and cache public keys
  var keys;
  try { keys = await fetchPublicKeys(team, env); }
  catch (e) { return null; }

  var jwk = findKey(keys, header.kid);
  if (!jwk) return null;

  // Verify signature
  var signature = base64UrlDecode(parts[2]);
  var data = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  var key;
  try { key = await importJwk(jwk); }
  catch (e) { return null; }

  var valid;
  try { valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data); }
  catch (e) { return null; }
  if (!valid) return null;

  // Parse and validate payload claims
  var payload = parseJwtPayload(parts[1]);
  if (!payload) return null;

  var now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;
  if (payload.nbf && payload.nbf > now) return null;
  if (payload.iss && !payload.iss.includes(team)) return null;

  // Validate audience
  if (payload.aud) {
    var expectedAud = aud;
    // aud can be string or array
    var audMatch = false;
    if (typeof payload.aud === 'string') {
      audMatch = payload.aud === expectedAud || payload.aud.indexOf(expectedAud) !== -1;
    } else if (Array.isArray(payload.aud)) {
      for (var i = 0; i < payload.aud.length; i++) {
        if (payload.aud[i] === expectedAud || payload.aud[i].indexOf(expectedAud) !== -1) {
          audMatch = true; break;
        }
      }
    }
    if (!audMatch) return null;
  }

  return {
    sub: payload.sub || '',
    email: payload.email || '',
    name: payload.name || payload.email || 'Admin',
    iat: payload.iat,
    exp: payload.exp
  };
}
