// Rewritten from src/lib/rate-limit.js: a Worker isolate is not a persistent
// process, so the original in-memory Map can't hold counters across requests
// reliably (isolates are spun up/down and requests can land on different
// ones). This backs the same fixed-window scheme with the `rate_limits` table
// in D1 instead — one extra table on a database this app already needs, no
// separate product (e.g. Workers KV) to provision.

/** @returns {Promise<boolean>} true when the request is allowed. */
export async function checkRateLimit(db, key, { limit = 10, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const row = await db.get('SELECT count, reset_at FROM rate_limits WHERE key = ?', key);

  if (!row || now > row.reset_at) {
    await db.run(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at`,
      key, now + windowMs,
    );
    return true;
  }

  await db.run('UPDATE rate_limits SET count = count + 1 WHERE key = ?', key);
  return row.count + 1 <= limit;
}

/** Cloudflare sets this at the edge from the real connection — not client-controlled. */
export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}
