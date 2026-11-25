// Sounding thermodynamics. Temperatures are in °C and pressures in mb unless noted.
(function (root) {
  'use strict';
  const RD = 287.04, CP = 1005.7, LV = 2.501e6, EPS = 0.622, G = 9.80665;
  const KAPPA = RD / CP, K = 273.15;

  // Saturation vapor pressure (Bolton 1980; not from Wallace and Hobbs) and its inverse.
  const satVapor = t => 6.112 * Math.exp((17.67 * t) / (t + 243.5));
  const dewFromVapor = e => {
    const l = Math.log(e / 6.112);
    return (243.5 * l) / (17.67 - l);
  };
  // Mixing ratios are in kg/kg.
  const mixingRatio = (td, p) => (EPS * satVapor(td)) / (p - satVapor(td));
  const dewFromMixingRatio = (w, p) => dewFromVapor((w * p) / (EPS + w));
  const virtualTemp = (t, w) => (t + K) * (1 + w / EPS) / (1 + w) - K;

  // Potential temperature in K, and the temperature along a dry adiabat.
  const theta = (t, p) => (t + K) * Math.pow(1000 / p, KAPPA);
  const dryTemp = (th, p) => th * Math.pow(p / 1000, KAPPA) - K;

  // Moist adiabat from Wallace and Hobbs (3.68): -(Lv / (cp T)) dws = dθ / θ, with θ from (3.54).
  // Follows it from (t0, p0) to p1 in small pressure steps, using each step's average temperature for T.
  // Each step is solved for the new temperature with Newton's method.
  function moistTemp(t0, p0, p1) {
    const n = Math.max(1, Math.ceil(Math.abs(p0 - p1) / 10));
    let t = t0, p = p0;
    for (let i = 1; i <= n; i++) {
      const q = p0 * Math.pow(p1 / p0, i / n), th = theta(t, p), ws = mixingRatio(t, p);
      // Zero when the change in ln θ matches the heat released by condensation.
      const mismatch = x => Math.log(theta(x, q) / th) + (LV / (CP * ((t + x) / 2 + K))) * (mixingRatio(x, q) - ws);
      let x = t;
      for (let k = 0; k < 30; k++) {
        const change = mismatch(x) / ((mismatch(x + 1e-5) - mismatch(x - 1e-5)) / 2e-5);
        x -= change;
        if (Math.abs(change) < 1e-9) break;
      }
      t = x; p = q;
    }
    return t;
  }

  // Lifting condensation level, found as on p. 83 of Wallace and Hobbs (2006): where the dry adiabat through
  // (t, p) meets the saturation mixing ratio line through (td, p).
  function lcl(t, td, p) {
    const w = mixingRatio(td, p), th = theta(t, p);
    if (t - td < 1e-9) return { t, p };
    const saturated = q => mixingRatio(dryTemp(th, q), q) < w;
    // Step upward until past the crossing, then halve the interval around it.
    let below = p, above = p;
    do { below = above; above *= 0.8; } while (!saturated(above) && above > 1);
    for (let i = 0; i < 50; i++) {
      const mid = (below + above) / 2;
      if (saturated(mid)) above = mid;
      else below = mid;
    }
    const q = (below + above) / 2;
    return { t: dryTemp(th, q), p: q };
  }

  // Linear interpolation in ln p. levels are ordered surface first.
  function interp(levels, key, p) {
    for (let i = 0; i < levels.length - 1; i++) {
      const a = levels[i], b = levels[i + 1];
      if (p <= a.p && p >= b.p) {
        const f = Math.log(p / a.p) / Math.log(b.p / a.p);
        return a[key] + f * (b[key] - a[key]);
      }
    }
    return null;
  }

  // Hypsometric height above the lowest level, in meters.
  function heights(levels) {
    const z = [0];
    for (let i = 1; i < levels.length; i++) {
      const a = levels[i - 1], b = levels[i];
      const tv = (virtualTemp(a.t, mixingRatio(a.td, a.p)) +
                  virtualTemp(b.t, mixingRatio(b.td, b.p))) / 2 + K;
      z.push(z[i - 1] + (RD * tv / G) * Math.log(a.p / b.p));
    }
    return z;
  }

  // The pressure where buoyancy passes through zero between two path points, linear in ln p.
  const zeroCrossing = (a, b) => a.p * Math.pow(b.p / a.p, a.b / (a.b - b.b));
  const layerArea = (b1, p1, b2, p2) => RD * ((b1 + b2) / 2) * Math.log(p1 / p2);

  // Warmer-than-surroundings (sign 1) or colder (sign -1) energy in J/kg along a parcel path,
  // from pressure `bottom` up to pressure `ceiling`. The other sign is left out.
  function energy(path, bottom, ceiling, sign) {
    let sum = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      let from = Math.min(a.p, bottom), to = Math.max(b.p, ceiling);
      if (from <= to) continue;
      const at = p => interp([a, b], 'b', p);
      let low = at(from), high = at(to);
      if (low * sign <= 0 && high * sign <= 0) continue;
      // Where the lines cross inside this step, keep only the part with the wanted sign.
      if (low * sign < 0) { from = zeroCrossing(a, b); low = 0; }
      if (high * sign < 0) { to = zeroCrossing(a, b); high = 0; }
      sum += layerArea(low, from, high, to);
    }
    return sum;
  }

  // Surface-based parcel with CAPE and CIN (J/kg).
  // By default buoyancy compares actual temperatures, so the shading matches the plotted lines.
  // Pass { virtual: true } to apply the virtual temperature (moisture) correction.
  // In each path point, cmp and envCmp are the two temperatures being compared.
  // Pass { allLayers: true } to treat every warmer layer, wherever it is, as CAPE with its own LFC
  // and EL, listed lowest first in out.layers. Otherwise only layers reaching above the LCL count.
  function parcel(levels, step = 2, { virtual = false, allLayers = false } = {}) {
    const sfc = levels[0], top = levels[levels.length - 1].p;
    const base = lcl(sfc.t, sfc.td, sfc.p);
    const w0 = mixingRatio(sfc.td, sfc.p), th = theta(sfc.t, sfc.p);
    const ps = [];
    for (let p = sfc.p; p > top; p -= step) ps.push(p);
    ps.push(top);
    if (base.p < sfc.p && base.p > top) ps.push(base.p);
    ps.sort((a, b) => b - a);

    let mt = base.t, mp = base.p;
    const path = ps.map(p => {
      let t, w;
      if (p >= base.p) {
        t = dryTemp(th, p); w = w0;
      } else {
        mt = moistTemp(mt, mp, p); mp = p;
        t = mt; w = mixingRatio(t, p);
      }
      const envT = interp(levels, 't', p), envTd = interp(levels, 'td', p);
      const cmp = virtual ? virtualTemp(t, w) : t;
      const envCmp = virtual ? virtualTemp(envT, mixingRatio(envTd, p)) : envT;
      return { p, t, cmp, envCmp, b: cmp - envCmp };
    });

    // Split the profile into runs of positive and negative buoyancy.
    const runs = [];
    const add = (sign, p1, p2, e) => {
      const last = runs[runs.length - 1];
      if (last && last.sign === sign) { last.top = p2; last.energy += e; }
      else runs.push({ sign, bottom: p1, top: p2, energy: e });
    };
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      if ((a.b > 0) === (b.b > 0)) {
        add(a.b > 0 ? 1 : -1, a.p, b.p, layerArea(a.b, a.p, b.b, b.p));
      } else {
        const pz = zeroCrossing(a, b);
        add(a.b > 0 ? 1 : -1, a.p, pz, layerArea(a.b, a.p, 0, pz));
        add(b.b > 0 ? 1 : -1, pz, b.p, layerArea(0, pz, b.b, b.p));
      }
    }
    // Buoyant layers that reach above the LCL, lowest first. Very tiny ones don't set the LFC or EL.
    const warm = runs.filter(r => r.sign > 0 && r.energy > 1 && (allLayers || r.top < base.p));
    const out = { path, lcl: base, lfc: null, el: null, layers: [], cape: 0, cin: null };
    if (!warm.length) return out;
    const lowest = warm[0], highest = warm[warm.length - 1];
    out.lfc = allLayers ? lowest.bottom : Math.min(lowest.bottom, base.p);
    out.el = highest.top > top ? highest.top : null; // null: still buoyant at the top of the data
    // CAPE: all the buoyant area from the LFC to the EL (to the top of the data if there is no EL).
    // CIN: all the negative area from the surface to the same ceiling, including any colder layers
    // between warmer ones. Neither total is subtracted from the other.
    const ceiling = out.el ?? top;
    out.cape = energy(path, allLayers ? sfc.p : out.lfc, ceiling, 1);
    if (allLayers) out.layers = warm.map(r => ({ lfc: r.bottom, el: r.top > top ? r.top : null, cape: r.energy }));
    out.cin = energy(path, sfc.p, ceiling, -1);
    return out;
  }

  const api = { satVapor, dewFromVapor, mixingRatio, dewFromMixingRatio, virtualTemp,
                theta, dryTemp, moistTemp, lcl, interp, heights, energy, parcel };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Thermo = api;
})(this);
