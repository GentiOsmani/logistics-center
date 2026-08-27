import { html } from '../../core/html.js';
import { page, L } from '../layout.js';
import { icon } from '../partials/icons.js';
import { searchbar, productCard, heroArt, ctaBand } from '../partials/ui.js';

const QUICK_LOOKUPS = ['6ES7214-1AG40-0XB0', '3RT2026-1BB40', '6205-2RSH', 'SY5120-5LZD-01'];

export function homePage(ctx, { categories, services, brands, featured, productCount }) {
  const { t } = ctx;

  const body = html`
    <section class="hero blueprint">
      <div class="wrap">
        <div class="hero-inner">
          <div>
            <span class="eyebrow">${ctx.company.tagline}</span>
            <h1>${t('home_hero_h1_a')}<em>${t('home_hero_h1_em')}</em>${t('home_hero_h1_b')}</h1>
            <p class="hero-lede">${t('home_hero_lede')}</p>

            <div class="hero-search">
              ${searchbar(ctx, { id: 'hero-q' })}
              <div class="hero-hint">
                <span>${t('home_hero_hint')}</span>
                ${QUICK_LOOKUPS.map((pn) => html`
                  <a href="${L(ctx, `/products?q=${encodeURIComponent(pn)}`)}" class="mono">${pn}</a>`)}
              </div>
            </div>

            <div class="hero-actions">
              <a class="btn btn-primary" href="${L(ctx, '/products')}">
                ${t('hero_cta_catalog')}${icon('arrow', { size: 17 })}
              </a>
              <a class="btn btn-ghost" href="${L(ctx, '/support')}">${t('hero_cta_support')}</a>
            </div>
          </div>
          <div class="hero-art">${heroArt()}</div>
        </div>
      </div>

      <div class="stat-strip">
        <div class="wrap">
          <div class="stat">
            <div class="stat-value">${productCount}+</div>
            <div class="stat-label">${t('stat_references')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">${brands.length}+</div>
            <div class="stat-label">${t('stat_brands')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">${t('stat_response_v')}</div>
            <div class="stat-label">${t('stat_response')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">${t('stat_coverage_v')}</div>
            <div class="stat-label">${t('stat_coverage')}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">${t('home_cats_eyebrow')}</span>
            <h2>${t('home_cats_h2')}</h2>
            <p class="lede">${t('home_cats_lede')}</p>
          </div>
          <a class="btn btn-outline" href="${L(ctx, '/products')}">
            ${t('view_all')}${icon('arrow', { size: 16 })}
          </a>
        </div>

        <div class="grid grid-3">
          ${categories.map((c) => html`
            <a class="cat-card bracket" href="${L(ctx, `/products?category=${c.slug}`)}">
              ${icon(c.icon, { size: 40, cls: 'cat-icon' })}
              <h3>${ctx.f(c, 'name')}</h3>
              <p>${ctx.f(c, 'summary')}</p>
              <span class="cat-count">
                <span>${c.product_count} ${t('products').toLowerCase()}</span>
                ${icon('arrow', { size: 15 })}
              </span>
            </a>`)}
        </div>
      </div>
    </section>

    <section class="section section-alt">
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">${t('home_svc_eyebrow')}</span>
            <h2>${t('home_svc_h2')}</h2>
            <p class="lede">${t('home_svc_lede')}</p>
          </div>
          <a class="btn btn-outline" href="${L(ctx, '/services')}">
            ${t('service_all')}${icon('arrow', { size: 16 })}
          </a>
        </div>

        <div class="grid grid-3">
          ${services.slice(0, 6).map((s, i) => html`
            <a class="svc-card bracket" href="${L(ctx, `/services/${s.slug}`)}">
              <span class="svc-num">${String(i + 1).padStart(2, '0')}</span>
              ${icon(s.icon, { size: 28, cls: 'cat-icon' })}
              <h3>${ctx.f(s, 'title')}</h3>
              <p>${ctx.f(s, 'summary')}</p>
              <span class="svc-more">${t('learn_more')}${icon('arrow', { size: 15 })}</span>
            </a>`)}
        </div>
      </div>
    </section>

    <section class="section section-dark blueprint">
      <div class="wrap">
        <div class="split">
          <div class="on-dark">
            <span class="eyebrow">${t('home_search_eyebrow')}</span>
            <h2>${t('home_search_h2')}</h2>
            <p class="lede">${t('home_search_lede')}</p>
          </div>
          <div>
            ${searchbar(ctx, { id: 'band-q' })}
            <div class="hero-hint">
              ${QUICK_LOOKUPS.map((pn) => html`
                <a href="${L(ctx, `/products?q=${encodeURIComponent(pn)}`)}" class="mono">${pn}</a>`)}
            </div>
          </div>
        </div>
      </div>
    </section>

    ${featured.length ? html`
      <section class="section">
        <div class="wrap">
          <div class="section-head">
            <div>
              <span class="eyebrow">${t('footer_catalog')}</span>
              <h2>${t('products')}</h2>
            </div>
            <a class="btn btn-outline" href="${L(ctx, '/products')}">
              ${t('view_all')}${icon('arrow', { size: 16 })}
            </a>
          </div>
          <div class="grid grid-4">
            ${featured.map((p) => productCard(ctx, p))}
          </div>
        </div>
      </section>` : ''}

    <section class="section section-alt">
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">${t('home_brands_eyebrow')}</span>
            <h2>${t('home_brands_h2')}</h2>
            <p class="lede">${t('home_brands_lede')}</p>
          </div>
          <a class="btn btn-outline" href="${L(ctx, '/brands')}">
            ${t('view_all')}${icon('arrow', { size: 16 })}
          </a>
        </div>
        <div class="brand-wall">
          ${brands.map((b) => html`
            <a class="brand-tile" href="${L(ctx, `/brands/${b.slug}`)}">
              <span class="brand-name">${b.name}</span>
              <span class="brand-meta">${b.country}</span>
            </a>`)}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <div>
            <span class="eyebrow">${t('home_why_eyebrow')}</span>
            <h2>${t('home_why_h2')}</h2>
          </div>
        </div>
        <div class="grid grid-4">
          ${[['spark', 'why_1'], ['clock', 'why_2'], ['wrench', 'why_3'], ['pdf', 'why_4']]
            .map(([ic, key]) => html`
              <div class="cat-card">
                ${icon(ic, { size: 32, cls: 'cat-icon' })}
                <h3>${t(`${key}_t`)}</h3>
                <p>${t(`${key}_d`)}</p>
              </div>`)}
        </div>
      </div>
    </section>

    ${ctaBand(ctx, {
      title: t('request_quote'),
      text: t('quote_lede'),
      primary: { href: L(ctx, '/quote'), label: t('request_quote') },
      secondary: { href: L(ctx, '/contact'), label: t('nav_contact') },
    })}`;

  return page(ctx, {
    title: '',
    description: ctx.t('home_hero_lede'),
    body,
    canonical: ctx.origin + ctx.path,
    script: ctx.suggestScript,
  });
}
