// Canal Mania core: seeded country, canal analysis, the monthly water-and-traffic model, and a planner.
// Pure functions; the page and the tests share them. Units: heights in rises (one lock = 1), water in lockfuls,
// money in £ thousands, time in months. One grid cell is a furlong or so of canal.
(function (root) {
'use strict';
const W = 30, H = 22, N = W * H;
const C = {
  STREAM: 7,                  // catchment cells before a trickle counts as a stream
  CELL: 2, TUN: 14, AQ: 10,   // £k per cell: plain canal, tunnel, aqueduct
  CUT: 2.2, BANK: 2.5,        // £k per cell per (rise beyond tolerance)^2
  CULVERT: 2,
  FLIGHT: 6, STAIR: 4, PLANE: 22, PLANE_N: 1.5, PONDS: 1.4, DBL: 1.8, PUMP: 12,
  RCOST: 18, FEEDER: 1, RCAP: 420, RREL: 130, RFEED: 1.1, RREACH: 9,
  K: 1.2, GROW: 1.012, R: .0062, MONTHS: 120,
  STORE: 5, LEAK: .14, FEED: .45,
  CAP: 60, PLANECAP: 90, PUMPCAP: 70,
  RUN_LOCK: .025, RUN_PLANE: .35, RUN_PLANE_BOAT: .008, RUN_PUMP: .006, RUN_TUN: .02, RUN_CELL: .006,
  TONS: 25,
};
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const xy = c => [c % W, (c / W) | 0];
const idx = (x, y) => y * W + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const adj = (a, b) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return a !== b && Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1; };
const stepLen = (a, b) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return ax !== bx && ay !== by ? Math.SQRT2 : 1; };
const ekey = (a, b) => a < b ? a + '-' + b : b + '-' + a;
const cheb = (a, b) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); };
const eucl = (a, b) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return Math.hypot(ax - bx, ay - by); };

