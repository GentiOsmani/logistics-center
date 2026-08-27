/**
 * Part-number suggestions — the only client-side script on the public site.
 * Pure progressive enhancement: without it the search form still submits and
 * returns the same ranked results from the server.
 */
(function () {
  var inputs = document.querySelectorAll('input[data-suggest]');
  if (!inputs.length || !window.fetch) return;

  Array.prototype.forEach.call(inputs, function (input) {
    var box = document.getElementById(input.id + '-suggest');
    if (!box) return;

    var timer = null;
    var controller = null;
    var last = '';

    function close() {
      box.hidden = true;
      box.textContent = '';
    }

    function render(items) {
      box.textContent = '';
      if (!items.length) return close();
      var frag = document.createDocumentFragment();
      items.forEach(function (item) {
        var a = document.createElement('a');
        a.href = item.url;
        var pn = document.createElement('span');
        pn.className = 'part';
        pn.textContent = item.pn;
        var name = document.createElement('span');
        name.className = 'suggest-name';
        name.textContent = item.name;
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
      timer = setTimeout(function () {
        if (q === last) return;
        last = q;
        if (controller) controller.abort();
        controller = new AbortController();
        fetch(input.dataset.suggest + '?q=' + encodeURIComponent(q), {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
          .then(function (res) { return res.ok ? res.json() : []; })
          .then(render)
          .catch(function () { /* aborted or offline — form still works */ });
      }, 180);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    input.addEventListener('blur', function () {
      setTimeout(close, 160);
    });
  });
})();
