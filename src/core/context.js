import { raw } from './html.js';
import { config } from '../config.js';
import { translator, field, isLocale } from '../i18n/index.js';
import { cartCount } from '../db/repo/cart.js';
import { listCategories } from '../db/repo/taxonomy.js';
import { unsign } from './crypto.js';

export const CART_COOKIE = 'bg_cart';

/**
 * Per-request view context. Everything a template needs is resolved once here:
 * locale, translator, current URL, cart size and asset URL resolution.
 */
export function buildContext({ req, url, locale, cookies, assets }) {
  const t = translator(locale);
  const cartId = unsign(cookies[CART_COOKIE] || '') || null;

  const proto = config.trustProxy
    ? (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()
    : (req.socket.encrypted ? 'https' : 'http');
  const host = (config.trustProxy && req.headers['x-forwarded-host']) || req.headers.host || 'localhost';

  const restOfPath = url.pathname.replace(/^\/(sq|en)(?=\/|$)/, '') || '';

  const ctx = {
    locale,
    t,
    company: config.company,
    path: url.pathname,
    search: url.search,
    origin: `${proto}://${host}`,
    cartId,
    quoteCount: cartId ? cartCount(cartId) : 0,
    categories: listCategories(),

    /** Locale-specific column of a row: ctx.f(product, 'name') */
    f: (row, name) => field(row, name, locale),

    /** Fingerprinted URL for a static asset. */
    asset: (path) => assets.url(path),

    /** The same page in another locale, preserving path and query. */
    localeUrl: (code) => `/${code}${restOfPath}${url.search}`,

    suggestScript: raw(
      `<script src="${assets.url('/assets/js/suggest.js')}" defer></script>`,
    ),
  };
  return ctx;
}

/** Resolve the locale from the URL prefix. Returns null when absent. */
export function localeFromPath(pathname) {
  const segment = pathname.split('/')[1];
  return isLocale(segment) ? segment : null;
}
