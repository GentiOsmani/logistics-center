import { html } from '../../core/html.js';
import { icon, iconNames } from '../partials/icons.js';
import { adminPage } from './shell.js';

const csrfField = (actx) => html`<input type="hidden" name="_csrf" value="${actx.csrf}">`;

const AVAILABILITY = [
  ['in_stock', 'In stock'],
  ['lead_time', 'On lead time'],
  ['on_request', 'On request'],
];

const STATUSES = ['new', 'in_progress', 'answered', 'closed'];

/* ------------------------------------------------------------- dashboard */

export function dashboardPage(actx, { stats, recent, lowInfo }) {
  const body = html`
    <div class="adm-cards">
      <div class="adm-stat${stats.urgent ? ' is-alert' : ''}">
        <div class="adm-stat-v">${stats.urgent}</div>
        <div class="adm-stat-l">Line-down requests</div>
      </div>
      <div class="adm-stat${stats.open ? ' is-warn' : ''}">
        <div class="adm-stat-v">${stats.open}</div>
        <div class="adm-stat-l">Open inquiries</div>
      </div>
      <div class="adm-stat">
        <div class="adm-stat-v">${stats.today}</div>
        <div class="adm-stat-l">Received today</div>
      </div>
      <div class="adm-stat">
        <div class="adm-stat-v">${stats.products}</div>
        <div class="adm-stat-l">Active products</div>
      </div>
    </div>

    <div class="adm-grid">
      <div class="adm-panel">
        <div class="adm-panel-head">
          <h2>Latest inquiries</h2>
          <a class="btn btn-outline btn-sm" href="/admin/inquiries">View all</a>
        </div>
        <div class="adm-panel-body flush">
          ${recent.length ? html`
            <table class="adm-table">
              <thead>
                <tr><th>Ref</th><th>Type</th><th>From</th><th>Urgency</th><th>Status</th><th>Received</th></tr>
              </thead>
              <tbody>
                ${recent.map((row) => html`
                  <tr>
                    <td><a class="mono" href="/admin/inquiries/${row.id}">${row.ref}</a></td>
                    <td>${row.kind}</td>
                    <td>${row.name}${row.company ? html`<br><span class="muted">${row.company}</span>` : ''}</td>
                    <td><span class="status-pill urg-${row.urgency}">${row.urgency.replace('_', ' ')}</span></td>
                    <td><span class="status-pill status-${row.status}">${row.status.replace('_', ' ')}</span></td>
                    <td class="mono muted">${row.created_at}</td>
                  </tr>`)}
              </tbody>
            </table>`
            : html`<p class="muted p-5">No inquiries yet.</p>`}
        </div>
      </div>

      <div>
        <div class="adm-panel">
          <div class="adm-panel-head"><h2>Catalogue</h2></div>
          <div class="adm-panel-body">
            <dl class="m-0 t-sm2">
              ${lowInfo.map(([label, value]) => html`
                <div class="buybox-row">
                  <dt class="muted">${label}</dt>
                  <dd class="mono">${value}</dd>
                </div>`)}
            </dl>
          </div>
        </div>
        <div class="adm-panel">
          <div class="adm-panel-head"><h2>Quick actions</h2></div>
          <div class="adm-panel-body stack">
            <a class="btn btn-primary btn-block" href="/admin/products/new">
              ${icon('plus', { size: 16 })}New product
            </a>
            <a class="btn btn-outline btn-block" href="/admin/categories">Manage categories</a>
            <a class="btn btn-outline btn-block" href="/admin/brands">Manage brands</a>
          </div>
        </div>
      </div>
    </div>`;

  return adminPage(actx, { title: 'Dashboard', subtitle: 'Overview of inquiries and catalogue', body });
}

/* ---------------------------------------------------------------- products */

