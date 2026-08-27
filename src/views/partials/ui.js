import { html, raw, qs } from '../../core/html.js';
import { icon } from './icons.js';
import { L } from '../layout.js';

/* ------------------------------------------------------------- formatting */

const FORMATTERS = new Map();
function money(locale, value) {
  const key = locale;
  let fmt = FORMATTERS.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale === 'sq' ? 'sq-AL' : 'en-GB', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
    });
    FORMATTERS.set(key, fmt);
  }
  return fmt.format(value);
}

export function price(ctx, product, { small = true } = {}) {
  if (product.price_eur === null || product.price_eur === undefined) {
    return html`<span class="prod-price-ask">${ctx.t('price_on_request')}</span>`;
  }
  return html`<span class="prod-price">${money(ctx.locale, product.price_eur)}${
    small ? html` <small>${ctx.t('price_excl_vat')}</small>` : ''}</span>`;
}

export function availabilityChip(ctx, product) {
  const { t } = ctx;
  if (product.availability === 'in_stock') {
    return html`<span class="chip chip-dot chip-stock">${t('avail_in_stock')}</span>`;
  }
  if (product.availability === 'lead_time') {
    const days = product.lead_time_days
      ? html` ${product.lead_time_days} ${t('lead_days')}` : '';
    return html`<span class="chip chip-dot chip-lead">${t('avail_lead_time')}${days}</span>`;
  }
  return html`<span class="chip chip-dot chip-order">${t('avail_on_request')}</span>`;
}

/* ------------------------------------------------------------- components */

export function searchbar(ctx, { value = '', autofocus = false, id = 'q' } = {}) {
  return html`
    <div class="search-shell">
      <form class="searchbar" action="${L(ctx, '/products')}" method="get" role="search">
        <label class="sr-only" for="${id}">${ctx.t('search_label')}</label>
        <input class="searchbar-input" type="search" name="q" id="${id}"
               value="${value}" placeholder="${ctx.t('search_placeholder')}"
               autocomplete="off" spellcheck="false"
               ${autofocus ? raw('autofocus') : ''}
               data-suggest="${L(ctx, '/api/suggest')}">
        <button class="searchbar-btn" type="submit">
          ${icon('search', { size: 17 })}<span>${ctx.t('search')}</span>
        </button>
      </form>
      <div class="suggest" id="${id}-suggest" role="listbox" hidden></div>
    </div>`;
}

export function productCard(ctx, product) {
  const { t } = ctx;
  return html`
    <article class="prod-card bracket">
      <div class="prod-card-body">
        <div class="prod-card-top">
          <span class="prod-brand">${product.brand_name || '—'}</span>
          ${availabilityChip(ctx, product)}
        </div>
        <span class="prod-part">${product.part_number}</span>
        <h3><a href="${L(ctx, `/products/${product.slug}`)}">${ctx.f(product, 'name')}</a></h3>
        ${ctx.f(product, 'summary')
          ? html`<p class="prod-summary">${ctx.f(product, 'summary')}</p>` : ''}
      </div>
      <div class="prod-card-foot">
        ${price(ctx, product)}
        <form method="post" action="${L(ctx, '/quote/add')}">
          <input type="hidden" name="part_number" value="${product.part_number}">
          <input type="hidden" name="redirect" value="${ctx.path}${ctx.search}">
          <button class="btn btn-outline btn-sm" type="submit">
            ${icon('plus', { size: 14 })}<span>${t('add_to_quote')}</span>
          </button>
        </form>
      </div>
    </article>`;
}

export function breadcrumbs(ctx, trail) {
  return html`
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="${L(ctx)}">${ctx.t('nav_home')}</a>
      ${trail.map((item) => html`
        <span aria-hidden="true">/</span>
        ${item.href
          ? html`<a href="${item.href}">${item.label}</a>`
          : html`<span>${item.label}</span>`}`)}
    </nav>`;
}

export function pagination(ctx, { page: current, total, pageSize, baseParams }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return '';
  const url = (n) => `${ctx.path}${qs({ ...baseParams, page: n > 1 ? n : '' })}`;

  const numbers = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - current) <= 1) numbers.push(n);
    else if (numbers[numbers.length - 1] !== 'gap') numbers.push('gap');
  }

  return html`
    <nav class="pagination" aria-label="${ctx.t('page')}">
      ${current > 1
        ? html`<a href="${url(current - 1)}" rel="prev">${ctx.t('previous')}</a>`
        : ''}
      ${numbers.map((n) => n === 'gap'
        ? html`<span class="gap">…</span>`
        : n === current
          ? html`<span aria-current="page">${n}</span>`
          : html`<a href="${url(n)}">${n}</a>`)}
      ${current < pages
        ? html`<a href="${url(current + 1)}" rel="next">${ctx.t('next')}</a>`
        : ''}
    </nav>`;
}

export function emptyState(ctx, { title, text, action }) {
  return html`
    <div class="empty">
      ${icon('search', { size: 44 })}
      <h3>${title}</h3>
      <p class="muted">${text}</p>
      ${action || ''}
    </div>`;
}

export function ctaBand(ctx, { title, text, primary, secondary }) {
  return html`
    <section class="cta-band">
      <div class="wrap">
        <div class="cta-inner">
          <div>
            <h2>${title}</h2>
            <p>${text}</p>
          </div>
          <div class="cta-actions">
            <a class="btn btn-primary" href="${primary.href}">${primary.label}${icon('arrow', { size: 17 })}</a>
            ${secondary
              ? html`<a class="btn btn-ghost" href="${secondary.href}">${secondary.label}</a>`
              : ''}
          </div>
        </div>
      </div>
    </section>`;
}

