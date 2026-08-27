/**
 * Fixed-window rate limiter held in a Map. Adequate for a single-process
 * deployment and costs nothing when idle — the sweep only runs on access.
 */
export class RateLimiter {
  #hits = new Map();
  #limit;
  #windowMs;
  #lastSweep = 0;

  constructor({ limit = 10, windowMs = 60_000 } = {}) {
    this.#limit = limit;
    this.#windowMs = windowMs;
  }

  /** @returns {boolean} true when the request is allowed. */
  check(key) {
    const now = Date.now();
    if (now - this.#lastSweep > this.#windowMs) this.#sweep(now);

    const entry = this.#hits.get(key);
    if (!entry || now > entry.resetAt) {
      this.#hits.set(key, { count: 1, resetAt: now + this.#windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.#limit;
  }

  #sweep(now) {
    this.#lastSweep = now;
    for (const [key, entry] of this.#hits) {
      if (now > entry.resetAt) this.#hits.delete(key);
    }
  }
}

/** Client address, honouring X-Forwarded-For only when explicitly trusted. */
export function clientIp(req, trustProxy) {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}
