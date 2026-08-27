/**
 * Client-side search, typeahead and catalogue filtering — replaces the
 * server-side FTS5 search (src/db/repo/products.js#searchProductIds) and the
 * GET /products query-param handling (src/routes/public.js), since the
 * static site has no server to run either against. The whole catalogue is
 * only ~40 products, so this runs instantly over the bundled index rather
 * than needing a real search backend.
 *
 * Two independent pieces:
 *   1. Typeahead on any input[data-suggest] (home page hero, band section,
 *      the /products search box) — present on every page via searchbar().
 *   2. In-place filter/sort of the already-rendered .prod-card grid on the
 *      /products page specifically (detected by the presence of .filters).
 *
 * Depends on window.LC from cart.js (loaded first).
 */
(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function rank(index, query, limit) {
    var norm = window.LC.normalizePart(query);
    var seen = {};
    var out = [];
    function push(list) {
      for (var i = 0; i < list.length && out.length < limit; i++) {
        var p = list[i];
        if (seen[p.id]) continue;
        seen[p.id] = true;
        out.push(p);
      }
    }
    if (norm.length >= 2) {
      push(index.filter(function (p) { return p.part_norm === norm; }));
      push(index.filter(function (p) { return p.refs && p.refs.indexOf(norm) !== -1; }));
      push(index.filter(function (p) { return p.part_norm.indexOf(norm) === 0; })
        .sort(function (a, b) { return a.part_norm.length - b.part_norm.length; }));
      push(index.filter(function (p) { return p.refs && p.refs.some(function (r) { return r.indexOf(norm) === 0; }); }));
    }
    if (out.length < limit) {
      var terms = String(query).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (s) { return s.length > 1; });
      if (terms.length) {
        push(index.filter(function (p) {
          var hay = (p.name_sq + ' ' + p.name_en + ' ' + p.summary_sq + ' ' + p.summary_en + ' '
            + p.brand_name + ' ' + p.category_name_sq + ' ' + p.category_name_en).toLowerCase();
          return terms.every(function (term) { return hay.indexOf(term) !== -1; });
        }));
      }
    }
    return out;
  }

  /* ------------------------------------------------------------ typeahead */

  function wireSuggest(LC, index) {
    var inputs = document.querySelectorAll('input[data-suggest]');
    Array.prototype.forEach.call(inputs, function (input) {
      var box = document.getElementById(input.id + '-suggest');
      if (!box) return;
      var timer = null;

      function close() { box.hidden = true; box.textContent = ''; }
      function render(items) {
        box.textContent = '';
        if (!items.length) return close();
        var frag = document.createDocumentFragment();
        items.forEach(function (p) {
          var a = document.createElement('a');
          a.href = LC.L('/products/' + p.slug);
          var pn = document.createElement('span');
          pn.className = 'part';
          pn.textContent = p.part_number;
          var name = document.createElement('span');
          name.className = 'suggest-name';
          name.textContent = [p.brand_name, LC.productName(p)].filter(Boolean).join(' · ');
          a.appendChild(pn);
          a.appendChild(name);
          frag.appendChild(a);
        });
        box.appendChild(frag);
        box.hidden = false;
      }

      input.addEventListener('input', function () {
        clearTimeout(timer);
        var q = input.value.trim();
        if (q.length < 2) return close();
        timer = setTimeout(function () { render(rank(index, q, 8)); }, 120);
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      input.addEventListener('blur', function () { setTimeout(close, 160); });
    });
  }

  /* --------------------------------------------------------------- filter */

  function wireCatalogue(LC, index) {
    var filtersEl = document.querySelector('.filters');
    var grid = document.querySelector('.grid-3, .grid-4');
    if (!filtersEl || !grid) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.prod-card'));
    var byPart = {};
    cards.forEach(function (card) {
      var el = card.querySelector('.prod-part');
      if (el) byPart[el.textContent.trim()] = card;
    });

    var countEl = document.querySelector('.toolbar-count strong');
    var params = new URLSearchParams(location.search);
    var state = {
      q: params.get('q') || '',
      category: params.get('category') || '',
      brand: params.get('brand') || '',
      availability: params.get('availability') || '',
      sort: params.get('sort') || 'relevance',
    };

    function matches(product) {
      if (state.category && product.category_slug !== state.category) return false;
      if (state.brand && product.brand_slug !== state.brand) return false;
      if (state.availability && product.availability !== state.availability) return false;
      return true;
    }

    function apply() {
      var pool = index.filter(matches);
      var ordered;
      if (state.q) {
        var ranked = rank(pool, state.q, pool.length);
        var rankedIds = {};
        ranked.forEach(function (p, i) { rankedIds[p.id] = i; });
        ordered = pool.filter(function (p) { return rankedIds[p.id] !== undefined; })
          .sort(function (a, b) { return rankedIds[a.id] - rankedIds[b.id]; });
      } else {
        ordered = pool.slice();
        if (state.sort === 'newest') ordered.sort(function (a, b) { return b.id - a.id; });
        else if (state.sort === 'part') ordered.sort(function (a, b) { return a.part_number.localeCompare(b.part_number); });
        else if (state.sort === 'name_' + LC.locale) ordered.sort(function (a, b) { return LC.productName(a).localeCompare(LC.productName(b)); });
        else ordered.sort(function (a, b) { return (b.is_featured - a.is_featured) || (b.id - a.id); });
      }

      var visible = {};
      ordered.forEach(function (p, i) {
        var card = byPart[p.part_number];
        if (!card) return;
        visible[p.part_number] = true;
        card.style.order = String(i);
        card.style.display = '';
      });
      cards.forEach(function (card) {
        var pn = (card.querySelector('.prod-part') || {}).textContent;
        if (!visible[(pn || '').trim()]) card.style.display = 'none';
      });

      if (countEl) countEl.textContent = String(ordered.length);

      var url = new URL(location.href);
      ['q', 'category', 'brand', 'availability', 'sort'].forEach(function (key) {
        if (state[key] && !(key === 'sort' && state[key] === 'relevance')) url.searchParams.set(key, state[key]);
        else url.searchParams.delete(key);
      });
      history.replaceState(null, '', url.pathname + url.search);
    }

    // Facet links, active-filter pills and "clear filters" all live inside
    // .filters or .active-filters as plain <a href="?key=value"> — original
    // server-driven navigation. Intercept any of them pointing at this same
    // page instead of following the link.
    document.addEventListener('click', function (event) {
      var a = event.target.closest && event.target.closest('a');
      if (!a) return;
      var activeFilters = document.querySelector('.active-filters');
      var inScope = filtersEl.contains(a) || (activeFilters && activeFilters.contains(a));
      if (!inScope) return;
      var url;
      try { url = new URL(a.href, location.href); } catch (e) { return; }
      if (url.pathname !== location.pathname) return;
      event.preventDefault();
      var p = new URLSearchParams(url.search);
      state.q = p.get('q') || '';
      state.category = p.get('category') || '';
      state.brand = p.get('brand') || '';
      state.availability = p.get('availability') || '';
      apply();
    });

    var toolbarForm = document.querySelector('.toolbar form');
    if (toolbarForm) {
      toolbarForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var sortSelect = toolbarForm.querySelector('[name=sort]');
        state.sort = sortSelect ? sortSelect.value : 'relevance';
        apply();
      });
    }

    var searchForm = document.querySelector('.searchbar');
    if (searchForm && searchForm.closest('.wrap') && filtersEl) {
      searchForm.addEventListener('submit', function (event) {
        var input = searchForm.querySelector('input[name=q]');
        if (!input) return;
        event.preventDefault();
        state.q = input.value.trim();
        apply();
      });
    }

    apply();
  }

  ready(function () {
    if (!window.LC) return;
    window.LC.loadIndex().then(function (index) {
      wireSuggest(window.LC, index);
      wireCatalogue(window.LC, index);
    });
  });
})();