export function alert(kind, title, text) {
  return html`
    <div class="alert alert-${kind}" role="${kind === 'err' ? 'alert' : 'status'}">
      ${title ? html`<strong>${title}</strong>` : ''}
      ${text}
    </div>`;
}

/** Technical line-art used in the hero. Pure inline SVG, ~2 KB, no request. */
export function heroArt() {
  return raw(`
<svg viewBox="0 0 460 380" role="img" aria-label="Technical schematic illustration"
     fill="none" stroke-linecap="round" stroke-linejoin="round">
  <defs>
    <pattern id="bg-grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M20 0H0v20" stroke="#ffffff" stroke-opacity=".07" stroke-width="1"/>
    </pattern>
  </defs>
  <rect x="8" y="8" width="444" height="364" fill="url(#bg-grid)"/>
  <rect x="8" y="8" width="444" height="364" stroke="#2b3a4d" stroke-width="1"/>

  <!-- corner registration marks -->
  <g stroke="#f5a524" stroke-width="2">
    <path d="M8 30V8h22M430 8h22v22M452 350v22h-22M30 372H8v-22"/>
  </g>

  <!-- gear assembly -->
  <g transform="translate(112 128)" stroke="#8fa0b5" stroke-width="1.6">
    <circle r="58" stroke="#f5a524" stroke-width="2"/>
    <circle r="44" stroke-dasharray="3 5"/>
    <circle r="17"/>
    <circle r="7" fill="#f5a524" stroke="none"/>
    <g stroke="#f5a524" stroke-width="2">
      <path d="M0-58v-13M0 58v13M-58 0h-13M58 0h13"/>
      <path d="M41-41 50-50M-41 41-50 50M41 41l9 9M-41-41-50-50"/>
    </g>
    <path d="M-17 0a17 17 0 0 0 8.5 14.7" stroke="#f5a524"/>
  </g>

  <!-- dimension line -->
  <g stroke="#5a6b80" stroke-width="1">
    <path d="M54 205h116M54 200v10M170 200v10"/>
    <text x="112" y="223" fill="#8fa0b5" font-family="ui-monospace,monospace"
          font-size="11" text-anchor="middle">Ø 116.0</text>
  </g>

  <!-- control cabinet / PLC rack -->
  <g transform="translate(228 62)">
    <rect width="180" height="118" rx="2" stroke="#8fa0b5" stroke-width="1.6"/>
    <path d="M0 26h180" stroke="#8fa0b5" stroke-width="1.2"/>
    <text x="10" y="18" fill="#f5a524" font-family="ui-monospace,monospace"
          font-size="10" letter-spacing="1.5">PLC / I-O RACK</text>
    <g stroke="#5a6b80" stroke-width="1.2">
      <rect x="12" y="38" width="22" height="66" rx="1" fill="#16202c"/>
      <rect x="40" y="38" width="22" height="66" rx="1" fill="#16202c"/>
      <rect x="68" y="38" width="22" height="66" rx="1" fill="#16202c"/>
      <rect x="96" y="38" width="22" height="66" rx="1" fill="#16202c"/>
      <rect x="124" y="38" width="44" height="66" rx="1" fill="#16202c"/>
    </g>
    <g fill="#f5a524">
      <rect x="17" y="44" width="4" height="4"/><rect x="45" y="44" width="4" height="4"/>
      <rect x="73" y="44" width="4" height="4"/>
    </g>
    <g fill="#3f8f5a">
      <rect x="25" y="44" width="4" height="4"/><rect x="53" y="44" width="4" height="4"/>
      <rect x="101" y="44" width="4" height="4"/><rect x="109" y="44" width="4" height="4"/>
    </g>
    <g stroke="#2f8fd0" stroke-width="1">
      <path d="M130 52h32M130 60h32M130 68h24M130 76h32M130 84h18"/>
    </g>
  </g>

  <!-- pneumatic cylinder -->
  <g transform="translate(232 232)" stroke="#8fa0b5" stroke-width="1.6">
    <rect width="120" height="46" rx="3"/>
    <path d="M12 0v46M108 0v46"/>
    <rect x="34" y="12" width="52" height="22" rx="1" stroke="#f5a524" stroke-width="1.4"/>
    <path d="M120 23h34" stroke-width="2"/>
    <rect x="154" y="13" width="20" height="20" rx="1" stroke="#f5a524" stroke-width="2"/>
    <path d="M22-14v14M98-14v14" stroke="#5a6b80"/>
    <circle cx="22" cy="-18" r="4" stroke="#5a6b80"/>
    <circle cx="98" cy="-18" r="4" stroke="#5a6b80"/>
  </g>

  <!-- circuit traces -->
  <g stroke="#2f8fd0" stroke-width="1.2" stroke-opacity=".8">
    <path d="M228 121h-40v96h32"/>
    <path d="M170 128h18v-46h40"/>
    <circle cx="188" cy="121" r="3" fill="#0e131a"/>
    <circle cx="188" cy="217" r="3" fill="#0e131a"/>
  </g>

  <!-- callout -->
  <g stroke="#f5a524" stroke-width="1.2">
    <path d="M296 316v26h96"/>
    <circle cx="296" cy="316" r="3.5" fill="#f5a524"/>
    <text x="300" y="358" fill="#8fa0b5" font-family="ui-monospace,monospace" font-size="11">
      ISO 15552 · Ø32
    </text>
  </g>
</svg>`);
}
