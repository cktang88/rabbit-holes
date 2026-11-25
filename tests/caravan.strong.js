// A strong trader for Caravan (run in the page), with each surviving decision switchable, for the ablation tests.
//  qty:       'suggest' buys up to where one more unit stops paying (what the slider suggests) | 'fill' always buys all it can afford
//  stale:     'discount' expects an old quote to have drifted back towards the city's usual price | 'trust' takes it at face value
//  news:      true uses the events it has heard of (a festival, a glut, a plague) when judging a market | false ignores them
function strongTrader(seed, opt) {
  const K = window.__caravan; K.encountersOn = false; K.headless = true; K.newCareerSeed(seed);
  const C = K.C, G = K.GOODS.length, cities = K.cities, upkeep = () => C.camels * 0.05;
  let steps = 0;
  while (C.day < K.CAREER_DAYS && steps++ < 3000) {
    const here = cities[C.at], SP = {}, sp = d => SP[d] !== undefined ? SP[d] : (SP[d] = K.shortest(C.at, d));
    for (let g = 0; g < G; g++) if (C.cargo[g] > 0) K.trade(g, -999);
    if (here.closed) { const tr = K.travelNow(K.neighbors(C.at)[0].to); if (tr === 'end') break; if (!tr) K.tick(); continue; }
    const afford = (g, gold) => { let lo = 0, hi = 3000; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (K.buyCost(g, m).total <= gold - 30) lo = m; else hi = m - 1; } return lo; };
    const heard = e => C.day >= e.start + Math.round((K.shortest(e.city, C.at)?.days ?? 60) / 3);
    // what the city will pay on arrival: the old quote (drifting back towards the usual price if 'discount'), scaled by the
    // events it has heard of that were not yet in force when the quote was taken (or will be over by arrival)
    const mul = (ci, g, day) => { let m = 1; if (opt.news) for (const e of C.events) if (e.good != null && (e.good === g || e.also === g) && day >= e.start && day < e.end && heard(e)) { const near = e.city === ci ? 1 : K.neighbors(e.city).some(n => n.to === ci) ? .5 : 0; if (near) m *= 1 + ((e.good === g ? e.mul : 1 + (e.mul - 1) * .6) - 1) * near; } return m; };
    const est = (ci, g, arrive) => { const b = C.book[ci], age = C.day - b.day, u = K.usual(ci, g), m0 = mul(ci, g, b.day), m1 = mul(ci, g, arrive);
      let p = opt.stale === 'discount' ? u * m1 + (b.p[g] - u * m0) * Math.exp(-age / 60) : b.p[g] * m1 / m0;
      if (opt.news && K.cities[ci].closed) p = 0; return Math.max(0, p); };
    const plan = (only, gold) => { let best = null;
      for (let g = 0; g < G; g++) { const buy = here.price[g] * 1.03, cap = afford(g, gold); if (cap < 1) continue;
        for (const d of cities) { if (d.id === C.at || (only != null && d.id !== only)) continue; const p = sp(d.id); if (!p) continue; const b = C.book[d.id]; if (!b) continue; const pq = est(d.id, g, C.day + p.days);
          const spoil = Math.pow(1 - K.GOODS[g][2], p.days), ratio = pq * .97 * spoil / buy; if (ratio <= 1) continue;
          const qty = opt.qty === 'fill' ? cap : Math.min(cap, Math.floor(Math.log(ratio) / Math.log(1.004 / .996))); if (qty < 1) continue;
          const prof = (pq * .97 * spoil * Math.pow(.996, qty / 2) - buy * Math.pow(1.004, qty / 2)) * qty - Math.max(0, Math.ceil((qty - (K.cap() - K.load())) / 10)) * 15;
          const v = (prof - p.days * upkeep()) / (p.days + 2); if (!best || v > best.v) best = { v, prof, g, to: d.id, qty, days: p.days }; } }
      return best; };
    const best = plan(null, C.gold);
    let to;
    if (!best || best.v <= 0) { let sc = null; for (const d of cities) { if (d.id === C.at) continue; const p = sp(d.id); if (!p) continue; const age = C.book[d.id] ? C.day - C.book[d.id].day : 999, v = age / (p.days + 5); if (!sc || v > sc.v) sc = { v, to: d.id }; } to = sc ? sc.to : null; }
    else { to = best.to; K.trade(best.g, best.qty); }
    if (to === C.at) to = null;
    if (to == null || !K.shortest(C.at, to)) { K.tick(); if (C.day >= K.CAREER_DAYS) break; continue; } // nowhere to go: wait a day
    if (K.travelNow(to) === 'end') break;
  }
  for (let g = 0; g < G; g++) if (C.cargo[g] > 0) K.trade(g, -999);
  K.headless = false; return Math.round(K.netWorth());
}
module.exports = { strongTrader };
