// A strong trader for Caravan (run in the page), with each surviving decision switchable, for the ablation tests.
//  qty:       'suggest' buys up to where one more unit stops paying (what the slider suggests) | 'fill' always buys all it can afford
//  roads:     'smart' weighs the bandit risk of the fast road against the days the safe road costs | 'fast' always | 'safe' always
function strongTrader(seed, opt) {
  const K = window.__caravan; K.encountersOn = false; K.headless = true; K.newCareerSeed(seed);
  const C = K.C, G = K.GOODS.length, cities = K.cities, upkeep = () => C.camels * 0.05;
  let steps = 0;
  while (C.day < K.CAREER_DAYS && steps++ < 800) {
    const here = cities[C.at], SP = {}, sp = d => SP[d] !== undefined ? SP[d] : (SP[d] = K.shortest(C.at, d));
    for (let g = 0; g < G; g++) if (C.cargo[g] > 0) K.trade(g, -999);
    if (here.closed) { if (K.travelNow(K.neighbors(C.at)[0].to) === 'end') break; continue; }
    const afford = (g, gold) => { let lo = 0, hi = 3000; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (K.buyCost(g, m).total <= gold - 30) lo = m; else hi = m - 1; } return lo; };
    const plan = (only, gold) => { let best = null;
      for (let g = 0; g < G; g++) { const buy = here.price[g] * 1.03, cap = afford(g, gold); if (cap < 1) continue;
        for (const d of cities) { if (d.id === C.at || (only != null && d.id !== only)) continue; const p = sp(d.id); if (!p) continue; const b = C.book[d.id]; if (!b) continue;
          const spoil = Math.pow(1 - K.GOODS[g][2], p.days), ratio = b.p[g] * .97 * spoil / buy; if (ratio <= 1) continue;
          const qty = opt.qty === 'fill' ? cap : Math.min(cap, Math.floor(Math.log(ratio) / Math.log(1.004 / .996))); if (qty < 1) continue;
          const prof = (b.p[g] * .97 * spoil * Math.pow(.996, qty / 2) - buy * Math.pow(1.004, qty / 2)) * qty - Math.max(0, Math.ceil((qty - (K.cap() - K.load())) / 10)) * 15;
          const v = (prof - p.days * upkeep()) / (p.days + 2); if (!best || v > best.v) best = { v, prof, g, to: d.id, qty, days: p.days }; } }
      return best; };
    const best = plan(null, C.gold);
    let to, rate = best && best.v > 0 ? best.v : 5;
    if (!best || best.v <= 0) { let sc = null; for (const d of cities) { if (d.id === C.at) continue; const p = sp(d.id); if (!p) continue; const age = C.book[d.id] ? C.day - C.book[d.id].day : 999, v = age / (p.days + 5); if (!sc || v > sc.v) sc = { v, to: d.id }; } to = sc.to; }
    else { to = best.to; K.trade(best.g, best.qty); }
    if (to === C.at) to = K.neighbors(C.at)[0].to;
    let safe = opt.roads === 'safe';
    if (opt.roads === 'smart') { const f = K.shortest(C.at, to), s = K.shortest(C.at, to, true);
      if (f && s) { const risk = 1 - f.legs.reduce((a, l) => a * (1 - l.r.danger), 1), cargo = C.cargo.reduce((a, q, g) => a + q * (C.book[to] ? C.book[to].p[g] : here.price[g]), 0);
        safe = risk * .5 * cargo > (s.days - f.days) * rate; } }
    if (K.travelNow(to, safe) === 'end') break;
  }
  for (let g = 0; g < G; g++) if (C.cargo[g] > 0) K.trade(g, -999);
  K.headless = false; return Math.round(K.netWorth());
}
module.exports = { strongTrader };
