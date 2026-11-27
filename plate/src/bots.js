// scripted solutions, shared by the node runner and the browser test (via toString)
const BOTS = {
  crumple: { steps: 60, go: (A) => { A.push(0, 20, 0); } },
  andes: { steps: 200, go: (A) => { A.push(0, 16, 0); } },
  roof: { steps: 400, go: (A) => { A.push(0, 0, -22); } },
  arc: { steps: 200, go: (A) => { A.push(0, 14, 0); } },
  rift: { steps: 120, go: (A, k) => { if (k === 0) A.state.r = A.rift([[.5, .3], [.5, .45], [.5, .6]]); const r = A.state.r; if (r && r.ok) { A.push(r.a, -10 * r.dx, -10 * r.dy); A.push(r.b, 10 * r.dx, 10 * r.dy); } } },
  hawaii: { steps: 240, go: (A) => { A.push(0, -12, 0); } },
  fault: { steps: 400, go: (A) => { A.push(0, 0, 18); A.push(1, 0, -6); } },
  shadow: { steps: 240, go: (A) => { A.push(0, 14, 0); } },
  wilson: { steps: 360, go: (A, k) => { if (k === 0) A.state.r = A.rift([[.5, .25], [.5, .46], [.5, .68]]); const r = A.state.r; if (!r || !r.ok) return; const sg = A.run.phase ? -1 : 1, sp = A.run.phase ? 22 : 12; A.push(r.a, -sp * sg * r.dx, -sp * sg * r.dy); A.push(r.b, sp * sg * r.dx, sp * sg * r.dy); } },
  india: { steps: 500, go: (A) => { const S = A.S, t = A.level.target, p = S.plates[0]; const cx = A.contCentroid(0); if (!cx) return; let dx = t.u * S.W - cx[0]; dx -= Math.round(dx / S.W) * S.W; const dy = t.v * S.H - cx[1], L = Math.hypot(dx, dy);
    if (A.run.iou > .6 || L < 1.5) A.push(0, 0, -24); else A.push(0, 22 * dx / L * Math.min(1, L / 4), 22 * dy / L * Math.min(1, L / 4)); } },
  pangaea: { steps: 700, go: (A) => { const S = A.S; const cs = [0, 1, 2, 3, 4].map(i => A.contCentroid(i)); const c = cs[2]; for (const i of [0, 1, 3, 4]) { const q = cs[i]; if (!q) continue; let dx = c[0] - q[0]; dx -= Math.round(dx / S.W) * S.W; const dy = c[1] - q[1], L = Math.hypot(dx, dy) || 1; A.push(i, 24 * dx / L, 24 * dy / L); } } },
  old: { steps: 640, go: (A) => { A.push(1, -7, 0); } },
};
if (typeof module !== 'undefined') module.exports = BOTS;
