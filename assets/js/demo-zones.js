/* Slides 19, 20, 22: zone size. Coarse zones hide local differences; fine zones grow the trip tables.
   Distances on a street grid (|dx| + |dy|). Every home in a zone gets its zone centroid's distance in the model. */
Lab.register('demo-zones', function (root) {
  var s = Lab.s, h = Lab.h, fmt = Lab.fmt;
  var SIZE = 1600, SC = 500 / SIZE, O = 10;
  var STOP = [1500, 760], HOME = [450, 300], SHOP = [700, 560];
  var st = { n: 2, colorBy: 'actual' };
  function px(m) { return O + m * SC; }

  // homes in a few neighborhoods (seeded, so every visit shows the same town)
  var rand = Lab.rng(2026);
  var CL = [[300, 280, 170, 55], [760, 260, 150, 40], [1240, 340, 160, 45], [380, 1040, 190, 50], [980, 900, 160, 45], [1300, 1260, 150, 35]];
  var homes = [];
  function gauss() { var u = 1 - rand(), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  CL.forEach(function (c) {
    for (var i = 0; i < c[3]; i++) {
      var x = Lab.clamp(c[0] + gauss() * c[2] * 0.6, 30, SIZE - 30), y = Lab.clamp(c[1] + gauss() * c[2] * 0.6, 30, SIZE - 30);
      homes.push({ x: x, y: y });
    }
  });
  for (var k = 0; k < 40; k++) homes.push({ x: 30 + rand() * (SIZE - 60), y: 30 + rand() * (SIZE - 60) });
  function dist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
  homes.forEach(function (o) { o.actual = dist([o.x, o.y], STOP); });

  var body = Lab.mount(root);
  var bar = h('div', { class: 'demo-bar' }, body);
  var gA = h('div', { class: 'group' }, bar);
  h('span', { class: 'ctl-label', text: 'Zones' }, gA);
  var pick = Lab.choice(gA, [
    { value: 1, label: '1' }, { value: 2, label: '4 macrozones' }, { value: 4, label: '16 microzones' }, { value: 8, label: '64 microzones' }
  ], function (v) { st.n = Number(v); draw(); }, { label: 'Number of zones', idPrefix: 'zn-n' });
  var gB = h('div', { class: 'group' }, bar);
  h('span', { class: 'ctl-label', text: 'Color homes by' }, gB);
  var pickC = Lab.choice(gB, [{ value: 'actual', label: 'Actual walk to stop' }, { value: 'model', label: 'What the model assumes' }],
    function (v) { st.colorBy = v; draw(); }, { label: 'Color homes by', idPrefix: 'zn-c' });

  var split = h('div', { class: 'split zn-split' }, body);
  var stage = h('div', { class: 'stage narrow-ok' }, split);
  var svg = s('svg', { viewBox: '0 0 520 520', role: 'img', 'aria-labelledby': 'zn-svg-t' }, stage);
  var svgTitle = s('title', { id: 'zn-svg-t' }, svg);
  s('rect', { x: O, y: O, width: 500, height: 500, class: 'zn-ground' }, svg);
  for (var g = 200; g < SIZE; g += 200) {
    s('line', { x1: px(g), y1: O, x2: px(g), y2: O + 500, class: 'zn-street' }, svg);
    s('line', { x1: O, y1: px(g), x2: O + 500, y2: px(g), class: 'zn-street' }, svg);
  }
  var gHomes = s('g', null, svg);
  var homeEls = homes.map(function (o) { return s('circle', { cx: px(o.x), cy: px(o.y), r: 3.2, class: 'zn-home' }, gHomes); });
  var gLines = s('g', null, svg);
  var gCent = s('g', null, svg);
  var gTop = s('g', null, svg);
  s('rect', { x: O, y: O, width: 500, height: 500, class: 'zn-frame' }, gTop);
  var trip = s('line', { x1: px(HOME[0]), y1: px(HOME[1]), x2: px(SHOP[0]), y2: px(SHOP[1]), class: 'zn-trip' }, gTop);
  s('circle', { cx: px(HOME[0]), cy: px(HOME[1]), r: 6, class: 'zn-mark' }, gTop);
  s('text', { x: px(HOME[0]) - 9, y: px(HOME[1]) - 9, 'text-anchor': 'end', class: 't-strong t-halo', text: 'Home' }, gTop);
  s('rect', { x: px(SHOP[0]) - 6, y: px(SHOP[1]) - 6, width: 12, height: 12, rx: 2, class: 'zn-mark' }, gTop);
  s('text', { x: px(SHOP[0]) + 10, y: px(SHOP[1]) + 16, class: 't-strong t-halo', text: 'Grocery' }, gTop);
  s('circle', { cx: px(STOP[0]), cy: px(STOP[1]), r: 7, class: 'stop' }, gTop);
  s('text', { x: px(STOP[0]) - 10, y: px(STOP[1]) - 12, 'text-anchor': 'end', class: 't-strong t-halo', text: 'Bus stop' }, gTop);

  var panel = h('div', { class: 'panel' }, split);
  var ro = h('div', { class: 'readouts zn-readouts' }, panel);
  function readout(k) { var d = h('div', { class: 'readout' }, ro); h('div', { class: 'k', text: k }, d); return { v: h('div', { class: 'v' }, d), s: h('div', { class: 's' }, d) }; }
  var rTrip = readout('Home → grocery'), rCells = readout('Cells in one full trip table'), rErr = readout('Model error, walk to the stop');
  var corr = h('p', { class: 'zn-corr' }, panel);
  var calc = h('div', { class: 'zn-calc' }, panel);
  h('h3', { text: 'Scale it up' }, calc);
  var bigOut = h('p', { 'aria-live': 'polite' }, calc);
  Lab.slider(calc, { id: 'zn-big', label: 'Zones in a regional model', min: 100, max: 5000, step: 100, value: 200, format: fmt.int, onInput: big });
  function big(n) {
    var cells = n * n;
    bigOut.innerHTML = '<strong>' + fmt.int(n) + '</strong> zones → <strong>' + fmt.int(cells) + '</strong> cells per table (' + (cells * 4 / 1e6 < 1 ? fmt.dec(cells * 4 / 1e6, 2) : fmt.dec(cells * 4 / 1e6, 0)) + ' MB at 4 bytes per cell). Doubling the zones quadruples the cells, for every table: each purpose, period, mode and skim.';
  }
  big(200);
  var legend = h('div', { class: 'legend' }, body);
  legend.innerHTML = '<span class="title">Walk to the stop</span><span class="item"><i class="swatch zn-sw-1"></i>under 500 m</span><span class="item"><i class="swatch zn-sw-2"></i>500–1,000 m</span><span class="item"><i class="swatch zn-sw-3"></i>1,000–1,500 m</span><span class="item"><i class="swatch zn-sw-4"></i>over 1,500 m</span><span class="item"><i class="swatch sw-macro"></i>macrozone edge</span><span class="item"><i class="swatch sw-micro"></i>microzone edge</span>';

  function zoneOf(x, y, n) { var c = Math.min(n - 1, Math.floor(x / (SIZE / n))), r = Math.min(n - 1, Math.floor(y / (SIZE / n))); return r * n + c; }
  function cls(d) { return d < 500 ? 1 : d < 1000 ? 2 : d < 1500 ? 3 : 4; }
  function draw() {
    pick.set(st.n); pickC.set(st.colorBy);
    var n = st.n, z = SIZE / n;
    // zone centroids weighted by homes
    var sums = {};
    homes.forEach(function (o) { var id = zoneOf(o.x, o.y, n); var q = sums[id] = sums[id] || { x: 0, y: 0, k: 0 }; q.x += o.x; q.y += o.y; q.k++; o.zone = id; });
    var cent = {};
    Object.keys(sums).forEach(function (id) { var q = sums[id]; cent[id] = [q.x / q.k, q.y / q.k]; });
    var err = 0;
    homes.forEach(function (o, i) {
      o.model = dist(cent[o.zone], STOP);
      err += Math.abs(o.model - o.actual);
      homeEls[i].setAttribute('class', 'zn-home zn-c' + cls(st.colorBy === 'actual' ? o.actual : o.model));
    });
    err /= homes.length;
    while (gLines.firstChild) gLines.firstChild.remove();
    while (gCent.firstChild) gCent.firstChild.remove();
    if (n >= 4) for (var i = 1; i < n; i++) {
      if (i * z === SIZE / 2) continue;
      s('line', { x1: px(i * z), y1: O, x2: px(i * z), y2: O + 500, class: 'zn-micro' }, gLines);
      s('line', { x1: O, y1: px(i * z), x2: O + 500, y2: px(i * z), class: 'zn-micro' }, gLines);
    }
    if (n >= 2) {
      s('line', { x1: px(800), y1: O, x2: px(800), y2: O + 500, class: 'zn-macro' }, gLines);
      s('line', { x1: O, y1: px(800), x2: O + 500, y2: px(800), class: 'zn-macro' }, gLines);
    }
    Object.keys(cent).forEach(function (id) {
      var c = cent[id];
      s('path', { d: 'M' + (px(c[0]) - 4) + ',' + px(c[1]) + 'h8M' + px(c[0]) + ',' + (px(c[1]) - 4) + 'v8', class: 'zn-centroid' }, gCent);
    });
    var zh = zoneOf(HOME[0], HOME[1], n), zs = zoneOf(SHOP[0], SHOP[1], n);
    trip.setAttribute('class', 'zn-trip' + (zh === zs ? ' intra' : ''));
    if (zh === zs) { rTrip.v.innerHTML = '<span class="chip warn">Intrazonal</span>'; rTrip.s.textContent = 'Both ends sit in zone ' + (zh + 1) + '. The trip exists but never appears between zones, so it needs separate treatment.'; }
    else { rTrip.v.innerHTML = '<span class="chip ok">Interzonal</span>'; rTrip.s.textContent = 'Zone ' + (zh + 1) + ' → zone ' + (zs + 1) + '. The model can now represent this short trip explicitly.'; }
    rCells.v.textContent = fmt.int(n * n * n * n);
    rCells.s.textContent = (n * n) + ' zones × ' + (n * n) + ' zones';
    rErr.v.innerHTML = fmt.int(err) + ' <small>m on average</small>';
    rErr.s.textContent = 'Each home is assigned its zone centroid’s distance; the actual walk differs by this much.';
    if (n >= 4) {
      var macro = zoneOf(HOME[0], HOME[1], 2), parts = [], total = 0, per = n / 2;
      for (var r = 0; r < per; r++) for (var c = 0; c < per; c++) {
        var cx = (macro % 2) * per + c, cy = Math.floor(macro / 2) * per + r, id = cy * n + cx;
        var k = sums[id] ? sums[id].k : 0; parts.push(k); total += k;
      }
      corr.innerHTML = '<strong>Correspondence:</strong> the home’s macrozone holds ' + total + ' homes = ' + (parts.length > 4 ? parts.slice(0, 4).join(' + ') + ' + … (' + parts.length + ' small zones)' : parts.join(' + ')) + '. Counts add up across nested zones; average travel times need trip weights.';
    } else {
      corr.innerHTML = '<strong>Correspondence:</strong> when you split zones, each new zone should nest inside one old zone so totals can be compared.';
    }
    svgTitle.textContent = 'Square study area, ' + (n * n) + ' zones. Homes are colored by ' + (st.colorBy === 'actual' ? 'their actual walking distance' : 'the distance the model assigns them') + ' to a bus stop on the east edge.';
  }
  draw();
});
