// A network-building house for Caravan's Road's Ledger (run in the page). It trades like the strong trader, and as each phase
// opens it uses the new verbs. Each one can be switched off for the ablation tests.
//  corr:  hire a correspondent in every city it reaches           lofts: build lofts along a chain that spans the road
//  sell:  sell news to every house that will pay (true), or only the three sales that open the next phases ('unlock')
//  forge: true = a couple of lies (opt.lies, default 2) to trusting houses once the Ledger is nearly done (opt.lie picks the size: 0 whisper, 1 rumour, 2 tall tale); 'always' = a rumour to every house that will still buy
function networkHouse(seed, opt) {
  const K = window.__caravan; K.encountersOn = false; K.headless = true; K.newCareerSeed(seed);
  const C = K.C, G = K.GOODS.length, cities = K.cities, LOFTS = [0, 2, 5, 11, 14, 17, 22];
  const want = ci => (opt.corr && C.phase >= 2 && !C.corr[ci]) || (opt.lofts && C.phase >= 4 && LOFTS.includes(ci) && !C.lofts[ci]);
  let steps = 0;
  while (C.day < (opt.until || K.CAREER_DAYS) && C.ledgerDay == null && steps++ < 4000) {
    const here = cities[C.at], SP = {}, sp = d => SP[d] !== undefined ? SP[d] : (SP[d] = K.shortest(C.at, d));
    for (let g = 0; g < G; g++) if (C.cargo[g] > 0) K.trade(g, -999);
    // the news business, before buying goods
    if (opt.corr && C.phase >= 2 && !C.corr[C.at] && C.gold > 80) K.hireCorr();
    if (opt.lofts && C.phase >= 4 && LOFTS.includes(C.at) && !C.lofts[C.at] && C.gold > 220) K.buildLoft();
    if (C.phase >= 3) C.rivals.forEach((rv, i) => { if (opt.forge && C.phase >= 5 && (opt.forge === 'always' ? rv.trust >= 0.3 : rv.trust >= 0.5 && K.freshCities() >= 17 && (C.forged || 0) < (opt.lies ?? 2)) && C.day - (rv.bought ?? -99) >= 30) { const far = [0, 22, 6, 20][i % 4]; K.forge(i, far === rv.at ? 11 : far, 11, opt.forge === 'always' ? 1 : (opt.lie ?? 0)); } else if (opt.sell === true || (opt.sell === 'unlock' && new Set(C.sold).size < 3 && !C.sold.includes(i))) K.sellNews(i); });
    if (here.closed) { const tr = K.travelNow(K.neighbors(C.at)[0].to); if (tr === 'end') break; if (!tr) K.tick(); continue; }
    const afford = (g, gold) => { let lo = 0, hi = 3000; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (K.buyCost(g, m).total <= gold - 60) lo = m; else hi = m - 1; } return lo; };
    // once rich, the network comes first: head for the nearest city that still needs a correspondent or a loft (trading on the way)
    let goal = null; if (C.gold > 1500) { for (const d of cities) if (d.id !== C.at && want(d.id)) { const p = sp(d.id); if (p && (!goal || p.days < goal.days)) goal = { id: d.id, days: p.days }; } }
    let best = null;
    for (let g = 0; g < G; g++) { const buy = here.price[g] * 1.03, cap = afford(g, C.gold); if (cap < 1) continue;
      for (const d of cities) { if (d.id === C.at || (goal && d.id !== goal.id)) continue; const p = sp(d.id), b = C.book[d.id]; if (!p || !b || b.fake) continue;
        const age = C.day - b.day, u = K.usual(d.id, g), est = u + (b.p[g] - u) * Math.exp(-age / 60), ratio = est * .97 * Math.pow(1 - K.GOODS[g][2], p.days) / buy; if (ratio <= 1) continue;
        const qty = Math.min(cap, Math.floor(Math.log(ratio) / Math.log(1.004 / .996))); if (qty < 1) continue;
        let v = (est * .97 * Math.pow(1 - K.GOODS[g][2], p.days) * Math.pow(.996, qty / 2) - buy * Math.pow(1.004, qty / 2)) * qty / (p.days + 2); if (want(d.id)) v *= 1.6;
        if (!best || v > best.v) best = { v, g, to: d.id, qty }; } }
    let to = null;
    if (goal) { to = goal.id; if (best && best.v > 0) K.trade(best.g, best.qty); }
    else if (best && best.v > 0) { to = best.to; K.trade(best.g, best.qty); }
    else { let sc = null; for (const d of cities) { if (d.id === C.at) continue; const p = sp(d.id); if (!p) continue; const age = C.book[d.id] ? C.day - C.book[d.id].day : 999, v = (age + (want(d.id) ? 200 : 0)) / (p.days + 5); if (!sc || v > sc.v) sc = { v, to: d.id }; } to = sc && sc.to; }
    if (to == null) { K.tick(); continue; }
    const tr = K.travelNow(to); if (tr === 'end') break; if (!tr) K.tick();
  }
  for (let g = 0; g < G; g++) if (C.cargo[g] > 0) K.trade(g, -999);
  K.headless = false;
  return { ledger: C.ledgerDay ?? null, fortune: Math.round(K.netWorth()), honour: K.honour(), forged: C.forged || 0, caught: C.rivals.reduce((s, rv) => s + (rv.lies || 0), 0), phase: C.phase, corr: Object.keys(C.corr).length, lofts: Object.keys(C.lofts).length, fresh: K.freshCities(), day: C.day, trips: C.trips, stale: cities.filter(c => { const b = C.book[c.id]; return !b || b.fake || C.day - b.day > K.LEDGER_AGE; }).map(c => c.id + ':' + (C.book[c.id] ? C.day - C.book[c.id].day : 'x')).join(' ') };
}
module.exports = { networkHouse };
