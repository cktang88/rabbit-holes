// The Coaster Designer: constants and the track model (spline, resampling, 3D geometry). A classic script; all files share one global scope, loaded in order by index.html.
performance.mark("track.js");
'use strict';
const $ = id => document.getElementById(id);
const G = 9.81, MU = .015, DRAG = .0006, DS = .5, CHAIN = 3.5, CAR_W = 1.2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

// ================= track model =================
// A design is a list of nodes in an elevation view (x along the ground, y height, metres). The track is a
// curvature-continuous (C2) cubic spline through them, parameterised by chord length: position, slope and
// curvature all run smoothly through every node, so four nodes round a loop make a round loop, not a rounded square.
// A node may pin its own tangent (n.t = {x, y}, a Bézier-style arm): the spline is then solved separately on each side
// of it (still C2 everywhere else). Each node may carry a flat turn for the segment that follows it: radius r (m) and
// bank (deg). Segment 0 (station → first crest) is a chain lift.
function tangents(nodes) { // dP/du at each node, u = arc-ish (chord) length; C2 within every run of auto nodes
  const n = nodes.length, P = nodes.map(q => [q.x, q.y]), h = [], D = new Array(n);
  for (let i = 0; i < n - 1; i++) h[i] = Math.max(.05, Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]));
  for (let i = 0; i < n; i++) if (nodes[i].t) D[i] = [nodes[i].t.x, nodes[i].t.y];
  const solve = (a, b) => { // nodes a..b; D fixed where given, natural ends otherwise (second derivative zero)
    const m = b - a + 1; if (m < 2) return;
    for (const c of [0, 1]) {
      const A = new Float64Array(m), B = new Float64Array(m), Cc = new Float64Array(m), R = new Float64Array(m);
      for (let k = 0; k < m; k++) { const i = a + k;
        if (D[i] && (k === 0 || k === m - 1)) { B[k] = 1; R[k] = D[i][c]; continue; }
        if (k === 0) { B[k] = 2; Cc[k] = 1; R[k] = 3 * (P[i + 1][c] - P[i][c]) / h[i]; continue; }
        if (k === m - 1) { A[k] = 1; B[k] = 2; R[k] = 3 * (P[i][c] - P[i - 1][c]) / h[i - 1]; continue; }
        const h0 = h[i - 1], h1 = h[i]; A[k] = h1; B[k] = 2 * (h0 + h1); Cc[k] = h0; R[k] = 3 * (h1 * (P[i][c] - P[i - 1][c]) / h0 + h0 * (P[i + 1][c] - P[i][c]) / h1); }
      for (let k = 1; k < m; k++) { const w = A[k] / B[k - 1]; B[k] -= w * Cc[k - 1]; R[k] -= w * R[k - 1]; } // Thomas algorithm
      const X = new Float64Array(m); X[m - 1] = R[m - 1] / B[m - 1]; for (let k = m - 2; k >= 0; k--) X[k] = (R[k] - Cc[k] * X[k + 1]) / B[k];
      for (let k = 0; k < m; k++) { const i = a + k; if (nodes[i].t && (k === 0 || k === m - 1)) continue; (D[i] = D[i] || [0, 0])[c] = X[k]; }
    }
  };
  let a = 0; for (let i = 1; i < n; i++) if (nodes[i].t || i === n - 1) { solve(a, i); a = i; }
  return { D, h };
}
// dense samples along the spline with analytic heading and curvature
function spline(nodes) {
  const n = nodes.length, out = []; if (n < 2) return out;
  const { D, h } = tangents(nodes); let thPrev = null;
  for (let i = 0; i < n - 1; i++) {
    const p0 = nodes[i], p1 = nodes[i + 1], L = h[i], d0 = D[i], d1 = D[i + 1], steps = Math.max(8, Math.ceil(L / .2));
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const H = [2 * t3 - 3 * t2 + 1, t3 - 2 * t2 + t, -2 * t3 + 3 * t2, t3 - t2], H1 = [6 * t2 - 6 * t, 3 * t2 - 4 * t + 1, -6 * t2 + 6 * t, 3 * t2 - 2 * t], H2 = [12 * t - 6, 6 * t - 4, -12 * t + 6, 6 * t - 2];
      const f = (W2, c, sc) => W2[0] * [p0.x, p0.y][c] * sc[0] + W2[1] * L * d0[c] * sc[1] + W2[2] * [p1.x, p1.y][c] * sc[0] + W2[3] * L * d1[c] * sc[1];
      const x = f(H, 0, [1, 1]), y = f(H, 1, [1, 1]), dx = f(H1, 0, [1, 1]) / L, dy = f(H1, 1, [1, 1]) / L, ddx = f(H2, 0, [1, 1]) / (L * L), ddy = f(H2, 1, [1, 1]) / (L * L);
      const sp = Math.hypot(dx, dy) || 1e-9; let th = Math.atan2(dy, dx); if (thPrev != null) { while (th - thPrev > Math.PI) th -= 2 * Math.PI; while (th - thPrev < -Math.PI) th += 2 * Math.PI; } thPrev = th;
      out.push({ x, y, seg: i, th, k: (dx * ddy - dy * ddx) / (sp * sp * sp) });
    }
  }
  const last = nodes[n - 1], dl = D[n - 1]; let th = Math.atan2(dl[1], dl[0]); while (th - thPrev > Math.PI) th -= 2 * Math.PI; while (th - thPrev < -Math.PI) th += 2 * Math.PI;
  out.push({ x: last.x, y: last.y, seg: n - 2, th, k: out[out.length - 1].k });
  return out;
}
// resample at even arc length DS, carrying segment, heading and curvature
function resample(pts) {
  const out = [{ ...pts[0], s: 0 }]; let acc = 0, need = DS;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y); if (!l) continue;
    let used = 0;
    while (acc + (l - used) >= need) { const f = (used + need - acc) / l; out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, seg: b.seg, th: a.th + (b.th - a.th) * f, k: a.k + (b.k - a.k) * f, s: out.length * DS }); used += need - acc; acc = 0; need = DS; }
    acc += l - used;
  }
  return out;
}
// the track in 3D: ground position from integrating the heading through flat turns (loops stay in a vertical plane)
function geometry(design) {
  const S = resample(spline(design.nodes)), nodes = design.nodes;
  let hx = 0, hz = 0, h = 0;
  for (let i = 0; i < S.length; i++) {
    const p = S[i], nd = nodes[p.seg] || {}, r = nd.r || 0; p.kh = r ? 1 / r : 0; p.bank = (nd.bank || 0) * Math.PI / 180; p.ab = !!nd.ab; p.bt = (nd.bt || 0) * Math.PI / 180; }
  // a turn's curvature eases in and out over about 24 m (a transition curve, as real track is laid, so the train rolls into its bank at a comfortable rate), so the heading, the
  // sideways g and the bank all change smoothly instead of switching on at a node. The total angle turned is kept.
  { const raw = S.map(p => p.kh), W = 24; for (let i = 0; i < S.length; i++) { if (!raw[i] && !raw[Math.max(0, i - W)] && !raw[Math.min(S.length - 1, i + W)]) continue; let a = 0; for (let k = i - W; k <= i + W; k++) a += raw[clamp(k, 0, S.length - 1)]; S[i].kh = a / (2 * W + 1); }
    // the eased-in stretch borrows the bank of the turn it leads into (or out of), rolled in step with the curvature
    const B0 = S.map(p => p.bank), T0 = S.map(p => p.bt); for (let i = 0; i < S.length; i++) if (S[i].kh) { let j = raw[i] ? i : -1; for (let d = 1; d <= W && j < 0; d++) { if (raw[i - d]) j = i - d; else if (raw[i + d]) j = i + d; } if (j >= 0) { const f = clamp(S[i].kh / raw[j], 0, 1); S[i].ab = S[j].ab; S[i].bt = T0[j] * f; S[i].bank = B0[j] * f; } } }
  // the plan: heading integrates the horizontal curvature along the ground distance (so turns really turn in 3D)
  for (let i = 0; i < S.length; i++) { const p = S[i];
    p.X = hx; p.Z = hz; p.head = h;
    if (i < S.length - 1) { const dxg = S[i + 1].x - p.x; hx += Math.cos(h) * dxg; hz += Math.sin(h) * dxg; h += p.kh * Math.abs(dxg); }
  }
  // physics steps along the chord between samples: use the chord's slope so energy balances exactly (curvature stays analytic)
  for (let i = 0; i < S.length - 1; i++) { let t = Math.atan2(S[i + 1].y - S[i].y, S[i + 1].x - S[i].x); while (t - S[i].th > Math.PI) t -= 2 * Math.PI; while (t - S[i].th < -Math.PI) t += 2 * Math.PI; S[i].th = t; }
  if (S.length > 1) S[S.length - 1].th = S[S.length - 2].th;
  // a train is ~6 m long: riders feel the curvature averaged over a few metres. Steel can't be bent tighter than 3 m.
  const raw = S.map(p => p.k || 0), Wn = 6; S.kink = raw.findIndex((k, i) => i > 2 && i < S.length - 3 && Math.abs(k) > 1 / 3);
  for (let i = 0; i < S.length; i++) { let a = 0, n = 0; for (let k = Math.max(0, i - Wn); k <= Math.min(S.length - 1, i + Wn); k++) { a += raw[k]; n++; } S[i].kv = a / n; }
  return S;
}

