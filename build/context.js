// Build-time stand-in for src/core/context.js's per-request ctx. Same shape,
// but every field is either static (locale, categories) or a build-time
// constant (basePath, origin) instead of something read off a live request.
//
// cartId/quoteCount are always empty/0 here — the quote basket is
// client-side now (see public/assets/js/cart.js), which updates the nav
// badge from localStorage after the page loads.
import { config } from '../src/config.js';
import { translator, field } from '../src/i18n/index.js';

export function buildContext({ locale, path, search = '', categories, site }) {
  const restOfPath = path.replace(/^\/(sq|en)(?=\/|$)/, '') || '';

  return {
    locale,
    t: translator(locale),
    company: config.company,
    path,
    search,
    origin: site.origin,
    basePath: site.basePath,
    // Datasheets are static files served by GitHub Pages itself (copied from
    // data/datasheets/ — see generate.js), same origin as everything else,
    // so this just needs the base-path prefix, not a separate origin.
    filesOrigin: site.basePath,
    cartId: null,
    quoteCount: 0,
    categories,
    f: (row, name) => field(row, name, locale),
    asset: (assetPath) => `${site.basePath}${assetPath}`,
    localeUrl: (code) => `${site.basePath}/${code}${restOfPath}${search}`,
    suggestScript: '',
  };
}
