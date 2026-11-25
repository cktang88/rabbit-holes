// Bench bots for Escapement, run inside the page (toString'd).
// escRandom: a tinkerer with no plan: hangs wheels on random arbors, cuts random teeth, swings them anywhere.
function escRandom(com, seed, steps = 60) {
  const E = window.__esc, r = RH.rng('rand:' + seed), d = E.blank(com); let ever = false;
  for (let s = 0; s < steps; s++) {
    const n = d.ax.length, act = r();
    if (act < .35 && n < 14) { const i = r.int(n); if (d.ax[i].g.length) { const k = E.hang(com, d, i, r.int(d.ax[i].g.length), com.tmin + r.int(com.tmax - com.tmin + 1), r() * 6.283); E.swing(com, d, k, d.ax[k].a); } }
    else if (act < .55) { const i = r.int(n); E.addGear(com, d, i, com.tmin + r.int(com.tmax - com.tmin + 1)); }
    else if (act < .85) { const i = r.int(n); if (d.ax[i].g.length) E.setTeeth(com, d, i, r.int(d.ax[i].g.length), com.tmin + r.int(com.tmax - com.tmin + 1)); }
    else { const i = E.fixedN(com) + r.int(Math.max(1, n - E.fixedN(com))); if (d.ax[i]) E.swing(com, d, i, r() * 6.283); }
    if (E.solve(com, d).ok) ever = true;
  }
  return ever;
}
// escPlan: plans with one fixed policy. 'min' = always the fewest stages, 'plus1' = always one more,
// 'straight' = always plants the train along the straight line to the hand, 'adaptive' = changes approach when stuck.
function escPlan(com, seed, policy) {
  const E = window.__esc, r = RH.rng('plan:' + policy + ':' + seed);
  const base = { tries: 16, attempts: 6, iters: 120 };
  const tryOne = o => { const d = E.plan(com, r, { ...base, ...o }); if (!d) return null; const R = E.solve(com, d); return R.ok ? { e: R.err, g: R.gears, t: R.brass } : null; };
  if (policy === 'min') return tryOne({ k: 'min' });
  if (policy === 'plus1') return tryOne({ k: 1 });
  if (policy === 'straight') return tryOne({ spread: 0 });
  for (const o of [{}, { w: 1.2 }, { w: .2 }, { k: 1 }, { spread: 3.5, w: .9 }, { k: 2, w: 1 }, {}, { w: 1.6 }]) { const x = tryOne(o); if (x) return x; }
  return null;
}
module.exports = { escRandom, escPlan };
