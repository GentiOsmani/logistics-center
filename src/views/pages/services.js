import { html } from '../../core/html.js';
import { page, L } from '../layout.js';
import { icon } from '../partials/icons.js';
import { breadcrumbs, ctaBand } from '../partials/ui.js';

export function servicesPage(ctx, { services }) {
  const { t } = ctx;

  const body = html`
    <section class="hero blueprint">
      <div class="wrap">
        <div class="hero-inner layout-1">
          <div>
            <span class="eyebrow">${t('home_svc_eyebrow')}</span>
            <h1>${t('services_title')}</h1>
            <p class="hero-lede">${t('services_lede')}</p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="${L(ctx, '/support')}">
                ${t('hero_cta_support')}${icon('arrow', { size: 17 })}
              </a>
              <a class="btn btn-ghost" href="${L(ctx, '/contact')}">${t('nav_contact')}</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="grid grid-3">
          ${services.map((s, i) => html`
            <a class="svc-card bracket" href="${L(ctx, `/services/${s.slug}`)}">
              <span class="svc-num">${String(i + 1).padStart(2, '0')}</span>
              ${icon(s.icon, { size: 30, cls: 'cat-icon' })}
              <h3>${ctx.f(s, 'title')}</h3>
              <p>${ctx.f(s, 'summary')}</p>
              <span class="svc-more">${t('learn_more')}${icon('arrow', { size: 15 })}</span>
            </a>`)}
        </div>
      </div>
    </section>

    ${ctaBand(ctx, {
      title: t('support_emergency_t'),
      text: t('support_emergency_d'),
      primary: { href: L(ctx, '/support'), label: t('nav_support') },
      secondary: { href: `tel:${ctx.company.phone.replace(/\s/g, '')}`, label: ctx.company.phone },
    })}`;

  return page(ctx, {
    title: t('services_title'),
    description: t('services_lede'),
    body,
    canonical: ctx.origin + ctx.path,
  });
}

export function servicePage(ctx, { service, points, others }) {
  const { t } = ctx;
  const title = ctx.f(service, 'title');

  const body = html`
    <div class="wrap">
      ${breadcrumbs(ctx, [
        { label: t('nav_services'), href: L(ctx, '/services') },
        { label: title },
      ])}
    </div>

    <div class="wrap section-tight">
      <div class="layout layout-320">
        <div>
          <span class="eyebrow">${t('nav_services')}</span>
          <h1>${title}</h1>
          <p class="lede">${ctx.f(service, 'summary')}</p>

          <div class="ticks my-6"></div>

          <div class="prose">
            ${ctx.f(service, 'body').split('\n').filter(Boolean).map((para) => html`<p>${para}</p>`)}
          </div>

          ${points.length ? html`
            <section class="mt-section">
              <h2 class="t-h3">${t('service_includes')}</h2>
              <ul class="ticklist">
                ${points.map((p) => html`<li>${ctx.f(p, 'text')}</li>`)}
              </ul>
            </section>` : ''}
        </div>

        <aside>
          <div class="card p-4 sticky-side">
            <h3 class="t-lg">${t('service_ask')}</h3>
            <p class="t-sm2 t-soft">${t('support_intro')}</p>
            <a class="btn btn-primary btn-block" href="${L(ctx, `/support?service=${service.slug}`)}">
              ${t('nav_support')}${icon('arrow', { size: 16 })}
            </a>
            <div class="ticks my-4"></div>
            <h4 class="label-caps">
              ${t('service_all')}
            </h4>
            <ul class="list-plain">
              ${others.map((s) => html`
                <li class="mb-1">
                  <a href="${L(ctx, `/services/${s.slug}`)}" class="link-quiet">
                    ${ctx.f(s, 'title')}
                  </a>
                </li>`)}
            </ul>
          </div>
        </aside>
      </div>
    </div>

    ${ctaBand(ctx, {
      title: t('request_quote'),
      text: t('quote_lede'),
      primary: { href: L(ctx, '/quote'), label: t('request_quote') },
      secondary: { href: L(ctx, '/products'), label: t('nav_products') },
    })}`;

  return page(ctx, {
    title,
    description: ctx.f(service, 'summary'),
    body,
    canonical: ctx.origin + L(ctx, `/services/${service.slug}`),
  });
}
