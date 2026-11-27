const P = require('./sim.js'), LV = require('./levels.js'), BOTS = require('./bots.js');
const W = +process.argv[2] || 256, only = process.argv[3];
function api(S, lv, run) {
  const A = { S, level: lv, run, state: {},
    push: (id, vx, vy) => { const p = S.plates[id]; if (!p || !p.alive) return; p.held = true; p.tvx = P.cmToCells(S, vx); p.tvy = P.cmToCells(S, vy); },
    rift: pts => P.rift(S, pts.map(([u, v]) => [u * S.W, v * S.H])),
    contCentroid: id => { let n = 0, sx = 0, sy = 0; const p = S.plates[id]; if (!p || !p.alive) return null; for (let i = 0; i < S.N; i++) if (S.owner[i] === id && S.f[i] > .85) { let x = i % S.W; x -= Math.round((x - p.cx) / S.W) * S.W; sx += x; sy += (i / S.W) | 0; n++; } return n ? [sx / n, sy / n] : null; } };
  return A;
}
for (const lv of [...LV.LEVELS, LV.daily('2026-11-27'), LV.daily('2026-11-28'), LV.daily('2026-11-29')]) {
  if (only && lv.id !== only) continue;
  const S = P.create({ W, seed: lv.spec.seed }); P.gen(S, lv.spec); const run = LV.newRun(lv); const A = api(S, lv, run);
  const bot = BOTS[lv.id] || dailyBot(lv); const t0 = Date.now(); let ev, trace = [];
  // before: nothing done must not pass
  { const st = P.stats(S); const e0 = LV.evaluate(lv, S, st, LV.newRun(lv)); if (e0 && e0.passed) console.log('  !! passes at start'); }
  for (let k = 0; k < bot.steps; k++) { bot.go(A, k); P.step(S); if (k % 4 === 3) { const st = P.stats(S); ev = LV.evaluate(lv, S, st, run); if (k % 40 === 39) trace.push(LV.M[lv.goal.m].fmt(ev.value)); } }
  console.log(lv.id.padEnd(9), 'stars', run.stars, 'passedAt', run.passedAt, 'best', LV.M[lv.goal.m].fmt(run.best), lv.goal.marks.join('/'), ((Date.now() - t0) / 1000).toFixed(1) + 's', P.sane(S) || '', '|', trace.join(' '));
}
function dailyBot(lv) { return { steps: 400, go: (A, k) => { const S = A.S, g = lv.goal.m;
  if (g === 'peak' || g === 'arcPeak') { const cs = lv.spec.conts; const a = cs[0].plate, b = cs[1] ? cs[1].plate : (a + 1) % 6; const pa = A.contCentroid(a), pb = A.contCentroid(b) || [S.plates[b].cx, S.plates[b].cy]; if (!pa) return; let dx = pb[0] - pa[0]; dx -= Math.round(dx / S.W) * S.W; const dy = pb[1] - pa[1], L = Math.hypot(dx, dy) || 1; A.push(g === 'arcPeak' ? b : a, (g === 'arcPeak' ? -1 : 1) * 22 * dx / L, (g === 'arcPeak' ? -1 : 1) * 22 * dy / L); }
  if (g === 'oceanWidth') { if (k === 0) { const c = lv.spec.conts.slice().sort((x, y) => y.rx * y.ry - x.rx * x.ry)[0]; A.state.r = A.rift([[c.u, c.v - .2], [c.u, c.v], [c.u, c.v + .2]]); } const r = A.state.r; if (r && r.ok) { A.push(r.a, -10 * r.dx, -10 * r.dy); A.push(r.b, 10 * r.dx, 10 * r.dy); } }
  if (g === 'hotIslands') { const hs = S.hot[0], p = S.owner[hs.y * S.W + hs.x]; for (const q of S.plates) if (q.held && q.id !== p) { q.held = false; } A.push(p, -12, 0); }
} }; }
