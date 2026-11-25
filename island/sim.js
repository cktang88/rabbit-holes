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
    { id: 'bee', name: 'Bumblebees', kind: 'animal', group: 5, diet: [['flower', 1]], bite: .5, cost: .35, wcost: .12, Emax: 10, E0: 7, breedE: 7, bcost: 3, litter: [1, 2], season: [5, 12], every: 4, mature: 6, life: 72, speed: 2, crowd: 7, note: 'Pollinators only. Live on nectar, sleep through winter in a cluster.' },
    { id: 'vole', name: 'Field voles', kind: 'animal', group: 10, diet: [['litter', 1], ['flower', .3], ['grass', .1]], bite: .45, cost: .3, wcost: .25, Emax: 5, E0: 3.5, breedE: 3, bcost: 1.5, litter: [2, 4], season: [2, 18], every: 3, mature: 4, life: 36, speed: 1, crowd: 6, note: 'Tiny seed-eaters that live in the thatch of dead grass. Booming and crashing; food for owls and foxes.' },
    { id: 'rabbit', name: 'Rabbits', kind: 'animal', group: 8, diet: [['grass', 1], ['flower', .25], ['shrub', .1]], bite: 1.3, cost: .7, wcost: .95, Emax: 12, E0: 8, breedE: 7, bcost: 3.5, litter: [2, 4], season: [2, 15], every: 5, mature: 10, life: 96, speed: 1, crowd: 7, shelter: true, note: 'Graze hard and breed harder. Hide under bramble when foxes are near.' },
    { id: 'deer', name: 'Red deer', kind: 'animal', group: 6, diet: [['grass', 1], ['shrub', .8], ['tree', .7]], bite: 3, cost: 1.5, wcost: 1.9, Emax: 60, E0: 45, breedE: 34, bcost: 12, litter: [1, 1], season: [5, 7], every: 24, mature: 24, life: 300, speed: 2, crowd: 6, fear: 'wolf', note: 'Graze, and browse young trees and shrubs. They linger by the river unless something frightens them.' },
    { id: 'goat', name: 'Feral goats', kind: 'animal', group: 6, invasive: true, diet: [['grass', 1], ['shrub', 1], ['tree', .9], ['flower', .8]], bite: 3, cost: 1.5, wcost: 1.7, Emax: 40, E0: 30, breedE: 22, bcost: 8, litter: [1, 2], season: [2, 14], every: 10, mature: 20, life: 260, speed: 2, crowd: 12, fear: 'wolf', note: 'Hardy, hungry and fond of anything green. With nothing to eat them, they strip an island to the rock.' },
    { id: 'fox', name: 'Red foxes', kind: 'animal', group: 4, prey: [['rabbit', .22], ['vole', .3]], cost: .8, wcost: .95, Emax: 18, E0: 14, breedE: 12, bcost: 6, litter: [1, 3], season: [3, 5], every: 24, mature: 24, life: 168, speed: 3, radius: 3, value: { rabbit: 9, vole: 4 }, crowd: 4, note: 'Hunt rabbits and voles. Their numbers rise and fall a year or two behind the rabbits.' },
    { id: 'owl', name: 'Tawny owls', kind: 'animal', group: 2, prey: [['vole', .45], ['rabbit', .06]], cost: .4, wcost: .5, Emax: 18, E0: 12, breedE: 10, bcost: 5, litter: [1, 3], season: [2, 4], every: 24, mature: 24, life: 220, speed: 3, radius: 4, value: { vole: 3, rabbit: 8 }, crowd: 3, needTrees: true, note: 'Hunt voles at night from a tree. They can only nest where there are trees.' },
    { id: 'wolf', name: 'Grey wolves', kind: 'animal', group: 5, prey: [['deer', .14], ['goat', .2], ['rabbit', .05]], cost: 1.1, wcost: 1.3, Emax: 70, E0: 50, breedE: 40, bcost: 18, litter: [2, 4], season: [3, 5], every: 24, mature: 36, life: 220, speed: 4, radius: 5, value: { deer: 45, goat: 30, rabbit: 8 }, crowd: 7, pack: true, scare: true, note: 'Hunt deer and goats in packs. Deer learn to avoid places wolves pass through.' },
  ];
  const IDX = {}; SP.forEach((s, i) => { s.i = i; IDX[s.id] = i; });
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
    const w = { isl, seed: String(seed), t: 0, r: rng('life:' + seed), drought: [], actions: [], log: [],
      f: {}, fert: new Float32Array(N), litter: new Float32Array(N), poll: new Float32Array(N), fear: new Float32Array(N),
      sp: new Int8Array(MAXA).fill(-1), x: new Int16Array(MAXA), y: new Int16Array(MAXA), px: new Int16Array(MAXA), py: new Int16Array(MAXA), E: new Float32Array(MAXA), age: new Int16Array(MAXA), fem: new Uint8Array(MAXA), last: new Int16Array(MAXA), n: 0,
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

  // ----- one tick (half a month) -----
  const head = new Int32Array(N), nxt = new Int32Array(MAXA);
  function step(w) {
    const isl = w.isl, f = w.f, G = f.grass, F = f.flower, B = f.shrub, T = f.tree, U = f.fungi, t = w.t, ph = season(t), win = isWinter(t), dr = inDrought(w);
    let g = ph < .7 ? Math.sin(Math.PI * ph / .7) : 0; if (dr) g *= .3;
    const autumnStart = (t % TPY) === Math.floor(TPY * .7);
    // plants, litter and fungi
    for (let i = 0; i < N; i++) { if (!isl.land[i]) continue;
      const m = isl.moist[i], fe = w.fert[i], k = g * fe * (dr ? .4 + .6 * m : .55 + .45 * m);
      const capG = Math.max(.05, (.55 + .45 * m) * (1 - .75 * T[i]) * (1 - .4 * B[i])), capF = (.25 + .35 * m) * (1 - .8 * T[i]) * (1 - .3 * B[i]), capB = .25 + .55 * m * (1 - .5 * T[i]), capT = .2 + .8 * m;
      const nb = nbr4(i); let nG = 0, nF = 0, nB = 0, nT = 0, nU = 0; for (const j of nb) { nG += G[j]; nF += F[j]; nB += B[j]; nT += T[j]; nU += U[j]; } const q = 1 / nb.length; nG *= q; nF *= q; nB *= q; nT *= q; nU *= q;
      const pol = Math.min(1, w.poll[i]);
      const dG = k * (.2 * G[i] * (1 - (G[i] + .5 * F[i]) / capG) + .012 * nG + (G[i] > 0 || nG > 0 ? .018 * Math.max(0, 1 - (G[i] + .5 * F[i]) / capG) : 0));   // + regrowth from roots and the seed bank
      const dF = (.08 + .2 * pol) * k * F[i] * (1 - (F[i] + .12 * G[i]) / capF) + (.002 + .02 * pol) * k * nF;
      const dB = .035 * k * B[i] * (1 - B[i] / capB) + .0015 * k * nB;
      const dT = .012 * k * T[i] * (1 - T[i] / capT) + .0012 * k * nT;
      G[i] = Math.max(0, G[i] + dG); F[i] = Math.max(0, F[i] + dF); B[i] = Math.max(0, B[i] + dB); T[i] = Math.max(0, T[i] + dT);
      w.fert[i] = Math.max(.15, w.fert[i] - .05 * Math.max(0, dG + dF + dB + dT));   // growth draws on the soil
      if (autumnStart) { const dl = .35 * G[i] + .5 * F[i] + .05 * B[i] + .02 * T[i]; G[i] *= .65; F[i] *= .72; B[i] *= .98; T[i] *= .98; w.litter[i] = Math.min(2, w.litter[i] + dl * .6); }
      // rot: slow on its own, fast with fungi; it gives the nutrients back
      const rot = w.litter[i] * (.0015 + .05 * U[i] * (.4 + .6 * m)); w.litter[i] -= rot; w.fert[i] = Math.min(1.25, w.fert[i] + rot * .55);
      U[i] = Math.max(0, U[i] + .08 * U[i] * (Math.min(1, w.litter[i] * 4) * (.3 + .7 * m) - U[i]) + .01 * nU * Math.min(1, w.litter[i] * 4) - .004 * U[i]);
      // bare ground washes away in the autumn and winter rains
      const cover = G[i] + F[i] + B[i] + T[i]; if (cover < .08 && ph > .6) w.fert[i] = Math.max(.15, w.fert[i] - .006 * (1 + isl.elev[i]));
      w.poll[i] *= .75; w.fear[i] *= .8;
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
        if (ok && S.needTrees) { let tc = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = x0 + dx, y = y0 + dy; if (x >= 0 && y >= 0 && x < GW && y < GH) tc += T[y * GW + x]; } ok = tc >= 1.5; }
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
  function foodAt(w, S, i) { let v = 0; for (const [d, p] of S.diet) { const fv = w.f[d][i]; v += p * (d === 'tree' ? Math.min(fv, .35) : fv); } return v; }
  function moveTo(w, k, i) { w.x[k] = i % GW; w.y[k] = (i / GW) | 0; return i; }
  function graze(w, k, S, i) {
    const r = w.r, isl = w.isl; const fearful = S.fear === 'wolf';
    // look at a few tiles within reach; pick the best food, keeping away from wolves (deer, goats) and towards cover (rabbits near foxes)
    let best = i, bv = -1e9;
    for (let c = 0; c < 5; c++) { let j = i; if (c) { const dx = r.int(2 * S.speed + 1) - S.speed, dy = r.int(2 * S.speed + 1) - S.speed, x = w.x[k] + dx, y = w.y[k] + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; j = y * GW + x; if (!isl.land[j]) continue; }
      let v = foodAt(w, S, j) + r() * .05; if (fearful) v -= 1.6 * w.fear[j]; if (S.shelter) v += .3 * Math.min(.4, w.f.shrub[j]);
      if (S === P[IDX.deer] && isl.bank[j] && w.fear[j] < .2) v += .15;   // deer love the lush riverbanks, if it is safe
      if (v > bv) { bv = v; best = j; } }
    i = moveTo(w, k, best);
    let want = Math.min(S.bite, S.Emax - w.E[k] + S.cost);
    for (const [d, p] of S.diet) { if (want <= 0) break; const fl = w.f[d]; const avail = Math.max(0, (d === 'tree' ? Math.min(fl[i], .35) : fl[i]) - FLOOR[d]) * FOOD * .5 * p; const take = Math.min(want, avail); fl[i] -= take / FOOD; want -= take; w.E[k] += take; }
    return i;
  }
  function bee(w, k, S, i, win) {
    if (win) return i;                                   // asleep in the nest
    const r = w.r; let best = i, bv = -1;
    for (let c = 0; c < 6; c++) { const x = w.x[k] + r.int(5) - 2, y = w.y[k] + r.int(5) - 2; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; const j = y * GW + x; if (!w.isl.land[j]) continue; const v = w.f.flower[j] + r() * .02; if (v > bv) { bv = v; best = j; } }
    i = moveTo(w, k, best); const fl = w.f.flower[i]; w.E[k] += Math.min(S.bite, fl * 2.2);
    w.poll[i] += 1; for (const j of nbr8(i)) w.poll[j] += .4;
    return i;
  }
  function hunt(w, k, S, i) {
    const r = w.r, isl = w.isl, R = S.radius, x0 = w.x[k], y0 = w.y[k];
    if (S.scare) { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = x0 + dx, y = y0 + dy; if (x >= 0 && y >= 0 && x < GW && y < GH) w.fear[y * GW + x] += 1 / (1 + Math.abs(dx) + Math.abs(dy)); } }
    if (w.E[k] < S.Emax * .85) {
      // search the hunting range from a random corner; one attempt per tick
      const ox = r.int(2 * R + 1), oy = r.int(2 * R + 1);
      for (let a = 0; a < (2 * R + 1) * (2 * R + 1); a++) { const dx = (a % (2 * R + 1) + ox) % (2 * R + 1) - R, dy = (((a / (2 * R + 1)) | 0) + oy) % (2 * R + 1) - R; const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; const j = y * GW + x;
        for (let q = head[j]; q >= 0; q = nxt[q]) { const ps = w.sp[q]; if (ps < 0) continue; const pr = S.prey.find(p => IDX[p[0]] === ps); if (!pr) continue;
          let p = pr[1]; if (P[ps].shelter) p *= 1 - .92 * Math.min(1, w.f.shrub[j] * 2.5); if (P[ps].id === 'rabbit' && S.id === 'owl' && w.age[q] > 12) p = 0;
          moveTo(w, k, j); if (r() < p) { w.E[k] += S.value[P[ps].id]; kill(w, q); } return j; } }
    }
    // nothing found: wander (wolves keep with the pack, owls keep to the trees)
    let best = i, bv = -1e9;
    for (let c = 0; c < 4; c++) { const x = x0 + r.int(2 * S.speed + 1) - S.speed, y = y0 + r.int(2 * S.speed + 1) - S.speed; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; const j = y * GW + x; if (!isl.land[j]) continue;
      let v = r(); if (S.needTrees) v += w.f.tree[j] * 1.5; for (let q = head[j]; q >= 0; q = nxt[q]) if (w.sp[q] === S.i) v += S.pack ? .4 : .15; if (v > bv) { bv = v; best = j; } }
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
    while (w.t < t) { while (ai < acts.length && acts[ai][0] <= w.t) { const [, id, x, y] = acts[ai++]; release(w, id, x, y); } step(w); } return w; }
  const api = { GW, GH, N, TPY, SP, IDX, ANIMALS, PLANTS, MAXA, rng, hashStr, makeIsland, create, step, release, counts, present, presentAt, speciesCount, season, seasonName, isWinter, inDrought, replay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.IslandSim = api;
})(typeof window !== 'undefined' ? window : this);
