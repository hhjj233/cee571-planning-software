/* Slides 3, 8, 14, 15, 26: the four-step model, run once on a five-zone city.
   Generation -> balancing -> doubly constrained gravity -> logit mode choice -> all-or-nothing assignment,
   plus selected-link analysis on any road. */
Lab.register('demo-fourstep', function (root) {
  var s = Lab.s, h = Lab.h, fmt = Lab.fmt;

  // ---------- network and zones (1 px = 10 m) ----------
  var NODES = {
    n1: [190, 140], n2: [360, 150], n3: [360, 280], n4: [360, 400], n5: [210, 420],
    n6: [580, 150], n7: [580, 400], n8: [700, 290], n9: [820, 350]
  };
  var LINKS = [ // a, b, name, km/h
    ['n1', 'n2', 'University Ave', 40], ['n1', 'n3', 'Campus Dr', 35], ['n2', 'n3', 'Main St (north)', 35],
    ['n3', 'n4', 'Main St (south)', 35], ['n4', 'n5', 'Mall Rd', 40], ['n3', 'n5', 'Market St', 30],
    ['n2', 'n6', 'North Bridge', 40], ['n4', 'n7', 'South Bridge', 50], ['n6', 'n8', 'River Rd (north)', 45],
    ['n7', 'n8', 'River Rd (south)', 45], ['n8', 'n9', 'Prairie Rd', 50], ['n7', 'n9', 'Lake Rd', 45],
    ['n6', 'n7', 'East Bank Rd', 40]
  ];
  var ZONES = [
    { id: 1, name: 'Eastfield', c: [820, 446], node: 'n9', hh: 1200, jobs: 50, tile: [520, 244, 940, 520] },
    { id: 2, name: 'Riverside', c: [720, 92], node: 'n6', hh: 2000, jobs: 300, tile: [520, 20, 940, 236] },
    { id: 3, name: 'Downtown', c: [210, 318], node: 'n3', hh: 600, jobs: 6000, tile: [20, 204, 440, 356] },
    { id: 4, name: 'University', c: [230, 108], node: 'n1', hh: 800, jobs: 2500, tile: [20, 20, 440, 196] },
    { id: 5, name: 'Mall', c: [110, 466], node: 'n5', hh: 300, jobs: 1500, tile: [20, 364, 440, 520] }
  ];
  var BUS_ZONES = { 1: true, 2: true, 3: true, 4: true };
  var BUS_ROUTE = ['n9', 'n8', 'n6', 'n2', 'n1', 'n3'];
  var R = { prod: 0.8, attr: 0.6, beta: 0.12, occ: 1.1 };
  var state = { step: 1, dev: true, focus: null, sel: null };

  function zoneById(id) { return ZONES[id - 1]; }
  function key(i, j) { return i + '-' + j; }
  var linkLen = LINKS.map(function (l) { var a = NODES[l[0]], b = NODES[l[1]]; return Math.hypot(a[0] - b[0], a[1] - b[1]); });
  var linkTime = LINKS.map(function (l, i) { return linkLen[i] * 10 / 1000 / l[3] * 60; });
  var adj = {};
  Object.keys(NODES).forEach(function (k) { adj[k] = []; });
  LINKS.forEach(function (l, i) { adj[l[0]].push([l[1], i]); adj[l[1]].push([l[0], i]); });
  function connTime(z) { var n = NODES[z.node]; return Math.hypot(z.c[0] - n[0], z.c[1] - n[1]) * 10 / 1000 / 25 * 60; }
  function dijkstra(src) {
    var dist = {}, prev = {}, done = {}, ks = Object.keys(NODES);
    ks.forEach(function (k) { dist[k] = Infinity; });
    dist[src] = 0;
    for (;;) {
      var u = null, best = Infinity;
      ks.forEach(function (k) { if (!done[k] && dist[k] < best) { best = dist[k]; u = k; } });
      if (u === null) break;
      done[u] = true;
      adj[u].forEach(function (e) {
        var nd = dist[u] + linkTime[e[1]];
        if (nd < dist[e[0]] - 1e-9) { dist[e[0]] = nd; prev[e[0]] = [u, e[1]]; }
      });
    }
    return { dist: dist, prev: prev };
  }
  var skim = {}, pathLinks = {}, pathPts = {};
  ZONES.forEach(function (zi) {
    var sp = dijkstra(zi.node);
    ZONES.forEach(function (zj) {
      if (zi === zj) return;
      var k = key(zi.id, zj.id), seq = [], nodes = [zj.node], cur = zj.node;
      skim[k] = connTime(zi) + sp.dist[zj.node] + connTime(zj);
      while (cur !== zi.node) { var p = sp.prev[cur]; seq.unshift(p[1]); cur = p[0]; nodes.unshift(cur); }
      pathLinks[k] = seq;
      pathPts[k] = [zi.c].concat(nodes.map(function (n) { return NODES[n]; })).concat([zj.c]);
    });
  });

  // ---------- the model ----------
  function compute() {
    var P = {}, Araw = {}, A = {}, hh = {}, jobs = {}, sumP = 0, sumA = 0;
    ZONES.forEach(function (z) {
      var off = z.id === 1 && !state.dev;
      hh[z.id] = off ? 0 : z.hh; jobs[z.id] = off ? 0 : z.jobs;
      P[z.id] = R.prod * hh[z.id]; Araw[z.id] = R.attr * jobs[z.id];
      sumP += P[z.id]; sumA += Araw[z.id];
    });
    var bal = sumP / sumA;
    ZONES.forEach(function (z) { A[z.id] = Araw[z.id] * bal; });
    var T = {};
    ZONES.forEach(function (zi) { ZONES.forEach(function (zj) {
      if (zi !== zj) T[key(zi.id, zj.id)] = P[zi.id] * A[zj.id] * Math.exp(-R.beta * skim[key(zi.id, zj.id)]);
    }); });
    for (var it = 0; it < 60; it++) {
      ZONES.forEach(function (zj) {
        var cs = 0; ZONES.forEach(function (zi) { if (zi !== zj) cs += T[key(zi.id, zj.id)]; });
        var f = cs > 0 ? A[zj.id] / cs : 0;
        ZONES.forEach(function (zi) { if (zi !== zj) T[key(zi.id, zj.id)] *= f; });
      });
      ZONES.forEach(function (zi) {
        var rs = 0; ZONES.forEach(function (zj) { if (zi !== zj) rs += T[key(zi.id, zj.id)]; });
        var f = rs > 0 ? P[zi.id] / rs : 0;
        ZONES.forEach(function (zj) { if (zi !== zj) T[key(zi.id, zj.id)] *= f; });
      });
    }
    var share = {}, car = {}, bus = {}, veh = {};
    Object.keys(T).forEach(function (k) {
      var ij = k.split('-').map(Number), t = skim[k], pb = 0;
      if (BUS_ZONES[ij[0]] && BUS_ZONES[ij[1]]) {
        var carGT = t + 2 * 3, busGT = 1.3 * t + 2 * (6 + 7.5) + 2;
        pb = 1 / (1 + Math.exp(0.6 - 0.05 * (carGT - busGT)));
      }
      share[k] = pb; bus[k] = T[k] * pb; car[k] = T[k] - bus[k]; veh[k] = car[k] / R.occ;
    });
    var vol = LINKS.map(function () { return 0; }), use = LINKS.map(function () { return []; });
    Object.keys(veh).forEach(function (k) {
      if (veh[k] < 0.5) return;
      pathLinks[k].forEach(function (li) { vol[li] += veh[k]; use[li].push([k, veh[k]]); });
    });
    return { hh: hh, jobs: jobs, P: P, Araw: Araw, A: A, bal: bal, sumP: sumP, sumA: sumA, T: T, share: share, car: car, bus: bus, veh: veh, vol: vol, use: use };
  }
  var M = compute();

  // ---------- controls ----------
  var body = Lab.mount(root);
  var bar = h('div', { class: 'demo-bar' }, body);
  var gA = h('div', { class: 'group' }, bar);
  var STEP_NAMES = ['Trip generation', 'Trip distribution', 'Mode choice', 'Assignment'];
  var stepPick = Lab.choice(gA, STEP_NAMES.map(function (n, i) {
    return { value: i + 1, label: '<span class="n">' + (i + 1) + '</span>' + n };
  }), function (v) { go(Number(v)); }, { label: 'Model step', idPrefix: 'fs-step' });
  stepPick.el.classList.add('fs-steps');
  var gB = h('div', { class: 'group' }, bar);
  var nextBtn = h('button', { type: 'button', class: 'btn primary', id: 'fs-next' }, gB);
  nextBtn.addEventListener('click', function () { go(state.step === 4 ? 1 : state.step + 1); });
  var devLabel = h('label', { class: 'check' }, gB);
  var devBox = h('input', { type: 'checkbox', id: 'fs-dev', checked: true }, devLabel);
  devLabel.appendChild(document.createTextNode('Include the new Eastfield homes'));
  devBox.addEventListener('change', function () { state.dev = devBox.checked; M = compute(); drawAll(); });

  // ---------- map ----------
  var split = h('div', { class: 'split fs-split' }, body);
  var stage = h('div', { class: 'stage' }, split);
  var svg = s('svg', { viewBox: '0 0 960 540', class: 'fs-map', role: 'img', 'aria-labelledby': 'fs-svg-t', 'data-step': 1 }, stage);
  var svgTitle = s('title', { id: 'fs-svg-t' }, svg);
  var panel = h('div', { class: 'panel', 'aria-live': 'polite' }, split);

  var gTiles = s('g', null, svg);
  ZONES.forEach(function (z) {
    var t = z.tile;
    z.tileEl = s('rect', { x: t[0], y: t[1], width: t[2] - t[0], height: t[3] - t[1], rx: 8, class: 'fs-tile' }, gTiles);
    z.tileEl.addEventListener('click', function () {
      if (state.step === 2 || state.step === 3) { state.focus = state.focus === z.id ? null : z.id; drawDesire(); drawPanel(); }
    });
  });
  s('path', { class: 'water', d: 'M452,0 C430,90 478,150 460,230 C446,300 486,370 468,440 C458,480 470,505 462,540 L516,540 C524,505 512,480 522,440 C540,370 500,300 514,230 C532,150 484,90 506,0 Z' }, svg);

  var gRoads = s('g', null, svg);
  LINKS.forEach(function (l) {
    var a = NODES[l[0]], b = NODES[l[1]];
    s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'road-edge', 'stroke-width': 8 }, gRoads);
  });
  LINKS.forEach(function (l) {
    var a = NODES[l[0]], b = NODES[l[1]];
    s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'road', 'stroke-width': 5.5 }, gRoads);
  });
  var gConn = s('g', null, svg);
  ZONES.forEach(function (z) {
    var n = NODES[z.node];
    s('line', { x1: z.c[0], y1: z.c[1], x2: n[0], y2: n[1], class: 'fs-conn' }, gConn);
  });

  var gFlow = s('g', { class: 'layer' }, svg);
  var gBus = s('g', { class: 'layer' }, svg);
  s('polyline', { points: Lab.pointsAttr(BUS_ROUTE.map(function (n) { return NODES[n]; })), class: 'bus-line', 'stroke-dasharray': '9 6' }, gBus);
  BUS_ROUTE.forEach(function (n, i) { if (i === 0 || n === 'n6' || n === 'n1' || n === 'n3') s('circle', { cx: NODES[n][0], cy: NODES[n][1], r: 5, class: 'stop' }, gBus); });
  s('text', { x: 640, y: 222, class: 't-small t-halo', text: 'Bus route' }, gBus);
  var gDesire = s('g', { class: 'layer' }, svg);
  var gGen = s('g', { class: 'layer' }, svg);
  var gCent = s('g', null, svg);
  ZONES.forEach(function (z) {
    s('rect', { x: z.c[0] - 5, y: z.c[1] - 5, width: 10, height: 10, rx: 1.5, class: 'fs-centroid' }, gCent);
    s('text', { x: z.tile[0] + 14, y: z.tile[1] + 26, class: 't-strong', text: z.id + ' • ' + z.name }, gCent);
    z.subEl = s('text', { x: z.tile[0] + 14, y: z.tile[1] + 47, class: 't-small' }, gCent);
  });
  var gParts = s('g', null, svg);
  var gLabels = s('g', { class: 'layer' }, svg);
  var gHits = s('g', { class: 'layer' }, svg);
  var hitEls = LINKS.map(function (l, i) {
    var a = NODES[l[0]], b = NODES[l[1]];
    var el = s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'hit', 'stroke-width': 18, tabindex: 0, role: 'button' }, gHits);
    function pickLink() { if (state.step !== 4) return; state.sel = state.sel === i ? null : i; drawFlow(); drawDesire(); drawPanel(); resetParticles(); }
    el.addEventListener('click', pickLink);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickLink(); } });
    return el;
  });

  var legend = h('div', { class: 'legend' }, body);

  // ---------- drawing ----------
  function clear(g) { while (g.firstChild) g.firstChild.remove(); }
  function zoneSub(z) {
    if (z.id === 1 && !state.dev) return 'vacant';
    return fmt.int(M.hh[z.id]) + ' homes • ' + fmt.int(M.jobs[z.id]) + ' jobs';
  }
  function drawGen() {
    clear(gGen);
    var k = 0.035;
    ZONES.forEach(function (z) {
      z.subEl.textContent = zoneSub(z);
      var x = z.c[0] + 52, base = z.c[1] + 6;
      var bars = [[M.P[z.id], 'fs-bar-p'], [M.A[z.id], 'fs-bar-a']];
      bars.forEach(function (b, i) {
        var hgt = Math.max(1, b[0] * k), bx = x + i * 16;
        s('rect', { x: bx, y: base - hgt, width: 14, height: hgt, rx: 1.5, class: b[1] }, gGen);
        s('text', { x: i === 0 ? bx - 5 : bx + 19, y: base - hgt + 11, 'text-anchor': i === 0 ? 'end' : 'start', class: 't-small t-num t-halo', text: fmt.int(b[0]) }, gGen);
      });
    });
  }
  function pairList() {
    var out = [];
    for (var i = 1; i <= 5; i++) for (var j = i + 1; j <= 5; j++) {
      var a = key(i, j), b = key(j, i);
      var tot = M.T[a] + M.T[b];
      if (tot < 1) continue;
      out.push({ i: i, j: j, tot: tot, car: M.car[a] + M.car[b], bus: M.bus[a] + M.bus[b] });
    }
    return out;
  }
  function drawDesire() {
    clear(gDesire);
    ZONES.forEach(function (z) { z.tileEl.classList.toggle('is-focus', (state.step === 2 || state.step === 3) && state.focus === z.id); });
    if (state.step === 4) {
      if (state.sel === null) return;
      var byPair = {};
      M.use[state.sel].forEach(function (u) { var ij = u[0].split('-'), pk = Math.min(ij[0], ij[1]) + '-' + Math.max(ij[0], ij[1]); byPair[pk] = (byPair[pk] || 0) + u[1]; });
      Object.keys(byPair).forEach(function (pk) {
        var ij = pk.split('-').map(Number), a = zoneById(ij[0]).c, b = zoneById(ij[1]).c;
        s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'fs-sel-desire', 'stroke-width': 1 + byPair[pk] / 45 }, gDesire);
      });
      return;
    }
    pairList().forEach(function (p) {
      var a = zoneById(p.i).c, b = zoneById(p.j).c;
      var dim = state.focus !== null && p.i !== state.focus && p.j !== state.focus;
      var grp = s('g', { class: dim ? 'fs-dim' : null }, gDesire);
      s('title', { text: zoneById(p.i).name + ' ↔ ' + zoneById(p.j).name + ': ' + fmt.int(p.tot) + ' person trips' + (state.step === 3 ? ' (' + fmt.int(p.bus) + ' by bus)' : '') }, grp);
      if (state.step === 2) {
        s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'fs-desire', 'stroke-width': 1 + p.tot / 70 }, grp);
      } else {
        var wc = 1 + p.car / 70, wb = p.bus > 1 ? 1 + p.bus / 70 : 0, W = wc + wb + (wb ? 1.5 : 0);
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
        var oc = -(W / 2 - wc / 2), ob = W / 2 - wb / 2;
        s('line', { x1: a[0] + nx * oc, y1: a[1] + ny * oc, x2: b[0] + nx * oc, y2: b[1] + ny * oc, class: 'fs-desire', 'stroke-width': wc }, grp);
        if (wb) s('line', { x1: a[0] + nx * ob, y1: a[1] + ny * ob, x2: b[0] + nx * ob, y2: b[1] + ny * ob, class: 'fs-desire-bus', 'stroke-width': wb }, grp);
      }
    });
  }
  var LABEL_LINKS = [6, 7, 10, 11];
  function drawFlow() {
    clear(gFlow); clear(gLabels);
    LINKS.forEach(function (l, i) {
      var a = NODES[l[0]], b = NODES[l[1]], v = M.vol[i];
      var sel = state.sel === i, dim = state.sel !== null && !sel;
      if (v > 0.5) s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'fs-flow' + (dim ? ' fs-dim' : ''), 'stroke-width': 1.5 + v / 75 }, gFlow);
      if (sel) s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'fs-flow-sel', 'stroke-width': 4 + v / 75 }, gFlow);
      hitEls[i].setAttribute('aria-label', l[2] + ': ' + fmt.int(v) + ' vehicles. Select to trace its trips.');
      if (LABEL_LINKS.indexOf(i) >= 0 || sel) {
        var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 12;
        s('text', { x: mx, y: my, 'text-anchor': 'middle', class: 't-small t-num t-halo fs-vol', text: l[2] + ' • ' + fmt.int(v) }, gLabels);
      }
    });
  }
  function setLegend() {
    if (state.step === 1) legend.innerHTML = '<span class="item"><i class="swatch fs-sw-p"></i>trips produced (from homes)</span><span class="item"><i class="swatch fs-sw-a"></i>trips attracted (to jobs), after balancing</span>';
    else if (state.step === 2) legend.innerHTML = '<span class="item"><i class="swatch sw-ink"></i>desire line, width = person trips between two zones (both directions)</span><span class="item">Click a zone to focus on its lines.</span>';
    else if (state.step === 3) legend.innerHTML = '<span class="item"><i class="swatch sw-ink"></i>by car</span><span class="item"><i class="swatch sw-bus"></i>by bus</span><span class="item">Dashed blue: the one bus route. Click a zone to focus.</span>';
    else legend.innerHTML = '<span class="item"><i class="swatch sw-ink"></i>road volume, width = vehicles in the AM peak hour</span><span class="item"><i class="swatch sw-violet"></i>selected road and the trips that use it</span>';
  }

  function tableHTML(head, rows, cls) {
    return '<div class="table-wrap"><table class="data ' + (cls || '') + '"><thead><tr>' + head.map(function (x) { return '<th scope="col">' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '><th scope="row">' + r.c[0] + '</th>' + r.c.slice(1).map(function (x) { return '<td>' + x + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function drawPanel() {
    var html = '';
    if (state.step === 1) {
      html += '<h3>1 • Trip generation</h3><p>Homes produce morning trips and jobs attract them: <strong>0.8 trips per home</strong> and <strong>0.6 per job</strong>.</p>';
      html += tableHTML(['Zone', 'Produced', 'Attracted → balanced'], ZONES.map(function (z) {
        return { c: [z.name, fmt.int(M.P[z.id]), fmt.int(M.Araw[z.id]) + ' → ' + fmt.int(M.A[z.id])] };
      }));
      html += '<p><strong>Trip balancing.</strong> Attractions add up to ' + fmt.int(M.sumA) + ', but only ' + fmt.int(M.sumP) + ' trips are produced. Every attraction is scaled by ' + fmt.dec(M.bal, 3) + ' so the totals agree. Balancing fixes totals; it does not say which zones exchange trips.</p>';
    } else if (state.step === 2) {
      html += '<h3>2 • Trip distribution</h3><p>A gravity model sends more trips to large, nearby destinations: trips from <i>i</i> to <i>j</i> grow with <i>j</i>’s attractions and fall with travel time as e<sup>−0.12•min</sup>. Rows match productions; columns match balanced attractions.</p>';
      var head = ['From ↓ to →'].concat(ZONES.map(function (z) { return String(z.id); })).concat(['Total']);
      html += tableHTML(head, ZONES.map(function (zi) {
        var tot = 0, cells = ZONES.map(function (zj) { if (zi === zj) return '–'; var v = M.T[key(zi.id, zj.id)]; tot += v; return fmt.int(v); });
        return { c: [String(zi.id)].concat(cells).concat([fmt.int(tot)]), cls: state.focus === zi.id ? 'is-active' : '' };
      }), 'fs-od');
      html += '<p class="fs-key">Zones: ' + ZONES.map(function (z) { return z.id + ' ' + z.name; }).join(', ') + '. Click a zone on the map to highlight its lines.</p>';
      html += '<p>The straight lines on the map are a display convention. Nobody drives along them; step 4 finds the roads.</p>';
    } else if (state.step === 3) {
      html += '<h3>3 • Mode choice</h3><p>Where the bus links both zones, travelers compare car and bus time with a logit model; walking and waiting minutes count double. The Mall has no bus, so every Mall trip goes by car.</p>';
      html += tableHTML(['From', 'Trips', 'By bus', 'Bus share'], ZONES.map(function (zi) {
        var t = 0, b = 0;
        ZONES.forEach(function (zj) { if (zi !== zj) { t += M.T[key(zi.id, zj.id)]; b += M.bus[key(zi.id, zj.id)]; } });
        return { c: [zi.name, fmt.int(t), fmt.int(b), t > 0 ? fmt.pct(b / t, 1) : '—'], cls: state.focus === zi.id ? 'is-active' : '' };
      }));
    } else {
      html += '<h3>4 • Assignment</h3><p>Car trips become vehicles (1.1 people per car), and each origin–destination pair takes its single fastest path. This is <strong>all-or-nothing</strong> assignment: travel times stay at their free-flow values, so congestion does not push anyone to another route.</p>';
      if (state.sel === null) {
        html += '<p><strong>Click any road</strong> to trace the trips that use it (selected-link analysis). Try the South Bridge.</p>';
        var order = LINKS.map(function (l, i) { return i; }).sort(function (a, b) { return M.vol[b] - M.vol[a]; }).slice(0, 6);
        html += tableHTML(['Busiest roads', 'Vehicles'], order.map(function (i) { return { c: [LINKS[i][2], fmt.int(M.vol[i])] }; }));
      } else {
        var li = state.sel, total = M.vol[li];
        var rows = M.use[li].slice().sort(function (a, b) { return b[1] - a[1]; }).filter(function (u) { return u[1] >= 0.5; });
        html += '<p><strong>' + LINKS[li][2] + '</strong> carries <strong>' + fmt.int(total) + '</strong> vehicles in the peak hour. They belong to these origin–destination pairs:</p>';
        html += rows.length ? tableHTML(['From → To', 'Vehicles', 'Share'], rows.map(function (u) {
          var ij = u[0].split('-').map(Number);
          return { c: [zoneById(ij[0]).name + ' → ' + zoneById(ij[1]).name, fmt.int(u[1]), fmt.pct(u[1] / total)] };
        })) : '<p>No assigned trips use this road.</p>';
        html += '<p>Click the road again to clear the selection.</p>';
      }
    }
    panel.innerHTML = html;
  }

  // ---------- particles ----------
  var parts = [], emit = {};
  function resetParticles() { parts.forEach(function (p) { p.el.remove(); }); parts = []; emit = {}; }
  function emitters() {
    var list = [];
    Object.keys(M.T).forEach(function (k) {
      var ij = k.split('-').map(Number);
      if (state.step === 2 || state.step === 3) {
        if (M.T[k] < 1) return;
        list.push({ k: k, rate: M.T[k] / 260, pts: [zoneById(ij[0]).c, zoneById(ij[1]).c], bus: state.step === 3 ? M.share[k] : 0 });
      } else if (state.step === 4) {
        if (M.veh[k] < 1) return;
        if (state.sel !== null && pathLinks[k].indexOf(state.sel) < 0) return;
        list.push({ k: k, rate: M.car[k] / 260, pts: pathPts[k], bus: 0, sel: state.sel !== null });
      }
    });
    return list;
  }
  function tickParticles(dt) {
    if (state.step === 1) return;
    emitters().forEach(function (e) {
      emit[e.k] = (emit[e.k] || 0) + e.rate * dt;
      while (emit[e.k] >= 1) {
        emit[e.k] -= 1;
        var cls = e.sel ? 'fs-dot-sel' : (Math.random() < e.bus ? 'fs-dot-bus' : 'fs-dot');
        parts.push({ p: Lab.path(e.pts), d: 0, el: s('circle', { r: 2.6, class: cls }, gParts) });
      }
    });
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i];
      q.d += 115 * dt;
      if (q.d >= q.p.length) { q.el.remove(); parts.splice(i, 1); continue; }
      var xy = q.p.at(q.d);
      q.el.setAttribute('cx', xy[0].toFixed(1)); q.el.setAttribute('cy', xy[1].toFixed(1));
    }
  }

  // ---------- step changes ----------
  function show(g, on) { g.classList.toggle('fs-hidden', !on); }
  function drawAll() {
    svg.setAttribute('data-step', state.step);
    stepPick.set(state.step);
    nextBtn.textContent = state.step === 4 ? '↺ Start over' : 'Next step →';
    show(gGen, state.step === 1);
    show(gDesire, state.step !== 1);
    show(gBus, state.step === 3);
    show(gFlow, state.step === 4);
    show(gLabels, state.step === 4);
    show(gHits, state.step === 4);
    hitEls.forEach(function (el) { el.setAttribute('tabindex', state.step === 4 ? 0 : -1); });
    ZONES.forEach(function (z) { z.subEl.textContent = zoneSub(z); });
    drawGen(); drawDesire(); drawFlow(); drawPanel(); setLegend();
    svgTitle.textContent = 'Five-zone map of the hypothetical city, step ' + state.step + ': ' + STEP_NAMES[state.step - 1] + '.';
  }
  function go(n) {
    state.step = n;
    if (n !== 4) state.sel = null;
    resetParticles();
    drawAll();
  }
  drawAll();
  var lp = Lab.loop(root, tickParticles);
  Lab.playButton(lp, gB);
});