export function productListPage(actx, { items, total, pageNum, pageSize, q }) {
  const pages = Math.ceil(total / pageSize);
  const body = html`
    <div class="adm-panel">
      <div class="adm-panel-head">
        <form method="get" action="/admin/products" class="row row-sm">
          <input class="input mono w-280" type="search" name="q" value="${q}"
                 placeholder="Part number or name…">
          <button class="btn btn-outline btn-sm" type="submit">${icon('search', { size: 15 })}</button>
        </form>
        <span class="muted mono t-xs">${total} total</span>
      </div>
      <div class="adm-panel-body flush">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Part number</th><th>Name</th><th>Brand</th><th>Category</th>
              <th>Availability</th><th class="num">Price</th><th></th><th class="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((p) => html`
              <tr>
                <td><a class="mono" href="/admin/products/${p.id}">${p.part_number}</a></td>
                <td>${p.name_en}</td>
                <td class="muted">${p.brand_name || '—'}</td>
                <td class="muted">${p.category_name_en || '—'}</td>
                <td><span class="status-pill status-${p.availability === 'in_stock' ? 'answered' : 'new'}">
                  ${p.availability.replace('_', ' ')}</span></td>
                <td class="num">${p.price_eur != null ? p.price_eur.toFixed(2) : '—'}</td>
                <td>${p.is_active ? '' : html`<span class="chip">hidden</span>`}</td>
                <td class="actions">
                  <a class="btn btn-outline btn-sm" href="/admin/products/${p.id}">${icon('edit', { size: 14 })}</a>
                  <a class="btn btn-outline btn-sm" href="/admin/products/${p.id}/delete"
                     aria-label="Delete ${p.part_number}">${icon('trash', { size: 14 })}</a>
                </td>
              </tr>`)}
          </tbody>
        </table>
      </div>
    </div>

    ${pages > 1 ? html`
      <nav class="pagination">
        ${Array.from({ length: pages }, (_, i) => i + 1).map((n) => n === pageNum
          ? html`<span aria-current="page">${n}</span>`
          : html`<a href="/admin/products?page=${n}${q ? `&q=${encodeURIComponent(q)}` : ''}">${n}</a>`)}
      </nav>` : ''}`;

  return adminPage(actx, {
    title: 'Products',
    subtitle: 'Catalogue references, specifications and cross-references',
    actions: html`<a class="btn btn-primary btn-sm" href="/admin/products/new">
      ${icon('plus', { size: 15 })}New product</a>`,
    body,
  });
}

