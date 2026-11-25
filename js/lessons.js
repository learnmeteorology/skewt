// The interactive lessons: what each step says, what its chart shows, what moves and what the
// learner is asked. No page code here, so test.js can check every answer. Charts and answers come
// from the same calculations as the rest of the site. Page numbers are from Wallace and Hobbs (2006).
(function (root) {
  'use strict';

  function build(T, SOUNDINGS, Calc) {
    const K = 273.15;
    const [storm, humid, winter] = SOUNDINGS;
    const one = v => v.toFixed(1), whole = v => Math.round(v), round1 = v => Math.round(v * 10) / 10;
    const mb = p => `${whole(p)} mb`, deg = t => `${one(t)} °C`;
    const at = (s, p) => s.levels.find(l => l.p === p);
    const env = (s, p) => T.interp(s.levels, 't', p);

    // ---- Lines, each a list of [temperature, pressure] points ----
    const pressures = (from, to, n = 50) => Array.from({ length: n + 1 }, (_, i) => from * Math.pow(to / from, i / n));
    const dryPts = (theta, from, to) => pressures(from, to).map(p => [T.dryTemp(theta, p), p]);
    const mixPts = (w, from, to) => pressures(from, to).map(p => [T.dewFromMixingRatio(w, p), p]);
    // A moist adiabat through (t0, p0), from the pressure `from` to the pressure `to`.
    const moistPts = (t0, p0, from, to) => {
      let t = T.moistTemp(t0, p0, from), p = from;
      return pressures(from, to).map(q => {
        t = T.moistTemp(t, p, q);
        p = q;
        return [t, q];
      });
    };
    const isobarPts = p => Array.from({ length: 121 }, (_, i) => [-80 + i, p]);
    const isothermPts = t => pressures(1050, 100).map(p => [t, p]);
    const lineClass = kind => `bg ${kind} param-line`;
    const guide = (kind, pts, label) => ({ cls: lineClass(kind), pts, label });
    const candidate = (kind, pts, more) => ({ cls: lineClass(kind), pts, ...more });
    // Temperature (or dewpoint) along a list of [t, p] points, at any pressure it covers.
    const along = pts => {
      const levels = pts.map(([t, p]) => ({ t, p })).sort((a, b) => b.p - a.p);
      const high = levels[levels.length - 1].p, low = levels[0].p;
      return p => T.interp(levels, 't', Math.max(high, Math.min(low, p)));
    };

    // The environmental temperature and dewpoint of a sounding, named at chosen pressures.
    const profile = (s, key, label) => ({ cls: `profile ${key === 't' ? 'temp' : 'dew'}`, pts: s.levels.map(l => [l[key], l.p]), label });
    const both = (s, envAt, dewAt) => [
      profile(s, 't', envAt && { p: envAt, words: 'environment', anchor: 'start', dx: 12 }),
      profile(s, 'td', dewAt && { p: dewAt, words: 'dewpoint', anchor: 'end', dx: -12 }),
    ];
    const parcelProfile = (path, label) => ({ cls: 'profile parcel', pts: path.map(q => [q.t, q.p]), label });
    // Names for lines where the parcel is to the right (warm side) or left of the environment.
    const onRight = (p, words) => ({ p, words, anchor: 'start', dx: 10 });
    const onLeft = (p, words) => ({ p, words, anchor: 'end', dx: -10 });
    const warmParcel = (s, path, p) => [parcelProfile(path, onRight(p, 'parcel')), profile(s, 't', onLeft(p, 'environment')), profile(s, 'td')];
    const coldParcel = (s, path, p) => [parcelProfile(path, onLeft(p, 'parcel')), profile(s, 't', onRight(p, 'environment')), profile(s, 'td')];
    // On a tall chart, "environment" goes above the EL, where the parcel is clear of it.
    const topName = s => ({ at: [env(s, 127), 127], words: 'environment', dx: 12, dy: 5, anchor: 'start' });
    const groundDots = s => [{ at: [s.levels[0].t, s.levels[0].p] }, { at: [s.levels[0].td, s.levels[0].p] }];

    // ---- Moving pieces ----
    const track = (kind, fn, from, to, more) => ({ cls: lineClass(kind), at: fn, from, to, route: true, dot: kind === 'mix' ? 'vapor' : 'parcel', ...more });
    const trace = (kind, fn, from, to, read, seconds = 4) => ({ from, to, seconds, tracks: [track(kind, fn, from, to)], read });

    // A surface parcel of one sounding: the pieces most lifting lessons need.
    function surface(s, end) {
      const g = s.levels[0], theta = T.theta(g.t, g.p), w = T.mixingRatio(g.td, g.p), lcl = T.lcl(g.t, g.td, g.p);
      const dryAt = p => T.dryTemp(theta, p), mixAt = p => T.dewFromMixingRatio(w, p);
      const moist = moistPts(lcl.t, lcl.p, lcl.p, end), moistAt = along(moist);
      const unsaturated = p => `${mb(p)}: parcel temperature ${deg(dryAt(p))}, parcel dewpoint ${deg(mixAt(p))}. Gap ${deg(dryAt(p) - mixAt(p))}: not saturated yet.`;
      const saturated = `${mb(lcl.p)}: the gap has closed. The parcel is saturated. This is the LCL.`;
      const meet = {
        from: g.p, to: lcl.p, seconds: 5, answerAt: lcl.p, tracks: [track('dry', dryAt, g.p, lcl.p), track('mix', mixAt, g.p, lcl.p)],
        read: p => (p > lcl.p + 0.05 ? unsaturated(p) : saturated),
      };
      const lift = {
        from: g.p, to: end, seconds: 7, answerAt: lcl.p,
        tracks: [track('dry', dryAt, g.p, lcl.p), track('mix', mixAt, g.p, lcl.p, { route: false }), track('moist', moistAt, lcl.p, end)],
        read: p => {
          if (p > lcl.p + 0.5) return unsaturated(p);
          if (p > lcl.p - 0.5) return saturated;
          return `${mb(p)}: parcel temperature ${deg(moistAt(p))}. Saturated, following the moist adiabat.`;
        },
      };
      return { g, theta, w, lcl, dryAt, mixAt, moist, moistAt, meet, lift, lclMark: { at: [lcl.t, lcl.p], words: `LCL ≈ ${mb(lcl.p)}`, dx: 16, dy: -8 } };
    }

    // ---- Tasks ----
    const pick = (id, lines, right, done) => ({ id, type: 'pick', lines, right, done });
    const choice = (id, right, others, done) => {
      const why = Object.fromEntries(others);
      return { id, type: 'choice', right, choices: [right, ...Object.keys(why)].sort(), why, done };
    };
    const number = (id, label, value, margin, unit, done, hint) => ({ id, type: 'number', label, value: round1(value), margin, unit, done, hint });
    const point = (id, goal, done, more) => ({ id, type: 'point', goal, done, ...more });

    const read = (title, words, chart, more) => ({ stage: 'Learn', title, words, chart, ...more });
    const watch = (title, words, chart, scene, more) => ({ stage: 'Watch', title, words, chart, scene, ...more });
    const turn = (title, words, chart, task, more) => ({ stage: 'Your turn', title, words, chart, task, ...more });

    // ---- Chart views ----
    const view = (top, bottom, fit, more) => ({ top, bottom, fit, ...more });
    const WIDE = view(400, 1050, [[-22, 1000], [33, 1000], [-30, 500]], { height: 500, label: 'Skew-T' });
    const LOW = (more) => view(600, 1030, [[-8, 700], [31, 1000], [8, 1000]], more);

    const BOOK = 'Wallace, J. M., and P. V. Hobbs, 2006: Atmospheric Science: An Introductory Survey. 2nd ed. International Geophysics Series, Vol. 92, Academic Press (Elsevier). ISBN 978-0-12-732951-2.';
    // pages: "p. 83", or pages followed by ", with ..." naming a web page the lesson also uses.
    const cite = pages => {
      const [book, web] = pages.replace(/,$/, '').split(', with ');
      return `Source: ${book} of ${BOOK}${web ? ` Also ${web}.` : ''} The soundings are made up for teaching. Your progress is saved only in this browser.`;
    };

    const KELVIN = { latex: String.raw`T_{\mathrm{K}} = T_{^\circ\mathrm{C}} + 273.15`, plain: 'K = °C + 273.15' };

    // =========================================================== Intro
    const chartLesson = () => {
      const base = { ...WIDE };
      return {
        id: 'chart', level: 'Intro', title: 'Reading the chart', summary: 'Pressure lines and slanted temperature lines.',
        source: cite('p. 67 (pressure falls with height) and p. 78, equation (3.56), with the National Weather Service training page on Skew-T parameters for freezing levels (linked from About this site),'),
        learned: ['Flat lines are pressure, every 50 mb. Pressure falls as you go up.', 'Temperature lines slant up to the right.', 'A point on the chart has a pressure and a temperature.'],
        steps: [
          read('Pressure goes up the side', ['The flat lines are lines of equal pressure, drawn every 50 mb. 1000 mb is near the bottom.', 'Pressure falls as you go up, so a smaller number means higher in the atmosphere.'], base),
          turn('Find 700 mb', ['Which lettered pressure line is 700 mb? Click it or choose its letter.'], base,
            pick('p700', {
              A: candidate('isobar', isobarPts(850), { at: [10, 850], why: 'That line is 850 mb, which is lower on the chart than 700 mb.', describe: 'the lowest of the three' }),
              B: candidate('isobar', isobarPts(500), { at: [-8, 500], why: 'That line is 500 mb, which is higher on the chart than 700 mb.', describe: 'the highest of the three' }),
              C: candidate('isobar', isobarPts(700), { at: [3, 700], describe: 'the middle one' }),
            }, 'C', 'This is the 700 mb line. The numbers down the left side name the pressure lines.')),
          read('Temperature lines slant', ['The lines that slant up to the right are lines of equal temperature, in °C.', 'To name one, follow it down to the numbers along the bottom.'], base),
          turn('Find the 0 °C line', ['Which lettered line is the 0 °C temperature line?'], base,
            pick('t0', {
              A: candidate('isotherm', isothermPts(-20), { at: [-20, 780], why: 'Follow it down: it comes from a temperature colder than 0 °C.', describe: 'the left one' }),
              B: candidate('isotherm', isothermPts(0), { at: [0, 780], describe: 'the middle one' }),
              C: candidate('isotherm', isothermPts(20), { at: [20, 780], why: 'Follow it down: it comes from a temperature warmer than 0 °C.', describe: 'the right one' }),
            }, 'B', 'The 0 °C line is useful on its own: where the environmental temperature crosses it is a freezing level.')),
          turn('Put the two together', ['Click the point where the temperature is 10 °C at 700 mb.'], base,
            point('spot', [10, 700], 'You found the 700 mb line and followed the 10 °C line up to it.', { hint: 'Find the 700 mb line, then the slanted 10 °C line.', tLimit: 2.5, pLimit: 25, mark: '10 °C, 700 mb', markAt: { dx: -14, anchor: 'end' } })),
          turn('Read a point', ['A dot is marked on the chart. What is its temperature? Follow the slanted lines, not straight down.'],
            { ...base, dots: [{ at: [-10, 500] }] },
            number('readt', 'Temperature of the dot (°C)', -10, 2, '°C', 'The dot sits on the slanted -10 °C line. Reading straight down would give the wrong number.', 'Follow the slanted line through the dot.')),
          turn('Why do they slant?', ['Choose the best answer.'], base,
            choice('skew', 'It keeps cold air high up on the chart and makes soundings easier to compare', [
              ['It shows which way the wind blows', 'Wind is shown by the barbs, not by the temperature lines.'],
              ['Temperature always rises as you go up', 'Air usually gets colder with height. The slant is a choice about how the chart is drawn.'],
            ], 'That slant is the "skew" in Skew-T.')),
        ],
      };
    };

    const linesLesson = () => {
      const base = view(500, 1050, [[-14, 700], [32, 1000], [0, 1000]], { height: 480, label: 'Skew-T' });
      const dryAt = p => T.dryTemp(300, p), moist = moistPts(20, 1000, 1000, 500), moistAt = along(moist);
      const w10 = p => T.dewFromMixingRatio(0.010, p);
      return {
        id: 'lines', level: 'Intro', title: 'The background lines', summary: 'Dry adiabats, moist adiabats and mixing ratio lines.',
        source: cite('pp. 77–78, 82 and 84–85'),
        learned: ['Dry adiabats show how unsaturated air cools as it rises.', 'Moist adiabats show how saturated air cools: more slowly.', 'Mixing ratio lines show how much water vapor saturated air holds.'],
        steps: [
          watch('Dry adiabats', ['These show how unsaturated air cools as it rises without trading heat with its surroundings: about 10 °C per kilometer.', 'Watch a parcel of unsaturated air follow one.'], base,
            trace('dry', dryAt, 1000, 500, p => `Along this dry adiabat: ${deg(dryAt(p))} at ${mb(p)}.`)),
          turn('Pick a dry adiabat', ['Which lettered line is a dry adiabat?'], base,
            pick('dry', {
              A: candidate('moist', moistPts(16, 1000, 1000, 550), { why: 'That is a moist adiabat: a line of long dashes and dots.', describe: 'long dashes and dots' }),
              B: candidate('dry', dryPts(300, 1000, 550), { describe: 'a solid line rising toward the upper left' }),
              C: candidate('mix', mixPts(0.007, 1000, 550), { why: 'That is a mixing ratio line: dotted and steep.', describe: 'a steep dotted line' }),
            }, 'B', 'Dry adiabats are the solid lines rising toward the upper left.')),
          watch('Moist adiabats', ['These show how saturated air cools as it keeps rising. Condensing water releases heat, so it cools more slowly than dry air, especially low down where the air is warm.'], base,
            trace('moist', moistAt, 1000, 500, p => `Along this moist adiabat: ${deg(moistAt(p))} at ${mb(p)}.`)),
          turn('Pick a moist adiabat', ['Which lettered line is a moist adiabat?'], base,
            pick('moist', {
              A: candidate('moist', moistPts(12, 1000, 1000, 550), { describe: 'long dashes and dots' }),
              B: candidate('mix', mixPts(0.016, 1000, 550), { why: 'That is a mixing ratio line: dotted and steep.', describe: 'a steep dotted line' }),
              C: candidate('dry', dryPts(310, 1000, 550), { why: 'That is a dry adiabat: solid, rising toward the upper left.', describe: 'a solid line rising toward the upper left' }),
            }, 'A', 'Moist adiabats are the lines of long dashes and dots.')),
          watch('Mixing ratio lines', ['Each marks one saturation mixing ratio: the grams of water vapor in each kilogram of dry air when the air is saturated.'], base,
            trace('mix', w10, 1000, 500, p => `The 10 g/kg line is at ${deg(w10(p))} at ${mb(p)}.`)),
          turn('Pick a mixing ratio line', ['Which lettered line is a mixing ratio line?'], base,
            pick('mix', {
              A: candidate('dry', dryPts(290, 1000, 550), { why: 'That is a dry adiabat: solid, rising toward the upper left.', describe: 'a solid line rising toward the upper left' }),
              B: candidate('moist', moistPts(24, 1000, 1000, 550), { why: 'That is a moist adiabat: long dashes and dots.', describe: 'long dashes and dots' }),
              C: candidate('mix', mixPts(0.004, 1000, 550), { describe: 'a steep dotted line' }),
            }, 'C', 'Mixing ratio lines are the steep dotted lines.')),
          turn('Compare the cooling', ['A parcel rises the same distance through warm air low down. Along which line does it cool less?'], base,
            choice('slower', 'The moist adiabat', [
              ['The dry adiabat', 'Dry air cools faster. In saturated air, condensing water releases heat.'],
              ['They cool by the same amount', 'They differ: condensing water releases heat in saturated air.'],
            ], 'Condensing water releases heat, which slows the cooling.')),
        ],
        recapScene: trace('moist', moistAt, 1000, 500, p => `Along this moist adiabat: ${deg(moistAt(p))} at ${mb(p)}.`),
      };
    };

    const temperatureLesson = () => {
      const base = view(450, 1030, [[-32, 500], [31, 1000], [-8, 700], [8, 850]], { height: 480, label: 'Skew-T' });
      const wanted = [['t', 850], ['td', 850], ['t', 500], ['td', 500]];
      const name = key => (key === 't' ? 'environmental temperature' : 'dewpoint');
      const placed = n => wanted.slice(0, n).map(([key, p]) => ({ at: [at(storm, p)[key], p], cls: key === 't' ? 'temp' : 'dew' }));
      const plots = wanted.map(([key, p], i) => {
        const value = at(storm, p)[key];
        return turn(`Plot the ${name(key)} at ${p} mb`, [`At ${p} mb, the sounding reports this ${name(key)}: ${value} °C. Click where it belongs.`],
          { ...base, points: placed(i) },
          point(`plot-${key}-${p}`, [value, p], `The ${name(key)} at ${p} mb is ${value} °C.`, { hint: `Find the ${p} mb line, then follow the slanted ${value} °C line to it.`, tLimit: 2, pLimit: 20 }),
          { after: { chart: { points: placed(i + 1) } } });
      });
      const full = { ...base, lines: both(storm, 620, 960), label: 'Skew-T with the spring storm sounding' };
      return {
        id: 'temperature', level: 'Intro', title: 'Temperature and dewpoint', summary: 'Plot a sounding and find humid and dry air.',
        source: cite('pp. 82–83 (dewpoint and moisture), with the NOAA JetStream page on radiosondes (linked from About this site),'),
        learned: ['A radiosonde measures temperature and humidity as it rises.', 'Environmental temperature and dewpoint are plotted at each pressure.', 'A small gap between them means humid air.'],
        steps: [
          read('Where the data come from', ['Radiosondes, small instrument packages carried up by weather balloons, send their readings to the ground by radio.', 'We plot two of them against pressure. The environmental temperature is the temperature of the surrounding air. The dewpoint is how cold that air would have to be, at the same pressure, to become saturated.'], base),
          ...plots,
          read('Join the points', ['With every reading plotted and joined, you get two lines. The dewpoint is never higher than the environmental temperature.', 'Where they are close together the air is humid. Where they are far apart it is dry.'], full),
          turn('Where is it most humid?', ['At which of these levels is the air closest to saturation? Compare the two lines.'], full,
            choice('humid', '950 mb', [['850 mb', 'At 850 mb the gap is about 11 °C. Look for a smaller one.'], ['500 mb', 'At 500 mb the gap is about 15 °C. Look for a smaller one.']], 'At 950 mb the temperature and dewpoint are only 4 °C apart.')),
          turn('Measure the gap', ['The gap is called the dewpoint depression. At 700 mb, what is the environmental temperature minus the dewpoint?'], full,
            number('gap', 'Gap at 700 mb (°C)', at(storm, 700).t - at(storm, 700).td, 2, '°C', `At 700 mb the temperature is ${at(storm, 700).t} °C and the dewpoint is ${at(storm, 700).td} °C.`, 'Read both lines at 700 mb, then subtract.')),
        ],
        recapChart: full,
      };
    };

    const windLesson = () => {
      const base = view(250, 1090, [[-45, 300], [52, 1000], [-10, 700]], { height: 520, lines: both(storm, 560, 960), barbs: storm.levels.filter(l => [1000, 850, 700, 500, 300].includes(l.p)), label: 'Skew-T with wind barbs' });
      const speed = p => Math.round(at(storm, p).wspd / 5) * 5;
      return {
        id: 'wind', level: 'Intro', title: 'Reading the wind', summary: 'Wind barbs: speed and direction.',
        source: 'Sources: for wind barbs, NOAA JetStream’s page on constant pressure charts and the National Weather Service Honolulu page on wind barbs (both linked from About this site; they call the flag a pennant). For how wind shear affects storms, p. 347 of ' + BOOK + ' The soundings are made up for teaching. Your progress is saved only in this browser.',
        learned: ['The long staff points to where the wind comes from.', 'Add the marks: half barb 5, full barb 10, flag 50 knots.', 'How wind changes with height is called wind shear.'],
        steps: [
          read('Barbs beside the chart', ['Each wind barb stands for the wind at its pressure level. The long staff points to where the wind comes from.', 'A half barb is 5 knots, a full barb is 10 knots and a flag is 50 knots. Add them up. Speeds are rounded to the nearest 5 knots.'], base),
          turn('How fast at 850 mb?', ['Here is the 850 mb barb, drawn larger. How fast is the wind?'], base,
            number('speed850', 'Wind speed (knots)', speed(850), 0, 'knots', `Three full barbs and one half barb make ${speed(850)} knots.`, 'Count the full barbs, then the half barb.'), { barb: [at(storm, 850).wdir, speed(850)] }),
          turn('How fast at 500 mb?', ['Here is the 500 mb barb. How fast is the wind?'], base,
            number('speed500', 'Wind speed (knots)', speed(500), 0, 'knots', `A flag and a full barb make ${speed(500)} knots.`, 'A filled triangle is a flag, worth 50.'), { barb: [at(storm, 500).wdir, speed(500)] }),
          turn('Which direction?', ['This barb’s staff points toward the bottom of the page. North is up. Where is the wind coming from?'], base,
            choice('south', 'From the south', [['From the north', 'The staff points to where the wind comes from, which here is down the page.'], ['From the east', 'East is to the right. This staff points down.'], ['From the west', 'West is to the left. This staff points down.']], 'The staff points south, so the wind comes from the south.'), { barb: [180, 20] }),
          turn('Another direction', ['And this one? North is up.'], base,
            choice('west', 'From the west', [['From the east', 'The staff points to where the wind comes from. Here it points left.'], ['From the north', 'North is up. This staff points left.'], ['From the south', 'South is down. This staff points left.']], 'The staff points west, so the wind comes from the west.'), { barb: [270, 35] }),
          turn('Change with height', ['Look at the barbs from the ground up to 300 mb. The chart shows them at 1000, 850, 700, 500 and 300 mb. What happens to the wind?'], base,
            choice('shear', 'It gets faster, and it turns from south-southeast toward west-southwest', [
              ['It gets slower, and it keeps the same direction', 'Count the marks: there are more of them higher up, and the staffs turn.'],
              ['It stays the same at every level', 'The barbs change in both speed and direction.'],
            ], 'This change with height is wind shear. It affects how storms are organized.')),
        ],
      };
    };

    const moistureLesson = () => {
      const v = Calc.values(T, storm), a = v.a;
      const base = view(700, 1030, [[a.td - 6, 850], [a.t + 5, 850], [29, 1000]], { lines: both(storm, 880, 960), dots: [{ at: [a.td, 850] }, { at: [a.t, 850] }], label: 'Skew-T near 850 mb' });
      const wAt = p => T.dewFromMixingRatio(v.w, p), wsAt = p => T.dewFromMixingRatio(v.ws, p);
      const cold = view(750, 1030, [[-9, 1000], [3, 850], [-8, 780]], { lines: [{ cls: 'profile temp', pts: winter.levels.map(l => [l.t, l.p]), label: { p: 790, words: 'environment', anchor: 'end', dx: -10 } }], label: 'Skew-T of the stable winter morning' });
      const zeroLine = { cls: 'param-zero', pts: [[0, 1030], [0, 750]], label: { p: 960, words: '0 °C', anchor: 'start', dx: 12 } };
      const cross = Calc.freezingLevels(T, winter.levels);
      return {
        id: 'moisture', level: 'Intro', title: 'Moisture and layers', summary: 'Mixing ratio, relative humidity, freezing levels and inversions.',
        source: cite('pp. 80, 82 (equation (3.64)) and 90, with the National Weather Service training page on Skew-T parameters for freezing levels (linked from About this site),'),
        learned: ['The mixing ratio line through the dewpoint gives the vapor the air has (w).', 'The line through the temperature gives what saturated air would hold (ws).', 'Relative humidity compares the two.', 'The environmental temperature can cross 0 °C more than once, and rises with height in an inversion.'],
        steps: [
          watch('How much vapor is there?', [`At 850 mb in the spring storm sounding, the temperature is ${a.t} °C and the dewpoint is ${a.td} °C.`, 'Watch the mixing ratio line through the dewpoint. It tells how much water vapor the air actually has: the mixing ratio, w.'], base,
            trace('mix', wAt, 850, 750, () => `The line through the dewpoint is about ${one(v.w * 1000)} g/kg.`, 3)),
          turn('Estimate w', ['The line through the dewpoint falls between the printed 7 and 10 g/kg lines. What is the mixing ratio?'],
            { ...base, lines: [guide('mix', mixPts(0.007, 1000, 700), { p: 745, words: '7 g/kg', anchor: 'end', dx: -4 }), guide('mix', mixPts(0.010, 1000, 700), { p: 745, words: '10 g/kg', anchor: 'start', dx: 4 }), guide('mix', mixPts(v.w, 850, 750)), ...base.lines] },
            number('w', 'Mixing ratio w (g/kg)', v.w * 1000, 1, 'g/kg', `w is about ${one(v.w * 1000)} g/kg.`, 'It is between 7 and 10, closer to 7.')),
          turn('Which line gives ws?', ['The saturation mixing ratio, ws, is what the air would hold if saturated. Which line should you follow to find it?'], base,
            pick('wsline', {
              A: candidate('mix', mixPts(v.w, 1000, 750), { why: 'That line goes through the dewpoint. It gives w, the vapor the air has.', describe: 'through the dewpoint' }),
              B: candidate('mix', mixPts(v.ws, 1000, 750), { describe: 'through the temperature' }),
            }, 'B', `The line through the temperature is about ${one(v.ws * 1000)} g/kg.`)),
          turn('Relative humidity', [`Use w ≈ ${one(v.w * 1000)} and ws ≈ ${one(v.ws * 1000)} g/kg in the equation. What is the relative humidity?`],
            { ...base, lines: [guide('mix', mixPts(v.w, 1000, 750)), guide('mix', mixPts(v.ws, 1000, 750)), ...base.lines] },
            number('rh', 'Relative humidity (%)', Math.round(v.rh), 3, '%', `RH is about ${whole(v.rh)}%.`, 'Divide w by ws, then multiply by 100.'),
            { equations: [{ latex: String.raw`\mathrm{RH} = 100\,\frac{w}{w_s}`, plain: 'RH = 100 × w / ws' }] }),
          read('Freezing levels', ['A freezing level is where the environmental temperature is 0 °C. This is the stable winter morning sounding, with the slanted 0 °C line added.'], { ...cold, lines: [zeroLine, ...cold.lines] }),
          turn('Find a freezing level', ['Click the lowest place where the environmental temperature crosses 0 °C, or type its pressure.'], { ...cold, lines: [zeroLine, ...cold.lines] },
            point('freeze', [0, cross[0]], `The lowest crossing is at about ${mb(cross[0])}. This sounding crosses again at about ${mb(cross[1])}: the air between is above freezing.`,
              { pLimit: 20, tLimit: 1.5, typed: { label: 'Pressure of the lowest crossing (mb)', value: cross[0], margin: 15 }, mark: `≈ ${mb(cross[0])}`, hint: 'Look for where the two lines cross.' })),
          turn('Find the inversion', ['An inversion is a layer where the environmental temperature rises with height. Where is the inversion near the ground in this sounding?'], cold,
            choice('inversion', '1000 to 900 mb', [['900 to 800 mb', 'In that layer the temperature falls with height. Compare it with the slanted temperature lines.'], ['850 to 750 mb', 'In that layer the temperature falls with height.']], 'From 1000 to 900 mb the temperature rises from -6 to 1 °C. An inversion is very stable.')),
        ],
      };
    };

    const parcelLesson = () => {
      const A = surface(storm, 800), B = surface(humid, 800), g = B.g;
      const range = (s, more) => view(780, 1030, [[T.dryTemp(B.theta, 800) - 9, 800], [T.dewFromMixingRatio(T.mixingRatio(g.t, 1000), 800) + 1, 800], [g.t, 1000], [g.td, 1000]], { lines: both(s, 860, 950), dots: groundDots(s), label: 'Skew-T near the ground', ...more });
      const first = range(storm), yours = range(humid);
      const withLines = (c, ...lines) => ({ ...c, lines: [...lines, ...c.lines] });
      const aDry = guide('dry', dryPts(A.theta, 1000, 800)), aMix = guide('mix', mixPts(A.w, 1000, 800));
      const bDry = guide('dry', dryPts(B.theta, 1000, 800)), bMix = guide('mix', mixPts(B.w, 1000, 800));
      const dryFrom = t => dryPts(T.theta(t, g.p), g.p, 800), mixFrom = t => mixPts(T.mixingRatio(t, g.p), g.p, 800);
      const middle = (g.t + g.td) / 2;
      const bToLcl = [guide('dry', dryPts(B.theta, 1000, B.lcl.p)), guide('mix', mixPts(B.w, 1000, B.lcl.p))];
      const near = view(820, 1020, [[g.t, 1000], [g.td, 1000], [T.dryTemp(B.theta, 840), 840]], { lines: [bDry, bMix, ...both(humid, 860, 950)], dots: groundDots(humid), label: 'Skew-T zoomed near the ground' });
      return {
        id: 'parcel', level: 'Intro', title: 'Lifting a parcel and finding the LCL', summary: 'Build the parcel path from the ground.',
        source: cite('pp. 77, 83–84 and 345'),
        learned: ['Follow a dry adiabat up from the temperature at the ground.', 'Follow a mixing ratio line up from the dewpoint.', 'They cross at the LCL, where the parcel is saturated.', 'Above the LCL, the parcel follows a moist adiabat.'],
        steps: [
          read('Meet the parcel', ['A parcel is a small, imaginary portion of air that we can follow as it rises.', 'In this lesson you will lift one from the ground and find where it becomes saturated. That level is the lifting condensation level, or LCL.', `First, watch the method on the spring storm sounding. At the ground the environmental temperature is ${A.g.t} °C and the dewpoint is ${A.g.td} °C.`], first),
          watch('1. Follow a dry adiabat', [`Start at the environmental temperature at the ground, ${A.g.t} °C. Follow a dry adiabat upward. Watch the parcel climb.`, 'In this sounding, the line stays close to the environmental temperature for the first 50 mb.'], first,
            trace('dry', A.dryAt, 1000, 800, p => `Following the dry adiabat: ${deg(A.dryAt(p))} at ${mb(p)}.`)),
          watch('2. Follow a mixing ratio line', [`Now start at the dewpoint at the ground, ${A.g.td} °C. Follow a mixing ratio line upward.`, 'This line stands for the parcel’s water vapor. Its mixing ratio stays the same while it is unsaturated.'], withLines(first, aDry),
            trace('mix', A.mixAt, 1000, 800, p => `Following the mixing ratio line: ${deg(A.mixAt(p))} at ${mb(p)}. It stays at ${one(A.w * 1000)} g/kg.`)),
          watch('3. Mark where they meet', [`The two lines meet at the LCL, about ${mb(A.lcl.p)}.`, 'Watch the gap under the chart. The parcel temperature falls faster than its dewpoint, so the gap closes. When it reaches zero, the parcel is saturated.'], { ...withLines(first, aDry, aMix), answer: A.lclMark }, A.meet),
          watch('4. Keep lifting', ['Above the LCL, follow a moist adiabat.', 'Condensing water releases heat, so the saturated parcel cools more slowly. These lines together are the parcel path.'], { ...withLines(first, aDry, aMix), answer: A.lclMark }, A.lift),
          turn('Pick the dry adiabat', [`This is a new sounding: a humid summer afternoon. At the ground the temperature is ${g.t} °C and the dewpoint is ${g.td} °C.`, 'Which lettered line is the dry adiabat you should follow?'], yours,
            pick('dry', {
              A: candidate('dry', dryFrom(g.td), { tag: 0.86, why: 'That dry adiabat starts at the dewpoint. Start from the environmental temperature at the ground.', describe: `starting at ${g.td} °C at the ground` }),
              B: candidate('dry', dryFrom(g.t), { tag: 0.86, describe: `starting at ${g.t} °C at the ground` }),
              C: candidate('dry', dryFrom(middle), { tag: 0.86, why: 'That dry adiabat starts between the dewpoint and the temperature. It must pass through the environmental temperature at the ground.', describe: `starting at ${middle} °C at the ground` }),
            }, 'B', `This dry adiabat starts at ${g.t} °C. It runs close to the environmental temperature near the ground.`),
            { after: { chart: yours, scene: trace('dry', B.dryAt, 1000, 800, p => `Following the dry adiabat: ${deg(B.dryAt(p))} at ${mb(p)}.`) } }),
          turn('Pick the mixing ratio line', ['Now which lettered line is the mixing ratio line you should follow?'], withLines(yours, bDry),
            pick('mix', {
              A: candidate('mix', mixFrom(g.td), { tag: 1, describe: `starting at ${g.td} °C at the ground` }),
              B: candidate('mix', mixFrom(middle), { tag: 1, why: 'That line does not start at the dewpoint. The parcel’s water vapor is read from the dewpoint.', describe: `starting at ${middle} °C at the ground` }),
              C: candidate('mix', mixFrom(g.t), { tag: 1, why: 'A line through the temperature shows how much vapor saturated air could hold there. This parcel has less. Start from the dewpoint.', describe: `starting at ${g.t} °C at the ground` }),
            }, 'A', `This line starts at the dewpoint, ${g.td} °C. The parcel’s mixing ratio stays the same while it is unsaturated.`),
            { after: { chart: withLines(yours, bDry), scene: trace('mix', B.mixAt, 1000, 800, p => `Following the mixing ratio line: ${deg(B.mixAt(p))} at ${mb(p)}.`) } }),
          turn('Find the LCL', ['Click or tap the chart where your two lines meet.', 'If you can’t point to it, type the pressure where they meet instead.'], near,
            point('tap', [B.lcl.t, B.lcl.p], `The LCL is at about ${mb(B.lcl.p)}, where the parcel temperature is about ${deg(B.lcl.t)}.`, { pLimit: 25, tLimit: 2, typed: { label: 'Pressure where they meet (mb)', value: B.lcl.p, margin: 15 }, hint: 'Look for where your two lines cross.' }),
            { after: { chart: { ...near, answer: B.lclMark }, scene: B.meet } }),
          turn('Lift it higher', ['The parcel is at its LCL. Which lettered line does its temperature follow from here up?'], { ...withLines(yours, ...bToLcl), answer: B.lclMark },
            pick('above', {
              A: candidate('dry', dryPts(B.theta, B.lcl.p, 800), { tag: 1, why: 'That carries on along the dry adiabat, which is for unsaturated air. At the LCL the parcel has become saturated.', describe: 'the dry adiabat from the LCL' }),
              B: candidate('mix', mixPts(B.w, B.lcl.p, 800), { tag: 1, why: 'That carries on along the mixing ratio line. The parcel temperature does not follow it: above the LCL, some vapor condenses.', describe: 'the mixing ratio line from the LCL' }),
              C: candidate('moist', B.moist, { tag: 1, describe: 'the moist adiabat from the LCL' }),
            }, 'C', 'Above the LCL the saturated parcel follows a moist adiabat.'),
            { after: { chart: { ...withLines(yours, bDry, bMix), answer: B.lclMark }, scene: B.lift } }),
          turn('What happens at the LCL?', ['Choose the best answer.'], { ...withLines(yours, ...bToLcl, guide('moist', B.moist)), routes: [dryPts(B.theta, 1000, B.lcl.p), B.moist], answer: B.lclMark },
            choice('check', 'It becomes saturated, so a cloud can begin to form', [
              ['It becomes warmer than the environment', 'Reaching the LCL does not by itself make the parcel warmer than the environment. That comparison is what finds the LFC.'],
              ['It loses all of its water vapor', 'The parcel still has water vapor. It has reached the point where it is saturated.'],
            ], 'At the LCL the parcel becomes saturated. Above it, some of the vapor condenses.')),
        ],
        recapChart: { ...withLines(yours, bDry, bMix), answer: B.lclMark },
        recapScene: B.lift,
      };
    };

    const risingLesson = () => {
      const P = T.parcel(storm.levels), H = T.parcel(humid.levels);
      const pts = path => path.map(q => [q.t, q.p]);
      const gapWords = (s, path) => p => {
        const parcel = T.interp(path, 't', p), air = env(s, p), gap = parcel - air;
        const compare = Math.abs(gap) < 0.05 ? 'The two are the same.' : `The parcel is ${deg(Math.abs(gap))} ${gap > 0 ? 'warmer' : 'colder'}.`;
        return `${mb(p)}: parcel ${deg(parcel)}, environment ${deg(air)}. ${compare}`;
      };
      const shadeOf = (s, path, from, to) => ({ from, to, left: p => T.interp(path, 't', p), right: p => env(s, p) });
      const climb = (s, par) => ({
        from: 1000, to: 120, seconds: 12, tracks: [{ cls: 'profile parcel', at: along(pts(par.path)), from: 1000, to: 120, route: true, dot: 'parcel' }],
        areas: [{ cls: 'cin', ...shadeOf(s, par.path, 1000, par.lfc) }, { cls: 'cape', ...shadeOf(s, par.path, par.lfc, par.el) }],
        read: gapWords(s, par.path),
      });
      const tall = (s, lines) => view(120, 1050, [[-70, 150], [32, 1000], [-45, 400]], { height: 520, lines, label: 'Skew-T to 120 mb', notes: [topName(s)] });
      const area = (par, s, from, to, cls) => {
        const part = par.path.filter(q => q.p <= from + 0.01 && q.p >= to - 0.01);
        return { cls, pts: part.map(q => [q.t, q.p]).concat(part.slice().reverse().map(q => [q.envCmp, q.p])) };
      };
      const shades = [area(P, storm, 1000, P.lfc, 'cin'), area(P, storm, P.lfc, P.el, 'cape')];
      const low = view(680, 980, [[env(storm, 700) - 4, 700], [T.interp(P.path, 't', 960) + 4, 960]], { lines: warmParcel(storm, P.path, 705), label: 'Skew-T around the LFC' });
      const high = view(130, 300, [[env(storm, 290), 290], [T.interp(P.path, 't', 290), 290], [env(storm, 140), 140], [T.interp(P.path, 't', 140), 140]], { lines: coldParcel(storm, P.path, 145), label: 'Skew-T around the EL' });
      const v = Calc.values(T, storm);
      const mid = view(420, 620, [[v.at500.air - 6, 500], [v.at500.parcel + 6, 500], [env(storm, 600), 600]], { lines: [parcelProfile(P.path), ...both(storm)], label: 'Skew-T around 500 mb', notes: [{ at: [v.at500.air, 500], words: `environment ${one(v.at500.air)}`, dx: -10, dy: -10, anchor: 'end' }, { at: [v.at500.parcel, 500], words: `parcel ${one(v.at500.parcel)}`, dx: 10, dy: -10, anchor: 'start' }], routes: [[[v.at500.air, 500], [v.at500.parcel, 500]]] });
      const shaded = { ...tall(storm, [parcelProfile(P.path, onRight(300, 'parcel')), profile(storm, 't'), profile(storm, 'td')]), shade: shades };
      return {
        id: 'rising', level: 'Intro', title: 'Rising on its own', summary: 'LFC, EL, CIN, CAPE and the Lifted Index.',
        source: cite('pp. 91 and 345–346 (including footnote 12), with the National Weather Service Central Illinois page on CAPE for updraft strength (linked from About this site),'),
        learned: ['The LFC is where the parcel temperature becomes warmer than the environmental temperature.', 'The EL is where it stops being warmer.', 'CIN is the area where the parcel is colder below the LFC. CAPE is the area where it is warmer from the LFC to the EL.', 'The Lifted Index compares the two temperatures at 500 mb.'],
        steps: [
          watch('Compare the two temperatures', ['On the humid summer sounding, watch the parcel climb. Below the LCL it follows a dry adiabat, and above it a moist adiabat.', 'At each height, compare the parcel temperature with the environmental temperature. In the lowest 50 mb or so they are almost the same, within about 0.1 °C. Higher up, shading fills in the difference: first CIN, then CAPE.'],
            tall(humid, [profile(humid, 't'), profile(humid, 'td', onLeft(700, 'dewpoint'))]), climb(humid, H)),
          turn('Find the LFC', ['This is the spring storm sounding, with its parcel path drawn. Click the level of free convection (LFC): where the parcel temperature crosses to the warm side of the environmental temperature, above the LCL.'], low,
            point('lfc', [env(storm, P.lfc), P.lfc], `The LFC is at about ${mb(P.lfc)}. From here the parcel can keep rising without being pushed.`, { pLimit: 25, tLimit: 2.5, typed: { label: 'Or type the LFC pressure (mb)', value: P.lfc, margin: 20 }, mark: `LFC ≈ ${mb(P.lfc)}`, hint: 'Look for where the parcel line crosses the environmental temperature.' })),
          turn('Find the EL', ['High up, click the equilibrium level (EL): where the parcel temperature crosses back to the cold side.'], high,
            point('el', [env(storm, P.el), P.el], `The EL is at about ${mb(P.el)}.`, { pLimit: 15, tLimit: 3, typed: { label: 'Or type the EL pressure (mb)', value: P.el, margin: 12 }, mark: `EL ≈ ${mb(P.el)}`, hint: 'Look for where the two lines cross again.' })),
          turn('Which area is CIN?', ['Convective inhibition (CIN) is the energy needed to lift the parcel to its LFC. Which shaded area stands for it?'], { ...shaded, marks: [
              // Numbers with pointers, because the lower area is very small at this scale.
              { n: 1, at: [(T.interp(P.path, 't', 850) + env(storm, 850)) / 2, 850], dx: 62, dy: 4 },
              { n: 2, at: [(T.interp(P.path, 't', 400) + env(storm, 400)) / 2, 400], dx: 70, dy: -6 }] },
            choice('cin', 'Area 1', [['Area 2', 'There, between the LFC and EL, the parcel is warmer than the environment, so it is helped upward. That area is CAPE.']], 'Area 1 is below the LFC, where the parcel is colder. CIN is written as a negative number of joules per kilogram. The farther from zero, the bigger the barrier.')),
          turn('What does CAPE mean?', ['The large area between the LFC and EL is convective available potential energy (CAPE). What does a large value tell you?'], shaded,
            choice('cape', 'Rising air could have a lot of energy, but a storm is not certain', [['A thunderstorm will definitely form', 'A large value does not mean a storm will form. Air still has to reach its LFC, and other conditions matter.'], ['The air is too stable to rise at all', 'It is the other way round: CAPE comes from the parcel being warmer than the environment.']], 'More CAPE allows stronger updrafts. It does not by itself forecast a storm.')),
          turn('Work out the Lifted Index', ['The Lifted Index (LI) is the environmental temperature at 500 mb minus the parcel temperature at 500 mb. Use the two readings on the chart.'], mid,
            number('li', 'Lifted Index', v.liftedIndex, 0.5, '', `LI is about ${one(v.liftedIndex)}. In the book, negative values point to a potential for deep convection, and values below -9 to a potential for severe convection. It does not forecast a storm by itself.`, 'Subtract the parcel temperature from the environmental temperature. Mind the minus signs.'),
            { equations: [{ latex: String.raw`\mathrm{LI} = T_{500} - T'_{500}`, plain: 'LI = T500 − T′500' }] }),
        ],
        recapChart: tall(humid, [profile(humid, 't'), profile(humid, 'td', onLeft(700, 'dewpoint'))]),
        recapScene: climb(humid, H),
      };
    };

    // =========================================================== Intermediate
    const virtualLesson = () => {
      const v = Calc.values(T, storm), a = v.a;
      const virtual = storm.levels.map(l => [T.virtualTemp(l.t, T.mixingRatio(l.td, l.p)), l.p]);
      const base = view(750, 950, [[a.td - 3, 850], [v.tv + 4, 850]], { lines: both(storm, 765, 930), dots: [{ at: [a.td, 850] }, { at: [a.t, 850] }], label: 'Skew-T near 850 mb' });
      const eq = { latex: String.raw`T_v = T\,\frac{w + \varepsilon}{\varepsilon\,(1 + w)}`, plain: 'Tv = T (w + ε) / (ε (1 + w))' };
      return {
        id: 'virtual', level: 'Intermediate', title: 'Virtual temperature', summary: 'Allow for moisture when comparing densities.',
        source: cite('pp. 63, 67 and 80 (Exercise 3.7)'),
        learned: ['Moist air is less dense than dry air at the same temperature and pressure.', 'Virtual temperature is a little higher than the actual temperature.', 'The chart gives the readings. The equation does the rest, in kelvin.'],
        steps: [
          read('Why it matters', ['Moist air is less dense than dry air at the same temperature and pressure. Virtual temperature is the temperature dry air would need to have the same density as the moist air.', `At 850 mb in the spring storm sounding, the temperature is ${a.t} °C and the dewpoint is ${a.td} °C.`], base),
          turn('Read the moisture', ['First find the mixing ratio w, from the line through the dewpoint. It is between the 7 and 10 g/kg lines.'],
            { ...base, lines: [guide('mix', mixPts(0.007, 950, 750), { p: 775, words: '7', anchor: 'end', dx: -4 }), guide('mix', mixPts(0.010, 950, 750), { p: 775, words: '10', anchor: 'start', dx: 4 }), guide('mix', mixPts(v.w, 950, 750)), ...base.lines] },
            number('w', 'Mixing ratio w (g/kg)', v.w * 1000, 1, 'g/kg', `w is about ${one(v.w * 1000)} g/kg. In the equation it must be in kg per kg: ${v.w.toFixed(4)}.`, 'It is closer to 7 than to 10.')),
          turn('Change to kelvin', [`The equation needs the temperature in kelvin. What is ${a.t} °C in kelvin?`], base,
            number('kelvin', 'Temperature (K)', a.t + K, 0.2, 'K', `${a.t} + 273.15 = ${(a.t + K).toFixed(2)} K.`, 'Add 273.15.'), { equations: [KELVIN] }),
          turn('Work out Tv', [`Use T = ${(a.t + K).toFixed(2)} K, w = ${v.w.toFixed(4)} and ε = 0.622. Give your answer in °C.`], base,
            number('tv', 'Virtual temperature (°C)', v.tv, 0.3, '°C', `Tv is about ${(v.tv + K).toFixed(1)} K, which is ${one(v.tv)} °C.`, 'Find Tv in kelvin, then subtract 273.15.'),
            { equations: [eq, { latex: String.raw`T_{^\circ\mathrm{C}} = T_{\mathrm{K}} - 273.15`, plain: '°C = K − 273.15' }],
              after: { chart: { ...base, lines: [...base.lines, { cls: 'profile tvair', pts: virtual, label: { p: 790, words: 'Tv (dotted)', anchor: 'start', dx: 12 } }], answer: { at: [v.tv, 850], words: `Tv ≈ ${deg(v.tv)}`, dx: 14, dy: -12 } } } }),
          turn('How do they compare?', ['Choose the best answer.'], base,
            choice('higher', 'Virtual temperature is a little higher than the actual temperature', [['Virtual temperature is always lower', 'Moist air is less dense, like warmer dry air.'], ['They differ by tens of degrees', 'Even for very warm, moist air they differ by only a few degrees.']], 'The Full chart in Explore uses virtual temperature for the LFC, EL, CAPE and CIN.')),
        ],
      };
    };

    const stabilityLesson = () => {
      const m = Calc.lapseRate(T, storm.levels, 700, 500);
      const layer = (lower, upper) => Calc.stability(T, lower, upper);
      const lv = p => at(storm, p);
      const cond = layer(lv(700), lv(500)), cap = layer(lv(950), lv(900)), hot = layer({ p: 1000, t: 33 }, lv(950));
      const temp = envAt => profile(storm, 't', envAt && onRight(envAt, 'environment'));
      const mid = view(450, 750, [[cond.dry, 500], [cond.moist + 3, 500], [lv(700).t + 3, 700]], { lines: [temp(600)], dots: [{ at: [lv(700).t, 700] }, { at: [lv(500).t, 500] }], label: 'Skew-T from 700 to 500 mb' });
      const adiabats = test => {
        const { bottom, top } = test, theta = T.theta(bottom.t, bottom.p), moist = moistPts(bottom.t, bottom.p, bottom.p, top.p), moistAt = along(moist);
        return {
          from: bottom.p, to: top.p, seconds: 5, tracks: [track('dry', p => T.dryTemp(theta, p), bottom.p, top.p, { route: false }), track('moist', moistAt, bottom.p, top.p, { route: false })],
          read: p => `${mb(p)}: dry adiabat ${deg(T.dryTemp(theta, p))}, moist adiabat ${deg(moistAt(p))}, environment ${deg(env(storm, p))}.`,
        };
      };
      const lines = test => [guide('dry', dryPts(T.theta(test.bottom.t, test.bottom.p), test.bottom.p, test.top.p), { p: test.top.p, words: 'dry', anchor: 'end', dx: -6, dy: -8 }), guide('moist', moistPts(test.bottom.t, test.bottom.p, test.bottom.p, test.top.p), { p: test.top.p, words: 'moist', anchor: 'start', dx: 6, dy: -8 })];
      const capView = view(875, 980, [[cap.dry - 2.5, 900], [cap.moist + 5, 900]], { lines: [...lines(cap), temp()], dots: [{ at: [lv(950).t, 950] }, { at: [lv(900).t, 900] }], label: 'Skew-T from 950 to 900 mb' });
      const heated = { cls: 'profile temp', pts: [[33, 1000], ...storm.levels.slice(1).map(l => [l.t, l.p])] };
      const hotView = view(930, 1020, [[hot.top.t, 950], [34, 1000], [hot.moist + 1, 950]], { lines: [...lines(hot), heated], dots: [{ at: [33, 1000] }, { at: [lv(950).t, 950] }], label: 'Skew-T near the ground with heated surface air' });
      const kinds = (right, why, done, id) => choice(id, right, ['Stable', 'Conditionally unstable', 'Unstable'].filter(k => k !== right).map(k => [k, why]), done);
      return {
        id: 'stability', level: 'Intermediate', title: 'Lapse rate and stability', summary: 'How fast it cools, and whether air would keep rising.',
        source: cite('pp. 70 (equation (3.29)), 77, 88 and 90–91'),
        learned: ['The lapse rate is how fast the environmental temperature falls with height.', 'Environment right of the moist adiabat: stable.', 'Between the adiabats: conditionally unstable.', 'Left of the dry adiabat: unstable.'],
        steps: [
          turn('Work out a lapse rate', [`Between 700 and 500 mb in the spring storm sounding, the temperature goes from ${m.lower.t} to ${m.upper.t} °C. The layer is ${(m.thickness / 1000).toFixed(2)} km thick (calculated from the sounding, since the chart does not show height).`, 'What is the lapse rate?'], mid,
            number('lapse', 'Lapse rate (°C per km)', m.rate, 0.2, '°C per km', `The lapse rate is about ${one(m.rate)} °C per km. The dry adiabatic lapse rate is 9.8, and the book gives 6–7 as the average in the troposphere.`, 'Divide the temperature drop by the thickness in km.'),
            { equations: [{ latex: String.raw`\Gamma = \frac{T_{700} - T_{500}}{z_{500} - z_{700}}`, plain: 'Γ = (T700 − T500) / (z500 − z700)' }] }),
          watch('The stability test', ['Start at the environmental temperature at the bottom of a layer. Draw a dry adiabat and a moist adiabat up to the top.', 'Then see where the environmental temperature at the top falls compared with them.'], mid, adiabats(cond)),
          turn('Classify 700 to 500 mb', ['Is this layer stable, conditionally unstable or unstable?'], { ...mid, lines: [...lines(cond), temp(600)] },
            kinds('Conditionally unstable', 'At 500 mb the environmental temperature lies between the two adiabats.', 'It is between the adiabats: stable for an unsaturated parcel and unstable for a saturated one.', 'cond')),
          turn('Classify 950 to 900 mb', ['This thin warm layer forms the cap. Which is it?'], capView,
            kinds('Stable', 'At 900 mb the environmental temperature is to the right of both adiabats.', 'It is right of the moist adiabat: a lifted parcel would be colder and tends to sink back.', 'capkind')),
          turn('A heated ground layer', ['This case is made up: strong heating raises the ground temperature to 33 °C. Which is the layer from 1000 to 950 mb now?'], hotView,
            kinds('Unstable', 'At 950 mb the environmental temperature is to the left of even the dry adiabat.', 'It is left of the dry adiabat: a lifted parcel is warmer and keeps rising. Such layers usually last only just above strongly heated ground.', 'hot')),
        ],
        recapChart: mid, recapScene: adiabats(cond),
      };
    };

    const temperaturesLesson = () => {
      const v = Calc.values(T, storm), a = v.a, l = v.lclA;
      const theta = v.theta;
      const dryAt = p => T.dryTemp(theta, p), mixAt = p => T.dewFromMixingRatio(v.w, p);
      const down = moistPts(l.t, l.p, l.p, 1000), downAt = along(down);
      const upPts = moistPts(l.t, l.p, l.p, 200), upAt = along(upPts);
      const start = { lines: both(storm), dots: [{ at: [a.t, 850] }, { at: [a.td, 850] }] };
      const dryDown = view(700, 1030, [[a.td, 850], [theta - K + 4, 1000], [a.t, 780]], { ...start, lines: both(storm, 760, 950), label: 'Skew-T from 850 to 1000 mb' });
      const lift = view(650, 900, [[a.td - 4, 850], [a.t + 5, 850], [l.t - 6, 700]], { ...start, label: 'Skew-T around 850 mb' });
      lift.lines = both(storm, 790);
      const toLcl = [guide('dry', dryPts(theta, 850, l.p)), guide('mix', mixPts(v.w, 850, l.p))];
      const lclMark = { at: [l.t, l.p], words: `LCL ≈ ${mb(l.p)}`, dx: 14, dy: -10 };
      const withLcl = more => ({ ...lift, lines: [...toLcl, ...lift.lines], ...more });
      const meet = { from: 850, to: l.p, seconds: 5, answerAt: l.p, tracks: [track('dry', dryAt, 850, l.p), track('mix', mixAt, 850, l.p)], read: p => (p > l.p + 0.05 ? `${mb(p)}: temperature ${deg(dryAt(p))}, dewpoint ${deg(mixAt(p))}.` : `${mb(l.p)}: they meet. This is the LCL for the 850 mb air.`) };
      const toGround = view(700, 1030, [[a.td - 2, 850], [v.thetaW + 8, 1000], [l.t - 4, 730]], { ...start, lines: [...toLcl, ...both(storm, 760, 950)], label: 'Skew-T down to 1000 mb' });
      const highView = view(180, 900, [[a.td, 850], [a.t, 850], [v.topT, 200], [T.dryTemp(340, 300), 300]], { height: 520, lines: [...toLcl, ...both(storm)], dots: start.dots, label: 'Skew-T up to 180 mb' });
      const labelled = [320, 330, 340].map((k, i) => guide('dry', dryPts(k, 420, 200), { p: [360, 310, 265][i], words: `${k} K`, anchor: 'start', dx: 8 }));
      return {
        id: 'temperatures', level: 'Intermediate', title: 'Temperatures from moving a parcel', summary: 'Potential, wet-bulb, wet-bulb potential and equivalent potential temperature.',
        source: cite('pp. 63, 77–78, 83 and 85–86'),
        learned: ['Potential temperature: follow the dry adiabat to 1000 mb, then change to kelvin.', 'Wet-bulb temperature: go up to the LCL, then back down a moist adiabat (Normand’s rule).', 'Wet-bulb potential temperature: keep going down that moist adiabat to 1000 mb.', 'Equivalent potential temperature: go up the moist adiabat until it runs alongside the dry adiabats.'],
        steps: [
          watch('Potential temperature', [`Potential temperature is the temperature air would have if moved to 1000 mb without condensation or any exchange of heat. Start with the 850 mb air: ${a.t} °C.`, 'Follow its dry adiabat down to 1000 mb.'], dryDown,
            trace('dry', dryAt, 850, 1000, p => `Along the dry adiabat: ${deg(dryAt(p))} at ${mb(p)}.`)),
          turn('Give θ in kelvin', [`The dry adiabat reads about ${whole(theta - K)} °C at 1000 mb. What is the potential temperature in kelvin?`], { ...dryDown, lines: [guide('dry', dryPts(theta, 850, 1000)), ...dryDown.lines] },
            number('theta', 'Potential temperature θ (K)', theta, 1, 'K', `θ is about ${whole(theta)} K.`, 'Add 273.15 to the reading.'), { equations: [KELVIN] }),
          watch('Wet-bulb: first go up', [`For the wet-bulb temperature of the 850 mb air (temperature ${a.t} °C, dewpoint ${a.td} °C), first find its LCL.`], withLcl({ lines: lift.lines, answer: lclMark }), meet),
          turn('Then come back down', ['Follow the moist adiabat from this LCL back down to 850 mb. What temperature do you read there?'], withLcl({ answer: lclMark }),
            number('tw', 'Wet-bulb temperature (°C)', v.wetBulb, 1, '°C', `The wet-bulb temperature is about ${deg(v.wetBulb)}, between the dewpoint and the temperature.`, 'It must lie between the dewpoint and the temperature.'),
            { after: { chart: withLcl({ answer: lclMark }), scene: trace('moist', downAt, l.p, 850, p => `Down the moist adiabat: ${deg(downAt(p))} at ${mb(p)}.`) } }),
          watch('Wet-bulb potential', ['Keep going down the same moist adiabat to 1000 mb. The temperature there is the wet-bulb potential temperature.'], { ...toGround, answer: lclMark },
            trace('moist', downAt, l.p, 1000, p => `Down the moist adiabat: ${deg(downAt(p))} at ${mb(p)}.`)),
          turn('Read θw', ['What is the wet-bulb potential temperature?'], { ...toGround, lines: [...toGround.lines, guide('moist', down)] },
            number('thw', 'Wet-bulb potential temperature (°C)', v.thetaW, 1, '°C', `θw is about ${deg(v.thetaW)}.`, 'Read the moist adiabat where it meets 1000 mb.')),
          watch('Go high for θe', ['For equivalent potential temperature, follow the moist adiabat from the LCL upward until it runs nearly alongside the dry adiabats.'], highView,
            trace('moist', upAt, l.p, 200, p => `Up the moist adiabat: ${deg(upAt(p))} at ${mb(p)}.`, 6)),
          turn('Read θe', ['Near 200 mb, which labeled dry adiabat does the moist adiabat run closest to? That value is the equivalent potential temperature.'], { ...highView, lines: [...labelled, guide('moist', upPts), ...highView.lines], routes: [upPts] },
            choice('thetae', '330 K', [['320 K', 'Compare near the top of the highlighted line. It is warmer than the 320 K adiabat.'], ['340 K', 'Compare near the top of the highlighted line. It is colder than the 340 K adiabat.']], `θe is about ${whole(v.thetaE)} K. This is a chart estimate, because the two sets of lines are still not perfectly parallel.`)),
        ],
        recapChart: highView, recapScene: trace('moist', upAt, l.p, 200, p => `Up the moist adiabat: ${deg(upAt(p))} at ${mb(p)}.`, 6),
      };
    };

    const heatingLesson = () => {
      const t = Calc.toolValues(T, storm), g = storm.levels[0], P = T.parcel(storm.levels);
      const w = t.sfcW, mixAt = p => T.dewFromMixingRatio(w, p), theta = T.theta(t.ccl.t, t.ccl.p), dryAt = p => T.dryTemp(theta, p);
      const base = view(750, 1030, [[g.td - 8, 900], [t.convective + 3, 1000], [t.ccl.t - 4, 780]], { lines: both(storm, 770, 950), dots: groundDots(storm), label: 'Skew-T near the ground' });
      const mixGuide = guide('mix', mixPts(w, 1000, 760));
      const cclMark = { at: [t.ccl.t, t.ccl.p], words: `CCL ≈ ${mb(t.ccl.p)}`, dx: 16, dy: -10 };
      const climb = trace('mix', mixAt, 1000, t.ccl.p, p => `Mixing ratio line ${deg(mixAt(p))}, environment ${deg(env(storm, p))} at ${mb(p)}.`);
      const down = trace('dry', dryAt, t.ccl.p, 1000, p => `Down the dry adiabat: ${deg(dryAt(p))} at ${mb(p)}.`);
      return {
        id: 'heating', level: 'Intermediate', title: 'Daytime heating', summary: 'The convective condensation level and convective temperature.',
        source: 'Sources: National Weather Service training page on Skew-T parameters, and National Weather Service glossary entries for convective condensation level and convective temperature (linked from About this site). The soundings are made up for teaching. Your progress is saved only in this browser.',
        learned: ['The CCL is where the surface mixing ratio line meets the environmental temperature.', 'A dry adiabat from the CCL down to the ground gives the convective temperature.', 'Both are estimates that rest on many assumptions.'],
        steps: [
          read('Heating from below', ['Sunshine can warm the ground until air near it starts to rise. The convective condensation level (CCL) is where that rising air would become saturated.', `In the spring storm sounding, the dewpoint at the ground is ${g.td} °C.`], base),
          turn('Pick the line to follow', ['To find the CCL, which line should you follow upward?'], base,
            pick('line', {
              A: candidate('mix', mixPts(w, 1000, 760), { tag: 0.9, describe: 'a mixing ratio line from the surface dewpoint' }),
              B: candidate('dry', dryPts(T.theta(g.t, g.p), 1000, 760), { tag: 0.9, why: 'A dry adiabat from the temperature is the start of the parcel path used for the LCL. For the CCL, follow the moisture line up from the dewpoint.', describe: 'a dry adiabat from the surface temperature' }),
              C: candidate('mix', mixPts(T.mixingRatio(g.t, g.p), 1000, 760), { tag: 0.9, why: 'That line starts at the temperature. Start from the dewpoint.', describe: 'a mixing ratio line from the surface temperature' }),
            }, 'A', 'Follow the mixing ratio line from the surface dewpoint.'), { after: { chart: base, scene: climb } }),
          turn('Find the CCL', ['Click where this line first meets the environmental temperature.'], { ...base, lines: [mixGuide, ...base.lines] },
            point('ccl', [t.ccl.t, t.ccl.p], `The CCL is at about ${mb(t.ccl.p)}. This sounding’s LCL is lower on the chart, at about ${mb(P.lcl.p)}.`, { pLimit: 25, tLimit: 2, typed: { label: 'Or type the CCL pressure (mb)', value: t.ccl.p, margin: 15 }, mark: `CCL ≈ ${mb(t.ccl.p)}`, hint: 'Look for the first crossing with the environmental temperature.' })),
          watch('Come back down', [`From the CCL, follow a dry adiabat down to the surface pressure, ${g.p} mb.`], { ...base, lines: [mixGuide, ...base.lines], answer: cclMark }, down),
          turn('Read the convective temperature', ['What temperature does the dry adiabat reach at the ground?'], { ...base, lines: [mixGuide, guide('dry', dryPts(theta, t.ccl.p, 1000)), ...base.lines], routes: [dryPts(theta, t.ccl.p, 1000)], answer: cclMark },
            number('conv', 'Convective temperature (°C)', t.convective, 1.5, '°C', `It is about ${whole(t.convective)} °C, so the ${g.t} °C air at the ground would need to warm by about ${whole(t.convective - g.t)} °C.`, 'Read where the highlighted line meets 1000 mb.')),
          turn('What does it tell you?', ['Choose the best answer.'], base,
            choice('meaning', 'About how warm the ground air must get before storms could start from heating alone', [
              ['The temperature at which storms will definitely form', 'It is an estimate resting on many assumptions. Storms can form earlier, later or not at all.'],
              ['The temperature of the cloud tops', 'It is a temperature at the ground, found from the CCL.'],
            ], 'It is an estimate, not a promise.')),
        ],
        recapChart: { ...base, lines: [mixGuide, ...base.lines], answer: cclMark }, recapScene: down,
      };
    };

    const indicesLesson = () => {
      const t = Calc.toolValues(T, storm), b = t.b, c = t.c, d = t.d, l = t.lclB;
      const theta = T.theta(b.t, 850), w = T.mixingRatio(b.td, 850);
      const dryAt = p => T.dryTemp(theta, p), mixAt = p => T.dewFromMixingRatio(w, p), up = moistPts(l.t, l.p, l.p, 500), upAt = along(up);
      const base = view(450, 900, [[d.t - 4, 500], [b.t + 4, 850], [b.td - 4, 850], [c.td - 4, 700]], { lines: both(storm, 620, 880), dots: [{ at: [b.t, 850] }, { at: [b.td, 850] }], label: 'Skew-T from 850 to 500 mb' });
      const rise = {
        from: 850, to: 500, seconds: 7, answerAt: l.p, tracks: [track('dry', dryAt, 850, l.p), track('mix', mixAt, 850, l.p), track('moist', upAt, l.p, 500)],
        read: p => (p > l.p + 0.5 ? `${mb(p)}: parcel temperature ${deg(dryAt(p))}, parcel dewpoint ${deg(mixAt(p))}.` : `${mb(p)}: saturated parcel ${deg(upAt(p))}, environment ${deg(env(storm, p))}.`),
      };
      const reading = (temp, p, words, dx, anchor) => ({ at: [temp, p], words, dx, dy: -10, anchor });
      const readings = { ...base, dots: [{ at: [b.t, 850] }, { at: [b.td, 850] }, { at: [c.t, 700] }, { at: [c.td, 700] }, { at: [d.t, 500] }],
        notes: [reading(b.t, 850, `T ${b.t}`, 10, 'start'), reading(b.td, 850, `Td ${b.td}`, -10, 'end'), reading(c.t, 700, `T ${c.t}`, 10, 'start'), reading(c.td, 700, `Td ${c.td}`, -10, 'end'), reading(d.t, 500, `T ${d.t}`, 10, 'start')] };
      return {
        id: 'indices', level: 'Intermediate', title: 'Stability indices', summary: 'Showalter, K Index and Total Totals.',
        source: 'Sources: National Weather Service training page on Skew-T parameters and National Weather Service glossary entries for the Showalter, K and Total Totals indices (linked from About this site). The soundings are made up for teaching. Your progress is saved only in this browser.',
        learned: ['The Showalter Index is like the Lifted Index, but the parcel starts at 850 mb.', 'The K Index and Total Totals use readings at set levels.', 'Each index has limits, and none forecasts a storm by itself.'],
        steps: [
          watch('Lift from 850 mb', ['The Showalter Index starts the parcel at 850 mb instead of the ground. Watch it climb to 500 mb: up to its LCL, then along a moist adiabat.'], base, rise),
          turn('Work out the Showalter Index', [`At 500 mb the environmental temperature is ${d.t} °C and this parcel is ${deg(t.parcel500)}.`], { ...base, lines: [guide('dry', dryPts(theta, 850, l.p)), guide('mix', mixPts(w, 850, l.p)), guide('moist', up), ...base.lines], routes: [[[d.t, 500], [t.parcel500, 500]]] },
            number('si', 'Showalter Index', t.showalter, 0.5, '', `SI is about ${one(t.showalter)}. A negative value means the parcel is warmer than the environment at 500 mb. It can miss moisture and heating below 850 mb, and cool layers reaching above 850 mb make it understate the potential.`, 'Environment minus parcel.'),
            { equations: [{ latex: String.raw`\mathrm{SI} = T_{500} - T'_{500}`, plain: 'SI = T500 − T′500' }] }),
          turn('Work out the K Index', ['Use the readings marked on the chart, all in °C.'], readings,
            number('k', 'K Index', t.kIndex, 0.5, '', `K is ${whole(t.kIndex)}. It is about the chance of ordinary thunderstorms, not how severe they would be, and the training page says it cannot be used in mountain areas.`, '(T850 minus T500), plus Td850, minus the gap at 700 mb.'),
            { equations: [{ latex: String.raw`\begin{aligned} K = {} & (T_{850} - T_{500}) + T_{d,850} \\ & - (T_{700} - T_{d,700}) \end{aligned}`, plain: 'K = (T850 − T500) + Td850 − (T700 − Td700)' }] }),
          turn('Work out Total Totals', ['Use the 850 and 500 mb readings.'], readings,
            number('tt', 'Total Totals', t.totalTotals, 0.5, '', `TT is ${whole(t.totalTotals)}. The Weather Service glossary says there are no magic cutoffs, but in general values under 50 are a weak sign and values over 55 a strong one.`, 'Add T850 and Td850, then subtract twice T500.'),
            { equations: [{ latex: String.raw`\mathrm{TT} = T_{850} + T_{d,850} - 2\,T_{500}`, plain: 'TT = T850 + Td850 − 2 × T500' }] }),
          turn('What can one index tell you?', ['Choose the best answer.'], base,
            choice('limits', 'It is a quick guide that leaves things out, so check the whole sounding', [['It forecasts whether a storm will happen', 'No index does that by itself.'], ['It replaces the need to look at the sounding', 'Each index uses only a few readings, so it can miss important layers.']], 'Read the index along with the sounding.')),
        ],
        recapChart: base, recapScene: rise,
      };
    };

    const togetherLesson = () => {
      const P = T.parcel(humid.levels), S = T.parcel(storm.levels), t = Calc.toolValues(T, humid), st = Calc.toolValues(T, storm), v = Calc.values(T, humid), sv = Calc.values(T, storm), W = T.parcel(winter.levels);
      const b = t.b, c = t.c, d = t.d;
      // The most each parcel is warmer than the environmental temperature between its LFC and EL.
      const warmest = par => whole(Math.max(...par.path.filter(q => q.p <= par.lfc && q.p >= par.el).map(q => q.b)));
      const tall = view(120, 1050, [[-70, 150], [33, 1000], [-45, 400]], { height: 520, lines: [parcelProfile(P.path, onRight(300, 'parcel')), profile(humid, 't'), profile(humid, 'td')], notes: [topName(humid)], label: 'Humid summer sounding with its parcel path' });
      const note = (temp, p, words, dx, anchor) => ({ at: [temp, p], words, dx, dy: -10, anchor });
      const readings = view(450, 900, [[d.t - 8, 500], [b.t + 5, 850], [c.td - 5, 700]], { lines: warmParcel(humid, P.path, 560), label: 'Humid summer sounding from 850 to 500 mb',
        dots: [{ at: [b.t, 850] }, { at: [b.td, 850] }, { at: [c.t, 700] }, { at: [c.td, 700] }, { at: [d.t, 500] }],
        notes: [note(b.t, 850, `T ${b.t}`, 10, 'start'), note(b.td, 850, `Td ${b.td}`, -10, 'end'), note(c.t, 700, `T ${c.t}`, 10, 'start'), note(c.td, 700, `Td ${c.td}`, -10, 'end'), note(d.t, 500, `T ${d.t}`, 10, 'start')] });
      return {
        id: 'together', level: 'Intermediate', title: 'Putting it together', summary: 'Work through a sounding and compare what the values show.',
        source: `Sources: pp. 83, 91 and 345–346 of ${BOOK} For the K Index and Total Totals, the National Weather Service pages linked from About this site. The soundings are made up for teaching. Your progress is saved only in this browser.`,
        learned: ['Start with moisture and layers, then lift a parcel.', 'Different values describe different things, and they can disagree.', 'No single number forecasts a storm.'],
        steps: [
          turn('Find the LCL', ['This is the humid summer sounding with its parcel path. At about what pressure is the LCL, where the path changes from a dry to a moist adiabat?'], { ...view(780, 1030, [[15, 820], [33, 1000], [20, 1000]], { lines: [guide('mix', mixPts(T.mixingRatio(humid.levels[0].td, 1000), 1000, 800)), ...coldParcel(humid, P.path, 840)], label: 'Humid summer sounding near the ground' }) },
            number('lcl', 'LCL pressure (mb)', Math.round(P.lcl.p), 15, 'mb', `The LCL is at about ${mb(P.lcl.p)}.`, 'Look for where the parcel path meets the mixing ratio line from the dewpoint.')),
          turn('Lifted Index', [`At 500 mb the environment is ${deg(v.at500.air)} and the surface parcel is ${deg(v.at500.parcel)}. What is the Lifted Index?`], tall,
            number('li', 'Lifted Index', v.liftedIndex, 0.5, '', `LI is about ${one(v.liftedIndex)}. The spring storm’s was ${one(sv.liftedIndex)}.`, 'Environment minus parcel.'), { equations: [{ latex: String.raw`\mathrm{LI} = T_{500} - T'_{500}`, plain: 'LI = T500 − T′500' }] }),
          turn('Total Totals', ['Use the readings marked on this sounding.'], readings,
            number('tt', 'Total Totals', t.totalTotals, 0.5, '', `TT is ${one(t.totalTotals)}. The spring storm’s was ${whole(st.totalTotals)}.`, 'T850 plus Td850, minus twice T500.'), { equations: [{ latex: String.raw`\mathrm{TT} = T_{850} + T_{d,850} - 2\,T_{500}`, plain: 'TT = T850 + Td850 − 2 × T500' }] }),
          turn('Which has more CAPE?', [`Which sounding has more CAPE on this site’s intro calculation? The spring storm parcel gets up to about ${warmest(S)} °C warmer than the environmental temperature. This humid parcel gets up to about ${warmest(P)} °C warmer. On average, between its LFC and EL, it also stays closer to the environmental temperature than the storm parcel does.`], tall,
            choice('cape', 'The spring storm sounding', [['The humid summer sounding', 'The humid parcel stays closer to the environmental temperature through much of its depth.']], `The spring storm has about ${whole(S.cape).toLocaleString()} J/kg and the humid summer sounding about ${whole(P.cape).toLocaleString()} J/kg.`)),
          turn('Do the indices agree?', [`The humid sounding has a K Index of about ${whole(t.kIndex)}, against ${whole(st.kIndex)} for the spring storm. Its Total Totals is lower. What should you take from this?`], readings,
            choice('agree', 'Each index measures different things, so they can disagree', [['One of them must be calculated wrongly', 'Both can be right. They use different readings: the K Index, for example, rewards moisture at 700 mb.'], ['The higher number always means worse weather', 'Different indices have different scales and look at different things.']], 'Compare several clues with the whole sounding.')),
          turn('The winter morning', ['The stable winter morning has a lifted surface parcel that stays colder than the environment all the way up. What follows?'],
            view(250, 1050, [[-50, 300], [2, 900], [-8, 1000]], { height: 520, lines: coldParcel(winter, W.path, 560), label: 'Stable winter morning with its parcel path' }),
            choice('winter', 'It has no LFC and no CAPE from this surface parcel', [['It has a very large CAPE', 'CAPE needs a parcel warmer than the environment.'], ['Its LFC is at the ground', 'The parcel is never warmer than the environment, so there is no LFC.']], 'That does not mean no air anywhere in it could rise. It describes this surface parcel.')),
        ],
        recapChart: tall,
      };
    };

    return [chartLesson(), linesLesson(), temperatureLesson(), windLesson(), moistureLesson(), parcelLesson(), risingLesson(),
      virtualLesson(), stabilityLesson(), temperaturesLesson(), heatingLesson(), indicesLesson(), togetherLesson()];
  }

  if (typeof module !== 'undefined') module.exports = build;
  else root.LESSONS = build(root.Thermo, root.SOUNDINGS, root.SkewParams);
})(this);
