// Gardeners for Universe Seed. Each sees what a player sees: the frontier's universes, their kind, their black holes,
// their drift law and the two children it could make (the published rules), and which universe may be sheltered.
//  idle         - never intervenes
//  random       - shelters or prunes a random universe, or lets it be
//  pruneBH      - fixed: prunes the most fertile universe without minds
//  shelterMinds - fixed: shelters the minds universe with most black holes, otherwise does nothing
//  adaptive     - treats the twelve shelters as scarce: prunes the strongest rival most turns, shelters the minds universe
//                 whose children stay minds when minds run low, and with no minds in view shelters what could bud them
function usPolicy(name, X) {
  const F = C => C.frontier.map(i => C.U[i]), ok = (C, u) => X.canShelter(C, u.id);
  const mv = u => X.variants(u).filter(c => X.judge(c).kind === 'minds').length;
  if (name === 'idle') return () => null;
  if (name === 'random') return C => { const r = X.rng('rn' + C.seed + ':' + C.gen), f = C.frontier; return r() < .3 ? null : { t: r() < .5 ? 'p' : 's', id: f[r.int(f.length)] }; };
  if (name === 'pruneBH') return C => { const b = F(C).filter(u => u.kind !== 'minds' && u.kind !== 'life').sort((a, b) => b.raw - a.raw); return b.length && C.frontier.length > 3 ? { t: 'p', id: b[0].id } : null; };
  if (name === 'shelterMinds') return C => { const m = F(C).filter(u => u.kind === 'minds' && ok(C, u)).sort((a, b) => b.raw - a.raw); return m.length ? { t: 's', id: m[0].id } : null; };
  return C => { // shelters are few: spend them when minds are scarce, and prune the strongest rival otherwise
    const fr = F(C), mindsN = fr.filter(u => u.kind === 'minds').length;
    const m = fr.filter(u => u.kind === 'minds' && ok(C, u)).sort((a, b) => (b.raw + mv(b) * .6) - (a.raw + mv(a) * .6));
    const bad = fr.filter(u => u.kind !== 'minds').sort((a, b) => (b.raw - mv(b)) - (a.raw - mv(a)));
    if (m.length && (mindsN <= 2 || C.shelters > (24 - C.gen) / 3)) return { t: 's', id: m[0].id };
    if (mindsN && bad.length && fr.length >= 4) return { t: 'p', id: bad[0].id };
    if (m.length) return { t: 's', id: m[0].id };
    if (!mindsN) { // no minds in view: shelter what could bud them, or clear away what never will
      const s = fr.filter(u => ok(C, u) && mv(u) > 0).sort((a, b) => mv(b) - mv(a) || b.raw - a.raw)[0]; if (s) return { t: 's', id: s.id };
      const b2 = fr.filter(u => mv(u) === 0 && u.kind !== 'life').sort((a, b) => b.raw - a.raw); if (b2.length && fr.length >= 5) return { t: 'p', id: b2[0].id }; }
    return null;
  };
}
function usPlay(X, seed, name, startIdx) {
  const C = X.newCosmos(seed, startIdx != null ? X.STARTS[startIdx] : null), pol = usPolicy(name, X);
  while (!C.over) X.stepGen(C, pol(C));
  return { minds: C.mindsGen, dark: C.over.why === 'dark', start: C.start.n, stars: X.starsOf(C), born: C.born };
}
if (typeof module !== 'undefined') module.exports = { usPolicy, usPlay };
