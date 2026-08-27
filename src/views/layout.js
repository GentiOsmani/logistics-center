import { html, raw } from '../core/html.js';
import { config, LOCALES } from '../config.js';
import { icon } from './partials/icons.js';

const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<rect width="32" height="32" fill="#0e131a"/>' +
  '<rect x="4.5" y="4.5" width="23" height="23" fill="none" stroke="#f5a524" stroke-width="2.5"/>' +
  '<path d="M11 21V11h4.6a2.6 2.6 0 0 1 0 5.2H11m0 0h5a2.4 2.4 0 0 1 0 4.8H11" ' +
  'fill="none" stroke="#f5a524" stroke-width="2"/>' +
  '<rect x="19" y="18" width="3" height="3" fill="#f5a524"/></svg>',
);

/**
 * Build a locale-prefixed href. `ctx.basePath` is used by the static
 * generator (build/context.js) for a GitHub Pages project site served from
 * `/<repo>/` instead of domain root; it's unset (so a no-op) for the Node
 * server and the Worker admin panel, both of which serve from root.
 */
export const L = (ctx, path = '/') => `${ctx.basePath || ''}/${ctx.locale}${path === '/' ? '' : path}`;

/* --------------------------------------------------------------- header */

function topbar(ctx) {
  const { t } = ctx;
  const other = LOCALES;
  return html`
    <div class="topbar">
      <div class="wrap">
        <a class="topbar-item" href="tel:${config.company.phone.replace(/\s/g, '')}">
          ${icon('phone', { size: 14 })}<span class="mono">${config.company.phone}</span>
        </a>
        <a class="topbar-item" href="mailto:${config.company.email}">
          ${icon('mail', { size: 14 })}<span>${config.company.email}</span>
        </a>
        <span class="topbar-item topbar-spacer">
          ${icon('clock', { size: 14 })}
          <span>${t('contact_hours_v')} ${config.company.hours}</span>
        </span>
        <nav class="lang" aria-label="Language">
          ${other.map((code) => html`
            <a href="${ctx.localeUrl(code)}" hreflang="${code}"
               ${code === ctx.locale ? raw('aria-current="true"') : ''}>${code}</a>`)}
        </nav>
      </div>
    </div>`;
}

function masthead(ctx) {
  const { t } = ctx;
  const links = [
    ['/products', t('nav_products')],
    ['/brands', t('nav_brands')],
    ['/services', t('nav_services')],
    ['/support', t('nav_support')],
    ['/about', t('nav_about')],
    ['/contact', t('nav_contact')],
  ];
  const current = (path) => ctx.path === L(ctx, path) || ctx.path.startsWith(L(ctx, path) + '/');

  return html`
    <header class="masthead">
      <div class="wrap">
        <a class="brandmark" href="${L(ctx)}">
          <span class="brandmark-badge" aria-hidden="true">B&amp;G</span>
          <span class="brandmark-text">
            <span class="brandmark-name">${config.company.name}</span>
            <span class="brandmark-sub">Industrial Supply</span>
          </span>
        </a>

        <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-hidden="true" tabindex="-1">
        <label class="nav-burger" for="nav-toggle" aria-label="${t('nav_menu')}">
          ${icon('menu', { size: 20 })}
        </label>

        <nav class="nav" aria-label="${t('nav_menu')}">
          ${links.map(([href, label]) => html`
            <a href="${L(ctx, href)}"${current(href) ? raw(' aria-current="page"') : ''}>${label}</a>`)}
        </nav>

        <div class="nav-actions">
          <a class="quote-pill" href="${L(ctx, '/quote')}">
            ${icon('list', { size: 16 })}
            <span>${t('nav_quote')}</span>
            ${ctx.quoteCount > 0 ? html`<span class="quote-count">${ctx.quoteCount}</span>` : ''}
          </a>
        </div>
      </div>
    </header>`;
}

/* --------------------------------------------------------------- footer */

