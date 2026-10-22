/* Shared helpers for the CEE 571 lecture companion.
   Every demo registers itself with Lab.register(id, setup); setup runs once the page has loaded. */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function setAttrs(el, a) {
    if (!a) return el;
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    return el;
  }
  function s(tag, a, parent) {
    var el = setAttrs(document.createElementNS(SVGNS, tag), a);
    if (parent) parent.appendChild(el);
    return el;
  }
  function h(tag, a, parent) {
    var el = setAttrs(document.createElement(tag), a);
    if (parent) parent.appendChild(el);
    return el;
  }

  var MINUS = '−';
  var fmt = {
    int: function (n) { var r = Math.round(n); return (r < 0 ? MINUS : '') + Math.abs(r).toLocaleString('en-US'); },
    dec: function (n, d) { d = d === undefined ? 1 : d; var t = Math.abs(n).toFixed(d); return (n < 0 && Number(t) !== 0 ? MINUS : '') + t; },
    pct: function (n, d) { return (n * 100).toFixed(d === undefined ? 0 : d) + '%'; },
    money: function (n) { return '$' + Math.round(n).toLocaleString('en-US'); },
    signed: function (n, d) {
      d = d === undefined ? 1 : d;
      var t = Math.abs(n).toFixed(d);
      if (Number(t) === 0) return '±0';
      return (n > 0 ? '+' : MINUS) + t;
    }
  };

  // Small seeded random generator (mulberry32) so examples repeat exactly.
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // BPR link performance function: t = t0 * (1 + alpha * (v/c)^beta)
  function bpr(t0, v, c, alpha, beta) {
    alpha = alpha === undefined ? 0.15 : alpha;
    beta = beta === undefined ? 4 : beta;
    return t0 * (1 + alpha * Math.pow(v / c, beta));
  }

  function vcClass(vc) { return vc < 0.7 ? 'vc0' : vc < 0.9 ? 'vc1' : vc <= 1.0 ? 'vc2' : 'vc3'; }
  function vcWords(vc) { return vc < 0.7 ? 'free-flowing' : vc < 0.9 ? 'busy' : vc <= 1.0 ? 'near capacity' : 'over capacity'; }

  // A polyline you can walk along: path(points).at(distance) -> [x, y]
  function path(points) {
    var segs = [], total = 0;
    for (var i = 1; i < points.length; i++) {
      var a = points[i - 1], b = points[i];
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      segs.push({ a: a, b: b, len: len, start: total });
      total += len;
    }
    return {
      length: total,
      points: points,
      at: function (d) {
        if (!segs.length) return points[0];
        if (d <= 0) return points[0];
        if (d >= total) return points[points.length - 1];
        var lo = 0, hi = segs.length - 1;
        while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (segs[mid].start <= d) lo = mid; else hi = mid - 1; }
        var g = segs[lo], f = g.len ? (d - g.start) / g.len : 0;
        return [g.a[0] + (g.b[0] - g.a[0]) * f, g.a[1] + (g.b[1] - g.a[1]) * f];
      }
    };
  }
  function pointsAttr(pts) { return pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }

  // Animation loop that runs only while its demo is on screen and not paused.
  // Starts paused when the reader prefers reduced motion.
  function loop(root, frame) {
    var raf = 0, last = 0, visible = false, running = false, paused = !!motionQuery.matches;
    var listeners = [];
    function tick(t) {
      var dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      frame(dt);
      if (running) raf = requestAnimationFrame(tick);
    }
    function sync() {
      var go = visible && !paused && !document.hidden;
      if (go && !running) { running = true; last = 0; raf = requestAnimationFrame(tick); }
      else if (!go && running) { running = false; cancelAnimationFrame(raf); }
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries.some(function (e) { return e.isIntersecting; });
        sync();
      }, { threshold: 0.02 }).observe(root);
    } else { visible = true; }
    document.addEventListener('visibilitychange', sync);
    var api = {
      get paused() { return paused; },
      setPaused: function (p) { paused = !!p; sync(); listeners.forEach(function (f) { f(paused); }); },
      onChange: function (f) { listeners.push(f); }
    };
    sync();
    return api;
  }

  function playButton(lp, parent) {
    var b = h('button', { type: 'button', class: 'btn play' }, parent);
    function render() {
      b.textContent = lp.paused ? '▶︎ Play' : '❚❚ Pause';
      b.setAttribute('aria-label', lp.paused ? 'Play the animation' : 'Pause the animation');
    }
    b.addEventListener('click', function () { lp.setPaused(!lp.paused); });
    lp.onChange(render);
    render();
    return b;
  }

  // Row of toggle buttons. options: [{value, label}]. Returns {el, set(value)}.
  function choice(parent, options, onPick, opts) {
    opts = opts || {};
    var wrap = h('div', { class: 'seg', role: 'group', 'aria-label': opts.label || null }, parent);
    var btns = options.map(function (o) {
      var b = h('button', {
        type: 'button', class: 'seg-btn', 'aria-pressed': 'false', 'data-value': o.value,
        id: opts.idPrefix ? opts.idPrefix + '-' + o.value : null, title: o.title || null
      }, wrap);
      b.innerHTML = o.label;
      b.addEventListener('click', function () { set(o.value); onPick(o.value); });
      return b;
    });
    function set(v) { btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-value') === String(v))); }); }
    return { el: wrap, set: set, buttons: btns };
  }

  // Labeled range input with live output. Returns the input element.
  function slider(parent, o) {
    var box = h('div', { class: 'slider' }, parent);
    var row = h('div', { class: 'row' }, box);
    h('label', { class: 'ctl-label', for: o.id, text: o.label }, row);
    var out = h('output', { for: o.id }, row);
    var inp = h('input', { type: 'range', id: o.id, min: o.min, max: o.max, step: o.step, value: o.value }, box);
    function show() { out.textContent = o.format ? o.format(Number(inp.value)) : inp.value; }
    inp.addEventListener('input', function () { show(); o.onInput(Number(inp.value)); });
    show();
    inp.refresh = show;
    return inp;
  }

  // Insert demo content above the figure's caption (captions stay in the HTML).
  function mount(root) {
    var box = h('div', { class: 'demo-body' });
    var cap = root.querySelector(':scope > figcaption');
    if (cap) root.insertBefore(box, cap); else root.appendChild(box);
    return box;
  }

  var registry = [];
  function register(id, setup) { registry.push([id, setup]); }
  function boot() {
    registry.forEach(function (entry) {
      var root = document.getElementById(entry[0]);
      if (!root) return;
      try { entry[1](root); }
      catch (err) {
        if (window.console) console.error(err);
        h('p', { class: 'demo-error', text: 'This demo could not start (' + err.message + '). Reload the page to try again.' }, root);
      }
    });
    setupRoute();
    // Demos change the page height as they build, so land on a linked section again.
    if (location.hash.length > 1) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) window.setTimeout(function () { target.scrollIntoView({ block: 'start' }); }, 60);
    }
  }

  // Highlight the current section in the route rail.
  function setupRoute() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.route a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && byId[e.target.id]) {
          links.forEach(function (a) { a.removeAttribute('aria-current'); });
          byId[e.target.id].setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else window.setTimeout(boot, 0);

  window.Lab = {
    s: s, h: h, fmt: fmt, rng: rng, bpr: bpr, vcClass: vcClass, vcWords: vcWords,
    path: path, pointsAttr: pointsAttr, loop: loop, playButton: playButton, choice: choice,
    slider: slider, mount: mount, register: register, reducedMotion: motionQuery,
    clamp: function (x, a, b) { return Math.max(a, Math.min(b, x)); },
    lerp: function (a, b, t) { return a + (b - a) * t; }
  };
})();
