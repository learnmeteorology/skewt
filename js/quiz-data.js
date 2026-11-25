// Questions and tasks shared by the Practice and Test pages. No page code here, so test.js can check it.
(function (root) {
  'use strict';

  // Test results are grouped by these. study: where to go afterwards, as [link text, address].
  const TOPICS = {
    basics: { name: 'Chart basics and line types', study: [['Learn', 'learn.html'], ['Practice identifying features', 'practice.html?skill=find']] },
    air: { name: 'Temperature, dewpoint and wind', study: [['Learn', 'learn.html'], ['Practice identifying features', 'practice.html?skill=find']] },
    lifting: { name: 'Lifting air', study: [['Learn', 'learn.html'], ['Practice identifying features', 'practice.html?skill=find']] },
    plotting: { name: 'Plotting data', study: [['Practice plotting', 'practice.html?skill=plot']] },
  };

  // Multiple-choice questions, used only by the Test. Choices are listed alphabetically and shuffled
  // when shown. The right one isn't written here: key is a fingerprint that the chosen text is
  // compared with. This keeps answers from being read off the page's code. It is not real security.
  // show: what to highlight on the chart. The questions describe the first (spring storm) sounding.
  const QUESTIONS = [
    { topic: 'basics', q: 'As you move up the chart, what happens to air pressure?',
      choices: ['It decreases', 'It increases', 'It rises, then falls', 'It stays the same'], key: 'd0z9a7' },
    { topic: 'basics', q: 'What kind of line is highlighted?', show: ['isotherm', -10],
      choices: ['Dry adiabat', 'Mixing ratio line', 'Pressure line (isobar)', 'Temperature line (isotherm)'], key: '3sydws' },
    { topic: 'air', q: 'What does the highlighted green line show?', show: ['dew'],
      choices: ['Air temperature', 'Dewpoint', 'The lifted parcel', 'Wind speed'], key: 'qkp1wf' },
    { topic: 'air', q: 'At which of these levels is the air closest to saturation? Compare the red and green lines.', allLabels: true,
      choices: ['200 mb', '500 mb', '850 mb', '950 mb'], key: 'fwo1sh' },
    { topic: 'air', q: 'This wind barb has one flag, one full barb and one half barb. How fast is the wind?', wind: [270, 65],
      choices: ['115 knots', '16 knots', '35 knots', '65 knots'], key: 'njtr0l' },
    { topic: 'basics', q: 'What kind of line is highlighted?', show: ['dry', 320],
      choices: ['Dry adiabat', 'Mixing ratio line', 'Moist adiabat', 'Temperature line (isotherm)'], key: '1yyn0yz' },
    { topic: 'basics', q: 'How does rising air inside a cloud cool, compared with rising air without cloud?',
      choices: ['At exactly the same rate', 'It does not cool', 'More quickly', 'More slowly'], key: 'wxcfv3' },
    { topic: 'lifting', q: 'What does the highlighted blue line show?', show: ['parcel'],
      choices: ['The dewpoint of the surrounding air', 'The freezing level', 'The temperature of a lifted parcel of air', 'The temperature of the surrounding air'], key: 'hu61tf' },
    { topic: 'lifting', q: 'What happens to the lifted parcel at the LCL?', show: ['lcl'],
      choices: ['It becomes saturated, so a cloud can begin to form', 'It becomes warmer than its surroundings for good', 'It reaches the top of the storm', 'It stops containing water vapor'], key: '179c6av' },
    { topic: 'lifting', q: 'What is the highlighted red area called?', show: ['cape'],
      choices: ['CAPE', 'CIN', 'Dewpoint depression', 'LCL'], key: 'wdypau' },
    { topic: 'lifting', q: 'What does the highlighted blue area (CIN) mean for the lifted parcel?', show: ['cin'],
      choices: ['It has no water vapor', 'It is below freezing', 'It is colder than its surroundings and resists rising', 'It is warmer than its surroundings and rises freely'], key: 'nkkdpb' },
    { topic: 'lifting', q: 'Above the LFC, why can the parcel keep rising on its own?', show: ['lfc'],
      choices: ['Air pressure stops changing', 'It is colder than the air around it', 'It is warmer than the air around it', 'The wind pushes it straight up'], key: 'wytivc' },
  ];

  const fingerprint = text => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
    return h.toString(36);
  };
  const isCorrect = (item, choice) => fingerprint(`${item.q}|${choice}`) === item.key;

  // How to refer to whatever the learner picked.
  const NAMES = {
    isobar: 'a pressure line (isobar)', isotherm: 'a temperature line (isotherm)', dry: 'a dry adiabat',
    moist: 'a moist (saturated) adiabat', mix: 'a mixing ratio line', temp: 'the temperature profile (red)',
    dew: 'the dewpoint profile (green)', parcel: 'the lifted parcel path (blue)',
    lcl: 'the LCL', lfc: 'the LFC', el: 'the EL', cape: 'the CAPE area', cin: 'the CIN area',
  };

  // "Identify": the learner picks a line, level or shaded area on the chart. kind is what counts as
  // correct. The LCL, LFC and EL labels are hidden for these.
  const FIND = [
    { topic: 'basics', kind: 'isobar', q: 'Click an isobar (a line of constant pressure).', why: 'Isobars are the flat, horizontal lines.' },
    { topic: 'basics', kind: 'isotherm', q: 'Click an isotherm (a line of constant temperature).', why: 'Isotherms are the straight lines that slant up to the right.' },
    { topic: 'air', kind: 'temp', q: 'Click the line that shows the temperature of the surrounding air.', why: 'The solid red line is the air temperature.' },
    { topic: 'air', kind: 'dew', q: 'Click the dewpoint line.', why: 'The solid green line is the dewpoint. It sits to the left of the temperature.' },
    { topic: 'basics', kind: 'dry', q: 'Click a dry adiabat.', why: 'Dry adiabats are the solid tan lines that curve up toward the left.' },
    { topic: 'basics', kind: 'moist', q: 'Click a saturated (moist) adiabat.', why: 'Moist adiabats are the thin blue lines that alternate long dashes and dots. They show how saturated air cools.' },
    { topic: 'basics', kind: 'mix', q: 'Click a mixing ratio line.', why: 'Mixing ratio lines are the dotted green lines in the lower part of the chart.' },
    { topic: 'lifting', kind: 'parcel', q: 'Click the path of the lifted parcel.', why: 'The parcel path is the thick solid blue line.' },
    { topic: 'lifting', kind: 'lcl', q: 'Click the LCL (lifting condensation level).', why: 'The LCL is the level where the lifted parcel becomes saturated, so above it the parcel path cools more slowly. Levels are the short flat markers on the right side of the chart.' },
    { topic: 'lifting', kind: 'lfc', q: 'Click the LFC (level of free convection).', why: 'The LFC is the level where the lifted parcel becomes warmer than the air around it: the blue parcel path crosses to the warm side of the red line. Levels are the short flat markers on the right side of the chart.' },
    { topic: 'lifting', kind: 'el', q: 'Click the EL (equilibrium level).', why: 'The EL is high up, where the lifted parcel stops being warmer than the air around it. Levels are the short flat markers on the right side of the chart.' },
    { topic: 'lifting', kind: 'cape', q: 'Click the area that shows CAPE.', why: 'CAPE is shaded where the lifted parcel is warmer than the surrounding air, above the LFC.' },
    { topic: 'lifting', kind: 'cin', q: 'Click the area that shows CIN.', why: 'CIN is shaded where the lifted parcel is colder than the surrounding air, below the LFC.' },
  ];

  // "Plot the data": the learner places one temperature or dewpoint at a time.
  const PLOT_LEVELS = [1000, 850, 700, 500, 300, 200];
  const SERIES = { t: { name: 'Temperature', cls: 'temp' }, td: { name: 'Dewpoint', cls: 'dew' } };
  // How to find a temperature line. The numbers along the bottom only go down to -40 °C.
  const findLine = value => (value < -40
    ? `The numbers along the bottom stop at -40 °C. Follow the -40 line up from there, then count slanted lines to its left, 10 °C apart, to reach ${value} °C.`
    : `Then find ${value} °C by following the slanted temperature lines up from the numbers at the bottom.`);
  const plotItems = sounding => ['t', 'td'].flatMap(key => PLOT_LEVELS.map(p => {
    const value = sounding.levels.find(l => l.p === p)[key];
    return { topic: 'plotting', key, p, value, q: `Plot the ${SERIES[key].name.toLowerCase()}: ${value} °C at ${p} mb`,
      why: `Find the flat ${p} mb line. ${findLine(value)}` };
  }));

  const shuffle = list => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  // The test: every question, every feature to identify, and three temperature and three dewpoint points.
  const testItems = sounding => {
    const points = plotItems(sounding);
    const three = key => shuffle(points.filter(item => item.key === key)).slice(0, 3);
    return shuffle([
      ...QUESTIONS.map(item => ({ ...item, type: 'choice' })),
      ...FIND.map(item => ({ ...item, type: 'find' })),
      ...[...three('t'), ...three('td')].map(item => ({ ...item, type: 'plot' })),
    ]);
  };

  const api = { TOPICS, QUESTIONS, isCorrect, NAMES, FIND, PLOT_LEVELS, SERIES, plotItems, shuffle, testItems };
  if (typeof module !== 'undefined') module.exports = api;
  else root.QuizData = api;
})(this);
