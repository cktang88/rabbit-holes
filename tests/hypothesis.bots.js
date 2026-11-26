// Soap surveyor bots, run inside the page against window.__soap. They see only what a player sees: the pins, the glass,
// and what each lift settles to (its length, its junctions). None of them reads the baked best network.
//  - naive: lift with no marks at all, as often as you like (the film is born the same way every time)
//  - scatter: pencil 1–3 random marks and lift once
//  - competent: lift, then keep trying the other way each bridge could lie (T1 flips), dropping a junction, leaning on a
//    wall or post, and Fermat points of nearby triples; restart from a few fresh guesses when stuck. Every try is a lift.
module.exports.botSrc = `
(() => {
  const S = window.__soap;
  const acc = (pl, L) => L <= pl.best * (1 + S.TOL);
  return {
    naive(pl) { const L = S.lift(pl, []).length(); return { L, ok: acc(pl, L), lifts: 1 }; },
    scatter(pl, r) { const m = []; for (let q = 1 + r.int(3); q > 0; q--) { const a = r() * 6.283, d = Math.sqrt(r()) * 1.7; m.push([Math.cos(a) * d, Math.sin(a) * d]); }
      const L = S.lift(pl, m).length(); return { L, ok: acc(pl, L), lifts: 1 }; },
    competent(pl, budget = 200) { const r = RH.rng('bot' + pl.id); let used = 0, best = Infinity;
      const starts = [[], ...S.candidates(pl, S.lift(pl, []))];
      for (let t = 0; t < 40; t++) { const m = []; for (let q = 1 + r.int(3); q > 0; q--) { const a = r() * 6.283, d = Math.sqrt(r()) * 1.7; m.push([Math.cos(a) * d, Math.sin(a) * d]); } starts.push(m); }
      for (const m of starts) { if (used >= budget || acc(pl, best)) break; const o = S.improve(pl, m, Math.min(15, budget - used)); used += o.used; best = Math.min(best, o.L); }
      return { L: best, ok: acc(pl, best), lifts: used }; },
  };
})()`;