function rng(seed) {
  let a = seed >>> 0;
  const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  f.int = n => Math.floor(f() * n); f.range = (lo, hi) => lo + f() * (hi - lo); f.pick = a2 => a2[Math.floor(f() * a2.length)];
  return f;
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ================= the country =================
const SYL1 = ['Ash', 'Bram', 'Cal', 'Dun', 'Elm', 'Fen', 'Gar', 'Hal', 'Kel', 'Lud', 'Mar', 'Nor', 'Ock', 'Pen', 'Ral', 'Sto', 'Thur', 'Wex', 'Brin', 'Cot', 'Hart', 'Lang', 'Sel', 'Wick'];
const SYL2 = ['by', 'ford', 'ley', 'ton', 'wick', 'bury', 'ham', 'stow', 'well', 'field', 'bridge', 'worth', 'mere', 'den'];
function townName(r) { return r.pick(SYL1) + r.pick(SYL2); }

// A random country: one or two ridges with a saddle, a hill or two, three or four towns in the low ground.
function randomSpec(seed) {
  const r = rng(seed * 2654435761 + 7);
  const sp = { seed, relief: r.range(2, 3.4), ridges: [], hills: [], towns: [], drought: [] };
  const nr = r() < .55 ? 1 : 2;
  for (let i = 0; i < nr; i++) {
    const vert = r() < .6, a = vert ? [r.range(10, 20), -2] : [-2, r.range(7, 15)], b = vert ? [r.range(10, 20), H + 1] : [W + 1, r.range(7, 15)];
    if (i === 1) { a[0] = vert ? r.range(4, 9) : -2; }
    const len = vert ? H + 3 : W + 3;
    sp.ridges.push({ a, b, amp: r.range(4.5, 7.5), w: r.range(2.2, 3.6), saddles: [[r.range(.2, .8), r.range(.35, .55), r.range(.08, .16)]], end: r() < .4 ? r.range(.7, .9) : 1, len });
  }
  if (r() < .7) sp.hills.push([r.range(4, W - 4), r.range(4, H - 4), r.range(3, 5), r.range(2.5, 4)]);
  sp.nTowns = r() < .5 ? 3 : 4;
  for (let y = 0; y < 10; y++) {
    if (y >= 1 && r() < .35) sp.drought.push([y * 12 + 5 + r.int(3), 3 + r.int(3)]);
  }
  if (!sp.drought.some(d => d[0] >= 36 && d[0] <= 90)) sp.drought.push([48 + 12 * r.int(3) + 5, 4]);
  sp.drought.sort((a, b) => a[0] - b[0]);
  return sp;
}

function genMap(spec) {
  const r = rng((spec.seed || 1) * 7919 + 13);
  const h = new Float32Array(N);
  for (const [s, a] of [[9, .55], [4.5, .3], [2.2, .15]]) {
    const gw = Math.ceil(W / s) + 2, gh = Math.ceil(H / s) + 2, v = Array.from({ length: gw * gh }, r);
    const sm = t => t * t * (3 - 2 * t);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const q = (i, j) => v[j * gw + i];
      h[idx(x, y)] += a * ((q(ix, iy) * (1 - tx) + q(ix + 1, iy) * tx) * (1 - ty) + (q(ix, iy + 1) * (1 - tx) + q(ix + 1, iy + 1) * tx) * ty);
    }
  }
  let mn = Infinity, mx = -Infinity; for (const v of h) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  for (let i = 0; i < N; i++) h[i] = .4 + (h[i] - mn) / (mx - mn + 1e-9) * (spec.relief ?? 2.6);
  for (const rd of spec.ridges || []) {
    const [ax, ay] = rd.a, [bx, by] = rd.b, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let t = ((x - ax) * dx + (y - ay) * dy) / L2; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
      let amp = rd.amp;
      for (const [st, depth, wd] of rd.saddles || []) amp *= 1 - depth * Math.exp(-(((t - st) / wd) ** 2));
      if (rd.end != null && t > rd.end) amp *= Math.max(0, 1 - (t - rd.end) / .08);
      h[idx(x, y)] += amp * Math.exp(-((d / rd.w) ** 2)) * (.85 + .3 * r());
    }
  }
  for (const [hx, hy, amp, rad] of spec.hills || []) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) h[idx(x, y)] += amp * Math.exp(-(((x - hx) ** 2 + (y - hy) ** 2) / (rad * rad)));
  for (let i = 0; i < N; i++) h[i] = Math.min(11.6, Math.max(.2, h[i]));
  // drainage: every cell sends its rain to its lowest lower neighbour (D8); off the edge is the sea
  const down = new Int32Array(N).fill(-1), acc = new Float32Array(N).fill(1);
  const order = [...Array(N).keys()].sort((a, b) => h[b] - h[a]);
  for (const c of order) {
    const [x, y] = xy(c); let best = -1, bh = h[c];
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); const s = (h[c] - h[n]) / (dx && dy ? Math.SQRT2 : 1); if (h[n] < bh && s > 0 && (best < 0 || s > (h[c] - h[best]) / stepLen(c, best))) best = n; }
    down[c] = best; if (best >= 0) acc[best] += acc[c];
  }
  // towns
  const towns = [];
  if (spec.towns) for (const [x, y, p, from] of spec.towns) towns.push({ c: idx(x, y), p, from: from || 0 });
  else {
    const n = spec.nTowns || 3, tr = rng((spec.seed || 1) * 31 + 5);
    for (let k = 0; k < 400 && towns.length < n; k++) {
      const x = 2 + tr.int(W - 4), y = 2 + tr.int(H - 4), c = idx(x, y);
      if (h[c] > 3.2) continue;
      if (towns.some(t => eucl(t.c, c) < 11)) continue;
      towns.push({ c, p: 2 + tr.int(3), from: towns.length === 3 ? 30 + tr.int(30) : 0 });
    }
  }
  const nr = rng((spec.seed || 1) * 97 + 3), used = new Set();
  for (const t of towns) { let nm; do nm = townName(nr); while (used.has(nm)); used.add(nm); t.name = t.name || nm; }
  if (spec.names) spec.names.forEach((nm, i) => towns[i] && (towns[i].name = nm));
  return { spec, W, H, h, acc, down, towns, drought: spec.drought || [], start: spec.start || 1793 };
}
const isStream = (M, c) => M.acc[c] >= C.STREAM;
function rainAt(M, m, forecast) {
  let r = 1 + .32 * Math.cos(2 * Math.PI * (m % 12) / 12);
  if (!forecast) for (const [m0, len] of M.drought) if (m >= m0 && m < m0 + len) r *= .1;
  return r;
}
const inDrought = (M, m) => M.drought.some(([m0, len]) => m >= m0 && m < m0 + len);

