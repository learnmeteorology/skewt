/* global Thermo, SOUNDINGS, SkewChart, SkewGuide, SkewParams */
// Step-by-step story: each step adds one layer to the chart. Going back removes it.
(function () {
  'use strict';
  const { BOX, BARB_X, PTOP, PBOT, PW, PH, SKEW, H, yOf, xOf, el, text, pathD, range, pLabelClass, background, barb, shade, marker, barbKey } = SkewChart;
  const svg = document.getElementById('build');
  const levels = SOUNDINGS[0].levels;
  const par = Thermo.parcel(levels);

  // Text is beginner level: [layer added, title, caption]. build.html explains each line further down.
  const STEPS = [
    ['frame', 'Start with an empty chart',
      'A Skew-T shows how temperature, moisture and wind change as you go up through the atmosphere. We will follow a parcel: a small, imaginary portion of air. Press Next to build the chart.'],
    ['isobar', 'Pressure marks the height',
      'Flat lines show air pressure in millibars (mb). Pressure drops as you go up.'],
    ['upright', 'Add temperature lines',
      'Each line marks one temperature in °C: colder to the left, warmer to the right.'],
    ['isotherm', 'Now skew them',
      'The temperature lines tilt to the right. This is the "skew" in Skew-T.'],
    ['dry', 'Dry adiabats',
      'These show how rising air without cloud cools: about 10 °C per kilometer.'],
    ['moist', 'Moist adiabats',
      'These show how rising air inside a cloud cools. It cools more slowly than dry air.'],
    ['mix', 'Mixing ratio lines',
      'These show how much water vapor saturated air holds. The background is now complete.'],
    ['temp', 'Plot the environmental temperature',
      'The environmental temperature is the temperature of the surrounding air at each height. We measure it with radiosondes: small instrument packages carried up by weather balloons. Their readings are the data we plot.'],
    ['dew', 'Plot the dewpoint',
      'Now add the dewpoint. Where it is close to the environmental temperature, the air is humid.'],
    ['wind', 'Add the wind',
      'Wind barbs on the right show wind. The long staff points to where the wind comes from. Add up its marks to get the speed:'],
    ['parcel', 'Lift a parcel of air',
      'The parcel temperature follows a parcel of ground-level air pushed upward. The LCL (lifting condensation level) is where it becomes saturated.'],
    ['levels', 'Where can the parcel rise on its own?',
      'Higher up, the parcel temperature becomes warmer than the environmental temperature at the LFC (level of free convection). It stays warmer up to the EL (equilibrium level).'],
    ['cin', 'CIN: the push it needs',
      'The newly shaded area is CIN (convective inhibition). There the parcel temperature is colder than the environmental temperature, so the parcel needs a push to reach the LFC.'],
    ['cape', 'CAPE: energy for rising',
      'The newly shaded area is CAPE (convective available potential energy). There the parcel temperature is warmer than the environmental temperature. More CAPE allows stronger updrafts.'],
    ['done', 'You have built a Skew\u2011T',
      'Every layer is in place. <a href="#lines">See what each line is for</a>.'],
  ];
  const order = STEPS.map(s => s[0]);

  const clip = el('clipPath', { id: 'buildclip' }, el('defs', {}, svg));
  el('rect', { x: BOX.left, y: BOX.top, width: PW, height: PH }, clip);
  const layers = {};
  // Creation order is stacking order: shading underneath, data on top.
  for (const key of ['cin', 'cape', 'isobar', 'upright', 'dry', 'moist', 'mix', 'frame', 'parcel', 'levels', 'dew', 'temp', 'wind']) {
    layers[key] = el('g', { class: 'layer', 'data-key': key }, svg);
  }
  const clipped = key => el('g', { 'clip-path': 'url(#buildclip)' }, layers[key]);
  // Solid lines are drawn in with a dash animation. Dashed styles fade in instead.
  const SOLID = ['isobar', 'dry', 'temp', 'dew'];
  const line = (parent, pts, cls, kind) => {
    const attrs = { d: pathD(pts), class: cls };
    if (SOLID.includes(kind)) { attrs.pathLength = 1; attrs.class += ' draw'; }
    return el('path', attrs, parent);
  };

  el('rect', { x: BOX.left, y: BOX.top, width: PW, height: PH, class: 'frame' }, layers.frame);

  const groups = {};
  for (const key of ['isobar', 'dry', 'moist', 'mix']) groups[key] = clipped(key);
  // Isotherms are drawn separately below so they can tilt.
  for (const b of background) {
    if (b.kind !== 'isotherm') line(groups[b.kind], b.pts, 'bg ' + b.kind, b.kind);
  }
  for (let p = PTOP; p <= 1050; p += 50) text(layers.isobar, BOX.left - 8, yOf(p) + 4, p, pLabelClass(p), 'end');
  text(layers.isobar, 8, 12, 'mb', 'axis unit', 'start');

  // x position of a temperature line for a given amount of skew.
  const xAt = (t, p, skew) => xOf(t, p) - (SKEW - skew) * (BOX.bottom - yOf(p));
  const isoPoints = (t, skew) => [[xAt(t, PBOT, skew), yOf(PBOT)], [xAt(t, PTOP, skew), yOf(PTOP)]];
  const upright = clipped('upright');
  const tilting = range(-110, 40, 10).map(t => ({ t, path: el('path', { d: pathD(isoPoints(t, 0)), class: 'bg isotherm' }, upright) }));
  for (const t of range(-40, 40, 10)) text(layers.upright, xOf(t, PBOT), BOX.bottom + 18, t, 'axis');
  text(layers.upright, (BOX.left + BOX.right) / 2, H - 6, 'Temperature (°C)', 'axis title');

  for (const [key, field] of [['temp', 't'], ['dew', 'td']]) {
    line(clipped(key), levels.map(l => [xOf(l[field], l.p), yOf(l.p)]), 'profile ' + key, key);
    for (const l of levels) el('circle', { cx: xOf(l[field], l.p), cy: yOf(l.p), r: 4, class: 'dot still ' + key }, layers[key]);
  }
  for (const l of levels) barb(layers.wind, BARB_X, yOf(l.p), l.wdir, l.wspd);

  const levelMark = (parent, name, p, inset) => marker(parent, name, yOf(p), BOX.right - inset);
  line(clipped('parcel'), par.path.map(q => [xOf(q.t, q.p), yOf(q.p)]), 'profile parcel', 'parcel');
  levelMark(layers.parcel, 'LCL', par.lcl.p, 4);
  shade(par, clipped('cape'), par.lfc, par.el || PTOP, 1, 'cape');
  shade(par, clipped('cin'), levels[0].p, par.lfc, -1, 'cin');
  levelMark(layers.levels, 'LFC', par.lfc, 48);
  if (par.el) levelMark(layers.levels, 'EL', par.el, 4);

  const $ = id => document.getElementById(id);
  // Animate the temperature lines from upright to skewed (or back).
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  let skewNow = 0, frame = 0;
  function tilt(target) {
    cancelAnimationFrame(frame);
    const from = skewNow, began = performance.now();
    const move = now => {
      const u = still.matches ? 1 : Math.min(1, Math.max(0, (now - began) / 900));
      skewNow = from + (target - from) * u * u * (3 - 2 * u);
      for (const item of tilting) item.path.setAttribute('d', pathD(isoPoints(item.t, skewNow)));
      if (u < 1) frame = requestAnimationFrame(move);
    };
    frame = requestAnimationFrame(move);
  }

  let current = -1;
  function show(i) {
    if (i === current) return;
    const skewAt = order.indexOf('isotherm');
    for (const key in layers) {
      const at = order.indexOf(key);
      // The upright lines do the tilting, so they stand in for the isotherms from then on.
      let visible = at <= i;
      if (key === 'upright') visible = i >= at;
      layers[key].classList.toggle('on', visible);
      layers[key].classList.toggle('new', at === i || (key === 'upright' && i === skewAt));
    }
    tilt(i >= skewAt ? SKEW : 0);
    $('count').textContent = `${i + 1} / ${STEPS.length}`;
    $('title').textContent = STEPS[i][1];
    $('short').innerHTML = STEPS[i][2];
    current = i;
    $('barbkey').hidden = STEPS[i][0] !== 'wind';
  }

  barbKey($('barbkey'));
  // The explanations below the builder: each card gets a drawing of its line.
  document.querySelectorAll('[data-sample]').forEach(card => card.prepend(SkewGuide.sample(card.dataset.sample)));
  barbKey($('cardbarbs'));
  const showParams = SkewParams.render($('params'), $('parammenu'));

  // Beginner shows the basics and Intermediate shows everything. The choice is remembered.
  const LEVELS = {
    beginner: { hint: 'The basics', note: 'Beginner shows the basic parameters. Intermediate has more of them, with extra equation steps.',
      other: 'intermediate', button: 'Show Intermediate' },
    intermediate: { hint: 'Everything', note: 'Intermediate shows every parameter.', other: 'beginner', button: 'Show only the basics' },
  };
  let level = 'beginner';
  try { if (localStorage.getItem('learnLevel') === 'intermediate') level = 'intermediate'; } catch (e) { /* storage may be blocked */ }
  const levelButtons = document.querySelectorAll('[data-level]');
  function setLevel(chosen) {
    level = chosen;
    document.body.classList.toggle('beginner', level === 'beginner');
    for (const button of levelButtons) button.setAttribute('aria-pressed', button.dataset.level === level);
    $('levelhint').textContent = LEVELS[level].hint;
    $('levelnote').textContent = LEVELS[level].note;
    $('levelswitch').textContent = LEVELS[level].button;
    showParams(level);
  }
  function chooseLevel(chosen) {
    setLevel(chosen);
    try { localStorage.setItem('learnLevel', chosen); } catch (e) { /* not remembered */ }
  }
  for (const button of levelButtons) button.addEventListener('click', () => chooseLevel(button.dataset.level));
  $('levelswitch').addEventListener('click', () => chooseLevel(LEVELS[level].other));
  setLevel(level);

  const back = $('back'), next = $('next');
  const dots = STEPS.map((s, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'step-dot';
    dot.setAttribute('aria-label', `Step ${i + 1}: ${s[1]}`);
    dot.title = s[1];
    dot.addEventListener('click', () => go(i));
    $('dots').appendChild(dot);
    return dot;
  });
  const jump = $('jump');
  STEPS.forEach((s, i) => jump.add(new Option(`${i + 1}. ${s[1]}`, i)));
  jump.addEventListener('change', () => go(Number(jump.value)));
  function go(i) {
    show(Math.max(0, Math.min(STEPS.length - 1, i)));
    back.disabled = current === 0;
    jump.value = current;
    next.textContent = current === STEPS.length - 1 ? 'Start over' : 'Next';
    dots.forEach((dot, n) => {
      dot.classList.toggle('done', n < current);
      if (n === current) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });
  }
  back.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current === STEPS.length - 1 ? 0 : current + 1));
  window.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target === jump) return; // the menu uses the arrow keys itself
    if (e.key === 'ArrowRight') go(current + 1);
    else if (e.key === 'ArrowLeft') go(current - 1);
  });
  go(0);
})();
