/* global Thermo, SOUNDINGS, SkewChart */
// "Finding parameters on a Skew-T" on the Learn page. Each entry has its own zoomed chart showing
// only the lines needed, with numbered steps. The charts and the worked answers come from the same
// calculations, so they always agree. Page numbers are from Wallace and Hobbs (2006).
(function (root) {
  'use strict';

  const K = 273.15;
  const START = 850; // the level used for the moisture and temperature examples, in mb

  // Where two curves meet between pressures `bottom` and `top`: the first change of sign of
  // difference(p) going up, narrowed down by halving. null if they don't meet.
  function meet(difference, bottom, top) {
    let below = bottom;
    for (let p = bottom - 1; p >= top; p--) {
      if (difference(p) === 0) return p;
      if ((difference(below) > 0) !== (difference(p) > 0)) {
        let low = below, high = p;
        for (let i = 0; i < 40; i++) {
          const mid = (low + high) / 2;
          if ((difference(mid) > 0) === (difference(low) > 0)) low = mid;
          else high = mid;
        }
        return (low + high) / 2;
      }
      below = p;
    }
    return null;
  }

  // Every level, going up, where the air temperature crosses 0 °C.
  function freezingLevels(T, levels) {
    const found = [], t = p => T.interp(levels, 't', p);
    const bottom = levels[0].p, top = levels[levels.length - 1].p;
    let from = bottom, p;
    while (from > top && (p = meet(t, from, top)) !== null) {
      found.push(p);
      from = Math.floor(p) - 1;
    }
    return found;
  }

  // The forecasting tools: CCL, convective temperature and the indices read from set levels.
  function toolValues(T, sounding) {
    const levels = sounding.levels, sfc = levels[0];
    const at = p => levels.find(l => l.p === p);
    const sfcW = T.mixingRatio(sfc.td, sfc.p);
    const air = p => T.interp(levels, 't', p);
    const cclP = meet(p => air(p) - T.dewFromMixingRatio(sfcW, p), sfc.p, 300);
    const ccl = { p: cclP, t: air(cclP) };
    const convective = T.dryTemp(T.theta(ccl.t, ccl.p), sfc.p);
    const b = at(850), c = at(700), d = at(500);
    const lclB = T.lcl(b.t, b.td, 850);
    const parcel500 = T.moistTemp(lclB.t, lclB.p, 500);
    return {
      sfcW, ccl, convective, b, c, d, lclB, parcel500,
      showalter: d.t - parcel500,
      kIndex: (b.t - d.t) + b.td - (c.t - c.td),
      totalTotals: b.t + b.td - 2 * d.t,
    };
  }

  // Average lapse rate in °C per km between two reported levels. A positive value means cooling.
  function lapseRate(T, levels, lowerP, upperP) {
    const z = T.heights(levels), i = levels.findIndex(l => l.p === lowerP), j = levels.findIndex(l => l.p === upperP);
    const thickness = z[j] - z[i];
    return { lower: levels[i], upper: levels[j], thickness, rate: 1000 * (levels[i].t - levels[j].t) / thickness };
  }

  // The stability test for one layer: lift from the environmental temperature at the bottom along a
  // dry and a moist adiabat, then see where the environmental temperature at the top falls.
  function stability(T, bottom, top) {
    const dry = T.dryTemp(T.theta(bottom.t, bottom.p), top.p);
    const moist = T.moistTemp(bottom.t, bottom.p, top.p);
    return { bottom, top, dry, moist, kind: top.t > moist ? 'stable' : top.t > dry ? 'conditionally unstable' : 'unstable' };
  }

  // Every number the entries quote, worked out from one sounding. No page code, so test.js can check it.
  function values(T, sounding) {
    const levels = sounding.levels;
    const at = p => levels.find(l => l.p === p);
    const a = at(START), sfc = levels[0];
    const w = T.mixingRatio(a.td, START), ws = T.mixingRatio(a.t, START);
    const lclA = T.lcl(a.t, a.td, START);
    const theta = T.theta(a.t, START);
    const wetBulb = T.moistTemp(lclA.t, lclA.p, START);
    const thetaW = T.moistTemp(lclA.t, lclA.p, 1000);
    // Equivalent potential temperature the chart way: up the moist adiabat to 200 mb, where it runs
    // nearly along a dry adiabat, then that dry adiabat's potential temperature.
    const TOP = 200;
    const topT = T.moistTemp(lclA.t, lclA.p, TOP);
    const thetaE = T.theta(topT, TOP);
    const parcel = T.parcel(levels);
    const at500 = { air: T.interp(levels, 't', 500), parcel: T.interp(parcel.path, 't', 500) };
    return {
      a, sfc, w, ws, rh: 100 * w / ws, tv: T.virtualTemp(a.t, w), lclA, theta, wetBulb, thetaW, thetaE, top: TOP, topT, parcel,
      at500, liftedIndex: at500.air - at500.parcel,
    };
  }

  if (typeof module !== 'undefined') {
    module.exports = { values, toolValues, freezingLevels, lapseRate, stability, START };
    return;
  }

  const { el, text, pathD, range, xOf: mainX, yOf: mainY, pOf: mainPressure, tOf: mainTemperature } = SkewChart;
  const sounding = SOUNDINGS[0], levels = sounding.levels;
  const v = values(Thermo, sounding);
  const { a, sfc, parcel } = v;
  const one = x => x.toFixed(1);
  const whole = x => Math.round(x).toLocaleString();

  const tools = toolValues(Thermo, sounding);
  const winter = SOUNDINGS[2].levels;
  const winterFreezing = freezingLevels(Thermo, winter);
  const stormFreezing = freezingLevels(Thermo, levels);

  const middle = lapseRate(Thermo, levels, 700, 500);
  const levelOf = (list, p) => list.find(l => l.p === p);
  // A made-up change to the storm example: strong heating warms only the air at the ground.
  const HEATED = 33;
  const layers = {
    stable: stability(Thermo, levelOf(levels, 950), levelOf(levels, 900)),
    conditional: stability(Thermo, middle.lower, middle.upper),
    unstable: stability(Thermo, { p: 1000, t: HEATED }, levelOf(levels, 950)),
  };

  // Changing Celsius to kelvin, p. 63 of Wallace and Hobbs (2006).
  const TO_KELVIN = String.raw`T_{\mathrm{K}} = T_{^\circ\mathrm{C}} + 273.15`;
  // Why a difference between two temperatures needs no conversion: the two 273.15s cancel.
  const cancels = (first, second) => ({
    words: 'No change to kelvin is needed. In a difference between two temperatures, the two 273.15 terms cancel:',
    latex: String.raw`\begin{aligned} & (${first} + 273.15) - (${second} + 273.15) \\ & \quad = ${first} - ${second} \end{aligned}`,
    plain: '(first + 273.15) − (second + 273.15) = first − second',
  });

  // ---- Lines, each a list of [temperature, pressure] points ----
  const SIZE = 60;
  const pressures = (from, to) => range(0, SIZE, 1).map(i => from * Math.pow(to / from, i / SIZE));
  const dryLine = (thetaK, from, to) => pressures(from, to).map(p => [Thermo.dryTemp(thetaK, p), p]);
  const mixLine = (w, from, to) => pressures(from, to).map(p => [Thermo.dewFromMixingRatio(w, p), p]);
  const moistLine = (t0, p0, from, to) => {
    let t = Thermo.moistTemp(t0, p0, from), p = from;
    return pressures(from, to).map(q => {
      t = Thermo.moistTemp(t, p, q);
      p = q;
      return [t, q];
    });
  };
  const profile = (key, top, bottom) => {
    const inside = levels.filter(l => l.p <= bottom && l.p >= top).map(l => [l[key], l.p]);
    return [[Thermo.interp(levels, key, Math.min(bottom, sfc.p)), Math.min(bottom, sfc.p)], ...inside,
      [Thermo.interp(levels, key, Math.max(top, 100)), Math.max(top, 100)]];
  };
  const parcelLine = (top, bottom) => parcel.path.filter(q => q.p <= bottom && q.p >= top).map(q => [q.t, q.p]);

  // ---- One zoomed chart ----
  // Every chart is a straight enlargement of part of the site's Skew-T: the same log-pressure axis,
  // the same slant and the same proportions. Only the crop and the amount of zoom differ.
  const W = 520, LEFT = 66, RIGHT = 506, TOP = 28, MIN_PLOT = 300, MAX_PLOT = 460, EDGE = 55;
  const LABELLED = [100, 150, 200, 250, 300, 400, 500, 600, 700, 850, 1000];
  let count = 0;

  // spec: top and bottom pressures; fit: [t, p] points that must be visible; lines: [{cls, pts, label}];
  // path: highlighted routes; steps: [{n, at, dx, dy}]; answer: {at, words, dx, dy}; shade.
  function chart(spec) {
    // The part of the main chart to show, in the main chart's own units.
    let y0 = mainY(spec.top), y1 = mainY(spec.bottom);
    const xs = spec.fit.map(([t, p]) => mainX(t, p));
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    // One zoom for both directions, leaving room beside the outermost points for labels.
    const zoom = Math.min((RIGHT - LEFT - 2 * EDGE) / (x1 - x0), (spec.height || MAX_PLOT) / (y1 - y0));
    const wide = (RIGHT - LEFT) / zoom, middle = (x0 + x1) / 2;
    x0 = middle - wide / 2;
    x1 = middle + wide / 2;
    // A short, wide crop shows more levels, mostly above, rather than being stretched.
    if ((y1 - y0) * zoom < MIN_PLOT) {
      const extra = MIN_PLOT / zoom - (y1 - y0);
      const below = Math.min(extra, Math.max(0, mainY(1050) - y1));
      y0 -= extra - below;
      y1 += below;
    }
    const BOX = { left: LEFT, right: RIGHT, top: TOP, bottom: TOP + (y1 - y0) * zoom };
    const H = Math.round(BOX.bottom + 40);
    const point = ([t, p]) => [BOX.left + (mainX(t, p) - x0) * zoom, BOX.top + (mainY(p) - y0) * zoom];
    const yOf = p => point([0, p])[1], xOf = (t, p) => point([t, p])[0];
    const top = mainPressure(y0), bottom = mainPressure(y1);
    const tAt = (x, p) => mainTemperature(x0 + (x - BOX.left) / zoom, p);

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'param-chart', role: 'img', 'aria-label': spec.label });
    const id = `paramclip${count++}`;
    el('rect', { x: BOX.left, y: BOX.top, width: BOX.right - BOX.left, height: BOX.bottom - BOX.top }, el('clipPath', { id }, el('defs', {}, svg)));
    const plot = el('g', { 'clip-path': `url(#${id})` }, svg);

    for (const area of spec.shade || []) {
      el('path', { d: pathD(area.pts.map(point)) + 'Z', class: area.cls }, plot);
    }
    let isobars = range(100, 1050, 50).filter(p => p >= top - 0.5 && p <= bottom + 0.5);
    if (isobars.length > 8) isobars = LABELLED.filter(p => p >= top - 0.5 && p <= bottom + 0.5);
    for (const p of isobars) {
      el('path', { d: pathD([[BOX.left, yOf(p)], [BOX.right, yOf(p)]]), class: 'bg isobar' }, plot);
      text(svg, BOX.left - 6, yOf(p) + 5, `${p}`, 'param-axis', 'end');
    }
    text(svg, BOX.left - 6, 16, 'mb', 'param-axis', 'end');
    // Temperature lines, numbered where they meet the bottom edge.
    const perDegree = (mainX(1, bottom) - mainX(0, bottom)) * zoom;
    const step = perDegree >= 9 ? 5 : 10;
    for (let t = Math.floor(tAt(BOX.left, top) / step) * step - step; t <= tAt(BOX.right, bottom) + step; t += step) {
      el('path', { d: pathD([point([t, bottom]), point([t, top])]), class: 'bg isotherm' }, plot);
      const x = xOf(t, bottom);
      if (x > BOX.left + 8 && x < BOX.right - 8) text(svg, x, BOX.bottom + 18, `${t}`, 'param-axis');
    }
    text(svg, (BOX.left + BOX.right) / 2, H - 4, 'Temperature (°C)', 'param-axis');

    // Highlighted routes sit under the lines, so each line keeps its own color on top.
    for (const route of spec.path || []) el('path', { d: pathD(route.map(point)), class: 'param-route' }, plot);
    for (const line of spec.lines) el('path', { d: pathD(line.pts.map(point)), class: line.cls }, plot);
    el('rect', { x: BOX.left, y: BOX.top, width: BOX.right - BOX.left, height: BOX.bottom - BOX.top, class: 'frame' }, svg);

    // Names of the lines, placed at a chosen pressure along each.
    for (const line of spec.lines.filter(l => l.label)) {
      const near = line.pts.reduce((best, q) => (Math.abs(q[1] - line.label.p) < Math.abs(best[1] - line.label.p) ? q : best));
      const [x, y] = point(near);
      text(svg, x + (line.label.dx || 0), y + (line.label.dy || 0), line.label.words, 'param-name', line.label.anchor || 'middle');
    }
    for (const note of spec.notes || []) {
      const [x, y] = point(note.at);
      text(svg, x + (note.dx || 0), y + (note.dy || 0), note.words, 'param-name', note.anchor || 'middle');
    }
    if (spec.answer) {
      const [x, y] = point(spec.answer.at);
      if (!spec.answer.plain) el('circle', { cx: x, cy: y, r: 9, class: 'param-ring' }, svg);
      text(svg, x + (spec.answer.dx || 14), y + (spec.answer.dy || 5), spec.answer.words, 'param-answer', spec.answer.anchor || 'start');
    }
    for (const s of spec.steps) {
      const [px, py] = point(s.at), x = px + (s.dx || 0), y = py + (s.dy || 0);
      if (s.dx || s.dy) el('path', { d: pathD([[px, py], [x, y]]), class: 'param-leader' }, svg);
      el('circle', { cx: px, cy: py, r: 3.5, class: 'param-point' }, svg);
      el('circle', { cx: x, cy: y, r: 11, class: 'param-step' }, svg);
      text(svg, x, y + 5, `${s.n}`, 'param-step-number');
    }
    return svg;
  }

  // Common pieces for the examples that start at 850 mb.
  const airAt = [a.t, START], dewAt = [a.td, START], cross = [v.lclA.t, v.lclA.p];
  const temperature = (top, bottom, label) => ({ cls: 'profile temp', pts: profile('t', 100, 1000), label });
  const dewpoint = (top, bottom, label) => ({ cls: 'profile dew', pts: profile('td', 100, 1000), label });
  const guide = (kind, pts, label) => ({ cls: `bg ${kind} param-line`, pts, label });
  const gkg = w => `${w} g/kg`;

  // The lifting steps shared by wet-bulb, wet-bulb potential and equivalent potential temperature.
  const liftLines = (top, bottom) => [
    guide('dry', dryLine(v.theta, START, v.lclA.p)),
    guide('mix', mixLine(v.w, START, v.lclA.p)),
  ];
  const liftRoutes = [dryLine(v.theta, START, v.lclA.p), mixLine(v.w, START, v.lclA.p)];

  const CAPE_AREA = () => {
    const part = parcel.path.filter(q => q.p <= parcel.lfc + 0.01 && q.p >= parcel.el - 0.01);
    return part.map(q => [q.t, q.p]).concat(part.slice().reverse().map(q => [q.envCmp, q.p]));
  };
  // CIN: each stretch below the LFC where the parcel is colder than the air.
  const CIN_AREAS = () => {
    const runs = [];
    let run = [];
    const flush = () => {
      if (run.length > 1) runs.push(run.map(q => [q.t, q.p]).concat(run.slice().reverse().map(q => [q.envCmp, q.p])));
      run = [];
    };
    for (const q of parcel.path.filter(x => x.p >= parcel.lfc)) { if (q.b < 0) run.push(q); else flush(); }
    flush();
    return runs.map(pts => ({ cls: 'cin', pts }));
  };

  // Sources outside the textbook, named in each entry's source line.
  const TRAINING = ['National Weather Service training page: Skew-T parameters', 'https://www.weather.gov/source/zhu/ZHU_Training_Page/convective_parameters/skewt/skewtinfo.html'];
  const glossary = (letter, words) => [`National Weather Service glossary: ${words}`, `https://forecast.weather.gov/glossary.php?letter=${letter}`];

  // Two temperature differences or readings joined by a highlighted line along one pressure.
  const across = (t1, t2, p) => [[t1, p], [t2, p]];
  const reading = (t, p, words, dx, dy, anchor) => ({ at: [t, p], words, dx, dy, anchor });
  // The set-level readings used by the K Index and Total Totals.
  function readingsChart(spec) {
    return chart({
      label: spec.label, top: 450, bottom: 900,
      fit: [[tools.d.t, 500], [tools.b.t, 850], [tools.b.td, 850], [tools.c.td, 700], [tools.c.t, 700], [Thermo.interp(levels, 'td', 500), 500]],
      lines: [temperature(450, 900), dewpoint(450, 900)],
      path: spec.path, steps: spec.steps, notes: spec.notes,
      answer: { plain: true, at: [tools.d.t, 500], words: spec.words, dx: 60, dy: -16 },
    });
  }

  // One stability test: both adiabats from the bottom of the layer, and the environmental
  // temperature through it. `heated` draws the made-up warmer ground temperature.
  function stabilityChart(test, spec) {
    const { bottom, top } = test;
    const environment = spec.heated ? [[bottom.t, bottom.p], ...profile('t', 100, top.p)] : profile('t', 100, 1000);
    const at = [top.t, top.p];
    return chart({
      label: spec.label, top: spec.top, bottom: spec.bottom, height: 360,
      // `spread` adds room either side, so a thin layer still shows several isotherms.
      fit: [[bottom.t, bottom.p], at, [test.dry - (spec.spread || 0), top.p], [test.moist + (spec.spread || 0), top.p]],
      lines: [guide('dry', dryLine(Thermo.theta(bottom.t, bottom.p), bottom.p, top.p), { p: top.p, words: 'dry', anchor: spec.dryAnchor || 'end', dx: spec.dryDx || -6, dy: -10 }),
        guide('moist', moistLine(bottom.t, bottom.p, bottom.p, top.p), { p: top.p, words: 'moist', anchor: spec.moistAnchor || 'middle', dx: spec.moistDx || 0, dy: -10 }),
        { cls: 'profile temp', pts: environment }],
      path: [environment.filter(([, p]) => p <= bottom.p && p >= top.p)],
      steps: [{ n: 1, at: [bottom.t, bottom.p], dx: spec.oneDx || 34, dy: 16 }, { n: 3, at, dx: spec.threeDx, dy: spec.threeDy || 0 }],
      notes: spec.notes,
      answer: { plain: true, at: [(bottom.t + top.t) / 2, Math.sqrt(bottom.p * top.p)], words: spec.words, dx: spec.wordsDx, dy: 5, anchor: spec.wordsDx < 0 ? 'end' : 'start' },
    });
  }

  // The page lists the groups in this order: direct readings, then lifting a parcel, then indices
  // that combine several steps. "Levels" and "Energy areas" are built into descriptions higher up.
  const GROUPS = [
    ['Levels', [
      {
        id: 'parcel', name: 'Parcel path',
        meaning: 'The temperature of a parcel as it is lifted.',
        start: `A parcel from the ground in the spring storm example: temperature ${sfc.t} °C, dewpoint ${sfc.td} °C at ${sfc.p} mb.`,
        steps: ['Start at the surface temperature and the surface dewpoint.', 'From the temperature, follow a dry adiabat upward.', 'From the dewpoint, follow a mixing ratio line upward.', 'Mark where they cross. This is the LCL.', 'From the LCL, follow a moist adiabat all the way up, here to 100 mb at the top of the chart. The dry adiabat below the LCL and this moist adiabat above it make the parcel path.'],
        answer: `The parcel follows the dry adiabat up to about ${whole(parcel.lcl.p)} mb, then the moist adiabat to the top of the chart. The parcel temperature along the whole path is highlighted.`,
        use: 'comparing the parcel temperature with the environmental temperature.',
        source: 'pp. 83 and 345',
        chart: () => {
          const th = Thermo.theta(sfc.t, sfc.p), w = Thermo.mixingRatio(sfc.td, sfc.p), q = parcel.lcl;
          const along = p => [Thermo.interp(parcel.path, 't', p), p];
          return chart({
            // The whole path, to the top of the chart. It is drawn taller so the steps near the ground fit.
            label: 'The whole parcel path: a dry adiabat up to the LCL, then a moist adiabat to 100 mb', top: 100, bottom: 1050, height: 640,
            fit: [[sfc.t, sfc.p], [sfc.td, sfc.p], [q.t, q.p], along(100), [Thermo.interp(levels, 't', 100), 100]],
            lines: [guide('mix', mixLine(w, sfc.p, 840)),
              { cls: 'profile parcel', pts: parcelLine(100, 1000), label: { p: 300, words: 'parcel path', anchor: 'start', dx: 14 } },
              temperature(100, 1000, { p: 450, words: 'environment', anchor: 'end', dx: -12 }), dewpoint(100, 1000)],
            path: [parcelLine(100, 1000)],
            steps: [{ n: 1, at: [sfc.t, sfc.p], dx: 40, dy: 4 }, { n: 1, at: [sfc.td, sfc.p], dx: -40, dy: 4 },
              { n: 2, at: [Thermo.dryTemp(th, 955), 955], dx: 44, dy: -18 }, { n: 3, at: [Thermo.dewFromMixingRatio(w, 955), 955], dx: -44, dy: -18 },
              { n: 4, at: [q.t, q.p], dx: -48, dy: -40 }, { n: 5, at: along(500), dx: 40, dy: 0 }],
            answer: { at: [q.t, q.p], words: 'LCL', dx: 16, dy: -8 },
          });
        },
      },
      {
        id: 'lcl', name: 'Lifting condensation level (LCL)',
        meaning: 'The level where a lifted, unsaturated parcel becomes saturated.',
        start: `A parcel from the ground in the spring storm example: temperature ${sfc.t} °C, dewpoint ${sfc.td} °C at ${sfc.p} mb.`,
        steps: ['From the surface temperature, follow a dry adiabat upward.', 'From the surface dewpoint, follow a mixing ratio line upward.', 'The LCL is where the two cross. Read its pressure.'],
        answer: `The LCL is at about ${whole(parcel.lcl.p)} mb.`,
        use: 'estimating the cloud base for air lifted from the ground.',
        source: 'p. 83',
        chart: () => {
          const th = Thermo.theta(sfc.t, sfc.p), w = Thermo.mixingRatio(sfc.td, sfc.p), q = parcel.lcl;
          return chart({
            label: 'LCL at the crossing of a dry adiabat and a mixing ratio line', top: 800, bottom: 1030,
            fit: [[sfc.t, sfc.p], [sfc.td, sfc.p], [q.t, q.p], [Thermo.dewFromMixingRatio(w, 826) + 6, 826]],
            lines: [guide('dry', dryLine(th, sfc.p, 820), { p: 868, words: 'dry adiabat', anchor: 'start', dx: 8, dy: -6 }),
              guide('mix', mixLine(w, sfc.p, 820), { p: 828, words: 'mixing ratio line', anchor: 'start', dx: 6 }),
              temperature(800, 1000), dewpoint(800, 1000)],
            path: [dryLine(th, sfc.p, q.p), mixLine(w, sfc.p, q.p)],
            steps: [{ n: 1, at: [sfc.t, sfc.p], dx: 34, dy: -16 }, { n: 2, at: [sfc.td, sfc.p], dx: -34, dy: -16 }, { n: 3, at: [q.t, q.p], dx: -36, dy: -24 }],
            answer: { at: [q.t, q.p], words: `LCL ≈ ${whole(q.p)} mb`, dx: 16, dy: -10 },
          });
        },
      },
      {
        id: 'lfc', name: 'Level of free convection (LFC)',
        meaning: 'The level where a lifted parcel has a temperature warmer than the environmental temperature and can keep rising without being pushed.',
        start: 'The surface parcel in the spring storm example.',
        steps: ['Follow the parcel path: a dry adiabat to the LCL, then a moist adiabat.', 'Above the LCL, find where the parcel temperature crosses to the warm (right) side of the environmental temperature.', 'Read the pressure at the crossing.'],
        answer: `The LFC is at about ${whole(parcel.lfc)} mb.`,
        use: 'finding the level the parcel must reach before it can rise on its own. Some soundings have none.',
        source: 'p. 91',
        chart: () => {
          const at = [Thermo.interp(levels, 't', parcel.lfc), parcel.lfc];
          return chart({
            label: 'LFC where the parcel temperature crosses to the warm side of the environmental temperature', top: 650, bottom: 1000,
            fit: [[sfc.t, sfc.p], at, [parcel.lcl.t, parcel.lcl.p], [Thermo.interp(parcel.path, 't', 660), 660], [Thermo.interp(levels, 't', 660), 660]],
            lines: [{ cls: 'profile parcel', pts: parcelLine(100, 1000), label: { p: 690, words: 'parcel', anchor: 'start', dx: 10 } },
              temperature(650, 1000, { p: 690, words: 'environment', anchor: 'end', dx: -10 })],
            path: [parcelLine(parcel.lfc, 1000)],
            steps: [{ n: 1, at: [parcel.lcl.t, parcel.lcl.p], dx: -36, dy: 0 }, { n: 2, at: [Thermo.interp(parcel.path, 't', 740), 740], dx: 36, dy: 4 }, { n: 3, at, dx: -40, dy: 0 }],
            answer: { at, words: `LFC ≈ ${whole(parcel.lfc)} mb`, dx: 16, dy: 8 },
          });
        },
      },
      {
        id: 'el', name: 'Equilibrium level (EL)',
        meaning: 'The level above which the parcel temperature is no longer warmer than the environmental temperature.',
        start: 'The surface parcel in the spring storm example, above its LFC.',
        steps: ['Keep following the parcel path upward above the LFC.', 'Find where the parcel temperature crosses back to the cold (left) side of the environmental temperature.', 'Read the pressure at the crossing.'],
        answer: `The EL is at about ${whole(parcel.el)} mb.`,
        use: 'finding the top of the layer where the parcel temperature is warmer than the environmental temperature. A rising parcel can overshoot it.',
        source: 'p. 345',
        chart: () => {
          const at = [Thermo.interp(levels, 't', parcel.el), parcel.el];
          return chart({
            label: 'EL where the parcel temperature crosses back to the cold side of the environmental temperature', top: 120, bottom: 300,
            fit: [at, [Thermo.interp(parcel.path, 't', 290), 290], [Thermo.interp(levels, 't', 290), 290], [Thermo.interp(parcel.path, 't', 130), 130], [Thermo.interp(levels, 't', 130), 130]],
            lines: [{ cls: 'profile parcel', pts: parcelLine(100, 1000), label: { p: 135, words: 'parcel', anchor: 'end', dx: -10 } },
              temperature(120, 300, { p: 135, words: 'environment', anchor: 'start', dx: 10 })],
            path: [parcelLine(parcel.el, 290)],
            steps: [{ n: 1, at: [Thermo.interp(parcel.path, 't', 260), 260], dx: 36, dy: 0 }, { n: 2, at: [Thermo.interp(parcel.path, 't', 205), 205], dx: 36, dy: 0 }, { n: 3, at, dx: -40, dy: 4 }],
            answer: { at, words: `EL ≈ ${whole(parcel.el)} mb`, dx: 16, dy: -8 },
          });
        },
      },
    ]],
    ['Energy areas', [
      {
        id: 'cin', name: 'Convective inhibition (CIN)',
        meaning: 'The energy needed to lift a parcel to its LFC. It is written as a negative number in J/kg.',
        start: 'The surface parcel in the spring storm example.',
        steps: ['Find the LFC.', 'Below it, find where the parcel temperature is on the cold (left) side of the environmental temperature.', 'The shaded area between them stands for CIN. A computer adds it up level by level.'],
        answer: `CIN ≈ ${whole(parcel.cin)} J/kg. You can see the area on the chart, but you cannot read this number straight off a line. Like the rest of Learn, it uses actual temperature, without the moisture correction.`,
        use: 'judging how hard it is to get air to its LFC.',
        source: 'p. 346',
        chart: () => chart({
          label: 'CIN shaded between the parcel and environmental temperatures below the LFC', top: 700, bottom: 1000,
          fit: [[sfc.t, sfc.p], [Thermo.interp(levels, 't', parcel.lfc), parcel.lfc], [parcel.lcl.t, parcel.lcl.p], [Thermo.interp(parcel.path, 't', 720), 720]],
          shade: CIN_AREAS(),
          lines: [{ cls: 'profile parcel', pts: parcelLine(100, 1000), label: { p: 725, words: 'parcel', anchor: 'start', dx: 10 } },
            temperature(700, 1000, { p: 725, words: 'environment', anchor: 'end', dx: -10 })],
          steps: [{ n: 1, at: [Thermo.interp(levels, 't', parcel.lfc), parcel.lfc], dx: 36, dy: -6 }, { n: 2, at: [parcel.lcl.t, parcel.lcl.p], dx: -40, dy: 0 },
            { n: 3, at: [(Thermo.interp(parcel.path, 't', 850) + Thermo.interp(levels, 't', 850)) / 2, 850] }],
          answer: { plain: true, at: [Thermo.interp(levels, 't', 850), 850], words: `CIN ≈ ${whole(parcel.cin)} J/kg`, dx: 18, dy: 5 },
        }),
      },
      {
        id: 'cape', name: 'Convective available potential energy (CAPE)',
        meaning: 'The energy that comes from the parcel temperature being warmer than the environmental temperature between the LFC and EL, in J/kg.',
        start: 'The surface parcel in the spring storm example.',
        steps: ['Find the LFC.', 'Find the EL.', 'The area between the parcel temperature and the environmental temperature, from the LFC to the EL, stands for CAPE. A computer adds it up level by level.'],
        answer: `CAPE ≈ ${whole(parcel.cape)} J/kg. The number cannot be read straight off a line. Like the rest of Learn, it uses actual temperature, without the moisture correction.`,
        use: 'judging how much energy rising air could have. A large value does not mean a storm will form.',
        source: 'p. 345, equation (8.4)',
        chart: () => {
          const low = [Thermo.interp(levels, 't', parcel.lfc), parcel.lfc], high = [Thermo.interp(levels, 't', parcel.el), parcel.el];
          return chart({
            label: 'CAPE shaded between the parcel and environmental temperatures from the LFC to the EL', top: 130, bottom: 1000,
            fit: [low, high, [Thermo.interp(parcel.path, 't', 450), 450], [Thermo.interp(levels, 't', 300), 300], [sfc.t, sfc.p]],
            shade: [{ cls: 'cape', pts: CAPE_AREA() }],
            lines: [{ cls: 'profile parcel', pts: parcelLine(100, 1000) }, temperature(130, 1000)],
            steps: [{ n: 1, at: low, dx: 40, dy: 0 }, { n: 2, at: high, dx: -40, dy: 0 }, { n: 3, at: [(Thermo.interp(parcel.path, 't', 420) + Thermo.interp(levels, 't', 420)) / 2, 420] }],
            answer: { plain: true, at: [(Thermo.interp(parcel.path, 't', 420) + Thermo.interp(levels, 't', 420)) / 2, 420], words: `CAPE ≈ ${whole(parcel.cape)} J/kg`, dx: 40, dy: -22 },
          });
        },
      },
    ]],
    ['Moisture at a level', [
      {
        id: 'mixing-ratio', name: 'Mixing ratio (w)',
        meaning: 'The grams of water vapor actually in the air for each kilogram of dry air.',
        start: `Spring storm example at ${START} mb, where the dewpoint is ${a.td} °C.`,
        steps: [`Find the dewpoint at ${START} mb.`, 'Find the mixing ratio line through that point. It usually falls between two printed lines, so estimate between them.'],
        answer: `The line through the dewpoint is about ${one(v.w * 1000)} g/kg, between the 7 and 10 g/kg lines.`,
        use: 'saying how much water vapor the air has. It stays the same while unsaturated air is lifted.',
        source: 'pp. 80 and 82',
        chart: () => chart({
          label: `Mixing ratio at ${START} mb read from the dewpoint`, top: 700, bottom: 1000,
          fit: [dewAt, airAt, [Thermo.dewFromMixingRatio(0.007, 760), 760], [Thermo.dewFromMixingRatio(0.01, 760), 760]],
          lines: [guide('mix', mixLine(0.007, 1000, 700), { p: 735, words: gkg(7), anchor: 'end', dx: -4 }),
            guide('mix', mixLine(0.01, 1000, 700), { p: 735, words: gkg(10), anchor: 'start', dx: 4 }),
            guide('mix', mixLine(v.w, 1000, 740)), temperature(700, 1000), dewpoint(700, 1000)],
          path: [mixLine(v.w, 1000, 740)],
          steps: [{ n: 1, at: dewAt, dx: -34, dy: 22 }, { n: 2, at: [Thermo.dewFromMixingRatio(v.w, 770), 770], dx: 0, dy: 0 }],
          answer: { at: dewAt, words: `w ≈ ${one(v.w * 1000)} g/kg`, dx: 16, dy: -12 },
        }),
      },
      {
        id: 'saturation-mixing-ratio', name: 'Saturation mixing ratio (ws)',
        meaning: 'The grams of water vapor per kilogram of dry air the air would hold if it were saturated.',
        start: `Spring storm example at ${START} mb, where the temperature is ${a.t} °C.`,
        steps: [`Find the temperature at ${START} mb.`, 'Find the mixing ratio line through that point, estimating between printed lines.'],
        answer: `The line through the temperature is about ${one(v.ws * 1000)} g/kg, just to the right of the 16 g/kg line.`,
        use: 'comparing how much vapor the air could hold with how much it has.',
        source: 'p. 82',
        chart: () => chart({
          label: `Saturation mixing ratio at ${START} mb read from the temperature`, top: 700, bottom: 1000,
          fit: [airAt, dewAt, [Thermo.dewFromMixingRatio(v.ws, 735), 735]],
          lines: [guide('mix', mixLine(0.016, 1000, 700), { p: 735, words: gkg(16), anchor: 'end', dx: -6 }),
            guide('mix', mixLine(v.ws, 1000, 740)), temperature(700, 1000), dewpoint(700, 1000)],
          path: [mixLine(v.ws, 1000, 740)],
          steps: [{ n: 1, at: airAt, dx: 34, dy: 24 }, { n: 2, at: [Thermo.dewFromMixingRatio(v.ws, 770), 770] }],
          answer: { at: airAt, words: `ws ≈ ${one(v.ws * 1000)} g/kg`, dx: -16, dy: -12, anchor: 'end' },
        }),
      },
      {
        id: 'relative-humidity', name: 'Relative humidity (RH)',
        equation: {
          latex: String.raw`\mathrm{RH} = 100\,\frac{w}{w_s}`, plain: 'RH = 100 × w / ws',
          symbols: [[String.raw`\mathrm{RH}`, 'RH', 'relative humidity, as a percentage'], [String.raw`w`, 'w', 'mixing ratio'],
            [String.raw`w_s`, 'ws', 'saturation mixing ratio, in the same units as w']],
          worked: () => String.raw`\mathrm{RH} \approx 100\,\frac{${one(v.w * 1000)}}{${one(v.ws * 1000)}} \approx ${whole(v.rh)}\%`,
          workedPlain: () => `RH ≈ 100 × ${one(v.w * 1000)} / ${one(v.ws * 1000)} ≈ ${whole(v.rh)}%`,
          note: 'Equation (3.64), p. 82 of Wallace and Hobbs (2006). Their equation (3.65) writes the same ratio using the dewpoint.',
        },
        meaning: 'How close the air is to saturation, as a percentage.',
        start: `Spring storm example at ${START} mb: temperature ${a.t} °C, dewpoint ${a.td} °C.`,
        steps: ['Read the mixing ratio (w) from the dewpoint.', 'Read the saturation mixing ratio (ws) from the temperature.', 'Put both readings into the equation above.'],
        answer: `The relative humidity is about ${whole(v.rh)}%.`,
        use: 'judging how close the air at a level is to saturation.',
        source: 'p. 82, equations (3.64) and (3.65)',
        chart: () => chart({
          label: `Relative humidity at ${START} mb from two mixing ratio lines`, top: 700, bottom: 1000,
          fit: [dewAt, airAt, [Thermo.dewFromMixingRatio(v.w, 760), 760], [Thermo.dewFromMixingRatio(v.ws, 760), 760]],
          lines: [guide('mix', mixLine(v.w, 1000, 700), { p: 735, words: `w ${one(v.w * 1000)}`, anchor: 'end', dx: -4 }),
            guide('mix', mixLine(v.ws, 1000, 700), { p: 735, words: `ws ${one(v.ws * 1000)}`, anchor: 'end', dx: -6 }),
            temperature(700, 1000), dewpoint(700, 1000)],
          path: [mixLine(v.w, START, 740), mixLine(v.ws, START, 740)],
          steps: [{ n: 1, at: dewAt, dx: -34, dy: 24 }, { n: 2, at: airAt, dx: 34, dy: 24 }, { n: 3, at: [(a.t + a.td) / 2, START] }],
          answer: { plain: true, at: [(a.t + a.td) / 2, START], words: `RH ≈ ${whole(v.rh)}%`, dx: 0, dy: -20, anchor: 'middle' },
        }),
      },
      {
        id: 'virtual-temperature', name: 'Virtual temperature (Tv)',
        equation: {
          latex: String.raw`T_v = T\,\frac{w + \varepsilon}{\varepsilon\,(1 + w)}`, plain: 'Tv = T (w + ε) / (ε (1 + w))',
          symbols: [[String.raw`T_v`, 'Tv', 'virtual temperature, in kelvin'], [String.raw`T`, 'T', 'environmental temperature, in kelvin'],
            [String.raw`w`, 'w', 'mixing ratio, in kg per kg'], [String.raw`\varepsilon`, 'ε', '0.622']],
          worked: () => String.raw`T_v = ${(a.t + K).toFixed(2)}\,\frac{${v.w.toFixed(4)} + 0.622}{0.622\,(1 + ${v.w.toFixed(4)})} \approx ${(v.tv + K).toFixed(1)}\ \text{K}`,
          workedPlain: () => `Tv = ${(a.t + K).toFixed(2)} × (${v.w.toFixed(4)} + 0.622) / (0.622 × (1 + ${v.w.toFixed(4)})) ≈ ${(v.tv + K).toFixed(1)} K`,
          also: [
            { words: 'Before using the equation, change the temperature from °C to kelvin:', latex: String.raw`T = ${a.t} + 273.15 = ${(a.t + K).toFixed(2)}\ \text{K}`, plain: `T = ${a.t} + 273.15 = ${(a.t + K).toFixed(2)} K` },
            { words: 'Change the mixing ratio from grams to kilograms of vapor per kilogram of dry air:', latex: String.raw`w = \frac{${one(v.w * 1000)}}{1000} = ${v.w.toFixed(4)}`, plain: `w = ${one(v.w * 1000)} / 1000 = ${v.w.toFixed(4)}` },
            { words: 'Afterward, change the answer back to °C:', latex: String.raw`T_v \approx ${(v.tv + K).toFixed(1)} - 273.15 \approx ${one(v.tv)}\ ^\circ\text{C}`, plain: `Tv ≈ ${(v.tv + K).toFixed(1)} − 273.15 ≈ ${one(v.tv)} °C` },
          ],
          note: 'The equation is from Exercise 3.7 (unnumbered equation), p. 80, and the °C to kelvin relation is from p. 63 of Wallace and Hobbs (2006).',
        },
        meaning: 'The temperature dry air would need to have the same density as the moist air at the same pressure. Moist air is less dense than dry air, so the virtual temperature is a little higher than the actual temperature.',
        start: `Spring storm example at ${START} mb: temperature ${a.t} °C, dewpoint ${a.td} °C.`,
        steps: [`Read the environmental temperature at ${START} mb.`, 'Read the mixing ratio (w) from the mixing ratio line through the dewpoint.', 'Put both readings into the equation above. The Skew-T gives you the readings, and the equation does the rest.'],
        answer: `The virtual temperature is about ${one(v.tv)} °C, about ${one(v.tv - a.t)} °C warmer than the environmental temperature.`,
        use: 'comparing the density of moist air fairly. The Full chart in Explore uses virtual temperature for the LFC, EL, CAPE and CIN. Learn, Practice and Test use actual temperature.',
        source: 'p. 67 for the definition and p. 80 for the equation',
        chart: () => {
          const air = profile('t', 100, 1000);
          const virtual = levels.map(l => [Thermo.virtualTemp(l.t, Thermo.mixingRatio(l.td, l.p)), l.p]);
          return chart({
            label: 'Virtual temperature plotted just to the warm side of the environmental temperature', top: 750, bottom: 950,
            fit: [dewAt, [v.tv + 3, START]],
            lines: [guide('mix', mixLine(v.w, 950, 750), { p: 775, words: `w ${one(v.w * 1000)}`, anchor: 'end', dx: -6 }),
              { cls: 'profile temp', pts: air }, { cls: 'profile tvair', pts: virtual, label: { p: 800, words: 'Tv (dotted)', anchor: 'start', dx: 12 } }, dewpoint(750, 950)],
            path: [mixLine(v.w, START, 780)],
            steps: [{ n: 1, at: airAt, dx: -30, dy: 26 }, { n: 2, at: dewAt, dx: -34, dy: 24 }, { n: 3, at: [v.tv, START], dx: 34, dy: 22 }],
            notes: [reading(a.t, START, `T ${a.t}`, -10, -10, 'end')],
            answer: { at: [v.tv, START], words: `Tv ≈ ${one(v.tv)} °C`, dx: 14, dy: -12 },
          });
        },
      },
    ]],
    ['Layers of the environmental temperature', [
      {
        id: 'freezing-level', name: 'Freezing level',
        meaning: 'Where the environmental temperature is 0 °C. Warm layers can make it cross 0 °C more than once.',
        start: 'The stable winter morning example, which has a warm layer above freezing air at the ground.',
        steps: ['Find the slanted 0 °C isotherm.', 'Find every place where the environmental temperature crosses it.', 'Read the pressure at each crossing.'],
        answer: `The winter example crosses 0 °C twice, at about ${winterFreezing.map(whole).join(' mb and ')} mb: the layer between is above freezing. The spring storm example crosses once, at about ${whole(stormFreezing[0])} mb.`,
        use: 'seeing which layers are above or below freezing, which matters for what kind of precipitation reaches the ground.',
        links: [TRAINING],
        chart: () => chart({
          label: 'Two freezing levels where the environmental temperature crosses the 0 °C isotherm', top: 750, bottom: 1030,
          fit: [[winter[0].t, 1000], [1, 900], [0, 850], [-5, 800], [0, 1000]],
          lines: [{ cls: 'param-zero', pts: [[0, 1030], [0, 750]], label: { p: 950, words: '0 °C isotherm', anchor: 'start', dx: 14 } },
            { cls: 'profile temp', pts: winter.map(l => [l.t, l.p]), label: { p: 750, words: 'environment', anchor: 'end', dx: -8, dy: 16 } }],
          steps: [{ n: 1, at: [0, 975], dx: 36, dy: 0 }, { n: 2, at: [0, winterFreezing[0]], dx: -40, dy: 6 }, { n: 2, at: [0, winterFreezing[1]], dx: -40, dy: 20 }],
          notes: winterFreezing.map((p, i) => reading(0, p, `${whole(p)} mb`, i ? -12 : 16, i ? -12 : 16, i ? 'end' : 'start')),
        }),
      },
      {
        id: 'inversion', name: 'Temperature inversion',
        meaning: 'A layer where the environmental temperature increases as height increases.',
        start: 'The stable winter morning example.',
        steps: ['Follow the environmental temperature upward, comparing it with the slanted isotherms.',
          'Look for a part that crosses toward warmer isotherms, to the right. Leaning to the right on the page is not enough: the line must slant more than the isotherms do.',
          'Read the pressure where the warming starts and where it stops.'],
        answer: `From 1000 to 900 mb the environmental temperature rises from ${winter[0].t} to ${levelOf(winter, 900).t} °C. This sounding also has a weak inversion high up, from 250 to 200 mb, where it rises from ${levelOf(winter, 250).t} to ${levelOf(winter, 200).t} °C.`,
        use: 'finding very stable layers. A low inversion can act as a lid that traps polluted air beneath it.',
        source: 'p. 90',
        chart: () => chart({
          label: 'A temperature inversion near the ground, compared with the isotherm through its base', top: 750, bottom: 1030,
          fit: [[winter[0].t, 1000], [1, 900], [0, 850], [-5, 800], [winter[0].t, 800]],
          lines: [{ cls: 'param-zero', pts: [[winter[0].t, 1000], [winter[0].t, 850]], label: { p: 860, words: `${winter[0].t} °C isotherm`, anchor: 'end', dx: -8 } },
            { cls: 'profile temp', pts: winter.map(l => [l.t, l.p]), label: { p: 800, words: 'environment', anchor: 'end', dx: -12 } }],
          path: [winter.filter(l => l.p >= 900).map(l => [l.t, l.p])],
          steps: [{ n: 1, at: [0, 850], dx: 34, dy: 0 }, { n: 2, at: [levelOf(winter, 950).t, 950], dx: 36, dy: 8 }, { n: 3, at: [winter[0].t, 1000], dx: -34, dy: -16 }, { n: 3, at: [levelOf(winter, 900).t, 900], dx: 34, dy: -6 }],
          answer: { plain: true, at: [levelOf(winter, 950).t, 950], words: 'inversion', dx: 58, dy: 14 },
        }),
      },
      {
        id: 'lapse-rate', name: 'Lapse rate (700 to 500 mb)',
        equation: {
          latex: String.raw`\Gamma = \frac{T_{700} - T_{500}}{z_{500} - z_{700}}`, plain: 'Γ = (T700 − T500) / (z500 − z700)',
          symbols: [[String.raw`\Gamma`, 'Γ', 'average lapse rate of the layer, in °C per km'],
            [String.raw`T`, 'T', 'environmental temperature at the pressure shown below it, in °C'],
            [String.raw`z`, 'z', 'height of the pressure level shown below it, in km']],
          worked: () => String.raw`\Gamma = \frac{${middle.lower.t} - (${middle.upper.t})}{${(middle.thickness / 1000).toFixed(2)}\ \text{km}} \approx ${one(middle.rate)}\ ^\circ\text{C km}^{-1}`,
          workedPlain: () => `Γ = (${middle.lower.t} − (${middle.upper.t})) / ${(middle.thickness / 1000).toFixed(2)} km ≈ ${one(middle.rate)} °C per km`,
          also: [{ words: 'This is an average over one layer of the book’s lapse rate:', latex: String.raw`\Gamma = -\frac{\partial T}{\partial z}`, plain: 'Γ = −∂T/∂z' },
            { ...cancels('T_{700}', 'T_{500}'), words: 'So a lapse rate in °C per km is the same number in K per km, because the two 273.15 terms cancel:' }],
          note: 'The lapse rate is from p. 77 of Wallace and Hobbs (2006). A positive value means the temperature falls as height increases.',
        },
        meaning: 'How quickly the environmental temperature falls as height increases.',
        start: 'The spring storm example, between 700 and 500 mb.',
        steps: [`Read the environmental temperature at 700 mb (${middle.lower.t} °C) and at 500 mb (${middle.upper.t} °C).`,
          `Find the height difference between the two levels. The pressure lines do not show height, but a radiosonde report lists it. For this made-up sounding it is calculated from the temperature and moisture: about ${(middle.thickness / 1000).toFixed(2)} km.`,
          'Divide the temperature drop by the height difference, as in the equation above.'],
        answer: `The 700–500 mb lapse rate is about ${one(middle.rate)} °C per km. For comparison, the dry adiabatic lapse rate is 9.8 °C per km, and the book gives 6–7 °C per km as the average in the troposphere.`,
        use: 'describing how quickly a layer cools with height. A larger value means that a rising parcel, cooling along an adiabat, can more easily end up warmer than the environment.',
        source: 'p. 70, equation (3.29), for height differences, and p. 77',
        chart: () => {
          const low = [middle.lower.t, 700], high = [middle.upper.t, 500];
          return chart({
            label: 'The environmental temperature read at 700 and 500 mb for a lapse rate', top: 450, bottom: 750,
            fit: [low, high, [Thermo.interp(levels, 't', 740), 740], [middle.upper.t - 8, 500]],
            lines: [temperature(450, 750, { p: 470, words: 'environment', anchor: 'end', dx: -10 })],
            path: [profile('t', 100, 1000).filter(([, p]) => p <= 700 && p >= 500)],
            steps: [{ n: 1, at: low, dx: 34, dy: 18 }, { n: 1, at: high, dx: 34, dy: -18 }],
            notes: [reading(middle.lower.t, 700, `${middle.lower.t} °C`, -12, 18, 'end'), reading(middle.upper.t, 500, `${middle.upper.t} °C`, -12, 5, 'end')],
            answer: { plain: true, at: [(middle.lower.t + middle.upper.t) / 2, 600], words: `Γ ≈ ${one(middle.rate)} °C/km`, dx: 30, dy: 5 },
          });
        },
      },
      {
        id: 'stability', name: 'Stability of a layer',
        meaning: 'Whether a parcel moved a short way up inside a layer would tend to come back or keep rising.',
        start: 'Three layers: two from the spring storm example and one with a made-up change.',
        steps: ['Start at the environmental temperature at the bottom of the layer.',
          'From that point, follow a dry adiabat and a moist adiabat up to the top of the layer.',
          'See where the environmental temperature at the top of the layer falls: to the right of the moist adiabat, the layer is stable; between the two adiabats, it is conditionally unstable; to the left of the dry adiabat, it is unstable.'],
        cases: [
          { title: 'Stable: 950 to 900 mb',
            words: () => `This is the thin warm layer that forms the cap. At 900 mb the environmental temperature is ${layers.stable.top.t} °C. Parcels lifted along either adiabat would be colder: ${one(layers.stable.moist)} °C if saturated and ${one(layers.stable.dry)} °C if not. A lifted parcel tends to sink back.`,
            chart: () => stabilityChart(layers.stable, { label: 'Stable layer: the environmental temperature is to the right of both adiabats', top: 875, bottom: 980, spread: 2.5, words: 'stable', wordsDx: 24, threeDx: 34 }) },
          { title: 'Conditionally unstable: 700 to 500 mb',
            words: () => `At 500 mb the environmental temperature is ${layers.conditional.top.t} °C, between the moist adiabat (${one(layers.conditional.moist)} °C) and the dry adiabat (${one(layers.conditional.dry)} °C). The layer is stable for an unsaturated parcel and unstable for a saturated one.`,
            chart: () => stabilityChart(layers.conditional, { label: 'Conditionally unstable layer: the environmental temperature is between the two adiabats', top: 480, bottom: 730, words: 'between', wordsDx: 70, threeDx: 0, threeDy: -34, moistDx: 14, moistAnchor: 'start' }) },
          { title: `Unstable: 1000 to 950 mb, ground air heated to ${HEATED} °C`,
            words: () => `This case is made up: the storm example’s ground temperature is raised from ${sfc.t} to ${HEATED} °C. At 950 mb the environmental temperature, ${layers.unstable.top.t} °C, is colder than even the dry adiabat (${one(layers.unstable.dry)} °C). A lifted parcel is warmer than the environment and keeps rising. The book notes that this kind of layer usually lasts only just above strongly heated ground, because mixing removes it elsewhere.`,
            chart: () => stabilityChart(layers.unstable, { heated: true, label: 'Unstable layer: the environmental temperature is to the left of the dry adiabat', top: 930, bottom: 1020, words: 'unstable', wordsDx: -30, threeDx: -34, dryDx: 14, dryAnchor: 'start', moistDx: 14, moistAnchor: 'start' }) },
        ],
        answer: 'A layer exactly along one of these adiabats is neutral for the matching parcel. This test describes one layer. It is not the same as lifting a parcel from the ground to find the LFC, EL and CAPE.',
        use: 'seeing which layers resist rising air and which could help it once the parcel is saturated.',
        source: 'pp. 88 and 90–91',
      },
    ]],
    ['Temperatures found by moving a parcel', [
      {
        id: 'potential-temperature', name: 'Potential temperature (θ)',
        equation: {
          latex: String.raw`\theta \approx T_{1000} + 273.15`, plain: 'θ ≈ T1000 + 273.15',
          symbols: [[String.raw`\theta`, 'θ', 'potential temperature, in kelvin'],
            [String.raw`T_{1000}`, 'T1000', 'temperature read where the dry adiabat reaches 1000 mb, in °C']],
          worked: () => String.raw`\theta \approx ${whole(v.theta - K)} + 273.15 \approx ${whole(v.theta)}\ \text{K}`,
          workedPlain: () => `θ ≈ ${whole(v.theta - K)} + 273.15 ≈ ${whole(v.theta)} K`,
          also: [{ words: 'It uses the change from °C to kelvin:', latex: TO_KELVIN, plain: 'K = °C + 273.15' }],
          note: 'The first equation is the chart method written as an equation. The °C to kelvin relation is on p. 63 of Wallace and Hobbs (2006).',
        },
        meaning: 'The temperature air would have if it were moved to 1000 mb without condensation or any exchange of heat. It is given in kelvin.',
        start: `Spring storm example at ${START} mb, where the temperature is ${a.t} °C.`,
        steps: [`Start at the temperature at ${START} mb.`, 'Follow the dry adiabat through that point down to 1000 mb.', 'Read the temperature there, then use the equation above to change it to kelvin.'],
        answer: `At 1000 mb the dry adiabat reads about ${whole(v.theta - K)} °C, so θ ≈ ${whole(v.theta)} K.`,
        use: 'comparing air at different heights on equal terms.',
        source: 'pp. 77–78',
        chart: () => chart({
          label: `Potential temperature found by following a dry adiabat from ${START} to 1000 mb`, top: 700, bottom: 1030,
          fit: [airAt, [v.theta - K, 1000], [a.td, START]],
          lines: [guide('dry', dryLine(300, 1030, 700), { p: 745, words: '300 K', anchor: 'end', dx: -4 }),
            guide('dry', dryLine(310, 1030, 700), { p: 745, words: '310 K', anchor: 'start', dx: 6 }),
            temperature(700, 1000), dewpoint(700, 1000)],
          path: [dryLine(v.theta, START, 1000), [[v.theta - K, 1000], [v.theta - K, 1030]]],
          notes: [{ at: [v.theta - K, 1000], words: `reads ${whole(v.theta - K)} °C`, dx: -14, dy: 22, anchor: 'end' }],
          steps: [{ n: 1, at: airAt, dx: -34, dy: -22 }, { n: 2, at: [Thermo.dryTemp(v.theta, 925), 925], dx: 34, dy: -12 }, { n: 3, at: [v.theta - K, 1000], dx: 30, dy: -24 }],
          answer: { at: [v.theta - K, 1000], words: `θ ≈ ${whole(v.theta)} K`, dx: -14, dy: -12, anchor: 'end' },
        }),
      },
      {
        id: 'wet-bulb', name: 'Wet-bulb temperature (Tw)',
        meaning: 'The temperature air reaches when water evaporates into it, at the same pressure, until it is saturated. A thermometer wrapped in a wet cloth measures it.',
        start: `Spring storm example at ${START} mb: temperature ${a.t} °C, dewpoint ${a.td} °C.`,
        steps: [`Start with the temperature and dewpoint at ${START} mb.`, 'Follow a dry adiabat up from the temperature and a mixing ratio line up from the dewpoint.', 'Mark where they cross: the LCL for this level.', `Follow the moist adiabat from there back down to ${START} mb.`, 'Read the temperature at that point.'],
        answer: `The wet-bulb temperature is about ${one(v.wetBulb)} °C, between the dewpoint and the temperature.`,
        use: 'seeing how far evaporation could cool the air, for example when rain falls into dry air.',
        source: 'p. 83 for the definition, p. 86 for the chart rule (Normand’s rule)',
        chart: () => chart({
          label: `Wet-bulb temperature found with Normand’s rule at ${START} mb`, top: 650, bottom: 900,
          fit: [airAt, dewAt, cross],
          lines: [...liftLines(), guide('moist', moistLine(v.lclA.t, v.lclA.p, START, v.lclA.p)),
            temperature(650, 900), dewpoint(650, 900)],
          path: [...liftRoutes, moistLine(v.lclA.t, v.lclA.p, v.lclA.p, START)],
          steps: [{ n: 1, at: airAt, dx: 34, dy: 24 }, { n: 1, at: dewAt, dx: -34, dy: 24 }, { n: 2, at: [Thermo.dryTemp(v.theta, 800), 800], dx: 32, dy: -10 },
            { n: 3, at: cross, dx: -4, dy: -34 }, { n: 4, at: [Thermo.moistTemp(v.lclA.t, v.lclA.p, 805), 805], dx: -38, dy: -6 }, { n: 5, at: [v.wetBulb, START], dx: 0, dy: 34 }],
          answer: { at: [v.wetBulb, START], words: `Tw ≈ ${one(v.wetBulb)} °C`, dx: 14, dy: -12 },
        }),
      },
      {
        id: 'wet-bulb-potential', name: 'Wet-bulb potential temperature (θw)',
        meaning: 'The temperature found by taking the wet-bulb point along its moist adiabat to 1000 mb.',
        start: `Continue the wet-bulb example from ${START} mb.`,
        steps: ['Find the LCL for the level, as for wet-bulb temperature.', `Follow the moist adiabat back down, through the wet-bulb point at ${START} mb.`, 'Keep going down the same moist adiabat to 1000 mb and read the temperature.'],
        answer: `θw ≈ ${one(v.thetaW)} °C. On this site each moist adiabat is identified by its temperature at 1000 mb, so this is the adiabat’s own value.`,
        use: 'labeling a parcel in a way that stays the same through dry and saturated adiabatic rising and sinking. Printed charts may label moist adiabats elsewhere, such as along 200 mb.',
        source: 'p. 86',
        chart: () => chart({
          label: 'Wet-bulb potential temperature found by following the moist adiabat to 1000 mb', top: 700, bottom: 1030,
          fit: [airAt, dewAt, cross, [v.thetaW, 1000]],
          lines: [...liftLines(), guide('moist', moistLine(v.lclA.t, v.lclA.p, 1000, v.lclA.p)), temperature(700, 1000), dewpoint(700, 1000)],
          path: [...liftRoutes, moistLine(v.lclA.t, v.lclA.p, v.lclA.p, 1000)],
          steps: [{ n: 1, at: cross, dx: -4, dy: -32 }, { n: 2, at: [v.wetBulb, START], dx: -38, dy: -6 }, { n: 3, at: [v.thetaW, 1000], dx: -34, dy: -22 }],
          answer: { at: [v.thetaW, 1000], words: `θw ≈ ${one(v.thetaW)} °C`, dx: 15, dy: -10 },
        }),
      },
      {
        id: 'equivalent-potential', name: 'Equivalent potential temperature (θe)',
        equation: {
          latex: String.raw`\theta_e \approx T_{1000} + 273.15`, plain: 'θe ≈ T1000 + 273.15',
          symbols: [[String.raw`\theta_e`, 'θe', 'equivalent potential temperature, in kelvin'],
            [String.raw`T_{1000}`, 'T1000', 'temperature read where the dry adiabat you reached high up comes down to 1000 mb, in °C']],
          worked: () => String.raw`\theta_e \approx ${whole(v.thetaE - K)} + 273.15 \approx ${whole(v.thetaE)}\ \text{K}`,
          workedPlain: () => `θe ≈ ${whole(v.thetaE - K)} + 273.15 ≈ ${whole(v.thetaE)} K`,
          also: [{ words: 'It uses the change from °C to kelvin:', latex: TO_KELVIN, plain: 'K = °C + 273.15' }],
          note: 'If your chart labels its dry adiabats in kelvin, read θe from the label and no conversion is needed. The °C to kelvin relation is on p. 63 of Wallace and Hobbs (2006).',
        },
        meaning: 'The potential temperature a parcel would reach if all its vapor condensed, the heat stayed with the air and the water fell out. It is given in kelvin.',
        start: `Spring storm example at ${START} mb: temperature ${a.t} °C, dewpoint ${a.td} °C.`,
        steps: ['Find the LCL for the starting level.', `Follow the moist adiabat upward until it runs nearly alongside the dry adiabats. This diagram goes to ${v.top} mb.`, 'Read the value of the dry adiabat you have reached. That value is θe. If it is not labeled in kelvin, follow it down to 1000 mb, read the temperature in °C and use the equation above.'],
        answer: `θe ≈ ${whole(v.thetaE)} K. This is a chart estimate: the two sets of lines are still not perfectly parallel. The book’s approximate equation (3.71) gives a slightly lower value here.`,
        use: 'comparing air for both warmth and moisture. It stays the same through dry and saturated adiabatic processes.',
        source: 'pp. 85–86',
        chart: () => chart({
          label: 'Equivalent potential temperature found by following a moist adiabat up to a dry adiabat', top: 180, bottom: 900,
          fit: [airAt, dewAt, cross, [v.topT, v.top], [Thermo.dryTemp(v.thetaE, 400), 400]],
          lines: [...liftLines(), guide('moist', moistLine(v.lclA.t, v.lclA.p, v.lclA.p, v.top)),
            guide('dry', dryLine(v.thetaE, 420, 180), { p: 330, words: `dry adiabat ${whole(v.thetaE)} K`, anchor: 'start', dx: 10 }),
            temperature(180, 900), dewpoint(180, 900)],
          path: [...liftRoutes, moistLine(v.lclA.t, v.lclA.p, v.lclA.p, v.top), dryLine(v.thetaE, v.top, 330)],
          steps: [{ n: 1, at: cross, dx: -34, dy: -8 }, { n: 2, at: [Thermo.moistTemp(v.lclA.t, v.lclA.p, 400), 400], dx: -36, dy: 0 }, { n: 3, at: [v.topT, v.top], dx: -34, dy: 6 }],
          answer: { at: [v.topT, v.top], words: `θe ≈ ${whole(v.thetaE)} K`, dx: 16, dy: 0 },
        }),
      },
    ]],
    ['Daytime heating', [
      {
        id: 'ccl', name: 'Convective condensation level (CCL)',
        meaning: 'The level where air rising because the ground has warmed it would become saturated. It is usually higher than the LCL.',
        start: `The spring storm example: the surface dewpoint is ${sfc.td} °C at ${sfc.p} mb.`,
        steps: ['Start at the surface dewpoint.', 'Follow its mixing ratio line upward.', 'Stop where it first meets the environmental temperature. Read the pressure there.'],
        answer: `The CCL is at about ${whole(tools.ccl.p)} mb, higher up than this parcel’s LCL at ${whole(parcel.lcl.p)} mb.`,
        use: 'estimating where cloud base could form if daytime heating alone starts the air rising. It is the starting point for the convective temperature.',
        links: [TRAINING, glossary('c', 'Convective Condensation Level')],
        chart: () => chart({
          label: 'CCL where the surface mixing ratio line meets the environmental temperature', top: 750, bottom: 1030,
          fit: [[sfc.t, sfc.p], [sfc.td, sfc.p], [tools.ccl.t, tools.ccl.p], [Thermo.dewFromMixingRatio(tools.sfcW, 770) + 5, 770]],
          lines: [guide('mix', mixLine(tools.sfcW, sfc.p, 770), { p: 778, words: 'mixing ratio line', anchor: 'start', dx: 8 }),
            temperature(750, 1000), dewpoint(750, 1000)],
          path: [mixLine(tools.sfcW, sfc.p, tools.ccl.p)],
          steps: [{ n: 1, at: [sfc.td, sfc.p], dx: -34, dy: -18 }, { n: 2, at: [Thermo.dewFromMixingRatio(tools.sfcW, 925), 925], dx: -36, dy: -8 }, { n: 3, at: [tools.ccl.t, tools.ccl.p], dx: -38, dy: -14 }],
          answer: { at: [tools.ccl.t, tools.ccl.p], words: `CCL ≈ ${whole(tools.ccl.p)} mb`, dx: 16, dy: -10 },
        }),
      },
      {
        id: 'convective-temperature', name: 'Convective temperature',
        meaning: 'The approximate temperature the air near the ground must warm to before storms could start from the surface by heating alone.',
        start: `The spring storm example. The air at the ground is ${sfc.t} °C.`,
        steps: ['Find the CCL.', `From the CCL, follow a dry adiabat down to the surface pressure, ${sfc.p} mb.`, 'Read the temperature there.'],
        answer: `The convective temperature is about ${whole(tools.convective)} °C, so the air at the ground would need to warm by about ${whole(tools.convective - sfc.t)} °C. This is an estimate that rests on many assumptions: storms can form earlier, later or not at all.`,
        use: 'judging whether daytime heating alone might start storms.',
        links: [TRAINING, glossary('c', 'Convective Temperature')],
        chart: () => chart({
          label: 'Convective temperature found by following a dry adiabat from the CCL to the ground', top: 750, bottom: 1030,
          fit: [[sfc.t, sfc.p], [sfc.td, sfc.p], [tools.ccl.t, tools.ccl.p], [tools.convective, sfc.p]],
          lines: [guide('mix', mixLine(tools.sfcW, sfc.p, tools.ccl.p)),
            guide('dry', dryLine(Thermo.theta(tools.ccl.t, tools.ccl.p), sfc.p, tools.ccl.p)),
            temperature(750, 1000), dewpoint(750, 1000)],
          path: [dryLine(Thermo.theta(tools.ccl.t, tools.ccl.p), tools.ccl.p, sfc.p), [[tools.convective, sfc.p], [tools.convective, 1030]]],
          steps: [{ n: 1, at: [tools.ccl.t, tools.ccl.p], dx: -38, dy: -14 }, { n: 2, at: [Thermo.dryTemp(Thermo.theta(tools.ccl.t, tools.ccl.p), 925), 925], dx: 36, dy: -8 }, { n: 3, at: [tools.convective, sfc.p], dx: 32, dy: -22 }],
          answer: { at: [tools.convective, sfc.p], words: `≈ ${whole(tools.convective)} °C`, dx: -16, dy: -12, anchor: 'end' },
        }),
      },
    ]],
    ['Stability indices', [
      {
        id: 'lifted-index', name: 'Lifted Index (LI)',
        equation: {
          latex: String.raw`\mathrm{LI} = T_{500} - T'_{500}`, plain: 'LI = T500 − T′500',
          symbols: [[String.raw`T_{500}`, 'T500', 'environmental temperature at 500 mb, in °C'],
            [String.raw`T'_{500}`, 'T′500', 'temperature of the lifted parcel at 500 mb, in °C']],
          note: 'The book defines the Lifted Index in words. This is that definition written as an equation.',
          also: [cancels('T_{500}', "T'_{500}")],
          worked: () => String.raw`\mathrm{LI} = ${one(v.at500.air)} - (${one(v.at500.parcel)}) \approx ${one(v.liftedIndex)}`,
          workedPlain: () => `LI = ${one(v.at500.air)} − (${one(v.at500.parcel)}) ≈ ${one(v.liftedIndex)}`,
        },
        meaning: 'How much colder or warmer the environmental temperature at 500 mb is than the parcel temperature of a parcel lifted there from the ground.',
        start: 'The surface parcel in the spring storm example.',
        steps: ['Lift the surface parcel along its path to 500 mb.', 'Read the environmental temperature and the parcel temperature at 500 mb.', 'Put both temperatures into the equation above.'],
        answer: `LI ≈ ${one(v.liftedIndex)} for the spring storm example.`,
        use: 'a quick guide to instability. In the book, negative values point to a potential for deep convection, and values below −9 to a potential for severe convection. It does not forecast a storm by itself. Some services start the parcel differently and use other categories.',
        source: 'p. 346, footnote 12',
        chart: () => chart({
          label: 'Lifted Index from the parcel and environmental temperatures at 500 mb', top: 400, bottom: 650,
          fit: [[v.at500.air, 500], [v.at500.parcel, 500], [Thermo.interp(parcel.path, 't', 640), 640], [Thermo.interp(levels, 't', 640), 640], [Thermo.interp(levels, 't', 410), 410]],
          lines: [{ cls: 'profile parcel', pts: parcelLine(100, 1000) }, temperature(400, 650)],
          path: [[[v.at500.air, 500], [v.at500.parcel, 500]]],
          notes: [{ at: [v.at500.air, 500], words: `environment ${one(v.at500.air)} °C`, dx: -10, dy: -10, anchor: 'end' },
            { at: [v.at500.parcel, 500], words: `parcel ${one(v.at500.parcel)} °C`, dx: -10, dy: 22, anchor: 'end' }],
          steps: [{ n: 1, at: [Thermo.interp(parcel.path, 't', 580), 580], dx: 36, dy: 6 }, { n: 2, at: [v.at500.air, 500], dx: -34, dy: 26 }, { n: 2, at: [v.at500.parcel, 500], dx: 34, dy: 26 },
            { n: 3, at: [(v.at500.air + v.at500.parcel) / 2, 500] }],
          answer: { plain: true, at: [(v.at500.air + v.at500.parcel) / 2, 500], words: `LI ≈ ${one(v.liftedIndex)}`, dx: 0, dy: -22, anchor: 'middle' },
        }),
      },
      {
        id: 'showalter', name: 'Showalter Index (SI)',
        equation: {
          latex: String.raw`\mathrm{SI} = T_{500} - T'_{500}`, plain: 'SI = T500 − T′500',
          symbols: [[String.raw`T_{500}`, 'T500', 'environmental temperature at 500 mb, in °C'],
            [String.raw`T'_{500}`, 'T′500', 'temperature at 500 mb of the parcel lifted from 850 mb, in °C']],
          worked: () => String.raw`\mathrm{SI} = ${one(tools.d.t)} - (${one(tools.parcel500)}) \approx ${one(tools.showalter)}`,
          workedPlain: () => `SI = ${one(tools.d.t)} − (${one(tools.parcel500)}) ≈ ${one(tools.showalter)}`,
          note: 'The Weather Service definition written as an equation.',
          also: [cancels('T_{500}', "T'_{500}")],
        },
        meaning: 'Like the Lifted Index, but the parcel starts at 850 mb instead of the ground.',
        start: `The spring storm example at 850 mb: temperature ${tools.b.t} °C, dewpoint ${tools.b.td} °C.`,
        steps: ['From 850 mb, follow a dry adiabat up from the temperature and a mixing ratio line up from the dewpoint to find the LCL.', 'Follow the moist adiabat from there up to 500 mb.', 'Put the air and parcel temperatures at 500 mb into the equation above.'],
        answer: `The Showalter Index is about ${one(tools.showalter)}. A negative value means the parcel temperature is warmer than the environmental temperature at 500 mb.`,
        use: 'looking above a shallow cool layer near the ground that could hide instability higher up. It ignores the moisture and heating below 850 mb, and cool layers reaching above 850 mb make it understate the potential.',
        links: [TRAINING, glossary('s', 'Showalter Index')],
        chart: () => chart({
          label: 'Showalter Index from a parcel lifted from 850 to 500 mb', top: 450, bottom: 900,
          fit: [[tools.b.t, 850], [tools.b.td, 850], [tools.lclB.t, tools.lclB.p], [tools.d.t, 500], [tools.parcel500, 500]],
          lines: [guide('dry', dryLine(Thermo.theta(tools.b.t, 850), 850, tools.lclB.p)), guide('mix', mixLine(Thermo.mixingRatio(tools.b.td, 850), 850, tools.lclB.p)),
            guide('moist', moistLine(tools.lclB.t, tools.lclB.p, tools.lclB.p, 500)), temperature(450, 900), dewpoint(450, 900)],
          path: [dryLine(Thermo.theta(tools.b.t, 850), 850, tools.lclB.p), mixLine(Thermo.mixingRatio(tools.b.td, 850), 850, tools.lclB.p),
            moistLine(tools.lclB.t, tools.lclB.p, tools.lclB.p, 500), across(tools.d.t, tools.parcel500, 500)],
          steps: [{ n: 1, at: [tools.lclB.t, tools.lclB.p], dx: 38, dy: 4 }, { n: 2, at: [Thermo.moistTemp(tools.lclB.t, tools.lclB.p, 600), 600], dx: 38, dy: 0 }, { n: 3, at: [(tools.d.t + tools.parcel500) / 2, 500] }],
          notes: [reading(tools.d.t, 500, `env. ${one(tools.d.t)} °C`, -10, -10, 'end'), reading(tools.parcel500, 500, `parcel ${one(tools.parcel500)} °C`, 10, -10, 'start')],
          answer: { plain: true, at: [(tools.d.t + tools.parcel500) / 2, 500], words: `SI ≈ ${one(tools.showalter)}`, dx: 0, dy: -32, anchor: 'middle' },
        }),
      },
      {
        id: 'k-index', name: 'K Index',
        equation: {
          latex: String.raw`\begin{aligned} K = {} & (T_{850} - T_{500}) + T_{d,850} \\ & - (T_{700} - T_{d,700}) \end{aligned}`,
          plain: 'K = (T850 − T500) + Td850 − (T700 − Td700)',
          symbols: [[String.raw`T`, 'T', 'environmental temperature at the pressure shown below it, in °C'], [String.raw`T_d`, 'Td', 'dewpoint at the pressure shown below it, in °C']],
          worked: () => String.raw`\begin{aligned} K &= (${tools.b.t} - (${tools.d.t})) + ${tools.b.td} - (${tools.c.t} - (${tools.c.td})) \\ &= ${whole(tools.kIndex)} \end{aligned}`,
          workedPlain: () => `K = (${tools.b.t} − (${tools.d.t})) + ${tools.b.td} − (${tools.c.t} − (${tools.c.td})) = ${whole(tools.kIndex)}`,
          note: 'The Weather Service formula for the K Index. Use °C and do not change to kelvin: this formula adds one more temperature than it subtracts, so kelvin would raise the answer by 273.15.',
        },
        meaning: 'A quick measure of thunderstorm potential from the cooling between 850 and 500 mb, the moisture at 850 mb and how dry the air is at 700 mb.',
        start: 'The spring storm example, using readings at 850, 700 and 500 mb.',
        steps: [`At 850 and 500 mb, read the temperatures: ${tools.b.t} and ${tools.d.t} °C.`, `At 850 mb, read the dewpoint: ${tools.b.td} °C.`, `At 700 mb, read the temperature and dewpoint: ${tools.c.t} and ${tools.c.td} °C.`, 'Put the readings into the equation above.'],
        answer: `The K Index for this example is ${whole(tools.kIndex)}.`,
        use: 'estimating the chance of ordinary thunderstorms, not how severe they would be. The training page’s rough guide calls 15 to 25 a small potential, 26 to 39 moderate and 40 or more high. It also says the index cannot be used in mountain areas.',
        links: [TRAINING, glossary('k', 'K-Index')],
        chart: () => readingsChart({
          label: 'K Index readings at 850, 700 and 500 mb', words: `K = ${whole(tools.kIndex)}`,
          path: [across(tools.c.td, tools.c.t, 700)],
          steps: [{ n: 1, at: [tools.b.t, 850], dx: 34, dy: -18 }, { n: 1, at: [tools.d.t, 500], dx: 34, dy: 22 }, { n: 2, at: [tools.b.td, 850], dx: -34, dy: -18 }, { n: 3, at: [(tools.c.t + tools.c.td) / 2, 700] }],
          notes: [reading(tools.b.t, 850, `T ${tools.b.t}`, 10, 18, 'start'), reading(tools.d.t, 500, `T ${tools.d.t}`, 10, -10, 'start'), reading(tools.b.td, 850, `Td ${tools.b.td}`, -10, 18, 'end'),
            reading(tools.c.t, 700, `T ${tools.c.t}`, 10, -8, 'start'), reading(tools.c.td, 700, `Td ${tools.c.td}`, -10, -8, 'end')],
        }),
      },
      {
        id: 'total-totals', name: 'Total Totals Index (TT)',
        equation: {
          latex: String.raw`\mathrm{TT} = T_{850} + T_{d,850} - 2\,T_{500}`, plain: 'TT = T850 + Td850 − 2 × T500',
          symbols: [[String.raw`T`, 'T', 'environmental temperature at the pressure shown below it, in °C'], [String.raw`T_d`, 'Td', 'dewpoint at the pressure shown below it, in °C']],
          worked: () => String.raw`\mathrm{TT} = ${tools.b.t} + ${tools.b.td} - 2\,(${tools.d.t}) = ${whole(tools.totalTotals)}`,
          workedPlain: () => `TT = ${tools.b.t} + ${tools.b.td} − 2 × (${tools.d.t}) = ${whole(tools.totalTotals)}`,
          note: 'The Weather Service glossary definition written as an equation. Use °C. (Kelvin would give the same answer, because two temperatures are added and two are subtracted.)',
        },
        meaning: 'A stability index that combines the cooling from 850 to 500 mb with the moisture at 850 mb.',
        start: 'The spring storm example, using readings at 850 and 500 mb.',
        steps: [`Read the temperature at 850 mb: ${tools.b.t} °C.`, `Read the dewpoint at 850 mb: ${tools.b.td} °C.`, `Read the temperature at 500 mb: ${tools.d.t} °C.`, 'Put the readings into the equation above.'],
        answer: `The Total Totals Index for this example is ${whole(tools.totalTotals)}.`,
        use: 'screening for severe storm potential. The Weather Service glossary says there are no magic cutoffs, but in general values under 50 are a weak sign and values over 55 a strong one. The Weather Service training page uses different categories. It also warns that very cold air at 500 mb can give artificially high values when the lower levels do not support storms.',
        links: [glossary('t', 'Total-Totals Index'), TRAINING],
        chart: () => readingsChart({
          label: 'Total Totals readings at 850 and 500 mb', words: `TT = ${whole(tools.totalTotals)}`,
          steps: [{ n: 1, at: [tools.b.t, 850], dx: 34, dy: -18 }, { n: 2, at: [tools.b.td, 850], dx: -34, dy: -18 }, { n: 3, at: [tools.d.t, 500], dx: 34, dy: 22 }],
          notes: [reading(tools.b.t, 850, `T ${tools.b.t}`, 10, 18, 'start'), reading(tools.b.td, 850, `Td ${tools.b.td}`, -10, 18, 'end'), reading(tools.d.t, 500, `T ${tools.d.t}`, 10, -10, 'start')],
        }),
      },
    ]],
  ];

  const make = (tag, className, content, parent) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    if (parent) parent.appendChild(node);
    return node;
  };

  // The textbook page, or links to the Weather Service pages the method comes from.
  function sourceLine(item, parent) {
    if (!item.links) {
      make('p', 'param-source', `Source: ${item.source} of Wallace and Hobbs (2006).`, parent);
      return;
    }
    const line = make('p', 'param-source', 'Sources: ', parent);
    item.links.forEach(([words, href], i) => {
      if (i) line.append('; ');
      const link = make('a', '', words, line);
      Object.assign(link, { href, target: '_blank', rel: 'noopener' });
    });
    line.append('.');
  }

  // An equation typeset with KaTeX, with its symbols and the worked numbers. Without KaTeX (no
  // internet connection) the plain words are shown instead.
  function equationBlock(eq, parent) {
    const typeset = (node, latex, plain, displayMode) => {
      if (root.katex) root.katex.render(latex, node, { displayMode, throwOnError: false });
      else node.textContent = plain;
    };
    const box = make('div', 'param-equation', undefined, parent);
    typeset(make('div', 'equation', undefined, box), eq.latex, eq.plain, true);
    const list = make('dl', 'symbols', undefined, box);
    for (const [latex, plain, meaning] of eq.symbols) {
      typeset(make('dt', '', undefined, list), latex, plain, false);
      make('dd', '', meaning, list);
    }
    make('p', 'param-worked', 'With the example’s numbers:', box);
    typeset(make('div', 'equation', undefined, box), eq.worked(), eq.workedPlain(), true);
    for (const extra of eq.also || []) {
      const part = make('div', 'param-extra', undefined, box);
      make('p', 'param-worked', extra.words, part);
      typeset(make('div', 'equation', undefined, part), extra.latex, extra.plain, true);
    }
    make('p', 'param-source', eq.note, box);
  }

  function entry(item) {
    const card = make('article', 'param');
    card.id = `param-${item.id}`;
    make('h4', '', item.name, card);
    make('p', '', item.meaning, card);
    make('p', 'param-start', `Worked example: ${item.start}`, card);
    if (item.equation) equationBlock(item.equation, card);
    const body = make('div', 'param-body', undefined, card);
    if (item.chart) make('figure', '', undefined, body).appendChild(item.chart());
    const words = make('div', '', undefined, body);
    const steps = make('ol', 'param-steps', undefined, words);
    for (const step of item.steps) make('li', '', step, steps);
    // Some entries compare several cases, each with its own chart, after the steps they share.
    for (const example of item.cases || []) {
      const part = make('section', 'param-case', undefined, words);
      make('h5', '', example.title, part);
      make('figure', '', undefined, part).appendChild(example.chart());
      make('p', '', example.words(), part);
    }
    make('p', 'param-result', item.answer, words);
    const use = make('p', 'use', undefined, card);
    make('strong', '', 'What we use it for: ', use);
    use.append(item.use);
    sourceLine(item, card);
    return card;
  }

  // These are described higher up the page, so their charts and steps are built into those
  // descriptions instead of being listed again.
  const INLINE = ['parcel', 'lcl', 'lfc', 'el', 'cin', 'cape'];

  function addToDescription(item) {
    const card = document.querySelector(`.explain [data-sample="${item.id}"]`);
    const words = card.querySelector(':scope > div'), use = words.querySelector('.use');
    const how = make('div', 'param-how');
    make('h4', '', 'Finding it on the Skew-T', how);
    make('p', 'param-start', `Worked example: ${item.start}`, how);
    const body = make('div', 'param-body', undefined, how);
    make('figure', '', undefined, body).appendChild(item.chart());
    const steps = make('ol', 'param-steps', undefined, body);
    for (const step of item.steps) make('li', '', step, steps);
    make('p', 'param-result', item.answer, body);
    words.insertBefore(how, use);
    make('p', 'param-source', `Source for finding it: ${item.source} of Wallace and Hobbs (2006).`, words);
    card.id = `param-${item.id}`;
  }

  // The entries Beginner shows. Intermediate shows every entry.
  const BEGINNER = ['mixing-ratio', 'saturation-mixing-ratio', 'relative-humidity', 'freezing-level', 'inversion', 'lifted-index'];

  // Groups open and close. A group's charts are drawn the first time it opens. Returns a function
  // that shows one level's entries: 'beginner' or 'intermediate'.
  function render(container, menu) {
    const open = [], groups = [];
    let level = 'beginner';
    const shows = item => level === 'intermediate' || BEGINNER.includes(item.id);
    for (const [, items] of GROUPS) items.filter(item => INLINE.includes(item.id)).forEach(addToDescription);
    for (const [title, all] of GROUPS) {
      const items = all.filter(item => !INLINE.includes(item.id));
      if (!items.length) continue;
      const group = make('details', 'param-group', undefined, container);
      const heading = make('summary', '', undefined, group);
      const cards = new Map();
      const apply = () => { for (const [item, card] of cards) card.hidden = !shows(item); };
      const build = () => {
        if (!cards.size) for (const item of items) cards.set(item, group.appendChild(entry(item)));
        apply();
      };
      group.addEventListener('toggle', () => { if (group.open) build(); });
      for (const item of items) open[item.id] = () => { group.open = true; build(); };
      groups.push({ title, items, group, heading, apply });
    }

    // The jump menu lists only the entries on show.
    function setLevel(chosen) {
      level = chosen;
      while (menu.options.length > 1) menu.lastElementChild.remove();
      for (const { title, items, group, heading, apply } of groups) {
        const shown = items.filter(shows);
        group.hidden = !shown.length;
        heading.textContent = `${title} (${shown.length})`;
        apply();
        if (!shown.length) continue;
        const choices = make('optgroup', '', undefined, menu);
        choices.label = title;
        for (const item of shown) choices.appendChild(new Option(item.name, item.id));
      }
      menu.value = '';
    }
    menu.addEventListener('change', () => {
      if (!menu.value) return;
      open[menu.value]();
      document.getElementById(`param-${menu.value}`).scrollIntoView({ block: 'start' });
    });
    setLevel(level);
    return setLevel;
  }

  root.SkewParams = { render };
})(this);