// ================= a canal design =================
// D = { paths: [[cell, ...]], lv: {cell: level}, locks: {"a-b": {t:'flight'|'stair'|'plane', ponds, dbl, pump}}, res: [cell] }
const newDesign = () => ({ paths: [], lv: {}, locks: {}, res: [] });
const clone = D => JSON.parse(JSON.stringify(D));
function cellInfo(M, c, L) {
  const h = M.h[c], d = L - h; let k = 'plain', cost = C.CELL, depth = 0;
  if (d < -.7) { const x = -.7 - d, cut = C.CELL + C.CUT * x * x; depth = -d; if (cut > C.TUN) { k = 'tunnel'; cost = C.TUN; } else { k = 'cut'; cost = cut; } }
  else if (d > .8) { const x = d - .8, bank = C.CELL + C.BANK * x * x; depth = d; if (bank > C.AQ) { k = 'aqueduct'; cost = C.AQ; } else { k = 'bank'; cost = bank; } }
  const stream = isStream(M, c);
  if (stream && k !== 'aqueduct' && k !== 'tunnel') cost += C.CULVERT;
  return { k, cost, depth, feeds: stream && (k === 'plain' || k === 'cut'), leakMul: { plain: 1, cut: .8, tunnel: .4, bank: 2.4, aqueduct: 2 }[k] };
}
const LOCKT = {
  flight: { name: 'Flight of locks', one: 'Lock', cost: n => C.FLIGHT * n, cap: () => C.CAP, w: () => 1, time: n => .8 * n },
  stair: { name: 'Staircase', one: 'Lock', cost: n => C.STAIR * n, cap: n => C.CAP * 2 / (n + 1), w: n => (n + 1) / 2, time: n => .6 * n },
  plane: { name: 'Inclined plane', one: 'Inclined plane', cost: n => C.PLANE + C.PLANE_N * n, cap: () => C.PLANECAP, w: () => 0, time: n => 1 + .05 * n },
};
function siteOf(M, D, a, b) {
  const la = D.lv[a], lb = D.lv[b], n = Math.abs(la - lb), key = ekey(a, b), cfg = D.locks[key] || {};
  const t = LOCKT[cfg.t] ? cfg.t : 'flight', T = LOCKT[t];
  let cost = T.cost(n), cap = T.cap(n), w = T.w(n);
  if (t !== 'plane' && cfg.ponds) { cost += C.PONDS * n; w *= 2 / 3; }
  if (cfg.dbl) { cost *= C.DBL; cap *= 2; w *= t === 'plane' ? 1 : .8; }
  if (cfg.pump) cost += C.PUMP;
  if (t === 'stair' && n === 1) { /* a one-rise staircase is just a lock */ }
  return { key, a, b, hiC: la > lb ? a : b, loC: la > lb ? b : a, n, t, ponds: !!cfg.ponds && t !== 'plane', dbl: !!cfg.dbl, pump: !!cfg.pump, cost, cap, w, time: T.time(n) };
}

