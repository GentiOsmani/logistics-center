import { brotliCompress, gzip, constants as zlibConstants } from 'node:zlib';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

// Quality 4 keeps CPU cost per response low while still beating gzip -6 on HTML.
const BROTLI_OPTS = { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } };
const MIN_COMPRESS = 1024;

export function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // No inline scripts other than the one hashed module we ship; keep it strict.
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; "
    + "form-action 'self'; frame-ancestors 'self'; base-uri 'none'");
}

/**
 * Send an HTML document, compressed when it is worth it, with a content ETag
 * so repeat views of an unchanged page cost one 304.
 */
export async function sendHtml(req, res, markup, { status = 200, cache = 'no-cache' } = {}) {
  const buf = Buffer.from(String(markup), 'utf8');
  const etag = '"' + createHash('sha1').update(buf).digest('base64url').slice(0, 20) + '"';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.setHeader('ETag', etag);

  if (req.headers['if-none-match'] === etag) { res.writeHead(304).end(); return; }

  let payload = buf;
  if (buf.length >= MIN_COMPRESS) {
    const accept = req.headers['accept-encoding'] || '';
    try {
      if (accept.includes('br')) {
        payload = await brotliAsync(buf, BROTLI_OPTS);
        res.setHeader('Content-Encoding', 'br');
      } else if (accept.includes('gzip')) {
        payload = await gzipAsync(buf, { level: 6 });
        res.setHeader('Content-Encoding', 'gzip');
      }
      if (payload !== buf) res.setHeader('Vary', 'Accept-Encoding');
    } catch {
      payload = buf; // compression failure must never lose the response
    }
  }

  res.setHeader('Content-Length', payload.length);
  if (req.method === 'HEAD') { res.writeHead(status).end(); return; }
  res.writeHead(status).end(payload);
}

export function sendJson(req, res, data, status = 200) {
  const buf = Buffer.from(JSON.stringify(data), 'utf8');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', buf.length);
  res.writeHead(status).end(req.method === 'HEAD' ? undefined : buf);
}

export function sendText(req, res, body, { status = 200, type = 'text/plain; charset=utf-8', cache = 'no-cache' } = {}) {
  const buf = Buffer.from(body, 'utf8');
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cache);
  res.setHeader('Content-Length', buf.length);
  res.writeHead(status).end(req.method === 'HEAD' ? undefined : buf);
}

export function redirect(res, location, status = 303) {
  res.setHeader('Location', location);
  res.setHeader('Content-Length', '0');
  res.writeHead(status).end();
}

/**
 * Reject cross-site form posts. Public forms carry no session, so an origin
 * check plus the honeypot is proportionate protection without a token round-trip.
 */
export function isSameOrigin(req) {
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { return new URL(origin).host === host; } catch { return false; }
}
