// Woodcut colour-commission bots, run inside the page against window.__wc.
// The competent printer reads only what a player sees: the commission's colours and the shelf of glazes. It mixes every
// trio of tins on paper (transparent glazes multiply), matches each shape to its nearest stack, then picks the pull order
// that needs the fewest friskets. It never reads the hidden plan.
module.exports.botSrc = `
(() => {
  const W = window.__wc;
  const CREAM = W.lin(W.L.paper);
  const mix = (inks, s) => { const o = CREAM.slice(); for (let b = 0; b < 3; b++) if (s >> b & 1) W.over(o, inks[b], 160, o); return o; };
  const regionCol = rg => { const i = rg.px[rg.px.length >> 1] * 3; return [W.T.tcol[i], W.T.tcol[i + 1], W.T.tcol[i + 2]]; };
  const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  function masksOf(sub, ord) { const seen = new Map(); W.T.regions.forEach((rg, ri) => seen.set(rg.s, sub[ri])); let n = 0;
    for (const s of seen.values()) { let last = -1; ord.forEach((b, p) => { if (s >> b & 1) last = p; }); for (let p = 0; p < last; p++) if (!(s >> ord[p] & 1)) n++; } return n; }
  function plan() { // the colour plan: best trio and the stack for each shape
    const L = W.L, n = L.inks.length, cols = W.T.regions.map(regionCol); let best = null;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) {
      const trio = [a, b, c], inks = trio.map(k => L.inks[k]), stacks = [0, 1, 2, 3, 4, 5, 6, 7].map(s => mix(inks, s)); let err = 0; const sub = [];
      W.T.regions.forEach((rg, ri) => { let bs = 0, be = 1e9; stacks.forEach((col, s) => { const e = W.dE(col, cols[ri]); if (e < be) { be = e; bs = s; } }); sub.push(bs); err += be * rg.w; });
      if (!best || err < best.err) best = { trio, sub, err };
    }
    return best;
  }
  const lightOrd = trio => [0, 1, 2].sort((x, y) => W.lum(W.L.inks[trio[y]].c) - W.lum(W.L.inks[trio[x]].c));
  return {
    competent() { const p = plan(); let ord = PERMS[0], m = 1e9; for (const o of PERMS) { const k = masksOf(p.sub, o); if (k < m) { m = k; ord = o; } } return W.execPlan(p.trio, p.sub, ord); },
    lightToDark() { const p = plan(); return W.execPlan(p.trio, p.sub, lightOrd(p.trio)); }, // the right glazes, but always pulled light to dark
    noFriskets() { const p = plan(); W.L.fBudget = 0; let ord = PERMS[0], m = 1e9; for (const o of PERMS) { const k = masksOf(p.sub, o); if (k < m) { m = k; ord = o; } } return W.execPlan(p.trio, p.sub, ord); }, // pure reduction
    lightestThree() { const L = W.L, trio = L.inks.map((_, k) => k).sort((x, y) => W.lum(L.inks[y].c) - W.lum(L.inks[x].c)).slice(0, 3), inks = trio.map(k => L.inks[k]), stacks = [0, 1, 2, 3, 4, 5, 6, 7].map(s => mix(inks, s));
      const sub = W.T.regions.map(rg => { const c = regionCol(rg); let bs = 0, be = 1e9; stacks.forEach((col, s) => { const e = W.dE(col, c); if (e < be) { be = e; bs = s; } }); return bs; });
      return W.execPlan(trio, sub, [0, 1, 2]); },
    random(rnd) { const n = W.L.inks.length, trio = rnd.shuffle([...Array(n).keys()]).slice(0, 3); return W.execPlan(trio, W.T.regions.map(() => rnd.int(8)), rnd.shuffle([0, 1, 2])); },
  };
})()`;