export function productFormPage(actx, {
  product, specs, refs, datasheets, categories, brands, errors = {},
}) {
  const isNew = !product.id;
  const value = (name, fallback = '') => product[name] ?? fallback;
  const specRows = specs.length ? specs : [];
  const refRows = refs.length ? refs : [];

  const body = html`
    ${Object.keys(errors).length
      ? html`<div class="alert alert-err">${Object.values(errors).join(' · ')}</div>` : ''}

    <form method="post" action="${isNew ? '/admin/products/new' : `/admin/products/${product.id}`}">
      ${csrfField(actx)}
      <div class="adm-grid">
        <div>
          <div class="adm-panel">
            <div class="adm-panel-head"><h2>Identity</h2></div>
            <div class="adm-panel-body">
              <div class="field-row">
                <div class="field">
                  <label for="part_number">Part number *</label>
                  <input class="input mono" type="text" name="part_number" id="part_number"
                         required maxlength="64" value="${value('part_number')}">
                </div>
                <div class="field">
                  <label for="slug">Slug <span class="label-hint">(auto if empty)</span></label>
                  <input class="input mono" type="text" name="slug" id="slug"
                         maxlength="90" value="${value('slug')}">
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="brand_id">Brand</label>
                  <select class="select" name="brand_id" id="brand_id">
                    <option value="">—</option>
                    ${brands.map((b) => html`
                      <option value="${b.id}" ${product.brand_id === b.id ? html`selected` : ''}>${b.name}</option>`)}
                  </select>
                </div>
                <div class="field">
                  <label for="category_id">Category</label>
                  <select class="select" name="category_id" id="category_id">
                    <option value="">—</option>
                    ${categories.map((c) => html`
                      <option value="${c.id}" ${product.category_id === c.id ? html`selected` : ''}>${c.name_en}</option>`)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div class="adm-panel">
            <div class="adm-panel-head"><h2>Content</h2></div>
            <div class="adm-panel-body">
              <div class="field-row">
                <div class="field">
                  <label for="name_sq">Name (SQ) *</label>
                  <input class="input" type="text" name="name_sq" id="name_sq" required
                         maxlength="200" value="${value('name_sq')}">
                </div>
                <div class="field">
                  <label for="name_en">Name (EN) *</label>
                  <input class="input" type="text" name="name_en" id="name_en" required
                         maxlength="200" value="${value('name_en')}">
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="summary_sq">Summary (SQ)</label>
                  <textarea class="textarea ta-80" name="summary_sq" id="summary_sq" maxlength="400">${value('summary_sq')}</textarea>
                </div>
                <div class="field">
                  <label for="summary_en">Summary (EN)</label>
                  <textarea class="textarea ta-80" name="summary_en" id="summary_en" maxlength="400">${value('summary_en')}</textarea>
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="body_sq">Description (SQ)</label>
                  <textarea class="textarea" name="body_sq" id="body_sq" maxlength="4000">${value('body_sq')}</textarea>
                </div>
                <div class="field">
                  <label for="body_en">Description (EN)</label>
                  <textarea class="textarea" name="body_en" id="body_en" maxlength="4000">${value('body_en')}</textarea>
                </div>
              </div>
            </div>
          </div>

          <div class="adm-panel">
            <div class="adm-panel-head">
              <h2>Specifications</h2>
              <span class="muted t-xs">Leave a row blank to remove it</span>
            </div>
            <div class="adm-panel-body">
              <div class="repeat-row repeat-head">
                <span>Label SQ</span><span>Label EN</span><span>Value SQ</span><span>Value EN</span><span></span>
              </div>
              ${Array.from({ length: Math.max(specRows.length + 3, 6) }, (_, i) => {
                const row = specRows[i] || {};
                return html`
                  <div class="repeat-row">
                    <input class="input" type="text" name="spec_label_sq[]" value="${row.label_sq || ''}" maxlength="80">
                    <input class="input" type="text" name="spec_label_en[]" value="${row.label_en || ''}" maxlength="80">
                    <input class="input" type="text" name="spec_value_sq[]" value="${row.value_sq || ''}" maxlength="160">
                    <input class="input" type="text" name="spec_value_en[]" value="${row.value_en || ''}" maxlength="160">
                    <span></span>
                  </div>`;
              })}
            </div>
          </div>

          <div class="adm-panel">
            <div class="adm-panel-head">
              <h2>Cross-references</h2>
              <span class="muted t-xs">Equivalent / OEM / superseded numbers</span>
            </div>
            <div class="adm-panel-body">
              ${Array.from({ length: Math.max(refRows.length + 2, 4) }, (_, i) => {
                const row = refRows[i] || {};
                return html`
                  <div class="repeat-row repeat-refs">
                    <input class="input mono" type="text" name="ref_number[]"
                           value="${row.number || ''}" maxlength="64" placeholder="Number">
                    <select class="select select-sm" name="ref_kind[]">
                      ${['equivalent', 'oem', 'superseded'].map((k) => html`
                        <option value="${k}" ${row.kind === k ? html`selected` : ''}>${k}</option>`)}
                    </select>
                    <input class="input" type="text" name="ref_note[]"
                           value="${row.note || ''}" maxlength="120" placeholder="Note">
                    <span></span>
                  </div>`;
              })}
            </div>
          </div>
        </div>

        <div>
          <div class="adm-panel">
            <div class="adm-panel-head"><h2>Availability</h2></div>
            <div class="adm-panel-body">
              <div class="field">
                <label for="availability">Status</label>
                <select class="select" name="availability" id="availability">
                  ${AVAILABILITY.map(([v, label]) => html`
                    <option value="${v}" ${value('availability', 'on_request') === v ? html`selected` : ''}>${label}</option>`)}
                </select>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="lead_time_days">Lead time (days)</label>
                  <input class="input mono" type="number" name="lead_time_days" id="lead_time_days"
                         min="0" max="365" value="${value('lead_time_days', 0)}">
                </div>
                <div class="field">
                  <label for="unit">Unit</label>
                  <input class="input mono" type="text" name="unit" id="unit"
                         maxlength="12" value="${value('unit', 'pcs')}">
                </div>
              </div>
              <div class="field">
                <label for="price_eur">Price EUR <span class="label-hint">(empty = on request)</span></label>
                <input class="input mono" type="text" inputmode="decimal" name="price_eur" id="price_eur"
                       value="${product.price_eur ?? ''}">
              </div>
              <label class="check">
                <input type="checkbox" name="is_featured" value="1" ${product.is_featured ? html`checked` : ''}>
                <span>Featured on the home page</span>
              </label>
              <label class="check mt-2">
                <input type="checkbox" name="is_active" value="1" ${isNew || product.is_active ? html`checked` : ''}>
                <span>Visible on the site</span>
              </label>
            </div>
          </div>

          <div class="adm-panel">
            <div class="adm-panel-body stack">
              <button class="btn btn-primary btn-block" type="submit">
                ${icon('check', { size: 16 })}${isNew ? 'Create product' : 'Save changes'}
              </button>
              <a class="btn btn-outline btn-block" href="/admin/products">Cancel</a>
              ${!isNew ? html`
                <a class="btn btn-outline btn-block" href="/sq/products/${product.slug}" target="_blank" rel="noopener">
                  ${icon('external', { size: 15 })}View on site
                </a>` : ''}
            </div>
          </div>
        </div>
      </div>
    </form>

    ${!isNew ? html`
      <div class="adm-panel">
        <div class="adm-panel-head"><h2>Datasheets</h2></div>
        <div class="adm-panel-body">
          ${datasheets.map((d) => html`
            <div class="dl-row">
              ${icon('pdf', { size: 20 })}
              <span class="dl-row-main">
                <span class="dl-row-title">${d.title}</span>
                <span class="dl-row-meta">${d.filename} · ${Math.round(d.size_bytes / 1024)} KB · ${d.lang}</span>
              </span>
              <a class="btn btn-outline btn-sm" href="${actx.filesOrigin || ''}/files/${d.filename}" target="_blank" rel="noopener">Open</a>
              <form method="post" action="/admin/datasheets/${d.id}/delete">
                ${csrfField(actx)}
                <button class="icon-btn" type="submit" aria-label="Delete datasheet">
                  ${icon('trash', { size: 15 })}
                </button>
              </form>
            </div>`)}

          <form method="post" action="/admin/datasheets" class="ds-upload mt-4">
            ${csrfField(actx)}
            <input type="hidden" name="product_id" value="${product.id}">
            <div class="field m-0">
              <label for="ds-title">Title</label>
              <input class="input" type="text" name="title" id="ds-title" maxlength="140"
                     placeholder="${product.part_number} datasheet">
            </div>
            <div class="field m-0">
              <label for="ds-filename">Filename</label>
              <input class="input" type="text" name="filename" id="ds-filename" maxlength="140"
                     placeholder="commit the PDF to data/datasheets/ first" required>
            </div>
            <div class="field m-0">
              <label for="ds-lang">Lang</label>
              <select class="select" name="lang" id="ds-lang">
                <option value="en">EN</option><option value="sq">SQ</option><option value="de">DE</option>
              </select>
            </div>
            <button class="btn btn-dark" type="submit">Register</button>
          </form>
          <p class="muted t-xs mt-2">
            No live file upload (this account has no card-verified storage) — commit the PDF to
            <code>data/datasheets/</code> in the repo, then register it here by exact filename.
          </p>
        </div>
      </div>` : ''}`;

  return adminPage(actx, {
    title: isNew ? 'New product' : product.part_number,
    subtitle: isNew ? 'Add a catalogue reference' : 'Edit catalogue reference',
    body,
  });
}

