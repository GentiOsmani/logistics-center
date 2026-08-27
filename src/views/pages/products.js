import { html, qs } from '../../core/html.js';
import { page, L } from '../layout.js';
import { icon } from '../partials/icons.js';
import {
  searchbar, productCard, breadcrumbs, pagination, emptyState,
} from '../partials/ui.js';

export function productsPage(ctx, {
  items, total, categories, brands, filters, pageNum, pageSize,
}) {
  const { t } = ctx;
  const base = {
    q: filters.q,
    category: filters.category,
    brand: filters.brand,
    availability: filters.availability,
    sort: filters.sort,
  };
  const withParam = (key, value) => `${L(ctx, '/products')}${qs({ ...base, [key]: value, page: '' })}`;

  const activeCategory = categories.find((c) => c.slug === filters.category);
  const activeBrand = brands.find((b) => b.slug === filters.brand);
  const hasFilters = Boolean(filters.q || filters.category || filters.brand);

  const heading = filters.q
    ? html`${t('results_for')} <span class="mono">“${filters.q}”</span>`
    : activeCategory ? ctx.f(activeCategory, 'name')
      : activeBrand ? activeBrand.name
        : t('products_title');

  const body = html`
    <div class="wrap">
      ${breadcrumbs(ctx, [
        { label: t('nav_products'), href: hasFilters ? L(ctx, '/products') : null },
        ...(activeCategory ? [{ label: ctx.f(activeCategory, 'name') }] : []),
        ...(activeBrand ? [{ label: activeBrand.name }] : []),
      ])}
    </div>

    <div class="wrap pb-5">
      <h1>${heading}</h1>
      <p class="lede">${activeCategory ? ctx.f(activeCategory, 'summary') : t('products_lede')}</p>
      <div class="mt-5 max-720">${searchbar(ctx, { value: filters.q })}</div>
    </div>

    <div class="wrap section-tight">
      <div class="layout">
        <aside class="filters no-print" aria-label="${t('filters')}">
          <details class="filter-group" open>
            <summary>${t('categories')}</summary>
            <div class="filter-list">
              <a href="${withParam('category', '')}"
                 ${!filters.category ? html`aria-current="true"` : ''}>${t('all')}</a>
              ${categories.map((c) => html`
                <a href="${withParam('category', c.slug)}"
                   ${filters.category === c.slug ? html`aria-current="true"` : ''}>
                  <span>${ctx.f(c, 'name')}</span>
                  <span class="n">${c.product_count}</span>
                </a>`)}
            </div>
          </details>

          <details class="filter-group" open>
            <summary>${t('brands')}</summary>
            <div class="filter-list">
              <a href="${withParam('brand', '')}"
                 ${!filters.brand ? html`aria-current="true"` : ''}>${t('all')}</a>
              ${brands.filter((b) => b.product_count > 0).map((b) => html`
                <a href="${withParam('brand', b.slug)}"
                   ${filters.brand === b.slug ? html`aria-current="true"` : ''}>
                  <span>${b.name}</span>
                  <span class="n">${b.product_count}</span>
                </a>`)}
            </div>
          </details>

          <details class="filter-group">
            <summary>${t('availability')}</summary>
            <div class="filter-list">
              <a href="${withParam('availability', '')}"
                 ${!filters.availability ? html`aria-current="true"` : ''}>${t('all')}</a>
              <a href="${withParam('availability', 'in_stock')}"
                 ${filters.availability === 'in_stock' ? html`aria-current="true"` : ''}>${t('avail_in_stock')}</a>
              <a href="${withParam('availability', 'lead_time')}"
                 ${filters.availability === 'lead_time' ? html`aria-current="true"` : ''}>${t('avail_lead_time')}</a>
              <a href="${withParam('availability', 'on_request')}"
                 ${filters.availability === 'on_request' ? html`aria-current="true"` : ''}>${t('avail_on_request')}</a>
            </div>
          </details>

          <div class="card p-3">
            <h4 class="mb-2">${t('need_help_choosing')}</h4>
            <p class="t-sm t-soft mb-3">
              ${t('need_help_choosing_d')}
            </p>
            <a class="btn btn-dark btn-sm btn-block" href="${L(ctx, '/contact')}">
              ${t('nav_contact')}
            </a>
          </div>
        </aside>

        <div>
          <div class="toolbar">
            <div class="toolbar-count">
              <strong>${total}</strong> ${total === 1 ? t('result') : t('results')}
            </div>
            <form method="get" action="${L(ctx, '/products')}">
              ${filters.q ? html`<input type="hidden" name="q" value="${filters.q}">` : ''}
              ${filters.category ? html`<input type="hidden" name="category" value="${filters.category}">` : ''}
              ${filters.brand ? html`<input type="hidden" name="brand" value="${filters.brand}">` : ''}
              ${filters.availability ? html`<input type="hidden" name="availability" value="${filters.availability}">` : ''}
              <label for="sort">${t('sort_by')}</label>
              <select class="select" name="sort" id="sort">
                ${[['relevance', t('sort_relevance')], ['newest', t('sort_newest')],
                   ['part', t('sort_part')], [`name_${ctx.locale}`, t('sort_name')]]
                  .map(([value, label]) => html`
                    <option value="${value}" ${filters.sort === value ? html`selected` : ''}>${label}</option>`)}
              </select>
              <button class="btn btn-outline btn-sm" type="submit">${t('update')}</button>
            </form>
          </div>

          ${hasFilters ? html`
            <div class="active-filters">
              ${filters.q ? html`<a href="${withParam('q', '')}">“${filters.q}”</a>` : ''}
              ${activeCategory ? html`<a href="${withParam('category', '')}">${ctx.f(activeCategory, 'name')}</a>` : ''}
              ${activeBrand ? html`<a href="${withParam('brand', '')}">${activeBrand.name}</a>` : ''}
              <a href="${L(ctx, '/products')}" class="is-dashed">${t('clear_filters')}</a>
            </div>` : ''}

          ${items.length
            ? html`
              <div class="grid grid-3">${items.map((p) => productCard(ctx, p))}</div>
              ${pagination(ctx, { page: pageNum, total, pageSize, baseParams: base })}`
            : emptyState(ctx, {
                title: t('no_results'),
                text: t('no_results_help'),
                action: html`
                  <a class="btn btn-primary" href="${L(ctx, '/quote')}">
                    ${t('request_quote')}${icon('arrow', { size: 16 })}
                  </a>`,
              })}
        </div>
      </div>
    </div>`;

  return page(ctx, {
    title: filters.q ? `${t('search')}: ${filters.q}` : String(heading).replace(/<[^>]+>/g, ''),
    description: t('products_lede'),
    body,
    canonical: ctx.origin + ctx.path,
    noindex: Boolean(filters.q),
    script: ctx.suggestScript,
  });
}
