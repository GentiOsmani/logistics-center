import { createServer } from 'node:http';
import process from 'node:process';

import { config, LOCALES, DEFAULT_LOCALE } from './src/config.js';
import { AssetStore, sendUpload } from './src/core/static.js';
import { parseCookies } from './src/core/cookies.js';
import { buildContext, localeFromPath } from './src/core/context.js';
import {
  sendHtml, sendText, redirect, setSecurityHeaders,
} from './src/core/respond.js';
import { negotiate } from './src/i18n/index.js';

import { publicRoutes } from './src/routes/public.js';
import { adminRoutes } from './src/routes/admin.js';
import { errorPage } from './src/views/pages/misc.js';
import { seed } from './src/db/seed/index.js';
import { closeDb } from './src/db/db.js';
import { purgeExpiredSessions } from './src/db/repo/users.js';
import { purgeStaleCarts } from './src/db/repo/cart.js';
import { listCategories, listBrands, listServices } from './src/db/repo/taxonomy.js';
import { all } from './src/db/db.js';

const assets = await new AssetStore().load();
seed();

/* --------------------------------------------------------------- routing */

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = url.pathname;

  // Normalise: strip a trailing slash so /sq/products/ and /sq/products are one page.
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return redirect(res, pathname.slice(0, -1) + url.search, 308);
  }

  // Static assets and uploads bypass the whole application layer. A miss under
  // these prefixes is a dead end, not something to hand on to the page router.
  if (pathname.startsWith('/assets/')) {
    if (assets.send(req, res, pathname)) return;
    return sendText(req, res, 'Not found', { status: 404, cache: 'no-store' });
  }
  if (pathname.startsWith('/files/')) {
    if (await sendUpload(req, res, pathname.slice(7))) return;
    return sendText(req, res, 'Not found', { status: 404, cache: 'no-store' });
  }

  setSecurityHeaders(res);

  if (pathname === '/robots.txt') return sendRobots(req, res, url);
  if (pathname === '/sitemap.xml') return sendSitemap(req, res, url);
  if (pathname === '/healthz') return sendText(req, res, 'ok', { cache: 'no-store' });

  const cookies = parseCookies(req.headers.cookie);

  // Admin lives outside the locale prefix; it is a single-language back office.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return adminRoutes.dispatch(req, res, { url, pathname, cookies, assets });
  }

  // Everything public is /{locale}/...
  const locale = localeFromPath(pathname);
  if (!locale) {
    const preferred = negotiate(req.headers['accept-language']) || DEFAULT_LOCALE;
    return redirect(res, `/${preferred}${pathname === '/' ? '' : pathname}${url.search}`, 302);
  }

  const ctx = buildContext({ req, url, locale, cookies, assets });
  const match = publicRoutes.match(req.method, pathname);

  if (match) {
    const result = await match.handler(ctx, req, res, {
      params: match.params,
      query: url.searchParams,
    });
    if (result !== false) return;
  }

  await sendHtml(req, res, errorPage(ctx, 404), { status: 404, cache: 'no-store' });
}

/* ------------------------------------------------------------ seo routes */

function sendRobots(req, res, url) {
  const origin = `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host || url.host}`;
  sendText(req, res,
    `User-agent: *\nDisallow: /admin\nDisallow: /*/quote\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
    { cache: 'public, max-age=86400' });
}

function sendSitemap(req, res, url) {
  const origin = `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host || url.host}`;
  const paths = ['', '/products', '/brands', '/services', '/support', '/about', '/contact'];
  for (const c of listCategories()) paths.push(`/products?category=${c.slug}`);
  for (const b of listBrands()) paths.push(`/brands/${b.slug}`);
  for (const s of listServices()) paths.push(`/services/${s.slug}`);
  for (const p of all('SELECT slug FROM products WHERE is_active = 1')) {
    paths.push(`/products/${p.slug}`);
  }

  const entries = [];
  for (const path of paths) {
    for (const locale of LOCALES) {
      const loc = `${origin}/${locale}${path}`.replace(/&/g, '&amp;');
      const alternates = LOCALES.map((code) =>
        `<xhtml:link rel="alternate" hreflang="${code}" href="${
          `${origin}/${code}${path}`.replace(/&/g, '&amp;')}"/>`).join('');
      entries.push(`<url><loc>${loc}</loc>${alternates}</url>`);
    }
  }

  sendText(req, res,
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
    + 'xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    + entries.join('') + '</urlset>',
    { type: 'application/xml; charset=utf-8', cache: 'public, max-age=3600' });
}

/* ---------------------------------------------------------------- server */

const server = createServer((req, res) => {
  handle(req, res).catch(async (error) => {
    const status = error?.status || 500;
    if (status >= 500) console.error(`[${req.method} ${req.url}]`, error);
    if (res.headersSent) return res.destroy();
    try {
      const locale = localeFromPath(new URL(req.url, 'http://localhost').pathname)
        || DEFAULT_LOCALE;
      const ctx = buildContext({
        req,
        url: new URL(req.url, 'http://localhost'),
        locale,
        cookies: {},
        assets,
      });
      await sendHtml(req, res, errorPage(ctx, status), { status, cache: 'no-store' });
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Internal error');
    }
  });
});

server.keepAliveTimeout = 30_000;
server.headersTimeout = 35_000;

server.listen(config.port, config.host, () => {
  console.log(`\n  ${config.company.name} — ${config.company.tagline}`);
  console.log(`  http://localhost:${config.port}  ·  admin: /admin`);
  console.log(`  ${config.isProd ? 'production' : 'development'} · node ${process.version}\n`);
});

// Hourly housekeeping; unref'd so it never keeps the process alive on its own.
setInterval(() => {
  try {
    purgeExpiredSessions();
    purgeStaleCarts();
  } catch (error) {
    console.error('sweep failed', error);
  }
}, 3600_000).unref();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => { closeDb(); process.exit(0); });
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