function analyse(M, D) {
  const cells = new Map(), edges = new Map();
  const cellOf = c => { let o = cells.get(c); if (!o) { const L = Number.isInteger(D.lv[c]) ? D.lv[c] : Math.round(M.h[c]); D.lv[c] = L; o = { c, lv: L, nb: [], len: 0 }; cells.set(c, o); } return o; };
  for (const p of D.paths) for (let i = 0; i < p.length; i++) {
    cellOf(p[i]);
    if (i && adj(p[i - 1], p[i])) { const k = ekey(p[i - 1], p[i]); if (!edges.has(k)) { const e = { key: k, a: Math.min(p[i - 1], p[i]), b: Math.max(p[i - 1], p[i]), len: stepLen(p[i - 1], p[i]) }; edges.set(k, e); cells.get(e.a).nb.push(e); cells.get(e.b).nb.push(e); } }
  }
  for (const e of edges.values()) { cells.get(e.a).len += e.len / 2; cells.get(e.b).len += e.len / 2; }
  let cost = { canal: 0, tunnel: 0, aqueduct: 0, cut: 0, bank: 0, locks: 0, res: 0 };
  for (const o of cells.values()) { o.len = Math.max(.5, o.len); Object.assign(o, cellInfo(M, o.c, o.lv)); const k = o.k === 'plain' ? 'canal' : o.k; cost[k] += o.cost * o.len; }
  // pounds: canal cells joined at the same level
  const par = new Map(); const find = x => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
  for (const c of cells.keys()) par.set(c, c);
  const sites = [];
  for (const e of edges.values()) { if (D.lv[e.a] === D.lv[e.b]) par.set(find(e.a), find(e.b)); else sites.push(siteOf(M, D, e.a, e.b)); }
  const pmap = new Map(), pounds = [];
  for (const o of cells.values()) {
    const rt = find(o.c); let p = pmap.get(rt);
    if (!p) { p = { id: pounds.length, lv: o.lv, cells: [], len: 0, cap: 0, leak: 0, feed: 0, down: [], up: [], res: [], tunnel: 0 }; pmap.set(rt, p); pounds.push(p); }
    p.cells.push(o.c); p.len += o.len; o.pound = p.id;
    p.leak += C.LEAK * o.len * o.leakMul; if (o.feeds) p.feed += C.FEED * M.acc[o.c];
    if (o.k === 'tunnel') p.tunnel += o.len;
  }
  for (const p of pounds) p.cap = C.STORE * p.len;
  for (const s of sites) { s.hi = cells.get(s.hiC).pound; s.lo = cells.get(s.loC).pound; pounds[s.hi].down.push(s); pounds[s.lo].up.push(s); cost.locks += s.cost; }
  // tunnels: one boat at a time each way, so a long bore is a bottleneck
  const tun = [], tseen = new Set();
  for (const o of cells.values()) if (o.k === 'tunnel' && !tseen.has(o.c)) {
    const run = { cells: [], len: 0 }, st = [o.c]; tseen.add(o.c);
    while (st.length) { const c = st.pop(), oc = cells.get(c); run.cells.push(c); run.len += oc.len; for (const e of oc.nb) { const n = e.a === c ? e.b : e.a; if (!tseen.has(n) && cells.get(n).k === 'tunnel') { tseen.add(n); st.push(n); } } }
    run.cap = 150 / (1 + run.len / 5); run.id = tun.length; run.cells.forEach(c => cells.get(c).tun = run.id); tun.push(run);
  }
  // reservoirs: a dam on a stream, fed by its catchment, drained down a feeder to the nearest pound it stands above
  const res = [];
  for (const rc of D.res || []) {
    if (!(rc >= 0 && rc < N) || !isStream(M, rc) || cells.has(rc)) { res.push({ c: rc, bad: 'not on a stream' }); continue; }
    let best = null, bd = 1e9;
    for (const o of cells.values()) { if (o.lv > M.h[rc] - .3) continue; const d = cheb(rc, o.c); if (d <= C.RREACH && (d < bd || (d === bd && o.lv > best.lv))) { bd = d; best = o; } }
    const r = { c: rc, inflow: C.RFEED * M.acc[rc], cap: C.RCAP, cost: C.RCOST + C.FEEDER * (best ? bd : 0) };
    if (!best) r.bad = 'no pound below it within reach'; else { r.to = best.c; r.pound = best.pound; r.dist = bd; pounds[best.pound].res.push(res.length); }
    res.push(r); cost.res += r.cost;
  }
  const total = Object.values(cost).reduce((a, b) => a + b, 0);
  // routes between every pair of towns on the network
  const towns = M.towns.map((t, i) => ({ i, c: t.c, on: cells.has(t.c) }));
  const siteByKey = new Map(sites.map(s => [s.key, s]));
  const routes = [];
  for (let i = 0; i < towns.length; i++) if (towns[i].on) {
    const dist = new Map([[towns[i].c, 0]]), prev = new Map(), done = new Set();
    for (;;) {
      let u = -1, du = Infinity; for (const [c, d] of dist) if (!done.has(c) && d < du) { du = d; u = c; }
      if (u < 0) break; done.add(u);
      for (const e of cells.get(u).nb) {
        const v = e.a === u ? e.b : e.a, s = siteByKey.get(e.key), ou = cells.get(u), ov = cells.get(v);
        const wt = e.len * ((ou.k === 'tunnel' || ov.k === 'tunnel') ? 1.5 : 1) + (s ? s.time : 0);
        if (du + wt < (dist.get(v) ?? Infinity)) { dist.set(v, du + wt); prev.set(v, e); }
      }
    }
    for (let j = i + 1; j < towns.length; j++) if (towns[j].on && dist.has(towns[j].c)) {
      const rs = [], rp = new Set(), rt = new Set(), cl = [towns[j].c]; let c = towns[j].c;
      rp.add(cells.get(c).pound);
      while (c !== towns[i].c) { const e = prev.get(c); const s = siteByKey.get(e.key); if (s) rs.push(sites.indexOf(s)); c = e.a === c ? e.b : e.a; cl.push(c); const o = cells.get(c); rp.add(o.pound); if (o.tun != null) rt.add(o.tun); }
      const ot = cells.get(towns[j].c); if (ot.tun != null) rt.add(ot.tun);
      const e = eucl(towns[i].c, towns[j].c), t = dist.get(towns[j].c), A = Math.min(1, (1.3 * e / Math.max(t, .1)) ** 2);
      routes.push({ i, j, e, t, A, sites: rs, pounds: [...rp], tuns: [...rt], cells: cl.reverse() });
    }
  }
  const order = pounds.map(p => p.id).sort((a, b) => pounds[b].lv - pounds[a].lv);
  return { M, D, cells, edges, sites, pounds, tun, res, routes, towns, cost, total, order };
}

