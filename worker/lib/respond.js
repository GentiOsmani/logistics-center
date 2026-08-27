// Response helpers for the Worker, replacing src/core/respond.js. Compression
// and conditional-GET caching are dropped on purpose: Cloudflare's edge
// already negotiates and applies compression per Accept-Encoding in front of
// every Worker response, so hand-rolling brotli/gzip (as the Node server did,
// since it had no CDN in front of it) would be redundant here.

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'",
};

function withDefaults(headers, cache) {
  return {
    ...SECURITY_HEADERS,
    'Cache-Control': cache || 'no-store',
    ...headers,
  };
}

export function html(body, { status = 200, cache, headers = {} } = {}) {
  return new Response(String(body), {
    status,
    headers: withDefaults({ 'Content-Type': 'text/html; charset=utf-8', ...headers }, cache),
  });
}

export function json(data, { status = 200, cache, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: withDefaults({ 'Content-Type': 'application/json; charset=utf-8', ...headers }, cache),
  });
}

export function text(body, { status = 200, cache, headers = {} } = {}) {
  return new Response(String(body), {
    status,
    headers: withDefaults({ 'Content-Type': 'text/plain; charset=utf-8', ...headers }, cache),
  });
}

export function redirect(location, status = 302, extraHeaders = {}) {
  return new Response(null, { status, headers: { Location: location, ...SECURITY_HEADERS, ...extraHeaders } });
}

/** CORS headers for the public API, restricted to the configured Pages origin. */
export function withCors(response, origin) {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}
