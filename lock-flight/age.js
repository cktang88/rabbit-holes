// Canal Mania: The Canal Age. A seventy-year company game on top of the canal model in core.js.
// Industries spawn and grow over the decades, and grow faster where your canal carries their cargo; rival companies
// petition for the valleys you leave empty; from about 1830 railways open between the busiest places and undercut slow,
// winding, dear canals. Money is the company's own: capital at the start, then only tolls pay for new works.
// Score: company value in 1860 (cash plus eight years' purchase of the last years' net income).
(function (root) {
'use strict';
const K = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.CANAL;
const { W, H, N, C, idx, xy, inb, eucl, cheb, rng, isStream, ekey } = K;

const E = {
  START: 1790, YEARS: 70, CAPITAL: 280, COST: 2,  // works cost twice the commissions' prices (a canal age of dearer labour)          // £k subscribed by the proprietors
  TOLLS: [.5, .75, 1, 1.5, 2], EPS: .65,         // toll levels; how much traffic a dearer toll drives off (before railways)
  BUY: 8, REV: .7,                      // tolls per boat-furlong, relative to the commissions                                        // years' purchase: value = cash + BUY × annual net income
  LOCAL: 1.2,                                    // share of every output that never travels far (by road, whatever you build)
  GROW: .14, DECAY: .04, OUT: 1.8, TGROW: .006, TSERVE: .035,
  RIVAL_LEAD: 36, WIND: 36,                      // months' warning of a rival canal; months in debt before the company is wound up
  RAIL_FROM: 1829, RAILK: 4,
};
// what each kind of place sends, and where (weights by destination type)
const TYPES = {
  town: { n: 'Town', w: { town: 1, port: 1.4, mill: .3, pottery: .2, iron: .2 }, rail: 1 },
  port: { n: 'Port', w: { town: 1.2, iron: .6, mill: .8, pottery: .4 }, rail: 1.1 },
  coal: { n: 'Colliery', o0: 24, max: 70, w: { iron: 3, pottery: 2, mill: 1.4, town: 1, port: 1.1 }, rail: 1.45 },
  pottery: { n: 'Potteries', o0: 13, max: 40, w: { town: 1.2, port: 2 }, rail: .95 },
  iron: { n: 'Ironworks', o0: 18, max: 60, w: { town: 1, port: 1.6, mill: .6, coal: .4 }, rail: 1.25 },
  mill: { n: 'Mill', o0: 11, max: 40, w: { port: 2.4, town: 1 }, rail: .95 },
};
const SUFFIX = { coal: 'Colliery', pottery: 'Potteries', iron: 'Ironworks', mill: 'Mill' };

// ================= the country, with a port and the first industries =================
function newGame(seed, opt = {}) {
  const spec = opt.spec || K.goodSpec(seed), r = rng(seed * 977 + 31);
  // seventy years of weather: a dry summer one year in four or so
  spec.drought = []; for (let y = 1; y < E.YEARS; y++) if (r() < .27) spec.drought.push([y * 12 + 5 + r.int(3), 2 + r.int(4)]);
  const M = K.genMap(spec); M.start = E.START;
  const places = M.towns.map(t => ({ type: 'town', c: t.c, p: t.p, p0: t.p, name: t.name, born: 0 }));
  // the port: where the biggest river meets the sea (the map edge)
  let pc = -1, pa = -1; for (let c = 0; c < N; c++) { const [x, y] = xy(c); if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && M.acc[c] > pa && !places.some(p => cheb(p.c, c) < 4)) { pa = M.acc[c]; pc = c; } }
  const [px, py] = xy(pc), inset = idx(Math.min(W - 2, Math.max(1, px)), Math.min(H - 2, Math.max(1, py)));
  places.push({ type: 'port', c: inset, p: 5, p0: 5, name: (places.length ? places.reduce((a, b) => eucl(a.c, inset) < eucl(b.c, inset) ? a : b).name : 'Old') + ' Haven', born: 0 });
  const G = { seed, M, places, D: K.newDesign(), cash: opt.capital ?? E.CAPITAL, m: 0, tolls: {}, mode: {}, fly: {}, unlocked: new Set(), log: [], opened: false, rivals: [], rails: [], news: [], years: [], spent: 0, rev: 0, run: 0,
    debt: 0, over: false, wound: -1, rngEv: rng(seed * 131 + 7), dirty: true, flowsY: null, yr: newYear(), valueHist: [], events: [] };
  M.towns = places; // the canal model routes between every place on the network
  spawn(G, 'coal', true); spawn(G, G.rngEv() < .5 ? 'pottery' : 'mill', true);
  schedule(G); potentials(G); reanalyse(G);
  return G;
}
function newYear() { return { rev: 0, run: 0, built: 0, boats: 0, lostW: 0, lostC: 0, dry: 0, rail: 0 }; }
// when things will happen (the shape is seeded; where industries settle depends on the player's canals)
function schedule(G) {
  const r = G.rngEv; G.plan = [];
  for (let y = 3; y < 62; y += 3 + r.int(4)) G.plan.push({ m: y * 12 + r.int(12), k: 'spawn' });
  for (const y of [7, 16, 25, 34]) G.plan.push({ m: (y + r.int(4)) * 12 + r.int(12), k: 'rival' });
  for (let y = E.RAIL_FROM - E.START + r.int(4); y < E.YEARS - 1; y += 3 + r.int(3)) G.plan.push({ m: y * 12 + r.int(12), k: 'rail' });
  G.plan.sort((a, b) => a.m - b.m);
}
const year = (G, m = G.m) => E.START + Math.floor(m / 12);
function nearestTown(G, c) { let b = null, bd = 1e9; for (const p of G.places) if (p.type === 'town' || p.type === 'port') { const d = eucl(p.c, c); if (d < bd) { bd = d; b = p; } } return b; }
function spawn(G, type, initial) {
  const M = G.M, r = G.rngEv, cells = new Set(Object.keys(G.D.lv).map(Number)), taken = c => G.places.some(p => cheb(p.c, c) < 3);
  const cand = [];
  for (let c = 0; c < N; c++) {
    const [x, y] = xy(c); if (x < 1 || y < 1 || x > W - 2 || y > H - 2 || taken(c)) continue;
    let w = 0;
    if (type === 'coal') w = M.h[c] > 2.4 && M.h[c] < 6.5 && !isStream(M, c) ? 1 : 0; // pits in the foothills
    else if (type === 'mill') w = isStream(M, c) && M.acc[c] < 40 ? 1 : 0;
    else if (type === 'pottery') { const t = nearestTown(G, c); w = t && eucl(t.c, c) < 6 ? 1 : 0; }
    else if (type === 'iron') w = G.places.some(p => p.type === 'coal' && eucl(p.c, c) < 7) ? 1 : 0;
    if (!w) continue;
    if (!initial && cells.size) { let d = 99; for (const q of cells) { d = Math.min(d, cheb(q, c)); if (d <= 1) break; } w *= d <= 2 ? 1.5 : d <= 5 ? 5 : 1; } // industry settles near the canal, but a branch is still yours to dig
    cand.push([c, w]);
  }
  if (!cand.length) return null;
  let tot = cand.reduce((a, b) => a + b[1], 0), u = r() * tot, c = cand[0][0]; for (const [cc, w] of cand) { u -= w; if (u <= 0) { c = cc; break; } }
  const T = TYPES[type], t = nearestTown(G, c), pl = { type, c, p: T.o0 * (.8 + .4 * r()), p0: T.o0, name: (t ? t.name.replace(/^Port /, '') : 'New') + ' ' + SUFFIX[type], born: G.m };
  if (G.places.some(p => p.name === pl.name)) pl.name = ['North', 'South', 'East', 'West', 'Upper', 'Nether'][r.int(6)] + ' ' + pl.name;
  G.places.push(pl); G.dirty = true; return pl;
}
// what each place would send to each other place in a month, if every route were free and instant
function potentials(G) {
  const P = G.places, n = P.length, out = P.map(p => E.OUT * (p.type === 'town' ? 3 * p.p : p.type === 'port' ? 2.5 * p.p : p.p));
  const size = p => p.type === 'town' ? p.p / 4 : p.type === 'port' ? p.p / 4 : Math.sqrt(p.p / (TYPES[p.type].o0 || 10));
  G.pot = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    const w = TYPES[P[i].type].w; let tot = E.LOCAL; const ws = new Float64Array(n);
    for (let j = 0; j < n; j++) if (j !== i) { ws[j] = (w[P[j].type] || 0) * size(P[j]) / (1 + eucl(P[i].c, P[j].c) / 25); tot += ws[j]; }
    for (let j = 0; j < n; j++) G.pot[i][j] = out[i] * ws[j] / tot;
  }
}
// rails: a graph of lines between places; a pair both on it can go by rail
function railLinked(G, i, j) {
  if (!G.rails.length) return false; const seen = new Set([i]), st = [i];
  while (st.length) { const a = st.pop(); if (a === j) return true; for (const [u, v] of G.rails) { const b = u === a ? v : v === a ? u : -1; if (b >= 0 && !seen.has(b)) { seen.add(b); st.push(b); } } }
  return false;
}
const onRail = (G, i) => G.rails.some(([u, v]) => u === i || v === i);
// the toll on a route: the average level over the sections (drawn canals) it runs along
function routeToll(G, r) { let s = 0, n = 0; for (const c of r.cells) { const pi = G.cellPath.get(c); s += G.tolls[pi] ?? 1; n++; } return n ? s / n : 1; }
function routeFactors(G) {
  const an = G.an; G.cellPath = new Map(); G.D.paths.forEach((p, pi) => p.forEach(c => { if (!G.cellPath.has(c)) G.cellPath.set(c, pi); }));
  G.rf = an.routes.map(r => {
    const toll = routeToll(G, r), P = G.places, i = r.i, j = r.j, pot = G.pot[i][j] + G.pot[j][i];
    // paired locks make boats wait for a partner; fly-boats (express, day and night) make them quicker
    let t = r.t; for (const si of r.sites) if (G.mode[an.sites[si].key] === 'pair') t += 1.5 + an.sites[si].time;
    const fly = r.cells.some(c => G.fly[G.cellPath.get(c)]); if (fly) t *= .7;
    const A = Math.min(1, (1.3 * r.e / Math.max(t, .1)) ** 2);
    let share = A * Math.pow(toll, -E.EPS);
    const rival = G.rivals.find(v => v.open && ((v.i === i && v.j === j) || (v.i === j && v.j === i)));
    if (rival) share *= .45;
    let rail = 1;
    if (railLinked(G, i, j)) { // the railway: fast, but dearer for heavy goods; a straight, cheap canal keeps much of its trade
      const cc = Math.max(1, t / Math.max(1, r.e)) * Math.sqrt(toll) * (1 + .06 * r.sites.length), rc = (TYPES[P[i].type].rail + TYPES[P[j].type].rail) / 2;
      rail = 1 / (1 + Math.pow(cc / rc, E.RAILK)) * 1.6; rail = Math.min(1, rail);
    }
    return { toll, pot, A, t, fly, share: share * rail, rail, rival: !!rival, d: pot * share * rail };
  });
}
// a place is on the canal if the canal reaches its cell or passes beside it (a wharf and a short tramroad)
function wharves(G) {
  const lv = G.D.lv; G.M.towns = G.places.map(p => { if (p.c in lv) return { c: p.c, p: p.p, name: p.name }; let w = -1, bh = 1e9; const [x, y] = xy(p.c);
    const R = p.type === 'town' || p.type === 'port' ? 1 : 2; // industries can run a short tramroad down to the canal
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const q = idx(x + dx, y + dy); if (inb(x + dx, y + dy) && q in lv && lv[q] + Math.abs(dx) + Math.abs(dy) < bh) { bh = lv[q] + Math.abs(dx) + Math.abs(dy); w = q; } }
    return { c: w >= 0 ? w : p.c, p: p.p, name: p.name, wharf: w >= 0 }; });
}
function reanalyse(G) {
  const old = G.an, D = G.D; wharves(G); G.an = K.analyse(G.M, K.clone(D));
  if (!G.st) G.st = K.newState(G.an);
  else if (old) { // keep the water where the canal still is; new pounds fill from the streams
    const st = G.st, nw = G.an;
    st.S = nw.pounds.map(p => { let s = 0, n = 0; for (const c of p.cells) { const o = old.cells.get(c); if (o) { s += st.S[o.pound] / old.pounds[o.pound].cap; n++; } } return (n ? s / n : .7) * p.cap; });
    st.RV = nw.res.map(r => { const j = old.res.findIndex(q => q.c === r.c); return j >= 0 ? st.RV[j] : r.cap * .25; });
  }
  routeFactors(G); G.dirty = false;
}
// ================= building =================
const costOf = (G, D) => K.analyse(G.M, K.clone(D)).total * E.COST;
const priceOf = (G, D2) => Math.max(0, costOf(G, D2) - (G.an ? G.an.total * E.COST : 0));
// commit a new design if the company can pay for the difference; returns the price (or null if refused)
function build(G, D2) {
  if (G.over) return null; const price = priceOf(G, D2);
  if (price > G.cash + 1e-6) return null;
  G.cash -= price; G.spent += price; G.yr.built += price; G.D = D2; reanalyse(G); return price;
}
function setToll(G, pi, lv) { G.tolls[pi] = lv; routeFactors(G); }

