/* Slide 27: warehouse-to-store allocation. Nearest-first rules versus the lowest-cost plan under capacity limits.
   Each store is served by one warehouse; the optimum checks all 2^6 = 64 assignments. */
Lab.register('demo-warehouse', function (root) {
  var s = Lab.s, h = Lab.h, fmt = Lab.fmt;
  var WH = [{ name: 'North warehouse', xy: [250, 110], cap: 260 }, { name: 'South warehouse', xy: [330, 400], cap: 600 }];
  var ST = [
    { xy: [90, 240], q: 120 }, { xy: [110, 70], q: 90 }, { xy: [400, 60], q: 110 },
    { xy: [480, 230], q: 100 }, { xy: [470, 330], q: 80 }, { xy: [560, 440], q: 100 }
  ];
  var RATE = 0.05; // dollars per unit per map unit
  var st = { plan: 'nearest' };
  function d(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function cost(i, w) { return d(ST[i].xy, WH[w].xy) * RATE * ST[i].q; }
  function near(i) { return d(ST[i].xy, WH[0].xy) <= d(ST[i].xy, WH[1].xy) ? 0 : 1; }
  function evaluate(asg) {
    var load = [0, 0], c = 0;
    asg.forEach(function (w, i) { load[w] += ST[i].q; c += cost(i, w); });
    return { asg: asg, load: load, cost: c, ok: load[0] <= WH[0].cap && load[1] <= WH[1].cap };
  }
  function plans() {
    var nearest = evaluate(ST.map(function (_, i) { return near(i); }));
    var rem = [WH[0].cap, WH[1].cap];
    var greedy = evaluate(ST.map(function (s0, i) {
      var pref = near(i), other = 1 - pref;
      if (rem[pref] >= s0.q) { rem[pref] -= s0.q; return pref; }
      rem[other] -= s0.q; return other;
    }));
    var best = null;
    for (var m = 0; m < 64; m++) {
      var e = evaluate(ST.map(function (_, i) { return (m >> i) & 1; }));
      if (e.ok && (!best || e.cost < best.cost)) best = e;
    }
    return { nearest: nearest, greedy: greedy, best: best };
  }

  var body = Lab.mount(root);
  var bar = h('div', { class: 'demo-bar' }, body);
  var gA = h('div', { class: 'group' }, bar);
  h('span', { class: 'ctl-label', text: 'Plan' }, gA);
  var pick = Lab.choice(gA, [
    { value: 'nearest', label: 'Nearest warehouse' }, { value: 'greedy', label: 'Nearest first, in order received' }, { value: 'best', label: 'Lowest total cost' }
  ], function (v) { st.plan = v; draw(); }, { label: 'Allocation plan', idPrefix: 'wh-plan' });
  var gB = h('div', { class: 'group' }, bar);
  Lab.slider(gB, { id: 'wh-cap', label: 'North warehouse capacity', min: 150, max: 400, step: 10, value: WH[0].cap, format: function (v) { return fmt.int(v) + ' units'; },
    onInput: function (v) { WH[0].cap = v; draw(); } });

  var split = h('div', { class: 'split' }, body);
  var stage = h('div', { class: 'stage narrow-ok' }, split);
  var svg = s('svg', { viewBox: '0 0 640 500', role: 'img', 'aria-labelledby': 'wh-svg-t' }, stage);
  var svgTitle = s('title', { id: 'wh-svg-t' }, svg);
  var gBands = s('g', null, svg), gNodes = s('g', null, svg);
  var meters = [];
  WH.forEach(function (w, k) {
    var x = w.xy[0], y = w.xy[1];
    s('rect', { x: x - 13, y: y - 13, width: 26, height: 26, rx: 3, class: 'wh-wh' }, gNodes);
    s('text', { x: x + 20, y: y - 18, class: 't-strong t-halo', text: w.name }, gNodes);
    s('rect', { x: x + 20, y: y - 9, width: 110, height: 9, rx: 2, class: 'wh-track' }, gNodes);
    meters.push({ fill: s('rect', { x: x + 20, y: y - 9, width: 0, height: 9, rx: 2, class: 'wh-fill' }, gNodes), txt: s('text', { x: x + 20, y: y + 14, class: 't-small t-num t-halo' }, gNodes) });
  });
  ST.forEach(function (o, i) {
    s('circle', { cx: o.xy[0], cy: o.xy[1], r: 6 + o.q / 30, class: 'wh-store' }, gNodes);
    s('text', { x: o.xy[0], y: o.xy[1] + 4, 'text-anchor': 'middle', class: 'wh-store-t', text: i + 1 }, gNodes);
    s('text', { x: o.xy[0], y: o.xy[1] + 26, 'text-anchor': 'middle', class: 't-small t-num t-halo', text: o.q + ' units' }, gNodes);
  });
  var panel = h('div', { class: 'panel' }, split);
  var ro = h('div', { class: 'readouts zn-readouts' }, panel);
  function readout(k) { var dv = h('div', { class: 'readout' }, ro); h('div', { class: 'k', text: k }, dv); return { v: h('div', { class: 'v' }, dv), s: h('div', { class: 's' }, dv) }; }
  var rCost = readout('Daily delivery cost'), rOk = readout('Fits the capacities?');
  var explain = h('p', { 'aria-live': 'polite' }, panel);
  var tbl = h('div', null, panel);
  var legend = h('div', { class: 'legend' }, body);
  legend.innerHTML = '<span class="item"><i class="swatch wh-sw-n"></i>served by North</span><span class="item"><i class="swatch wh-sw-s"></i>served by South</span><span class="item">Band width = units shipped. Bands show who serves whom, not the truck’s road path.</span>';

  function draw() {
    pick.set(st.plan);
    var all = plans(), p = all[st.plan];
    while (gBands.firstChild) gBands.firstChild.remove();
    p.asg.forEach(function (w, i) {
      var a = WH[w].xy, b = ST[i].xy;
      s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'wh-band ' + (w === 0 ? 'n' : 's'), 'stroke-width': 2 + ST[i].q / 12 }, gBands);
    });
    p.load.forEach(function (ld, k) {
      var frac = ld / WH[k].cap;
      meters[k].fill.setAttribute('width', Math.min(110, 110 * frac).toFixed(1));
      meters[k].fill.setAttribute('class', 'wh-fill' + (frac > 1 ? ' over' : ''));
      meters[k].txt.textContent = fmt.int(ld) + ' of ' + fmt.int(WH[k].cap) + ' units' + (frac > 1 ? ' — over capacity' : '');
    });
    rCost.v.textContent = fmt.money(p.cost);
    var extra = p.cost - all.best.cost;
    rCost.s.textContent = !p.ok ? 'looks cheap, but cannot be carried out' : (extra < 0.5 ? 'the lowest cost that fits' : fmt.money(extra) + ' more than the lowest-cost plan');
    rOk.v.innerHTML = p.ok ? '<span class="chip ok">Yes</span>' : '<span class="chip bad">No</span>';
    rOk.s.textContent = p.ok ? 'Both warehouses within capacity' : 'North must ship ' + fmt.int(p.load[0]) + ' units but holds ' + fmt.int(WH[0].cap);
    var moved = [];
    p.asg.forEach(function (w, i) { if (w !== near(i)) moved.push(i + 1); });
    var txt = {
      nearest: 'Every store goes to its closest warehouse. That gives the lowest cost on paper, ' + (p.ok ? 'and here it also fits the capacities.' : 'but the North warehouse cannot ship that much.'),
      greedy: 'Stores are handled in the order their orders arrived (1, 2, 3 …). Each takes its nearest warehouse until that warehouse is full. ' + (moved.length ? 'Store ' + moved.join(', ') + ' gets pushed to the far warehouse.' : 'No store needs to move.'),
      best: 'Checking all 64 ways to assign the six stores finds the cheapest plan that fits. ' + (moved.length ? 'It moves store ' + moved.join(', ') + ', the one that costs least to serve from farther away.' : 'Here that is simply the nearest-warehouse plan.')
    }[st.plan];
    explain.innerHTML = txt;
    tbl.innerHTML = '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">Plan</th><th scope="col">Cost</th><th scope="col">Fits?</th></tr></thead><tbody>' +
      [['nearest', 'Nearest warehouse'], ['greedy', 'Nearest first, in order'], ['best', 'Lowest total cost']].map(function (r) {
        var q = all[r[0]];
        return '<tr class="' + (r[0] === st.plan ? 'is-active' : '') + '"><th scope="row">' + r[1] + '</th><td>' + fmt.money(q.cost) + '</td><td>' + (q.ok ? 'yes' : 'no') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    svgTitle.textContent = 'Two warehouses and six stores. ' + txt;
  }
  draw();
});