/* -------------------------------------------------------------- taxonomy */

export function categoriesPage(actx, { categories, editing }) {
  const body = html`
    <div class="adm-grid">
      <div class="adm-panel">
        <div class="adm-panel-head"><h2>Categories</h2></div>
        <div class="adm-panel-body flush">
          <table class="adm-table">
            <thead><tr><th>Name (EN)</th><th>Name (SQ)</th><th>Slug</th><th class="num">Products</th><th class="num">Sort</th><th class="actions"></th></tr></thead>
            <tbody>
              ${categories.map((c) => html`
                <tr>
                  <td><a href="/admin/categories?edit=${c.id}">${c.name_en}</a></td>
                  <td>${c.name_sq}</td>
                  <td class="mono muted">${c.slug}</td>
                  <td class="num">${c.product_count}</td>
                  <td class="num">${c.sort}</td>
                  <td class="actions">
                    <a class="icon-btn" href="/admin/categories/${c.id}/delete"
                       aria-label="Delete ${c.name_en}">${icon('trash', { size: 14 })}</a>
                  </td>
                </tr>`)}
            </tbody>
          </table>
        </div>
      </div>

      <div class="adm-panel">
        <div class="adm-panel-head"><h2>${editing ? 'Edit category' : 'New category'}</h2></div>
        <div class="adm-panel-body">
          <form method="post" action="/admin/categories${editing ? `/${editing.id}` : ''}">
            ${csrfField(actx)}
            <div class="field">
              <label for="c-name-en">Name (EN) *</label>
              <input class="input" type="text" name="name_en" id="c-name-en" required
                     maxlength="80" value="${editing?.name_en || ''}">
            </div>
            <div class="field">
              <label for="c-name-sq">Name (SQ) *</label>
              <input class="input" type="text" name="name_sq" id="c-name-sq" required
                     maxlength="80" value="${editing?.name_sq || ''}">
            </div>
            <div class="field">
              <label for="c-slug">Slug</label>
              <input class="input mono" type="text" name="slug" id="c-slug"
                     maxlength="80" value="${editing?.slug || ''}">
            </div>
            <div class="field">
              <label for="c-sum-en">Summary (EN)</label>
              <textarea class="textarea ta-70" name="summary_en" id="c-sum-en" maxlength="300">${editing?.summary_en || ''}</textarea>
            </div>
            <div class="field">
              <label for="c-sum-sq">Summary (SQ)</label>
              <textarea class="textarea ta-70" name="summary_sq" id="c-sum-sq" maxlength="300">${editing?.summary_sq || ''}</textarea>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="c-icon">Icon</label>
                <select class="select" name="icon" id="c-icon">
                  ${iconNames.map((n) => html`
                    <option value="${n}" ${editing?.icon === n ? html`selected` : ''}>${n}</option>`)}
                </select>
              </div>
              <div class="field">
                <label for="c-sort">Sort</label>
                <input class="input mono" type="number" name="sort" id="c-sort"
                       value="${editing?.sort ?? 0}">
              </div>
            </div>
            <label class="check">
              <input type="checkbox" name="is_active" value="1" ${!editing || editing.is_active ? html`checked` : ''}>
              <span>Visible</span>
            </label>
            <button class="btn btn-primary btn-block mt-4" type="submit">
              ${editing ? 'Save category' : 'Create category'}
            </button>
            ${editing ? html`<a class="btn btn-outline btn-block mt-2" href="/admin/categories">Cancel</a>` : ''}
          </form>
        </div>
      </div>
    </div>`;

  return adminPage(actx, { title: 'Categories', subtitle: 'Catalogue taxonomy', body });
}

