// Scripted families for the Parish saga (run in the page). Each returns an answer for a pending choice.
//  idle      - always the first option ("not yet", "work the land", "let it go")
//  random    - any option
//  steward   - competent: marries everyone off to the best match, the heir works the land and younger sons learn trades,
//              buys land when the purse allows, shuts the house against sickness, sends spare children abroad
function sagaPolicy(name) {
  if (name === 'idle') return () => 0;
  if (name === 'random') { let k = 7; return (V, c) => { k = (k * 1103515245 + 12345) % 2147483648; return k % window.__parish.optionsFor(V, c).length; }; }
  return (V, c) => {
    const P = window.__parish, F = V.fam, p = V.P[c.id], opts = P.optionsFor(V, c), us = P.kin(V);
    if (c.k === 'name') return 0;
    if (c.k === 'match') { let best = 1, bv = -1; c.offers.forEach((o, i) => { const v = (p.sex === 'M' ? o.dowry : -o.dowry) + (o.hale ? 25 : 0); if (v > bv) { bv = v; best = i + 1; } }); return best; }
    if (c.k === 'trade') { const sons = us.filter(x => x.sex === 'M' && x.s === F.sur && x.died === null).sort((a, b) => a.born - b.born); if (p.sex === 'M' && sons[0] === p) return 0; return F.coin > 40 ? 1 : 2; }
    if (c.k === 'land') return F.coin > c.price + 30 ? 1 : 0;
    if (c.k === 'plague') return F.coin > 12 ? 1 : 0;
    if (c.k === 'ship') return us.length > 9 && us.filter(x => x.sex === 'M' && x.s === F.sur).length > 3 ? 1 : 0;
    if (c.k === 'warden') return F.coin > 40 ? 1 : 0;
    return 0;
  };
}
function runSaga(seed, name) {
  const P = window.__parish, V = P.newVillage(seed), pol = sagaPolicy(name);
  while (!V.ended) { P.stepYear(V); if (V.ended) break; P.resolvePending(V, pol); }
  const all = V.P, babies = all.filter(p => p.born >= 1700 && p.born < 1840), infant = babies.filter(p => p.died !== null && p.died - p.born < 1).length / babies.length;
  return { sc: P.scoreOf(V), score: P.scoreOf(V).total, end: V.ended.y, why: V.ended.why, pop: all.filter(p => p.died === null && p.left === null).length, infant: +infant.toFixed(3), regs: V.reg.length };
}
module.exports = { sagaPolicy, runSaga };
