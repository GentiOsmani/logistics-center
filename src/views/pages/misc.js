import { html } from '../../core/html.js';
import { config } from '../../config.js';
import { page, L } from '../layout.js';
import { icon } from '../partials/icons.js';
import { breadcrumbs, alert, ctaBand } from '../partials/ui.js';

/* -------------------------------------------------------------- contact */

export function contactPage(ctx, { values = {}, errors = {}, sent = null }) {
  const { t } = ctx;
  const err = (name) => errors[name]
    ? html`<p class="form-error" id="${name}-err">${t(errors[name])}</p>` : '';
  const invalid = (name) => errors[name] ? html`aria-invalid="true" aria-describedby="${name}-err"` : '';

  const body = html`
    <div class="wrap">${breadcrumbs(ctx, [{ label: t('nav_contact') }])}</div>

    <div class="wrap pb-6">
      <span class="eyebrow">${t('nav_contact')}</span>
      <h1>${t('contact_title')}</h1>
      <p class="lede">${t('contact_lede')}</p>
    </div>

    <div class="wrap section-tight">
      <div class="layout layout-360">
        <div>
          ${sent ? alert('ok', t('contact_sent_t'), t('contact_sent_d')) : ''}
          ${Object.keys(errors).length ? alert('err', '', t('err_generic')) : ''}

          <h2 class="t-h3">${t('contact_form_t')}</h2>
          <form method="post" action="${L(ctx, '/contact')}" class="card p-5 mt-4">
            <input type="text" name="website" tabindex="-1" autocomplete="off"
                   class="sr-only" aria-hidden="true">
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
                <label for="phone">${t('f_phone')}</label>
                <input class="input" type="tel" name="phone" id="phone"
                       value="${values.phone || ''}" maxlength="40" autocomplete="tel">
              </div>
            </div>
            <div class="field">
              <label for="subject">${t('f_subject')}</label>
              <input class="input" type="text" name="subject" id="subject"
                     value="${values.subject || ''}" maxlength="180">
            </div>
            <div class="field">
              <label for="message">${t('f_message')} *</label>
              <textarea class="textarea" name="message" id="message" required
                        maxlength="4000" ${invalid('message')}>${values.message || ''}</textarea>
              ${err('message')}
            </div>
            <button class="btn btn-primary" type="submit">
              ${t('send')}${icon('arrow', { size: 17 })}
            </button>
          </form>
        </div>

        <aside class="stack">
          <div class="card p-4">
            <h3 class="t-md">${t('contact_offices')}</h3>
            <div class="t-base t-soft">
              <p class="mb-4">
                <strong class="t-ink">${t('contact_office_xk')}</strong><br>
                ${config.company.addressXK}<br>
                <a class="mono" href="tel:${config.company.phone.replace(/\s/g, '')}">${config.company.phone}</a>
              </p>
              <p>
                <strong class="t-ink">${t('contact_office_al')}</strong><br>
                ${config.company.addressAL}<br>
                <a class="mono" href="tel:${config.company.phoneAl.replace(/\s/g, '')}">${config.company.phoneAl}</a>
              </p>
            </div>
          </div>

          <div class="card p-4">
            <h3 class="t-md">${t('footer_contact')}</h3>
            <div class="t-base col">
              <div class="row">
                ${icon('mail', { size: 15 })}
                <span>${t('contact_sales')}<br>
                  <a href="mailto:${config.company.sales}">${config.company.sales}</a></span>
              </div>
              <div class="row">
                ${icon('wrench', { size: 15 })}
                <span>${t('contact_support_c')}<br>
                  <a href="mailto:${config.company.support}">${config.company.support}</a></span>
              </div>
              <div class="row">
                ${icon('clock', { size: 15 })}
                <span>${t('contact_hours')}<br>${t('contact_hours_v')} ${config.company.hours}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>`;

  return page(ctx, {
    title: t('contact_title'),
    description: t('contact_lede'),
    body,
    canonical: ctx.origin + L(ctx, '/contact'),
  });
}

/* ---------------------------------------------------------------- about */

export function aboutPage(ctx, { categories, services, productCount, brandCount }) {
  const { t } = ctx;

  const body = html`
    <section class="hero blueprint">
      <div class="wrap">
        <div class="hero-inner layout-1">
          <div>
            <span class="eyebrow">${t('nav_about')}</span>
            <h1>${t('about_title')}</h1>
            <p class="hero-lede">${t('about_lede')}</p>
          </div>
        </div>
      </div>
      <div class="stat-strip">
        <div class="wrap">
          <div class="stat">
            <div class="stat-value">${productCount}+</div>
            <div class="stat-label">${t('stat_references')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">${brandCount}+</div>
            <div class="stat-label">${t('stat_brands')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">${categories.length}</div>
            <div class="stat-label">${t('categories')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">${services.length}</div>
            <div class="stat-label">${t('services')}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="split">
          <div class="prose">
            <p class="lede">${t('footer_about')}</p>
            <p>${t('home_svc_lede')}</p>
            <p>${t('home_brands_lede')}</p>
          </div>
          <div>
            <ul class="ticklist">
              ${['why_1', 'why_2', 'why_3', 'why_4'].map((key) => html`
                <li><strong>${t(`${key}_t`)}</strong><br>
                  <span class="muted t-base">${t(`${key}_d`)}</span></li>`)}
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="section section-alt">
      <div class="wrap">
        <div class="section-head"><div><h2>${t('categories')}</h2></div></div>
        <div class="grid grid-4">
          ${categories.map((c) => html`
            <a class="cat-card bracket" href="${L(ctx, `/products?category=${c.slug}`)}">
              ${icon(c.icon, { size: 32, cls: 'cat-icon' })}
              <h3 class="t-md">${ctx.f(c, 'name')}</h3>
              <span class="cat-count">
                <span>${c.product_count}</span>${icon('arrow', { size: 14 })}
              </span>
            </a>`)}
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
    title: t('about_title'),
    description: t('footer_about'),
    body,
    canonical: ctx.origin + L(ctx, '/about'),
  });
}

/* --------------------------------------------------------------- errors */

export function errorPage(ctx, status) {
  const { t } = ctx;
  const isNotFound = status === 404;
  const body = html`
    <section class="section">
      <div class="wrap wrap-narrow center">
        <div class="mono err-code">${status}</div>
        <h1 class="mt-4">${t(isNotFound ? 'err_404_t' : 'err_500_t')}</h1>
        <p class="lede mx-auto mb-6">${t(isNotFound ? 'err_404_d' : 'err_500_d')}</p>
        <div class="row row-md row-center row-wrap">
          <a class="btn btn-primary" href="${L(ctx)}">${t('go_home')}</a>
          <a class="btn btn-outline" href="${L(ctx, '/products')}">${t('nav_products')}</a>
        </div>
      </div>
    </section>`;

  return page(ctx, {
    title: t(isNotFound ? 'err_404_t' : 'err_500_t'),
    body,
    noindex: true,
  });
}
