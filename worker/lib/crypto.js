// Ported from src/core/crypto.js. Rewritten against Web Crypto (`crypto.subtle`,
// `crypto.getRandomValues`) instead of node:crypto — this avoids depending on
// how much of node:crypto the `nodejs_compat` flag covers, and Web Crypto's
// `subtle.verify` gives a constant-time HMAC comparison for free, so no
// separate timingSafeEqual is needed for signing.
//
// Password hashing switches from scrypt to PBKDF2-SHA256 (natively supported
// by Web Crypto). This is a free choice, not a migration: the D1 database
// starts empty, so there are no existing scrypt hashes to preserve.

const PBKDF2_ITERATIONS = 100_000;

function toBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
}

export async function hmac(value, secret) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(sig));
}

/** Sign a string as `value.signature`. */
export async function sign(value, secret) {
  return `${value}.${await hmac(value, secret)}`;
}

/** Verify and unwrap a signed string, or null. */
export async function unsign(signed, secret) {
  if (typeof signed !== 'string') return null;
  const idx = signed.lastIndexOf('.');
  if (idx < 1) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const key = await hmacKey(secret);
  let macBytes;
  try { macBytes = fromBase64Url(mac); } catch { return null; }
  const ok = await crypto.subtle.verify('HMAC', key, macBytes, new TextEncoder().encode(value));
  return ok ? value : null;
}

export function token(bytes = 24) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password, salt, lengthBytes) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key, lengthBytes * 8,
  );
  return new Uint8Array(bits);
}

/** PBKDF2 password hash: `pbkdf2$iterations$salt$hash` (base64url parts). */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await pbkdf2(password, salt, 32);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  let salt, expected;
  try {
    salt = fromBase64Url(parts[2]);
    expected = fromBase64Url(parts[3]);
  } catch { return false; }
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key, expected.length * 8,
  );
  return timingSafeEqual(new Uint8Array(bits), expected);
}
