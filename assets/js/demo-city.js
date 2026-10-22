/* Slide 1 (and 23): one development, two proposals.
   A one-corridor model: trip generation -> mode choice (logit) -> assignment (BPR), solved with feedback. */
Lab.register('demo-city', function (root) {
  var s = Lab.s, h = Lab.h, fmt = Lab.fmt;

  // ---- assumptions (all hypothetical) ----
  var P = {
    t0: 12,          // free-flow minutes on Prairie Rd (6 mi at 30 mph)
    capLane: 900,    // vehicles per hour per lane (signalized arterial)
    bg: 1500,        // existing inbound vehicles in the AM peak hour
    rate: 0.8,       // AM peak person trips toward downtown per new home
    zeroCar: 0.08,   // share of new residents' trips with no car available
    occ: 1.1,        // people per car
    carOvt: 3,       // minutes to park and walk at the car end
    busWalk: 6,      // minutes walking to and from the bus
    busDwell: 4,     // extra minutes for stops
    busFactor: 1.25, // the bus runs 25% slower than cars in the same traffic
    bTime: -0.04,    // utility per weighted minute
    ovtW: 2,         // walking and waiting minutes count double
    ascCar: 0.8,     // preference for the car, other things equal
    dotVeh: 20,      // one car dot = 20 vehicles per hour
    dotRiders: 5     // one rider dot = 5 riders
  };
  var SCEN = {
    A: { label: '<span class="sk">A</span>Today', short: 'today', newHomes: false, lanes: 2, headway: 30 },
    B: { label: '<span class="sk">B</span>New homes, no project', short: 'no project', newHomes: true, lanes: 2, headway: 30 },
    C: { label: '<span class="sk">C</span>+ Wider road', short: 'wider road', newHomes: true, lanes: 3, headway: 30 },
    D: { label: '<span class="sk">D</span>+ Bus every 10 min', short: 'frequent bus', newHomes: true, lanes: 2, headway: 10 }
  };
  var KEYS = ['A', 'B', 'C', 'D'];
  var state = { scen: 'B', homes: 1200 };
  var results = {};

  function modeShare(tRoad, headway) {
    var carGT = P.ovtW * P.carOvt + tRoad;
    var busGT = P.ovtW * (P.busWalk + headway / 2) + tRoad * P.busFactor + P.busDwell;
    var pBus = 1 / (1 + Math.exp(P.ascCar + P.bTime * (carGT - busGT)));
    return { pBus: pBus, share: P.zeroCar + (1 - P.zeroCar) * pBus, carGT: carGT, busGT: busGT };
  }
  function solve(homes, lanes, headway) {
    var cap = P.capLane * lanes, trips = P.rate * homes;
    function demandAt(v) { return P.bg + trips * (1 - modeShare(Lab.bpr(P.t0, v, cap), headway).share) / P.occ; }
    // exact equilibrium of mode choice and road time (bisection)
    var lo = P.bg, hi = P.bg + trips / P.occ;
    for (var i = 0; i < 60; i++) { var mid = (lo + hi) / 2; if (demandAt(mid) > mid) lo = mid; else hi = mid; }
    var v = (lo + hi) / 2;
    var tRoad = Lab.bpr(P.t0, v, cap);
    var m = modeShare(tRoad, headway);
    // rounds a simple feedback loop (method of successive averages) needs to settle within 0.01 min
    var rounds = 0;
    if (trips > 0) {
      var vv = P.bg, tt = Lab.bpr(P.t0, vv, cap);
      for (var k = 1; k <= 300; k++) {
        vv += (demandAt(vv) - vv) / k;
        var tn = Lab.bpr(P.t0, vv, cap);
        rounds = k;
        var settled = Math.abs(tn - tt) < 0.01;
        tt = tn;
        if (settled && k > 1) break;
      }
    }
    var wait = headway / 2, busRide = tRoad * P.busFactor + P.busDwell;
    var car = P.carOvt + tRoad, bus = P.busWalk + wait + busRide;
    return {
      homes: homes, lanes: lanes, headway: headway, cap: cap, trips: trips, v: v, vc: v / cap, tRoad: tRoad,
      car: car, bus: bus, wait: wait, busRide: busRide, share: m.share, pBus: m.pBus, carGT: m.carGT, busGT: m.busGT,
      riders: trips * m.share, cars: trips * (1 - m.share) / P.occ, avg: m.share * bus + (1 - m.share) * car, rounds: rounds
    };
  }
  function solveAll() {
    KEYS.forEach(function (k) {
      var sc = SCEN[k];
      results[k] = solve(sc.newHomes ? state.homes : 0, sc.lanes, sc.headway);
    });
  }

  // ---- layout ----
  var body = Lab.mount(root);
  var bar = h('div', { class: 'demo-bar' }, body);
  var gA = h('div', { class: 'group' }, bar);
  h('span', { class: 'ctl-label', text: 'Scenario' }, gA);
  var pick = Lab.choice(gA, KEYS.map(function (k) { return { value: k, label: SCEN[k].label }; }),
    function (k) { state.scen = k; update(); }, { label: 'Scenario', idPrefix: 'city-scen' });
  var gB = h('div', { class: 'group' }, bar);
  Lab.slider(gB, {
    id: 'city-homes', label: 'New homes in Eastfield', min: 400, max: 2000, step: 100, value: state.homes,
    format: fmt.int, onInput: function (v) { state.homes = v; update(); }
  });

  var W = 1000, H = 320;
  var RX0 = 186, RX1 = 834, RY = 166, BY = 204;
  var SIDE = [388, 612];
  var STOP_X = [818, 612, 388, 204];
  var stage = h('div', { class: 'stage' }, body);
  var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-labelledby': 'city-svg-t' }, stage);
  s('title', { id: 'city-svg-t', text: 'Schematic map: downtown on the left, the Eastfield site on the right, Prairie Road and a bus route between them. Road color shows volume divided by capacity; dots are vehicles and waiting riders.' }, svg);

  var rand = Lab.rng(571);
  // downtown blocks
  var gDown = s('g', null, svg);
  for (var r = 0; r < 5; r++) for (var c = 0; c < 4; c++) {
    s('rect', { x: 30 + c * 36, y: 80 + r * 36, width: 29, height: 29, rx: 2, class: 'dt-block' }, gDown);
  }
  s('text', { x: 100, y: 66, 'text-anchor': 'middle', class: 't-strong', text: 'Downtown' }, svg);
  s('text', { x: 100, y: 278, 'text-anchor': 'middle', class: 't-small', text: '12,000 jobs' }, svg);

  // existing neighborhoods along the side streets
  var gOld = s('g', null, svg);
  SIDE.forEach(function (sx) {
    s('line', { x1: sx, y1: 64, x2: sx, y2: 296, class: 'road', 'stroke-width': 6 }, svg);
    [[78, 140], [234, 290]].forEach(function (band) {
      for (var y = band[0]; y <= band[1]; y += 15) {
        [-62, -47, -32, 18, 33, 48].forEach(function (dx) {
          if (rand() < 0.72) s('rect', { x: sx + dx, y: y, width: 10, height: 8, rx: 1, class: 'house' }, gOld);
        });
      }
    });
  });
  s('text', { x: 500, y: 52, 'text-anchor': 'middle', class: 't-small', text: 'Existing neighborhoods' }, svg);

  // Prairie Rd
  var roadEdge = s('line', { x1: RX0 - 6, y1: RY, x2: RX1 + 14, y2: RY, class: 'road-edge' }, svg);
  var roadFill = s('line', { x1: RX0 - 6, y1: RY, x2: RX1 + 14, y2: RY, class: 'road-vc' }, svg);
  var gLanes = s('g', null, svg);
  var roadLabel = s('text', { x: 500, y: RY - 19, 'text-anchor': 'middle', class: 't-strong t-halo' }, svg);

  // bus route
  s('line', { x1: STOP_X[0], y1: BY, x2: STOP_X[3], y2: BY, class: 'bus-line' }, svg);
  STOP_X.forEach(function (x) { s('circle', { cx: x, cy: BY, r: 5, class: 'stop' }, svg); });
  var busLabel = s('text', { x: 500, y: BY + 21, 'text-anchor': 'middle', class: 't-small t-halo' }, svg);

  // Eastfield site
  var siteOutline = s('rect', { x: 848, y: 86, width: 126, height: 178, rx: 4, class: 'site-outline' }, svg);
  var gHouses = s('g', null, svg);
  var houseEls = [];
  for (var hr = 0; hr < 8; hr++) for (var hc = 0; hc < 5; hc++) {
    houseEls.push(s('rect', { x: 857 + hc * 22.5, y: 95 + hr * 20.5, width: 16, height: 13, rx: 1.5, class: 'house-new' }, gHouses));
  }
  var vacantText = s('text', { x: 911, y: 180, 'text-anchor': 'middle', class: 't-small', text: 'Vacant site' }, svg);
  s('text', { x: 911, y: 72, 'text-anchor': 'middle', class: 't-strong', text: 'Eastfield' }, svg);
  var homesLabel = s('text', { x: 911, y: 284, 'text-anchor': 'middle', class: 't-small' }, svg);

  // moving things
  var gRiders = s('g', null, svg);
  var gCars = s('g', null, svg);
  var gBuses = s('g', null, svg);

  var legend = h('div', { class: 'legend' }, body);
  legend.innerHTML =
    '<span class="title">Road color = volume ÷ capacity</span>' +
    '<span class="item"><i class="swatch sw-vc0"></i>under 0.7</span>' +
    '<span class="item"><i class="swatch sw-vc1"></i>0.7–0.9</span>' +
    '<span class="item"><i class="swatch sw-vc2"></i>0.9–1.0</span>' +
    '<span class="item"><i class="swatch sw-vc3"></i>over 1.0</span>' +
    '<span class="item"><i class="swatch sw-car"></i>existing traffic</span>' +
    '<span class="item"><i class="swatch sw-car-new"></i>from new homes (1 dot = 20 veh/h)</span>' +
    '<span class="item"><i class="swatch sw-bus"></i>bus • 5 waiting riders per dot</span>';

  var ro = h('div', { class: 'readouts' }, body);
  function readout(k) {
    var d = h('div', { class: 'readout' }, ro);
    h('div', { class: 'k', text: k }, d);
    return { v: h('div', { class: 'v' }, d), s: h('div', { class: 's' }, d) };
  }
  var rCar = readout('Car trip to downtown');
  var rBus = readout('Bus trip to downtown');
  var rShare = readout('New residents on the bus');
  var rVC = readout('Prairie Rd volume ÷ capacity');

  var tblWrap = h('div', { class: 'table-wrap' }, body);
  var tbl = h('table', { class: 'data city-table' }, tblWrap);
  var cap = h('caption', { class: 'visually-hidden', text: 'All four scenarios compared with the same measures' }, tbl);
  var thead = h('thead', null, tbl), tbody = h('tbody', null, tbl);
  var ROWS = [
    { group: 'Inputs' },
    { label: 'New homes in Eastfield', f: function (r, k) { return SCEN[k].newHomes ? fmt.int(r.homes) : '0'; } },
    { label: 'Prairie Rd lanes toward downtown', f: function (r) { return String(r.lanes); } },
    { label: 'Bus every', f: function (r) { return r.headway + ' min'; } },
    { group: 'Results • AM peak hour' },
    { label: 'Vehicles on Prairie Rd', f: function (r) { return fmt.int(r.v); }, best: 'min', val: function (r) { return r.v; } },
    { label: 'Volume ÷ capacity', f: function (r) { return fmt.dec(r.vc, 2); }, best: 'min', val: function (r) { return r.vc; } },
    { label: 'Car trip (min)', f: function (r) { return fmt.dec(r.car, 1); }, best: 'min', val: function (r) { return r.car; } },
    { label: 'Bus trip (min), the only option without a car', f: function (r) { return fmt.dec(r.bus, 1); }, best: 'min', val: function (r) { return r.bus; } },
    { label: 'New residents riding the bus', f: function (r, k) { return SCEN[k].newHomes ? fmt.pct(r.share, 1) : '—'; }, best: 'max', val: function (r) { return r.share; } },
    { label: 'Average trip, all new residents (min)', f: function (r, k) { return SCEN[k].newHomes ? fmt.dec(r.avg, 1) : '—'; }, best: 'min', val: function (r) { return r.avg; } }
  ];
  var hr0 = h('tr', null, thead);
  h('th', { scope: 'col', text: 'Same measures, every scenario' }, hr0);
  var headCells = KEYS.map(function (k) {
    var th = h('th', { scope: 'col' }, hr0);
    var b = h('button', { type: 'button', class: 'th-btn', html: SCEN[k].label, 'aria-label': 'Show scenario ' + k }, th);
    b.addEventListener('click', function () { state.scen = k; update(); });
    return th;
  });
  var bodyCells = ROWS.map(function (row) {
    var tr = h('tr', { class: row.group ? 'group-row' : null }, tbody);
    if (row.group) { h('th', { scope: 'rowgroup', colspan: 5, text: row.group }, tr); return null; }
    h('th', { scope: 'row', text: row.label }, tr);
    return KEYS.map(function () { return h('td', null, tr); });
  });
  h('p', { class: 'table-note', text: 'Bold marks the best value among B, C and D, the three ways to serve the new homes.' }, tblWrap);

  var calc = h('details', { class: 'calc' }, body);
  var calcSum = h('summary', null, calc);
  var calcList = h('ol', { class: 'calc-steps' }, calc);

  // ---- simulation of the picture ----
  var cars = [], buses = [], riderEls = [];
  var acc = { bg: 0, dev: 0, bus: 0 }, waiting = 0;
  function laneY(lane, lanes) { return RY - (lanes * 7) / 2 + 7 * (lane + 0.5); }
  function addCar(x, isNew) {
    var lanes = SCEN[state.scen].lanes;
    cars.push({ x: x, lane: Math.floor(rand() * lanes), f: 0.95 + 0.1 * rand(), el: s('circle', { r: 2.7, class: isNew ? 'car-new' : 'car' }, gCars) });
  }
  function spawnBus() {
    buses.push({ x: STOP_X[0], dwell: 0, next: 1, el: s('rect', { width: 20, height: 9, rx: 2.5, class: 'bus' }, gBuses) });
    waiting = 0;
  }
  function step(dt) { // 1 second of animation = 1 minute of the peak hour
    var r = results[state.scen];
    var speed = (RX1 - RX0) / r.tRoad;
    acc.bg += (P.bg / P.dotVeh / 60) * dt;
    while (acc.bg >= 1) { acc.bg -= 1; var u = rand(); addCar(u < 0.4 ? RX1 + 12 : u < 0.7 ? SIDE[1] : SIDE[0], false); }
    acc.dev += (r.cars / P.dotVeh / 60) * dt;
    while (acc.dev >= 1) { acc.dev -= 1; addCar(RX1 + 12, true); }
    for (var i = cars.length - 1; i >= 0; i--) {
      var c = cars[i];
      c.x -= speed * dt * c.f;
      if (c.x < RX0 - 2) { c.el.remove(); cars.splice(i, 1); }
    }
    waiting += (r.riders / P.dotRiders / 60) * dt;
    acc.bus += dt;
    if (acc.bus >= r.headway) { acc.bus -= r.headway; spawnBus(); }
    var bspeed = (STOP_X[0] - STOP_X[3]) / (r.tRoad * P.busFactor);
    for (var j = buses.length - 1; j >= 0; j--) {
      var b = buses[j];
      if (b.dwell > 0) { b.dwell -= dt; continue; }
      b.x -= bspeed * dt;
      if (b.next < 3 && b.x <= STOP_X[b.next]) { b.x = STOP_X[b.next]; b.dwell = P.busDwell / 2; b.next++; }
      if (b.x <= STOP_X[3]) { b.el.remove(); buses.splice(j, 1); }
    }
  }
  function render() {
    var lanes = SCEN[state.scen].lanes;
    cars.forEach(function (c) {
      if (c.lane >= lanes) c.lane = c.lane % lanes;
      c.el.setAttribute('cx', c.x.toFixed(1));
      c.el.setAttribute('cy', laneY(c.lane, lanes).toFixed(1));
    });
    buses.forEach(function (b) { b.el.setAttribute('x', (b.x - 10).toFixed(1)); b.el.setAttribute('y', BY - 4.5); });
    var n = Math.min(40, Math.floor(waiting));
    while (riderEls.length < n) riderEls.push(s('circle', { r: 2.2, class: 'rider' }, gRiders));
    while (riderEls.length > n) riderEls.pop().remove();
    riderEls.forEach(function (el, i) {
      el.setAttribute('cx', 798 + (i % 8) * 6);
      el.setAttribute('cy', 220 + Math.floor(i / 8) * 6);
    });
  }
  function warmUp() {
    acc.bus = rand() * results[state.scen].headway;
    for (var t = 0; t < 45; t += 0.1) step(0.1);
    render();
  }

  // ---- text and table updates ----
  function refName(k) { return k === 'A' ? null : k === 'B' ? 'A' : 'B'; }
  function vs(k, f, unit) {
    var ref = refName(k);
    if (!ref) return '';
    return fmt.signed(f(results[k]) - f(results[ref]), 1) + unit + ' vs. ' + SCEN[ref].short;
  }
  function update() {
    solveAll();
    pick.set(state.scen);
    var k = state.scen, sc = SCEN[k], r = results[k];
    var w = sc.lanes * 7;
    roadEdge.setAttribute('stroke-width', w + 4);
    roadFill.setAttribute('stroke-width', w);
    roadFill.setAttribute('class', 'road-vc ' + Lab.vcClass(r.vc));
    while (gLanes.firstChild) gLanes.firstChild.remove();
    for (var j = 1; j < sc.lanes; j++) {
      var y = RY - w / 2 + 7 * j;
      s('line', { x1: RX0 - 4, y1: y, x2: RX1 + 12, y2: y, class: 'lane-mark' }, gLanes);
    }
    roadLabel.textContent = 'Prairie Rd • 6 mi • ' + sc.lanes + ' lanes';
    busLabel.textContent = 'Bus route • every ' + sc.headway + ' min';
    var shown = sc.newHomes ? Math.round(state.homes / 50) : 0;
    houseEls.forEach(function (el, i) { el.style.display = i < shown ? '' : 'none'; });
    siteOutline.style.display = sc.newHomes ? 'none' : '';
    vacantText.style.display = sc.newHomes ? 'none' : '';
    homesLabel.textContent = sc.newHomes ? fmt.int(state.homes) + ' new homes' : 'No homes yet';

    rCar.v.innerHTML = fmt.dec(r.car, 1) + ' <small>min</small>';
    rCar.s.textContent = vs(k, function (x) { return x.car; }, ' min') || ('Prairie Rd alone: ' + fmt.dec(r.tRoad, 1) + ' min');
    rBus.v.innerHTML = fmt.dec(r.bus, 1) + ' <small>min</small>';
    rBus.s.textContent = (vs(k, function (x) { return x.bus; }, ' min') ? vs(k, function (x) { return x.bus; }, ' min') + ' • ' : '') + 'includes ' + fmt.dec(r.wait, 0) + ' min average wait';
    if (sc.newHomes) {
      rShare.v.innerHTML = fmt.pct(r.share, 1);
      rShare.s.textContent = fmt.int(r.riders) + ' riders in the peak hour';
    } else {
      rShare.v.innerHTML = '—';
      rShare.s.textContent = 'No new residents yet';
    }
    rVC.v.innerHTML = '<i class="swatch sw-' + Lab.vcClass(r.vc) + '"></i>' + fmt.dec(r.vc, 2);
    rVC.s.textContent = fmt.int(r.v) + ' veh/h on ' + sc.lanes + ' lanes • ' + Lab.vcWords(r.vc);

    headCells.forEach(function (th, i) { th.classList.toggle('is-active', KEYS[i] === k); });
    ROWS.forEach(function (row, ri) {
      var cells = bodyCells[ri];
      if (!cells) return;
      var bestKey = null;
      if (row.best) {
        ['B', 'C', 'D'].forEach(function (kk) {
          if (bestKey === null) { bestKey = kk; return; }
          var a = row.val(results[kk]), b = row.val(results[bestKey]);
          if (row.best === 'min' ? a < b - 1e-9 : a > b + 1e-9) bestKey = kk;
        });
      }
      cells.forEach(function (td, i) {
        var kk = KEYS[i];
        td.textContent = row.f(results[kk], kk);
        td.classList.toggle('is-active', kk === k);
        td.classList.toggle('best', kk === bestKey);
      });
    });

    calcSum.textContent = 'Show the calculation for scenario ' + k;
    var items;
    if (!sc.newHomes) {
      items = [
        '<b>Trip generation.</b> No new homes yet, so the corridor carries only its 1,500 existing vehicles per hour.',
        '<b>Assignment.</b> 1,500 ÷ capacity (2 lanes × 900 = 1,800) gives V/C = ' + fmt.dec(r.vc, 2) + '.',
        '<b>Travel time (BPR curve).</b> 12 × (1 + 0.15 × ' + fmt.dec(r.vc, 2) + '⁴) = <b>' + fmt.dec(r.tRoad, 1) + ' min</b> on Prairie Rd. A car trip from the site would take ' + fmt.dec(r.car, 1) + ' min with 3 min to park and walk.'
      ];
    } else {
      items = [
        '<b>Trip generation.</b> ' + fmt.int(r.homes) + ' homes × 0.8 = <b>' + fmt.int(r.trips) + '</b> person trips toward downtown in the AM peak hour.',
        '<b>Mode choice.</b> Weighted time by car: 2 × 3 min parking and walking + ' + fmt.dec(r.tRoad, 1) + ' min driving = ' + fmt.dec(r.carGT, 1) + '. By bus: 2 × (6 min walking + ' + fmt.dec(r.wait, 0) + ' min waiting) + ' + fmt.dec(r.busRide, 1) + ' min riding = ' + fmt.dec(r.busGT, 1) + '. A logit model turns that gap into ' + fmt.pct(r.pBus, 1) + ' of car owners choosing the bus. With the 8% who have no car, <b>' + fmt.pct(r.share, 1) + '</b> ride (' + fmt.int(r.riders) + ' riders).',
        '<b>Assignment.</b> ' + fmt.int(r.trips) + ' × ' + fmt.pct(1 - r.share, 1) + ' ÷ 1.1 people per car = ' + fmt.int(r.cars) + ' cars, plus 1,500 existing = <b>' + fmt.int(r.v) + '</b> vehicles per hour. Capacity is ' + r.lanes + ' lanes × 900 = ' + fmt.int(r.cap) + ', so V/C = ' + fmt.dec(r.vc, 2) + '.',
        '<b>Travel time (BPR curve).</b> 12 × (1 + 0.15 × ' + fmt.dec(r.vc, 2) + '⁴) = <b>' + fmt.dec(r.tRoad, 1) + ' min</b> on Prairie Rd.',
        '<b>Feedback.</b> The new travel time changes the mode choice in step 2, so steps 2–4 repeat until the times stop changing (' + r.rounds + ' rounds here).'
      ];
    }
    calcList.innerHTML = items.map(function (t) { return '<li><span>' + t + '</span></li>'; }).join('');

    if (lp && lp.paused) { warmUp(); }
  }

  var lp = null;
  update();
  warmUp();
  lp = Lab.loop(root, function (dt) { step(dt); render(); });
  Lab.playButton(lp, gB);
});
