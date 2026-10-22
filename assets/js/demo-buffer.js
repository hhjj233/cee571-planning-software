/* Slides 10, 25, 28: a straight-line buffer versus a walk on the street network.
   Streets every 100 m; a highway with one footbridge; shortest walking distance by Dijkstra. */
Lab.register('demo-buffer', function (root) {
  var s = Lab.s, h = Lab.h, fmt = Lab.fmt;
  var SC = 0.6, OX = 0, OY = 12;           // px per meter, offsets
  var COLS = 17, ROWS = 9, STEP = 100;      // grid nodes every 100 m: 1,600 m x 800 m
  var HWY_ROW = 4;                          // highway between rows 4 (y=400 m) and 5 (y=500 m)
  var STOP = [8, 4];                        // stop at x=800 m, y=400 m
  var RADIUS = 400, SETBACK = 14;
  var state = { view: 'both', bridge: false, wave: RADIUS };
  function px(m) { return OX + m * SC; }
  function py(m) { return OY + m * SC; }
  function nid(c, r) { return r * COLS + c; }

  // edges
  function edges(bridge) {
    var e = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS - 1; c++) e.push([nid(c, r), nid(c + 1, r), 'h']);
    for (var r2 = 0; r2 < ROWS - 1; r2++) for (var c2 = 0; c2 < COLS; c2++) {
      if (r2 === HWY_ROW && !(c2 === 12 || (bridge && c2 === 8))) continue;
      e.push([nid(c2, r2), nid(c2, r2 + 1), r2 === HWY_ROW ? 'bridge' : 'v']);
    }
    return e;
  }
  function xy(n) { return [(n % COLS) * STEP, Math.floor(n / COLS) * STEP]; }
  function dijkstra(E) {
    var n = COLS * ROWS, d = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false), adj = [];
    for (var i = 0; i < n; i++) adj.push([]);
    E.forEach(function (e) { adj[e[0]].push(e[1]); adj[e[1]].push(e[0]); });
    var src = nid(STOP[0], STOP[1]);
    d[src] = 0;
    for (;;) {
      var u = -1, best = Infinity;
      for (var k = 0; k < n; k++) if (!done[k] && d[k] < best) { best = d[k]; u = k; }
      if (u < 0) break;
      done[u] = true;
      adj[u].forEach(function (v) { if (d[u] + STEP < d[v]) { d[v] = d[u] + STEP; prev[v] = u; } });
    }
    return { d: d, prev: prev };
  }

  // homes along street edges (never on the highway crossings)
  var rand = Lab.rng(1010);
  var homes = [];
  edges(false).forEach(function (e) {
    if (e[2] === 'bridge') return;
    var count = rand() < 0.35 ? 2 : rand() < 0.75 ? 1 : 0;
    for (var q = 0; q < count; q++) {
      var t = 0.18 + rand() * 0.64, side = rand() < 0.5 ? -1 : 1;
      var a = xy(e[0]), b = xy(e[1]);
      var x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      if (e[2] === 'h') y += side * SETBACK; else x += side * SETBACK;
      if (y > 420 && y < 480) continue;
      homes.push({ x: x, y: y, u: e[0], v: e[1], t: t });
    }
  });
  var stopXY = [STOP[0] * STEP, STOP[1] * STEP];
  homes.forEach(function (o) { o.straight = Math.hypot(o.x - stopXY[0], o.y - stopXY[1]); });
  var south = homes.filter(function (o) { return o.y > 450; }).sort(function (a, b) { return a.straight - b.straight; });
  var example = south[0];

  // ---------- layout ----------
  var body = Lab.mount(root);
  var bar = h('div', { class: 'demo-bar' }, body);
  var gA = h('div', { class: 'group' }, bar);
  h('span', { class: 'ctl-label', text: 'Show' }, gA);
  var pick = Lab.choice(gA, [
    { value: 'circle', label: '400 m circle' }, { value: 'walk', label: '400 m walk' }, { value: 'both', label: 'Both' }
  ], function (v) { state.view = v; draw(); }, { label: 'What to show', idPrefix: 'buf-view' });
  var gB = h('div', { class: 'group' }, bar);
  var lab = h('label', { class: 'check' }, gB);
  var box = h('input', { type: 'checkbox', id: 'buf-bridge' }, lab);
  lab.appendChild(document.createTextNode('Add a footbridge at the stop'));
  box.addEventListener('change', function () { state.bridge = box.checked; solve(); playWave(); });
  var waveBtn = h('button', { type: 'button', class: 'btn', id: 'buf-wave', text: 'Walk outward from the stop' }, gB);
  waveBtn.addEventListener('click', playWave);

  var stage = h('div', { class: 'stage' }, body);
  var svg = s('svg', { viewBox: '0 0 960 512', role: 'img', 'aria-labelledby': 'buf-svg-t' }, stage);
  var svgTitle = s('title', { id: 'buf-svg-t' }, svg);
  var gStreets = s('g', null, svg);
  var gWalk = s('g', null, svg);
  var gHwy = s('g', null, svg);
  var gCircle = s('g', null, svg);
  var gHomes = s('g', null, svg);
  var gEx = s('g', null, svg);
  var gTop = s('g', null, svg);

  edges(true).forEach(function (e) {
    if (e[2] === 'bridge') return;
    var a = xy(e[0]), b = xy(e[1]);
    s('line', { x1: px(a[0]), y1: py(a[1]), x2: px(b[0]), y2: py(b[1]), class: 'buf-street' }, gStreets);
  });
  s('rect', { x: 0, y: py(428), width: 960, height: 44 * SC, class: 'buf-hwy' }, gHwy);
  s('text', { x: 12, y: py(450) + 4, class: 't-small buf-hwy-t', text: 'Highway, no sidewalk crossing' }, gHwy);
  var bridges = s('g', null, gHwy);
  var circle = s('circle', { cx: px(stopXY[0]), cy: py(stopXY[1]), r: RADIUS * SC, class: 'buf-circle' }, gCircle);
  var homeEls = homes.map(function (o) { return s('rect', { x: px(o.x) - 2.6, y: py(o.y) - 2.6, width: 5.2, height: 5.2, rx: 1, class: 'buf-home' }, gHomes); });
  s('circle', { cx: px(stopXY[0]), cy: py(stopXY[1]), r: 7, class: 'stop' }, gTop);
  s('text', { x: px(stopXY[0]) + 11, y: py(stopXY[1]) - 9, class: 't-strong t-halo', text: 'Bus stop' }, gTop);

  var legend = h('div', { class: 'legend' }, body);
  var ro = h('div', { class: 'readouts' }, body);
  function readout(k) { var d = h('div', { class: 'readout' }, ro); h('div', { class: 'k', text: k }, d); return { v: h('div', { class: 'v' }, d), s: h('div', { class: 's' }, d) }; }
  var rC = readout('Homes inside the circle'), rW = readout('Homes within a 400 m walk'), rM = readout('Circle overstates access by'), rE = readout('Marked home');

  var D = null;
  function walkDist(o) { return Math.min(D.d[o.u] + o.t * STEP, D.d[o.v] + (1 - o.t) * STEP) + SETBACK; }
  function solve() {
    D = dijkstra(edges(state.bridge));
    homes.forEach(function (o) { o.walk = walkDist(o); });
    while (bridges.firstChild) bridges.firstChild.remove();
    [12].concat(state.bridge ? [8] : []).forEach(function (c) {
      var x = px(c * STEP);
      s('rect', { x: x - 5, y: py(400), width: 10, height: 100 * SC, class: 'buf-bridge' }, bridges);
      s('text', { x: x + 9, y: py(420), class: 't-small t-halo', text: c === 12 ? 'footbridge' : 'new footbridge' }, bridges);
    });
    var nC = 0, nW = 0, nM = 0;
    homes.forEach(function (o) { var c = o.straight <= RADIUS, w = o.walk <= RADIUS; if (c) nC++; if (w) nW++; if (c && !w) nM++; });
    rC.v.textContent = fmt.int(nC);
    rC.s.textContent = 'straight-line distance up to 400 m';
    rW.v.textContent = fmt.int(nW);
    rW.s.textContent = 'shortest path on streets and bridges';
    rM.v.textContent = fmt.int(nM) + ' homes';
    rM.s.textContent = nC ? fmt.pct(nM / nC) + ' of the homes the circle counts' : '';
    rE.v.innerHTML = fmt.int(example.walk) + ' <small>m on foot</small>';
    rE.s.textContent = fmt.int(example.straight) + ' m in a straight line';
    svgTitle.textContent = 'Street grid with a bus stop beside a highway. ' + nC + ' homes lie inside the 400 meter circle; ' + nW + ' are within a 400 meter walk.';
    draw();
  }
  function examplePath() {
    var pts = [[example.x, example.y]];
    var viaU = D.d[example.u] + example.t * STEP <= D.d[example.v] + (1 - example.t) * STEP;
    var n = viaU ? example.u : example.v;
    var foot = xy(n);
    pts.push(foot[0] === xy(example.u)[0] && foot[0] === xy(example.v)[0] ? [foot[0], example.y] : [example.x, foot[1]]);
    while (n !== -1) { pts.push(xy(n)); n = D.prev[n]; }
    return pts;
  }
  function draw() {
    pick.set(state.view);
    var showC = state.view !== 'walk', showW = state.view !== 'circle';
    gCircle.style.display = showC ? '' : 'none';
    while (gWalk.firstChild) gWalk.firstChild.remove();
    if (showW) {
      var lim = Math.min(RADIUS, state.wave);
      edges(state.bridge).forEach(function (e) {
        var a = xy(e[0]), b = xy(e[1]);
        [[e[0], a, b], [e[1], b, a]].forEach(function (end) {
          var reach = lim - D.d[end[0]];
          if (reach <= 0) return;
          var f = Math.min(1, reach / STEP), p = end[1], q = end[2];
          s('line', { x1: px(p[0]), y1: py(p[1]), x2: px(p[0] + (q[0] - p[0]) * f), y2: py(p[1] + (q[1] - p[1]) * f), class: 'buf-walk' }, gWalk);
        });
      });
    }
    homes.forEach(function (o, i) {
      var c = o.straight <= RADIUS, w = o.walk <= Math.min(RADIUS, state.wave), cls = '';
      if (state.view === 'circle') cls = c ? ' is-circle' : '';
      else if (state.view === 'walk') cls = w ? ' is-walk' : '';
      else cls = w ? ' is-walk' : (c && state.wave >= RADIUS ? ' is-miss' : '');
      homeEls[i].setAttribute('class', 'buf-home' + cls);
    });
    legend.innerHTML = state.view === 'circle'
      ? '<span class="item"><i class="swatch sw-ink"></i>home inside the 400 m circle</span><span class="item"><i class="swatch buf-sw-out"></i>other homes</span>'
      : '<span class="item"><i class="swatch sw-walk"></i>home within a 400 m walk</span>' + (state.view === 'both' ? '<span class="item"><i class="swatch sw-orange"></i>inside the circle, but more than 400 m on foot</span>' : '') + '<span class="item"><i class="swatch buf-sw-out"></i>other homes</span><span class="item"><i class="swatch buf-sw-walk"></i>streets reachable within 400 m</span>';
    while (gEx.firstChild) gEx.firstChild.remove();
    if (state.wave >= RADIUS) {
      var pts = examplePath().map(function (p) { return [px(p[0]), py(p[1])]; });
      if (showW) s('polyline', { points: Lab.pointsAttr(pts), class: 'buf-path' }, gEx);
      s('line', { x1: px(stopXY[0]), y1: py(stopXY[1]), x2: px(example.x), y2: py(example.y), class: 'buf-crow' }, gEx);
      s('circle', { cx: px(example.x), cy: py(example.y), r: 7, class: 'buf-ex' }, gEx);
      s('text', { x: px(example.x) + 10, y: py(example.y) + 18, class: 't-strong t-halo', text: 'Marked home' }, gEx);
    }
  }
  var waving = false;
  function playWave() {
    if (Lab.reducedMotion.matches) { state.wave = RADIUS; draw(); return; }
    state.wave = 0; waving = true; lp.setPaused(false);
  }
  var lp = Lab.loop(root, function (dt) {
    if (!waving) return;
    state.wave = Math.min(RADIUS, state.wave + dt * 170);
    if (state.wave >= RADIUS) waving = false;
    draw();
  });
  solve();
});
