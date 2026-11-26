// Bellfounder bots, run inside the page against window.__bell (G: the foundry logic, BP: the bell physics).
// They see what a player sees: the partials after each cut (cents from target), the weight, and the casting result.
//  - naive: cast the stock pattern at the right size for the note, and deliver it untuned (play(c, {tune:false, design:false}))
//  - competent: if the order needs a new profile, redraw it (Levenberg-Marquardt on the profile points and walls, judged
//    only by the partial ratios it hears); size the mould a little sharp; pour; then measure how a trial cut at each height
//    moves each partial and solve for non-negative cuts. Recast when a casting comes out flat or cracked.
function BOTS(G, BP) {
  const POS = [0.14, 0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.77, 0.83, 0.88, 0.93, 0.97];
  function errs(c, b, slot) { const v = G.verdict(c, b, slot); return { v, e: v.rows.map(r => r.c), w: v.rows.map(r => 1 / r.tol) }; }
  // a competent tuner: measures how a trial cut at each height moves each judged partial, then solves for non-negative cuts
  function tune(c, b, slot = 0, rounds = 10, tool = 'fine') {
    for (let k = 0; k < rounds; k++) {
      const { v, e, w } = errs(c, b, slot); if (v.ok || v.crack) return v;
      if (v.rows.some(r => r.c < -r.tol)) return v; // flat: cuts can't raise it, recast
      const d0 = G.maxCut(b) * .4, J = POS.map(s => { const t = { ...b, cuts: [...b.cuts, { s, d: d0, w: G.TOOLS[tool] }] }; const e2 = errs(c, t, slot).e; return e2.map((x, j) => (x - e[j]) / d0); });
      // projected-gradient NNLS on sum_j w_j^2 (e_j + J x)_j^2, aiming slightly sharp of centre
      const aim = e.map((x, j) => x - .15 / w[j]); let x = POS.map(() => 0);
      const r = () => aim.map((a, j) => (a + x.reduce((s, xi, i) => s + xi * J[i][j], 0)) * w[j]);
      let L = 0; J.forEach(Ji => { L += Ji.reduce((s, v, j) => s + (v * w[j]) ** 2, 0); });
      for (let it = 0; it < 600; it++) { const rr = r(); x = x.map((xi, i) => Math.max(0, xi - J[i].reduce((s, v, j) => s + v * w[j] * rr[j], 0) / (L + 1e-12))); }
      const lim = G.maxCut(b); let did = 0;
      POS.forEach((s, i) => { let d = x[i]; if (d < lim * .03) return; while (d > 1e-6) { G.shave(b, s, Math.min(d, lim), tool); d -= lim; did++; } });
      if (!did) return G.verdict(c, b, slot);
    }
    return G.verdict(c, b, slot);
  }
  // design: Levenberg-Marquardt on the profile so the ratios are right, then size for the note
  const P = d => [d.pts[1][0], d.pts[2][0], d.pts[2][1], d.pts[3][0], d.pts[3][1], d.pts[4][0], d.pts[4][1], d.pts[1][1], d.th[1], d.th[2], d.th[3], d.th[4], d.th[5]];
  const U = (d, p) => G.sane({ D: d.D, pts: [[.1, p[7]], [p[0], p[7]], [p[1], p[2]], [p[3], p[4]], [p[5], p[6]], [1, 0]], th: [p[8], p[8], p[9], p[10], p[11], p[12]] });
  function design(d0, tierce = 1.2, tin = 23, massW = 0, its = 14) {
    const T = { hum: .5, tierce, quint: 1.5, nominal: 2 }; let d = G.sane(d0), p = P(d), lam = .01;
    const res = q => { const dd = U(d, q), m = G.unitModes(dd, tin); return Object.keys(T).map(k => BP.cents(m.f[k] / m.f.prime, T[k])).concat(massW ? [massW * Math.log(m.mass / G.unitModes(d0, tin).mass) * 100] : []); };
    let r = res(p);
    for (let it = 0; it < its; it++) {
      const h = .003, J = p.map((_, j) => { const q = p.slice(); q[j] += h; const rq = res(q); return rq.map((v, i) => (v - r[i]) / h); });
      const n = p.length, A = [...Array(n)].map((_, a) => [...Array(n)].map((_, b2) => J[a].reduce((s, v, i) => s + v * J[b2][i], 0))), g = J.map(Ja => Ja.reduce((s, v, i) => s + v * r[i], 0));
      for (let a = 0; a < n; a++) A[a][a] += lam * (A[a][a] + 1) + 30;
      const M = A.map((row, i) => [...row, -g[i]]); for (let i = 0; i < n; i++) { let mx = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[mx][i])) mx = k; [M[i], M[mx]] = [M[mx], M[i]]; for (let k = i + 1; k < n; k++) { const f = M[k][i] / M[i][i]; for (let cc = i; cc <= n; cc++) M[k][cc] -= f * M[i][cc]; } }
      const dx = Array(n); for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let cc = i + 1; cc < n; cc++) s -= M[i][cc] * dx[cc]; dx[i] = s / M[i][i]; }
      const q = P(U(d, p.map((v, i) => v + Math.max(-.03, Math.min(.03, dx[i]))))), rq = res(q);
      const e0 = r.reduce((s, v) => s + v * v, 0), e1 = rq.reduce((s, v) => s + v * v, 0);
      if (e1 < e0) { p = q; r = rq; lam *= .5; } else lam *= 4;
      if (Math.sqrt(r.slice(0, 4).reduce((s, v) => s + v * v, 0) / 4) < .5 && !massW) break;
    }
    return U(d, p);
  }
  // play a commission start to finish like a sensible founder; returns what happened
  function play(c, opt = {}) {
    const slots = c.kind === 'ring' ? c.notes.length : 1, out = { ok: true, bells: [], casts: 0, shaves: 0 };
    let pat = null;
    for (let slot = 0; slot < slots; slot++) {
      const b = G.freshBell(c, slot), note = c.kind === 'ring' ? c.notes[slot] : c.note;
      if (!c.pre) {
        b.tin = c.minTin ? c.minTin + .5 : 23; b.cool = c.minTin ? .25 : .45;
        if (!pat) { pat = G.sane(b.des); if (opt.design !== false && (c.tierce || c.pattern === 'old' || c.maxKg)) { if (c.maxKg) pat.th = pat.th.map((t, i) => i >= 2 ? t * .8 : t * .55); pat = design(pat, c.tierce || 1.2, b.tin, 0); } }
        b.des = G.sane({ ...pat, D: G.diameterFor(pat, G.noteHz(note), b.tin) / Math.pow(2, (opt.sharp ?? 22) / 1200) });
      }
      let v; for (let tries = 0; tries < 8; tries++) {
        if (!c.pre || tries) G.pour(b, c.id, slot);
        v = opt.tune === false ? G.verdict(c, b, slot) : tune(c, b, slot);
        if (v.ok) break;
        if (!c.pre && v.rows.some(r => r.c < -r.tol)) b.des = G.sane({ ...b.des, D: b.des.D / Math.pow(2, 12 / 1200) });
      }
      out.casts += b.casts; out.shaves += b.shaves; out.bells.push(b); out.v = v; if (!v.ok) { out.ok = false; out.why = v.why; out.rows = v.rows; break; }
      out.kg = v.kg;
    }
    return out;
  }
  return { tune, design, play, P, U };
}
if (typeof module !== 'undefined') module.exports = { BOTS, botSrc: '(' + BOTS.toString() + ')' };