// ================= the monthly model =================
function newState(an) {
  return { m: 0, S: an.pounds.map(p => p.cap), RV: an.res.map(r => r.cap * .6), rev: 0, run: 0, spent: an.total, boats: 0, lostW: 0, lostC: 0, lostR: 0, dryMonths: 0, log: [] };
}
const popAt = (t, m) => t.from && m < t.from ? t.p * .12 : t.p;
function stepMonth(an, st, opt = {}) {
  const M = an.M, m = st.m, rain = rainAt(M, m, opt.forecast), G = Math.pow(C.GROW, m);
  const P = an.pounds, nP = P.length;
  const rec = { m, rain, boats: 0, rev: 0, lostW: 0, lostC: 0, lostR: 0, dry: [], jam: [], flows: [] };
  // demand along each route, cut by empty pounds
  const nav = P.map((p, i) => Math.min(1, st.S[i] / (.25 * p.cap + 1e-9)));
  const f = an.routes.map(r => {
    const full = C.K * popAt(M.towns[r.i], m) * popAt(M.towns[r.j], m) * G, d = full * r.A;
    rec.lostR += full - d;
    let k = 1; for (const p of r.pounds) k = Math.min(k, nav[p]);
    rec.lostW += d * (1 - k); return d * k;
  });
  // locks and tunnels pass only so many boats a month
  const load = s => an.routes.reduce((a, r, ri) => r.sites.includes(s) ? a + f[ri] : a, 0);
  const sr = an.sites.map((s, si) => { const l = load(si); return l > s.cap ? s.cap / l : 1; });
  const tr = an.tun.map((t, ti) => { const l = an.routes.reduce((a, r, ri) => r.tuns.includes(ti) ? a + f[ri] : a, 0); return l > t.cap ? t.cap / l : 1; });
  an.routes.forEach((r, ri) => { let k = 1; for (const s of r.sites) k = Math.min(k, sr[s]); for (const t of r.tuns) k = Math.min(k, tr[t]); rec.lostC += f[ri] * (1 - k); f[ri] *= k; });
  an.sites.forEach((s, si) => { if (sr[si] < .999) rec.jam.push(si); });
  // water: from the highest pound down, each lock passes lockfuls from its upper pound to its lower one
  const inflow = new Float64Array(nP), q = new Float64Array(an.sites.length), RV = st.RV;
  let running = 0;
  for (const pi of an.order) {
    const p = P[pi];
    let avail = st.S[pi] + inflow[pi] + p.feed * rain - p.leak;
    let want = 0; const dl = p.down.map(s => { const si = an.sites.indexOf(s), w = s.w * load(si); want += w; return [si, w]; });
    let resAv = 0; for (const ri of p.res) resAv += Math.min(C.RREL, RV[ri]);
    if (want > avail + resAv && want > 0) { // not enough water: the locks below this pound work fewer boats
      const k = Math.max(0, avail + resAv) / want;
      an.routes.forEach((r, ri) => { if (r.sites.some(si => an.sites[si].hi === pi && an.sites[si].w > 0)) { rec.lostW += f[ri] * (1 - k); f[ri] *= k; } });
      rec.dry.push(pi);
    }
    let out = 0; for (const [si] of dl) { q[si] = an.sites[si].w * load(si); out += q[si]; }
    let S = avail - out;
    // reservoirs top the pound up
    for (const ri of p.res) { const need = Math.max(0, p.cap - S), rel = Math.min(C.RREL, RV[ri], need); RV[ri] -= rel; S += rel; }
    if (S < 0) S = 0;
    if (S > p.cap) { // over the weirs and down to the next pound, or away to the river
      const ex = S - p.cap; S = p.cap;
      if (p.down.length) for (const s of p.down) inflow[s.lo] += ex / p.down.length;
    }
    st.S[pi] = S;
    for (const [si] of dl) inflow[an.sites[si].lo] += q[si];
  }
  // back-pumps return water from the foot of a lock to its head
  for (const s of an.sites) if (s.pump) {
    const lo = P[s.lo], hi = P[s.hi], amt = Math.max(0, Math.min(C.PUMPCAP, st.S[s.lo] - .3 * lo.cap, hi.cap - st.S[s.hi]));
    if (amt > 0) { st.S[s.lo] -= amt; st.S[s.hi] += amt; running += C.RUN_PUMP * amt; }
  }
  an.res.forEach((r, ri) => { if (!r.bad) RV[ri] = Math.min(r.cap, RV[ri] + r.inflow * rain); });
  // tolls and running costs
  an.routes.forEach((r, ri) => { rec.boats += f[ri]; rec.rev += f[ri] * C.R * r.e; rec.flows.push(f[ri]); });
  for (const s of an.sites) { running += s.t === 'plane' ? C.RUN_PLANE + C.RUN_PLANE_BOAT * load(an.sites.indexOf(s)) : C.RUN_LOCK * s.n * (s.dbl ? 2 : 1); }
  for (const p of P) running += C.RUN_TUN * p.tunnel + C.RUN_CELL * p.len;
  rec.run = running;
  st.rev += rec.rev; st.run += running; st.boats += rec.boats; st.lostW += rec.lostW; st.lostC += rec.lostC; st.lostR += rec.lostR;
  if (rec.dry.length) st.dryMonths++;
  rec.fill = P.map((p, i) => st.S[i] / p.cap); rec.res = RV.slice();
  st.m++;
  return rec;
}
function connected(an) { // every town that matters is on one network with the first town
  const need = an.towns.filter((t, i) => an.M.towns[i].req !== false);
  if (!need.every(t => t.on)) return false;
  const reach = new Set([need[0].i]); for (const r of an.routes) if (r.i === need[0].i) reach.add(r.j);
  return need.every(t => reach.has(t.i));
}
function simulate(M, D, opt = {}) {
  const an = analyse(M, clone(D)), st = newState(an), months = [];
  for (let m = 0; m < C.MONTHS; m++) months.push(stepMonth(an, st, opt));
  const div = st.rev - st.spent - st.run;
  return { an, cost: an.total, rev: st.rev, run: st.run, dividend: div, boats: st.boats, tons: st.boats * C.TONS, lostW: st.lostW, lostC: st.lostC, lostR: st.lostR, dryMonths: st.dryMonths, months, ok: connected(an) && an.routes.length > 0 };
}
const score = (M, D, opt) => { const r = simulate(M, D, opt); return r.ok ? r.dividend : -999; };

