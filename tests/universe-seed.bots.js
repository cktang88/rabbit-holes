// Gardeners for Universe Seed. Each sees what a player sees: the frontier's universes, their kind, their black holes,
// their drift law and the two children it could make (the published rules), and which universe may be sheltered.
//  idle         - never intervenes
//  random       - shelters or prunes a random universe, or lets it be
//  pruneBH      - fixed: prunes the most fertile universe without minds
//  shelterMinds - fixed: shelters the minds universe with most black holes, otherwise does nothing
//  adaptive     - shelters the minds universe whose children stay minds; when that lineage must stand alone, prunes the
//                 strongest rival; with no minds in view, steers toward them by sheltering what could bud them
function usPolicy(name, X) {
  const F = C => C.frontier.map(i => C.U[i]), ok = (C, u) => X.canShelter(C, u.id);
  const mv = u => X.variants(u).filter(c => X.judge(c).kind === 'minds').length;
  if (name === 'idle') return () => null;
  if (name === 'random') return C => { const r = X.rng('rn' + C.seed + ':' + C.gen), f = C.frontier; return r() < .3 ? null : { t: r() < .5 ? 'p' : 's', id: f[r.int(f.length)] }; };
  if (name === 'pruneBH') return C => { const b = F(C).filter(u => u.kind !== 'minds' && u.kind !== 'life').sort((a, b) => b.raw - a.raw); return b.length && C.frontier.length > 3 ? { t: 'p', id: b[0].id } : null; };
  if (name === 'shelterMinds') return C => { const m = F(C).filter(u => u.kind === 'minds' && ok(C, u)).sort((a, b) => b.raw - a.raw); return m.length ? { t: 's', id: m[0].id } : null; };
  return C => {
    const fr = F(C);
    const m = fr.filter(u => u.kind === 'minds' && ok(C, u)).sort((a, b) => (b.raw + mv(b) * .6) - (a.raw + mv(a) * .6));
    if (m.length) return { t: 's', id: m[0].id };
    const bad = fr.filter(u => u.kind !== 'minds').sort((a, b) => (b.raw - mv(b)) - (a.raw - mv(a)));
    if (fr.some(u => u.kind === 'minds') && fr.length >= 5 && bad.length) return { t: 'p', id: bad[0].id };
    const s = fr.filter(u => ok(C, u)).sort((a, b) => (mv(b) * 3 + (b.kind === 'life' ? 2 : 0) + b.raw * .3) - (mv(a) * 3 + (a.kind === 'life' ? 2 : 0) + a.raw * .3))[0];
    return s ? { t: 's', id: s.id } : null;
  };
}
function usPlay(X, seed, name, startIdx) {
  const C = X.newCosmos(seed, startIdx != null ? X.STARTS[startIdx] : null), pol = usPolicy(name, X);
  while (!C.over) X.stepGen(C, pol(C));
  return { minds: C.mindsGen, dark: C.over.why === 'dark', start: C.start.n, stars: X.starsOf(C), born: C.born };
}
if (typeof module !== 'undefined') module.exports = { usPolicy, usPlay };
