// Opticks order-book bots. Each runs inside the page (page.evaluate) against window.__opt.
// The competent maker reads only the order (kind, lamp, crucible or window, clauses) and its own shelf, designs with
// thin-lens and Snell reasoning, then fine-tunes by watching the gauges, the way a player does. It never sees the Guild's design.
module.exports.botSrc = `
(() => {
  const o = window.__opt;
  const lensOf = (sh, pred) => sh.filter(p => p.t === 'lens' && pred(p));
  const put = (p, x, y, a) => ({ ...p, x: +x.toFixed(2), y: +y.toFixed(2), a });
  const ok = (c, ps) => { const m = o.measureComm(c, o.trace(c, ps), ps); return m; };
  // a design family returns candidate layouts; the maker keeps every one that meets the whole order
  function families(c) {
    const sh = o.trayOf(c), s = c.sources[0], y0 = s.y, fam = {};
    const add = (k, ps) => (fam[k] ||= []).push(ps);
    const doublets = () => { const out = []; for (const a of lensOf(sh, p => p.f > 0)) for (const b of lensOf(sh, p => p.f < 0 && p.id !== a.id && (p.g || 'crown') !== (a.g || 'crown'))) { const F = 1 / (1 / a.f + 1 / b.f); if (F > 0 && F < 26) out.push({ a, b, F }); } return out; };
    if (c.kind === 'reduce') {
      for (const A of lensOf(sh, () => 1)) for (const B of lensOf(sh, p => p.id !== A.id)) {
        const d = A.f + B.f, ratio = Math.abs(B.f / A.f); if (d <= .5 || Math.abs(ratio / c.M - 1) > .02) continue;
        for (const x of [3, 5, 7, 9]) if (x + d < 30) add(A.f * B.f > 0 ? 'kepler' : 'galileo', [put(A, x, y0, 90), put(B, x + d, y0, 90)]);
      }
    }
    if (c.kind === 'burn') {
      const T = c.targets[0], off = T.y - y0, axis = Math.abs(off) < .3;
      const singles = lensOf(sh, p => p.f > 0).map(a => ({ set: x => [put(a, x, y0, 90)], F: a.f, kind: 'lens' }));
      const dbl = doublets().map(d => ({ set: x => [put(d.a, x, y0, 90), put(d.b, x + .25, y0, 90)], F: d.F, kind: 'doublet' }));
      for (const L of [...singles, ...dbl]) {
        if (axis) { for (let dx = -.6; dx <= .6; dx += .05) add(L.kind, L.set(T.x - L.F + dx)); continue; }
        for (const m of sh.filter(p => p.t === 'mirror')) { const x = T.x - (L.F - Math.abs(off)); if (x > 2.5 && T.x - x > .8) for (let dx = -.4; dx <= .4; dx += .05) add(L.kind + '+fold', [...L.set(x + dx), put(m, T.x, y0, off > 0 ? 45 : -45)]); }
        for (const m of sh.filter(p => p.t === 'rprism')) { const x = T.x - (L.F - Math.abs(off)); if (x > 2.5) for (let dx = -.4; dx <= .4; dx += .1) for (const a of [0, 90, 180, 270]) add(L.kind + '+prism', [...L.set(x + dx), put(m, T.x, y0, a)]); }
      }
      for (const arc of sh.filter(p => p.t === 'arc')) { // a concave mirror throws parallel light to a point f along the reflected axis ray
        const dy = T.y - y0; if (Math.abs(dy) >= arc.f) continue;
        for (const sx of [1, -1]) { const xa = T.x + sx * Math.sqrt(arc.f ** 2 - dy ** 2), rx = (T.x - xa) / arc.f, ry = dy / arc.f, cx = rx - 1, cy = ry, a0 = Math.atan2(cx, -cy) * 180 / Math.PI;
          if (xa > 31 || xa < 3) continue;
          for (let k = -6; k <= 6; k++) for (const ddx of [-.2, 0, .2]) add('arc', [put(arc, xa + ddx, y0, +(a0 + k * .5).toFixed(1))]); }
      }
    }
    if (c.kind === 'periscope') {
      const wx = c.fixed[0].x1, xs = [3.5, 5, 7, 9, 11, 13].filter(x => x < wx - 1);
      const ms = sh.filter(p => p.t === 'mirror'), rs = sh.filter(p => p.t === 'rprism');
      for (const x of xs) {
        if (ms.length >= 2) for (const a of [45, -45]) add('mirrors', [put(ms[0], x, y0, a), put(ms[1], x, c.yw, a)]);
        if (rs.length >= 2) for (const a1 of [0, 90, 180, 270]) for (const a2 of [0, 90, 180, 270]) add('prisms', [put(rs[0], x, y0, a1), put(rs[1], x, c.yw, a2)]);
        if (rs.length && ms.length) for (const a1 of [45, -45]) for (const a2 of [0, 90, 180, 270]) { add('mixed', [put(ms[0], x, y0, a1), put(rs[0], x, c.yw, a2)]); add('mixed', [put(rs[0], x, y0, a2), put(ms[0], x, c.yw, a1)]); }
      }
    }
    if (c.kind === 'spectro') {
      const ps = sh.filter(p => p.t === 'prism').sort((a, b) => (b.g === 'flint') - (a.g === 'flint'));
      const mid = s.l[1], sgn = y0 < 10 ? 1 : -1, ang = f => Math.atan2(f.dy, f.dx) * 180 / Math.PI;
      for (const x0 of [3, 4.5, 6]) for (let k = 1; k <= Math.min(3, ps.length); k++) {
        const chain = []; let fail = false;
        for (let i = 0; i < k && !fail; i++) {
          const f0 = o.trace(c, chain).finals.find(q => q.l === mid); const P = i ? [f0.x0 + f0.dx * 3.5, f0.y0 + f0.dy * 3.5] : [x0, y0];
          if (P[0] < 2 || P[0] > 30 || P[1] < 2 || P[1] > 18) { fail = true; break; }
          let best = null; for (let a = 0; a < 360; a += 2) { const q = put(ps[i], P[0], P[1], a), f1 = o.trace(c, [...chain, q]).finals.find(z => z.l === mid); if (!f1 || f1.refr < 2 * (i + 1)) continue; const dev = ((ang(f1) - ang(f0)) % 360 + 540) % 360 - 180; if (dev * sgn < 15) continue; if (!best || Math.abs(dev) < best.d) best = { d: Math.abs(dev), q }; }
          if (!best) fail = true; else chain.push(best.q);
        }
        if (!fail) add(k + ' prism' + (k > 1 ? 's' : ''), chain);
      }
    }
    if (c.kind === 'search') {
      const singles = lensOf(sh, p => p.f > 0).map(a => ({ set: x => [put(a, x, y0, 90)], F: a.f, k: 'lens' }));
      const dbl = doublets().map(d => ({ set: x => [put(d.a, x, y0, 90), put(d.b, x + .25, y0, 90)], F: d.F, k: 'doublet' }));
      for (const L of [...singles, ...dbl]) for (let dx = -.8; dx <= .8; dx += .02) add(L.k, L.set(s.x + L.F + dx));
    }
    return fam;
  }
  // the competent maker: every family, keep what meets the whole order, take the cheapest (then the shortest)
  function competent(c) {
    let best = null; const fam = families(c);
    for (const [k, list] of Object.entries(fam)) for (const ps of list) { const m = ok(c, ps); if (m.all && (!best || m.cost < best.m.cost || (m.cost === best.m.cost && m.len < best.m.len))) best = { ps, m, k }; }
    return best;
  }
  // fixed habits: always the same family, or the cheapest thing that meets the main spec while ignoring the clauses
  function fixed(c, habit) {
    const fam = families(c);
    if (habit === 'cheapest-main') { let best = null; for (const list of Object.values(fam)) for (const ps of list) { const m = ok(c, ps); if (m.main && (!best || m.cost < best.m.cost)) best = { ps, m }; } return !!best && best.m.all; }
    const pref = { mirrors: ['mirrors', 'lens+fold', 'arc', 'kepler', 'lens', '1 prism'], glass: ['prisms', 'lens', 'doublet', 'lens+prism', 'doublet+prism', 'galileo', '1 prism', '2 prisms'], kepler: ['kepler', 'lens', 'lens+fold', 'mirrors', '1 prism'] }[habit];
    for (const k of pref) if (fam[k]) { let got = null; for (const ps of fam[k]) { const m = ok(c, ps); if (m.main) { got = m; break; } } if (got) return got.all; }
    return false;
  }
  function random(c, rnd, n = 200) {
    const sh = o.trayOf(c);
    for (let t = 0; t < n; t++) { const ps = [], k = 1 + rnd.int(3); for (let i = 0; i < k; i++) ps.push({ ...sh[rnd.int(sh.length)], id: 900 + i, x: 2 + rnd() * 28, y: 1 + rnd() * 18, a: Math.round(rnd() * 24) * 15 }); if (ok(c, ps).all) return true; }
    return false;
  }
  return { families, competent, fixed, random };
})()`;
