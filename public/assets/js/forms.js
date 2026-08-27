/**
 * Support/contact/quote form submission — the static site has no server to
 * POST to (it's a different origin from the Worker API entirely), so every
 * form here submits via fetch with CORS instead of a normal HTML POST. This
 * is the one real regression from the original design (see deploy/README.md):
 * without JS these forms don't work, whereas the Node server's did.
 *
 * Depends on window.LC (public/assets/js/cart.js, loaded first) for the
 * shared i18n subset, locale and cart access.
 */
(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var LC = window.LC;
    if (!LC) return;
    var API = (LC.site.workerOrigin || '') + '/api';

    document.addEventListener('submit', function (event) {
      var form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      var action = form.getAttribute('action') || '';

      if (/\/contact$/.test(action)) return handle(event, form, 'contact', buildContact(form));
      if (/\/support$/.test(action)) return handle(event, form, 'support', buildSupport(form));
      if (/\/quote$/.test(action) && !/\/quote\/(add|update|remove|clear)$/.test(action)) {
        return handle(event, form, 'quote', buildQuote(form));
      }
    });

    function handle(event, form, kind, body) {
      event.preventDefault();
      setBusy(form, true);
      fetch(API + '/' + kind, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
        .then(function (result) { onResult(form, kind, result); })
        .catch(function () { showAlert(form, 'err', LC.t('err_generic')); })
        .finally(function () { setBusy(form, false); });
    }

    function onResult(form, kind, result) {
      if (result.status >= 200 && result.status < 300 && result.data.ok) {
        var title = LC.t(kind + '_sent_t');
        var noteKey = kind === 'quote' ? 'quote_sent_note' : kind === 'support' ? 'support_sent_note' : null;
        var detail = kind === 'contact'
          ? LC.t('contact_sent_d')
          : (LC.t('quote_sent_d') + ' <strong class="mono">' + LC.esc(result.data.ref) + '</strong>.' + (noteKey ? ' ' + LC.t(noteKey) : ''));
        showAlert(form, 'ok', detail, title);
        form.reset();
        if (kind === 'quote') { LC.writeCart([]); LC.renderQuoteItems(); }
        return;
      }
      if (result.status === 429) return showAlert(form, 'err', LC.t('err_rate'));
      if (result.data && result.data.errors) {
        Object.keys(result.data.errors).forEach(function (field) {
          var input = form.querySelector('[name=' + field + ']');
          if (input) input.setAttribute('aria-invalid', 'true');
        });
      }
      showAlert(form, 'err', LC.t('err_generic'));
    }

    function setBusy(form, busy) {
      var btn = form.querySelector('button[type=submit]');
      if (btn) btn.disabled = busy;
    }

    function showAlert(form, kind, text, title) {
      var status = form.closest('.wrap, .section, body').querySelector('#form-status') || form.parentElement;
      if (!status) return;
      status.innerHTML =
        '<div class="alert alert-' + kind + '" role="' + (kind === 'err' ? 'alert' : 'status') + '">' +
        (title ? '<strong>' + LC.esc(title) + '</strong>' : '') + text + '</div>';
      status.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function field(form, name) {
      var el = form.querySelector('[name=' + name + ']');
      return el ? el.value : '';
    }

    function common(form) {
      return {
        name: field(form, 'name'), company: field(form, 'company'), email: field(form, 'email'),
        phone: field(form, 'phone'), city: field(form, 'city'), country: field(form, 'country') || 'XK',
        website: field(form, 'website'), locale: LC.locale,
      };
    }

    function buildContact(form) {
      return Object.assign(common(form), { subject: field(form, 'subject'), message: field(form, 'message') });
    }

    function buildSupport(form) {
      return Object.assign(common(form), {
        machine: field(form, 'machine'), subject: field(form, 'subject'),
        message: field(form, 'message'), urgency: field(form, 'urgency') || 'normal',
      });
    }

    function buildQuote(form) {
      var items = LC.readCart().map(function (i) {
        return { part_number: i.part_number, product_id: i.product_id, title: i.title, qty: i.qty };
      });
      return Object.assign(common(form), { message: field(form, 'message'), manual: field(form, 'manual'), items: items });
    }
  });
})();
