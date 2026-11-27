// Mantle (plate/): you push tectonic plates; a crust model answers with mountains, trenches, rifts and island chains.
// Logic is checked through window.__plate (the real sim the page runs); every commission is solved by a scripted bot.
const ready = async page => { await page.waitForFunction(() => window.__plate && __plate.ready, null, { timeout: 60000 }); await page.evaluate(() => __plate.setRate(0)); };
const BOTS = `{"crumple":{steps:60,go:(A) => { A.push(0, 20, 0); }},
"andes":{steps:200,go:(A) => { A.push(0, 16, 0); }},
"roof":{steps:400,go:(A) => { A.push(0, 0, -22); }},
"arc":{steps:200,go:(A) => { A.push(0, 14, 0); }},
"rift":{steps:120,go:(A, k) => { if (k === 0) A.state.r = A.rift([[.5, .3], [.5, .45], [.5, .6]]); const r = A.state.r; if (r && r.ok) { A.push(r.a, -10 * r.dx, -10 * r.dy); A.push(r.b, 10 * r.dx, 10 * r.dy); } }},
"hawaii":{steps:240,go:(A) => { A.push(0, -12, 0); }},
"fault":{steps:400,go:(A) => { A.push(0, 0, 18); A.push(1, 0, -6); }},
"shadow":{steps:240,go:(A) => { A.push(0, 14, 0); }},
"wilson":{steps:360,go:(A, k) => { if (k === 0) A.state.r = A.rift([[.5, .25], [.5, .46], [.5, .68]]); const r = A.state.r; if (!r || !r.ok) return; const sg = A.run.phase ? -1 : 1, sp = A.run.phase ? 22 : 12; A.push(r.a, -sp * sg * r.dx, -sp * sg * r.dy); A.push(r.b, sp * sg * r.dx, sp * sg * r.dy); }},
"india":{steps:500,go:(A) => { const S = A.S, t = A.level.target, p = S.plates[0]; const cx = A.contCentroid(0); if (!cx) return; let dx = t.u * S.W - cx[0]; dx -= Math.round(dx / S.W) * S.W; const dy = t.v * S.H - cx[1], L = Math.hypot(dx, dy);
    if (A.run.iou > .6 || L < 1.5) A.push(0, 0, -24); else A.push(0, 22 * dx / L * Math.min(1, L / 4), 22 * dy / L * Math.min(1, L / 4)); }},
"pangaea":{steps:700,go:(A) => { const S = A.S; const cs = [0, 1, 2, 3, 4].map(i => A.contCentroid(i)); const c = cs[2]; for (const i of [0, 1, 3, 4]) { const q = cs[i]; if (!q) continue; let dx = c[0] - q[0]; dx -= Math.round(dx / S.W) * S.W; const dy = c[1] - q[1], L = Math.hypot(dx, dy) || 1; A.push(i, 24 * dx / L, 24 * dy / L); } }},
"old":{steps:640,go:(A) => { A.push(1, -7, 0); }}}`;
// run a fresh level for n steps with pushes held throughout; returns stats
const runPush = (page, id, pushes, n) => page.evaluate(([id, pushes, n]) => { __plate.open(id); __plate.setRate(0); for (let k = 0; k < n; k++) { for (const [p, x, y] of pushes) __plate.push(p, x, y); __plate.step(1); } return __plate.stats(); }, [id, pushes, n]);

