// Scripted genealogists for Parish, run inside the page (toString'd). Policies:
//  random   - pins every name match, strikes random entries with random reasons, cites random burials
//  dates    - the obvious approach: only strikes what a date check proves; guesses other reasons in menu order, cites nothing
//  simple   - competent but simple: reads every entry exactly, but finds "buried as a child" evidence by trying burials one by one
//  solver   - knows which burial proves it
// Returns { done, stars, blots } for letter i.
function parishBot(i, policy) {
  const P = window.__parish, W = P.W(), R = W.R, c = P.COMS()[i], rnd = RH.rng('pb' + i + policy);
  P.openLetter(i); P.S.wrong[i] = 0;
  const burials = R.filter(x => x.t === 'D');
  for (let guard = 0; guard < 400 && !P.S.done[i]; guard++) {
    const prog = P.S.prog[i], ti = c.tasks.findIndex((k, j) => !prog[j] && (k.dep < 0 || prog[k.dep]) && (k.dep2 == null || k.dep2 < 0 || prog[k.dep2]));
    if (ti < 0) break;
    const k = c.tasks[ti], K = P.KIND[k.kind];
    for (const x of P.candidates(R, k)) if (!P.S.pins.includes(x.id)) P.togglePin(x.id);
    const left = P.remaining(ti); if (left.length === 1) { P.confirmTask(ti); continue; }
    if (policy === 'random') { const x = left[rnd.int(left.length)], code = K.strikes[rnd.int(K.strikes.length)]; P.strike(ti, x.id, code, burials[rnd.int(burials.length)].id); continue; }
    const decoys = left.filter(x => x.id !== k.truth); // (bots other than random never touch the truth: a reader can see it fits)
    let progress = false;
    for (const d of decoys) {
      const why = K.why(R, d, k).filter(x => K.strikes.includes(x));
      if (policy === 'dates') { const dt = why.find(x => x === 'late' || x === 'early'); if (dt) { P.strike(ti, d.id, dt); progress = true; continue; } for (const code of K.strikes) { if (code === 'late' || code === 'early') continue; const r = P.strike(ti, d.id, code); if (r) { progress = true; break; } } continue; }
      const visible = why.find(x => !P.CITE[x]);
      if (visible) { P.strike(ti, d.id, visible); progress = true; continue; }
      // needs a cited burial
      const proof = burials.find(b => P.isChildBurial(b, d, R[k.a].d));
      if (policy === 'solver') { P.strike(ti, d.id, 'dead', proof.id); progress = true; continue; }
      for (const b of burials.filter(b => b.g === d.g && b.d > d.d && b.d < R[k.a].d).sort((a, b2) => a.d - b2.d)) if (P.strike(ti, d.id, 'dead', b.id)) { progress = true; break; }
    }
    if (!progress && policy !== 'random') break;
  }
  return { done: !!P.S.done[i], stars: P.S.done[i] ? P.S.done[i].stars : 0, blots: P.S.wrong[i] || 0 };
}
module.exports = { parishBot };
