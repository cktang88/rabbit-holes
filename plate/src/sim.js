// ============================================================================================
//  PLATE SIM: rigid plates on a wrapping lat-lon grid, crust carried cell by cell.
//  Every world cell belongs to exactly one plate after each step. Plates move by whole cells
//  (sub-cell remainder kept in an accumulator); where two plates land on one cell the crust
//  decides: continents collide and thicken, ocean subducts (the older ocean when both are ocean),
//  where none lands new crust is made (ocean, or stretched continent first). Elevation is isostatic.
// ============================================================================================
const PlateSim = (() => {
  const DT = .25, EARTH_KM = 40000, VMAX_KM = 400, SLAB_KM = 75;
  const NONE = 255, MAXP = 15, COLW = [[1, .2], [2, .16], [3, .12], [4, .1]];
  const iso = (h, f, age) => -2.6 - .35 * Math.sqrt(age < 0 ? 0 : age > 90 ? 90 : age) * (1 - f) + .13 * (h - 7);
  // ---- noise ----
  function hash2(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function vnoise(x, y, px, s) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
    const a = hash2(x0, yi, s), b = hash2(x1, yi, s), c = hash2(x0, yi + 1, s), d = hash2(x1, yi + 1, s);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function fbm(u, v, base, oct, s) { let sum = 0, amp = .5, norm = 0; for (let o = 0; o < oct; o++) { const p = base << o; sum += amp * vnoise(u * p, v * p * .5, p, s + o * 101); norm += amp; amp *= .5; } return sum / norm; }
  function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // geomagnetic reversals: a fixed random sequence of chrons, 1.5–5 Myr long (compressed for a game)
  const REV = (() => { const r = []; let t = -900, k = 0; while (t < 9000) { r.push(t); t += 1.5 + 3.5 * hash2(k++, 7, 99); } return Float64Array.from(r); })();
  function polarity(t) { let lo = 0, hi = REV.length; while (lo < hi) { const m = (lo + hi) >> 1; if (REV[m] <= t) lo = m + 1; else hi = m; } return lo & 1; }

  function create(o = {}) {
    const W = o.W || 256, H = W >> 1, N = W * H, cellKm = EARTH_KM / W;
    const F = () => new Float32Array(N), U = () => new Uint8Array(N);
    const S = { W, H, N, cellKm, dt: DT, time: 0, t0: 0, stepN: 0, seed: o.seed || 1, rand: rng(o.seed || 1),
      vmax: VMAX_KM / cellKm, slab: SLAB_KM / cellKm,
      owner: U(), h: F(), f: F(), birth: F(), vt: F(), kind: U(), ghost: U(),
      _o: U(), _h: F(), _f: F(), _birth: F(), _vt: F(), _kind: U(), _ghost: U(),
      addSub: F(), addCol: F(), addP: U(), e: F(), trench: F(), volc: F(), swell: F(), arcN: F(),
      P: F(), P0: F(), T: F(), A: F(), Er: F(), Dr: F(), rcv: new Int32Array(N), bnd: new Int8Array(N), bndV: F(),
      lat: new Float32Array(H), wl: new Float32Array(H),
      plates: [], hot: [], sea: 0, water: 0, events: [], qc: { transform: 0, subduction: 0, collision: 0, rift: 0, total: 0 },
      pairs: new Map(), acc: new Map(), stress: new Map(), dec: new Map(), snaps: [], volcList: [], firsts: {}, frozen: false };
    for (let y = 0; y < H; y++) { const la = 90 - (y + .5) * 180 / H; S.lat[y] = la; S.wl[y] = Math.cos(la * Math.PI / 180); }
    for (let i = 0; i < N; i++) { const x = i % W, y = (i / W) | 0; S.arcN[i] = .25 + 1.5 * fbm(x / W, y / H, 48, 2, 777); }
    return S;
  }
  const cmToCells = (S, cm) => cm * 10 / S.cellKm, cellsToCm = (S, v) => v * S.cellKm / 10;

  // ---------------------------------------------------------------------------------------
  //  World generation from a level spec (positions: u east 0..1 wrapping, v from north 0..1; sizes in km)
  // ---------------------------------------------------------------------------------------
  function gen(S, spec) {
    const { W, H, N, cellKm } = S, sd = spec.seed || 1;
    S.rand = rng(sd * 7919 + 13);
    S.plates = spec.plates.map((p, k) => ({ id: k, alive: true, name: p.name || '', vx: cmToCells(S, (p.v || [0, 0])[0]), vy: cmToCells(S, (p.v || [0, 0])[1]), ax: 0, ay: 0, sx: 0, sy: 0, tvx: 0, tvy: 0, held: false,
      mass: 0, cmass: 0, cx: 0, cy: 0, subN: 0, subDX: 0, subDY: 0, cminY: 0, cmaxY: 0, fixed: !!p.fixed }));
    const conts = (spec.conts || []).map(c => ({ ...c, cs: Math.cos((c.rot || 0) * Math.PI / 180), sn: Math.sin((c.rot || 0) * Math.PI / 180) }));
    const dKm = (u0, v0, x, y) => { let dx = x - u0 * W; dx -= Math.round(dx / W) * W; const dy = y - v0 * H; return [dx * cellKm, dy * cellKm]; };
    const rOf = (c, x, y) => { const [dx, dy] = dKm(c.u, c.v, x + .5, y + .5); const a = (dx * c.cs + dy * c.sn) / c.rx, b = (-dx * c.sn + dy * c.cs) / c.ry;
      let r = Math.hypot(a, b); if (c.shape) r = c.shape(a, b, r); r *= 1 + (c.rough ?? .35) * (fbm(x / W, y / H, 6, 4, sd + 31 + (c.ns || 0)) - .5); return r; };
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      let best = 1e18, bp = 0, ch = 0, cf = 0, inC = -1, minR = 9;
      const rs = conts.map(c => rOf(c, x, y));
      conts.forEach((c, k) => { if (rs[k] < minR) { minR = rs[k]; inC = k; } });
      S.plates.forEach((P, k) => {
        const ps = spec.plates[k]; let d = 1e18;
        for (const s of ps.seeds || []) { const [a, b] = dKm(s[0], s[1], x + .5, y + .5); d = Math.min(d, Math.hypot(a, b) * (s[2] || 1)); }
        conts.forEach((c, j) => { if (c.plate === k && !c.add) d = Math.min(d, Math.max(0, rs[j] - 1) * Math.min(c.rx, c.ry) * 1.4); });
        d += (spec.warp ?? 380) * (fbm(x / W, y / H, 5, 3, sd + k * 17) - .5);
        if (d < best) { best = d; bp = k; }
      });
      let h = 7, f = 0, kd = 0;
      conts.forEach((c, k) => { if (c.add) return; const r = rs[k]; if (r < 1.18) { const t = Math.min(1, Math.max(0, (1.18 - r) / .3)), sm = t * t * (3 - 2 * t);
        const H0 = (c.h || 33) + 5 * (fbm(x / W, y / H, 10, 3, sd + 5) - .5); const hh = 7 + (H0 - 7) * sm; if (hh > h) { h = hh; f = Math.min(1, Math.max(0, (1.12 - r) / .17)); } } });
      if (inC >= 0 && !conts[inC].add && minR < 1) bp = conts[inC].plate;
      conts.forEach((c, k) => { if (!c.add) return; const r = rs[k]; if (r < 1) { const t = 1 - r; h += c.add * t * t * (3 - 2 * t); kd = c.kind ?? 2; } });
      if (spec.plates[bp].force) { const fp = spec.plates[bp].force(x / W, y / H); if (fp != null) bp = fp; }
      S.owner[i] = bp; S.h[i] = h; S.f[i] = f; S.kind[i] = kd; S.vt[i] = kd ? -5 : -1e4;
      const pa = spec.plates[bp], ag = typeof pa.age === 'function' ? pa.age(x / W, y / H) : (pa.age ?? 80);
      S.birth[i] = -(ag * (.75 + .5 * fbm(x / W, y / H, 4, 2, sd + 91 + bp))) - 20 * f;
    }
    S.hot = (spec.hot || []).map((h, k) => ({ x: Math.floor(h[0] * W), y: Math.floor(h[1] * H), ph: k * .7 }));
    calcSwell(S); S.time = 0; S.t0 = 0; S.stepN = 0; S.events = []; S.qc = { transform: 0, subduction: 0, collision: 0, rift: 0, total: 0 };
    S.pairs.clear(); S.acc.clear(); S.stress.clear(); S.snaps = []; S.firsts = {}; S.trench.fill(0); S.volc.fill(0);
    massPass(S); elev(S); climate(S, true); snapshot(S);
    return S;
  }
  function calcSwell(S) { const { W, H } = S; S.swell.fill(0); for (const hs of S.hot) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const y = hs.y + dy; if (y < 0 || y >= H) continue; const x = (hs.x + dx + W) % W; S.swell[y * W + x] += .9 * Math.exp(-(dx * dx + dy * dy) / 5); } }

  // ---------------------------------------------------------------------------------------
  //  helpers
  // ---------------------------------------------------------------------------------------
  function at(S, t, dx, dy, k) { const { W, H } = S; let x = t % W + Math.round(dx * k), y = ((t / W) | 0) + Math.round(dy * k); x = ((x % W) + W) % W; if (y < 0) y = 0; else if (y >= H) y = H - 1; return y * W + x; }
  function pair(S, key) { let c = S.pairs.get(key); if (!c) { c = { col: 0, sub: 0, nx: 0, ny: 0, cell: -1 }; S.pairs.set(key, c); } return c; }
  function copyIn(S, t, i) { S._ghost[t] = 0; S._o[t] = S.owner[i]; S._h[t] = S.h[i]; S._f[t] = S.f[i]; S._birth[t] = S.birth[i]; S._vt[t] = S.vt[i]; S._kind[t] = S.kind[i]; }
  function emit(S, ev) { if (S.events.length < 200) S.events.push(ev); }
  function first(S, k, cell, extra) { if (!S.firsts[k]) { S.firsts[k] = S.time + .001; emit(S, { t: 'label', k, cell, ...extra }); } }

  // ---------------------------------------------------------------------------------------
  //  one fixed step of 0.25 Myr
  // ---------------------------------------------------------------------------------------
  function step(S) {
    const dt = S.dt;
    for (const p of S.plates) {
      if (!p.alive) continue;
      if (p.fixed) { p.vx = p.vy = 0; continue; }
      if (p.held) { const k = 1 - Math.exp(-dt / .45); p.vx += (p.tvx - p.vx) * k; p.vy += (p.tvy - p.vy) * k; }
      else { const k = Math.exp(-dt / 30); p.vx *= k; p.vy *= k; }
      if (p.subN > 0) { const L = Math.hypot(p.subDX, p.subDY) || 1, dx = p.subDX / L, dy = p.subDY / L, vs = Math.min(1, p.subN / 14) * S.slab, al = p.vx * dx + p.vy * dy;
        if (al < vs) { const k = 1 - Math.exp(-dt / 5); p.vx += dx * (vs - al) * k; p.vy += dy * (vs - al) * k; } }
    }
    for (const [key, c] of S.pairs) {
      if (c.col <= 0) continue; const a = S.plates[key >> 4], b = S.plates[key & 15]; const L = Math.hypot(c.nx, c.ny); if (L < 1e-6) continue;
      const nx = c.nx / L, ny = c.ny / L, vr = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vr > 0) { const beta = Math.min(.9, .12 * Math.pow(c.col, .75)), ma = a.fixed ? 1e9 : (a.mass + 50) * (a.held ? 1 : 5), mb = b.fixed ? 1e9 : (b.mass + 50) * (b.held ? 1 : 5), J = beta * vr * ma * mb / (ma + mb);
        if (!a.fixed) { a.vx -= J / ma * nx; a.vy -= J / ma * ny; } if (!b.fixed) { b.vx += J / mb * nx; b.vy += J / mb * ny; } }
    }
    let any = false;
    for (const p of S.plates) {
      if (!p.alive) continue;
      const sp = Math.hypot(p.vx, p.vy); if (sp > S.vmax) { p.vx *= S.vmax / sp; p.vy *= S.vmax / sp; }
      if (p.cmass > 0 && ((p.cminY < 3 && p.vy < 0) || (p.cmaxY > S.H - 4 && p.vy > 0))) p.vy *= .6;
      p.ax += p.vx * dt; p.ay += p.vy * dt;
      p.sx = p.ax >= 1 ? 1 : p.ax <= -1 ? -1 : 0; p.ax -= p.sx; p.sy = p.ay >= 1 ? 1 : p.ay <= -1 ? -1 : 0; p.ay -= p.sy;
      if (p.sx || p.sy) any = true;
      p.subN = 0; p.subDX = 0; p.subDY = 0;
    }
    S.pairs.clear();
    if (any) { scatter(S); massPass(S); }
    hotspots(S); spread(S); surface(S);
    const kt = Math.exp(-dt / 2.5), kv = Math.exp(-dt / 1.3); for (let i = 0; i < S.N; i++) { if (S.trench[i] > .01) S.trench[i] *= kt; else S.trench[i] = 0; S.volc[i] *= kv; }
    elev(S); bounds(S);
    S.time += dt; S.stepN++;
    if (S.stepN % 4 === 0) climate(S, false);
    if (S.stepN % 20 === 0) snapshot(S);
  }

  function scatter(S) {
    const { W, H, N } = S, o = S.owner, no = S._o; no.fill(NONE); S._ghost.fill(0);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) {
      const p = o[i]; if (p === NONE || S.ghost[i]) continue; const P = S.plates[p], mv = P.sx !== 0 || P.sy !== 0; if ((pass === 0) === mv) continue;
      let x = i % W + P.sx, y = ((i / W) | 0) + P.sy; if (x < 0) x += W; else if (x >= W) x -= W;
      if (y < 0 || y >= H) { if (S.f[i] < .5) continue; y = y < 0 ? 0 : H - 1; }
      const t = y * W + x;
      if (no[t] === NONE) copyIn(S, t, i); else resolve(S, t, i);
    }
    fillGaps(S);
    let a;
    a = S.owner; S.owner = S._o; S._o = a; a = S.h; S.h = S._h; S._h = a; a = S.f; S.f = S._f; S._f = a;
    a = S.birth; S.birth = S._birth; S._birth = a; a = S.vt; S.vt = S._vt; S._vt = a; a = S.kind; S.kind = S._kind; S._kind = a; a = S.ghost; S.ghost = S._ghost; S._ghost = a;
    applyAdds(S); collapse(S);
  }

  function resolve(S, t, i) {
    const po = S._o[t], pi = S.owner[i];
    if (po === pi) { S._h[t] = Math.max(S._h[t], S.h[i]) + .3 * Math.min(S._h[t], S.h[i]); return; }
    const A = S.plates[pi], B = S.plates[po];
    let rx = A.vx - B.vx, ry = A.vy - B.vy, L = Math.hypot(rx, ry);
    if (L < 1e-5) { rx = A.sx - B.sx; ry = A.sy - B.sy; L = Math.hypot(rx, ry) || 1; }
    const nx = rx / L, ny = ry / L, fo = S._f[t], fi = S.f[i];
    const key = pi < po ? (pi << 4 | po) : (po << 4 | pi), sg = pi < po ? 1 : -1, c = pair(S, key);
    c.nx += nx * sg; c.ny += ny * sg; c.cell = t;
    if (fo > .5 && fi > .5) {                                       // continent meets continent: neither sinks
      c.col++;
      const sI = A.vx * nx + A.vy * ny, sO = -(B.vx * nx + B.vy * ny);
      let hh, sx = nx, sy = ny, ov = po;
      if (sI >= sO) { hh = S.h[i]; } else { hh = S._h[t]; copyIn(S, t, i); sx = -nx; sy = -ny; ov = pi; }
      S._h[t] += .3 * hh; S._kind[t] = 2; S._vt[t] = S.time;
      for (const [k, w] of COLW) { const j = at(S, t, sx, sy, k); S.addCol[j] += w * hh; S.addP[j] = ov; }
      const l1 = at(S, at(S, t, -sy, sx, 1), sx, sy, 1), l2 = at(S, at(S, t, sy, -sx, 1), sx, sy, 1); S.addCol[l1] += .06 * hh; S.addCol[l2] += .06 * hh; S.addP[l1] = S.addP[l2] = ov;
      if (S.rand() < .02) first(S, 'collision', t);
      return;
    }
    let inSub;
    if (fo > .5) inSub = true; else if (fi > .5) inSub = false; else inSub = S.birth[i] <= S._birth[t];   // the older (earlier-born) ocean sinks
    c.sub++;
    const oceanOver = inSub ? fo < .5 : fi < .5;
    if (inSub) {
      A.subN++; A.subDX += nx; A.subDY += ny;
      const a2 = at(S, t, nx, ny, 2), a1 = at(S, t, nx, ny, 1);
      S.addSub[a2] += 5 * S.arcN[a2]; S.addSub[a1] += 2; S.addP[a2] = S.addP[a1] = po;
      const tr = at(S, t, -nx, -ny, 1); S.trench[tr] = Math.max(S.trench[tr], 3.2); S.trench[t] = Math.max(S.trench[t], 1.4);
      if (S.rand() < .05) { first(S, 'trench', tr); first(S, oceanOver ? 'islandarc' : 'arc', a2); }
    } else {
      B.subN++; B.subDX -= nx; B.subDY -= ny;
      copyIn(S, t, i);
      const a2 = at(S, t, -nx, -ny, 2), a1 = at(S, t, -nx, -ny, 1);
      S.addSub[a2] += 5 * S.arcN[a2]; S.addSub[a1] += 2; S.addP[a2] = S.addP[a1] = pi;
      const tr = at(S, t, nx, ny, 1); S.trench[tr] = Math.max(S.trench[tr], 3.2); S.trench[t] = Math.max(S.trench[t], 1.4);
      if (S.rand() < .05) { first(S, 'trench', tr); first(S, oceanOver ? 'islandarc' : 'arc', a2); }
    }
  }

  function fillGaps(S) {
    const { W, H, N } = S, no = S._o; let gaps = [];
    for (let t = 0; t < N; t++) if (no[t] === NONE) gaps.push(t);
    if (!gaps.length) return;
    S.dec.clear();
    const nb = [0, 0, 0, 0];
    for (let pass = 0; pass < 8 && gaps.length; pass++) {
      const asg = [], rest = [];
      for (const g of gaps) {
        const x = g % W, y = (g / W) | 0; let n = 0;
        nb[n++] = y * W + (x + 1) % W; nb[n++] = y * W + (x + W - 1) % W; if (y > 0) nb[n++] = g - W; if (y < H - 1) nb[n++] = g + W;
        let a = NONE, b = NONE, ca = 0, cb = 0, sh = 0, sf = 0, sb = 0, m = 0, best = -1e9, bj = -1, close = 0;
        for (let k = 0; k < n; k++) { const j = nb[k], p = no[j]; if (p === NONE || S._ghost[j]) continue; m++; sh += S._h[j]; sf += S._f[j]; sb += S._birth[j];
          const P = S.plates[p], dx = k === 0 ? 1 : k === 1 ? -1 : 0, dy = k < 2 ? 0 : (j < g ? -1 : 1), tow = -(P.vx * dx + P.vy * dy); close += tow; if (tow > best) { best = tow; bj = j; }
          if (p === a) ca++; else if (p === b) cb++; else if (a === NONE) { a = p; ca = 1; } else if (b === NONE) { b = p; cb = 1; } }
        if (!m) { rest.push(g); continue; }
        if (close > .02 * m && best > .02) { asg.push(g, -1, bj, 0, 0); continue; }   // the follower will fill this next shift: a placeholder, not new crust
        let pl = a;
        if (b !== NONE) { const lo = Math.min(a, b), hi = Math.max(a, b), key = lo << 4 | hi; let d = S.dec.get(key);
          if (d === undefined) { const ac = S.acc.get(key) || [0, 0]; d = ac[0] <= ac[1] ? lo : hi; ac[d === lo ? 0 : 1]++; S.acc.set(key, ac); S.dec.set(key, d); } pl = d; }
        asg.push(g, pl, sh / m, sf / m, sb / m);
      }
      for (let k = 0; k < asg.length; k += 5) {
        const g = asg[k], pl = asg[k + 1], mh = asg[k + 2], mf = asg[k + 3];
        if (pl < 0) { const j = mh; no[g] = no[j]; S._h[g] = S._h[j]; S._f[g] = S._f[j]; S._birth[g] = S._birth[j]; S._vt[g] = S._vt[j]; S._kind[g] = S._kind[j]; S._ghost[g] = 1; continue; }
        no[g] = pl;
        if (mf > .5 && mh > 15.5) { S._h[g] = mh * (mh > 29 ? .86 : .75); S._f[g] = mf; S._birth[g] = asg[k + 4]; S._kind[g] = 4; S._vt[g] = S.time;
          if (S.rand() < .1) first(S, mh > 26 ? 'rift' : 'narrowsea', g); }
        else { S._h[g] = 7; S._f[g] = 0; S._birth[g] = S.time; S._kind[g] = 0; S._vt[g] = -1e4; if (mf > .2 && S.rand() < .1) first(S, 'ridge', g); }
      }
      gaps = rest;
    }
    for (const g of gaps) { no[g] = 0; S._h[g] = 7; S._f[g] = 0; S._birth[g] = S.time; S._kind[g] = 0; S._vt[g] = -1e4; }
  }

  function applyAdds(S) {
    const { N } = S, h = S.h, f = S.f;
    for (let t = 0; t < N; t++) {
      const a = S.addSub[t];
      if (a > 0 && S.owner[t] !== S.addP[t]) S.addSub[t] = 0;
      else if (a > 0) {
        S.addSub[t] = 0;
        const e0 = iso(h[t], f[t], S.time - S.birth[t]) - S.sea, cap = f[t] > .75 ? 5.5 + .5 * S.arcN[t] : .6 + 4.6 * (S.arcN[t] - 1);
        let amt = a; const allowed = Math.max(0, (cap - e0) / .13); if (amt > allowed) amt = allowed + (amt - allowed) * .03;
        f[t] = (f[t] * h[t] + .8 * amt) / (h[t] + amt); if (f[t] < .78 && f[t] > .76) f[t] = .76; h[t] += amt;
        if (a > 1.5) { if (S.kind[t] !== 2) S.kind[t] = 1; S.vt[t] = S.time; S.volc[t] = 1; S.volcList.push(t); }
      }
      const c = S.addCol[t];
      if (c > 0) { S.addCol[t] = 0; if (S.owner[t] === S.addP[t] || S.f[t] > .5) { h[t] += c; S.kind[t] = 2; S.vt[t] = S.time; } else { h[t] += c * .3; } }
    }
  }

  function massPass(S) {
    const { W, N } = S; const P = S.plates, n = P.length;
    const cs = new Float64Array(n), sn = new Float64Array(n), sy = new Float64Array(n);
    for (const p of P) { p.mass = 0; p.cmass = 0; p.cminY = 1e9; p.cmaxY = -1; }
    for (let i = 0; i < N; i++) { const k = S.owner[i]; if (k === NONE || S.ghost[i]) continue; const p = P[k], x = i % W, y = (i / W) | 0; p.mass++; const a = (x + .5) / W * 6.283185; cs[k] += Math.cos(a); sn[k] += Math.sin(a); sy[k] += y;
      if (S.f[i] > .5) { p.cmass++; if (y < p.cminY) p.cminY = y; if (y > p.cmaxY) p.cmaxY = y; } }
    P.forEach((p, k) => { if (p.mass === 0) { if (p.alive) { p.alive = false; p.held = false; } return; } let a = Math.atan2(sn[k], cs[k]); if (a < 0) a += 6.283185; p.cx = a / 6.283185 * W - .5; p.cy = sy[k] / p.mass; });
  }

  function hotspots(S) {
    const { W, N, dt } = S;
    for (const hs of S.hot) {
      const ph = ((S.time + hs.ph) / 3.2) % 1; if (ph > .42) continue;
      const c = hs.y * W + hs.x, er = S.e[c] - S.sea, ocean = S.f[c] < .5;
      if (er < (ocean ? 4 : 2.2)) { S.h[c] += (ocean ? 70 : 20) * dt; S.vt[c] = S.time; if (S.kind[c] !== 2) S.kind[c] = 3; }
      S.volc[c] = 1;
      for (const d of [1, -1, W, -W]) { const j = (c + d + N) % N; if (S.owner[j] === S.owner[c] && S.e[j] - S.sea < -.4) { S.h[j] += 10 * dt; if (S.kind[j] !== 2) S.kind[j] = 3; S.vt[j] = S.time; } }
      if (er > 0 && S.rand() < .15) first(S, 'hotspot', c);
    }
    for (let i = 0; i < N; i++) if (S.kind[i] === 3 && S.f[i] < .5 && S.h[i] > 7) S.h[i] -= (S.h[i] - 7) * dt / 60;
  }

  function spread(S) {
    const { W, H } = S, o = S.owner, h = S.h, f = S.f, e = S.e, sea = S.sea;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (let d = 0; d < 2; d++) {
        let j; if (d === 0) j = y * W + (x + 1) % W; else { if (y === H - 1) continue; j = i + W; }
        const cc = f[i] > .5 && f[j] > .5; if (o[i] !== o[j] && !cc) continue;
        const em = (e[i] > e[j] ? e[i] : e[j]) - sea; let c = cc ? .004 : 0;
        if (em > 4.5) c += .009 * Math.pow(em - 4.5, 1.6); if (c <= 0) continue; if (c > .12) c = .12;
        const fl = c * (h[i] - h[j]); h[i] -= fl; h[j] += fl;
      }
    }
    collapse(S);
  }
  // gravitational collapse: crust much over ~9 km high flows out sideways (why no peak on Earth tops ~9 km)
  function collapse(S) {
    const { W, H, N } = S, h = S.h, f = S.f, sea = S.sea, t = S.time; const lim = 8.4;
    for (let it = 0; it < 3; it++) { let n = 0;
      for (let i = 0; i < N; i++) {
        if (h[i] < 80) continue; const er = iso(h[i], f[i], t - S.birth[i]) - S.trench[i] + S.swell[i] - sea; if (er < lim) continue;
        n++; const x = i % W, y = (i / W) | 0, ex = (er - lim) / .13 * (.35 + .15 * Math.min(2, er - lim));
        const nb = [y * W + (x + 1) % W, y * W + (x + W - 1) % W, y > 0 ? i - W : i + W, y < H - 1 ? i + W : i - W];
        h[i] -= ex; for (const j of nb) h[j] += ex / 4;
      }
      if (!n) break; }
  }

  function surface(S) {
    const { N, dt } = S, h = S.h, f = S.f;
    for (let i = 0; i < N; i++) {
      const er = S.Er[i]; if (er > 0 && S.e[i] > S.sea) { h[i] -= er * dt; if (h[i] < 7) h[i] = 7; }
      const dr = S.Dr[i]; if (dr > 0) { const a = dr * dt, f0 = f[i]; let nf = (f0 * h[i] + .6 * a) / (h[i] + a); if (f0 < .5 && nf > .45) nf = Math.max(f0, .45); f[i] = nf; h[i] += a; }
    }
  }

  function elev(S) { const { N } = S, t = S.time; for (let i = 0; i < N; i++) S.e[i] = iso(S.h[i], S.f[i], t - S.birth[i]) - S.trench[i] + S.swell[i]; }

  function bounds(S) {
    const { W, H, N, dt } = S, o = S.owner, P = S.plates; S.bnd.fill(0); S.bndV.fill(0);
    for (const st of S.stress.values()) { st.n = 0; st.v = 0; st.tc = 0; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (let d = 0; d < 2; d++) {
        let j, nx, ny; if (d === 0) { j = y * W + (x + 1) % W; nx = 1; ny = 0; } else { if (y === H - 1) continue; j = i + W; nx = 0; ny = 1; }
        const a = o[i], b = o[j]; if (a === b) continue;
        const A = P[a], B = P[b], rx = A.vx - B.vx, ry = A.vy - B.vy, conv = rx * nx + ry * ny, sh = Math.abs(rx * ny - ry * nx), sp = Math.hypot(rx, ry);
        const ty = sh > 1.6 * Math.abs(conv) && sp > .05 ? 2 : conv > .02 ? 1 : conv < -.02 ? -1 : 0;
        if (S.bnd[i] !== 2) S.bnd[i] = ty; if (S.bnd[j] !== 2) S.bnd[j] = ty; S.bndV[i] = Math.max(S.bndV[i], sp); S.bndV[j] = Math.max(S.bndV[j], sp);
        const key = a < b ? (a << 4 | b) : (b << 4 | a); let st = S.stress.get(key); if (!st) { st = { s: 0, n: 0, v: 0, cell: -1, ty: 0, thr: 2 + 3 * S.rand(), tc: 0 }; S.stress.set(key, st); }
        st.v += sp; st.n++; if (ty === 2) st.tc++; if (S.rand() * st.n < 1) { st.cell = i; st.ty = ty; }
        if (ty === 2 && sp > .3 && S.rand() < .002) first(S, 'transform', i);
      }
    }
    let fired = 0;
    for (const [key, st] of S.stress) {
      if (st.n === 0) { st.s *= .9; continue; }
      st.s += st.v / st.n * dt * .45 * Math.sqrt(st.n / 20);
      if (st.s > st.thr && fired < 2) {
        fired++;
        const cv = S.pairs.get(key), ty = st.ty === 2 ? 'transform' : cv && cv.col ? 'collision' : cv && cv.sub ? 'subduction' : st.ty === -1 ? 'rift' : st.ty === 1 ? 'subduction' : 'transform';
        const mag = Math.min(9.3, 5.6 + .9 * Math.log10(1 + st.s * 3) + .6 * S.rand());
        S.qc[ty]++; S.qc.total++; emit(S, { t: 'quake', cell: st.cell, ty, mag, key });
        st.s = 0; st.thr = 2 + 3 * S.rand();
      }
    }
    // eruptions on active volcanoes
    if (S.volcList.length > 400) S.volcList = S.volcList.slice(-200);
    for (const hs of S.hot) if (S.e[hs.y * W + hs.x] > S.sea && S.rand() < .08) emit(S, { t: 'erupt', cell: hs.y * W + hs.x });
    if (S.volcList.length && S.rand() < .25) { const c = S.volcList[(S.rand() * S.volcList.length) | 0]; if (S.volc[c] > .4 && S.e[c] > S.sea + .5) emit(S, { t: 'erupt', cell: c }); }
  }

  // ---------------------------------------------------------------------------------------
  //  climate, rivers, erosion, sea level: every 1 Myr
  // ---------------------------------------------------------------------------------------
  const band = la => { const a = Math.abs(la); return .3 + 1.05 * Math.exp(-((a / 12) ** 2)) + .8 * Math.exp(-(((a - 52) / 13) ** 2)) - .22 * Math.exp(-(((a - 25) / 7) ** 2)); };
  function climate(S, init) {
    const { W, H, N } = S, e = S.e;
    if (!init) seaLevel(S); else { S.sea = 0; S.water = vol(S, 0); }
    const sea = S.sea;
    for (let y = 0; y < H; y++) {
      const la = S.lat[y], a = Math.abs(la), Tl = 29 - 52 * Math.pow(a / 90, 1.45), b = band(la), dir = a < 30 || a > 62 ? -1 : 1;
      for (let x = 0; x < W; x++) { const i = y * W + x, er = e[i] - sea; S.T[i] = Tl - 6.5 * (er > 0 ? er : 0); }
      for (let pass = 0; pass < 2; pass++) {
        const oro = pass === 0, out = oro ? S.P : S.P0; let m = .55, pe = 0;
        for (let k = 0; k < 2 * W; k++) {
          const x = dir > 0 ? k % W : W - 1 - (k % W), i = y * W + x, er = e[i] - sea;
          if (er <= 0) { m += (1 - m) * .35; if (k >= W) out[i] = b * m; pe = 0; continue; }
          const ee = oro ? er : .3, rise = Math.max(0, ee - pe); pe = ee;
          const r = Math.min(.85, .045 + .42 * rise + .012 * ee);
          let p = b * m * (.8 + 5 * Math.min(1.5, rise)); if (p > 2.6) p = 2.6;
          if (k >= W) out[i] = p; m *= 1 - r; m += .015 * (1 - m);
        }
      }
    }
    // gentle north–south mixing of rain
    for (const arr of [S.P, S.P0]) for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) { const i = y * W + x; arr[i] = arr[i] * .6 + (arr[i - W] + arr[i + W]) * .2; }
    if (init) return;
    // drainage: steepest descent on land, accumulated from the top down
    const land = [];
    for (let i = 0; i < N; i++) { S.Er[i] = 0; S.Dr[i] = 0; S.A[i] = 0; if (e[i] > sea) land.push(i); }
    for (const i of land) {
      const x = i % W, y = (i / W) | 0; let best = i, be = e[i];
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const j = yy * W + (x + dx + W) % W, de = (e[j] - e[i]) / (dx && dy ? 1.414 : 1) + e[i]; if (de < be) { be = de; best = j; } } }
      S.rcv[i] = best; S.A[i] = Math.max(.05, S.P[i]);
    }
    land.sort((a, b) => e[b] - e[a]);
    for (const i of land) { const r = S.rcv[i]; if (r !== i && e[r] > sea) S.A[r] += S.A[i]; }
    const Qs = S._h; // scratch (free between steps)
    for (const i of land) { const er = e[i] - sea; S.Er[i] = .07 * (.25 + Math.min(1.3, S.P[i])) * Math.pow(er, 1.5) * (1 + .12 * Math.log(1 + S.A[i])); Qs[i] = S.Er[i]; }
    for (const i of land) {
      const r = S.rcv[i], q = Qs[i];
      if (r === i) { S.Dr[i] += q * .85; continue; }
      if (e[r] > sea) { Qs[r] += q; continue; }
      S.Dr[r] += q * .45; const x = r % W, y = (r / W) | 0; const nn = [y * W + (x + 1) % W, y * W + (x + W - 1) % W, y > 0 ? r - W : r, y < H - 1 ? r + W : r];
      for (const j of nn) if (e[j] <= sea) S.Dr[j] += q * .13; else S.Dr[r] += q * .13;
    }
  }
  function vol(S, s) { const { W, N } = S; let v = 0; for (let i = 0; i < N; i++) { const d = s - S.e[i]; if (d > 0) v += d * S.wl[(i / W) | 0]; } return v; }
  function seaLevel(S) { let lo = -2, hi = 2; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (vol(S, m) < S.water) lo = m; else hi = m; } S.sea = (lo + hi) / 2; }

  // ---------------------------------------------------------------------------------------
  //  snapshots (rewind)
  // ---------------------------------------------------------------------------------------
  function snapshot(S) {
    const s = { time: S.time, stepN: S.stepN, owner: S.owner.slice(), h: S.h.slice(), f: S.f.slice(), birth: S.birth.slice(), vt: S.vt.slice(), kind: S.kind.slice(),
      plates: S.plates.map(p => ({ ...p, held: false })), sea: S.sea, water: S.water, acc: [...S.acc].map(([k, v]) => [k, v.slice()]), qc: { ...S.qc }, firsts: { ...S.firsts }, hot: S.hot.map(h => ({ ...h })) };
    S.snaps.push(s); if (S.snaps.length > (S.N > 20000 ? 30 : 45)) S.snaps.splice(1, 1);   // keep the level's first frame
  }
  function restore(S, k, truncate = true) {
    const s = S.snaps[k]; if (!s) return false;
    S.owner.set(s.owner); S.h.set(s.h); S.f.set(s.f); S.birth.set(s.birth); S.vt.set(s.vt); S.kind.set(s.kind);
    S.plates = s.plates.map(p => ({ ...p })); S.sea = s.sea; S.water = s.water; S.acc = new Map(s.acc.map(([k, v]) => [k, v.slice()])); S.qc = { ...s.qc }; S.firsts = { ...s.firsts };
    S.hot = s.hot.map(h => ({ ...h })); calcSwell(S);
    S.time = s.time; S.stepN = s.stepN; if (truncate) S.snaps.length = k + 1; S.trench.fill(0); S.volc.fill(0); S.addSub.fill(0); S.addCol.fill(0); S.pairs.clear(); S.stress.clear(); S.events = [];
    massPass(S); elev(S); climate(S, false); return true;
  }

  // ---------------------------------------------------------------------------------------
  //  rift: cut a plate along a stroke (cell coords). The stroke is extended at both ends until it leaves the plate.
  // ---------------------------------------------------------------------------------------
  function rift(S, pts) {
    const { W, H, N } = S; if (!pts || pts.length < 2) return { ok: false, why: 'short' };
    const free = S.plates.findIndex(p => !p.alive); const slot = free >= 0 ? free : S.plates.length; if (slot >= MAXP) return { ok: false, why: 'plates' };
    const idx = (x, y) => { const yy = Math.floor(y); if (yy < 0 || yy >= H) return -1; return yy * W + ((Math.floor(x) % W) + W) % W; };
    const cnt = new Map(); for (const [x, y] of pts) { const i = idx(x, y); if (i >= 0) cnt.set(S.owner[i], (cnt.get(S.owner[i]) || 0) + 1); }
    let p = -1, bc = 0; for (const [k, v] of cnt) if (v > bc) { bc = v; p = k; } if (p < 0) return { ok: false, why: 'none' };
    const line = pts.map(q => q.slice());
    const ext = (a, b) => { let [x, y] = a; const dx = a[0] - b[0], dy = a[1] - b[1], L = Math.hypot(dx, dy) || 1, ux = dx / L * .5, uy = dy / L * .5; const out = []; let miss = 0;
      for (let k = 0; k < 4 * W && miss < 4; k++) { x += ux; y += uy; const i = idx(x, y); if (i < 0) break; out.push([x, y]); if (S.owner[i] !== p) miss++; else miss = 0; } return out; };
    const head = ext(line[0], line[1]).reverse(), tail = ext(line[line.length - 1], line[line.length - 2]);
    const all = [...head, ...line, ...tail];
    const bar = new Uint8Array(N), cells = [];
    for (let k = 0; k < all.length - 1; k++) { const [x0, y0] = all[k], [x1, y1] = all[k + 1]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / .3) + 1;
      for (let j = 0; j <= n; j++) { const i = idx(x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n); if (i >= 0 && !bar[i] && S.owner[i] === p) { bar[i] = 1; cells.push(i); } } }
    const lab = new Int32Array(N).fill(-1); let nc = 0; const sizes = [];
    for (let s = 0; s < N; s++) {
      if (S.owner[s] !== p || bar[s] || lab[s] >= 0) continue; const st = [s]; lab[s] = nc; let sz = 0;
      while (st.length) { const i = st.pop(); sz++; const x = i % W, y = (i / W) | 0; const nn = [y * W + (x + 1) % W, y * W + (x + W - 1) % W, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
        for (const j of nn) if (j >= 0 && S.owner[j] === p && !bar[j] && lab[j] < 0) { lab[j] = nc; st.push(j); } }
      sizes.push(sz); nc++;
    }
    const big = sizes.map((s, k) => [s, k]).filter(([s]) => s >= 12).sort((a, b) => b[0] - a[0]);
    if (big.length < 2) return { ok: false, why: 'uncut', cells: cells.length };
    const keep = big[0][1], go = big[1][1];
    let mx = 0, my = 0, n2 = 0, ox = 0, oy = 0, n1 = 0; const P0 = S.plates[p];
    for (let i = 0; i < N; i++) { if (lab[i] < 0) continue; let x = i % W; const y = (i / W) | 0; x -= Math.round((x - P0.cx) / W) * W;
      if (lab[i] === go) { mx += x; my += y; n2++; } else if (lab[i] === keep) { ox += x; oy += y; n1++; } }
    const NP = { ...P0, id: slot, alive: true, held: false, ax: P0.ax, ay: P0.ay, subN: 0, subDX: 0, subDY: 0, name: P0.name ? P0.name + ' II' : '' };
    S.plates[slot] = NP;
    for (let i = 0; i < N; i++) if (lab[i] === go) S.owner[i] = slot;
    for (const i of cells) { const x = i % W, y = (i / W) | 0; let c2 = 0, c1 = 0; for (const j of [y * W + (x + 1) % W, y * W + (x + W - 1) % W, y > 0 ? i - W : i, y < H - 1 ? i + W : i]) { if (lab[j] === go) c2++; else if (lab[j] >= 0) c1++; }
      if (c2 > c1) S.owner[i] = slot; if (S.f[i] > .5) { S.h[i] *= .9; S.kind[i] = 4; S.vt[i] = S.time; } }
    let dx = mx / Math.max(1, n2) - ox / Math.max(1, n1), dy = my / Math.max(1, n2) - oy / Math.max(1, n1); const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const kick = cmToCells(S, 1.5); NP.vx = P0.vx + dx * kick; NP.vy = P0.vy + dy * kick; P0.vx -= dx * kick; P0.vy -= dy * kick;
    massPass(S); elev(S); bounds(S);
    const mid = cells[(cells.length / 2) | 0];
    emit(S, { t: 'rifted', a: p, b: slot, cell: mid });
    return { ok: true, a: p, b: slot, cells: cells.length, dx, dy };
  }

  // ---------------------------------------------------------------------------------------
  //  measurements
  // ---------------------------------------------------------------------------------------
  function comps(S, test, conn8 = true) {
    const { W, H, N } = S, lab = new Int32Array(N).fill(-1), out = []; let nc = 0;
    for (let s = 0; s < N; s++) {
      if (lab[s] >= 0 || !test(s)) continue; const st = [s], cells = []; lab[s] = nc;
      while (st.length) { const i = st.pop(); cells.push(i); const x = i % W, y = (i / W) | 0;
        for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { if ((!dx && !dy) || (!conn8 && dx && dy)) continue; const j = yy * W + (x + dx + W) % W; if (lab[j] < 0 && test(j)) { lab[j] = nc; st.push(j); } } } }
      out.push(cells); nc++;
    }
    return { lab, list: out };
  }
  function stats(S, o = {}) {
    const { W, H, N, cellKm } = S, e = S.e, sea = S.sea, A = cellKm * cellKm;
    let peak = -99, peakCell = 0, peakCol = -99, peakSub = -99, trench = 99, land = 0, volcN = 0, desert = 0, shadow = 0, cont = 0;
    for (let i = 0; i < N; i++) {
      const er = e[i] - sea, wl = S.wl[(i / W) | 0];
      if (er > peak) { peak = er; peakCell = i; } if (er < trench) trench = er;
      if (S.kind[i] === 2 && er > peakCol) peakCol = er; if ((S.kind[i] === 1 || (S.volc[i] > .2 && S.kind[i] !== 3)) && er > peakSub) peakSub = er;
      if (S.f[i] > .5) cont += wl;
      if (er > 0) { land += wl; if (S.volc[i] > .5) volcN++; if (S.P[i] < .22 && S.T[i] > -2) { desert += wl; if (S.P0[i] > .3) shadow += wl; } }
    }
    // new ocean: crust born since the level began; width = diameter of the widest disc that fits inside it
    const isNew = i => S.f[i] < .5 && S.birth[i] > S.t0 + .01;
    const dist = new Float32Array(N); let nNew = 0;
    for (let i = 0; i < N; i++) { dist[i] = isNew(i) ? 1e6 : 0; if (dist[i]) nNew++; }
    let maxD = 0, maxCell = -1;
    if (nNew) {
      for (let pass = 0; pass < 2; pass++) {
        const fw = pass === 0;
        for (let k = 0; k < N; k++) { const i = fw ? k : N - 1 - k; if (!dist[i]) continue; const x = i % W, y = (i / W) | 0; let d = dist[i];
          const ys = fw ? -1 : 1; const yy = y + ys;
          const xp = fw ? (x + W - 1) % W : (x + 1) % W; d = Math.min(d, dist[y * W + xp] + 1);
          if (yy >= 0 && yy < H) { d = Math.min(d, dist[yy * W + x] + 1, dist[yy * W + (x + 1) % W] + 1.414, dist[yy * W + (x + W - 1) % W] + 1.414); } else d = Math.min(d, 1);
          dist[i] = d; }
      }
      // second sweep pair to fix wrap-around at x seam
      for (let pass = 0; pass < 2; pass++) { const fw = pass === 0; for (let k = 0; k < N; k++) { const i = fw ? k : N - 1 - k; if (!dist[i]) continue; const x = i % W, y = (i / W) | 0; let d = dist[i];
        d = Math.min(d, dist[y * W + (x + W - 1) % W] + 1, dist[y * W + (x + 1) % W] + 1); if (y > 0) d = Math.min(d, dist[i - W] + 1); if (y < H - 1) d = Math.min(d, dist[i + W] + 1); dist[i] = d; } }
      for (let i = 0; i < N; i++) if (dist[i] > maxD) { maxD = dist[i]; maxCell = i; }
    }
    const oceanWidth = maxD > 0 ? Math.max(0, (2 * maxD - 1)) * cellKm : 0;
    // islands: small land masses, classed by what built them
    const isl = comps(S, i => e[i] > sea);
    const islands = [], hot = [], arcs = [];
    let bigLand = 0;
    for (const cells of isl.list) {
      if (cells.length > 70) { bigLand = Math.max(bigLand, cells.length); continue; }
      let k1 = 0, k3 = 0, vt = 0, mx = 0, my = 0, top = -9; const x0 = cells[0] % W;
      for (const i of cells) { if (S.kind[i] === 1) k1++; if (S.kind[i] === 3) { k3++; vt += S.vt[i]; } let x = i % W; x -= Math.round((x - x0) / W) * W; mx += x; my += (i / W) | 0; top = Math.max(top, e[i] - sea); }
      const it = { n: cells.length, x: ((mx / cells.length) % W + W) % W, y: my / cells.length, top, kind: k3 >= k1 && k3 > 0 ? 'hotspot' : k1 > 0 ? 'arc' : 'other' };
      if (it.kind === 'hotspot') { it.age = S.time - vt / k3; hot.push(it); } else if (it.kind === 'arc') arcs.push(it);
      islands.push(it);
    }
    const cc = comps(S, i => S.f[i] > .5);
    let biggest = 0, tot = 0; for (const cells of cc.list) { let a = 0; for (const i of cells) a += S.wl[(i / W) | 0]; tot += a; if (a > biggest) biggest = a; }
    // passive margins: no trench next to the new ocean
    // passive margins: the continental coasts facing the widest new ocean have no trench beside them
    let activeMargin = 0, coastN = 0;
    if (maxCell >= 0) {
      const comp = new Uint8Array(N), st = [maxCell]; comp[maxCell] = 1;
      while (st.length) { const i = st.pop(), x = i % W, y = (i / W) | 0; for (const j of [y * W + (x + 1) % W, y * W + (x + W - 1) % W, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !comp[j] && dist[j] > 0) { comp[j] = 1; st.push(j); } }
      for (let i = 0; i < N; i++) { if (S.f[i] <= .85) continue; const x = i % W, y = (i / W) | 0; let c = false;
        for (let dy = -1; dy <= 1 && !c; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) if (comp[yy * W + (x + dx + W) % W]) { c = true; break; } }
        if (!c) continue; coastN++; let tr = false;
        for (let dy = -2; dy <= 2 && !tr; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -2; dx <= 2; dx++) if (S.trench[yy * W + (x + dx + W) % W] > 1) { tr = true; break; } }
        if (tr) activeMargin++; }
    }
    return {
      time: S.time - S.t0, peak, peakCell, peakCol, peakSub, trench, sea: S.sea * 1000,
      landKm2: land * A, desertKm2: desert * A, shadowKm2: shadow * A, volcanoes: volcN,
      oceanWidth, oceanCell: maxCell, newOceanKm2: nNew * A, activeMargin, activeFrac: coastN ? activeMargin / coastN : 0,
      islands: islands.length, hotIslands: hot.length, arcIslands: arcs.length, hot, arcs,
      superFrac: tot ? biggest / tot : 0, contPieces: cc.list.filter(c => c.length > 20).length,
      quakes: { ...S.qc }, plates: S.plates.filter(p => p.alive).length,
    };
  }

  // ---------------------------------------------------------------------------------------
  //  checks
  // ---------------------------------------------------------------------------------------
  function sane(S) { for (let i = 0; i < S.N; i++) { if (!isFinite(S.h[i]) || !isFinite(S.e[i]) || !isFinite(S.f[i]) || S.owner[i] === NONE || S.plates[S.owner[i]] == null) return 'bad cell ' + i; } for (const p of S.plates) if (!isFinite(p.vx) || !isFinite(p.vy)) return 'bad plate ' + p.id; return ''; }

  return { create, gen, step, rift, stats, snapshot, restore, polarity, iso, fbm, hash2, cmToCells, cellsToCm, sane, comps, DT, NONE, MAXP };
})();
if (typeof module !== 'undefined') module.exports = PlateSim;
