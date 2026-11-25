/* global SOUNDINGS, SkewChart */
// A simple preview chart for the start page: pressure, temperature lines, temperature, dewpoint and wind.
(function () {
  'use strict';
  const { BOX, BARB_X, PW, PH, PTOP, yOf, xOf, el, text, pathD, pLabelClass, background, barb } = SkewChart;
  const svg = document.getElementById('herochart');
  const levels = SOUNDINGS[0].levels;
  const clip = el('clipPath', { id: 'heroclip' }, el('defs', {}, svg));
  el('rect', { x: BOX.left, y: BOX.top, width: PW, height: PH }, clip);
  const plot = el('g', { 'clip-path': 'url(#heroclip)' }, svg);
  for (const line of background) {
    if (line.kind === 'isobar' || line.kind === 'isotherm') el('path', { d: pathD(line.pts), class: 'bg ' + line.kind }, plot);
  }
  for (const [cls, key] of [['dew', 'td'], ['temp', 't']]) {
    el('path', { d: pathD(levels.map(l => [xOf(l[key], l.p), yOf(l.p)])), class: 'profile ' + cls }, plot);
  }
  el('rect', { x: BOX.left, y: BOX.top, width: PW, height: PH, class: 'frame' }, svg);
  for (const l of levels) barb(svg, BARB_X, yOf(l.p), l.wdir, l.wspd);
  for (let p = PTOP; p <= 1050; p += 50) text(svg, BOX.left - 8, yOf(p) + 4, p, pLabelClass(p), 'end');
  text(svg, BOX.left - 44, 12, 'mb', 'axis unit', 'start');
  // Crop away the space reserved for the temperature numbers, which this preview leaves out.
  svg.setAttribute('viewBox', `${BOX.left - 50} 0 ${BARB_X - BOX.left + 90} ${BOX.bottom + 12}`);
})();