export function brandsPage(actx, { brands, editing }) {
  const body = html`
    <div class="adm-grid">
      <div class="adm-panel">
        <div class="adm-panel-head"><h2>Brands</h2></div>
        <div class="adm-panel-body flush">
          <table class="adm-table">
            <thead><tr><th>Name</th><th>Country</th><th>Slug</th><th class="num">Products</th><th></th><th class="actions"></th></tr></thead>
            <tbody>
              ${brands.map((b) => html`
                <tr>
                  <td><a href="/admin/brands?edit=${b.id}">${b.name}</a></td>
                  <td class="mono">${b.country}</td>
                  <td class="mono muted">${b.slug}</td>
                  <td class="num">${b.product_count}</td>
                  <td>${b.is_featured ? html`<span class="chip chip-amber">featured</span>` : ''}</td>
                  <td class="actions">
                    <a class="icon-btn" href="/admin/brands/${b.id}/delete"
                       aria-label="Delete ${b.name}">${icon('trash', { size: 14 })}</a>
                  </td>
                </tr>`)}
            </tbody>
          </table>
        </div>
      </div>

      <div class="adm-panel">
        <div class="adm-panel-head"><h2>${editing ? 'Edit brand' : 'New brand'}</h2></div>
        <div class="adm-panel-body">
          <form method="post" action="/admin/brands${editing ? `/${editing.id}` : ''}">
            ${csrfField(actx)}
            <div class="field">
              <label for="b-name">Name *</label>
              <input class="input" type="text" name="name" id="b-name" required
                     maxlength="80" value="${editing?.name || ''}">
            </div>
            <div class="field-row">
              <div class="field">
                <label for="b-country">Country code</label>
                <input class="input mono" type="text" name="country" id="b-country"
                       maxlength="4" value="${editing?.country || ''}">
              </div>
              <div class="field">
                <label for="b-sort">Sort</label>
                <input class="input mono" type="number" name="sort" id="b-sort"
                       value="${editing?.sort ?? 0}">
              </div>
            </div>
            <div class="field">
              <label for="b-slug">Slug</label>
              <input class="input mono" type="text" name="slug" id="b-slug"
                     maxlength="80" value="${editing?.slug || ''}">
            </div>
            <div class="field">
              <label for="b-web">Website</label>
              <input class="input" type="url" name="website" id="b-web"
                     maxlength="200" value="${editing?.website || ''}">
            </div>
            <div class="field">
              <label for="b-sum-en">Summary (EN)</label>
              <textarea class="textarea ta-70" name="summary_en" id="b-sum-en" maxlength="300">${editing?.summary_en || ''}</textarea>
            </div>
            <div class="field">
              <label for="b-sum-sq">Summary (SQ)</label>
              <textarea class="textarea ta-70" name="summary_sq" id="b-sum-sq" maxlength="300">${editing?.summary_sq || ''}</textarea>
            </div>
            <label class="check">
              <input type="checkbox" name="is_featured" value="1" ${editing?.is_featured ? html`checked` : ''}>
              <span>Featured on the home page</span>
            </label>
            <label class="check mt-2">
              <input type="checkbox" name="is_active" value="1" ${!editing || editing.is_active ? html`checked` : ''}>
              <span>Visible</span>
            </label>
            <button class="btn btn-primary btn-block mt-4" type="submit">
              ${editing ? 'Save brand' : 'Create brand'}
            </button>
            ${editing ? html`<a class="btn btn-outline btn-block mt-2" href="/admin/brands">Cancel</a>` : ''}
          </form>
        </div>
      </div>
    </div>`;

  return adminPage(actx, { title: 'Brands', subtitle: 'Manufacturers and suppliers', body });
}