// ================= a month =================
function step(G) {
  if (G.over) return null;
  // the calendar: new industries, rival petitions, railways
  while (G.plan.length && G.plan[0].m <= G.m) event(G, G.plan.shift());
  for (const v of G.rivals) if (!v.open && !v.gone && G.m >= v.at) rivalDecides(G, v);
  if (G.dirty) { potentials(G); reanalyse(G); }
  const rf = G.rf, an = G.an, md = si => G.mode[an.sites[si].key];
  const shut = new Set(Object.keys(G.mode).filter(k => G.mode[k] === 'shut'));
  const coal = G.places.some((p, i) => p.type === 'coal' && an.cells.has(G.M.towns[i].c)); // coal at the wharf makes pumping cheap
  const rec = K.stepMonth(an, G.st, { demand: (r, ri) => rf[ri].d, revK: ri => rf[ri].toll * E.REV, closed: shut, wK: si => md(si) === 'pair' ? .5 : 1, capK: si => md(si) === 'pair' ? .6 : 1, pumpK: coal ? .35 : 1.6 });
  const flyRun = Object.keys(G.fly).filter(k => G.fly[k] && G.D.paths[k]).reduce((a, k) => a + .12 + .015 * G.D.paths[k].length, 0); rec.run += flyRun;
  unlocks(G, rec, coal);
  G.cash += rec.rev - rec.run; G.rev += rec.rev; G.run += rec.run;
  const y = G.yr; y.rev += rec.rev; y.run += rec.run; y.boats += rec.boats; y.lostW += rec.lostW; y.lostC += rec.lostC; if (rec.dry.length) y.dry++;
  // who got served: each route's boats split between its two ends by what each was sending
  if (!G.flowsY || G.flowsY.length < G.places.length) { const f2 = new Float64Array(G.places.length); if (G.flowsY) f2.set(G.flowsY); G.flowsY = f2; }
  G.an.routes.forEach((r, ri) => { const f = rec.flows[ri]; if (!f) return; G.flowsY[r.i] += f; G.flowsY[r.j] += f; });
  G.debt = G.cash < 0 ? G.debt + 1 : 0;
  if (G.debt >= E.WIND) { G.over = true; G.wound = G.m; news(G, 'The company is wound up', `In debt for three years, the proprietors sell the canal for scrap, ${year(G)}.`, 'bad'); }
  G.m++; rec.m = G.m - 1;
  if (G.m % 12 === 0) endYear(G);
  if (G.m >= E.YEARS * 12) G.over = true;
  return rec;
}
function endYear(G) {
  const P = G.places, fl = G.flowsY || new Float64Array(P.length), y = G.yr;
  y.net = y.rev - y.run; y.cash = G.cash; y.year = year(G, G.m - 1); y.value = value(G, y.net); G.years.push(y);
  // places grow where their trade moves: by your canal, a rival's or (later) the railway
  P.forEach((p, i) => {
    let want = 0; for (let j = 0; j < P.length; j++) if (j !== i) want += G.pot[i][j] + G.pot[j][i];
    let served = Math.min(1, (fl[i] || 0) / Math.max(1, 12 * want));
    if (G.rivals.some(v => v.open && (v.i === i || v.j === i))) served = Math.max(served, .3);
    if (onRail(G, i)) served = Math.max(served, .45);
    if (p.type === 'town' || p.type === 'port') p.p = Math.min(30, p.p * (1 + E.TGROW + E.TSERVE * served));
    else { const T = TYPES[p.type]; p.p = Math.max(.45 * T.o0, Math.min(T.max, p.p * (1 + E.GROW * served - E.DECAY))); }
    p.served = served;
  });
  G.flowsY = new Float64Array(P.length); G.yr = newYear(); G.dirty = true;
}
function value(G, net) { const ys = G.years.slice(-3), n = net != null ? [...ys.slice(-2).map(y => y.net), net] : ys.map(y => y.net), avg = n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0; return G.cash + E.BUY * Math.max(0, avg); }
function news(G, t, s, kind = '') { const n = { m: G.m, t, s, kind }; G.news.push(n); G.events.push(n); return n; }
function event(G, ev) {
  const r = G.rngEv, yr = year(G, ev.m); if (G.pot.length !== G.places.length) { potentials(G); reanalyse(G); }
  if (ev.k === 'spawn') {
    const era = yr < 1805 ? ['coal', 'coal', 'pottery', 'mill'] : yr < 1830 ? ['coal', 'iron', 'pottery', 'mill', 'iron'] : ['iron', 'mill', 'coal', 'iron'];
    const pl = spawn(G, r.pick(era)); if (pl) news(G, `${pl.name} opens`, `New ${TYPES[pl.type].n.toLowerCase()} near ${nearestTown(G, pl.c).name}. Cargo waits for a canal.`, 'spawn');
  } else if (ev.k === 'rival') { // the richest trade you leave unserved
    const P = G.places, linked = new Set(G.an.routes.map(q => q.i + '-' + q.j)); let best = null, bv = 4;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { if (linked.has(i + '-' + j) || G.rivals.some(v => (v.i === i && v.j === j))) continue; const v = G.pot[i][j] + G.pot[j][i]; if (v > bv) { bv = v; best = [i, j]; } }
    if (best) { const v = { i: best[0], j: best[1], at: G.m + E.RIVAL_LEAD, open: false, name: (() => { const a = P[best[0]].name.split(' '), b = P[best[1]].name.split(' '); return `${a[0]} & ${b[0] === a[0] ? b[b.length - 1] : b[0]} Canal Co.`; })() };
      G.rivals.push(v); news(G, 'A rival petitions Parliament', `The ${v.name} will open in ${year(G, v.at)} unless your canal joins ${P[v.i].name} and ${P[v.j].name} first.`, 'rival'); }
  } else if (ev.k === 'offer') { // a railway company bids for the canal: the bid falls as the railways spread
    const v = value(G), price = Math.round(v * (1.3 - .08 * ev.n)); if (price > 20 && !G.over) { G.offer = { price, until: G.m + 12 };
      news(G, 'An offer for the canal', `The railway company bids ${price.toLocaleString()} thousand pounds for your canal, good for a year. Sell, and the story ends here; refuse, and fight on to 1860.`, 'offer'); }
  } else if (ev.k === 'rail') { // a line between the busiest pair not yet on the railway
    const P = G.places; let best = null, bv = 0;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { if (railLinked(G, i, j)) continue; const v = (G.pot[i][j] + G.pot[j][i]) * (1 + P[i].p / 20 + P[j].p / 20); if (v > bv) { bv = v; best = [i, j]; } }
    if (best && !G.rails.length) for (let k = 1; k <= 6; k++) { const m = G.m + 30 + 48 * (k - 1); if (m < E.YEARS * 12 - 6) G.plan.push({ m, k: 'offer', n: k }); } // the railway will want to buy you out
    G.plan.sort((a, b) => a.m - b.m);
    if (best) { G.rails.push(best); G.dirty = true; news(G, G.rails.length === 1 ? 'The railway age begins' : 'A new railway opens', `${P[best[0]].name} to ${P[best[1]].name}${G.rails.length === 1 ? ': trains are fast, and your slow, dear routes will lose trade to them' : ''}.`, 'rail'); }
  }
}
function rivalDecides(G, v) {
  if (G.an.routes.some(q => (q.i === v.i && q.j === v.j) || (q.i === v.j && q.j === v.i))) { v.gone = true; news(G, 'Petition thrown out', `Your canal already joins ${G.places[v.i].name} and ${G.places[v.j].name}: the ${v.name} is refused its Act.`, 'good'); }
  else { v.open = true; G.dirty = true; news(G, `The ${v.name} opens`, `A rival carries ${G.places[v.i].name}–${G.places[v.j].name} trade. Join them yourself and you still win part of it back.`, 'rival'); }
}
// tools arrive as answers to the problems the player's own canal runs into
const UNLOCK = {
  res: ['A dry summit', 'Your summit pound has run dry. Dam a stream above it: the ⛲ Reservoir tool.'],
  pair: ['Drought on the cut', 'Tap a flight: Paired working halves the water per boat (but boats wait), or Shut it to save the summit.'],
  pump: ['Coal at the wharf', 'Coal is cheap now your canal reaches a pit: a steam back-pump can lift water up a flight.'],
  double: ['Queues at the locks', 'A flight passes only so many boats. Tap it to double it (two chambers side by side).'],
  plane: ['Steam on the hill', 'Inclined planes: a steam engine hauls boats up a slope, using no water at all.'],
  fly: ['The railway comes', 'Fly-boats: tap a canal to run express boats day and night. Dear, but quick enough to keep trade from the trains.'],
};
function unlock(G, k) { if (G.unlocked.has(k)) return; G.unlocked.add(k); news(G, UNLOCK[k][0], UNLOCK[k][1], 'unlock').unlock = k; }
function unlocks(G, rec, coal) {
  if (!G.unlocked.has('res') && G.an.routes.some(r => r.pounds.some(pi => rec.fill[pi] < .2))) unlock(G, 'res');
  if (!G.unlocked.has('pair') && (K.inDrought(G.M, G.m) && G.an.sites.length || rec.dry.length)) unlock(G, 'pair');
  if (!G.unlocked.has('pump') && coal && G.an.sites.length) unlock(G, 'pump');
  if (!G.unlocked.has('double') && rec.lostC > 1) unlock(G, 'double');
  if (!G.unlocked.has('plane') && year(G) >= 1812 && coal) unlock(G, 'plane');
  if (!G.unlocked.has('fly') && G.rails.length) unlock(G, 'fly');
}
// every player decision goes through act(), so a game is its seed plus a short log, and replays exactly
function act(G, a) {
  let ok = true;
  if (a.k === 'build') { const D2 = K.dec(a.d); ok = !!D2 && build(G, D2) != null; }
  else if (a.k === 'mode') { if (a.v === 'open') delete G.mode[a.key]; else G.mode[a.key] = a.v; routeFactors(G); }
  else if (a.k === 'fly') { if (a.v) G.fly[a.pi] = 1; else delete G.fly[a.pi]; routeFactors(G); }
  else if (a.k === 'toll') setToll(G, a.pi, a.v);
  else if (a.k === 'sell') { ok = !!(G.offer && G.m <= G.offer.until && !G.over); if (ok) { G.sold = G.offer.price; G.over = true; news(G, 'Sold to the railway', `The proprietors take ${G.sold.toLocaleString()} thousand pounds, ${year(G)}.`, 'good'); } }
  if (ok) G.log.push({ ...a, m: G.m });
  return ok;
}
function replay(seed, log, until = Infinity, opt = {}) {
  const G = newGame(seed, opt); let i = 0;
  while (!G.over && G.m < until) { while (i < log.length && log[i].m <= G.m) act(G, log[i++]); if (G.m >= until) break; step(G); }
  while (i < log.length && log[i].m <= G.m && G.m < until) act(G, log[i++]);
  return G;
}
const encLog = log => log.map(a => [a.m.toString(36), a.k[0], a.k === 'build' ? a.d : a.k === 'sell' ? '1' : a.k === 'mode' ? a.key + ':' + a.v[0] : a.pi + ':' + (a.v === true ? 1 : a.v === false ? 0 : a.v)].join('|')).join(' ');
const decLog = s => { if (typeof s !== 'string' || !s) return []; const out = []; for (const t of s.split(' ')) { const [m, k, v] = t.split('|'); if (v == null) continue; const mm = parseInt(m, 36); if (!(mm >= 0)) continue;
  if (k === 'b') out.push({ m: mm, k: 'build', d: v }); else if (k === 'm') { const [key, x] = v.split(':'); out.push({ m: mm, k: 'mode', key, v: { o: 'open', p: 'pair', s: 'shut' }[x] || 'open' }); } else if (k === 'f') { const [pi, x] = v.split(':'); out.push({ m: mm, k: 'fly', pi: +pi, v: x === '1' }); } else if (k === 't') { const [pi, x] = v.split(':'); out.push({ m: mm, k: 'toll', pi: +pi, v: +x || 1 }); } else if (k === 's') out.push({ m: mm, k: 'sell' }); }
  return out; };
