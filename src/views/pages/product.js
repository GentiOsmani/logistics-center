import { html, raw } from '../../core/html.js';
import { page, L } from '../layout.js';
import { icon } from '../partials/icons.js';
import { breadcrumbs, availabilityChip, price, productCard } from '../partials/ui.js';

const KB = 1024;
function fileSize(bytes) {
  if (bytes >= KB * KB) return `${(bytes / (KB * KB)).toFixed(1)} MB`;
  if (bytes >= KB) return `${Math.round(bytes / KB)} KB`;
  return `${bytes} B`;
}

export function productPage(ctx, {
  product, specs, refs, datasheets, related, category, brand, added,
}) {
  const { t } = ctx;
  const name = ctx.f(product, 'name');
  const summary = ctx.f(product, 'summary');
  const bodyText = ctx.f(product, 'body');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    sku: product.part_number,
    mpn: product.part_number,
    description: summary,
    ...(brand ? { brand: { '@type': 'Brand', name: brand.name } } : {}),
    ...(product.price_eur != null ? {
      offers: {
        '@type': 'Offer',
        price: product.price_eur,
        priceCurrency: 'EUR',
        availability: product.availability === 'in_stock'
          ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
      },
    } : {}),
  };

  const body = html`
    <div class="wrap">
      ${breadcrumbs(ctx, [
        { label: t('nav_products'), href: L(ctx, '/products') },
        ...(category
          ? [{ label: ctx.f(category, 'name'), href: L(ctx, `/products?category=${category.slug}`) }]
          : []),
        { label: product.part_number },
      ])}
    </div>

    <div class="wrap pb-7">
      ${added ? html`
        <div class="alert alert-ok" role="status">
          <strong>${t('added_to_quote')}</strong>
          <a href="${L(ctx, '/quote')}">${t('quote_title')} →</a>
        </div>` : ''}

      <div class="prod-head">
        <div>
          <div class="prod-meta">
            ${brand ? html`
              <a class="chip" href="${L(ctx, `/brands/${brand.slug}`)}">${brand.name}</a>` : ''}
            ${category ? html`
              <a class="chip" href="${L(ctx, `/products?category=${category.slug}`)}">
                ${ctx.f(category, 'name')}
              </a>` : ''}
            ${availabilityChip(ctx, product)}
          </div>

          <h1 class="prod-title">${name}</h1>
          ${summary ? html`<p class="lede">${summary}</p>` : ''}

          <div class="partbox mt-5">
            <div>
              <div class="partbox-label">${t('part_number')}</div>
              <div class="partbox-value">${product.part_number}</div>
            </div>
          </div>

          ${specs.length ? html`
            <section class="mb-section">
              <h2 class="t-h4">${t('specifications')}</h2>
              <table class="spec-table">
                <tbody>
                  ${specs.map((s) => html`
                    <tr>
                      <th scope="row">${ctx.f(s, 'label')}</th>
                      <td>${ctx.f(s, 'value')}</td>
                    </tr>`)}
                </tbody>
              </table>
            </section>` : ''}

          ${bodyText ? html`
            <section class="prose mb-section">
              <h2 class="t-h4">${t('description')}</h2>
              <p>${bodyText}</p>
            </section>` : ''}

          <section class="mb-section">
            <h2 class="t-h4">${t('datasheets')}</h2>
            ${datasheets.length
              ? datasheets.map((d) => html`
                  <a class="dl-row" href="${ctx.filesOrigin || ''}/files/${d.filename}" download>
                    ${icon('pdf', { size: 22 })}
                    <span class="dl-row-main">
                      <span class="dl-row-title">${d.title}</span>
                      <span class="dl-row-meta">${d.lang.toUpperCase()} · ${fileSize(d.size_bytes)}</span>
                    </span>
                    ${icon('download', { size: 18 })}
                  </a>`)
              : html`<p class="muted t-base">${t('no_datasheet')}</p>`}
          </section>

          ${refs.length ? html`
            <section>
              <h2 class="t-h4">${t('cross_refs')}</h2>
              <p class="muted t-sm">${t('cross_refs_note')}</p>
              <table class="table">
                <tbody>
                  ${refs.map((r) => html`
                    <tr>
                      <td class="mono fw-600">${r.number}</td>
                      <td><span class="chip">${t(`ref_kind_${r.kind}`)}</span></td>
                      <td class="muted">${r.note}</td>
                    </tr>`)}
                </tbody>
              </table>
            </section>` : ''}
        </div>

        <aside class="buybox no-print">
          <div class="buybox-head">
            ${product.price_eur != null
              ? html`<div class="buybox-price">${price(ctx, product, { small: false })}
                       <small>${t('price_excl_vat')} · ${t('ref_price')}</small></div>`
              : html`<div class="buybox-ask">${t('price_on_request')}</div>`}
          </div>

          <div class="buybox-body">
            <dl class="m-0">
              <div class="buybox-row">
                <dt>${t('availability')}</dt>
                <dd>${availabilityChip(ctx, product)}</dd>
              </div>
              <div class="buybox-row">
                <dt>${t('unit')}</dt>
                <dd class="mono">${product.unit}</dd>
              </div>
              ${brand ? html`
                <div class="buybox-row">
                  <dt>${t('brand')}</dt>
                  <dd>${brand.name}</dd>
                </div>` : ''}
            </dl>

            <form method="post" action="${L(ctx, '/quote/add')}" class="stack">
              <input type="hidden" name="part_number" value="${product.part_number}">
              <input type="hidden" name="redirect" value="${ctx.path}?added=1">
              <div class="qty-row">
                <label class="sr-only" for="qty">${t('qty')}</label>
                <input class="input" type="number" name="qty" id="qty"
                       value="1" min="1" max="9999" inputmode="numeric">
                <button class="btn btn-primary btn-block" type="submit">
                  ${icon('plus', { size: 16 })}${t('add_to_quote')}
                </button>
              </div>
            </form>

            <a class="btn btn-outline btn-block" href="${L(ctx, '/quote')}">
              ${t('request_quote')}
            </a>
          </div>

          <div class="buybox-foot">
            ${t('need_help_choosing_d')}
            <br><a href="${L(ctx, '/contact')}">${t('nav_contact')} →</a>
          </div>
        </aside>
      </div>
    </div>

    ${related.length ? html`
      <section class="section section-alt">
        <div class="wrap">
          <div class="section-head"><div><h2>${t('related')}</h2></div></div>
          <div class="grid grid-4">${related.map((p) => productCard(ctx, p))}</div>
        </div>
      </section>` : ''}`;

  return page(ctx, {
    title: `${product.part_number} — ${name}`,
    description: summary || name,
    body,
    canonical: ctx.origin + L(ctx, `/products/${product.slug}`),
    head: raw(`<script type="application/ld+json">${
      JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`),
  });
}