module.exports = {
  page: 'plate/index.html',
  ready,
  tests: {
    'collision: two continents pass 8 km; ocean diving under a continent stalls near 6 km': async ({ page, ok }) => {
      const col = await runPush(page, 'roof', [[0, 0, -22]], 200);
      const sub = await runPush(page, 'andes', [[0, 20, 0]], 360);
      ok(col.maxElev > 8 && col.peakCollision > 8, 'collision peak ' + col.maxElev.toFixed(2));
      ok(sub.peakArc > 4.5 && sub.peakArc < 6.6, 'arc peak ' + sub.peakArc.toFixed(2));
      ok(sub.maxElev < col.maxElev - 1, `subduction ${sub.maxElev.toFixed(2)} vs collision ${col.maxElev.toFixed(2)}`);
      ok(sub.trench < -7, 'trench ' + sub.trench.toFixed(2));
    },
    'rift: a cut continent opens an ocean over 1000 km, striped by magnetic reversals, symmetric about the ridge': async ({ page, ok }) => {
      const r = await page.evaluate(() => { __plate.open('rift'); __plate.setRate(0); const S = __plate.state, Sim = __plate.Sim;
        const rr = __plate.rift([[.5, .3], [.5, .45], [.5, .6]]); if (!rr.ok) return { ok: false };
        for (let k = 0; k < 60; k++) { __plate.push(rr.a, -10 * rr.dx, -10 * rr.dy); __plate.push(rr.b, 10 * rr.dx, 10 * rr.dy); __plate.step(1); }
        const st = __plate.stats(); const y = Math.round(S.H * .45); let flips = 0, prev = -1, newCells = [];
        for (let x = 0; x < S.W; x++) { const i = y * S.W + x; if (S.f[i] < .5 && S.birth[i] > 0) { newCells.push(S.birth[i]); const p = Sim.polarity(S.birth[i]); if (prev >= 0 && p !== prev) flips++; prev = p; } }
        // ages: youngest in the middle (the ridge), older toward both coasts
        const m = newCells.length, mid = newCells.slice(m * .35 | 0, m * .65 | 0), edge = [...newCells.slice(0, m * .15 | 0), ...newCells.slice(m * .85 | 0)];
        const avg = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
        return { ok: true, w: st.oceanWidth, flips, midBirth: avg(mid), edgeBirth: avg(edge) }; });
      ok(r.ok, 'rift failed'); ok(r.w >= 1000, 'ocean width ' + r.w); ok(r.flips >= 4, 'stripes ' + r.flips); ok(r.midBirth > r.edgeBirth, 'ridge not youngest ' + JSON.stringify(r));
    },
    'hotspot: a plate drifting over a plume leaves a chain whose ages grow along the drift': async ({ page, ok }) => {
      const r = await page.evaluate(() => { __plate.open('hawaii'); __plate.setRate(0); for (let k = 0; k < 120; k++) { __plate.push(0, -12, 0); __plate.step(1); } const s = __plate.stats(); return s.hot.map(h => [h.x, h.age]); });
      ok(r.length >= 4, 'islands ' + r.length);
      const s = r.slice().sort((a, b) => b[0] - a[0]);   // plate moves west: east = nearest the plume = youngest
      let mono = 0; for (let k = 1; k < s.length; k++) if (s[k][1] >= s[k - 1][1] - .5) mono++;
      ok(mono >= s.length - 2, 'ages not increasing westward: ' + JSON.stringify(s));
    },
    'erosion: an unpushed range wears down': async ({ page, ok }) => {
      const r = await page.evaluate(() => { __plate.open('old'); __plate.setRate(0); __plate.step(4); const a = __plate.stats().maxElev; __plate.step(160); return [a, __plate.stats().maxElev]; });
      ok(r[0] > 4.5 && r[1] < r[0] - 1.5, 'range ' + r);
    },
    'no NaN or orphan cells over a long, busy run': async ({ page, eq }) => {
      const r = await page.evaluate(() => { __plate.open('pangaea'); __plate.setRate(0); for (let k = 0; k < 600; k++) { for (let p = 0; p < 5; p++) __plate.push(p, 20 * Math.cos(k / 40 + p), 20 * Math.sin(k / 50 + p * 2)); __plate.step(1); if (k === 200) __plate.rift([[.3, .4], [.3, .7]]); }
        return __plate.Sim.sane(__plate.state); });
      eq(r, '');
    },
    'every commission: doing nothing fails, the scripted solution passes': async ({ page, ok }) => {
      const res = await page.evaluate(src => { const BOTS = eval('(' + src + ')'); const out = [];
        for (const lv of __plate.LV.LEVELS) {
          __plate.open(lv.id); __plate.setRate(0); __plate.step(40); const idle = __plate.run.stars;
          __plate.open(lv.id); __plate.setRate(0); const S = __plate.state, bot = BOTS[lv.id];
          const A = { S, level: __plate.level, run: __plate.run, state: {}, push: (id, x, y) => __plate.push(id, x, y), rift: pts => __plate.rift(pts), contCentroid: id => __plate.contCentroid(id) };
          for (let k = 0; k < bot.steps && __plate.run.stars === 0; k++) { bot.go(A, k); __plate.step(1); }
          out.push([lv.id, idle, __plate.run.stars]); }
        return out; }, BOTS);
      for (const [id, idle, stars] of res) { ok(idle === 0, id + ' passes with no input'); ok(stars >= 1, id + ' bot failed'); }
    },
    'real mouse: drag a plate into its neighbour and the gauge climbs; progress is saved': async ({ page, ok }) => {
      await page.evaluate(() => { __plate.open('crumple'); __plate.setRate(1); });
      const [sx, sy] = await page.evaluate(() => { const p = __plate.state.plates[0]; return __plate.toScreen(p.cx, p.cy); });
      await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + 160, sy, { steps: 6 });
      const t0 = Date.now(); while (Date.now() - t0 < 20000 && !(await page.evaluate(() => __plate.run.stars > 0))) { await page.mouse.move(sx + 160 + Math.random(), sy); await page.waitForTimeout(250); }
      await page.mouse.up();
      ok(await page.evaluate(() => __plate.run.stars > 0), 'no star from dragging');
      await page.reload(); await ready(page);
      ok(await page.evaluate(() => (__plate.SAVE.stars.crumple || 0) > 0), 'star not saved');
    },
    'perf: few draw calls and a phone-sized triangle budget': async ({ page, ok }) => {
      const p = await page.evaluate(() => __plate.perf()); ok(p.calls <= 12, 'calls ' + p.calls); ok(p.triangles < 300000, 'tris ' + p.triangles);
    },
  },
};
