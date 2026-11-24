// Watershed: the erosion model must conserve water and soil where it should, every goal must be reachable by a known plan and not
// by doing nothing, and the tools (springs, sculpting, budgets, undo) must behave at their limits.
const plant = async (page, raw) => { await page.addInitScript(raw => localStorage.setItem('rh:watershed', raw), raw); await page.reload(); await page.waitForTimeout(1500); };
// fast-forward n steps, checking the level's own test/fail every 30 steps (= 0.25 s at 1x), as the game loop does
const FF = `((n, lv) => { const W = __ws, L = W.LV[lv]; let st; for (let i = 1; i <= n; i++) { W.step(0); if (i % 30 === 0) { st = W.measure(); if (L.fail && L.fail(st)) return 'FAIL@' + i; if (L.test(st)) return 'WIN@' + i; } } return 'none'; })`;
const level = (page, i) => page.evaluate(i => { __ws.buildLevel(i); __ws.setSpeed(0); }, i);
const steps = s => +s.split('@')[1];

module.exports = {
  page: 'watershed/index.html',
  ready: page => page.waitForFunction(() => window.__ws, null, { timeout: 15000 }),
  tests: {
    'level data: 10 landscapes, the sandbox last and goal-free, every goal has a progress measure': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => __ws.LV.map(L => [L.n, !!L.free, typeof L.test, typeof L.prog, Object.keys(L.tools).length > 0]));
      eq(r.length, 10); eq(r[9][1], true); ok(r.slice(0, 9).every(x => !x[1] && x[2] === 'function' && x[3] === 'function' && x[4]));
    },
    'water: the pipe model conserves water volume (closed basin, no sources)': async ({ page, near }) => {
      const r = await page.evaluate(() => { const W = __ws; W.buildLevel(2); W.setSpeed(0); for (let k = 0; k < W.D.length; k++) W.D[k] = (k * 7919 % 13) / 10;
        const vol = () => { let v = 0; for (let k = 0; k < W.D.length; k++) v += W.D[k]; return v; }, v0 = vol();
        for (let i = 0; i < 50; i++) { W.parts.flux(); W.parts.waterStep(); } return [v0, vol()]; });
      near(r[1], r[0], r[0] * 1e-4);
    },
    'soil: erosion/deposition and slumping conserve terrain + suspended sediment': async ({ page, near }) => {
      const r = await page.evaluate(() => { const W = __ws; W.buildLevel(1); W.setSpeed(0); for (let i = 0; i < 300; i++) W.step(0); // a river is running
        const sum = () => { let b = 0, s = 0; for (let k = 0; k < W.B.length; k++) { b += W.B[k]; s += W.SED[k]; } return b + s; };
        const a0 = sum(); for (let i = 0; i < 20; i++) { W.parts.flux(); W.parts.waterStep(); } const a1 = sum(); W.parts.thermal(); const a2 = sum(); return [a0, a1, a2]; });
      near(r[1], r[0], Math.abs(r[0]) * 1e-6, 'erosion'); near(r[2], r[1], Math.abs(r[1]) * 1e-6, 'thermal');
    },
    'First Spring: low springs are refused, idle never wins, a high spring wins': async ({ page, eq, ok }) => {
      await level(page, 0);
      eq(await page.evaluate(`${FF}(400, 0)`), 'none');
      eq(await page.evaluate(() => [__ws.placeSpring(80, 140), __ws.springs.length]), [false, 0], 'a spring by the sea was accepted');
      ok(await page.evaluate(() => __ws.placeSpring(70, 25))); const r = await page.evaluate(`${FF}(900, 0)`); ok(r.startsWith('WIN'), r);
    },
    'Mountain Lake: rain in the basin fills a lake; only water inside the rim counts': async ({ page, ok, eq }) => {
      await level(page, 2); eq(await page.evaluate(`${FF}(600, 2)`), 'none', 'idle');
      const r = await page.evaluate(`(() => { __ws.setTool('rain'); Object.assign(__ws.brush, { active: true, x: 80, y: 80 }); const r = ${FF}(2000, 2); __ws.brush.active = false; return r; })()`);
      ok(r.startsWith('WIN'), 'rain in the basin: ' + r);
      // water pooled against the map edge, outside the rim, is not a lake
      const out = await page.evaluate(() => { const W = __ws; W.buildLevel(2); W.setSpeed(0); for (let y = 0; y < 8; y++) for (let x = 0; x < 160; x++) W.D[y * 160 + x] = 3; return W.measure().lakeArea; });
      eq(out, 0);
    },
    'Save the Village: starts paused; idle floods, a mound in the wrong place floods, a levee or a ditch saves it': async ({ page, eq, ok }) => {
      await page.evaluate(() => __ws.buildLevel(5)); eq(await page.evaluate(() => __ws.speed), 0, 'storm level must start paused');
      await page.waitForTimeout(700); eq(await page.evaluate(() => __ws.stat.simT), 0, 'time ran while paused');
      const idle = await page.evaluate(`${FF}(1500, 5)`); ok(idle.startsWith('FAIL'), 'idle: ' + idle);
      await level(page, 5); await page.evaluate(() => { __ws.brushR.raise = 7; __ws.stroke('raise', [[96, 102], [101, 112], [91, 121]], 3); });
      ok((await page.evaluate(`${FF}(1500, 5)`)).startsWith('FAIL'), 'mounds by the houses saved the village');
      await level(page, 5); await page.evaluate(() => { __ws.brushR.raise = 5; __ws.stroke('raise', [[84, 94], [98, 96], [112, 94]]); });
      const lev = await page.evaluate(`${FF}(5000, 5)`); ok(lev.startsWith('WIN') && steps(lev) >= 4200, 'levee: ' + lev);
      ok(await page.evaluate(() => __ws.LV[5].test(__ws.stat) && __ws.stat.calmT >= 60), 'won before the water drained');
      await level(page, 5); await page.evaluate(() => { __ws.brushR.dig = 5; __ws.stroke('dig', [[97, 84], [90, 88], [82, 90]]); });
      ok((await page.evaluate(`${FF}(5000, 5)`)).startsWith('WIN'), 'ditch did not win');
    },
    'Through the Ridge: idle stays dammed, a notch where the river meets the ridge breaks through': async ({ page, ok, eq }) => {
      await level(page, 7); eq(await page.evaluate(`${FF}(1500, 7)`), 'none');
      await level(page, 7); const left = await page.evaluate(() => __ws.stroke('dig', [[99, 84], [99, 94]], 10)); ok(left >= 0, 'budget went negative');
      const r = await page.evaluate(`${FF}(4000, 7)`); ok(r.startsWith('WIN'), 'notch: ' + r);
    },
    'The Falls and Delta: idle does not win; a spring on the shelf / two springs make it': async ({ page, ok, eq }) => {
      await level(page, 3); eq(await page.evaluate(`${FF}(1200, 3)`), 'none');
      await page.evaluate(() => __ws.placeSpring(100, 55)); ok((await page.evaluate(`${FF}(6000, 3)`)).startsWith('WIN'), 'falls');
      await level(page, 4); eq(await page.evaluate(`${FF}(1200, 4)`), 'none');
      await page.evaluate(() => __ws.placeSpring(80, 40)); ok((await page.evaluate(`${FF}(5000, 4)`)).startsWith('WIN'), 'delta');
    },
    'idle never wins Canyon, Irrigation or Reservoir (no dam)': async ({ page, eq }) => {
      for (const lv of [1, 6, 8]) { await level(page, lv); if (lv === 8) await page.evaluate(() => __ws.placeSpring(80, 20)); eq(await page.evaluate(`${FF}(1200, ${lv})`), 'none', 'level ' + lv); }
    },
    'springs: the limit moves your oldest spring, fixed springs never move': async ({ page, eq }) => {
      await level(page, 1); const r = await page.evaluate(() => { const W = __ws; W.placeSpring(40, 40); W.placeSpring(60, 40); W.placeSpring(100, 40); return W.springs.map(s => s.k); });
      eq(r, [40 * 160 + 60, 40 * 160 + 100]);
      await level(page, 6); const f = await page.evaluate(() => { const W = __ws, k0 = W.springs[0].k; W.LV[6].tools.spring = 1; W.placeSpring(50, 50); W.placeSpring(60, 60); const ks = W.springs.map(s => s.k); W.LV[6].tools.spring = undefined; delete W.LV[6].tools.spring; return [ks[0] === k0, ks.length]; });
      eq(f, [true, 2]);
    },
    'sculpting: budgets are never overspent, houses cannot be dug, undo restores terrain and budget exactly': async ({ page, ok, eq }) => {
      await level(page, 5);
      const r = await page.evaluate(() => { const W = __ws, B0 = W.B.slice(), b0 = W.budget.raise;
        const left = W.stroke('raise', [[20, 20], [140, 20], [140, 60], [20, 60], [20, 100]], 4); // far more than the budget allows
        const house = W.NOSCULPT.indexOf(1), hb = W.B[house]; W.stroke('dig', [[house % 160, (house / 160) | 0], [house % 160 + 1, (house / 160) | 0]]);
        const houseSame = W.B[house] === hb; W.doUndo(); W.doUndo(); let diff = 0; for (let k = 0; k < B0.length; k++) diff = Math.max(diff, Math.abs(W.B[k] - B0[k]));
        return { left, houseSame, diff, b: W.budget.raise, b0 }; });
      ok(r.left >= 0 && r.left < 1, 'raise budget left ' + r.left); ok(r.houseSame, 'dug under a house'); eq(r.diff, 0, 'undo left terrain changed'); eq(r.b, r.b0);
    },
    'locked landscapes cannot be opened; the sandbox always can': async ({ page, eq }) => {
      await page.evaluate(() => document.querySelector('#levels .lv[data-i="4"]').click()); eq(await page.evaluate(() => document.getElementById('lvName').textContent), 'First Spring');
      await page.evaluate(() => document.querySelector('#levels .lv[data-i="9"]').click()); eq(await page.evaluate(() => document.getElementById('lvName').textContent), 'Sandbox');
    },
    'saves: corrupted values load safely; progress counts only goal levels and never exceeds 1': async ({ page, eq }) => {
      eq(await page.evaluate(() => [null, 'x', [], { done: 4, cur: 'q' }, { done: { 0: 1, 9: 1, 99: 1, z: 1 }, cur: 9, intro: 1 }].map(__ws.cleanSave)),
        [{ done: {}, cur: 0, intro: 0 }, { done: {}, cur: 0, intro: 0 }, { done: {}, cur: 0, intro: 0 }, { done: {}, cur: 0, intro: 0 }, { done: { 0: 1 }, cur: 9, intro: 1 }]);
      await plant(page, '{"done":'); eq(await page.evaluate(() => document.getElementById('lvName').textContent), 'First Spring');
      await plant(page, JSON.stringify({ done: Object.fromEntries([...Array(10).keys()].map(i => [i, 1])), cur: 3 }));
      eq(await page.evaluate(() => [document.getElementById('lvName').textContent, JSON.parse(localStorage.getItem('rh:hub')).watershed]), ['The Falls', 1]);
    },
    'speed: slow-erosion landscapes start at 3x; a real click on 1x starts the storm': async ({ page, eq, ok }) => {
      await page.evaluate(() => __ws.buildLevel(1)); eq(await page.evaluate(() => __ws.speed), 3);
      await page.evaluate(() => __ws.buildLevel(5)); eq(await page.evaluate(() => __ws.speed), 0);
      await page.locator('#speed [data-s="1"]').click(); await page.waitForTimeout(800); ok(await page.evaluate(() => __ws.stat.simT > 0), 'storm did not start');
      await page.evaluate(() => __ws.buildLevel(0)); eq(await page.evaluate(() => __ws.speed), 1);
    },
    'phone layout: every landscape builds without errors': async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (let i = 0; i < 10; i++) { await page.evaluate(i => __ws.buildLevel(i), i); await page.waitForTimeout(120); }
    },
  },
};
