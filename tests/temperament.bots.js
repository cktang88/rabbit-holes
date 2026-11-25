// Tuner bots for Temperament, run inside the page (toString'd). Each plays one whole season headlessly and returns
// { rep, coin, passed }. policy: 'idle' | 'random' | 'et' | 'mean' | 'adaptive'
function tmBot(post, seed, policy) {
  const T = window.__tm, s = T.newSeason(post, seed), P = T.postFor(post, seed), rnd = RH.rng('bot:' + policy + ':' + seed);
  const movable = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(n => !P.locked.includes(n));
  const value = (tun, prog) => prog.reduce((a, pc) => { const e = T.evalPiece(tun, pc), p = T.payOf(pc, e, false); return a + p.coin * (s.coin < 15 ? 1 : .4) + 5 * p.rep - 3 * e.marks.filter(m => m === 'wolf').length; }, 0); // (the last term only steers the search: it counts wolves one by one)
  const W = () => T.genWeek(P, s.seed, s.week);
  const keep = ref => { for (const n of movable) if (Math.abs(s.tun[n] - ref[n]) > .3) T.setNote(s, n, ref[n]); }; // a fixed temperament, restored every week
  const best2 = () => { // fixed-temperament letter choice: the letters this tuning plays best
    const L = W().letters.map(l => ({ id: l.id, v: value(s.tun, [l]) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    L.slice(0, P.slots).forEach(x => T.toggleAccept(s, x.id)); };
  for (let guard = 0; guard < 40; guard++) {
    if (policy === 'random') {
      W().letters.forEach(l => rnd() < .5 && T.toggleAccept(s, l.id));
      for (let j = rnd.int(4); j > 0; j--) { const n = rnd.pick(movable); T.setNote(s, n, s.tun[n] + (rnd() - .5) * 24); }
    } else if (policy === 'et') { keep(T.START.et()); best2(); }
    else if (policy === 'mean') { keep(T.START.mean()); best2(); }
    else if (policy === 'adaptive') adapt();
    T.perform(s);
    if (s.phase !== 'done') break;
    T.nextWeek(s);
  }
  return { rep: s.rep, coin: Math.round(s.coin), passed: T.passed(s), grid: T.shareGrid(s) };

  function adapt() { // choose letters and pegs together: greedy peg search for every set of letters, keep the best plan
    const w = W(), Ls = w.letters, subsets = [[]];
    for (const l of Ls) for (const sub of subsets.slice()) if (sub.length < P.slots) subsets.push([...sub, l]);
    let best = null;
    // a competent tuner also considers laying a whole new bearing (equal or Werckmeister) when the organ has wandered too far
    const bases = [s.tun.slice(), T.START.et(), T.START.werck()].map(b => { const t = s.tun.slice(), mv = new Set(); for (const n of movable) if (Math.abs(b[n] - t[n]) > .3) { t[n] = b[n]; mv.add(n); } return { t, mv }; });
    for (const sub of subsets) for (const B of bases) {
      const prog = [w.hymn, ...sub], tun = B.t.slice(), moved = new Set(B.mv); let cost = Math.max(0, moved.size - P.free) * P.extra, v = value(tun, prog) - 2 * cost;
      for (let it = 0; it < P.free + 2; it++) {
        let bm = null;
        for (const n of movable) { const c0 = tun[n], pc = moved.has(n) || moved.size < P.free ? 0 : P.extra;
          const cands = []; for (let d = -24; d <= 24; d += 1) cands.push(c0 + d);
          // a tuner's moves: set this note a pure / meantone / equal fifth or a pure third away from a neighbour
          for (const [k, w] of [[7, T.P5], [7, T.P5 - T.SC / 4], [7, 700], [4, T.M3]]) { const lo = (n - k + 12) % 12, hi = (n + k) % 12;
            cands.push(tun[lo] + w - (lo + k >= 12 ? 1200 : 0), tun[hi] + (n + k >= 12 ? 1200 : 0) - w); }
          for (const x of cands) { if (Math.abs(x - 100 * n) > 70) continue; tun[n] = x; const nv = value(tun, prog) - 2 * (cost + pc); if (!bm || nv > bm.v) bm = { v: nv, n, x, pc }; }
          tun[n] = c0; }
        if (!bm || bm.v <= v + .5) break;
        tun[bm.n] = bm.x; moved.add(bm.n); v = bm.v; cost += bm.pc;
      }
      const total = v;
      if (!best || total > best.total) best = { total, sub, tun };
    }
    for (const n of movable) if (Math.abs(best.tun[n] - s.tun[n]) > 1e-9) T.setNote(s, n, best.tun[n]);
    best.sub.forEach(l => T.toggleAccept(s, l.id));
  }
}
module.exports = { tmBot };
