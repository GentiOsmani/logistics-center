import { html } from '../../core/html.js';
import { config } from '../../config.js';
import { page, L } from '../layout.js';
import { icon } from '../partials/icons.js';
import { breadcrumbs, alert } from '../partials/ui.js';

const STEPS = ['support_step_1', 'support_step_2', 'support_step_3', 'support_step_4', 'support_step_5'];

export function supportPage(ctx, { services, values = {}, errors = {}, sent = null }) {
  const { t } = ctx;
  const err = (name) => errors[name]
    ? html`<p class="form-error" id="${name}-err">${t(errors[name])}</p>` : '';
  const invalid = (name) => errors[name] ? html`aria-invalid="true" aria-describedby="${name}-err"` : '';

  const body = html`
    <section class="hero blueprint">
      <div class="wrap">
        <div class="hero-inner hero-2">
          <div>
            <span class="eyebrow">${t('support_eyebrow')}</span>
            <h1>${t('support_h1')}</h1>
            <p class="hero-lede">${t('support_intro')}</p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="#request">
                ${t('support_form_t')}${icon('arrow', { size: 17 })}
              </a>
            </div>
          </div>
          <div>
            <div class="emergency">
              <div>
                <div class="eyebrow t-alarm mb-1">
                  ${t('support_emergency_t')}
                </div>
                <a class="emergency-num mono" href="tel:${config.company.phone.replace(/\s/g, '')}">
                  ${config.company.phone}
                </a>
                <p class="t-sm t-dim mt-2 mb-0">
                  ${t('support_emergency_d')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="wrap">${breadcrumbs(ctx, [{ label: t('nav_support') }])}</div>

    <section class="section-tight" id="request">
      <div class="wrap">
        <div class="layout layout-340">
          <div>
            ${sent
              ? alert('ok', t('support_sent_t'), html`
                  ${t('quote_sent_d')} <strong class="mono">${sent}</strong>.
                  ${t('support_sent_note')}`)
              : ''}
            ${Object.keys(errors).length ? alert('err', '', t('err_generic')) : ''}

            <h2>${t('support_form_t')}</h2>
            <p class="muted t-sm">${t('required_fields')}</p>

            <form method="post" action="${L(ctx, '/support')}" class="card p-5 mt-4">
              <input type="text" name="website" tabindex="-1" autocomplete="off"
                     class="sr-only" aria-hidden="true">

              <fieldset>
                <legend>${t('support_urgency')}</legend>
                <div class="urgency-grid">
                  ${[['normal', 'urgency_normal'], ['urgent', 'urgency_urgent'],
                     ['line_down', 'urgency_line_down']].map(([value, key]) => html`
                    <label class="urgency">
                      <input type="radio" name="urgency" value="${value}"
                             ${(values.urgency || 'normal') === value ? html`checked` : ''}>
                      <span class="urgency-title">${t(key)}</span>
                      <span class="urgency-desc">${t(`${key}_d`)}</span>
                    </label>`)}
                </div>
              </fieldset>

              <fieldset>
                <legend>${t('support_form_t')}</legend>
                <div class="field">
                  <label for="machine">${t('support_machine')}</label>
                  <input class="input" type="text" name="machine" id="machine"
                         value="${values.machine || ''}" placeholder="${t('support_machine_ph')}"
                         maxlength="180">
                </div>
                <div class="field">
                  <label for="subject">${t('nav_services')} <span class="label-hint">(${t('optional')})</span></label>
                  <select class="select" name="subject" id="subject">
                    <option value="">—</option>
                    ${services.map((s) => html`
                      <option value="${ctx.f(s, 'title')}"
                              ${values.subject === ctx.f(s, 'title') ? html`selected` : ''}>
                        ${ctx.f(s, 'title')}
                      </option>`)}
                  </select>
                </div>
                <div class="field">
                  <label for="message">${t('support_problem')} *</label>
                  <textarea class="textarea" name="message" id="message" required
                            placeholder="${t('support_problem_ph')}"
                            maxlength="4000" ${invalid('message')}>${values.message || ''}</textarea>
                  ${err('message')}
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
              </fieldset>

              <button class="btn btn-primary" type="submit">
                ${t('support_submit')}${icon('arrow', { size: 17 })}
              </button>
            </form>
          </div>

          <aside>
            <div class="card p-4 sticky-side">
              <h3 class="t-lg">${t('support_covers_t')}</h3>
              <ul class="list-plain">
                ${services.map((s) => html`
                  <li class="mb-2 row row-top">
                    ${icon(s.icon, { size: 16 })}
                    <a href="${L(ctx, `/services/${s.slug}`)}" class="link-quiet">
                      ${ctx.f(s, 'title')}
                    </a>
                  </li>`)}
              </ul>
              <div class="ticks my-4"></div>
              <div class="t-sm t-soft">
                <div class="row mb-2">
                  ${icon('phone', { size: 15 })}
                  <a class="mono" href="tel:${config.company.phone.replace(/\s/g, '')}">${config.company.phone}</a>
                </div>
                <div class="row">
                  ${icon('mail', { size: 15 })}
                  <a href="mailto:${config.company.support}">${config.company.support}</a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>

    <section class="section section-alt">
      <div class="wrap wrap-narrow">
        <span class="eyebrow">${t('support_how_t')}</span>
        <h2 class="mb-section">${t('support_how_t')}</h2>
        <ol class="steps">
          ${STEPS.map((key) => html`
            <li>
              <h3>${t(`${key}_t`)}</h3>
              <p>${t(`${key}_d`)}</p>
            </li>`)}
        </ol>
      </div>
    </section>`;

  return page(ctx, {
    title: t('support_title'),
    description: t('support_lede'),
    body,
    canonical: ctx.origin + L(ctx, '/support'),
  });
}