/* ------------------------------------------------------------- inquiries */

export function inquiriesPage(actx, { items, total, filter, pageNum, pageSize }) {
  const pages = Math.ceil(total / pageSize);
  const link = (key, value, label) => html`
    <a href="/admin/inquiries${value ? `?${key}=${value}` : ''}"
       ${filter[key] === value ? html`aria-current="true"` : ''}>${label}</a>`;

  const body = html`
    <div class="adm-filters">
      ${link('status', '', 'All')}
      ${STATUSES.map((s) => link('status', s, s.replace('_', ' ')))}
      <span class="divider-v"></span>
      ${['quote', 'support', 'contact'].map((k) => link('kind', k, k))}
    </div>

    <div class="adm-panel">
      <div class="adm-panel-body flush">
        <table class="adm-table">
          <thead>
            <tr><th>Ref</th><th>Type</th><th>From</th><th>Subject</th><th class="num">Items</th>
                <th>Urgency</th><th>Status</th><th>Received</th></tr>
          </thead>
          <tbody>
            ${items.map((row) => html`
              <tr>
                <td><a class="mono" href="/admin/inquiries/${row.id}">${row.ref}</a></td>
                <td>${row.kind}</td>
                <td>${row.name}${row.company ? html`<br><span class="muted">${row.company}</span>` : ''}</td>
                <td class="muted">${row.subject || row.machine || '—'}</td>
                <td class="num">${row.item_count || '—'}</td>
                <td><span class="status-pill urg-${row.urgency}">${row.urgency.replace('_', ' ')}</span></td>
                <td><span class="status-pill status-${row.status}">${row.status.replace('_', ' ')}</span></td>
                <td class="mono muted">${row.created_at}</td>
              </tr>`)}
          </tbody>
        </table>
        ${items.length ? '' : html`<p class="muted p-5">No inquiries match this filter.</p>`}
      </div>
    </div>

    ${pages > 1 ? html`
      <nav class="pagination">
        ${Array.from({ length: pages }, (_, i) => i + 1).map((n) => n === pageNum
          ? html`<span aria-current="page">${n}</span>`
          : html`<a href="/admin/inquiries?page=${n}">${n}</a>`)}
      </nav>` : ''}`;

  return adminPage(actx, {
    title: 'Inquiries',
    subtitle: 'Quotation requests, support calls and messages',
    body,
  });
}

