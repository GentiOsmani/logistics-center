import { html } from '../../core/html.js';
import { adminPage } from './shell.js';

/**
 * Server-rendered delete confirmation. Replaces an inline `confirm()` handler,
 * which keeps the strict `script-src 'self'` policy intact and works with JS off.
 */
export function confirmPage(actx, { title, what, detail = '', action, cancel }) {
  const body = html`
    <div class="adm-panel max-560">
      <div class="adm-panel-head"><h2>${title}</h2></div>
      <div class="adm-panel-body">
        <p>You are about to permanently delete <strong>${what}</strong>.</p>
        ${detail ? html`<p class="muted t-sm2">${detail}</p>` : ''}
        <p class="muted t-sm2">This action cannot be undone.</p>
        <div class="row row-md mt-5">
          <form method="post" action="${action}">
            <input type="hidden" name="_csrf" value="${actx.csrf}">
            <button class="btn btn-danger" type="submit">Yes, delete</button>
          </form>
          <a class="btn btn-outline" href="${cancel}">Cancel</a>
        </div>
      </div>
    </div>`;

  return adminPage(actx, { title, subtitle: 'Confirm deletion', body });
}
