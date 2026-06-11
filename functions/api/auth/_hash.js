export async function hashCode(code, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(code), 'PBKDF2', false, ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(derivedBits)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

export function genSalt() {
  var bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

export function genToken() {
  var bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

export async function hashPassword(password) {
  var salt = genSalt();
  var hash = await hashCode(password, salt);
  return salt + ':' + hash;
}

export async function verifyPassword(password, stored) {
  var parts = stored.split(':');
  if (parts.length !== 2) return false;
  var salt = parts[0];
  var expectedHash = parts[1];
  var actualHash = await hashCode(password, salt);
  return actualHash === expectedHash;
}
