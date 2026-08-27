import { html } from '../../core/html.js';
import { page, L } from '../layout.js';
import { icon } from '../partials/icons.js';
import { breadcrumbs, productCard, pagination, ctaBand } from '../partials/ui.js';

export function brandsPage(ctx, { brands }) {
  const { t } = ctx;

  const body = html`
    <div class="wrap">${breadcrumbs(ctx, [{ label: t('nav_brands') }])}</div>

    <div class="wrap pb-6">
      <span class="eyebrow">${t('home_brands_eyebrow')}</span>
      <h1>${t('brands_title')}</h1>
      <p class="lede">${t('brands_lede')}</p>
    </div>

    <div class="wrap section-tight">
      <div class="grid grid-3">
        ${brands.map((b) => html`
          <a class="cat-card bracket" href="${L(ctx, `/brands/${b.slug}`)}">
            <div class="row row-sm row-mid row-between">
              <h3 class="m-0">${b.name}</h3>
              <span class="chip">${b.country}</span>
            </div>
            <p>${ctx.f(b, 'summary')}</p>
            <span class="cat-count">
              <span>${b.product_count} ${t('products').toLowerCase()}</span>
              ${icon('arrow', { size: 15 })}
            </span>
          </a>`)}
      </div>
    </div>

    ${ctaBand(ctx, {
      title: t('brand_not_listed'),
      text: t('brand_not_listed_d'),
      primary: { href: L(ctx, '/quote'), label: t('request_quote') },
      secondary: { href: L(ctx, '/contact'), label: t('nav_contact') },
    })}`;

  return page(ctx, {
    title: t('brands_title'),
    description: t('brands_lede'),
    body,
    canonical: ctx.origin + ctx.path,
  });
}

export function brandPage(ctx, { brand, items, total, pageNum, pageSize }) {
  const { t } = ctx;

  const body = html`
    <div class="wrap">
      ${breadcrumbs(ctx, [
        { label: t('nav_brands'), href: L(ctx, '/brands') },
        { label: brand.name },
      ])}
    </div>

    <div class="wrap pb-6">
      <div class="prod-meta"><span class="chip">${brand.country}</span></div>
      <h1>${brand.name}</h1>
      <p class="lede">${ctx.f(brand, 'summary')}</p>
      ${brand.website ? html`
        <p class="mt-4">
          <a class="btn btn-outline btn-sm" href="${brand.website}" rel="noopener nofollow" target="_blank">
            ${icon('external', { size: 15 })}${brand.website.replace(/^https?:\/\//, '')}
          </a>
        </p>` : ''}
    </div>

    <div class="wrap section-tight">
      <div class="toolbar">
        <div class="toolbar-count">
          <strong>${total}</strong> ${total === 1 ? t('result') : t('results')} · ${t('brand_products')}
        </div>
      </div>
      <div class="grid grid-3">${items.map((p) => productCard(ctx, p))}</div>
      ${pagination(ctx, { page: pageNum, total, pageSize, baseParams: {} })}
    </div>`;

  return page(ctx, {
    title: brand.name,
    description: ctx.f(brand, 'summary') || `${brand.name} — ${t('brand_products')}`,
    body,
    canonical: ctx.origin + L(ctx, `/brands/${brand.slug}`),
  });
}
