const assert = require('assert');
const T = require('./js/thermo.js');
const S = require('./js/soundings.js');
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

near(T.satVapor(20), 23.37, 0.1, 'es(20 C)');
near(T.mixingRatio(20, 1000) * 1000, 14.9, 0.2, 'w at 20 C, 1000 mb');
near(T.dewFromMixingRatio(T.mixingRatio(12, 850), 850), 12, 1e-6, 'dewpoint round trip');
near(T.dryTemp(T.theta(25, 900), 900), 25, 1e-9, 'theta round trip');
near(T.moistTemp(T.moistTemp(20, 1000, 500), 500, 1000), 20, 0.01, 'moist adiabat round trip');
near(T.lcl(20, 20, 1000).p, 1000, 0.01, 'saturated LCL');

for (const s of S) {
  assert.strictEqual(s.levels.length, 19, s.name);
  s.levels.forEach((l, i) => {
    assert.strictEqual(l.p, 1000 - 50 * i);
    assert([l.t, l.td, l.wdir, l.wspd].every(Number.isFinite), s.name);
    assert(l.td <= l.t, `${s.name}: Td > T at ${l.p}`);
  });
  const r = T.parcel(s.levels), fine = T.parcel(s.levels, 0.5);
  near(r.cape, fine.cape, Math.max(10, fine.cape * 0.01), s.name + ' CAPE step size');
  if (r.lfc) assert(r.cin <= 0 && r.lfc <= r.lcl.p + 1e-6 && (!r.el || r.el < r.lfc), s.name);
  console.log(s.name.padEnd(26), 'CAPE', Math.round(r.cape), 'CIN', r.cin === null ? '-' : Math.round(r.cin),
    'LCL', Math.round(r.lcl.p), 'LFC', r.lfc && Math.round(r.lfc), 'EL', r.el && Math.round(r.el));
}
// Moving temperature past the parcel splits the red area. Every red layer counts as CAPE, and all
// the blue from the surface to the EL, including the blue in between, is one CIN total.
const edited = S[0].levels.map(l => ({ ...l }));
edited.find(l => l.p === 500).t += 12;
for (const virtual of [false, true]) {
  const split = T.parcel(edited, 2, { virtual });
  const path = T.parcel(edited, 0.05, { virtual }).path;
  const fineSum = (sign, bottom, ceiling) => {
    let sum = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], mid = Math.sqrt(a.p * b.p), buoy = (a.b + b.b) / 2;
      if (mid <= bottom && mid >= ceiling && buoy * sign > 0) sum += 287.04 * buoy * Math.log(a.p / b.p);
    }
    return sum;
  };
  near(split.cape, fineSum(1, split.lfc, split.el), 3, `split CAPE, virtual ${virtual}`);
  near(split.cin, fineSum(-1, edited[0].p, split.el), 3, `split CIN, virtual ${virtual}`);
  assert(fineSum(-1, split.lfc, split.el) < -5, 'split test setup: there is blue between the red layers');
}
// The correction (used by the Full chart) warms moist air, and here it weakens CIN.
const plain = T.parcel(S[0].levels), corrected = T.parcel(S[0].levels, 2, { virtual: true });
assert(corrected.path[0].cmp > corrected.path[0].t && corrected.cin > plain.cin, 'virtual temperature applied');
// LCL (p. 83 of Wallace and Hobbs, 2006): the parcel keeps its potential temperature, and its saturation
// mixing ratio there equals the mixing ratio it started with. Includes the table's extreme values.
for (const [t, td] of [[28, 21], [-6, -7], [35, 5], [50, -110], [-110, -110], [50, 50], [-40, -90]]) {
  const q = T.lcl(t, td, 1000);
  near(T.theta(q.t, q.p), T.theta(t, 1000), 1e-6, `LCL theta ${t}/${td}`);
  near(T.mixingRatio(q.t, q.p) / T.mixingRatio(td, 1000), 1, 1e-6, `LCL mixing ratio ${t}/${td}`);
}
// Moist ascent satisfies (3.68): summed over fine steps, the change in ln theta matches the
// -Lv dws / (cp T) side.
for (const start of [-10, 10, 30]) {
  let t = start, p = 1000, heat = 0;
  for (let q = 995; q >= 200; q -= 5) {
    const next = T.moistTemp(t, p, q);
    heat -= 2.501e6 / (1005.7 * ((t + next) / 2 + 273.15)) * (T.mixingRatio(next, q) - T.mixingRatio(t, p));
    t = next; p = q;
  }
  near(Math.log(T.theta(t, p) / T.theta(start, 1000)), heat, 2e-5, `(3.68) from ${start} C`);
}
// With allLayers (the Explore Full chart), every warmer layer is CAPE with its own LFC and EL,
// including warm air below the LCL. Surface heating gives the humid day such a layer.
const heated = S[1].levels.map((l, i) => (i === 0 ? { ...l, t: l.t + 12 } : l));
const every = T.parcel(heated, 2, { virtual: true, allLayers: true });
near(every.cape, T.energy(every.path, heated[0].p, every.el || 100, 1), 1e-9, 'all-layer CAPE is all positive area');
assert(every.layers.length >= 1 && every.layers[0].lfc > every.lcl.p, 'a warm layer below the LCL has its own LFC');
const layerSum = every.layers.reduce((sum, layer) => sum + layer.cape, 0);
assert(every.cape - layerSum >= -1e-6 && every.cape - layerSum < 3, 'layers add up to CAPE apart from tiny ones');
// Every line the guide lists needs a sample and a lesson. Loads guide.js without a browser.
{
  const source = require('fs').readFileSync(__dirname + '/js/guide.js', 'utf8')
    .replace('root.SkewGuide = { render, sample };', 'root.guideData = { GROUPS, SAMPLES, LESSONS };');
  const holder = {};
  new Function('SkewChart', 'holder', source.replace('})(this);', '})(holder);'))({}, holder);
  const { GROUPS, SAMPLES, LESSONS } = holder.guideData;
  for (const kind of GROUPS.flatMap(group => group[1])) assert(SAMPLES[kind] && LESSONS[kind], `guide entry ${kind}`);
}
// Practice and Test share their content. The test must keep covering every subject.
const Q = require('./js/quiz-data.js');
const quizItems = Q.testItems(S[0]);
// Each question must have exactly one choice that its fingerprint accepts.
for (const item of Q.QUESTIONS) {
  assert.strictEqual(item.choices.filter(choice => Q.isCorrect(item, choice)).length, 1, `one right choice: ${item.q}`);
}
const countOf = type => quizItems.filter(item => item.type === type).length;
assert.strictEqual(quizItems.length, 31, 'test length');
assert(countOf('choice') === 12 && countOf('find') === 13 && countOf('plot') === 6, 'test mix');
assert.strictEqual(quizItems.filter(item => item.type === 'plot' && item.key === 't').length, 3, 'temperature points');
assert.strictEqual(new Set(quizItems.filter(item => item.type === 'find').map(item => item.kind)).size, 13, 'every feature');
for (const item of quizItems) assert(Q.TOPICS[item.topic], 'known topic');
for (const topic of Object.keys(Q.TOPICS)) assert(quizItems.some(item => item.topic === topic), `topic covered: ${topic}`);
for (const sounding of S) assert.strictEqual(Q.plotItems(sounding).length, 12, sounding.name + ' plot points');
console.log('all checks passed');