// ================= drawing helpers the page and planner share =================
function lineCells(a, b) { // 8-connected cells from a to b (excluding a)
  const out = []; let [x, y] = xy(a); const [x1, y1] = xy(b);
  while (x !== x1 || y !== y1) { const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y), ax = Math.abs(x1 - x), ay = Math.abs(y1 - y);
    if (ax > 2 * ay) x += dx; else if (ay > 2 * ax) y += dy; else { x += dx; y += dy; } out.push(idx(x, y)); }
  return out;
}
// what a fresh stretch of canal does by default: follow the contours, stepping a lock only when the ground leaves it behind
function autoLevel(M, D, path, from = 0) {
  let prev = null;
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    if (i < from || Number.isInteger(D.lv[c]) && (i < from || D.paths.some(p => p !== path && p.includes(c)))) { prev = D.lv[c]; continue; }
    const g = Math.round(M.h[c]);
    D.lv[c] = prev == null ? g : (Math.abs(M.h[c] - prev) >= .9 ? g : prev);
    prev = D.lv[c];
  }
}
function addPath(M, D, path) { // path: array of adjacent cells. Levels of new cells follow the ground.
  const fresh = path.filter(c => !(c in D.lv));
  let prev = null;
  for (const c of path) { if (fresh.includes(c)) { const g = Math.round(M.h[c]); D.lv[c] = prev == null ? g : (Math.abs(M.h[c] - prev) >= .9 ? g : prev); } prev = D.lv[c]; }
  D.paths.push(path.slice());
}
function prune(D) { // drop levels, locks and nothing-paths no longer used
  D.paths = D.paths.filter(p => p.length >= 2);
  const used = new Set(D.paths.flat()); for (const k in D.lv) if (!used.has(+k)) delete D.lv[k];
  const ek = new Set(); for (const p of D.paths) for (let i = 1; i < p.length; i++) ek.add(ekey(p[i - 1], p[i]));
  for (const k in D.locks) if (!ek.has(k) || D.lv[+k.split('-')[0]] === D.lv[+k.split('-')[1]]) delete D.locks[k];
}