export function inquiryPage(actx, { inquiry, items }) {
  const row = (label, value) => (value ? html`
    <div class="buybox-row">
      <dt class="muted">${label}</dt>
      <dd>${value}</dd>
    </div>` : '');

  const body = html`
    <div class="adm-grid">
      <div>
        <div class="adm-panel">
          <div class="adm-panel-head">
            <h2>${inquiry.subject || inquiry.machine || `${inquiry.kind} request`}</h2>
            <span class="status-pill urg-${inquiry.urgency}">${inquiry.urgency.replace('_', ' ')}</span>
          </div>
          <div class="adm-panel-body">
            ${inquiry.machine ? html`
              <p><strong>Machine / line:</strong> ${inquiry.machine}</p>` : ''}
            <p class="pre-wrap">${inquiry.message || '—'}</p>
          </div>
        </div>

        ${items.length ? html`
          <div class="adm-panel">
            <div class="adm-panel-head"><h2>Requested references</h2></div>
            <div class="adm-panel-body flush">
              <table class="adm-table">
                <thead><tr><th>Part number</th><th>Product</th><th class="num">Qty</th></tr></thead>
                <tbody>
                  ${items.map((item) => html`
                    <tr>
                      <td class="mono">${item.slug
                        ? html`<a href="/sq/products/${item.slug}" target="_blank" rel="noopener">${item.part_number}</a>`
                        : item.part_number}</td>
                      <td>${item.title || html`<span class="muted">not in catalogue</span>`}</td>
                      <td class="num">${item.qty}</td>
                    </tr>`)}
                </tbody>
              </table>
            </div>
          </div>` : ''}
      </div>

      <div>
        <div class="adm-panel">
          <div class="adm-panel-head"><h2>Contact</h2></div>
          <div class="adm-panel-body">
            <dl class="m-0 t-sm2">
              ${row('Reference', html`<span class="mono">${inquiry.ref}</span>`)}
              ${row('Name', inquiry.name)}
              ${row('Company', inquiry.company)}
              ${row('Email', html`<a href="mailto:${inquiry.email}">${inquiry.email}</a>`)}
              ${row('Phone', html`<a class="mono" href="tel:${inquiry.phone}">${inquiry.phone}</a>`)}
              ${row('City', inquiry.city)}
              ${row('Country', inquiry.country)}
              ${row('Language', inquiry.locale.toUpperCase())}
              ${row('Received', html`<span class="mono">${inquiry.created_at}</span>`)}
              ${row('Handled', inquiry.handled_at ? html`<span class="mono">${inquiry.handled_at}</span>` : '')}
            </dl>
          </div>
        </div>

        <div class="adm-panel">
          <div class="adm-panel-head"><h2>Handling</h2></div>
          <div class="adm-panel-body">
            <form method="post" action="/admin/inquiries/${inquiry.id}">
              ${csrfField(actx)}
              <div class="field">
                <label for="status">Status</label>
                <select class="select" name="status" id="status">
                  ${STATUSES.map((s) => html`
                    <option value="${s}" ${inquiry.status === s ? html`selected` : ''}>${s.replace('_', ' ')}</option>`)}
                </select>
              </div>
              <div class="field">
                <label for="internal_note">Internal note</label>
                <textarea class="textarea" name="internal_note" id="internal_note"
                          maxlength="4000">${inquiry.internal_note}</textarea>
              </div>
              <button class="btn btn-primary btn-block" type="submit">Save</button>
            </form>
            <a class="btn btn-outline btn-block mt-3"
               href="/admin/inquiries/${inquiry.id}/delete">Delete inquiry</a>
          </div>
        </div>
      </div>
    </div>`;

  return adminPage(actx, {
    title: inquiry.ref,
    subtitle: `${inquiry.kind} · ${inquiry.name}`,
    actions: html`<a class="btn btn-outline btn-sm" href="/admin/inquiries">Back to list</a>`,
    body,
  });
}

