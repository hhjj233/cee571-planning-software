/* Oct 29 lecture (growth factor models), slides 13-18: grow a base-year trip table to the horizon year.
   Base year 2026 (t^b), horizon year 2028. Trip generation gives the 2028 totals P_i^h and a_j^h.
     Uniform (slide 13)  t_ij^h = t_ij^b * f                          f = T^h / T^b
     Average (slide 14)  t_ij^h = t_ij^b * (f_i + f_j) / 2            f_i = P_i^h / P_i^b,  f_j = a_j^h / a_j^b
     Fratar  (slide 15)  t_ij^h = t_ij^b * f_i * f_j * (l_i + l_j) / 2
                         l_i = P_i^b / sum_j t_ij^b f_j,  l_j = a_j^b / sum_i t_ij^b f_i
   Average and Fratar repeat on the latest table (slide 18) until every row and column total is within TOL trips
   of its target. Uniform has a single factor, so a second pass would multiply by 1 and change nothing. */
Lab.register('demo-growth', function (root) {
  var h = Lab.h, s = Lab.s, fmt = Lab.fmt;
  var NAMES = ['Eastfield', 'Riverside', 'Downtown'];
  var N = NAMES.length, Z = [0, 1, 2];
  var DEF = { t: [[10, 20, 70], [20, 60, 120], [20, 20, 60]], P: [200, 220, 120], a: [55, 110, 375] };
  var TOL = 0.5, MAX_PASSES = 100;
  var METHODS = ['uniform', 'average', 'fratar'];
  var LABEL = { uniform: 'Uniform', average: 'Average', fratar: 'Fratar' };
  var SLIDE = { uniform: 'Slide 13', average: 'Slide 14', fratar: 'Slides 15–16' };
  var RULE = {
    uniform: 'Every trip grows by one factor: the growth of the whole table.',
    average: 'Each trip grows by the average of its origin’s and its destination’s growth factors.',
    fratar: 'Each trip grows by both factors, then the location factors scale it back toward the zone totals.'
  };
  var st = {
    t0: DEF.t.map(function (r) { return r.slice(); }), P: DEF.P.slice(), a: DEF.a.slice(),
    method: 'uniform', runs: null, gap0: 0, cur: { uniform: 1, average: 1, fratar: 1 },
    sel: [0, 2], ok: true, flash: false
  };

  // ---------- math ----------
  function add(x, y) { return x + y; }
  function sumP() { return st.P.reduce(add, 0); }
  function totals(t) {
    var rows = [0, 0, 0], cols = [0, 0, 0], sum = 0;
    Z.forEach(function (i) { Z.forEach(function (j) { rows[i] += t[i][j]; cols[j] += t[i][j]; sum += t[i][j]; }); });
    return { rows: rows, cols: cols, sum: sum };
  }
  // The row or column total that misses its 2028 target by the most.
  function worst(tot) {
    var w = { d: 0, kind: 'row', k: 0, total: tot.rows[0], target: st.P[0] };
    Z.forEach(function (i) {
      var d = tot.rows[i] - st.P[i];
      if (Math.abs(d) > Math.abs(w.d)) w = { d: d, kind: 'row', k: i, total: tot.rows[i], target: st.P[i] };
    });
    Z.forEach(function (j) {
      var d = tot.cols[j] - st.a[j];
      if (Math.abs(d) > Math.abs(w.d)) w = { d: d, kind: 'col', k: j, total: tot.cols[j], target: st.a[j] };
    });
    return w;
  }
  function ratio(target, total) { return total > 0 ? target / total : 1; }
  // One pass of a method. t is the table the pass starts from (the 2026 table in pass 1).
  function onePass(method, t) {
    var tot = totals(t), p = { prev: t, prevTot: tot, t: [], mult: [] };
    if (method === 'uniform') p.f = ratio(sumP(), tot.sum);
    else {
      p.fi = Z.map(function (i) { return ratio(st.P[i], tot.rows[i]); });
      p.fj = Z.map(function (j) { return ratio(st.a[j], tot.cols[j]); });
      if (method === 'fratar') {
        p.si = Z.map(function (i) { return Z.reduce(function (acc, j) { return acc + t[i][j] * p.fj[j]; }, 0); });
        p.sj = Z.map(function (j) { return Z.reduce(function (acc, i) { return acc + t[i][j] * p.fi[i]; }, 0); });
        p.li = Z.map(function (i) { return p.si[i] > 0 ? tot.rows[i] / p.si[i] : 1; });
        p.lj = Z.map(function (j) { return p.sj[j] > 0 ? tot.cols[j] / p.sj[j] : 1; });
      }
    }
    Z.forEach(function (i) {
      p.t.push([]); p.mult.push([]);
      Z.forEach(function (j) {
        var m = method === 'uniform' ? p.f
          : method === 'average' ? (p.fi[i] + p.fj[j]) / 2
          : p.fi[i] * p.fj[j] * (p.li[i] + p.lj[j]) / 2;
        p.mult[i].push(m); p.t[i].push(t[i][j] * m);
      });
    });
    p.tot = totals(p.t); p.worst = worst(p.tot); p.gap = Math.abs(p.worst.d);
    return p;
  }
  function runMethod(method) {
    var out = [], t = st.t0, limit = method === 'uniform' ? 1 : MAX_PASSES;
    for (var k = 0; k < limit; k++) {
      var p = onePass(method, t);
      out.push(p); t = p.t;
      if (p.gap < TOL) break;
    }
    return out;
  }
  function recompute() {
    st.runs = {};
    METHODS.forEach(function (m) { st.runs[m] = runMethod(m); st.cur[m] = 1; });
    st.gap0 = Math.abs(worst(totals(st.t0)).d);
  }
  function settled(m) { var r = st.runs[m]; return r[r.length - 1].gap < TOL; }
  function current() { return st.runs[st.method][st.cur[st.method] - 1]; }

  // ---------- formatting ----------
  function num(x) { return Math.abs(x - Math.round(x)) < 1e-9 ? fmt.int(x) : fmt.dec(x, 1); }
  function tr(x) { return fmt.dec(x, 1); }
  function fac(x) {
    var t = x.toFixed(4).replace(/0+$/, '');
    return (t.split('.')[1] || '').length < 2 ? x.toFixed(2) : t;
  }
  // Math variable with optional subscript and superscript (stacked, as on the slides).
  function v(name, sub, sup) {
    var out = '<span class="mvw"><i class="mv">' + name + '</i>';
    if (sub != null && sup != null) out += '<span class="ss"><sup>' + sup + '</sup><sub>' + sub + '</sub></span>';
    else if (sub != null) out += '<sub>' + sub + '</sub>';
    else if (sup != null) out += '<sup>' + sup + '</sup>';
    return out + '</span>';
  }
  function sigma(idx) { return '<span class="mvw">Σ<sub>' + idx + '</sub></span> '; }
  function eq(lines) {
    return '<div class="gm-eq">' + lines.map(function (l, n) { return '<div' + (n ? ' class="cont"' : '') + '>' + l + '</div>'; }).join('') + '</div>';
  }
  function chip(d) { return Math.abs(d) < TOL ? '<span class="chip ok">✓</span>' : '<span class="chip bad">' + fmt.signed(d, 1) + '</span>'; }
  function passes(n) { return n + (n === 1 ? ' pass' : ' passes'); }
  function missWords(w) {
    return (w.kind === 'row' ? 'trips from ' : 'trips to ') + NAMES[w.k] + ' add up to ' + tr(w.total) + ' instead of ' + num(w.target);
  }
  function trio(arr) { return '<span class="gf-trio">' + arr.map(function (x) { return '<span>' + x.toFixed(3) + '</span>'; }).join('') + '</span>'; }

  // ---------- layout ----------
  var body = Lab.mount(root);
  var bar = h('div', { class: 'demo-bar' }, body);
  var gM = h('div', { class: 'group' }, bar);
  h('span', { class: 'ctl-label', text: 'Method' }, gM);
  var seg = Lab.choice(gM, METHODS.map(function (m) { return { value: m, label: LABEL[m], title: SLIDE[m] }; }), pick,
    { label: 'Growth factor method', idPrefix: 'gf-m' });
  var gB = h('div', { class: 'group' }, bar);
  var bReset = h('button', { type: 'button', class: 'btn', id: 'gf-reset', text: '↺ Back to pass 1' }, gB);
  var bNext = h('button', { type: 'button', class: 'btn primary', id: 'gf-next', text: 'Next pass →' }, gB);
  var bRun = h('button', { type: 'button', class: 'btn', id: 'gf-run', text: 'Run to the end' }, gB);
  var status = h('span', { class: 'chip', 'aria-live': 'polite' }, gB);

  // Inputs: the 2026 table and the 2028 targets, with base totals and growth factors beside them.
  var band = h('div', { class: 'gf-inputs' }, body);
  var tbl = h('table', { class: 'data gf-in-table' }, h('div', { class: 'table-wrap' }, band));
  var inT = [], tdT = [], inP = [], inA = [], cPb = [], cFi = [], cAb = [], cFj = [], cTb;
  function numInput(parent, id, val, label) {
    var inp = h('input', { type: 'number', id: id, min: 0, step: 1, value: val, inputmode: 'decimal', 'aria-label': label }, parent);
    inp.addEventListener('input', onInputs);
    return inp;
  }
  function blanks(row, n) { for (var q = 0; q < n; q++) h('td', null, row); }
  var hr = h('tr', null, h('thead', null, tbl));
  h('th', { scope: 'col', html: '<span class="gf-zn">From ↓</span>to →' }, hr);
  NAMES.forEach(function (nm, j) { h('th', { scope: 'col', html: '<span class="gf-zn">' + (j + 1) + '</span>' + nm }, hr); });
  h('th', { scope: 'col', html: v('P', 'i', 'b') }, hr);
  h('th', { scope: 'col', html: v('P', 'i', 'h') }, hr);
  h('th', { scope: 'col', html: v('f', 'i') }, hr);
  var tbody = h('tbody', null, tbl);
  Z.forEach(function (i) {
    var row = h('tr', null, tbody);
    h('th', { scope: 'row', text: (i + 1) + ' ' + NAMES[i] }, row);
    inT.push([]); tdT.push([]);
    Z.forEach(function (j) {
      var td = h('td', null, row);
      tdT[i].push(td);
      inT[i].push(numInput(td, 'gf-t' + (i + 1) + (j + 1), st.t0[i][j], '2026 trips from ' + NAMES[i] + ' to ' + NAMES[j]));
    });
    cPb.push(h('td', { class: 'gf-calc' }, row));
    inP.push(numInput(h('td', null, row), 'gf-P' + (i + 1), st.P[i], '2028 productions of ' + NAMES[i]));
    cFi.push(h('td', { class: 'gf-calc gf-fac' }, row));
  });
  var rAb = h('tr', { class: 'gf-sum-row' }, tbody);
  h('th', { scope: 'row', html: v('a', 'j', 'b') }, rAb);
  Z.forEach(function () { cAb.push(h('td', { class: 'gf-calc' }, rAb)); });
  cTb = h('td', { class: 'gf-calc', title: 'All 2026 trips' }, rAb);
  blanks(rAb, 2);
  var rAh = h('tr', null, tbody);
  h('th', { scope: 'row', html: v('a', 'j', 'h') }, rAh);
  Z.forEach(function (j) { inA.push(numInput(h('td', null, rAh), 'gf-a' + (j + 1), st.a[j], '2028 attractions of ' + NAMES[j])); });
  blanks(rAh, 3);
  var rFj = h('tr', null, tbody);
  h('th', { scope: 'row', html: v('f', 'j') }, rFj);
  Z.forEach(function () { cFj.push(h('td', { class: 'gf-calc gf-fac' }, rFj)); });
  blanks(rFj, 3);

  var side = h('div', { class: 'gf-side' }, band);
  h('p', { class: 'ctl-label', text: 'Inputs' }, side);
  h('p', {
    html: 'White boxes: the 2026 trips ' + v('t', 'ij', 'b') + ' from an old survey, and the 2028 targets ' + v('P', 'i', 'h') + ' and ' + v('a', 'j', 'h')
      + ' from trip generation. ' + v('P', 'i', 'b') + ' and ' + v('a', 'j', 'b') + ' are the 2026 row and column totals, so the growth factors are '
      + v('f', 'i') + ' = ' + v('P', 'i', 'h') + ' / ' + v('P', 'i', 'b') + ' and ' + v('f', 'j') + ' = ' + v('a', 'j', 'h') + ' / ' + v('a', 'j', 'b') + '.'
  }, side);
  var sideTotals = h('p', { class: 'gf-totals' }, side);
  var warn = h('div', { class: 'gm-warn', hidden: true }, body);

  // Calculation on the left; forecast table and chart stacked on the right; the iteration log runs full width below.
  var split = h('div', { class: 'split gm-split' }, body);
  var howPanel = h('div', { class: 'panel gf-how' }, split);
  var right = h('div', { class: 'gf-right' }, split);
  var tablePanel = h('div', { class: 'panel' }, right);
  var chartPanel = h('div', { class: 'panel' }, right);
  var logPanel = h('div', { class: 'panel gf-log-panel' }, body);
  h('h3', { text: 'Largest gap after each pass' }, chartPanel);
  var chart = s('svg', { viewBox: '0 0 520 206', class: 'gm-chart', role: 'img', 'aria-labelledby': 'gf-chart-t' }, chartPanel);
  var chartTitle = s('title', { id: 'gf-chart-t' }, chart);
  var legend = h('div', { class: 'gf-legend' }, chartPanel);
  h('p', {
    class: 'gm-note',
    html: 'Gap = the largest difference, in trips, between a row total and ' + v('P', 'i', 'h') + ' or a column total and ' + v('a', 'j', 'h') + '. Pass 0 is the 2026 table.'
  }, chartPanel);

  // ---------- rendering ----------
  function renderInputsCalc() {
    var tot = totals(st.t0), Th = sumP();
    // Mark f_i and f_j only while the calculation shown uses them: average or Fratar, pass 1.
    var used = st.ok && st.method !== 'uniform' && st.cur[st.method] === 1;
    Z.forEach(function (i) {
      cPb[i].textContent = num(tot.rows[i]);
      cFi[i].textContent = tot.rows[i] > 0 ? fac(st.P[i] / tot.rows[i]) : '—';
      cFi[i].classList.toggle('is-sel', used && i === st.sel[0]);
    });
    Z.forEach(function (j) {
      cAb[j].textContent = num(tot.cols[j]);
      cFj[j].textContent = tot.cols[j] > 0 ? fac(st.a[j] / tot.cols[j]) : '—';
      cFj[j].classList.toggle('is-sel', used && j === st.sel[1]);
    });
    cTb.textContent = num(tot.sum);
    Z.forEach(function (i) { Z.forEach(function (j) { tdT[i][j].classList.toggle('is-sel', i === st.sel[0] && j === st.sel[1]); }); });
    sideTotals.innerHTML = '<span>' + v('T', null, 'b') + ' = ' + num(tot.sum) + ' trips in 2026</span>'
      + '<span>' + v('T', null, 'h') + ' = ' + num(Th) + ' in 2028</span>'
      + '<span>Uniform ' + v('f') + ' = ' + v('T', null, 'h') + ' / ' + v('T', null, 'b') + ' = ' + (tot.sum > 0 ? fac(Th / tot.sum) : '—') + '</span>';
  }

  function explain(m, k, p) {
    var i = st.sel[0], j = st.sel[1], other, d;
    if (m === 'uniform') {
      var f = p.f, grow = f >= 1 ? 'grows by ' + fmt.dec((f - 1) * 100, 0) + ' percent' : 'shrinks by ' + fmt.dec((1 - f) * 100, 0) + ' percent';
      if (p.gap < TOL) return 'Every trip ' + grow + '. Every zone grows at that same rate here, so every total matches and all three methods give this table.';
      return 'Every trip ' + grow + '. The table now adds up to ' + v('T', null, 'h') + ' = ' + num(sumP()) + ', but the zones grow at different rates, so their totals miss: '
        + missWords(p.worst) + '. Uniform cannot fix that: a second pass would use <span class="nowrap">' + v('f') + ' = ' + num(sumP()) + ' / ' + num(sumP()) + ' = 1</span>.';
    }
    if (p.gap < TOL) {
      other = m === 'average' ? 'fratar' : 'average';
      var cmp = settled(other) ? (m === 'average' ? 'Fratar needs ' : 'The average method needs ') + passes(st.runs[other].length) + '.' : '';
      var diff = '';
      if (settled('average') && settled('fratar')) {
        var A = st.runs.average[st.runs.average.length - 1].t, F = st.runs.fratar[st.runs.fratar.length - 1].t;
        d = 0;
        Z.forEach(function (r) { Z.forEach(function (c) { d = Math.max(d, Math.abs(A[r][c] - F[r][c])); }); });
        if (d >= 0.05) diff = ' Average and Fratar both match every total, yet their tables differ by up to ' + tr(d) + ' trips in a cell: six totals do not pin down nine cells.';
      }
      return '<strong>Settled after ' + passes(k) + '</strong>: every total is within ' + TOL + ' trips of its target. ' + cmp + diff;
    }
    var last = k === st.runs[m].length;
    if (last) return 'Still off by ' + tr(p.gap) + ' trips after ' + passes(k) + '. With these inputs the method does not settle.';
    if (k > 1) return 'Same rule, with factors from the latest table’s totals. They move closer to 1 each pass; the largest gap is now <strong>' + tr(p.gap) + '</strong> trips.';
    if (m === 'average') {
      return 'This trip grows by ' + fac(p.mult[i][j]) + ', halfway between the two factors. The totals still miss: ' + missWords(p.worst)
        + '. Averaging pulls every trip toward the growth of its other end, so the next pass computes new factors from this table and repeats.';
    }
    var over = p.fi[i] * p.si[i];
    return 'If each trip from ' + NAMES[i] + ' grew by ' + v('f', 'i') + ' × ' + v('f', 'j') + ' alone, they would add up to ' + fac(p.fi[i]) + ' × ' + num(p.si[i]) + ' = ' + tr(over)
      + ', not ' + num(st.P[i]) + '. ' + v('l', 'i') + ' = ' + fac(p.li[i]) + ' (= ' + num(st.P[i]) + ' / ' + tr(over) + ') scales them back to exactly ' + num(st.P[i])
      + ', and ' + v('l', 'j') + ' does the same for the trips to ' + NAMES[j]
      + '. Fratar averages the two, so after one pass every total is within <strong>' + tr(p.gap) + '</strong> trips.';
  }

  function renderHow() {
    var m = st.method, k = st.cur[m], p = current();
    var i = st.sel[0], j = st.sel[1], I = i + 1, J = j + 1, ij = '' + I + J, first = k === 1;
    var tb = p.prev[i][j], tn = p.t[i][j];
    var lhs = first ? v('t', ij, 'h') : v('t', ij) + ' (pass ' + k + ')';
    var base = first ? v('t', ij, 'b') : v('t', ij) + ' (pass ' + (k - 1) + ')';
    var rowW = first ? v('P', I, 'b') : 'row ' + I + ' total', colW = first ? v('a', J, 'b') : 'column ' + J + ' total';
    var html = '<h3>Pass ' + k + ' • ' + LABEL[m] + ' method</h3><p>' + RULE[m] + ' Selected trip: <strong>' + NAMES[i] + ' → ' + NAMES[j] + '</strong>.</p><div class="gm-eqs">';
    if (m === 'uniform') {
      html += eq([v('f') + ' = ' + v('T', null, 'h') + ' / ' + v('T', null, 'b') + ' = ' + num(sumP()) + ' / ' + num(p.prevTot.sum) + ' = <b>' + fac(p.f) + '</b>']);
      html += eq([lhs + ' = ' + base + ' × ' + v('f'), '= ' + num(tb) + ' × ' + fac(p.f) + ' = <b>' + tr(tn) + '</b>']);
    } else {
      var fi = p.fi[i], fj = p.fj[j];
      html += eq([v('f', 'i') + ' = ' + v('P', I, 'h') + ' / ' + rowW + ' = ' + num(st.P[i]) + ' / ' + num(p.prevTot.rows[i]) + ' = <b>' + fac(fi) + '</b>']);
      html += eq([v('f', 'j') + ' = ' + v('a', J, 'h') + ' / ' + colW + ' = ' + num(st.a[j]) + ' / ' + num(p.prevTot.cols[j]) + ' = <b>' + fac(fj) + '</b>']);
      if (m === 'average') {
        html += eq([lhs + ' = ' + base + ' × (' + v('f', 'i') + ' + ' + v('f', 'j') + ') / 2',
          '= ' + num(tb) + ' × (' + fac(fi) + ' + ' + fac(fj) + ') / 2',
          '= ' + num(tb) + ' × ' + fac(p.mult[i][j]) + ' = <b>' + tr(tn) + '</b>']);
      } else {
        var li = p.li[i], lj = p.lj[j];
        var termsI = Z.map(function (c) { return num(p.prev[i][c]) + ' × ' + fac(p.fj[c]); }).join(' + ');
        var termsJ = Z.map(function (r) { return num(p.prev[r][j]) + ' × ' + fac(p.fi[r]); }).join(' + ');
        html += eq([v('l', 'i') + ' = ' + rowW + ' / ' + sigma('j') + v('t', I + 'j', first ? 'b' : null) + '&thinsp;' + v('f', 'j'),
          '= ' + num(p.prevTot.rows[i]) + ' / (' + termsI + ')',
          '= ' + num(p.prevTot.rows[i]) + ' / ' + num(p.si[i]) + ' = <b>' + fac(li) + '</b>']);
        html += eq([v('l', 'j') + ' = ' + colW + ' / ' + sigma('i') + v('t', 'i' + J, first ? 'b' : null) + '&thinsp;' + v('f', 'i'),
          '= ' + num(p.prevTot.cols[j]) + ' / (' + termsJ + ')',
          '= ' + num(p.prevTot.cols[j]) + ' / ' + num(p.sj[j]) + ' = <b>' + fac(lj) + '</b>']);
        html += eq([lhs + ' = ' + base + ' × ' + v('f', 'i') + ' × ' + v('f', 'j') + ' × (' + v('l', 'i') + ' + ' + v('l', 'j') + ') / 2',
          '= ' + num(tb) + ' × ' + fac(fi) + ' × ' + fac(fj) + ' × (' + fac(li) + ' + ' + fac(lj) + ') / 2',
          '= <b>' + tr(tn) + '</b>']);
      }
    }
    html += '</div><p>' + explain(m, k, p) + '</p>';
    howPanel.innerHTML = html;
  }

  function totCell(x, d) { return '<td><span class="gf-totc">' + tr(x) + chip(d) + '</span></td>'; }
  function renderTable() {
    var k = st.cur[st.method], p = current();
    var html = '<h3>2028 forecast after pass ' + k + '</h3><div class="table-wrap"><table class="data gm-table gf-table' + (st.flash ? ' gf-flash' : '') + '"><thead><tr>'
      + '<th scope="col"><span class="gf-zn">From ↓</span>to →</th>'
      + NAMES.map(function (nm, j) { return '<th scope="col"><span class="gf-zn">' + (j + 1) + '</span>' + nm + '</th>'; }).join('')
      + '<th scope="col">Row total</th><th scope="col">' + v('P', 'i', 'h') + '</th></tr></thead><tbody>';
    Z.forEach(function (i) {
      html += '<tr><th scope="row">' + (i + 1) + ' ' + NAMES[i] + '</th>';
      Z.forEach(function (j) {
        var t = p.t[i][j], b = st.t0[i][j], g = b > 0 ? t / b : null, on = i === st.sel[0] && j === st.sel[1];
        html += '<td class="gf-td' + (on ? ' is-sel' : '') + '"><button type="button" class="gf-cell" data-cell="' + i + ',' + j + '" aria-pressed="' + on + '"'
          + ' aria-label="' + NAMES[i] + ' to ' + NAMES[j] + ': ' + tr(t) + ' trips. Show the calculation.">'
          + '<span class="gf-val">' + tr(t) + '</span><span class="gf-mult' + (g !== null && g < 0.995 ? ' down' : '') + '">'
          + (g === null ? 'was 0' : '×' + fmt.dec(g, 2)) + '</span></button></td>';
      });
      html += totCell(p.tot.rows[i], p.tot.rows[i] - st.P[i]) + '<td>' + num(st.P[i]) + '</td></tr>';
    });
    html += '<tr class="gm-tot"><th scope="row">Column total</th>' + Z.map(function (j) { return totCell(p.tot.cols[j], p.tot.cols[j] - st.a[j]); }).join('')
      + '<td>' + tr(p.tot.sum) + '</td><td></td></tr>'
      + '<tr><th scope="row">' + v('a', 'j', 'h') + '</th>' + Z.map(function (j) { return '<td>' + num(st.a[j]) + '</td>'; }).join('')
      + '<td></td><td>' + num(sumP()) + '</td></tr></tbody></table></div>';
    html += '<p class="gm-note">Small numbers: growth since 2026, ' + v('t', 'ij') + ' / ' + v('t', 'ij', 'b') + '. Click a cell to see its calculation.</p>';
    tablePanel.innerHTML = html;
  }

  function renderLog() {
    var m = st.method, k = st.cur[m], r = st.runs[m];
    var html = '<h3>Iteration log • ' + LABEL[m] + '</h3><div class="table-wrap gm-log"><table class="data gf-log"><thead><tr><th scope="col">Pass</th>';
    html += m === 'uniform' ? '<th scope="col">' + v('f') + ', every cell</th>'
      : '<th scope="col">' + v('f', 'i') + ', origins 1–3</th><th scope="col">' + v('f', 'j') + ', destinations 1–3</th>';
    if (m === 'fratar') html += '<th scope="col">' + v('l', 'i') + ', origins 1–3</th><th scope="col">' + v('l', 'j') + ', destinations 1–3</th>';
    html += '<th scope="col">Gap after the pass</th></tr></thead><tbody>';
    for (var q = 0; q < k; q++) {
      var p = r[q];
      html += '<tr' + (q === k - 1 ? ' class="is-active"' : '') + '><th scope="row">' + (q + 1) + '</th>'
        + (m === 'uniform' ? '<td>' + fac(p.f) + '</td>' : '<td>' + trio(p.fi) + '</td><td>' + trio(p.fj) + '</td>')
        + (m === 'fratar' ? '<td>' + trio(p.li) + '</td><td>' + trio(p.lj) + '</td>' : '')
        + '<td>' + fmt.dec(p.gap, p.gap < 1 ? 2 : 1) + '</td></tr>';
    }
    html += '</tbody></table></div><p class="gm-note">'
      + (m === 'uniform' ? 'One factor for the whole table, so there is nothing to iterate.'
        : 'Each pass computes new factors from the latest totals. They move toward 1 as the table settles.') + '</p>';
    logPanel.innerHTML = html;
    var box = logPanel.querySelector('.gm-log');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function renderChart() {
    while (chart.lastChild && chart.lastChild !== chartTitle) chart.removeChild(chart.lastChild);
    var L = 46, R = 506, T = 18, B = 166, g0 = st.gap0 || 1;
    var K = Math.max(6, st.runs.average.length, st.runs.fratar.length);
    function X(k) { return L + (R - L) * k / K; }
    function Y(g) { return B - (B - T) * Math.min(g, g0) / g0; }
    function pts(m, upto) {
      var out = [[0, g0]];
      st.runs[m].slice(0, upto).forEach(function (p, q) { out.push([q + 1, p.gap]); });
      return out;
    }
    function attr(list) { return list.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' '); }
    // Round tick values (0, 50, 100 for a 125-trip start).
    var raw = g0 / 2.5, pow = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), mant = raw / pow;
    var step = (mant < 1.5 ? 1 : mant < 3.5 ? 2 : mant < 7.5 ? 5 : 10) * pow;
    for (var tv = 0; tv <= g0 + 1e-9; tv += step) {
      s('line', { x1: L, y1: Y(tv), x2: R, y2: Y(tv), class: 'gm-grid' }, chart);
      s('text', { x: L - 8, y: Y(tv) + 4, 'text-anchor': 'end', class: 't-small t-num', text: fmt.dec(tv, step < 1 ? 1 : 0) }, chart);
    }
    var every = K <= 12 ? 1 : K <= 30 ? 5 : 10;
    for (var k = 0; k <= K; k += every) s('text', { x: X(k), y: B + 17, 'text-anchor': 'middle', class: 't-small t-num', text: k }, chart);
    s('text', { x: (L + R) / 2, y: 200, 'text-anchor': 'middle', class: 't-small', text: 'Pass' }, chart);
    METHODS.forEach(function (m) {
      s('polyline', { points: attr(pts(m)), class: 'gf-line gf-' + m }, chart);
      if (m === 'uniform' && !settled('uniform')) {
        var g1 = st.runs.uniform[0].gap;
        s('line', { x1: X(1), y1: Y(g1), x2: X(K), y2: Y(g1), class: 'gf-line gf-uniform gf-ext' }, chart);
      }
    });
    var m = st.method, cur = st.cur[m], mine = pts(m, cur);
    s('polyline', { points: attr(mine), class: 'gf-line gf-' + m + ' cur' }, chart);
    mine.forEach(function (p, q) {
      s('circle', { cx: X(p[0]), cy: Y(p[1]), r: q === cur ? 5.5 : 3.5, class: 'gf-dot gf-fill-' + m }, chart);
    });
    var gk = mine[mine.length - 1][1];
    s('text', { x: X(cur), y: Y(gk) - 11, 'text-anchor': X(cur) > R - 20 ? 'end' : 'middle', class: 't-small t-num t-strong t-halo', text: fmt.dec(gk, gk < 1 ? 2 : 1) }, chart);
    function sumUp(mm) {
      var r = st.runs[mm], last = r[r.length - 1];
      if (mm === 'uniform') return settled(mm) ? 'matches in 1 pass' : 'one pass, gap stays ' + tr(last.gap);
      return settled(mm) ? 'settles in ' + passes(r.length) : 'not settled after ' + passes(r.length);
    }
    legend.innerHTML = METHODS.map(function (mm) {
      return '<span class="item' + (mm === m ? ' cur' : '') + '"><span class="gf-key gf-key-' + mm + '"></span>' + LABEL[mm] + ': ' + sumUp(mm) + '</span>';
    }).join('');
    chartTitle.textContent = 'Line chart of the largest gap, in trips, after each pass. Starting from ' + fmt.dec(g0, 1) + ' trips: uniform '
      + sumUp('uniform') + '; average ' + sumUp('average') + '; Fratar ' + sumUp('fratar') + '.';
  }

  function render() {
    renderInputsCalc();
    if (!st.ok) {
      bNext.disabled = bRun.disabled = bReset.disabled = true;
      status.textContent = 'Fix the inputs'; status.className = 'chip warn';
      return;
    }
    var m = st.method, k = st.cur[m], len = st.runs[m].length, p = current();
    bNext.disabled = bRun.disabled = k >= len; bReset.disabled = k <= 1;
    if (p.gap < TOL) { status.className = 'chip ok'; status.textContent = 'Settled after ' + passes(k); }
    else if (m === 'uniform') { status.className = 'chip'; status.textContent = 'One pass only • gap ' + tr(p.gap); }
    else if (k >= len) { status.className = 'chip warn'; status.textContent = 'Not settled after ' + passes(k); }
    else { status.className = 'chip'; status.textContent = 'Pass ' + k + ' • gap ' + tr(p.gap) + ' trips'; }
    renderHow(); renderTable(); renderLog(); renderChart();
    st.flash = false;
  }

  // ---------- events ----------
  function pick(m) { if (METHODS.indexOf(m) < 0) return; st.method = m; seg.set(m); render(); }
  bReset.addEventListener('click', function () { st.cur[st.method] = 1; st.flash = true; render(); });
  bNext.addEventListener('click', function () {
    if (st.ok && st.cur[st.method] < st.runs[st.method].length) { st.cur[st.method]++; st.flash = true; render(); }
  });
  bRun.addEventListener('click', function () { if (st.ok) { st.cur[st.method] = st.runs[st.method].length; st.flash = true; render(); } });
  tablePanel.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-cell]') : null;
    if (!b) return;
    var ij = b.getAttribute('data-cell').split(',');
    st.sel = [Number(ij[0]), Number(ij[1])];
    render();
    var nb = tablePanel.querySelector('[data-cell="' + st.sel.join(',') + '"]');
    if (nb) nb.focus();
  });
  // Slide chips in the page header can pick a method (data-gf-method="average", ...).
  Array.prototype.forEach.call(document.querySelectorAll('a[data-gf-method]'), function (a) {
    a.addEventListener('click', function () { pick(a.getAttribute('data-gf-method')); });
  });

  function showWarn(html) { warn.hidden = false; warn.innerHTML = html; }
  function onInputs() {
    var val = function (el) { var x = parseFloat(el.value); return isFinite(x) ? x : NaN; };
    var t = inT.map(function (r) { return r.map(val); }), P = inP.map(val), a = inA.map(val);
    var all = t[0].concat(t[1], t[2], P, a);
    warn.hidden = true; warn.innerHTML = '';
    if (all.some(function (x) { return !(x >= 0); })) {
      st.ok = false; showWarn('Use a number of zero or more in every white box.'); render(); return;
    }
    st.t0 = t; st.P = P; st.a = a;
    var tot = totals(t), msg = '';
    Z.forEach(function (q) {
      if (!msg && !(tot.rows[q] > 0)) msg = NAMES[q] + ' has no 2026 trips leaving it, so no growth factor can give it any in 2028 (slide 17). Enter at least one trip in its row.';
      if (!msg && !(tot.cols[q] > 0)) msg = NAMES[q] + ' has no 2026 trips arriving, so no growth factor can give it any in 2028 (slide 17). Enter at least one trip in its column.';
    });
    if (msg) { st.ok = false; showWarn(msg); render(); return; }
    var sp = sumP(), sa = a.reduce(add, 0);
    if (Math.abs(sp - sa) > 0.5) {
      st.ok = false;
      showWarn('2028 productions add up to <strong>' + num(sp) + '</strong> but attractions to <strong>' + num(sa)
        + '</strong>. Every trip has both ends, so the targets must agree before any table can match them. ');
      var fix = h('button', { type: 'button', class: 'btn', id: 'gf-balance', text: 'Scale attractions to ' + num(sp) }, warn);
      fix.addEventListener('click', function () {
        var k = sp / sa, acc = 0;
        Z.forEach(function (j) {
          var x = j < N - 1 ? Math.round(a[j] * k * 10) / 10 : Math.round((sp - acc) * 10) / 10;
          acc += x; inA[j].value = x;
        });
        onInputs();
      });
      render(); return;
    }
    st.ok = true; recompute(); render();
  }

  recompute();
  seg.set(st.method);
  render();
});
