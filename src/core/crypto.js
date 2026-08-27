import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

export function hmac(value) {
  return createHmac('sha256', config.secret).update(value).digest('base64url');
}

/** Sign a string as `value.signature`. */
export function sign(value) {
  return `${value}.${hmac(value)}`;
}

/** Verify and unwrap a signed string, or null. */
export function unsign(signed) {
  if (typeof signed !== 'string') return null;
  const idx = signed.lastIndexOf('.');
  if (idx < 1) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = hmac(value);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return value;
}

export function token(bytes = 24) {
  return randomBytes(bytes).toString('base64url');
}

/** scrypt password hash: `scrypt$N$salt$hash` */
export function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$16384$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[2], 'base64');
  const expected = Buffer.from(parts[3], 'base64');
  let derived;
  try { derived = scryptSync(password, salt, expected.length); }
  catch { return false; }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
