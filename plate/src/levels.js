// ============================================================================================
//  COMMISSIONS: each one a world, a measured goal with three pass marks, and a hint.
//  u: east 0..1 (wraps), v: from the north pole 0..1. Sizes in km. Plate speeds in cm/yr.
// ============================================================================================
const PlateLevels = (() => {
  const polar = (age = 90) => [{ seeds: [[.25, .02], [.75, .02]], age, name: 'Arctic' }, { seeds: [[.25, .98], [.75, .98]], age, name: 'Antarctic' }];
  const M = {
    peak: { name: 'highest peak', unit: 'km', get: s => s.peak, fmt: v => v.toFixed(1) },
    arcPeak: { name: 'volcanic arc', unit: 'km', get: s => s.peakSub, fmt: v => Math.max(0, v).toFixed(1) },
    oceanWidth: { name: 'new ocean', unit: 'km', get: s => s.oceanWidth, fmt: v => Math.round(v / 10) * 10 },
    atlantic: { name: 'passive ocean', unit: 'km', get: s => s.activeFrac > .08 ? 0 : s.oceanWidth, fmt: v => Math.round(v / 10) * 10 },
    hotIslands: { name: 'hotspot islands', unit: '', get: s => s.hotIslands, fmt: v => v | 0 },
    arcIslands: { name: 'arc islands', unit: '', get: s => s.arcs.filter(a => a.n >= 2).length, fmt: v => v | 0 },
    transform: { name: 'fault quakes', unit: '', get: s => s.quakes.transform, fmt: v => v | 0 },
    shadow: { name: 'rain-shadow desert', unit: 'M km²', get: s => s.shadowKm2 / 1e6, fmt: v => v.toFixed(2) },
    superFrac: { name: 'land joined', unit: '%', get: s => s.superFrac * 100, fmt: v => v | 0 },
    hold: { name: 'held over 4 km', unit: 'Myr', get: (s, run) => run.hold, fmt: v => v | 0 },
    dock: { name: 'on the mark', unit: '%', get: (s, run) => run.iou * 100, fmt: v => v | 0 },
    wilson: { name: 'cycle', unit: '%', get: (s, run) => run.wil, fmt: v => v | 0 },
    sea: { name: 'sea level', unit: 'm', get: s => s.sea - (s.sea0 || 0), fmt: v => (v > 0 ? '+' : '') + Math.round(v) },
  };
  const L = [
    { id: 'crumple', name: 'Crumple', tag: 'continent meets continent',
      spec: { seed: 11, plates: [{ seeds: [[.3, .45]], name: 'West' }, { seeds: [[.7, .45]], name: 'East' }, ...polar()], conts: [{ u: .435, v: .45, rx: 2500, ry: 2300, plate: 0 }, { u: .565, v: .45, rx: 2500, ry: 2300, plate: 1, ns: 3 }] },
      goal: { m: 'peak', marks: [3, 5, 7] }, hint: [0, 1], cam: [.5, .45, .55], tools: ['push'] },
    { id: 'andes', name: 'Andes', tag: 'ocean dives under a continent',
      spec: { seed: 12, plates: [{ seeds: [[.3, .5]], age: 70, name: 'Nazca' }, { seeds: [[.66, .5]], name: 'South America' }, ...polar()], conts: [{ u: .64, v: .52, rx: 2200, ry: 3400, plate: 1, rot: 8 }] },
      goal: { m: 'arcPeak', marks: [4.5, 5.3, 6] }, hint: [0, 1], cam: [.56, .5, .6], tools: ['push'] },
    { id: 'roof', name: 'Roof of the World', tag: 'subduction stalls; collision does not',
      spec: { seed: 13, plates: [{ seeds: [[.5, .74], [.5, .56]], age: 90, name: 'India' }, { seeds: [[.5, .25], [.25, .3], [.75, .3]], name: 'Asia' }, { seeds: [[.1, .7], [.9, .7]], age: 80, name: 'Africa' }, ...polar(90).slice(0, 1)],
        conts: [{ u: .5, v: .72, rx: 1500, ry: 1700, plate: 0 }, { u: .5, v: .24, rx: 6500, ry: 2400, plate: 1 }] },
      goal: { m: 'peak', marks: [8, 8.8, 9.5] }, hint: [0, 1], cam: [.5, .45, .65], tools: ['push'] },
    { id: 'arc', name: 'Island Arc', tag: 'ocean meets ocean: the older one sinks',
      spec: { seed: 14, plates: [{ seeds: [[.36, .45]], age: 130, name: 'Pacific' }, { seeds: [[.62, .45]], age: 20, name: 'Philippine' }, { seeds: [[.5, .1], [.0, .2]], age: 70 }, { seeds: [[.5, .85], [0, .8]], age: 70 }] },
      goal: { m: 'arcIslands', marks: [6, 12, 18] }, hint: [0, 1], cam: [.5, .45, .6], tools: ['push'] },
    { id: 'rift', name: 'Great Rift', tag: 'tear a continent open', unlock: 'rift',
      spec: { seed: 15, plates: [{ seeds: [[.5, .45]], name: 'Gondwana' }, { seeds: [[.15, .45]], age: 100 }, { seeds: [[.85, .45]], age: 100 }, ...polar()], conts: [{ u: .5, v: .45, rx: 3400, ry: 2600, plate: 0 }] },
      goal: { m: 'oceanWidth', marks: [1000, 1800, 2600] }, hint: [0, 'rift'], cam: [.5, .45, .6], tools: ['push', 'rift'] },
    { id: 'hawaii', name: 'Hotspot', tag: 'a plume stays put; the plate moves', unlock: 'stripes',
      spec: { seed: 16, plates: [{ seeds: [[.5, .45]], age: 80, name: 'Pacific' }, { seeds: [[.1, .45]], age: 60 }, ...polar()], hot: [[.56, .44]] },
      goal: { m: 'hotIslands', marks: [5, 7, 9] }, hint: [0, 'drift'], cam: [.54, .44, .5], tools: ['push'] },
    { id: 'fault', name: 'Transform', tag: 'slide, do not crash',
      spec: { seed: 17, warp: 120, plates: [{ seeds: [[.4, .3], [.4, .6]], age: 40, name: 'Pacific' }, { seeds: [[.6, .3], [.6, .6]], name: 'America' }, ...polar()], conts: [{ u: .6, v: .43, rx: 2200, ry: 3600, plate: 1 }] },
      goal: { m: 'transform', marks: [12, 20, 30] }, hint: [0, 'slide'], cam: [.5, .43, .55], tools: ['push'] },
    { id: 'shadow', name: 'Rain Shadow', tag: 'mountains steal the rain',
      spec: { seed: 18, plates: [{ seeds: [[.3, .3]], age: 60, name: 'Pacific' }, { seeds: [[.62, .3]], name: 'Patagonia' }, { seeds: [[.5, .75]], age: 80 }, ...polar().slice(0, 1)], conts: [{ u: .63, v: .29, rx: 3000, ry: 1800, plate: 1 }] },
      goal: { m: 'shadow', marks: [1, 2, 3] }, hint: [0, 1], cam: [.6, .3, .55], tools: ['push'] },
    { id: 'wilson', name: 'Wilson Cycle', tag: 'open an ocean, then shut it', timed: true,
      spec: { seed: 19, plates: [{ seeds: [[.5, .45]], name: 'Pangaea' }, { seeds: [[.05, .45], [.95, .45]], age: 120, name: 'Panthalassa' }, ...polar()], conts: [{ u: .5, v: .46, rx: 4600, ry: 3000, plate: 0 }] },
      goal: { m: 'wilson', marks: [100, 100, 100], par: [0, 50, 32] }, hint: [0, 'rift'], cam: [.5, .45, .7], tools: ['push', 'rift'] },
    { id: 'india', name: 'India Hits Asia', tag: 'dock a continent on the mark',
      spec: { seed: 20, plates: [{ seeds: [[.45, .8], [.47, .62], [.5, .42, .55], [.4, .44, .7], [.6, .44, .7]], age: 90, name: 'India' }, { seeds: [[.5, .22], [.2, .28], [.8, .28]], name: 'Eurasia' }, { seeds: [[.15, .7], [.85, .72]], age: 80, name: 'Africa' }, ...polar().slice(0, 1)],
        conts: [{ u: .45, v: .8, rx: 1300, ry: 1600, plate: 0, rot: -20, shape: (a, b, r) => r * (1 + .45 * Math.max(0, b)) }, { u: .5, v: .2, rx: 7000, ry: 2300, plate: 1 }] },
      target: { u: .5, v: .445, rx: 1300, ry: 1600, rot: -20 }, need: { m: 'peak', pass: 6 },
      goal: { m: 'dock', marks: [50, 65, 78] }, hint: [0, 'target'], cam: [.5, .55, .7], tools: ['push'] },
    { id: 'pangaea', name: 'Pangaea', tag: 'gather every continent', timed: true,
      spec: { seed: 21, plates: [{ seeds: [[.1, .35]], name: 'A' }, { seeds: [[.32, .62]], name: 'B' }, { seeds: [[.52, .3]], name: 'C' }, { seeds: [[.72, .62]], name: 'D' }, { seeds: [[.9, .3]], name: 'E' }, { seeds: [[.5, .02]], age: 90 }, { seeds: [[.5, .98]], age: 90 }],
        conts: [{ u: .1, v: .35, rx: 1700, ry: 1500, plate: 0 }, { u: .32, v: .62, rx: 1600, ry: 1700, plate: 1 }, { u: .52, v: .32, rx: 1900, ry: 1500, plate: 2 }, { u: .72, v: .62, rx: 1500, ry: 1400, plate: 3 }, { u: .9, v: .32, rx: 1500, ry: 1300, plate: 4 }] },
      goal: { m: 'superFrac', marks: [85, 85, 85], par: [0, 100, 65] }, hint: [0, 2], cam: [.5, .45, 1], tools: ['push', 'rift'] },
    { id: 'old', name: 'Old Mountains', tag: 'rain wears ranges down',
      spec: { seed: 22, plates: [{ seeds: [[.46, .5]], name: 'Laurentia' }, { seeds: [[.56, .5]], name: 'Baltica' }, { seeds: [[.15, .5]], age: 80 }, { seeds: [[.85, .5]], age: 80 }, ...polar()],
        conts: [{ u: .455, v: .5, rx: 1900, ry: 2300, plate: 0 }, { u: .545, v: .5, rx: 1900, ry: 2300, plate: 1, ns: 4 }, { u: .484, v: .5, rx: 450, ry: 1700, add: 40, plate: 0 }] },
      goal: { m: 'hold', marks: [50, 100, 150] }, hint: [0, 1], cam: [.5, .5, .55], tools: ['push', 'rift'] },
  ];
  // the daily: a seeded world and one of the measurable goals, marked harder
  function daily(dateStr) {
    let h = 2166136261; for (let i = 0; i < dateStr.length; i++) { h ^= dateStr.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0; const r = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const np = 6 + (r() * 3 | 0), plates = [], conts = [];
    for (let k = 0; k < np; k++) plates.push({ seeds: [[(k + .2 + .6 * r()) / np, .25 + .5 * r()]], age: 40 + 90 * r() });
    plates.push(...polar());
    const nc = 3 + (r() * 2 | 0);
    for (let k = 0; k < nc; k++) { const p = (k * 2 + (r() * 2 | 0)) % np, s = plates[p].seeds[0]; conts.push({ u: s[0], v: s[1], rx: 1300 + 1300 * r(), ry: 1200 + 1100 * r(), rot: 60 * (r() - .5), plate: p, ns: k }); }
    const oceanPlates = plates.map((_, i) => i).filter(i => i < np && !conts.some(c => c.plate === i));
    const hp = oceanPlates.length ? oceanPlates[0] : 0;
    const hot = [[plates[hp].seeds[0][0] + .02, plates[hp].seeds[0][1]]];
    const goals = [{ m: 'peak', marks: [7.5, 8.5, 9.3] }, { m: 'oceanWidth', marks: [1500, 2300, 3100] }, { m: 'hotIslands', marks: [5, 7, 9] }, { m: 'arcPeak', marks: [5, 5.6, 6.1] }];
    const g = goals[(r() * goals.length) | 0];
    return { id: 'daily', name: 'Daily ' + dateStr, tag: 'the same planet for everyone today', daily: true, spec: { seed: h & 0xffff, plates, conts, hot }, goal: g, hint: null, cam: [.5, .45, 1], tools: ['push', 'rift'] };
  }
  function sandbox(seed = 7) {
    const d = daily('sandbox-' + seed); return { ...d, id: 'sandbox', name: 'Sandbox', tag: 'your planet', daily: false, sandbox: true, goal: null, tools: ['push', 'rift', 'hotspot'] };
  }
  // ---- goal evaluation ----
  function newRun(lv) { return { hold: 0, holdNow: 0, iou: 0, phase: 0, wil: 0, best: 0, passedAt: null, stars: 0, lastT: 0 }; }
  function iou(S, lv) {
    const t = lv.target; if (!t) return 0; const { W, H, N, cellKm } = S, cs = Math.cos((t.rot || 0) * Math.PI / 180), sn = Math.sin((t.rot || 0) * Math.PI / 180);
    let inter = 0, uni = 0;
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0; let dx = x + .5 - t.u * W; dx -= Math.round(dx / W) * W; const dy = y + .5 - t.v * H;
      const a = (dx * cellKm * cs + dy * cellKm * sn) / t.rx, b = (-dx * cellKm * sn + dy * cellKm * cs) / t.ry, inT = a * a + b * b < 1;
      const inI = S.owner[i] === 0 && S.f[i] > .85;
      if (inT && inI) inter++; if (inT || inI) uni++;
    }
    return uni ? inter / uni : 0;
  }
  function inTarget(S, lv, i) { const t = lv.target; if (!t) return 0; const { W, H, cellKm } = S, cs = Math.cos((t.rot || 0) * Math.PI / 180), sn = Math.sin((t.rot || 0) * Math.PI / 180);
    const x = i % W, y = (i / W) | 0; let dx = x + .5 - t.u * W; dx -= Math.round(dx / W) * W; const dy = y + .5 - t.v * H;
    const a = (dx * cellKm * cs + dy * cellKm * sn) / t.rx, b = (-dx * cellKm * sn + dy * cellKm * cs) / t.ry; return Math.sqrt(a * a + b * b); }
  // call about once per simulated Myr; returns {value, frac (0..1 to pass), stars, passed}
  function evaluate(lv, S, st, run) {
    if (!lv.goal) return null;
    const g = lv.goal, m = M[g.m], T = S.time - S.t0, dT = Math.max(0, T - run.lastT); run.lastT = T;
    if (g.m === 'hold') { if (st.peak >= 4) run.holdNow += dT; else run.holdNow = 0; run.hold = Math.max(run.hold, run.holdNow); }
    if (g.m === 'dock') run.iou = iou(S, lv);
    if (g.m === 'wilson') { if (!run.phase && st.oceanWidth >= 1500) run.phase = 1; run.wil = run.phase ? 50 + 50 * Math.min(1, Math.max(0, st.peakCol) / 6) : 50 * Math.min(1, st.oceanWidth / 1500); }
    let v = m.get(st, run);
    let needOk = true; if (lv.need) { needOk = M[lv.need.m].get(st, run) >= lv.need.pass; }
    let stars = 0;
    if (g.par) { if (v >= g.marks[0] && needOk) { stars = 1; if (T <= g.par[1]) stars = 2; if (T <= g.par[2]) stars = 3; } }
    else for (let k = 0; k < 3; k++) if (v >= g.marks[k] && needOk) stars = k + 1;
    if (stars > run.stars) run.stars = stars;
    if (stars && run.passedAt == null) run.passedAt = T;
    run.best = Math.max(run.best, v);
    return { value: v, frac: Math.max(0, Math.min(1, v / g.marks[0])), stars, passed: stars > 0, needOk, T };
  }
  return { LEVELS: L, M, daily, sandbox, newRun, evaluate, iou, inTarget };
})();
if (typeof module !== 'undefined') module.exports = PlateLevels;