function footer(ctx) {
  const { t } = ctx;
  return html`
    <footer class="footer">
      <div class="wrap">
        <div class="footer-grid">
          <div class="footer-about">
            <a class="brandmark mb-4" href="${L(ctx)}">
              <span class="brandmark-badge" aria-hidden="true">B&amp;G</span>
              <span class="brandmark-text">
                <span class="brandmark-name">${config.company.name}</span>
                <span class="brandmark-sub">Industrial Supply</span>
              </span>
            </a>
            <p>${t('footer_about')}</p>
          </div>

          <div>
            <h4>${t('footer_catalog')}</h4>
            <ul>
              ${ctx.categories.slice(0, 6).map((c) => html`
                <li><a href="${L(ctx, `/products?category=${c.slug}`)}">${ctx.f(c, 'name')}</a></li>`)}
              <li><a href="${L(ctx, '/products')}">${t('view_all')}</a></li>
            </ul>
          </div>

          <div>
            <h4>${t('footer_company')}</h4>
            <ul>
              <li><a href="${L(ctx, '/services')}">${t('nav_services')}</a></li>
              <li><a href="${L(ctx, '/support')}">${t('nav_support')}</a></li>
              <li><a href="${L(ctx, '/brands')}">${t('nav_brands')}</a></li>
              <li><a href="${L(ctx, '/about')}">${t('nav_about')}</a></li>
              <li><a href="${L(ctx, '/quote')}">${t('request_quote')}</a></li>
            </ul>
          </div>

          <div>
            <h4>${t('footer_contact')}</h4>
            <div class="footer-contact">
              <div>${icon('phone', { size: 15 })}
                <span><a href="tel:${config.company.phone.replace(/\s/g, '')}" class="mono">${config.company.phone}</a><br>
                <a href="tel:${config.company.phoneAl.replace(/\s/g, '')}" class="mono">${config.company.phoneAl}</a></span>
              </div>
              <div>${icon('mail', { size: 15 })}
                <a href="mailto:${config.company.email}">${config.company.email}</a>
              </div>
              <div>${icon('pin', { size: 15 })}
                <span>${config.company.addressXK}<br>${config.company.addressAL}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-bottom">
          <span>&copy; ${new Date().getFullYear()} ${config.company.legal}. ${t('footer_rights')}</span>
          <span class="mono">${t('footer_vat')} ${config.company.vat}</span>
        </div>
      </div>
    </footer>`;
}

/* ----------------------------------------------------------------- page */

/**
 * Render a complete document. `head` receives already-escaped extras.
 * The stylesheet is a single render-blocking request; nothing else blocks paint.
 */
export function page(ctx, {
  title,
  description = '',
  body,
  bodyClass = '',
  canonical = '',
  head = '',
  script = '',
  noindex = false,
}) {
  const t = ctx.t;
  const fullTitle = title
    ? `${title} — ${config.company.name}`
    : `${config.company.name} — ${t('home_title')}`;

  return raw(`<!doctype html>
<html lang="${ctx.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeAttr(fullTitle)}</title>
${description ? `<meta name="description" content="${escapeAttr(description)}">` : ''}
<meta name="theme-color" content="#0e131a">
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="${ctx.asset('/assets/css/main.css')}">
${canonical ? `<link rel="canonical" href="${escapeAttr(canonical)}">` : ''}
${LOCALES.map((code) => `<link rel="alternate" hreflang="${code}" href="${escapeAttr(ctx.origin + ctx.localeUrl(code))}">`).join('\n')}
<meta property="og:site_name" content="${escapeAttr(config.company.name)}">
<meta property="og:title" content="${escapeAttr(fullTitle)}">
<meta property="og:type" content="website">
${description ? `<meta property="og:description" content="${escapeAttr(description)}">` : ''}
${noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}
${head}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip-link" href="#main">${escapeAttr(t('nav_home'))}</a>
${topbar(ctx)}
${masthead(ctx)}
<main id="main">
${body}
</main>
${footer(ctx)}
${script}
</body>
</html>`);
}

function escapeAttr(value) {
  return String(value).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
