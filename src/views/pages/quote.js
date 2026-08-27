import { html } from '../../core/html.js';
import { page, L } from '../layout.js';
import { icon } from '../partials/icons.js';
import { breadcrumbs, alert, availabilityChip } from '../partials/ui.js';

export function quotePage(ctx, { items, values = {}, errors = {}, sent = null }) {
  const { t } = ctx;
  const err = (name) => errors[name]
    ? html`<p class="form-error" id="${name}-err">${t(errors[name])}</p>` : '';
  const invalid = (name) => errors[name] ? html`aria-invalid="true" aria-describedby="${name}-err"` : '';

  const body = html`
    <div class="wrap">${breadcrumbs(ctx, [{ label: t('quote_title') }])}</div>

    <div class="wrap pb-6">
      <span class="eyebrow">${t('request_quote')}</span>
      <h1>${t('quote_title')}</h1>
      <p class="lede">${t('quote_lede')}</p>
    </div>

    <div class="wrap section-tight">
      <div id="form-status">
      ${sent
        ? alert('ok', t('quote_sent_t'), html`
            ${t('quote_sent_d')} <strong class="mono">${sent}</strong>. ${t('quote_sent_note')}`)
        : ''}
      ${Object.keys(errors).length ? alert('err', '', t('err_generic')) : ''}
      </div>

      <div class="layout layout-340">
        <div>
          <h2 class="t-h3">${t('quote_items')}</h2>

          <div id="quote-items">
          ${items.length ? html`
            <table class="quote-table">
              <thead>
                <tr>
                  <th>${t('part_number')}</th>
                  <th>${t('product')}</th>
                  <th>${t('availability')}</th>
                  <th>${t('qty')}</th>
                  <th><span class="sr-only">${t('remove')}</span></th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item) => html`
                  <tr>
                    <td>
                      ${item.slug
                        ? html`<a class="part" href="${L(ctx, `/products/${item.slug}`)}">${item.part_number}</a>`
                        : html`<span class="part">${item.part_number}</span>`}
                    </td>
                    <td>
                      ${item.product_id ? ctx.f(item, 'name') : (item.title || '—')}
                      ${item.brand_name ? html`<br><span class="prod-brand">${item.brand_name}</span>` : ''}
                    </td>
                    <td>${item.product_id ? availabilityChip(ctx, item) : html`<span class="chip">${t('avail_on_request')}</span>`}</td>
                    <td class="qty-cell">
                      <form method="post" action="${L(ctx, '/quote/update')}" class="row row-xs">
                        <input type="hidden" name="part_number" value="${item.part_number}">
                        <label class="sr-only" for="q-${item.part_number}">${t('qty')}</label>
                        <input class="input" type="number" id="q-${item.part_number}"
                               name="qty" value="${item.qty}" min="1" max="9999" inputmode="numeric">
                        <button class="btn btn-outline btn-sm" type="submit"
                                title="${t('update')}">${icon('check', { size: 14 })}</button>
                      </form>
                    </td>
                    <td class="act-cell">
                      <form method="post" action="${L(ctx, '/quote/remove')}">
                        <input type="hidden" name="part_number" value="${item.part_number}">
                        <button class="icon-btn" type="submit" title="${t('remove')}"
                                aria-label="${t('remove')} ${item.part_number}">
                          ${icon('trash', { size: 15 })}
                        </button>
                      </form>
                    </td>
                  </tr>`)}
              </tbody>
            </table>

            <div class="row row-end mt-4">
              <form method="post" action="${L(ctx, '/quote/clear')}">
                <button class="btn btn-outline btn-sm" type="submit">
                  ${icon('trash', { size: 14 })}${t('clear_list')}
                </button>
              </form>
            </div>`
          : html`
            <div class="empty ta-left">
              ${icon('list', { size: 40 })}
              <h3>${t('quote_empty')}</h3>
              <p class="muted">${t('quote_empty_d')}</p>
              <a class="btn btn-outline" href="${L(ctx, '/products')}">
                ${t('nav_products')}${icon('arrow', { size: 16 })}
              </a>
            </div>`}
          </div>

          <form method="post" action="${L(ctx, '/quote')}" class="card p-5 mt-6">
            <input type="text" name="website" tabindex="-1" autocomplete="off"
                   class="sr-only" aria-hidden="true">

            <fieldset>
              <legend>${t('quote_add_manual')}</legend>
              <div class="field">
                <label class="sr-only" for="manual">${t('quote_add_manual')}</label>
                <textarea class="textarea mono ta-96" name="manual" id="manual" rows="4" maxlength="2000"
                          placeholder="6205-2RSH, 4&#10;3RT2026-1BB40, 2">${values.manual || ''}</textarea>
                <p class="form-note">${t('quote_manual_hint')}</p>
              </div>
            </fieldset>

            <fieldset>
              <legend>${t('quote_your_details')}</legend>
              <div class="field-row">
                <div class="field">
                  <label for="name">${t('f_name')} *</label>
                  <input class="input" type="text" name="name" id="name" required
                         value="${values.name || ''}" maxlength="120" ${invalid('name')}>
                  ${err('name')}
                </div>
                <div class="field">
                  <label for="company">${t('f_company')}</label>
                  <input class="input" type="text" name="company" id="company"
                         value="${values.company || ''}" maxlength="120">
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="email">${t('f_email')} *</label>
                  <input class="input" type="email" name="email" id="email" required
                         value="${values.email || ''}" maxlength="160"
                         autocomplete="email" ${invalid('email')}>
                  ${err('email')}
                </div>
                <div class="field">
                  <label for="phone">${t('f_phone')} *</label>
                  <input class="input" type="tel" name="phone" id="phone" required
                         value="${values.phone || ''}" maxlength="40"
                         autocomplete="tel" ${invalid('phone')}>
                  ${err('phone')}
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="city">${t('f_city')}</label>
                  <input class="input" type="text" name="city" id="city"
                         value="${values.city || ''}" maxlength="80">
                </div>
                <div class="field">
                  <label for="country">${t('f_country')}</label>
                  <select class="select" name="country" id="country">
                    <option value="XK" ${values.country === 'XK' ? html`selected` : ''}>${t('country_xk')}</option>
                    <option value="AL" ${values.country === 'AL' ? html`selected` : ''}>${t('country_al')}</option>
                    <option value="XX" ${values.country === 'XX' ? html`selected` : ''}>${t('country_other')}</option>
                  </select>
                </div>
              </div>
              <div class="field">
                <label for="message">${t('f_note')} <span class="label-hint">(${t('optional')})</span></label>
                <textarea class="textarea ta-96" name="message" id="message"
                          maxlength="2000">${values.message || ''}</textarea>
              </div>
            </fieldset>

            <button class="btn btn-primary" type="submit">
              ${t('quote_submit')}${icon('arrow', { size: 17 })}
            </button>
          </form>
        </div>

        <aside>
          <div class="card p-4 sticky-side">
            <h3 class="t-md">${t('request_quote')}</h3>
            <ul class="ticklist mt-4">
              <li class="t-sm2">${t('why_2_d')}</li>
              <li class="t-sm2">${t('why_1_d')}</li>
              <li class="t-sm2">${t('quote_sent_note')}</li>
            </ul>
            <div class="ticks my-4"></div>
            <div class="row t-sm">
              ${icon('mail', { size: 15 })}
              <a href="mailto:${ctx.company.sales}">${ctx.company.sales}</a>
            </div>
          </div>
        </aside>
      </div>
    </div>`;

  return page(ctx, {
    title: t('quote_title'),
    description: t('quote_lede'),
    body,
    canonical: ctx.origin + L(ctx, '/quote'),
    noindex: true,
  });
}
