/* Oct 27 lecture (trip distribution), slide 23: the doubly constrained gravity model solved by iteration.
   t_ij = B_i D_j P_i a_j f_ij with f_ij = d_ij^-2 (slide 19). Start with every D_j = 1, then alternate
   B_i = 1 / sum_j D_j a_j f_ij  (rows match productions) and  D_j = 1 / sum_i B_i P_i f_ij  (columns match attractions). */
Lab.register('demo-gravity', function (root) {
  var h = Lab.h, s = Lab.s, fmt = Lab.fmt;
  var NAMES = ['Eastfield', 'Downtown'];
  var DEF = { P: [300, 200], a: [150, 350], d: [[2, 4], [4, 2]] };
  var TOL = 0.05, MAX_STEPS = 60;
  var st = { P: DEF.P.slice(), a: DEF.a.slice(), d: DEF.d.map(function (r) { return r.slice(); }), steps: [], ok: true };

  // ---------- math ----------
  function F() { return st.d.map(function (r) { return r.map(function (x) { return Math.pow(x, -2); }); }); }
  function evaluate(B, D) {
    var f = F(), t = [[0, 0], [0, 0]], rows = [0, 0], cols = [0, 0];
    for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
      t[i][j] = B[i] * D[j] * st.P[i] * st.a[j] * f[i][j];
      rows[i] += t[i][j]; cols[j] += t[i][j];
    }
    var rowGap = Math.max(Math.abs(rows[0] - st.P[0]), Math.abs(rows[1] - st.P[1]));
    var colGap = Math.max(Math.abs(cols[0] - st.a[0]), Math.abs(cols[1] - st.a[1]));
    return { t: t, rows: rows, cols: cols, rowGap: rowGap, colGap: colGap, gap: Math.max(rowGap, colGap) };
  }
  function addStep() {
    var f = F(), n = st.steps.length, prev = st.steps[n - 1];
    var B = prev ? prev.B.slice() : [NaN, NaN], D = prev ? prev.D.slice() : [1, 1];
    var kind = n % 2 === 0 ? 'B' : 'D', terms = [], sums = [];
    for (var k = 0; k < 2; k++) {
      var tm = kind === 'B'
        ? [D[0] * st.a[0] * f[k][0], D[1] * st.a[1] * f[k][1]]
        : [B[0] * st.P[0] * f[0][k], B[1] * st.P[1] * f[1][k]];
      terms.push(tm); sums.push(tm[0] + tm[1]);
      if (kind === 'B') B[k] = 1 / sums[k]; else D[k] = 1 / sums[k];
    }
    var ev = evaluate(B, D);
    st.steps.push({ kind: kind, B: B, D: D, terms: terms, sums: sums, ev: ev });
  }
  function converged() { var l = st.steps[st.steps.length - 1]; return !!l && l.ev.gap < TOL; }

  // ---------- formatting ----------
  function sig(x) { return Number(x).toPrecision(5); }
  function f4(x) { return Number(x).toFixed(4); }
  function v(name, sub) { return '<span class="mvw"><i class="mv">' + name + '</i><sub>' + sub + '</sub></span>'; }
  function eq(lhs, symbolic, numbers, sum, result) {
    return '<div class="gm-eq"><div>' + lhs + ' = 1 / (' + symbolic + ')</div>'
      + '<div class="cont">= 1 / (' + numbers + ')</div>'
      + '<div class="cont">= 1 / ' + sum + ' = <b>' + result + '</b></div></div>';
  }
  function n0(x) { return fmt.int(x); }

  // ---------- layout ----------
  var body = Lab.mount(root);
  var bar = h('div', { class: 'demo-bar' }, body);
  var gA = h('div', { class: 'group' }, bar);
  var bReset = h('button', { type: 'button', class: 'btn', id: 'gm-reset', text: '↺ Start over (D = 1)' }, gA);
  var bNext = h('button', { type: 'button', class: 'btn primary', id: 'gm-next', text: 'Next step →' }, gA);
  var bRun = h('button', { type: 'button', class: 'btn', id: 'gm-run', text: 'Run to the end' }, gA);
  var status = h('span', { class: 'chip', 'aria-live': 'polite' }, gA);

  var bar2 = h('div', { class: 'demo-bar gm-inputs' }, body);
  var inputs = {};
  function numIn(group, key, label, val, step) {
    var lab = h('label', { class: 'gm-in', for: 'gm-' + key }, group);
    h('span', { html: label }, lab);
    inputs[key] = h('input', { type: 'number', id: 'gm-' + key, min: step === 1 ? 1 : 0.1, step: step, value: val, inputmode: 'decimal' }, lab);
    inputs[key].addEventListener('input', onInputs);
  }
  var g1 = h('div', { class: 'group' }, bar2);
  h('span', { class: 'ctl-label', text: 'Productions' }, g1);
  numIn(g1, 'P1', v('P', 1), st.P[0], 1); numIn(g1, 'P2', v('P', 2), st.P[1], 1);
  var g2 = h('div', { class: 'group' }, bar2);
  h('span', { class: 'ctl-label', text: 'Attractions' }, g2);
  numIn(g2, 'a1', v('a', 1), st.a[0], 1); numIn(g2, 'a2', v('a', 2), st.a[1], 1);
  var g3 = h('div', { class: 'group' }, bar2);
  h('span', { class: 'ctl-label', html: 'Distances (<i class="mv">f</i> = <i class="mv">d</i><sup>−2</sup>)' }, g3);
  numIn(g3, 'd11', v('d', 11), st.d[0][0], 0.5); numIn(g3, 'd12', v('d', 12), st.d[0][1], 0.5);
  numIn(g3, 'd21', v('d', 21), st.d[1][0], 0.5); numIn(g3, 'd22', v('d', 22), st.d[1][1], 0.5);
  var warn = h('div', { class: 'gm-warn', hidden: true }, body);

  var split = h('div', { class: 'split gm-split' }, body);
  var stepPanel = h('div', { class: 'panel gm-step', 'aria-live': 'polite' }, split);
  var tablePanel = h('div', { class: 'panel' }, split);
  var split2 = h('div', { class: 'split gm-split gm-lower' }, body);
  var logPanel = h('div', { class: 'panel' }, split2);
  var chartPanel = h('div', { class: 'panel' }, split2);
  h('h3', { text: 'Largest constraint gap after each step' }, chartPanel);
  var chart = s('svg', { viewBox: '0 0 520 200', class: 'gm-chart', role: 'img', 'aria-labelledby': 'gm-chart-t' }, chartPanel);
  var chartTitle = s('title', { id: 'gm-chart-t' }, chart);
  h('p', { class: 'gm-note', text: 'Gap = the largest difference, in trips, between a row total and its productions or a column total and its attractions.' }, chartPanel);

  // ---------- rendering ----------
  function chip(diff) {
    return Math.abs(diff) < TOL ? '<span class="chip ok">✓</span>' : '<span class="chip bad">' + fmt.signed(diff, 1) + '</span>';
  }
  function renderStep() {
    var k = st.steps.length - 1, sp = st.steps[k], html;
    if (sp.kind === 'B') {
      html = '<h3>Step ' + (k + 1) + ' • update ' + v('B', 'i') + ' (rows)</h3>';
      if (k === 0) html += '<p>Start with ' + v('D', 1) + ' = ' + v('D', 2) + ' = 1. That is the singly constrained gravity model.</p>';
      html += '<div class="gm-eqs">';
      for (var i = 0; i < 2; i++) {
        var I = i + 1;
        html += eq(v('B', I),
          v('D', 1) + v('a', 1) + v('f', I + '1') + ' + ' + v('D', 2) + v('a', 2) + v('f', I + '2'),
          f4(sp.D[0]) + ' × ' + n0(st.a[0]) + ' × ' + f4(F()[i][0]) + ' + ' + f4(sp.D[1]) + ' × ' + n0(st.a[1]) + ' × ' + f4(F()[i][1]),
          sig(sp.sums[i]), sig(sp.B[i]));
      }
      html += '</div>';
    } else {
      html = '<h3>Step ' + (k + 1) + ' • update ' + v('D', 'j') + ' (columns)</h3><div class="gm-eqs">';
      for (var j = 0; j < 2; j++) {
        var J = j + 1;
        html += eq(v('D', J),
          v('B', 1) + v('P', 1) + v('f', '1' + J) + ' + ' + v('B', 2) + v('P', 2) + v('f', '2' + J),
          sig(sp.B[0]) + ' × ' + n0(st.P[0]) + ' × ' + f4(F()[0][j]) + ' + ' + sig(sp.B[1]) + ' × ' + n0(st.P[1]) + ' × ' + f4(F()[1][j]),
          sig(sp.sums[j]), sig(sp.D[j]));
      }
      html += '</div>';
    }
    var e = sp.ev, words;
    if (e.gap < TOL) words = '<strong>Converged.</strong> Every row matches its productions and every column its attractions to within 0.05 trips, after ' + (k + 1) + ' steps (' + Math.ceil((k + 1) / 2) + ' rounds of ' + v('B', 'i') + ' and ' + v('D', 'j') + ').';
    else if (k === 0) words = 'Each row now adds up to its productions, but the columns miss the attractions by up to <strong>' + fmt.dec(e.colGap, 1) + '</strong> trips. That is why the doubly constrained model needs ' + v('D', 'j') + '.';
    else if (sp.kind === 'B') words = v('B', 'i') + ' rescales each row, so the rows match their productions again. The columns are now off by up to <strong>' + fmt.dec(e.colGap, 1) + '</strong> trips.';
    else words = v('D', 'j') + ' rescales each column, so the columns match their attractions. The rows are now off by up to <strong>' + fmt.dec(e.rowGap, 1) + '</strong> trips.';
    html += '<p>Then ' + v('t', 'ij') + ' = ' + v('B', 'i') + v('D', 'j') + v('P', 'i') + v('a', 'j') + v('f', 'ij') + '. ' + words + '</p>';
    stepPanel.innerHTML = html;
  }
  function renderTable() {
    var sp = st.steps[st.steps.length - 1], e = sp.ev, chB = sp.kind === 'B' ? ' gm-changed' : '', chD = sp.kind === 'D' ? ' gm-changed' : '';
    var html = '<h3>Trip table ' + v('t', 'ij') + '</h3><div class="table-wrap"><table class="data gm-table"><thead><tr><th scope="col">From ↓ to →</th>'
      + NAMES.map(function (nm, j) { return '<th scope="col">' + (j + 1) + ' ' + nm + '</th>'; }).join('')
      + '<th scope="col">Row total</th><th scope="col">' + v('P', 'i') + '</th></tr></thead><tbody>';
    for (var i = 0; i < 2; i++) {
      html += '<tr><th scope="row">' + (i + 1) + ' ' + NAMES[i] + '</th><td>' + fmt.dec(e.t[i][0], 1) + '</td><td>' + fmt.dec(e.t[i][1], 1) + '</td>'
        + '<td>' + fmt.dec(e.rows[i], 1) + ' ' + chip(e.rows[i] - st.P[i]) + '</td><td>' + n0(st.P[i]) + '</td></tr>';
    }
    html += '<tr class="gm-tot"><th scope="row">Column total</th>' + [0, 1].map(function (j) { return '<td>' + fmt.dec(e.cols[j], 1) + ' ' + chip(e.cols[j] - st.a[j]) + '</td>'; }).join('') + '<td></td><td></td></tr>'
      + '<tr><th scope="row">' + v('a', 'j') + '</th>' + [0, 1].map(function (j) { return '<td>' + n0(st.a[j]) + '</td>'; }).join('') + '<td></td><td></td></tr>'
      + '</tbody></table></div>';
    html += '<p class="gm-factors"><span class="' + chB.trim() + '">' + v('B', 1) + ' = ' + sig(sp.B[0]) + ', ' + v('B', 2) + ' = ' + sig(sp.B[1]) + '</span>'
      + '<span class="' + chD.trim() + '">' + v('D', 1) + ' = ' + sig(sp.D[0]) + ', ' + v('D', 2) + ' = ' + sig(sp.D[1]) + '</span></p>';
    html += '<p class="gm-note">Friction factors: ' + v('f', 11) + ' = ' + f4(F()[0][0]) + ', ' + v('f', 12) + ' = ' + f4(F()[0][1]) + ', ' + v('f', 21) + ' = ' + f4(F()[1][0]) + ', ' + v('f', 22) + ' = ' + f4(F()[1][1]) + '.</p>';
    tablePanel.innerHTML = html;
  }
  function renderLog() {
    var cur = st.steps.length - 1;
    var html = '<h3>Iteration log</h3><div class="table-wrap gm-log"><table class="data"><thead><tr><th scope="col">Step</th><th scope="col">Updated</th>'
      + '<th scope="col">' + v('B', 1) + '</th><th scope="col">' + v('B', 2) + '</th><th scope="col">' + v('D', 1) + '</th><th scope="col">' + v('D', 2) + '</th><th scope="col">Gap</th></tr></thead><tbody>';
    st.steps.forEach(function (sp, k) {
      html += '<tr class="' + (k === cur ? 'is-active' : '') + '"><th scope="row">' + (k + 1) + '</th><td>' + (sp.kind === 'B' ? v('B', 'i') + (k === 0 ? ' (all ' + v('D', 'j') + ' = 1)' : '') : v('D', 'j')) + '</td>'
        + '<td>' + sig(sp.B[0]) + '</td><td>' + sig(sp.B[1]) + '</td><td>' + sig(sp.D[0]) + '</td><td>' + sig(sp.D[1]) + '</td><td>' + fmt.dec(sp.ev.gap, sp.ev.gap < 1 ? 2 : 1) + '</td></tr>';
    });
    logPanel.innerHTML = html + '</tbody></table></div>';
    var box = logPanel.querySelector('.gm-log');
    if (box) box.scrollTop = box.scrollHeight;
  }
  function renderChart() {
    while (chart.lastChild && chart.lastChild !== chartTitle) chart.removeChild(chart.lastChild);
    var L = 46, R = 510, T = 22, Bt = 166, n = st.steps.length, slots = Math.max(10, n);
    var max = st.steps[0].ev.gap || 1, slot = (R - L) / slots, w = Math.min(26, slot * 0.62);
    function Y(g) { return Bt - (Bt - T) * Math.min(g, max) / max; }
    [0, 0.5, 1].forEach(function (q) {
      s('line', { x1: L, y1: Y(max * q), x2: R, y2: Y(max * q), class: 'gm-grid' }, chart);
      s('text', { x: L - 8, y: Y(max * q) + 4, 'text-anchor': 'end', class: 't-small t-num', text: fmt.dec(max * q, max * q < 10 && q > 0 ? 1 : 0) }, chart);
    });
    st.steps.forEach(function (sp, k) {
      var x = L + slot * (k + 0.5), y = Y(sp.ev.gap), cur = k === n - 1;
      s('rect', { x: x - w / 2, y: Math.min(y, Bt - 1), width: w, height: Math.max(1, Bt - y), rx: 3, class: cur ? 'gm-bar cur' : 'gm-bar' }, chart);
      s('text', { x: x, y: Bt + 16, 'text-anchor': 'middle', class: 't-small t-num', text: k + 1 }, chart);
      if (cur || k === 0) s('text', { x: x, y: Math.min(y, Bt - 1) - 6, 'text-anchor': 'middle', class: 't-small t-num t-strong', text: fmt.dec(sp.ev.gap, sp.ev.gap < 1 ? 2 : 1) }, chart);
    });
    s('text', { x: (L + R) / 2, y: 196, 'text-anchor': 'middle', class: 't-small', text: 'Step' }, chart);
    chartTitle.textContent = 'Bar chart of the largest constraint gap after each of ' + n + ' steps, falling from ' + fmt.dec(max, 1) + ' trips to ' + fmt.dec(st.steps[n - 1].ev.gap, 2) + '.';
  }
  function render() {
    var done = converged();
    bNext.disabled = !st.ok || done; bRun.disabled = !st.ok || done; bReset.disabled = !st.ok;
    if (!st.ok || !st.steps.length) { status.textContent = 'Fix the inputs'; status.className = 'chip warn'; return; }
    status.className = done ? 'chip ok' : 'chip';
    status.textContent = done ? 'Converged after ' + st.steps.length + ' steps' : 'Step ' + st.steps.length + ' • gap ' + fmt.dec(st.steps[st.steps.length - 1].ev.gap, 1) + ' trips';
    renderStep(); renderTable(); renderLog(); renderChart();
  }

  // ---------- inputs ----------
  function onInputs() {
    var val = function (k) { return parseFloat(inputs[k].value); };
    var P = [val('P1'), val('P2')], a = [val('a1'), val('a2')], d = [[val('d11'), val('d12')], [val('d21'), val('d22')]];
    var all = P.concat(a, d[0], d[1]);
    var bad = all.some(function (x) { return !(x > 0) || !isFinite(x); });
    warn.hidden = true;
    if (bad) {
      st.ok = false; warn.hidden = false;
      warn.innerHTML = 'Use positive numbers in every box.';
      render(); return;
    }
    st.P = P; st.a = a; st.d = d;
    var sp = P[0] + P[1], sa = a[0] + a[1];
    if (Math.abs(sp - sa) > 0.5) {
      st.ok = false; warn.hidden = false;
      warn.innerHTML = 'Productions add up to <strong>' + n0(sp) + '</strong> but attractions to <strong>' + n0(sa) + '</strong>. Rows and columns can both match only when the totals agree, so balance the attractions first. ';
      var fix = h('button', { type: 'button', class: 'btn', id: 'gm-balance', text: 'Scale attractions to ' + n0(sp) }, warn);
      fix.addEventListener('click', function () {
        var k = sp / sa;
        inputs.a1.value = Math.round(a[0] * k * 10) / 10; inputs.a2.value = Math.round((sp - Math.round(a[0] * k * 10) / 10) * 10) / 10;
        onInputs();
      });
      render(); return;
    }
    st.ok = true; restart();
  }
  function restart() { st.steps = []; addStep(); render(); }
  bReset.addEventListener('click', restart);
  bNext.addEventListener('click', function () { if (!converged()) { addStep(); render(); } });
  bRun.addEventListener('click', function () {
    var guard = 0;
    while (!converged() && guard++ < MAX_STEPS) addStep();
    render();
  });
  restart();
});