// ================= the planner (the canal company's engineers) =================
function routeGrid(M, from, targets, al, be, hRef) {
  const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  dist[from] = 0;
  for (;;) {
    let u = -1, du = Infinity; for (let c = 0; c < N; c++) if (!done[c] && dist[c] < du) { du = dist[c]; u = c; }
    if (u < 0) return null; if (targets.has(u)) { const p = [u]; while (prev[p[0]] >= 0) p.unshift(prev[p[0]]); return p; }
    done[u] = 1; const [x, y] = xy(u);
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const v = idx(nx, ny); if (done[v]) continue;
      const w = (dx && dy ? Math.SQRT2 : 1) * (1 + be * Math.max(0, M.h[v] - hRef)) + al * Math.abs(M.h[v] - M.h[u]);
      if (du + w < dist[v]) { dist[v] = du + w; prev[v] = u; } }
  }
}
function levelDP(M, D, path, lam, stair) { // the cheapest levels along a fixed route: cuttings, banks, tunnels and locks traded off
  const LV = 13, n = path.length, cost = Array.from({ length: n }, () => new Float64Array(LV).fill(Infinity)), back = Array.from({ length: n }, () => new Int8Array(LV));
  const fixed = i => (Number.isInteger(D.lv[path[i]]) ? D.lv[path[i]] : (i === 0 || i === n - 1) ? Math.round(M.h[path[i]]) : -1);
  const lockC = d => d === 0 ? 0 : (stair && d >= 2 ? C.STAIR : C.FLIGHT) * d + lam * d;
  for (let i = 0; i < n; i++) {
    const fx = fixed(i), len = i === 0 || i === n - 1 ? .75 : 1;
    for (let L = 0; L < LV; L++) {
      if (fx >= 0 && L !== fx) continue;
      const cc = cellInfo(M, path[i], L).cost * len;
      if (i === 0) { cost[i][L] = cc; continue; }
      for (let P2 = 0; P2 < LV; P2++) { const v = cost[i - 1][P2] + lockC(Math.abs(L - P2)) + cc; if (v < cost[i][L]) { cost[i][L] = v; back[i][L] = P2; } }
    }
  }
  let L = 0; for (let k = 0; k < LV; k++) if (cost[n - 1][k] < cost[n - 1][L]) L = k;
  const out = new Array(n); for (let i = n - 1; i >= 0; i--) { out[i] = L; L = back[i][L]; }
  return out;
}
function townTree(M) { // which towns to join, in order: Prim's tree from the first town
  const T = M.towns.map((t, i) => i), inT = [0], edges = [];
  while (inT.length < T.length) {
    let best = null; for (const a of inT) for (const b of T) if (!inT.includes(b)) { const d = eucl(M.towns[a].c, M.towns[b].c); if (!best || d < best[2]) best = [a, b, d]; }
    inT.push(best[1]); edges.push(best);
  }
  return edges;
}
function planDesign(M, v) {
  const D = newDesign();
  for (const [a, b] of townTree(M)) {
    const from = M.towns[b].c, tg = new Set([M.towns[a].c, ...D.paths.flat()]);
    const hRef = Math.max(M.h[M.towns[a].c], M.h[from]);
    const path = routeGrid(M, from, tg, v.al, v.be, hRef); if (!path) continue;
    const L = levelDP(M, D, path, v.lam, v.stair);
    path.forEach((c, i) => { if (!Number.isInteger(D.lv[c])) D.lv[c] = L[i]; });
    D.paths.push(path);
    if (v.stair) for (let i = 1; i < path.length; i++) if (Math.abs(D.lv[path[i]] - D.lv[path[i - 1]]) >= 2) D.locks[ekey(path[i - 1], path[i])] = { t: 'stair' };
  }
  return D;
}
function bestReservoir(M, an, pi) {
  const p = an.pounds[pi]; let best = -1, bv = -1;
  const taken = new Set(an.res.map(r => r.c));
  for (let c = 0; c < N; c++) if (isStream(M, c) && !an.cells.has(c) && !taken.has(c) && M.h[c] - .3 >= p.lv) {
    let d = 99; for (const pc of p.cells) d = Math.min(d, cheb(c, pc)); if (d > C.RREACH) continue;
    // a dam must feed this pound, not a nearer one
    let nearer = false; for (const o of an.cells.values()) if (o.lv <= M.h[c] - .3 && cheb(c, o.c) < d) { nearer = true; break; }
    if (nearer) continue;
    const val = M.acc[c] - d * .8; if (val > bv) { bv = val; best = c; }
  }
  return best;
}
// improve a design greedily: dams for thirsty pounds, then upgrades where the run shows trouble
function improve(M, D0, tries = 6) {
  let D = clone(D0), r = simulate(M, D), best = r.ok ? r.dividend : -999;
  for (let k = 0; k < tries; k++) {
    const cand = [];
    const dryCount = new Map(); for (const mo of r.months) for (const pi of mo.dry) dryCount.set(pi, (dryCount.get(pi) || 0) + 1);
    for (const mo of r.months) mo.fill.forEach((f, pi) => { if (f < .3) dryCount.set(pi, (dryCount.get(pi) || 0) + .5); });
    const thirsty = [...dryCount.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 2);
    for (const pi of thirsty) {
      const rc = bestReservoir(M, r.an, pi); if (rc >= 0) { const E = clone(D); E.res.push(rc); cand.push(E); }
      for (const s of r.an.pounds[pi].down) { const E = clone(D); E.locks[s.key] = { ...(E.locks[s.key] || {}), ponds: 1 }; cand.push(E); }
      const sd = r.an.pounds[pi].down[0]; if (sd) { const E = clone(D); E.locks[sd.key] = { ...(E.locks[sd.key] || {}), pump: 1 }; cand.push(E); }
    }
    const jams = new Map(); for (const mo of r.months) for (const si of mo.jam) jams.set(si, (jams.get(si) || 0) + 1);
    for (const [si] of [...jams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)) { const s = r.an.sites[si], E = clone(D); E.locks[s.key] = { ...(E.locks[s.key] || {}), dbl: 1 }; cand.push(E); const E2 = clone(D); E2.locks[s.key] = { t: 'plane' }; cand.push(E2); }
    let bd = null, br = null;
    for (const E of cand) { const rr = simulate(M, E); const v = rr.ok ? rr.dividend : -999; if (v > best + .5) { best = v; bd = E; br = rr; } }
    if (!bd) break; D = bd; r = br;
  }
  return { D, r, dividend: best };
}
const VARIANTS = [];
for (const al of [0, 1.5, 6]) for (const be of [0, .6, 3]) for (const lam of [0, 6]) VARIANTS.push({ al, be, lam, stair: 0 });
VARIANTS.push({ al: 1.5, be: .6, lam: 0, stair: 1 }, { al: 6, be: 0, lam: 0, stair: 1 }, { al: 0, be: 0, lam: 20, stair: 0 }, { al: 0, be: 8, lam: 0, stair: 0 });
function plan(M, opt = {}) {
  const field = [], seen = new Set();
  for (const v of opt.variants || VARIANTS) {
    const D = planDesign(M, v), sig = JSON.stringify(D); if (seen.has(sig)) continue; seen.add(sig);
    const raw = simulate(M, D); field.push({ v, D, dividend: raw.ok ? raw.dividend : -999, raw: 1 });
    if (opt.improve !== false) { const im = improve(M, D, opt.tries || 6); field.push({ v, D: im.D, dividend: im.dividend }); }
  }
  field.sort((a, b) => b.dividend - a.dividend);
  return { best: field[0], field };
}
// the naive engineer: a straight line between towns, levels following the ground
function naiveDesign(M) {
  const D = newDesign();
  for (const [a, b] of townTree(M)) {
    const tg = new Set([M.towns[a].c, ...D.paths.flat()]); let best = M.towns[a].c, bd = 1e9;
    for (const c of tg) { const d = eucl(c, M.towns[b].c); if (d < bd) { bd = d; best = c; } }
    const path = [M.towns[b].c, ...lineCells(M.towns[b].c, best)];
    addPath(M, D, path);
  }
  return D;
}

