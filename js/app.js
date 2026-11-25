/* global Thermo, SOUNDINGS, SkewChart, SkewGuide */
(function () {
  'use strict';
  const { W, H, BOX, BARB_X, PTOP, PBOT, TMIN, TMAX, PW, PH, SKEW, yOf, pOf, xOf, tOf, el, text, pathD, f1, range, pLabelClass, background, barb, shade, toChart, marker } = SkewChart;
  const $ = id => document.getElementById(id);
  const svg = $('skewt'), tip = $('tooltip');
  // What each kind of line means, used by the tooltip and the guide.
  const GUIDE = {
    temp: ['Temperature', 'How warm the surrounding air is at each pressure level.'],
    dew: ['Dewpoint', 'The temperature the air must cool to, at constant pressure, to saturate. The closer it is to the temperature line, the more humid the air.'],
    tvair: ['Virtual temperature of the air', 'The air temperature adjusted for its moisture. CAPE and CIN compare the parcel with this line.'],
    tvparcel: ['Virtual temperature of the parcel', 'The parcel temperature adjusted for its moisture. The shading lies between this line and the virtual temperature of the air.'],
    parcel: ['Lifted surface parcel', 'The path of a parcel (a small, imaginary portion) of surface air pushed upward. It cools along a dry adiabat up to the LCL, then along a moist adiabat.'],
    isobar: ['Isobar (constant pressure)', 'Horizontal lines. Pressure decreases as you go up.'],
    isotherm: ['Isotherm (constant temperature)', 'These slant up to the right. That slant is the "skew" in Skew-T.'],
    dry: ['Dry adiabat', 'Unsaturated air that rises or sinks without exchanging heat follows these. Each has one potential temperature (θ).'],
    moist: ['Moist adiabat', 'Saturated rising air follows these. It cools more slowly than dry air because condensation releases heat. Labeled by temperature at 1000 mb.'],
    mix: ['Saturation mixing ratio', 'Grams of water vapor per kilogram of dry air needed for saturation. At the dewpoint, it gives the actual amount of vapor.'],
    wind: ['Wind barb', 'The staff points toward where the wind comes from. Half barb = 5 kt, full barb = 10 kt, flag = 50 kt.'],
    cape: ['CAPE', 'Convective Available Potential Energy: where the parcel is warmer than its surroundings, added up over every red area. There can be more than one. More CAPE allows stronger updrafts.'],
    cin: ['CIN', 'Convective Inhibition: where the parcel is colder than its surroundings. This chart adds up every blue area from the surface to the EL. Colder layers slow a rising parcel.'],
    lcl: ['LCL (lifting condensation level)', 'Where the lifted parcel saturates. An estimate of cloud base.'],
    lfc: ['LFC (level of free convection)', 'The bottom of a warmer layer, where the parcel can start rising on its own. A sounding can have more than one.'],
    el: ['EL (equilibrium level)', 'Where the parcel stops being warmer than its surroundings. A sounding can have more than one; this chart labels only the highest.'],
  };

  let full = false; // the basic view shows only pressure, temperature, dewpoint and wind
  const BASIC = ['isobar', 'isotherm', 'temp', 'dew', 'wind'];
  const inView = kind => full || BASIC.includes(kind);
  const joules = v => `${Math.round(v).toLocaleString()} J/kg`;
  let levels, hgt, par, current = 0, dragging = null, shift = 0, marked = null;
  let lines = []; // everything that can be hovered
  const TLOW = -110, THIGH = 50; // limits for edited values, °C

  function draw() {
    hgt = Thermo.heights(levels);
    // The parcel results belong to the Full chart, which applies the virtual temperature correction.
    // It also counts every warmer layer: a sounding can have more than one LFC and more than one CAPE area.
    par = Thermo.parcel(levels, 2, { virtual: true, allLayers: true });
    lines = [];
    svg.replaceChildren();
    const clip = el('clipPath', { id: 'clip' }, el('defs', {}, svg));
    el('rect', { x: BOX.left, y: BOX.top, width: PW, height: PH }, clip);
    const plot = el('g', { 'clip-path': 'url(#clip)' }, svg);

    if (full && par.lfc) {
      shade(par, plot, levels[0].p, par.el || PTOP, 1, 'cape');
      // All the blue from the surface up to the EL is CIN.
      shade(par, plot, levels[0].p, par.el || PTOP, -1, 'cin');
    }
    for (const line of background) {
      if (!full && !BASIC.includes(line.kind)) continue;
      el('path', { d: pathD(line.pts), class: 'bg ' + line.kind }, plot);
      lines.push(line);
    }

    for (const t of range(-40, 40, 10)) text(svg, xOf(t, PBOT), BOX.bottom + 18, t, 'axis');
    text(svg, (BOX.left + BOX.right) / 2, H - 6, 'Temperature (°C)', 'axis title');
    for (let p = PTOP; p <= 1050; p += 50) text(svg, BOX.left - 8, yOf(p) + 4, p, pLabelClass(p), 'end');
    text(svg, 8, 12, 'mb', 'axis unit', 'start');
    el('rect', { x: BOX.left, y: BOX.top, width: PW, height: PH, class: 'frame' }, svg);

    const addProfile = (kind, pts) => {
      el('path', { d: pathD(pts), class: 'profile ' + kind }, plot);
      lines.push({ kind, pts });
    };
    if (full) {
      // The shading lies between these two virtual temperature curves.
      addProfile('tvair', par.path.map(q => [xOf(q.envCmp, q.p), yOf(q.p)]));
      addProfile('tvparcel', par.path.map(q => [xOf(q.cmp, q.p), yOf(q.p)]));
      addProfile('parcel', par.path.map(q => [xOf(q.t, q.p), yOf(q.p)]));
    }
    addProfile('dew', levels.map(l => [xOf(l.td, l.p), yOf(l.p)]));
    addProfile('temp', levels.map(l => [xOf(l.t, l.p), yOf(l.p)]));

    // One lifted parcel has one LCL, but it can have several LFCs. Those are numbered from the ground
    // up when there is more than one, matching the parcel results. Only the highest EL is labeled.
    const number = i => (par.layers.length > 1 ? ` ${i + 1}` : '');
    const marks = [['lcl', par.lcl.p, ''],
      ...par.layers.map((layer, i) => ['lfc', layer.lfc, number(i)]), ['el', par.el, '']];
    for (const [kind, p, n] of full ? marks : []) {
      if (!p || p < PTOP) continue;
      // LCL, LFC and EL each have their own column, so labels at nearby pressures don't collide.
      const y = yOf(p), x2 = BOX.right - { el: 4, lfc: 48, lcl: 92 }[kind];
      lines.push({ kind, number: n, value: p, pts: marker(svg, kind.toUpperCase() + n, y, x2) });
    }

    levels.forEach((l, i) => {
      barb(svg, BARB_X, yOf(l.p), l.wdir, l.wspd);
      for (const key of ['td', 't']) {
        el('circle', { cx: xOf(l[key], l.p), cy: yOf(l.p), r: 4.5, class: 'dot ' + (key === 't' ? 'temp' : 'dew'), 'data-i': i, 'data-key': key }, svg);
      }
    });
    table();
    readout();
  }

  // Escape closes the tooltip.
  window.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });

  // Rows run from 100 mb down to 1000 mb, in the same order as the chart.
  // The inputs are built once and then updated, so the one being typed in keeps keyboard focus.
  function table() {
    const body = document.querySelector('#datatable tbody');
    if (!body.children.length) {
      // inputmode="text": some phone number pads have no minus sign.
      const input = (l, i, key, name) =>
        `<td><input type="number" inputmode="text" step="0.5" min="${TLOW}" max="${THIGH}" data-i="${i}" data-key="${key}" aria-label="${name} at ${l.p} mb, °C"></td>`;
      body.innerHTML = levels.map((l, i) =>
        `<tr data-i="${i}"><th scope="row">${l.p}</th>${input(l, i, 't', 'Temperature')}${input(l, i, 'td', 'Dewpoint')}</tr>`).reverse().join('');
    }
    for (const box of body.querySelectorAll('input')) box.value = f1(levels[box.dataset.i][box.dataset.key]);
    markLevel(marked);
  }

  // Marks one level in both the table and the chart. null clears it.
  function markLevel(i) {
    marked = i;
    document.querySelectorAll('#datatable tbody tr').forEach(row => row.classList.toggle('marked', Number(row.dataset.i) === i));
    svg.querySelectorAll('circle.dot').forEach(dot => dot.classList.toggle('marked', Number(dot.dataset.i) === i));
  }
  // The data level within a few pixels of the pointer's height, if the pointer is over the plot.
  function levelAt(x, y) {
    if (x < BOX.left - 6 || x > BARB_X + 28) return null;
    const i = levels.findIndex(l => Math.abs(yOf(l.p) - y) <= 7);
    return i < 0 ? null : i;
  }
  const tableBody = document.querySelector('#datatable tbody');
  tableBody.addEventListener('pointerover', e => {
    const row = e.target.closest('tr');
    if (row) markLevel(Number(row.dataset.i));
  });
  tableBody.addEventListener('pointerleave', () => markLevel(null));
  tableBody.addEventListener('focusin', e => markLevel(Number(e.target.dataset.i)));
  tableBody.addEventListener('change', e => {
    const { i, key } = e.target.dataset;
    const value = e.target.valueAsNumber;
    // An empty or unreadable entry puts the old value back.
    if (Number.isFinite(value)) setValue(Number(i), key, Math.round(value * 10) / 10);
    else table();
  });

  // The parcel results, as two small tables: total energy, then the levels. CAPE and CIN are each
  // one total, however many layers they come from.
  function readout() {
    const meters = p => Math.round(Thermo.interp(levels, 'z', p) / 10) * 10;
    levels.forEach((l, i) => { l.z = hgt[i]; });
    // A level's pressure and height cells, or one cell of words when there is no such level.
    const place = (p, missing = 'none') => (p && p >= PTOP
      ? `<td>${Math.round(p)}</td><td>${meters(p).toLocaleString()}</td>`
      : `<td colspan="2">${missing}</td>`);
    const row = (name, cells) => `<tr><th scope="row">${name}</th>${cells}</tr>`;
    const table = (caption, head, rows) => `<table><caption class="sr-only">${caption}</caption>` +
      `<thead><tr>${head.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
    const whole = v => Math.round(v).toLocaleString();
    // One LFC for each warmer layer, numbered from the ground up when there are several.
    const lfcs = (par.layers.length ? par.layers : [{ lfc: null }])
      .map((layer, i) => row(par.layers.length > 1 ? `LFC ${i + 1}` : 'LFC', place(layer.lfc)));
    $('readout').innerHTML =
      table('Total CAPE and CIN', ['Energy', 'Total (J/kg)'], [
        row('CAPE', `<td>${whole(par.cape)}</td>`),
        row('CIN', `<td>${par.cin === null ? 'none (no LFC)' : whole(par.cin)}</td>`),
      ]) +
      table('Parcel levels', ['Level', 'Pressure (mb)', 'Height (m)'], [
        row('LCL', place(par.lcl.p)),
        ...lfcs,
        row('EL', place(par.el, par.lfc && !par.el ? 'above 100 mb' : 'none')),
      ]);
    $('nolfc').hidden = Boolean(par.lfc);
  }

  function segDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const u = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - a[0] - u * dx, py - a[1] - u * dy);
  }

  // Lower rank wins when several lines are within reach.
  const RANK = { lcl: 0, lfc: 0, el: 0, temp: 1, dew: 1, parcel: 2, tvair: 2.5, tvparcel: 2.5 };
  function nearest(x, y) {
    let best = null, bestScore = Infinity;
    for (const line of lines) {
      let d = Infinity;
      for (let i = 0; i < line.pts.length - 1; i++) d = Math.min(d, segDist(x, y, line.pts[i], line.pts[i + 1]));
      if (d > 6) continue;
      const score = (line.kind in RANK ? RANK[line.kind] : 3) * 100 + d;
      if (score < bestScore) { best = line; bestScore = score; }
    }
    return best;
  }

  function heightText(p) {
    const z = Thermo.interp(levels, 'z', p);
    return z === null ? '' : `, about ${(Math.round(z / 10) * 10).toLocaleString()} m above the surface`;
  }

  // Returns {kind, value} describing whatever is under the pointer, or null.
  function describe(x, y) {
    if (Math.abs(x - BARB_X) < 28) {
      const l = levels.reduce((a, b) => Math.abs(yOf(b.p) - y) < Math.abs(yOf(a.p) - y) ? b : a);
      if (Math.abs(yOf(l.p) - y) > 16) return null;
      return { kind: 'wind', value: `${l.wspd} kt from ${l.wdir}° at ${l.p} mb` };
    }
    if (x < BOX.left || x > BOX.right || y < BOX.top || y > BOX.bottom) return null;
    const p = pOf(y);
    const line = nearest(x, y);
    // Inside the shading, CAPE / CIN wins over background lines. Profiles and markers still win over it.
    if (!line || !(line.kind in RANK)) {
      const energy = full ? describeEnergy(x, p) : null;
      if (energy) {
        if (line) {
          const bg = describeLine(line, x, p);
          energy.also = `Also here: ${GUIDE[bg.kind][0]}, ${bg.value}`;
        }
        return energy;
      }
    }
    return line ? describeLine(line, x, p) : null;
  }

  // CAPE or CIN, if the pointer is inside one of the shaded areas.
  function describeEnergy(x, p) {
    if (!par.lfc || (par.el && p < par.el)) return null;
    const air = Thermo.interp(par.path, 'cmp', p), env = Thermo.interp(par.path, 'envCmp', p);
    if (air === null) return null;
    const t = tOf(x, p);
    if (t < Math.min(air, env) || t > Math.max(air, env)) return null;
    const kind = air > env ? 'cape' : 'cin', sign = air > env ? 1 : -1;
    const value = [
      `Total ${kind.toUpperCase()}: ${joules(kind === 'cape' ? par.cape : par.cin)}`,
      `At ${Math.round(p)} mb${heightText(p)}, the parcel's virtual temperature is ${f1(Math.abs(air - env))} °C ${sign > 0 ? 'warmer' : 'colder'} than the air's`,
    ].join('<br>');
    return { kind, value };
  }

  function describeLine(line, x, p) {
    const at = `at ${Math.round(p)} mb${heightText(p)}`;
    const k = line.kind;
    let value;
    if (k === 'temp' || k === 'dew') {
      const v = Thermo.interp(levels, k === 'temp' ? 't' : 'td', p);
      if (v === null) return null;
      value = `${f1(v)} °C ${at}`;
    } else if (k === 'parcel') {
      const v = Thermo.interp(par.path, 't', p);
      if (v === null) return null;
      value = `${f1(v)} °C ${at}`;
    } else if (k === 'tvair' || k === 'tvparcel') {
      const v = Thermo.interp(par.path, k === 'tvair' ? 'envCmp' : 'cmp', p);
      if (v === null) return null;
      value = `${f1(v)} °C ${at}`;
    } else if (k === 'isobar') value = `${line.value} mb${heightText(line.value)}`;
    else if (k === 'isotherm') value = `${line.value} °C`;
    else if (k === 'dry') value = `θ = ${line.value} K. ${f1(Thermo.dryTemp(line.value, p))} °C ${at}`;
    else if (k === 'moist') value = `${line.value} °C at 1000 mb. ${f1(tOf(x, p))} °C ${at}`;
    else if (k === 'mix') value = `${line.value} g/kg`;
    else value = `${Math.round(line.value)} mb${heightText(line.value)}`;
    return { kind: k, value, line };
  }

  const toSvg = e => {
    const p = toChart(svg, e);
    return [p.x, p.y];
  };

  function hideTip() {
    tip.hidden = true;
    const old = svg.querySelector('.highlight');
    if (old) old.remove();
  }

  function hover(e) {
    hideTip();
    const [x, y] = toSvg(e);
    markLevel(levelAt(x, y));
    const hit = describe(x, y);
    if (!hit) return;
    if (hit.line) el('path', { d: pathD(hit.line.pts), class: 'highlight ' + hit.line.kind, 'clip-path': 'url(#clip)' }, svg);
    const [name, about] = GUIDE[hit.kind];
    const n = hit.line?.number;
    const title = n ? name.replace(hit.kind.toUpperCase(), hit.kind.toUpperCase() + n) : name;
    tip.innerHTML = `<strong>${title}</strong><span class="value">${hit.value}</span><span>${about}</span>${hit.also ? `<span class="also">${hit.also}</span>` : ''}`;
    tip.hidden = false;
    const box = tip.getBoundingClientRect();
    const left = e.clientX + 16 + box.width > window.innerWidth ? e.clientX - box.width - 16 : e.clientX + 16;
    const top = e.clientY + 16 + box.height > window.innerHeight ? e.clientY - box.height - 16 : e.clientY + 16;
    tip.style.left = Math.max(4, left) + 'px';
    tip.style.top = Math.max(4, top) + 'px';
  }

  // Dewpoint can never exceed temperature. td0 keeps the uncapped value.
  const capDew = l => { l.td = Math.min(l.td0, l.t); };

  // Changes one temperature ('t') or dewpoint ('td'), by dragging a dot or typing in the table.
  function setValue(i, key, value) {
    const l = levels[i];
    const v = Math.max(TLOW, Math.min(THIGH, value));
    // Cooling the temperature only caps the dewpoint, so it comes back when the temperature rises again.
    if (key === 't') {
      l.t = v;
      l.t0 = v - shift;
      capDew(l);
    } else {
      l.td = l.td0 = Math.min(v, l.t);
    }
    marked = i;
    draw();
    const name = GUIDE[key === 't' ? 'temp' : 'dew'][0];
    const capped = key === 'td' && v > l.t ? ' (dewpoint cannot be higher than temperature)' : '';
    $('status').textContent = `${name} at ${l.p} mb: ${f1(l[key])} °C${capped}`;
  }

  function drag(e) {
    const [x] = toSvg(e);
    setValue(dragging.i, dragging.key, Math.round(tOf(x, levels[dragging.i].p) * 2) / 2);
  }

  svg.addEventListener('pointerdown', e => {
    const key = e.target.getAttribute('data-key');
    if (!key) { hover(e); return; }
    dragging = { key, i: Number(e.target.getAttribute('data-i')) };
    svg.setPointerCapture(e.pointerId);
    hideTip();
    e.preventDefault();
  });
  svg.addEventListener('pointermove', e => (dragging ? drag(e) : hover(e)));
  const stop = () => { dragging = null; };
  svg.addEventListener('pointerup', stop);
  svg.addEventListener('pointercancel', stop);
  svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hideTip(); markLevel(null); } });

  const showShift = () => { $('shiftValue').textContent = `${shift > 0 ? '+' : ''}${f1(shift)} °C`; };
  $('shift').addEventListener('input', e => {
    shift = Number(e.target.value);
    for (const l of levels) {
      l.t = l.t0 + shift;
      capDew(l);
    }
    showShift();
    hideTip();
    $('status').textContent = '';
    draw();
  });

  // The first sentence describes the air. The rest uses ideas that only the full chart shows.
  function showAbout() {
    const about = SOUNDINGS[current].about;
    const end = about.indexOf('. ');
    $('about').textContent = full || end < 0 ? about : about.slice(0, end + 1);
  }

  function load(i) {
    current = i;
    // t0 and td0 hold the values before any whole-profile shift, so the slider can be undone.
    levels = SOUNDINGS[i].levels.map(l => ({ ...l, t0: l.t, td0: l.td }));
    shift = 0;
    $('shift').value = 0;
    showShift();
    showAbout();
    $('status').textContent = '';
    hideTip();
    draw();
  }
  SOUNDINGS.forEach((s, i) => $('sounding').add(new Option(s.name, i)));
  $('sounding').addEventListener('change', e => load(Number(e.target.value)));
  $('reset').addEventListener('click', () => load(current));
  // The guide lists only what the current view shows. Lessons belong to the Full chart.
  function showGuide() {
    SkewGuide.render($('guide'), GUIDE, inView, full);
    $('guidenote').hidden = $('guidesource').hidden = !full;
  }
  function setView(wantFull) {
    full = wantFull;
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.view === 'full') === full)));
    $('basickey').hidden = full;
    $('parcelpanel').hidden = !full;
    showGuide();
    showAbout();
    hideTip();
    draw();
  }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view === 'full')));
  load(0);
  showGuide();
})();