function score(G) { if (G.sold) return G.sold; if (G.wound >= 0) return 0; return Math.round(value(G)); }
// ================= the prospectus: what a design would earn over the next years, if nothing else changed =================
function forecast(G, D2, months = 120) {
  const F = { ...G, M: { ...G.M }, places: G.places.map(p => ({ ...p })), D: K.clone(D2 || G.D), st: null, an: null, plan: [], rivals: G.rivals.map(v => ({ ...v })), rails: G.rails.map(r => r.slice()),
    years: G.years.slice(-3), yr: newYear(), news: [], events: [], flowsY: null, cash: 1e9, debt: 0, over: false, wound: -1, tolls: { ...G.tolls }, mode: { ...G.mode }, fly: { ...G.fly }, unlocked: new Set(G.unlocked), log: [], dirty: false };
  potentials(F); reanalyse(F); const m0 = F.m; let net = 0, boats = 0, lostW = 0, lostC = 0, low = 1, fill = null;
  for (let k = 0; k < months && m0 + k < E.YEARS * 12; k++) { const rec = step(F); if (!rec) break; net += rec.rev - rec.run; boats += rec.boats; lostW += rec.lostW; lostC += rec.lostC; for (const f of rec.fill) low = Math.min(low, f); fill = rec.fill; }
  return { net, boats, lostW, lostC, low, fill, an: F.an };
}
// ================= the company's engineers (bots; the tests use them) =================
// a branch from place p to the network (or to place q): routed and levelled like the planner does
function branch(G, from, toCells, v = { al: 1.5, be: .6, lam: 0 }) {
  const M = G.M, tg = new Set(toCells); if (!tg.size || tg.has(from)) return null;
  let hRef = M.h[from]; for (const c of tg) hRef = Math.max(hRef, Math.min(M.h[c], hRef + 3));
  const path = K.routeGrid(M, from, tg, v.al, v.be, hRef); if (!path) return null;
  const D2 = K.clone(G.D), L = K.levelDP(M, D2, path, v.lam, 0); path.forEach((c, i) => { if (!Number.isInteger(D2.lv[c])) D2.lv[c] = L[i]; }); D2.paths.push(path);
  return D2;
}
const netCells = G => Object.keys(G.D.lv).map(Number);
const onNet = (G, i) => G.an.cells.has(G.M.towns[i].c);
// strategy knobs: tolls (level, or 'rail' to cut them where trains compete), branches (to new places), care (reservoirs, doubling), reserve (cash kept back)
function bot(G, cfg) {
  const P = G.places, cash = () => G.cash - (cfg.reserve || 0);
  if (G.m % 12 !== 0 && !(G.m === 0)) return; G.base = null;
  // 1. the first canal: the richest pair the capital can afford
  if (!G.D.paths.length) {
    let best = null;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { if (cfg.only && !cfg.only(P[i], P[j])) continue; const D2 = branch(G, P[i].c, [P[j].c], cfg.v); if (!D2) continue; const price = costOf(G, D2); if (price > cash()) continue;
      const val = cfg.look ? forecast(G, D2, 120).net - price * .3 : (G.pot[i][j] + G.pot[j][i]) / price; if (!best || val > best.val) best = { D2, val }; }
    if (best) build(G, best.D2);
    return;
  }
  // 2. branches to the most valuable place not yet on the network (rival petitions first)
  if (cfg.branches) for (let k = 0; k < (cfg.branches | 0 || 1); k++) {
    let best = null; const nc = netCells(G);
    for (let i = 0; i < P.length; i++) { if (onNet(G, i)) continue; if (cfg.only && !cfg.only(P[i])) continue;
      let gain = 0; for (let j = 0; j < P.length; j++) if (onNet(G, j)) gain += G.pot[i][j] + G.pot[j][i];
      if (G.rivals.some(v => !v.open && !v.gone && (v.i === i || v.j === i))) gain *= 2;
      const D2 = branch(G, P[i].c, nc, cfg.v); if (!D2) continue; const price = priceOf(G, D2); if (price > cash()) continue;
      if (cfg.look) { const left = Math.min(120, E.YEARS * 12 - G.m); gain = (forecast(G, D2, left).net - (G.base ?? (G.base = forecast(G, null, left).net))) / price; if (!best || gain > best.v) best = { D2, v: gain }; }
      else if (!best || gain / price > best.v) best = { D2, v: gain / price }; }
    if (best && best.v > (cfg.look ? 1 : (cfg.minGain || .02))) { build(G, best.D2); G.base = null; } else break;
  }
  // 3. care: double jammed locks, dam a stream for a pound that ran dry
  if (cfg.care && G.years.length) {
    const ly = G.years[G.years.length - 1];
    if (ly.lostC > ly.boats * .08) for (const s of G.an.sites) { const ld = s.routes.reduce((a, ri) => a + G.rf[ri].d, 0); if (ld > s.cap * .9 && !s.dbl) { const D2 = K.clone(G.D); D2.locks[s.key] = { ...(D2.locks[s.key] || {}), dbl: 1 }; if (build(G, D2) == null) break; } }
    // the pound that strands the most trade: a dam above it, else back-pumps up to it, else side ponds below it
    const strand = new Map(); G.an.routes.forEach((r, ri) => { for (const pi of r.pounds) if (G.st.S[pi] < .25 * G.an.pounds[pi].cap) strand.set(pi, (strand.get(pi) || 0) + G.rf[ri].d); });
    const worst = [...strand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
    for (const [pi, d] of worst) { if (d < 1) continue; const p = G.an.pounds[pi], rc = K.bestReservoir(G.M, G.an, pi); let D2 = K.clone(G.D);
      if (rc >= 0) D2.res.push(rc); else if (p.up.some(s => !s.pump)) { const s = p.up.find(s => !s.pump); D2.locks[s.key] = { ...(D2.locks[s.key] || {}), pump: 1 }; } else if (p.down.some(s => !s.ponds && s.t !== 'plane')) { for (const s of p.down) if (s.t !== 'plane') D2.locks[s.key] = { ...(D2.locks[s.key] || {}), ponds: 1 }; } else D2 = null;
      if (D2) build(G, D2); }
  }
  // 4. tolls
  if (cfg.toll === 'rail') { G.D.paths.forEach((p, pi) => { const comp = G.an.routes.some((r, ri) => G.rf[ri].rail < 1 && r.cells.some(c => G.cellPath.get(c) === pi)); G.tolls[pi] = comp ? .75 : 1.5; }); routeFactors(G); }
  else if (cfg.toll != null) { G.D.paths.forEach((p, pi) => G.tolls[pi] = cfg.toll); routeFactors(G); }
}
const STRATS = {
  adaptive: { branches: 2, care: 1, toll: 'rail', reserve: 10, look: 1 },
  steady: { branches: 1, care: 1, toll: 1, reserve: 15 },
  dear: { branches: 1, care: 1, toll: 1.5, reserve: 10 },
  cheap: { branches: 2, care: 1, toll: .75, reserve: 15 },
  trunk: { branches: 0, care: 1, toll: 1 },
  coal: { branches: 2, care: 0, toll: 1, only: (a, b) => a.type !== 'town' || (b && b.type !== 'town') },
};
function play(seed, cfg, opt = {}) {
  const G = newGame(seed, opt); const hook = typeof cfg === 'function' ? cfg : g => bot(g, cfg);
  while (!G.over) { hook(G); step(G); }
  return G;
}
// "draw the shortest line between the towns and wait"
function naive(G) { if (G.m === 0) { const D2 = K.naiveDesign({ ...G.M, towns: G.places.filter(p => p.type === 'town') }); if (build(G, D2) == null) { const D3 = K.newDesign(); const t = G.places.filter(p => p.type === 'town'); K.addPath(G.M, D3, [t[0].c, ...K.lineCells(t[0].c, t[1].c)]); build(G, D3); } } }
// the best canal the planner can design on day one, then nothing
function staticBest(G) {
  if (G.m !== 0) return; const M2 = { ...G.M, towns: G.places.map(p => ({ c: p.c, p: 3, req: false, name: p.name })) };
  const t = K.townTree(M2); let D = K.newDesign();
  for (const [a, b] of t) { const g2 = { ...G, D }; const D2 = branch(g2, G.places[b].c, [G.places[a].c, ...netCells(g2)]); if (!D2) continue; if (costOf(G, D2) > G.cash - 5) break; D = D2; }
  if (D.paths.length) build(G, D);
  for (let k = 0; k < 2; k++) { const an = K.analyse(G.M, K.clone(G.D)); if (!an.pounds.length) break; const rc = K.bestReservoir(G.M, an, an.order[0]); if (rc < 0) break; const D2 = K.clone(G.D); D2.res.push(rc); if (build(G, D2) == null) break; }
}
// the surveyor's hint for a first canal: the pair of places whose canal would pay best over ten years
function firstHint(G) { let best = null; const P = G.places;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { if (K.eucl(P[i].c, P[j].c) > 22) continue; const D2 = branch(G, P[i].c, [P[j].c]); if (!D2) continue; const price = costOf(G, D2); if (price > G.cash * .85) continue;
    const v = forecast(G, D2, 120).net - price * .5; if (!best || v > best.v) best = { i, j, v }; }
  return best; }
// the best canal the company's engineers could plan on day one (with the prospectus), then never touched again
function staticPlan(G) { if (G.m !== 0) return; const cfg = { ...STRATS.adaptive, branches: 4, reserve: 0 }; bot(G, cfg); G.m = 12; bot(G, cfg); G.m = 0; }
const API = { staticPlan, priceOf, firstHint, act, replay, encLog, decLog, UNLOCK, unlock, forecast, E, TYPES, newGame, step, build, setToll, costOf, value, score, year, branch, bot, STRATS, play, naive, staticBest, potentials, routeFactors, reanalyse, railLinked, onRail };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.AGE = API;
})(typeof window !== 'undefined' ? window : globalThis);
