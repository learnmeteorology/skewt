/* global SkewChart */
// "Guide to the lines" on the Explore page: a sample of each line, and in the Full chart view a
// "Learn more" with its theory and math. Equations are LaTeX, typeset by KaTeX.
// Displayed equations come from Wallace and Hobbs (one exception, noted below), which is not always what js/thermo.js and
// js/chart.js calculate. Where it differs, the lesson says so in plain words; keep those up to date.
(function (root) {
  'use strict';
  const { el, text, barb, barbKey } = SkewChart;
  const tex = String.raw;

  // Headings, and the order the lines are listed under them.
  const GROUPS = [
    ['Measurements', ['temp', 'dew', 'wind']],
    ['Background lines', ['isobar', 'isotherm', 'dry', 'moist', 'mix']],
    ['The lifted parcel', ['parcel', 'lcl', 'lfc', 'el']],
    ['Virtual temperature', ['tvair', 'tvparcel']],
    ['Energy areas', ['cape', 'cin']],
  ];

  // What each line looks like. The samples use the chart's own style classes, so their colors and
  // patterns always match the chart in both themes. Each entry: [words, path, class].
  const CURVE = 'M8 30 C22 22 40 20 56 6';
  const AREA = 'M16 31 C10 20 22 10 36 5 C54 14 46 26 16 31Z';
  const SAMPLES = {
    temp: ['Solid red line', CURVE, 'profile temp'],
    dew: ['Solid green line', CURVE, 'profile dew'],
    parcel: ['Thick solid blue line', 'M52 31 C48 20 32 10 8 5', 'profile parcel'],
    isobar: ['Flat gray line', 'M4 18H60', 'bg isobar'],
    isotherm: ['Straight gray line slanting up to the right', 'M16 31 48 5', 'bg isotherm'],
    dry: ['Solid tan curve rising toward the upper left', 'M58 31 C40 27 20 18 6 5', 'bg dry'],
    moist: ['Thin blue line of long dashes and dots', 'M46 33 C46 20 34 10 10 3', 'bg moist'],
    mix: ['Dotted green line, steeply slanted', 'M22 31 42 5', 'bg mix'],
    wind: ['Barb to the right of the chart'],
    cape: ['Pale red area with a solid edge', AREA, 'cape'],
    cin: ['Pale blue area with a solid edge', AREA, 'cin'],
    tvair: ['Dotted red line beside the temperature line', CURVE, 'profile tvair'],
    tvparcel: ['Dotted blue line beside the parcel path', 'M52 31 C48 20 32 10 8 5', 'profile tvparcel'],
    lcl: ['Short gold line labeled LCL', 'M14 26H50', 'marker'],
    lfc: ['Short gold line labeled LFC', 'M14 26H50', 'marker'],
    el: ['Short gold line labeled EL', 'M14 26H50', 'marker'],
  };

  // An equation from the book: LaTeX, plain words to show if KaTeX can't be downloaded, and where it
  // is printed. Displayed equations come from Wallace and Hobbs, Atmospheric Science: An
  // Introductory Survey, 2nd ed. (2006), except the saturation vapor pressure formula, which has
  // source: null and names where it is listed in the sentence before it. Page numbers are printed ones.
  const eq = (latex, plain, source) => ({ latex, plain, source });
  // "where" lists what the symbols in the equations mean: [LaTeX symbol, plain symbol, meaning].
  const where = (...symbols) => ({ symbols });
  const h = title => ({ title });
  const list = (...items) => ({ items });
  // A table of sourced values, and the links to where they come from.
  const table = (caption, head, rows) => ({ table: { caption, head, rows } });
  const sources = (...links) => ({ links });
  // Pictures of the half barb, full barb and flag with their speeds.
  const WIND_KEY = { windKey: true };
  const BOOK = ['Wallace, J. M., and P. V. Hobbs, 2006: Atmospheric Science: An Introductory Survey. 2nd ed. International Geophysics Series, Vol. 92, Academic Press (Elsevier). ISBN 978-0-12-732951-2. Table values from p. 346.'];

  const WS = [tex`w_s = 0.622\,\frac{e_s}{p - e_s}`, 'ws = 0.622 es / (p − es)', 'Unnumbered equation, p. 82'];

  // For the lessons whose equations need kelvin.
  const NEEDS_KELVIN = 'These equations need temperatures in kelvin. To change from °C:';
  const KELVIN = eq(tex`T_{\mathrm{K}} = T_{^\circ\mathrm{C}} + 273.15`, 'K = °C + 273.15', 'Unnumbered relation, p. 63');

  // Each lesson is a list of blocks. A string is a paragraph.
  const LESSONS = {
    temp: [
      h('How to read it'),
      'Follow the red line upward. To read a value, slide down the slanted temperature line from that point to the numbers along the bottom. For values colder than -40 °C, count slanted lines to the left of the -40 line, 10 °C apart.',
      'Air usually gets colder with height. A stretch where it gets warmer instead is called an inversion.',
      h('Between measurements'),
      "This site's examples have a value every 50 mb, joined with straight lines on the chart.",
    ],
    dew: [
      h('How to read it'),
      'The gap between the red and green lines is the dewpoint depression. A small gap means humid air, and a wide gap means dry air. Dewpoint is never higher than temperature on this chart.',
      h('Dewpoint and relative humidity'),
      'The dewpoint is the temperature to which air must be cooled, at constant pressure, to become saturated. That gives the relative humidity, in percent:',
      eq(tex`RH = 100\,\frac{w_s\ (\text{at } T_d,\ p)}{w_s\ (\text{at } T,\ p)}`, 'RH = 100 × ws(at Td and p) / ws(at T and p)', 'Equation (3.65), p. 82'),
      where([tex`T,\ T_d`, 'T, Td', 'temperature and dewpoint'], [tex`w_s`, 'ws', 'saturation mixing ratio'], [tex`p`, 'p', 'pressure']),
      'To find saturation vapor pressure from temperature, this site uses a different formula from equation (3.97), p. 99 of Wallace and Hobbs (2006). It is listed on the NSF NCAR Earth Observing Laboratory’s page of water vapor pressure formulations, linked from About this site. Its other moisture calculations rely on it too.',
      { latex: tex`e_s = 6.112\,\exp\!\left(\frac{17.67\,t}{t + 243.5}\right)`, plain: 'es = 6.112 exp(17.67 t / (t + 243.5))', source: null },
      where([tex`e_s`, 'es', 'saturation vapor pressure over water, in hPa (the same as mb)'], [tex`t`, 't', 'temperature in °C']),
    ],
    wind: [
      h('How to read it'),
      'The long staff points toward where the wind comes from. A flag (filled triangle) is 50 knots, a full barb is 10 and a half barb is 5. Add the marks together. The speed is rounded to the nearest 5 knots, and a small circle means it rounds to zero.',
      WIND_KEY,
      'Direction is in degrees clockwise from north: 0° is from the north, 90° from the east, 180° from the south and 270° from the west.',
    ],
    isobar: [
      h('The "log-P" axis'),
      'Pressure falls as you go up. On this chart, height on the page follows the negative of the logarithm of pressure, so lower pressures sit higher.',
      h('Thickness of a layer'),
      'The hypsometric equation gives the height difference between two pressure levels:',
      eq(tex`Z_2 - Z_1 = \frac{R_d\,\overline{T_v}}{g_0}\,\ln\!\left(\frac{p_1}{p_2}\right)`, 'Z2 − Z1 = (Rd × average Tv / g0) × ln(p1 / p2)', 'Equation (3.29), p. 70'),
      'It uses virtual temperature, because moist air is less dense than dry air. In terms of the mixing ratio:',
      eq(tex`T_v = T\,\frac{w + \varepsilon}{\varepsilon\,(1 + w)}`, 'Tv = T (w + ε) / (ε (1 + w))', 'Exercise 3.7 (unnumbered equation), p. 80'),
      'The temperature in these two equations must be in kelvin. To change from °C:',
      KELVIN,
      where([tex`Z_1,\ Z_2`, 'Z1, Z2', 'heights at the lower and upper levels (pressures p1 and p2)'],
        [tex`\overline{T_v}`, 'average Tv', 'average virtual temperature of the layer, in kelvin'],
        [tex`T`, 'T', 'temperature in kelvin'], [tex`w`, 'w', 'mixing ratio in kg per kg'], [tex`\varepsilon`, 'ε', '0.622'],
        [tex`R_d`, 'Rd', 'gas constant for dry air, 287.04 J/(kg·K) here (Wallace and Hobbs round to 287)'],
        [tex`g_0`, 'g0', 'acceleration due to gravity, 9.80665 m/s² here (Wallace and Hobbs round to 9.81)']),
    ],
    isotherm: [
      h('Why they lean'),
      'On a skew T − ln p chart, lines of equal temperature slope upward to the right. This spreads soundings apart so small differences in slope are easier to see. To read a temperature, follow a slanted line to the numbers along the bottom.',
      h('The math'),
      "The horizontal coordinate x depends on temperature and on the vertical coordinate y:",
      eq(tex`\begin{aligned} x &= T + (\text{constant})\,y \\ &= T - (\text{constant})\,\ln p \end{aligned}`, 'x = T + (constant) y = T − (constant) ln p', 'Equation (3.56), p. 78'),
      where([tex`y`, 'y', '−ln p'], [tex`T`, 'T', 'temperature'], [tex`p`, 'p', 'pressure']),
      'The constant sets how far the lines lean. For one temperature line, T stays fixed, so the line is straight.',
    ],
    dry: [
      h('The idea'),
      'Unsaturated air that rises or sinks without exchanging heat moves along one of these lines. Along it, the potential temperature stays the same: the temperature the air would have if moved to a standard pressure, usually 1000 mb.',
      h("Poisson's equation"),
      eq(tex`\theta = T\left(\frac{p_0}{p}\right)^{R/c_p}`, 'θ = T (p0 / p)^(R/cp)', 'Equation (3.54), p. 78'),
      where([tex`\theta`, 'θ', 'potential temperature, in kelvin'], [tex`T`, 'T', 'temperature, in kelvin'],
        [tex`p_0`, 'p0', '1000 mb'], [tex`R/c_p`, 'R/cp', 'about 0.286 for dry air; this site uses 287.04 / 1005.7, or 0.285']),
      'Poisson’s equation needs temperature in kelvin, and gives θ in kelvin. To change from °C:',
      KELVIN,
      h('How fast the air cools'),
      eq(tex`-\left(\frac{dT}{dz}\right)_{\text{dry parcel}} = \frac{g}{c_p} \equiv \Gamma_d`, '−(dT/dz) for a dry parcel = g / cp = Γd', 'Equation (3.53), p. 77'),
      'This dry adiabatic lapse rate is about 9.8 °C for each kilometer of rise. Sinking air warms at the same rate.',
    ],
    moist: [
      h('The idea'),
      'Saturated air that keeps rising turns water vapor into cloud droplets. That releases heat, so it cools more slowly than dry air. If the droplets fall out right away, the ascent is called pseudoadiabatic.',
      h('Heat released and potential temperature'),
      'As water vapor condenses, the potential temperature rises:',
      eq(tex`-\frac{L_v}{c_p T}\,dw_s = \frac{d\theta}{\theta}`, '−(Lv / (cp T)) dws = dθ / θ', 'Equation (3.68), p. 85'),
      'This leads to the equivalent potential temperature, which stays about the same along one of these lines:',
      eq(tex`\theta_e \simeq \theta\,\exp\!\left(\frac{L_v w_s}{c_p T}\right)`, 'θe ≃ θ exp(Lv ws / (cp T))', 'Equation (3.71), p. 85'),
      where([tex`L_v`, 'Lv', 'latent heat of vaporization'], [tex`c_p`, 'cp', 'specific heat at constant pressure'],
        [tex`w_s`, 'ws', 'saturation mixing ratio in kg per kg'], [tex`T`, 'T', 'temperature in kelvin'], [tex`\theta`, 'θ', 'potential temperature']),
      NEEDS_KELVIN,
      KELVIN,
      h('How this site draws the lines'),
      'It solves equation (3.68), p. 85 of Wallace and Hobbs (2006), together with equation (3.54), p. 78, in small pressure steps, using the average temperature of each step for T. The same method draws the lifted parcel above the LCL. Each line is labeled by its temperature at 1000 mb.',
      'The site does not use equation (3.71), p. 85 of Wallace and Hobbs (2006), to draw the lines.',
    ],
    mix: [
      h('The idea'),
      'The mixing ratio is the mass of water vapor for each mass of dry air. Read these lines at the dewpoint to find how much vapor the air has, or at the temperature to find how much it could hold.',
      h('Definition'),
      eq(tex`w \equiv \frac{m_v}{m_d}`, 'w = mv / md', 'Equation (3.57), p. 80'),
      h('At saturation'),
      eq(...WS),
      'Because the vapor pressure is usually much smaller than the total pressure:',
      eq(tex`w_s \simeq 0.622\,\frac{e_s}{p}`, 'ws ≃ 0.622 es / p', 'Equation (3.63), p. 82'),
      'The vapor pressure of the air can be found from its mixing ratio:',
      eq(tex`e = \frac{w}{w + \varepsilon}\,p`, 'e = (w / (w + ε)) p', 'Equation (3.59), p. 80'),
      where([tex`m_v,\ m_d`, 'mv, md', 'mass of water vapor and of dry air'],
        [tex`w,\ w_s`, 'w, ws', 'mixing ratio and saturation mixing ratio; the chart labels them in g per kg'],
        [tex`e,\ e_s`, 'e, es', 'vapor pressure and saturation vapor pressure'], [tex`p`, 'p', 'total pressure'], [tex`\varepsilon`, 'ε', '0.622']),
      'This site uses the first saturation formula, from p. 82 of Wallace and Hobbs (2006), rather than the approximation.',
    ],
    parcel: [
      h('The parcel idea'),
      'A parcel is a small, imaginary portion of air. Picture one starting at the ground and being pushed upward. It is assumed to be insulated from the air around it, to stay at the same pressure as that air, and to move slowly enough that its energy of motion can be neglected in its energy budget.',
      h('Its path'),
      list('Below the LCL it follows a dry adiabat and keeps the same mixing ratio.',
        'Above the LCL it follows a moist adiabat. This site assumes condensed water leaves right away and nothing freezes.'),
      h('Why it rises or sinks'),
      eq(tex`\frac{d^2 z}{dt^2} = g\left(\frac{T' - T}{T}\right)`, "d²z/dt² = g (T′ − T) / T", 'Equation (3.73), p. 89'),
      where([tex`T'`, 'T′', 'temperature of the parcel, in kelvin'], [tex`T`, 'T', 'temperature of the surrounding air, in kelvin'],
        [tex`z`, 'z', "the parcel's height"], [tex`t`, 't', 'time'], [tex`g`, 'g', 'acceleration due to gravity']),
      'Put both temperatures into this equation in kelvin. To change from °C:',
      KELVIN,
      'A parcel warmer than its surroundings is pushed upward. A colder one is pushed downward. As p. 89 of Wallace and Hobbs (2006) notes, virtual temperature should strictly be used here, and the Full chart does so. Real rising air also mixes with its surroundings.',
    ],
    lcl: [
      h('The idea'),
      'The lifting condensation level is where an unsaturated parcel, lifted without exchanging heat, becomes saturated. A cloud can begin to form here.',
      h('Finding it on the chart (p. 83 of Wallace and Hobbs, 2006)'),
      list('Start at the surface temperature and follow the dry adiabat upward.',
        'Start at the surface dewpoint and follow the saturation mixing ratio line upward.',
        'The LCL is where the two paths cross.'),
      h('How this site finds it'),
      'The computer finds this same crossing by narrowing in on the pressure where the two paths meet.',
    ],
    lfc: [
      h('The idea'),
      'At a level of free convection, a lifted parcel becomes warmer than the air around it and can keep rising without being pushed. Getting there may take energy. (See p. 91 of Wallace and Hobbs, 2006.)',
      h('There can be more than one'),
      'A real sounding can cross the parcel path several times. Each time the parcel becomes warmer again, a new layer begins, with its own LFC at the bottom.',
      h('How this site finds them'),
      list('Every warmer layer that holds more than 1 J/kg gets an LFC at its bottom.',
        'They are numbered from the ground up when there are several.',
        'If there is no such layer, there is no LFC, and no CAPE or CIN is given.'),
      "The comparison uses virtual temperatures. Figure 3.16, p. 91 of Wallace and Hobbs (2006), shows an LFC above the LCL. This site also marks a warmer layer that starts below the LCL, and its 1 J/kg cutoff is its own rule.",
    ],
    el: [
      h('The idea'),
      'An equilibrium level is the level above which the parcel is no longer warmer than its surroundings. (See p. 345 of Wallace and Hobbs, 2006.)',
      h('How this site finds them'),
      list('Each warmer layer has an EL at its top. The chart and results show only the highest one.',
        'If the parcel is still warmer at 100 mb, where the data end, no EL is shown.'),
      'The comparison uses virtual temperatures.',
    ],
    tvair: [
      h('The idea'),
      'Moist air is less dense than dry air at the same temperature and pressure. Virtual temperature is the temperature dry air would need to have the same density, so it is a little higher than the actual temperature.',
      h('The math'),
      eq(tex`T_v = T\,\frac{w + \varepsilon}{\varepsilon\,(1 + w)}`, 'Tv = T (w + ε) / (ε (1 + w))', 'Exercise 3.7 (unnumbered equation), p. 80'),
      where([tex`T,\ T_v`, 'T, Tv', 'temperature and virtual temperature, in kelvin'], [tex`w`, 'w', 'mixing ratio in kg per kg'], [tex`\varepsilon`, 'ε', '0.622']),
      'The temperature in this equation must be in kelvin. To change from °C, use the first equation below. To change the answer back, use the second:',
      KELVIN,
      eq(tex`T_{^\circ\mathrm{C}} = T_{\mathrm{K}} - 273.15`, '°C = K − 273.15', 'The same relation rearranged, p. 63'),
      'For the surrounding air, w comes from the dewpoint. The two lines separate most where the air holds the most water vapor.',
    ],
    tvparcel: [
      h('The idea'),
      'The parcel gets the same correction, so that it is compared fairly with the surrounding air.',
      h('Its moisture'),
      list('Below the LCL, the parcel keeps the mixing ratio it started with.',
        'Above the LCL, it is saturated, so its mixing ratio is the saturation value at its temperature.'),
      'The correction uses the same equation as for the air. See Virtual temperature of the air.',
    ],
    cape: [
      h('The idea'),
      'Convective available potential energy comes from the upward push on a parcel that is warmer than its surroundings. It is measured in J/kg. A sounding can have more than one area of CAPE.',
      h('The math'),
      eq(tex`\text{CAPE} = R_d \int_{\text{EL}}^{\text{LFC}} (T_v' - T_v)\, d\ln p`, 'CAPE = Rd × integral from EL to LFC of (T′v − Tv) d ln p', 'Equation (8.4), p. 345'),
      where([tex`T_v'`, 'T′v', 'virtual temperature of the parcel'], [tex`T_v`, 'Tv', 'virtual temperature of the surrounding air'],
        [tex`R_d`, 'Rd', 'gas constant for dry air'], [tex`p`, 'p', 'pressure; the limits are the pressures at the EL and LFC']),
      'On the Full chart, this is the red area between the two virtual temperature lines.',
      'Equation (8.4), p. 345 of Wallace and Hobbs (2006), is written for one LFC and EL. This site adds every red area, from the surface up to the highest EL. It does not subtract the blue between them. With a single red area, it matches the area (8.4) describes.',
      h('What do the numbers mean?'),
      table('A common guide to CAPE',
        ['CAPE (J/kg)', 'NWS Lincoln, Illinois: instability', 'Wallace and Hobbs (2006), p. 346: deep convection'],
        [['Below 1000', 'Weak', 'Marginal'],
          ['1000 to 2500', 'Moderate', 'Enough for moderate convection'],
          ['2500 to 4000', 'Strong', 'Enough for strong convection'],
          ['Above 4000', 'Extreme', 'Potential for extreme convection']]),
      'These are rough guides, not thresholds. The Weather Service page says the scale depends on location and time of year. A large value does not mean a storm will form.',
      sources(['National Weather Service, Lincoln, Illinois: CAPE', 'https://www.weather.gov/ilx/swop-severetopics-CAPE'], BOOK),
    ],
    // Sources behind this lesson (kept here, not linked on the page):
    // Wallace and Hobbs pp. 346-347: definition, the 100 J/kg reference point, the cap and what lifts air.
    // National Weather Service glossary (forecast.weather.gov/glossary.php?letter=c): "Capping" and
    // "Convective Inhibition", including lift by a front.
    cin: [
      h('Start here: what is CIN?'),
      'Imagine you must push a ball up a small hill before it can roll away on its own. For rising air, convective inhibition (CIN) is like that hill.',
      'Near the ground, a rising parcel (a small, imaginary portion of air) can be colder than the air around it. At the same pressure, colder air is denser, so the parcel tends not to keep rising by itself. Something has to push it up until it reaches a level where it is warmer than its surroundings: the level of free convection (LFC).',
      'CIN is the amount of energy that stands in the way on that climb. It is measured in joules for each kilogram of air (J/kg).',
      h('Reading the number'),
      list('On this chart, CIN is the blue area, written as a negative number.',
        'The farther the number is from zero, the bigger the barrier. A CIN of −150 J/kg is a bigger barrier than −20 J/kg.',
        'The minus sign shows that the energy works against the rising air. People often call CIN "large" or "strong" when it is far below zero.'),
      h('Is CIN good or bad for storms?'),
      'It can work both ways. The barrier, often called a cap, can stop clouds from growing tall. But by holding air back, it can also let a lot of CAPE build up. If that air later gets through, a strong storm can develop.',
      'A vigorous storm setup usually needs some CIN, but not so much that deep convection cannot happen. According to p. 346 of Wallace and Hobbs (2006), when the size of CIN is above 100 J/kg, deep thunderstorms are unlikely without outside help such as daytime heating or a strong front.',
      h('What can break through the cap?'),
      list('Lifting a whole layer of air can weaken the cap itself. Large weather systems can do this.',
        'A push can lift air to its LFC. A cold front or a warm front can do this. So can hills, or a cold outflow boundary: the leading edge of cooled air spreading out from a storm.'),
      'Getting through the barrier does not guarantee a thunderstorm. Rising air still needs enough CAPE, and other conditions matter too.',
    ],
  };

  const make = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  };

  // Typesets one piece of LaTeX into a node, or writes the plain version if KaTeX isn't there.
  function typeset(node, latex, plain, displayMode) {
    if (root.katex) root.katex.render(latex, node, { displayMode, throwOnError: false });
    else node.textContent = plain;
  }

  function windKey() {
    const list = make('ul', 'barbkey');
    list.setAttribute('aria-label', 'What each wind mark means');
    barbKey(list);
    return list;
  }

  function block(item) {
    if (item.windKey) return windKey();
    if (typeof item === 'string') return make('p', '', item);
    if (item.title) return make('h5', '', item.title);
    if (item.items) {
      const ul = make('ul');
      ul.append(...item.items.map(i => make('li', '', i)));
      return ul;
    }
    if (item.symbols) {
      const dl = make('dl', 'symbols');
      for (const [latex, plain, meaning] of item.symbols) {
        const term = make('dt');
        typeset(term, latex, plain, false);
        dl.append(term, make('dd', '', meaning));
      }
      return dl;
    }
    if (item.table) {
      const { caption, head, rows } = item.table, node = make('table', 'ranges'), top = make('tr'), body = make('tbody');
      for (const label of head) {
        const cell = make('th', '', label);
        cell.scope = 'col';
        top.append(cell);
      }
      const header = make('thead');
      header.append(top);
      for (const [first, ...others] of rows) {
        const row = make('tr'), name = make('th', '', first);
        name.scope = 'row';
        row.append(name, ...others.map((value, i) => {
          const cell = make('td', '', value);
          cell.dataset.label = head[i + 1]; // shown beside the value on narrow screens
          return cell;
        }));
        body.append(row);
      }
      node.append(make('caption', '', caption), header, body);
      return node;
    }
    if (item.links) {
      const box = make('div', 'references'), ul = make('ul');
      for (const [label, url] of item.links) {
        const li = make('li');
        if (url) {
          const a = make('a', '', label);
          Object.assign(a, { href: url, target: '_blank', rel: 'noopener' });
          li.append(a);
        } else li.textContent = label;
        ul.append(li);
      }
      box.append(make('strong', '', 'Sources'), ul);
      return box;
    }
    const figure = make('div', 'cited'), box = make('div', 'equation');
    typeset(box, item.latex, item.plain, true);
    figure.append(box);
    if (item.source) figure.append(make('p', 'source', `${item.source} of Wallace and Hobbs (2006)`));
    return figure;
  }

  function sample(kind) {
    const [, d, cls] = SAMPLES[kind];
    const icon = el('svg', { viewBox: '0 0 64 36', class: 'sample', 'aria-hidden': 'true' });
    if (kind === 'wind') barb(icon, 42, 24, 290, 65);
    else el('path', { d, class: cls }, icon);
    if (cls === 'marker') text(icon, 32, 20, kind.toUpperCase(), 'markerlabel');
    return icon;
  }

  function learnMore(kind, name) {
    const details = make('details', 'lesson'), summary = make('summary', '', 'Learn more');
    summary.append(make('span', 'sr-only', ` about ${name}`));
    details.append(summary);
    // Built the first time it opens, by which time KaTeX has had a chance to load.
    details.addEventListener('toggle', () => {
      if (!details.open || details.children.length > 1) return;
      const body = make('div', 'lesson-body');
      body.append(...LESSONS[kind].map(block));
      details.append(body);
    });
    return details;
  }

  function card(kind, [name, meaning], lessons) {
    const item = make('article', 'line-card'), words = make('div');
    words.append(make('h4', '', name), make('p', 'looks', SAMPLES[kind][0]), make('p', '', meaning));
    item.append(sample(kind), words);
    if (lessons) item.append(learnMore(kind, name));
    // The Basic chart has no Learn more, so its wind card shows the pictures directly.
    else if (kind === 'wind') words.append(windKey());
    return item;
  }

  // Lists the lines in view under their headings. names is {kind: [name, short meaning]}.
  function render(container, names, inView, lessons) {
    container.replaceChildren();
    for (const [title, kinds] of GROUPS) {
      const shown = kinds.filter(inView);
      if (!shown.length) continue;
      const group = make('section', 'line-group');
      group.append(make('h3', '', title), ...shown.map(kind => card(kind, names[kind], lessons)));
      container.append(group);
    }
  }

  root.SkewGuide = { render, sample };
})(this);
