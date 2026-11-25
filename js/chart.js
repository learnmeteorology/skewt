/* global Thermo */
// Chart geometry and drawing shared by the explorer and the how-it's-built page.
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const W = 820, H = 760;
  const BOX = { left: 52, right: 700, top: 18, bottom: 718 };
  const BARB_X = 755, PTOP = 100, PBOT = 1050, TMIN = -40, TMAX = 45;
  const PW = BOX.right - BOX.left, PH = BOX.bottom - BOX.top;
  const SKEW = 0.85; // horizontal shift per pixel of height

  const yOf = p => BOX.top + PH * Math.log(p / PTOP) / Math.log(PBOT / PTOP);
  const pOf = y => PTOP * Math.exp(((y - BOX.top) / PH) * Math.log(PBOT / PTOP));
  const xOf = (t, p) => BOX.left + ((t - TMIN) / (TMAX - TMIN)) * PW + SKEW * (BOX.bottom - yOf(p));
  const tOf = (x, p) => TMIN + ((x - SKEW * (BOX.bottom - yOf(p)) - BOX.left) / PW) * (TMAX - TMIN);

  const el = (name, attrs = {}, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const text = (parent, x, y, str, cls, anchor = 'middle') => {
    const n = el('text', { x, y, class: cls, 'text-anchor': anchor }, parent);
    n.textContent = str;
    return n;
  };
  const pathD = pts => pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('');
  const f1 = v => v.toFixed(1);
  const range = (a, b, s) => { const r = []; for (let v = a; v <= b + 1e-9; v += s) r.push(v); return r; };

  // Every 50 mb is numbered. Small screens have no room for one column, so there the numbers
  // between the hundreds move just inside the chart (see .fifty in style.css).
  const pLabelClass = p => (p % 100 === 0 ? 'axis pressure' : 'axis pressure fifty');

  // Background lines never change, so compute them once.
  const fine = range(PTOP, PBOT, 10);
  const background = [];
  for (let p = PTOP; p <= 1050; p += 50) background.push({ kind: 'isobar', value: p, pts: [[BOX.left, yOf(p)], [BOX.right, yOf(p)]] });
  for (const t of range(-110, 40, 10)) background.push({ kind: 'isotherm', value: t, pts: [[xOf(t, PBOT), yOf(PBOT)], [xOf(t, PTOP), yOf(PTOP)]] });
  for (const th of range(250, 440, 10)) background.push({ kind: 'dry', value: th, pts: fine.map(p => [xOf(Thermo.dryTemp(th, p), p), yOf(p)]) });
  for (const t0 of range(-10, 35, 5)) {
    const pts = [];
    let t = Thermo.moistTemp(t0, 1000, PBOT), p0 = PBOT;
    for (const p of fine.slice().reverse()) {
      t = Thermo.moistTemp(t, p0, p); p0 = p;
      if (p >= 150) pts.push([xOf(t, p), yOf(p)]);
    }
    background.push({ kind: 'moist', value: t0, pts });
  }
  for (const w of [0.4, 1, 2, 4, 7, 10, 16, 24]) {
    background.push({ kind: 'mix', value: w, pts: range(400, PBOT, 10).map(p => [xOf(Thermo.dewFromMixingRatio(w / 1000, p), p), yOf(p)]) });
  }

  function barb(parent, x, y, dir, spd) {
    const g = el('g', { class: 'barb', transform: `translate(${x} ${y})` }, parent);
    let left = Math.round(spd / 5) * 5;
    if (left < 5) { el('circle', { r: 4, fill: 'none' }, g); return; }
    const s = el('g', { transform: `rotate(${dir})` }, g);
    const len = 30;
    el('line', { x1: 0, y1: 0, x2: 0, y2: -len }, s);
    let at = -len;
    while (left >= 50) { el('path', { d: `M0 ${at}L12 ${at + 2}L0 ${at + 7}Z`, class: 'flag' }, s); at += 9; left -= 50; }
    while (left >= 10) { el('line', { x1: 0, y1: at, x2: 12, y2: at - 5 }, s); at += 5; left -= 10; }
    if (left >= 5) {
      if (at === -len) at += 5;
      el('line', { x1: 0, y1: at, x2: 6, y2: at - 2.5 }, s);
    }
  }

  // A pointer event's position in chart units. The browser's own transform allows for the empty
  // space around a chart whose box is a different shape from the drawing.
  const toChart = (svg, e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());

  // Shade between the parcel and temperature lines.
  function shade(par, parent, from, to, sign, cls) {
    const pts = par.path.filter(q => q.p <= from + 1e-6 && q.p >= to - 1e-6);
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        const a = run.map(q => [xOf(q.cmp, q.p), yOf(q.p)]);
        const b = run.map(q => [xOf(q.envCmp, q.p), yOf(q.p)]).reverse();
        el('path', { d: pathD(a.concat(b)) + 'Z', class: cls }, parent);
      }
      run = [];
    };
    for (const q of pts) { if (q.b * sign > 0) run.push(q); else flush(); }
    flush();
  }

  // A short labelled line marking one level (LCL, LFC or EL), ending at x2. A pale edge underneath
  // keeps it readable over the background lines. Returns its two end points.
  function marker(parent, label, y, x2) {
    const group = el('g', { class: 'level-mark' }, parent), x1 = x2 - 40;
    for (const cls of ['marker-halo', 'marker']) el('line', { x1, y1: y, x2, y2: y, class: cls }, group);
    text(group, x2 - 20, y - 7, label, 'markerlabel');
    return [[x1, y], [x2, y]];
  }

  // Fills a list with a close-up of each wind barb mark and its speed, drawn the same way as the
  // barbs on the chart (shown here for a wind from the west).
  function barbKey(list) {
    for (const [speed, name] of [[5, 'Half barb'], [10, 'Full barb'], [50, 'Flag']]) {
      const item = document.createElement('li'), words = document.createElement('span'), value = document.createElement('strong');
      barb(el('svg', { viewBox: '-38 -16 42 20', 'aria-hidden': 'true' }, item), 0, 0, 270, speed);
      value.textContent = `${speed} knots`;
      words.append(`${name} `, value);
      item.appendChild(words);
      list.appendChild(item);
    }
  }

  root.SkewChart = { barbKey, marker, W, H, BOX, BARB_X, PTOP, PBOT, TMIN, TMAX, PW, PH, SKEW, yOf, pOf, xOf, tOf, el, text, pathD, f1, range, pLabelClass, background, barb, shade, toChart };
})(this);
