/* global Thermo, SkewChart */
// The chart shared by the Practice and Test pages: drawing, highlighting, picking lines and
// checking plotted points. Like Learn, it uses the introductory parcel calculation.
(function (root) {
  'use strict';
  const { BOX, BARB_X, PTOP, PBOT, PW, PH, H, yOf, pOf, xOf, tOf, el, text, pathD, range, pLabelClass, background, barb, shade, toChart, marker } = SkewChart;

  // A plotted point counts if it lands in a small circle around the exact spot (radius in chart
  // units). Touch gets slightly more room. Both stay under 15, the smallest gap between pressure lines.
  const HIT_MOUSE = 12, HIT_TOUCH = 14;
  // How near a line a pointer must be to pick it, in screen pixels.
  const REACH_MOUSE = 9, REACH_TOUCH = 14;
  // Level markers are drawn on top of other lines, so they get this head start when picking.
  const MARKER_LEAD = 3;
  const LEVELS = ['lcl', 'lfc', 'el'];

  const spot = item => [xOf(item.value, item.p), yOf(item.p)];

  function segDist(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - a[0] - u * dx, y - a[1] - u * dy);
  }

  // null if the point is close enough. Otherwise one thing to fix: height first, then temperature,
  // because off the pressure line a temperature difference is confusing on a skewed chart.
  function plotHint(point, item) {
    const [goalX, goalY] = spot(item), { x, y, radius } = point;
    if (Math.hypot(x - goalX, y - goalY) <= radius) return null;
    if (Math.abs(y - goalY) > radius / 2) {
      return `First get the height right. Your point is too ${y < goalY ? 'high' : 'low'}: move ${y < goalY ? 'down' : 'up'} to the ${item.p} mb line.`;
    }
    const off = tOf(x, pOf(y)) - item.value;
    if (Math.abs(off) > 1) return `Your height is right. Along this line, you are about ${Math.round(Math.abs(off))} °C too ${off > 0 ? 'warm (move left)' : 'cold (move right)'}.`;
    return 'Very close! Click a little nearer.';
  }

  function create(svg, sounding) {
    const levels = sounding.levels, par = Thermo.parcel(levels);
    svg.replaceChildren();
    const clip = el('clipPath', { id: 'quizclip' }, el('defs', {}, svg));
    el('rect', { x: BOX.left, y: BOX.top, width: PW, height: PH }, clip);
    const base = el('g', {}, svg);
    const plot = el('g', { 'clip-path': 'url(#quizclip)' }, base);
    const profilePts = key => levels.map(l => [xOf(l[key], l.p), yOf(l.p)]);
    const parcelPts = par.path.map(q => [xOf(q.t, q.p), yOf(q.p)]);
    if (par.lfc) {
      shade(par, plot, par.lfc, par.el || PTOP, 1, 'cape');
      shade(par, plot, levels[0].p, par.lfc, -1, 'cin');
    }
    for (const b of background) el('path', { d: pathD(b.pts), class: 'bg ' + b.kind }, plot);
    for (const [cls, pts] of [['parcel', parcelPts], ['dew', profilePts('td')], ['temp', profilePts('t')]]) {
      el('path', { d: pathD(pts), class: 'profile ' + cls }, plot);
    }
    el('rect', { x: BOX.left, y: BOX.top, width: PW, height: PH, class: 'frame' }, base);
    for (const t of range(-40, 40, 10)) text(base, xOf(t, PBOT), BOX.bottom + 18, t, 'axis');
    text(base, (BOX.left + BOX.right) / 2, H - 6, 'Temperature (°C)', 'axis title');
    for (let p = PTOP; p <= 1050; p += 50) text(base, BOX.left - 8, yOf(p) + 4, p, pLabelClass(p), 'end');
    text(base, 8, 12, 'mb', 'axis unit', 'start');
    for (const l of levels) barb(base, BARB_X, yOf(l.p), l.wdir, l.wspd);

    // LCL, LFC and EL each have their own column. A sounding may have no LFC or EL.
    const markers = {};
    for (const [key, p, inset] of [['lcl', par.lcl.p, 92], ['lfc', par.lfc, 48], ['el', par.el, 4]]) {
      if (!p) continue;
      const x2 = BOX.right - inset;
      markers[key] = marker(base, key.toUpperCase(), yOf(p), x2);
    }

    // Layers drawn over the chart, bottom to top.
    const mark = el('g', { 'clip-path': 'url(#quizclip)', 'pointer-events': 'none' }, svg);
    const hover = el('g', { 'clip-path': 'url(#quizclip)', 'pointer-events': 'none' }, svg);
    const points = el('g', { class: 'plotted', 'clip-path': 'url(#quizclip)', 'pointer-events': 'none' }, svg);

    const lines = background.map(b => ({ kind: b.kind, pts: b.pts }))
      .concat([{ kind: 'temp', pts: profilePts('t') }, { kind: 'dew', pts: profilePts('td') }, { kind: 'parcel', pts: parcelPts }])
      .concat(Object.entries(markers).map(([kind, pts]) => ({ kind, pts })));
    // The shaded areas can be picked too. A sounding may have neither.
    const areas = ['cape', 'cin'].map(kind => ({ kind, shapes: [...plot.querySelectorAll('.' + kind)] }))
      .filter(area => area.shapes.length);
    const has = kind => lines.concat(areas).some(feature => feature.kind === kind);
    const inBox = (x, y) => x >= BOX.left && x <= BOX.right && y >= BOX.top && y <= BOX.bottom;
    function outline(parent, feature, cls) {
      const shapes = feature.shapes ? feature.shapes.map(s => s.getAttribute('d')) : [pathD(feature.pts)];
      for (const d of shapes) el('path', { d, class: cls }, parent);
    }
    // The shaded area containing a point, allowing some slack to either side for thin slivers.
    const areaAt = (list, x, y, slack = 0) => list.find(area =>
      area.shapes.some(shape => [0, -slack, slack].some(dx => shape.isPointInFill(new DOMPoint(x + dx, y)))));

    // The line or area a pointer event picks. Where lines cross, the wanted kind counts if it is about
    // as close as the closest line. When an area is wanted, areas count before the lines crossing them.
    function lineAt(e, wanted) {
      const { x, y } = toChart(svg, e), scale = svg.getScreenCTM().a;
      // A click has no pointerType in some browsers, so the larger touch reach is the fallback.
      const reach = e.pointerType === 'mouse' ? REACH_MOUSE : REACH_TOUCH;
      if (!inBox(x, y)) return null;
      const wantedArea = areas.filter(area => area.kind === wanted);
      if (wantedArea.length || wanted === 'cape' || wanted === 'cin') {
        const hit = areaAt(areas, x, y) || areaAt(wantedArea, x, y, reach / scale / 2);
        if (hit) return hit;
      }
      const found = [];
      for (const line of lines) {
        let d = Infinity;
        for (let i = 0; i < line.pts.length - 1; i++) d = Math.min(d, segDist(x, y, line.pts[i], line.pts[i + 1]));
        if (d * scale <= reach) found.push({ line, rank: d * scale - (LEVELS.includes(line.kind) ? MARKER_LEAD : 0) });
      }
      if (!found.length) return areaAt(areas, x, y) || null;
      found.sort((a, b) => a.rank - b.rank);
      const match = found.find(f => f.line.kind === wanted);
      return match && match.rank <= found[0].rank + 3 ? match.line : found[0].line;
    }

    // Where a click would plot a point, or null outside the chart.
    function pointAt(e) {
      const { x, y } = toChart(svg, e);
      return inBox(x, y) ? { x, y, radius: e.pointerType === 'touch' ? HIT_TOUCH : HIT_MOUSE } : null;
    }

    // Removes everything drawn over the chart.
    function clear() {
      base.classList.remove('faded', 'answered');
      for (const layer of [mark, hover, points]) layer.replaceChildren();
    }

    // Picks out one feature for a question. show is [kind, value].
    function highlight(show) {
      clear();
      if (!show) return;
      base.classList.add('faded');
      const [kind, value] = show;
      if (kind === 'cape' || kind === 'cin') {
        for (const area of plot.querySelectorAll('.' + kind)) el('path', { d: area.getAttribute('d'), class: 'quiz-area ' + kind }, mark);
        return;
      }
      let pts;
      if (kind === 'temp') pts = profilePts('t');
      else if (kind === 'dew') pts = profilePts('td');
      else if (kind === 'parcel') pts = parcelPts;
      else if (kind in markers) pts = markers[kind];
      else pts = background.find(b => b.kind === kind && b.value === value).pts;
      el('path', { d: pathD(pts), class: 'quiz-halo' }, mark);
      el('path', { d: pathD(pts), class: 'highlight ' + kind }, mark);
    }

    // After an answer: every line of the wanted kind, then the one that was picked.
    function showAnswer(kind, picked) {
      clear();
      // Once the answer is showing, the other lines step back so it stands out.
      base.classList.toggle('answered', Boolean(kind));
      const answerClass = feature => (feature.shapes ? 'quiz-area ' : 'find-answer ') + feature.kind;
      for (const feature of lines.concat(areas).filter(l => l.kind === kind)) outline(mark, feature, answerClass(feature));
      if (picked) {
        const right = picked.kind === kind;
        outline(mark, picked, right ? 'quiz-halo' : 'find-wrong');
        if (right) outline(mark, picked, picked.shapes ? answerClass(picked) : 'highlight ' + picked.kind);
      }
      // The level just identified gets its name back.
      if (kind && kind in markers) {
        const [[x1, y], [x2]] = markers[kind];
        text(mark, (x1 + x2) / 2, y - 7, kind.toUpperCase(), 'markerlabel');
      }
    }

    // Marks a line or area without saying what it is: on hover, or as a chosen but unmarked answer.
    function showPick(line) {
      mark.replaceChildren();
      if (line) outline(mark, line, 'quiz-halo');
    }
    function preview(line) {
      hover.replaceChildren();
      if (line) outline(hover, line, 'quiz-halo');
    }

    // placed: plot items to show. chosen: an unmarked point. miss: a wrong point. guide: a pressure.
    function drawPoints({ placed = [], chosen = null, chosenKey = 't', miss = null, guide = null } = {}) {
      const { SERIES } = root.QuizData;
      points.replaceChildren();
      for (const key of ['t', 'td']) {
        const pts = placed.filter(item => item.key === key).sort((a, b) => b.p - a.p).map(spot);
        if (pts.length > 1) el('path', { d: pathD(pts), class: 'profile ' + SERIES[key].cls }, points);
        for (const [x, y] of pts) el('circle', { cx: x, cy: y, r: 6, class: 'placed ' + SERIES[key].cls }, points);
      }
      if (chosen) el('circle', { cx: chosen.x, cy: chosen.y, r: 6, class: 'placed ' + SERIES[chosenKey].cls }, points);
      if (miss) {
        const { x, y } = miss;
        el('path', { d: `M${x - 7} ${y - 7}L${x + 7} ${y + 7}M${x - 7} ${y + 7}L${x + 7} ${y - 7}`, class: 'miss' }, points);
      }
      if (guide) el('path', { d: `M${BOX.left} ${yOf(guide)}H${BOX.right}`, class: 'quiz-halo' }, points);
    }

    return { par, has, lineAt, pointAt, clear, highlight, showAnswer, showPick, preview, drawPoints };
  }

  // The large pressure and value card shown while plotting.
  function valueCard(item) {
    const { SERIES } = root.QuizData;
    const card = document.createElement('div');
    card.className = 'value-card ' + SERIES[item.key].cls;
    for (const [label, value] of [['Pressure', `${item.p} mb`], [SERIES[item.key].name, `${item.value} °C`]]) {
      const part = document.createElement('div'), small = document.createElement('span'), big = document.createElement('strong');
      small.textContent = label;
      big.textContent = value;
      part.append(small, big);
      card.appendChild(part);
    }
    return card;
  }

  // The small wind barb drawn beside a wind question.
  function windIcon(parent, [dir, speed]) {
    const icon = el('svg', { viewBox: '-40 -22 80 44', class: 'quiz-barb', role: 'img', 'aria-label': 'Wind barb' }, parent);
    barb(icon, 14, 0, dir, speed);
  }

  root.QuizChart = { create, plotHint, valueCard, windIcon };
})(this);