// ================= share codes =================
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function enc(D) {
  const parts = D.paths.map(p => { let s = B64[p[0] >> 6] + B64[p[0] & 63]; for (let i = 1; i < p.length; i++) { const [ax, ay] = xy(p[i - 1]), [bx, by] = xy(p[i]); s += DIRS.findIndex(d => d[0] === bx - ax && d[1] === by - ay); } return s + '.' + p.map(c => B64[D.lv[c] & 63]).join(''); });
  const lk = Object.entries(D.locks).map(([k, v]) => { const [a, b] = k.split('-').map(Number); return B64[a >> 6] + B64[a & 63] + DIRS.findIndex(d => { const [ax, ay] = xy(a), [bx, by] = xy(b); return d[0] === bx - ax && d[1] === by - ay; }) + ({ flight: 'f', stair: 's', plane: 'p' }[v.t] || 'f') + (v.ponds ? 'o' : '') + (v.dbl ? 'd' : '') + (v.pump ? 'u' : ''); });
  const rs = (D.res || []).map(c => B64[c >> 6] + B64[c & 63]).join('');
  return parts.join('~') + '!' + lk.join('~') + '!' + rs;
}
function dec(s) {
  if (typeof s !== 'string' || s.length > 6000) return null;
  const [ps, ls = '', rs = ''] = s.split('!'), D = newDesign();
  const cell2 = t => { const a = B64.indexOf(t[0]), b = B64.indexOf(t[1]); if (a < 0 || b < 0) return -1; const c = a * 64 + b; return c < N ? c : -1; };
  if (ps) for (const part of ps.split('~')) {
    const [cd, lvs] = part.split('.'); if (!cd || !lvs || cd.length < 3) return null;
    let c = cell2(cd); if (c < 0) return null; const p = [c];
    for (const ch of cd.slice(2)) { const d = DIRS[+ch]; if (!d) return null; const [x, y] = xy(c); if (!inb(x + d[0], y + d[1])) return null; c = idx(x + d[0], y + d[1]); p.push(c); }
    if (lvs.length !== p.length) return null;
    for (let i = 0; i < p.length; i++) { const L = B64.indexOf(lvs[i]); if (L < 0 || L > 13) return null; D.lv[p[i]] = L; }
    D.paths.push(p);
  }
  if (ls) for (const t of ls.split('~')) {
    const a = cell2(t), d = DIRS[+t[2]]; if (a < 0 || !d) return null; const [x, y] = xy(a); if (!inb(x + d[0], y + d[1])) return null;
    const b = idx(x + d[0], y + d[1]), fl = t.slice(3);
    D.locks[ekey(a, b)] = { t: { f: 'flight', s: 'stair', p: 'plane' }[fl[0]] || 'flight', ...(fl.includes('o') ? { ponds: 1 } : {}), ...(fl.includes('d') ? { dbl: 1 } : {}), ...(fl.includes('u') ? { pump: 1 } : {}) };
  }
  for (let i = 0; i + 1 < rs.length; i += 2) { const c = cell2(rs.slice(i, i + 2)); if (c < 0) return null; D.res.push(c); }
  return D;
}

const API = { W, H, N, C, DIRS, xy, idx, inb, adj, ekey, eucl, cheb, rng, hashStr, randomSpec, genMap, isStream, rainAt, inDrought, newDesign, clone, cellInfo, LOCKT, analyse, newState, stepMonth, simulate, score, connected,
  lineCells, autoLevel, addPath, prune, routeGrid, levelDP, planDesign, improve, plan, naiveDesign, townTree, bestReservoir, enc, dec, VARIANTS, stepLen };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CANAL = API;
})(typeof window !== 'undefined' ? window : globalThis);
