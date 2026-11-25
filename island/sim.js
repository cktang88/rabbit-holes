// Island ecology model. Plants, litter and fungi are fields on a tile grid; animals are individuals that eat, move,
// breed in season, hunt, flee and starve. Nothing about the food web is scripted: booms, crashes, cycles and cascades
// come out of these per-species rules. Deterministic for a given island seed and list of releases.
// Usable in the page (window.IslandSim) and in Node (require) for tuning and tests.
(function (root) {
  'use strict';
  const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function rng(seed) { let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
    const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    f.int = (n) => Math.floor(f() * n); return f; }

  const GW = 56, GH = 40, N = GW * GH, TPY = 24; // two ticks a month
  const FOOD = 30;                              // food units in a tile fully covered by one plant
  // ----- species -----
  // Plants and fungi live in fields. Animals: diet [field or prey, preference], bite (food per tick), cost (energy per tick),
  // breeding season [first,last tick of the year], litter, how often a female can breed (ticks), age of maturity, lifespan.
  const SP = [
    { id: 'grass', name: 'Meadow grass', kind: 'plant', group: 6, note: 'Grows fast in spring and summer, dies back in winter. Food for nearly every grazer.' },
    { id: 'flower', name: 'Wildflowers', kind: 'plant', group: 6, note: 'Spread only where pollinated. Without bees they set little seed and slowly fade.' },
    { id: 'shrub', name: 'Bramble & hazel', kind: 'plant', group: 6, note: 'Slow, thorny cover. Rabbits hide in it from foxes; deer and goats browse it.' },
    { id: 'tree', name: 'Oak & willow', kind: 'plant', group: 6, note: 'Very slow. Young trees are browsed by deer and goats; owls nest only near trees; trees hold the riverbanks together.' },
    { id: 'fungi', name: 'Fungi', kind: 'fungus', group: 6, note: 'Rot dead leaves and carcasses back into soil. Without them, the soil slowly starves.' },
    { id: 'bee', name: 'Bumblebees', kind: 'animal', group: 5, diet: [['flower', 1]], bite: .8, cost: .35, wcost: .12, Emax: 10, E0: 7, breedE: 6, bcost: 2.5, litter: [1, 2], season: [5, 12], every: 4, mature: 6, life: 72, speed: 2, crowd: 10, note: 'Pollinators only. Live on nectar, sleep through winter in a cluster.' },
    { id: 'vole', name: 'Field voles', kind: 'animal', group: 10, diet: [['litter', 1], ['grass', .1]], bite: .45, cost: .3, wcost: .25, Emax: 5, E0: 3.5, breedE: 3, bcost: 1.5, litter: [2, 4], season: [2, 18], every: 3, mature: 4, life: 36, speed: 1, crowd: 6, note: 'Tiny seed-eaters that live in the thatch of dead grass. Booming and crashing; food for owls and foxes.' },
    { id: 'rabbit', name: 'Rabbits', kind: 'animal', group: 8, diet: [['grass', 1], ['flower', .25], ['shrub', .1]], bite: 1.3, cost: .7, wcost: .95, Emax: 12, E0: 8, breedE: 7, bcost: 3.5, litter: [2, 4], season: [2, 15], every: 5, mature: 10, life: 96, speed: 1, crowd: 7, shelter: true, note: 'Graze hard and breed harder. Hide under bramble when foxes are near.' },
    { id: 'deer', name: 'Red deer', kind: 'animal', group: 6, diet: [['shrub', 1], ['grass', .9], ['tree', .8]], bite: 4, cost: 1.7, wcost: 2.1, Emax: 60, E0: 45, breedE: 34, bcost: 12, litter: [1, 2], season: [5, 7], every: 24, mature: 24, life: 300, speed: 2, crowd: 6, fear: 'wolf', note: 'Graze, and browse young trees and shrubs. They linger by the river unless something frightens them.' },
    { id: 'goat', name: 'Feral goats', kind: 'animal', group: 6, invasive: true, diet: [['grass', 1], ['shrub', 1], ['tree', .9], ['flower', .8]], bite: 3, cost: 1.5, wcost: 1.7, Emax: 40, E0: 30, breedE: 22, bcost: 8, litter: [1, 2], season: [2, 8], every: 24, mature: 20, life: 260, speed: 2, crowd: 14, fear: 'wolf', herd: true, note: 'Hardy, hungry and fond of anything green; they roam in herds. With nothing to eat them, they strip an island to the rock.' },
    { id: 'fox', name: 'Red foxes', kind: 'animal', group: 4, prey: [['rabbit', .3], ['vole', .2]], cost: .7, wcost: .9, Emax: 22, E0: 16, breedE: 13, bcost: 6, litter: [2, 4], season: [2, 6], every: 24, mature: 24, life: 120, speed: 3, radius: 3, value: { rabbit: 9, vole: 4 }, crowd: 4, fallback: ['shrub', .3], note: 'Hunt rabbits and voles. Their numbers rise and fall a year or two behind the rabbits.' },
    { id: 'owl', name: 'Tawny owls', kind: 'animal', group: 2, prey: [['vole', .3], ['rabbit', .06]], cost: .4, wcost: .5, Emax: 18, E0: 12, breedE: 10, bcost: 5, litter: [1, 3], season: [2, 4], every: 24, mature: 24, life: 220, speed: 3, radius: 4, value: { vole: 3, rabbit: 8 }, crowd: 3, fallback: ['grass', .2], needTrees: true, note: 'Hunt voles at night from a tree. They can only nest where there are trees.' },
    { id: 'wolf', name: 'Grey wolves', kind: 'animal', group: 5, prey: [['deer', .12], ['goat', .14], ['rabbit', .05]], cost: 1.3, wcost: 1.5, Emax: 70, E0: 55, breedE: 46, bcost: 16, litter: [1, 3], season: [3, 5], every: 24, mature: 36, life: 220, speed: 4, radius: 5, value: { deer: 45, goat: 30, rabbit: 8 }, crowd: 5, fallback: ['litter', .6], pack: true, scare: true, note: 'Hunt deer and goats in packs. Deer learn to avoid places wolves pass through.' },
  ];
  const IDX = {}; SP.forEach((s, i) => { s.i = i; IDX[s.id] = i; });
  SP.forEach(s => { if (s.prey) { s.preyOf = {}; for (const [id, p] of s.prey) s.preyOf[IDX[id]] = p; s.refuge = s.id === 'wolf' ? 1 : s.id === 'fox' ? 2 : 3; } });
  const ANIMALS = SP.filter(s => s.kind === 'animal').map(s => s.i);
  const PLANTS = ['grass', 'flower', 'shrub', 'tree', 'fungi'];
  const MAXA = 4000;

  // ----- island -----
  function makeIsland(seed) {
    const r = rng('island:' + seed);
    const lat = (n) => { const g = []; for (let i = 0; i < (n + 2) * (n + 2); i++) g.push(r()); return g; };
    const octs = [[5, .55], [10, .3], [20, .15]].map(([n, a]) => ({ n, a, g: lat(n) }));
    const sm = (t) => t * t * (3 - 2 * t);
    const noise = (x, y) => { let v = 0; for (const o of octs) { const fx = x * o.n, fy = y * o.n, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy), w = o.n + 2;
      const g = (a, b) => o.g[(b + 1) * w + a + 1]; v += o.a * ((g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx) * (1 - ty) + (g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx) * ty); } return v; };
    const e = new Float32Array(N); const ax = .8 + r() * .25, ay = .8 + r() * .25;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const u = x / GW, v = y / GH, dx = (u - .5) / (.5 * ax), dy = (v - .5) / (.5 * ay);
      e[y * GW + x] = noise(u, v) - .95 * Math.pow(dx * dx + dy * dy, 1.2); }
    const sorted = [...e].sort((a, b) => b - a), th = sorted[Math.floor(N * .44)];
    let land = new Uint8Array(N); for (let i = 0; i < N; i++) land[i] = e[i] > th ? 1 : 0;
    // keep the largest island
    const lab = new Int32Array(N).fill(-1); let best = -1, bestN = 0, nl = 0;
    for (let i = 0; i < N; i++) if (land[i] && lab[i] < 0) { const st = [i]; lab[i] = nl; let c = 0; while (st.length) { const j = st.pop(); c++; for (const k of nbr4(j)) if (land[k] && lab[k] < 0) { lab[k] = nl; st.push(k); } } if (c > bestN) { bestN = c; best = nl; } nl++; }
    for (let i = 0; i < N; i++) if (lab[i] !== best) land[i] = 0;
    let lo = 1e9, hi = -1e9; for (let i = 0; i < N; i++) if (land[i]) { lo = Math.min(lo, e[i]); hi = Math.max(hi, e[i]); }
    const elev = new Float32Array(N); for (let i = 0; i < N; i++) elev[i] = land[i] ? (e[i] - lo) / (hi - lo + 1e-9) : 0;
    // a stream from the high ground down to the sea
    const river = new Uint8Array(N); let src = -1; for (let i = 0; i < N; i++) if (land[i] && (src < 0 || elev[i] > elev[src])) src = i;
    { let c = src, guard = 0; const seen = new Set([c]);
      while (land[c] && guard++ < 200) { river[c] = 1; let nb = -1, bv = 1e9; for (const k of nbr4(c)) { if (seen.has(k)) continue; const v = (land[k] ? elev[k] : -1) + r() * .04; if (v < bv) { bv = v; nb = k; } } if (nb < 0) break; seen.add(nb); c = nb; } }
    for (let i = 0; i < N; i++) if (river[i]) land[i] = 0;
    const coast = new Uint8Array(N), bank = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (land[i]) for (const k of nbr8(i)) { if (river[k]) bank[i] = 1; else if (!land[k]) coast[i] = 1; }
    const moist = new Float32Array(N); for (let i = 0; i < N; i++) if (land[i]) { let m = .35 + .5 * noise(1 - (i % GW) / GW, 1 - ((i / GW) | 0) / GH) - .25 * elev[i];
      let dr = 9; for (let j = 0; j < N; j++) if (river[j]) { const d = Math.abs(j % GW - i % GW) + Math.abs(((j / GW) | 0) - ((i / GW) | 0)); if (d < dr) dr = d; }
      m += Math.max(0, .45 - dr * .09); if (coast[i]) m -= .12; moist[i] = Math.max(.08, Math.min(1, m)); }
    const nLand = land.reduce((a, b) => a + b, 0), nBank = bank.reduce((a, b) => a + b, 0);
    return { seed: String(seed), land, elev, river, coast, bank, moist, nLand, nBank };
  }
  function nbr4(i) { const x = i % GW, y = (i / GW) | 0, o = []; if (x > 0) o.push(i - 1); if (x < GW - 1) o.push(i + 1); if (y > 0) o.push(i - GW); if (y < GH - 1) o.push(i + GW); return o; }
  function nbr8(i) { const x = i % GW, y = (i / GW) | 0, o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < GW && b < GH) o.push(b * GW + a); } return o; }

  // ----- a world: an island plus everything living on it -----
  function create(seed, opt = {}) {
    const isl = makeIsland(seed);
    const w = { isl, seed: String(seed), t: 0, r: rng('life:' + seed + (opt.run ? ':' + opt.run : '')), drought: [], actions: [], log: [],
      f: {}, fert: new Float32Array(N), litter: new Float32Array(N), poll: new Float32Array(N), fear: new Float32Array(N),
      sp: new Int8Array(MAXA).fill(-1), x: new Int16Array(MAXA), y: new Int16Array(MAXA), px: new Int16Array(MAXA), py: new Int16Array(MAXA), E: new Float32Array(MAXA), age: new Int16Array(MAXA), fem: new Uint8Array(MAXA), fence: new Uint16Array(N), last: new Int16Array(MAXA), n: 0,
      census: SP.map(() => []), riverHist: [], coverHist: [] };
    for (const p of PLANTS) w.f[p] = new Float32Array(N); w.f.litter = w.litter;
    const rr = rng('soil:' + seed);
    for (let i = 0; i < N; i++) if (isl.land[i]) { w.fert[i] = .75 + rr() * .3 - isl.elev[i] * .2; w.litter[i] = .05; }
    // every island starts with some grass on the lowland and a few trees and brambles on the hills
    if (opt.start !== 'bare') for (let i = 0; i < N; i++) if (isl.land[i]) { const m = isl.moist[i];
      w.f.grass[i] = .25 + .35 * m * rr(); if (rr() < .4 * m) w.f.shrub[i] = .15 + rr() * .35; if (isl.elev[i] > .45 && rr() < .35) w.f.tree[i] = .2 + rr() * .5; if (isl.bank[i] && rr() < .7) w.f.tree[i] = .3 + rr() * .4; }
    if (opt.setup) opt.setup(w);
    return w;
  }
  const P = SP;
  const season = (t) => (t % TPY) / TPY;                       // 0 = start of spring
  const seasonName = (t) => ['Spring', 'Summer', 'Autumn', 'Winter'][Math.floor(season(t) * 4)];
  const isWinter = (t) => season(t) >= .75;
  const inDrought = (w, t = w.t) => w.drought.some(([a, b]) => t >= a * TPY && t < b * TPY);

  function spawn(w, s, i, E, fem) { let k = -1; for (let j = w.n; j < MAXA; j++) if (w.sp[j] < 0) { k = j; break; } if (k < 0) { for (let j = 0; j < w.n; j++) if (w.sp[j] < 0) { k = j; break; } } if (k < 0) return -1;
    w.sp[k] = s; w.x[k] = w.px[k] = i % GW; w.y[k] = w.py[k] = (i / GW) | 0; w.E[k] = E; w.age[k] = 0; w.last[k] = -999; w.fem[k] = fem == null ? (w.r() < .5 ? 1 : 0) : fem; if (k >= w.n) w.n = k + 1; return k; }
  function kill(w, k) { const i = w.y[k] * GW + w.x[k]; w.litter[i] = Math.min(2, w.litter[i] + (P[w.sp[k]].Emax > 30 ? .12 : .02)); w.sp[k] = -1; }

  // Release a group of a species around tile (tx, ty). Recorded so the run can be replayed exactly.
  function release(w, id, tx, ty, rec = true) {
    const s = P[IDX[id]]; if (!s) return 0; const isl = w.isl; let placed = 0; const r = rng(`rel:${w.seed}:${w.t}:${id}:${tx},${ty}`);
    const cells = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = tx + dx, y = ty + dy; if (x < 0 || y < 0 || x >= GW || y >= GH || dx * dx + dy * dy > 5) continue; const i = y * GW + x; if (isl.land[i]) cells.push(i); }
    if (!cells.length) return 0;
    if (s.kind !== 'animal') { for (const i of cells) { const f = w.f[id]; const v = id === 'tree' ? .2 : id === 'shrub' ? .25 : id === 'fungi' ? .3 : .3; f[i] = Math.max(f[i], v); placed++; } }
    else for (let n = 0; n < s.group; n++) { if (spawn(w, s.i, cells[r.int(cells.length)], s.E0, n & 1) >= 0) placed++; }
    if (rec) w.actions.push([w.t, id, tx, ty]);
    return placed;
  }

  // Trap a species around (tx, ty): up to 20 animals within 5 tiles are caught and shipped off the island.
  function trap(w, id, tx, ty, rec = true) { const s = IDX[id]; let n = 0;
    for (let k = 0; k < w.n && n < 30; k++) if (w.sp[k] === s && Math.abs(w.x[k] - tx) <= 6 && Math.abs(w.y[k] - ty) <= 6) { w.sp[k] = -1; n++; }
    if (rec) w.actions.push([w.t, '-' + id, tx, ty]); return n; }
  // Cull: trap whichever animal is most numerous within 5 tiles (up to 20 of it).
  function cull(w, tx, ty, rec = true) { const c = new Array(SP.length).fill(0);
    for (let k = 0; k < w.n; k++) if (w.sp[k] >= 0 && Math.abs(w.x[k] - tx) <= 5 && Math.abs(w.y[k] - ty) <= 5) c[w.sp[k]]++;
    let s = -1; for (let i = 0; i < c.length; i++) if (c[i] && (s < 0 || c[i] > c[s])) s = i; if (s < 0) return 0;
    const n = trap(w, SP[s].id, tx, ty, false); if (rec) w.actions.push([w.t, '-any', tx, ty]); w.lastCull = SP[s].id; return n; }
  // Fence: grazers (rabbits, deer, goats) cannot enter for five years, so the plants inside get a rest.
  const FENCE_T = 5 * TPY;
  function fence(w, tx, ty, rec = true) { let n = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = tx + dx, y = ty + dy; if (x < 0 || y < 0 || x >= GW || y >= GH || dx * dx + dy * dy > 10) continue; const i = y * GW + x; if (w.isl.land[i]) { w.fence[i] = FENCE_T; n++; } }
    if (rec) w.actions.push([w.t, '#fence', tx, ty]); return n; }
  function act(w, a) { const [, id, x, y] = a; return id === '-any' ? cull(w, x, y) : id === '#fence' ? fence(w, x, y) : id[0] === '-' ? trap(w, id.slice(1), x, y) : release(w, id, x, y); }
  const TOOLS = { '-any': { name: 'Cull', note: 'Trap up to 20 of the most numerous animal near where you tap, and ship them off.' }, '#fence': { name: 'Fence', note: 'Fence off a patch for five years: rabbits, deer and goats cannot get in, so the plants inside recover.' } };
  const validId = (id) => typeof id === 'string' && (IDX[id] != null || IDX[id.slice(1)] != null || TOOLS[id] != null);
  // ----- one tick (half a month) -----
  const head = new Int32Array(N), nxt = new Int32Array(MAXA);
  function step(w) {
    const isl = w.isl, f = w.f, G = f.grass, F = f.flower, B = f.shrub, T = f.tree, U = f.fungi, t = w.t, ph = season(t), win = isWinter(t), dr = inDrought(w);
    let g = ph < .7 ? Math.sin(Math.PI * ph / .7) : 0; if (dr) g *= .45;
    const autumnStart = (t % TPY) === Math.floor(TPY * .7);
    // plants, litter and fungi
    for (let i = 0; i < N; i++) { if (!isl.land[i]) continue;
      const m = isl.moist[i], fe = w.fert[i], k = g * fe * (dr ? .4 + .6 * m : .55 + .45 * m);
      const capG = Math.max(.05, (.55 + .45 * m) * (1 - .75 * T[i]) * (1 - .4 * B[i])), capF = (.25 + .35 * m) * (1 - .8 * T[i]) * (1 - .3 * B[i]), capB = .25 + .55 * m * (1 - .5 * T[i]), capT = .2 + .8 * m;
      const nb = nbr4(i); let nG = 0, nF = 0, nB = 0, nT = 0, nU = 0; for (const j of nb) { nG += G[j]; nF += F[j]; nB += B[j]; nT += T[j]; nU += U[j]; } const q = 1 / nb.length; nG *= q; nF *= q; nB *= q; nT *= q; nU *= q;
      const pol = Math.min(1, w.poll[i]);
      const dG = k * (.2 * G[i] * (1 - (G[i] + .5 * F[i]) / capG) + .012 * nG + (G[i] > 0 || nG > 0 ? .018 * Math.max(0, 1 - (G[i] + .5 * F[i]) / capG) : 0));   // + regrowth from roots and the seed bank
      const dF = (.08 + .2 * pol) * k * F[i] * (1 - (F[i] + .12 * G[i]) / capF) + (.006 + .2 * pol) * k * nF;
      const dB = .035 * k * B[i] * (1 - B[i] / capB) + .0015 * k * nB;
      const dT = .02 * k * T[i] * (1 - T[i] / capT) + .002 * k * nT + (T[i] < .35 && (nT > .05 || isl.bank[i]) ? .006 * k * m : 0);   // + seedlings (willows sprout along the water)
      G[i] = Math.max(0, G[i] + dG); F[i] = Math.max(0, F[i] + dF); B[i] = Math.max(0, B[i] + dB); T[i] = Math.max(0, T[i] + dT);
      w.fert[i] = Math.max(.15, w.fert[i] - .05 * Math.max(0, dG + dF + dB + dT));   // growth draws on the soil
      if (autumnStart) { const dl = .35 * G[i] + .5 * F[i] + .05 * B[i] + .02 * T[i]; G[i] *= .65; F[i] *= .72; B[i] *= .98; T[i] *= .98; w.litter[i] = Math.min(2, w.litter[i] + dl * .6); }
      // rot: slow on its own, fast with fungi; it gives the nutrients back
      const rot = w.litter[i] * (.0015 + .05 * U[i] * (.4 + .6 * m)); w.litter[i] -= rot; w.fert[i] = Math.min(1.25, w.fert[i] + rot * .55);
      U[i] = Math.max(0, U[i] + .08 * U[i] * (Math.min(1, w.litter[i] * 4) * (.3 + .7 * m) - U[i]) + .01 * nU * Math.min(1, w.litter[i] * 4) - .004 * U[i]);
      // bare ground washes away in the autumn and winter rains
      const cover = G[i] + F[i] + B[i] + T[i]; if (cover < .08 && ph > .6) w.fert[i] = Math.max(.15, w.fert[i] - .006 * (1 + isl.elev[i]));
      w.poll[i] *= .75; w.fear[i] *= .8; if (w.fence[i]) w.fence[i]--;
    }
    // animals
    head.fill(-1); for (let k = 0; k < w.n; k++) if (w.sp[k] >= 0) { const i = w.y[k] * GW + w.x[k]; nxt[k] = head[i]; head[i] = k; }
    const r = w.r, n = w.n;
    for (let k = 0; k < n; k++) { const s = w.sp[k]; if (s < 0) continue; const S = P[s]; w.px[k] = w.x[k]; w.py[k] = w.y[k];
      w.age[k]++; if (w.age[k] > S.life) { kill(w, k); continue; }
      const cold = win && s !== IDX.bee ? S.wcost : (win ? S.wcost : S.cost);
      w.E[k] -= cold * (w.age[k] < S.mature ? .8 : 1);
      let i = w.y[k] * GW + w.x[k];
      if (S.prey) i = hunt(w, k, S, i);
      else if (s === IDX.bee) i = bee(w, k, S, i, win);
      else i = graze(w, k, S, i);
      if (w.E[k] <= 0) { kill(w, k); continue; }
      if (w.E[k] > S.Emax) w.E[k] = S.Emax;
      // breeding: in season, well fed, grown up, with a mate close by, and not too crowded
      const tm = t % TPY;
      if (tm >= S.season[0] && tm <= S.season[1] && w.age[k] >= S.mature && w.E[k] >= S.breedE && t - w.last[k] >= S.every) {
        let mates = 0, crowd = 0; const x0 = w.x[k], y0 = w.y[k];
        const MR = S.speed >= 2 ? 5 : 2;   // wide-ranging animals find mates further off
        for (let dy = -MR; dy <= MR; dy++) for (let dx = -MR; dx <= MR; dx++) { const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; const near = S.prey ? true : Math.abs(dx) <= 2 && Math.abs(dy) <= 2; /* hunters hold wide territories */ for (let j = head[y * GW + x]; j >= 0; j = nxt[j]) if (w.sp[j] === s && j !== k) { if (near) crowd++; if (w.age[j] >= S.mature && !w.fem[j]) mates++; } }
        let ok = mates > 0 && crowd < S.crowd;
        if (ok && S.needTrees) { let tc = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = x0 + dx, y = y0 + dy; if (x >= 0 && y >= 0 && x < GW && y < GH) tc += T[y * GW + x]; } ok = tc >= .8; }
        if (ok && w.fem[k]) { // females give birth, if a grown male is about
          const nb = S.litter[0] + r.int(S.litter[1] - S.litter[0] + 1); w.last[k] = t; w.E[k] -= S.bcost;
          for (let c = 0; c < nb; c++) spawn(w, s, i, S.bcost * .8); }
      }
    }
    while (w.n > 0 && w.sp[w.n - 1] < 0) w.n--;
    w.t++;
    census(w);
  }
  const FLOOR = { grass: .03, flower: .04, shrub: .05, tree: .04, litter: .04 };   // roots and woody stems the grazers cannot finish
  // trees: saplings (low cover) can be browsed right down; grown trees only lose their low branches
  const browse = (d, v) => d === 'tree' ? (v < .35 ? v - FLOOR.tree : .03) : v - FLOOR[d];
  function foodAt(w, S, i) { let v = 0; for (const [d, p] of S.diet) v += p * Math.max(0, browse(d, w.f[d][i])); return v; }
  function moveTo(w, k, i) { w.x[k] = i % GW; w.y[k] = (i / GW) | 0; return i; }
  function graze(w, k, S, i) {
    const r = w.r, isl = w.isl; const fearful = S.fear === 'wolf';
    // look at a few tiles within reach; pick the best food, keeping away from wolves (deer, goats) and towards cover (rabbits near foxes)
    let best = i, bv = -1e9; const fenced = S.id !== 'vole';
    for (let c = 0; c < 5; c++) { let j = i; if (c) { const dx = r.int(2 * S.speed + 1) - S.speed, dy = r.int(2 * S.speed + 1) - S.speed, x = w.x[k] + dx, y = w.y[k] + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; j = y * GW + x; if (!isl.land[j]) continue; }
      if (fenced && w.fence[j]) continue;   /* the fence keeps grazers out */
      let v = foodAt(w, S, j) + r() * .05; if (fearful) v -= 1.6 * w.fear[j]; if (S.shelter) v += .3 * Math.min(.4, w.f.shrub[j]);
      if (S.herd && c) { let h = 0; for (let q = head[j]; q >= 0 && h < 6; q = nxt[q]) if (w.sp[q] === S.i) h++; v += .06 * h; }   /* goats keep together in herds */
      if (S === P[IDX.deer] && isl.bank[j] && w.fear[j] < .2) v += .15;   // deer love the lush riverbanks, if it is safe
      if (v > bv) { bv = v; best = j; } }
    if (fenced && w.fence[best]) { for (const j of nbr8(best)) if (!w.fence[j] && isl.land[j]) { best = j; break; } }   // pushed out of a new fence
    i = moveTo(w, k, best);
    let want = Math.min(S.bite, S.Emax - w.E[k] + S.cost);
    for (const [d, p] of S.diet) { if (want <= 0) break; const fl = w.f[d]; const avail = Math.max(0, browse(d, fl[i])) * FOOD * .5 * p; const take = Math.min(want, avail); fl[i] -= (d === 'tree' && fl[i] >= .35 ? .3 : 1) * take / FOOD;   /* a grown tree only loses bark and low leaves */ want -= take; w.E[k] += take; }
    return i;
  }
  function bee(w, k, S, i, win) {
    if (win) return i;                                   // asleep in the nest
    const r = w.r; let best = i, bv = -1;
    for (let c = 0; c < 6; c++) { const x = w.x[k] + r.int(7) - 3, y = w.y[k] + r.int(7) - 3; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; const j = y * GW + x; if (!w.isl.land[j]) continue; const v = w.f.flower[j] + r() * .02; if (v > bv) { bv = v; best = j; } }
    i = moveTo(w, k, best); const fl = w.f.flower[i]; w.E[k] += Math.min(S.bite, fl * 2.2);
    w.poll[i] += 1; for (const j of nbr8(i)) w.poll[j] += .5;
    return i;
  }
  function hunt(w, k, S, i) {
    const r = w.r, isl = w.isl, R = S.radius;
    if (S.needTrees && w.f.tree[i] < .25) i = wander(w, k, S, i);   // an owl without a perch flies off to find one
    const x0 = w.x[k], y0 = w.y[k];
    if (S.scare) { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = x0 + dx, y = y0 + dy; if (x >= 0 && y >= 0 && x < GW && y < GH) w.fear[y * GW + x] += 1 / (1 + Math.abs(dx) + Math.abs(dy)); } }
    if (w.E[k] < S.Emax * .85) {
      // look over the hunting range, then try for one of the animals seen. Scarce prey are wary and hard to find,
      // so success falls off when few are about: the first few in any patch are safe (this is what lets prey hang on).
      const D = 2 * R + 1; let seen = 0, pick = -1, pj = -1;
      for (let a = 0; a < D * D; a++) { const x = x0 + a % D - R, y = y0 + ((a / D) | 0) - R; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; const j = y * GW + x;
        for (let q = head[j]; q >= 0; q = nxt[q]) { const ps = w.sp[q]; if (ps < 0 || !S.preyOf[ps]) continue; seen++; if (r() * seen < 1) { pick = q; pj = j; } } }
      if (pick >= 0) { const q = pick, j = pj, ps = w.sp[q];
        let p = S.preyOf[ps] * Math.max(0, (seen - S.refuge) / seen);   /* the first few in any patch are safe in burrows, dens and long grass */ if (P[ps].shelter) p *= 1 - .92 * Math.min(1, w.f.shrub[j] * 2.5); if (P[ps].id === 'rabbit' && S.id === 'owl' && w.age[q] > 12) p = 0;
        if (P[ps].Emax >= 40) p *= w.age[q] < P[ps].mature ? 1.3 : Math.max(.35, Math.min(1, 1.5 - 1.4 * w.E[q] / P[ps].Emax));   // big prey: the young, the old and the starving are caught
        if (!S.needTrees) moveTo(w, k, j);   /* owls swoop from a perch and fly back to it */
        if (r() < p) { w.E[k] += S.value[P[ps].id]; kill(w, q); } return S.needTrees ? i : j; }
    }
    // nothing caught: the lean-season standbys (berries and beetles for foxes, carrion for wolves, moths for owls)
    if (S.fallback && w.E[k] < S.Emax * .85) { const [d, bite] = S.fallback, fl = w.f[d]; const take = Math.min(bite, Math.max(0, fl[i] - FLOOR[d]) * FOOD * .3); fl[i] -= take / FOOD; w.E[k] += take; }
    return wander(w, k, S, i);
  }
  // wander (wolves keep with the pack, owls keep to the trees and to each other)
  function wander(w, k, S, i) {
    const r = w.r, isl = w.isl, x0 = w.x[k], y0 = w.y[k];
    let best = i, bv = -1e9;
    for (let c = 0; c < 4; c++) { const x = x0 + r.int(2 * S.speed + 1) - S.speed, y = y0 + r.int(2 * S.speed + 1) - S.speed; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; const j = y * GW + x; if (!isl.land[j]) continue;
      let v = r(); if (S.needTrees) v += w.f.tree[j] * 1.5; if (S.scare && isl.bank[j]) v += .5; /* wolves travel the river corridors */ for (let q = head[j]; q >= 0; q = nxt[q]) if (w.sp[q] === S.i && q !== k) v += S.pack || S.needTrees ? .4 : .15; if (v > bv) { bv = v; best = j; } }
    return moveTo(w, k, best);
  }
  // ----- census -----
  function counts(w) { const c = new Array(SP.length).fill(0); for (let k = 0; k < w.n; k++) if (w.sp[k] >= 0) c[w.sp[k]]++;
    for (const p of PLANTS) { const fl = w.f[p]; let s = 0; for (let i = 0; i < N; i++) s += fl[i]; c[IDX[p]] = s / w.isl.nLand; } return c; }
  function census(w) { const c = counts(w); for (let s = 0; s < SP.length; s++) w.census[s].push(c[s]);
    let rv = 0; for (let i = 0; i < N; i++) if (w.isl.bank[i]) rv += Math.min(1, w.f.tree[i] + .5 * w.f.shrub[i]); w.riverHist.push(rv / Math.max(1, w.isl.nBank));
    let cov = 0; for (let i = 0; i < N; i++) if (w.isl.land[i]) cov += Math.min(1, w.f.grass[i] + w.f.flower[i] + w.f.shrub[i] + w.f.tree[i]); w.coverHist.push(cov / w.isl.nLand);
    w.last_counts = c; }
  const PRESENT = .004;   // a plant counts as established above 0.4% average cover
  function present(w, s, c = w.last_counts) { if (!c) return false; return SP[s].kind === 'animal' ? c[s] >= 2 : c[s] >= PRESENT; }
  function presentAt(w, s, t) { const v = w.census[s][t]; return v != null && (SP[s].kind === 'animal' ? v >= 2 : v >= PRESENT); }
  function speciesCount(w, t = w.census[0].length - 1) { let n = 0; for (let s = 0; s < SP.length; s++) if (SP[s].id !== 'goat' && presentAt(w, s, t)) n++; return n; }
  // replay: rebuild a world from a seed, options and the list of releases, up to tick t
  function replay(seed, actions, t, opt) { const w = create(seed, opt); const acts = [...actions].sort((a, b) => a[0] - b[0]); let ai = 0;
    while (w.t < t) { while (ai < acts.length && acts[ai][0] <= w.t) act(w, acts[ai++]); step(w); } return w; }
  // ----- commissions -----
  // Each: an island seed, what you may introduce, how many releases (permits), how long, the starting state and the goal.
  // goal(w) is checked at every year's end: 'won', 'lost' or a progress line.
  const yr = (w) => Math.floor(w.t / TPY);
  const cnt = (w, id) => (w.last_counts || counts(w))[IDX[id]];
  function scatter(w, id, n, tag) { const r = rng('scatter:' + w.seed + tag); const L = []; for (let i = 0; i < N; i++) if (w.isl.land[i]) L.push(i);
    for (let k = 0; k < n; k++) { const j = spawn(w, IDX[id], L[r.int(L.length)], P[IDX[id]].E0, k & 1); if (j >= 0) w.age[j] = P[IDX[id]].mature + r.int(60); } }
  // the fox swing: 0 rising, 1 a peak of 6+ seen, 2 crashed to 60% of the peak or less, 3 recovered to 1.5x the trough (and +4)
  function swing(f) { let pk = 0, tr = Infinity, st = 0; for (const v of f) { if (st < 2) { if (v > pk) pk = v; if (pk >= 6) st = 1; if (pk >= 6 && v <= .6 * pk) { st = 2; tr = v; } } else { if (v < tr) tr = v; if (v >= Math.max(tr * 1.5, tr + 4)) return 3; } } return st; }
  const ALL = SP.map(s => s.id).filter(x => x !== 'goat');
  const SCEN = [
    { id: 'meadow', title: 'A meadow for rabbits', seed: 'meadow', years: 9, permits: 4, species: ['rabbit', 'fox', 'shrub'],
      brief: 'This island has grass and nothing that eats it. The warden wants rabbits on it, and still a meadow worth the name: in year 8, twenty rabbits or more and grass over 12% of the island. Rabbits alone eat a meadow to the bone.',
      goal: (w) => { const y = yr(w), r = cnt(w, 'rabbit'), g = cnt(w, 'grass'); if (y >= 8 && r >= 20 && g >= .12) return 'won'; if (y >= 9) return 'lost'; return `Rabbits ${r}; grass ${(g * 100).toFixed(0)}% (12% wanted). Year ${y} of 8.`; } },
    { id: 'cycle', title: 'Boom and bust', seed: 'cycle', years: 30, permits: 6, species: ['rabbit', 'vole', 'shrub', 'fox', 'owl'],
      brief: 'Establish foxes and rabbits together and keep both for twenty years running, long enough to see the foxes boom, crash by at least 40%, and come back half as many again.',
      goal: (w) => { const y = yr(w); const ra = w.census[IDX.rabbit], fo = w.census[IDX.fox]; let run = 0, f = [];
        for (let k = TPY - 1; k < ra.length; k += TPY) { if (ra[k] >= 2 && fo[k] >= 2) { run++; f.push(fo[k]); } else { run = 0; f = []; } }
        const s = swing(f); if (run >= 20 && s === 3) return 'won'; if (y >= 30) return 'lost';
        return `Together for ${run} year${run === 1 ? '' : 's'} of 20. Foxes: ${['still rising', 'have peaked; waiting for the crash', 'crashed; waiting for them to recover', 'boomed, crashed and recovered'][s]}.`; } },
    { id: 'bees', title: 'The bee meadow', seed: 'bees', years: 15, permits: 5, species: ['flower', 'bee', 'shrub', 'rabbit', 'fox'],
      brief: 'The botanical society wants a wildflower meadow: flowers over 3% of the island, with bees working them, within fifteen years.',
      goal: (w) => { const y = yr(w), f = cnt(w, 'flower'); if (f >= .03 && cnt(w, 'bee') >= 2) return 'won'; if (y >= 15) return 'lost'; return `Wildflowers cover ${(f * 100).toFixed(1)}% of 3%.`; } },
    { id: 'river', title: 'Wolves change the rivers', seed: 'river', years: 20, permits: 5, species: ['wolf', 'tree', 'shrub', 'rabbit', 'fox', 'deer'],
      setup: (w) => { for (let i = 0; i < N; i++) if (w.isl.bank[i]) { w.f.tree[i] = .04; w.f.shrub[i] = Math.min(w.f.shrub[i], .05); } scatter(w, 'deer', 70, 'river'); },
      brief: 'Seventy deer, no predators, and the riverbanks browsed bare. Bring the riverside woods back to 25% within twenty years, while deer still live here.',
      goal: (w) => { const y = yr(w), rv = w.riverHist.length ? w.riverHist[w.riverHist.length - 1] : 0; if (rv >= .25 && cnt(w, 'deer') >= 5) return 'won'; if (y >= 20) return 'lost'; return `Riverside woods ${(rv * 100).toFixed(0)}% of 25%; deer ${cnt(w, 'deer')}.`; } },
    { id: 'goats', title: 'Goat island', seed: 'goats', years: 25, permits: 10, species: ['grass', 'shrub', 'tree', 'flower', 'rabbit', 'deer', 'fox', 'wolf'], traps: ['goat'],
      setup: (w) => { for (let i = 0; i < N; i++) if (w.isl.land[i]) { w.f.grass[i] *= .3; w.f.shrub[i] = 0; w.f.tree[i] *= .4; w.fert[i] *= .8; } scatter(w, 'goat', 60, 'goats'); },
      brief: 'Sailors left goats here a century ago. Get green cover back over 45% of the island with no more than three goats left.',
      goal: (w) => { const y = yr(w), c = w.coverHist.length ? w.coverHist[w.coverHist.length - 1] : 0, g = cnt(w, 'goat'); if (c >= .45 && g <= 3) return 'won'; if (y >= 25) return 'lost'; return `Green cover ${(c * 100).toFixed(0)}% of 45%; goats ${g}.`; } },
    { id: 'drought', title: 'The drought decade', seed: 'drought', years: 22, permits: 10, species: ALL, drought: [[8, 18]],
      brief: 'The almanac warns of ten dry years from year 8. Build a web of life that still has seven species in year 22.',
      goal: (w) => { const y = yr(w), n = speciesCount(w); if (y >= 22) return n >= 7 ? 'won' : 'lost'; return `${n} species now.${y >= 8 && y < 18 ? ' Drought!' : y < 8 ? ' The drought comes in year 8.' : ''}`; } },
    { id: 'ten', title: 'Ten species, fifty years', seed: 'ten', years: 50, permits: 16, species: ALL,
      brief: 'The grand commission: an island where ten species live side by side in year fifty.',
      goal: (w) => { const y = yr(w), n = speciesCount(w); if (y >= 50) return n >= 10 ? 'won' : 'lost'; return `${n} species now; ten wanted in year 50.`; } },
  ];
  const SCN = {}; SCEN.forEach(c => SCN[c.id] = c);
  // the daily island: a fresh island each day, every species, 10 releases, scored on species alive after 30 years
  function daily(day) { return { id: 'daily', title: 'Island of ' + day, seed: 'day:' + day, years: 30, permits: 10, species: ALL, daily: true,
    brief: 'Everyone gets this island today. Ten releases; your score is the number of species alive in year 30.',
    goal: (w) => { const y = yr(w), n = speciesCount(w); if (y >= 30) return 'done'; return `${n} species now. Score taken in year 30.`; } }; }
  const sandbox = (seed) => ({ id: 'sandbox', title: 'Free island', seed: 'free:' + seed, years: 200, permits: Infinity, species: SP.map(s => s.id), traps: ['goat', 'rabbit', 'deer'], sandbox: true,
    brief: 'No commission: any species, as many as you like. Watch what happens.', goal: (w) => `${speciesCount(w)} species. Year ${yr(w)}.` });
  function start(c, run) { const w = create(c.seed, { setup: c.setup, run }); if (c.drought) w.drought = c.drought; census(w); return w; }

  const api = { GW, GH, N, TPY, SP, IDX, ANIMALS, PLANTS, MAXA, rng, hashStr, makeIsland, create, step, release, trap, cull, fence, act, TOOLS, validId, SCEN, SCN, daily, sandbox, start, census, counts, present, presentAt, speciesCount, season, seasonName, isWinter, inDrought, replay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.IslandSim = api;
})(typeof window !== 'undefined' ? window : this);
