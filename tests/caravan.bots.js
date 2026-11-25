// Trader bots for Caravan, evaluated in the page. Exported as a string-able function body via toString().
// policy: 'idle' | 'random' | 'obvious' | 'greedy-book' | 'greedy-live'
function caravanBot(seed, policy) {
  const K = window.__caravan; K.encountersOn = false; K.headless = true; K.newCareerSeed(seed);
  const C = K.C, G = K.GOODS.length, rnd = RH.rng('bot' + seed + policy);
  const sellAll = () => { for (let g = 0; g < G; g++) if (C.cargo[g] > 0) K.trade(g, -999); };
  const upkeep = () => C.camels * 0.05 + C.guards * 0.3;
  let steps = 0;
  while (C.day < K.CAREER_DAYS && steps++ < 600) {
    const here = K.cities[C.at];
    sellAll();
    if (policy === 'idle') break;
    if (policy === 'random') {
      const g = rnd.int(G); K.trade(g, Math.floor(C.gold * .5 / here.price[g]));
      const nb = K.neighbors(C.at); const tr = K.travelNow(nb[rnd.int(nb.length)].to); if (tr === 'end') break; if (!tr) K.tick(); continue;
    }
    if (policy === 'obvious') { // buy what the city says it makes, take it to the nearest city that says it wants it
      const g = here.prod[0]; let best = null;
      for (const d of K.cities) if (d.dem.includes(g) && d.id !== C.at) { const p = K.shortest(C.at, d.id); if (p && (!best || p.days < best.days)) best = { to: d.id, days: p.days }; }
      if (!best) { const nb = K.neighbors(C.at); best = { to: nb[0].to }; }
      K.trade(g, 999); const tr = K.travelNow(best.to); if (tr === 'end') break; if (!tr) K.tick(); continue;
    }
    // greedy: best known profit per day; 'book' only knows what it has seen, 'live' sees every market now
    if (C.gold > 450 && C.camels < 14) { const n = Math.min(14 - C.camels, Math.floor((C.gold - 300) / 40)); C.gold -= 40 * n; C.camels += n; }
    let best = null;
    for (let g = 0; g < G; g++) {
      const buy = here.price[g] * 1.03, qty = Math.min(K.cap(), Math.floor(C.gold / buy)); if (qty < 1) continue;
      for (const d of K.cities) {
        if (d.id === C.at) continue;
        const pd = policy === 'greedy-live' ? d.price[g] : C.book[d.id] && C.book[d.id].p[g]; if (pd == null) continue;
        const p = K.shortest(C.at, d.id); if (!p) continue;
        const spoil = Math.pow(1 - K.GOODS[g][2], p.days);
        const prof = (pd * .97 * spoil * Math.pow(.996, qty / 2) - buy * Math.pow(1.004, qty / 2)) * qty - p.days * upkeep();
        const v = prof / (p.days + 2); if (!best || v > best.v) best = { v, g, to: d.id, qty };
      }
    }
    if (!best || best.v <= 0) { // scout: the city we know least about, nearby
      let sc = null; for (const d of K.cities) { if (d.id === C.at) continue; const p = K.shortest(C.at, d.id); if (!p) continue; const age = C.book[d.id] ? C.day - C.book[d.id].day : 999; const v = age / (p.days + 5); if (!sc || v > sc.v) sc = { v, to: d.id }; }
      if (!sc) { K.tick(); continue; } if (K.travelNow(sc.to) === 'end') break; continue;
    }
    K.trade(best.g, best.qty); const tr = K.travelNow(best.to); if (tr === 'end') break; if (!tr) K.tick();
  }
  sellAll(); K.headless = false;
  return Math.round(K.netWorth());
}
module.exports = { caravanBot };
