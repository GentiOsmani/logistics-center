import { html, raw } from '../../core/html.js';
import { config } from '../../config.js';
import { icon } from '../partials/icons.js';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: 'grid', exact: true },
  { href: '/admin/inquiries', label: 'Inquiries', icon: 'inbox', badge: 'openInquiries' },
  { href: '/admin/products', label: 'Products', icon: 'cube' },
  { href: '/admin/categories', label: 'Categories', icon: 'tag' },
  { href: '/admin/brands', label: 'Brands', icon: 'building' },
  { href: '/admin/datasheets', label: 'Datasheets', icon: 'pdf' },
];

function escapeAttr(value) {
  return String(value).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Full admin document with the persistent sidebar. */
export function adminPage(actx, { title, subtitle = '', actions = '', body }) {
  const isCurrent = (item) => (item.exact
    ? actx.pathname === item.href
    : actx.pathname === item.href || actx.pathname.startsWith(item.href + '/'));

  const document = html`
    <div class="adm">
      <aside class="adm-side">
        <a class="brandmark" href="/admin">
          <span class="brandmark-badge" aria-hidden="true">B&amp;G</span>
          <span class="brandmark-text">
            <span class="brandmark-name">${config.company.name}</span>
            <span class="brandmark-sub">Admin</span>
          </span>
        </a>

        <h4>Manage</h4>
        <nav class="adm-nav">
          ${NAV.map((item) => html`
            <a href="${item.href}"${isCurrent(item) ? raw(' aria-current="page"') : ''}>
              ${icon(item.icon, { size: 17 })}
              <span>${item.label}</span>
              ${item.badge && actx.counts[item.badge]
                ? html`<span class="badge">${actx.counts[item.badge]}</span>` : ''}
            </a>`)}
        </nav>

        <h4>Site</h4>
        <nav class="adm-nav">
          <a href="/sq" target="_blank" rel="noopener">
            ${icon('external', { size: 17 })}<span>View site</span>
          </a>
        </nav>

        <div class="adm-side-foot">
          <div class="who">${actx.user.name}</div>
          <div class="role">${actx.user.role}</div>
          <form method="post" action="/admin/logout">
            <input type="hidden" name="_csrf" value="${actx.csrf}">
            <button class="btn btn-ghost btn-sm" type="submit">
              ${icon('logout', { size: 15 })}Sign out
            </button>
          </form>
        </div>
      </aside>

      <div class="adm-main">
        <header class="adm-top">
          <div>
            <h1>${title}</h1>
            ${subtitle ? html`<div class="sub">${subtitle}</div>` : ''}
          </div>
          <div class="adm-top-actions">${actions}</div>
        </header>
        <div class="adm-body">
          ${actx.flash ? html`
            <div class="alert alert-${actx.flash.kind}">${actx.flash.text}</div>` : ''}
          ${body}
        </div>
      </div>
    </div>`;

  return raw(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeAttr(title)} — ${escapeAttr(config.company.name)} Admin</title>
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#080b10">
<link rel="stylesheet" href="${actx.asset('/assets/css/main.css')}">
<link rel="stylesheet" href="${actx.asset('/assets/css/admin.css')}">
</head>
<body>
${document}
</body>
</html>`);
}

/** Standalone login screen — no sidebar, no session required. */
export function loginPage(actx, { error = '', email = '' } = {}) {
  const body = html`
    <div class="adm-login">
      <form class="adm-login-card" method="post" action="/admin/login">
        <a class="brandmark" href="/sq">
          <span class="brandmark-badge" aria-hidden="true">B&amp;G</span>
          <span class="brandmark-text">
            <span class="brandmark-name">${config.company.name}</span>
            <span class="brandmark-sub">Admin</span>
          </span>
        </a>

        ${error ? html`<div class="alert alert-err" role="alert">${error}</div>` : ''}

        <div class="field">
          <label for="email">Email</label>
          <input class="input" type="email" name="email" id="email" required
                 value="${email}" autocomplete="username" autofocus>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input class="input" type="password" name="password" id="password" required
                 autocomplete="current-password">
        </div>
        <button class="btn btn-primary btn-block" type="submit">Sign in</button>
      </form>
    </div>`;

  return raw(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in — ${escapeAttr(config.company.name)} Admin</title>
<meta name="robots" content="noindex,nofollow">
<link rel="stylesheet" href="${actx.asset('/assets/css/main.css')}">
<link rel="stylesheet" href="${actx.asset('/assets/css/admin.css')}">
</head>
<body>
${body}
</body>
</html>`);
}
