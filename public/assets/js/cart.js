/**
 * Quote basket, moved entirely client-side (localStorage) since the static
 * site has no server to hold a cart cookie/row against. Also sets up the
 * shared `window.LC` namespace (catalogue index loader + a tiny i18n subset)
 * that catalogue.js and forms.js reuse — this file must load first, which
 * it does simply by being listed first among the `defer` scripts the
 * generator injects (see build/generate.js's RUNTIME_TAGS).
 */
(function () {
  var SITE = window.__SITE__ || { basePath: '', workerOrigin: '' };
  var LOCALE = document.documentElement.lang === 'en' ? 'en' : 'sq';
  var CART_KEY = 'lc_cart_v1';

  var STRINGS = {
    sq: {
      avail_in_stock: 'Në stok', avail_lead_time: 'Sipas afatit', avail_on_request: 'Sipas kërkesës',
      lead_days: 'ditë pune', part_number: 'Numri i pjesës', product: 'Produkti', availability: 'Disponueshmëria',
      qty: 'Sasia', remove: 'Hiq', update: 'Përditëso', clear_list: 'Pastro listën',
      quote_empty: 'Lista juaj është bosh',
      quote_empty_d: 'Shtoni produkte nga katalogu, ose shkruani numrat e pjesëve direkt në formular.',
      nav_products: 'Produkte', request_quote: 'Kërko ofertë',
      quote_sent_t: 'Kërkesa u dërgua', quote_sent_d: 'Referenca e kërkesës suaj është',
      quote_sent_note: 'Ekipi ynë komercial do t’ju kontaktojë brenda një dite pune me çmimet dhe afatet.',
      support_sent_t: 'Kërkesa u regjistrua',
      support_sent_note: 'Për raste "linja ka ndaluar", na telefononi drejtpërdrejt për ndërhyrje të menjëhershme.',
      contact_sent_t: 'Mesazhi u dërgua', contact_sent_d: 'Faleminderit. Ju kthejmë përgjigje sa më shpejt.',
      err_required: 'Kjo fushë është e detyrueshme', err_email: 'Adresa e email-it nuk është e vlefshme',
      err_generic: 'Ju lutemi kontrolloni fushat e shënuara', err_rate: 'Shumë kërkesa. Provoni sërish pas pak.',
    },
    en: {
      avail_in_stock: 'In stock', avail_lead_time: 'On lead time', avail_on_request: 'On request',
      lead_days: 'working days', part_number: 'Part number', product: 'Product', availability: 'Availability',
      qty: 'Qty', remove: 'Remove', update: 'Update', clear_list: 'Clear list',
      quote_empty: 'Your list is empty',
      quote_empty_d: 'Add products from the catalogue, or type part numbers directly into the form.',
      nav_products: 'Products', request_quote: 'Request a quote',
      quote_sent_t: 'Request sent', quote_sent_d: 'Your request reference is',
      quote_sent_note: 'Our sales team will contact you within one working day with prices and lead times.',
      support_sent_t: 'Request registered',
      support_sent_note: 'For "line is down" cases, call us directly for immediate intervention.',
      contact_sent_t: 'Message sent', contact_sent_d: 'Thank you. We will get back to you as soon as possible.',
      err_required: 'This field is required', err_email: 'The email address is not valid',
      err_generic: 'Please check the highlighted fields', err_rate: 'Too many requests. Please try again shortly.',
    },
  };

  function t(key) { return STRINGS[LOCALE][key] || key; }

  function L(path) { return SITE.basePath + '/' + LOCALE + path; }

  function normalizePart(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  var indexPromise = null;
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(SITE.basePath + '/catalog-index.json')
        .then(function (res) { return res.json(); })
        .catch(function () { return []; });
    }
    return indexPromise;
  }

  function findByPartNumber(index, value) {
    var norm = normalizePart(value);
    if (!norm) return null;
    for (var i = 0; i < index.length; i++) {
      if (index[i].part_norm === norm) return index[i];
    }
    for (var j = 0; j < index.length; j++) {
      if (index[j].refs && index[j].refs.indexOf(norm) !== -1) return index[j];
    }
    return null;
  }

  function productName(p) { return (LOCALE === 'en' ? p.name_en : p.name_sq) || p.name_en || p.name_sq || ''; }

  /* ------------------------------------------------------------------ cart */

  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { return []; }
  }
  function writeCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) { /* storage unavailable */ }
    updateBadge(items);
  }
  function updateBadge(items) {
    items = items || readCart();
    var pill = document.querySelector('.quote-pill');
    if (!pill) return;
    var count = items.reduce(function (n, i) { return n + (i.qty || 1); }, 0);
    var badge = pill.querySelector('.quote-count');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'quote-count';
        pill.appendChild(badge);
      }
      badge.textContent = String(count);
    } else if (badge) {
      badge.remove();
    }
  }

  function addToCart(index, partNumber, qty) {
    var items = readCart();
    var product = findByPartNumber(index, partNumber);
    var existing = items.filter(function (i) { return i.part_number === (product ? product.part_number : partNumber); })[0];
    if (existing) {
      existing.qty = Math.min(existing.qty + qty, 9999);
    } else {
      items.push({
        part_number: product ? product.part_number : partNumber,
        product_id: product ? product.id : null,
        slug: product ? product.slug : null,
        title: product ? productName(product) : '',
        brand_name: product ? product.brand_name : '',
        availability: product ? product.availability : 'on_request',
        lead_time_days: product ? product.lead_time_days : 0,
        qty: Math.max(1, Math.min(qty, 9999)),
      });
    }
    writeCart(items);
    return items;
  }

  function setQty(items, partNumber, qty) {
    if (qty <= 0) return items.filter(function (i) { return i.part_number !== partNumber; });
    return items.map(function (i) { return i.part_number === partNumber ? Object.assign({}, i, { qty: qty }) : i; });
  }

  /* ------------------------------------------------------------ rendering */

  function chipHtml(item) {
    if (item.availability === 'in_stock') return '<span class="chip chip-dot chip-stock">' + t('avail_in_stock') + '</span>';
    if (item.availability === 'lead_time') {
      var days = item.lead_time_days ? ' ' + item.lead_time_days + ' ' + t('lead_days') : '';
      return '<span class="chip chip-dot chip-lead">' + t('avail_lead_time') + days + '</span>';
    }
    return '<span class="chip chip-dot chip-order">' + t('avail_on_request') + '</span>';
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderQuoteItems() {
    var container = document.getElementById('quote-items');
    if (!container) return;
    var items = readCart();

    if (!items.length) {
      container.innerHTML =
        '<div class="empty ta-left">' +
        '<h3>' + esc(t('quote_empty')) + '</h3>' +
        '<p class="muted">' + esc(t('quote_empty_d')) + '</p>' +
        '<a class="btn btn-outline" href="' + L('/products') + '">' + esc(t('nav_products')) + '</a>' +
        '</div>';
      return;
    }

    var rows = items.map(function (item) {
      var nameCell = item.slug
        ? '<a class="part" href="' + L('/products/' + item.slug) + '">' + esc(item.part_number) + '</a>'
        : '<span class="part">' + esc(item.part_number) + '</span>';
      return (
        '<tr>' +
        '<td>' + nameCell + '</td>' +
        '<td>' + esc(item.title || '—') + (item.brand_name ? '<br><span class="prod-brand">' + esc(item.brand_name) + '</span>' : '') + '</td>' +
        '<td>' + chipHtml(item) + '</td>' +
        '<td class="qty-cell">' +
        '<form data-cart-update class="row row-xs">' +
        '<input type="hidden" name="part_number" value="' + esc(item.part_number) + '">' +
        '<input class="input" type="number" name="qty" value="' + item.qty + '" min="1" max="9999" inputmode="numeric">' +
        '<button class="btn btn-outline btn-sm" type="submit">' + esc(t('update')) + '</button>' +
        '</form></td>' +
        '<td class="act-cell">' +
        '<form data-cart-remove>' +
        '<input type="hidden" name="part_number" value="' + esc(item.part_number) + '">' +
        '<button class="icon-btn" type="submit" title="' + esc(t('remove')) + '">✕</button>' +
        '</form></td>' +
        '</tr>'
      );
    }).join('');

    container.innerHTML =
      '<table class="quote-table"><thead><tr>' +
      '<th>' + esc(t('part_number')) + '</th><th>' + esc(t('product')) + '</th>' +
      '<th>' + esc(t('availability')) + '</th><th>' + esc(t('qty')) + '</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="row row-end mt-4"><form data-cart-clear>' +
      '<button class="btn btn-outline btn-sm" type="submit">' + esc(t('clear_list')) + '</button>' +
      '</form></div>';
  }

  /* ------------------------------------------------------------- wiring */

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    var action = form.getAttribute('action') || '';

    if (/\/quote\/add$/.test(action)) {
      event.preventDefault();
      var partNumber = (form.querySelector('[name=part_number]') || {}).value || '';
      var qtyInput = form.querySelector('[name=qty]');
      var qty = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;
      loadIndex().then(function (index) {
        addToCart(index, partNumber, qty);
        var redirect = (form.querySelector('[name=redirect]') || {}).value;
        if (redirect) window.location.href = redirect;
      });
      return;
    }

    if (/\/quote\/clear$/.test(action) || form.hasAttribute('data-cart-clear')) {
      event.preventDefault();
      writeCart([]);
      renderQuoteItems();
      return;
    }

    if (/\/quote\/update$/.test(action) || form.hasAttribute('data-cart-update')) {
      event.preventDefault();
      var upPart = (form.querySelector('[name=part_number]') || {}).value || '';
      var upQty = parseInt((form.querySelector('[name=qty]') || {}).value, 10);
      writeCart(setQty(readCart(), upPart, Number.isFinite(upQty) ? upQty : 1));
      renderQuoteItems();
      return;
    }

    if (/\/quote\/remove$/.test(action) || form.hasAttribute('data-cart-remove')) {
      event.preventDefault();
      var rmPart = (form.querySelector('[name=part_number]') || {}).value || '';
      writeCart(readCart().filter(function (i) { return i.part_number !== rmPart; }));
      renderQuoteItems();
      return;
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    updateBadge();
    renderQuoteItems();
  });

  window.LC = {
    site: SITE, locale: LOCALE, t: t, L: L, esc: esc,
    loadIndex: loadIndex, findByPartNumber: findByPartNumber, normalizePart: normalizePart, productName: productName,
    readCart: readCart, writeCart: writeCart, renderQuoteItems: renderQuoteItems, updateBadge: updateBadge,
  };
})();