/* ------------------------------------------------------------ datasheets */

export function datasheetsPage(actx, { datasheets }) {
  const body = html`
    <div class="adm-panel">
      <div class="adm-panel-head">
        <h2>Uploaded datasheets</h2>
        <span class="muted t-xs">Upload new files from a product page</span>
      </div>
      <div class="adm-panel-body flush">
        <table class="adm-table">
          <thead><tr><th>Title</th><th>Product</th><th>File</th><th class="num">Size</th><th>Lang</th><th class="actions"></th></tr></thead>
          <tbody>
            ${datasheets.map((d) => html`
              <tr>
                <td>${d.title}</td>
                <td class="mono">${d.part_number || '—'}</td>
                <td><a href="${actx.filesOrigin || ''}/files/${d.filename}" target="_blank" rel="noopener">${d.filename}</a></td>
                <td class="num">${Math.round(d.size_bytes / 1024)} KB</td>
                <td class="mono">${d.lang}</td>
                <td class="actions">
                  <a class="icon-btn" href="/admin/datasheets/${d.id}/delete"
                     aria-label="Delete datasheet">${icon('trash', { size: 14 })}</a>
                </td>
              </tr>`)}
          </tbody>
        </table>
        ${datasheets.length ? '' : html`<p class="muted p-5">No datasheets uploaded yet.</p>`}
      </div>
    </div>`;

  return adminPage(actx, { title: 'Datasheets', subtitle: 'Technical documents attached to products', body });
}
