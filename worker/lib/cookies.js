// Ported unchanged from src/core/cookies.js — no Node-specific APIs, runs as-is
// on Workers.

export function parseCookies(header) {
  const out = Object.create(null);
  if (!header) return out;
  let i = 0;
  while (i < header.length) {
    const eq = header.indexOf('=', i);
    if (eq === -1) break;
    let end = header.indexOf(';', eq);
    if (end === -1) end = header.length;
    const key = header.slice(i, eq).trim();
    if (key && out[key] === undefined) {
      const value = header.slice(eq + 1, end).trim();
      try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
    }
    i = end + 1;
  }
  return out;
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}
