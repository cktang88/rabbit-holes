// Watershed: the erosion model must conserve water and soil where it should, every goal must be reachable by a known plan and not
// by doing nothing, and the tools (springs, sculpting, budgets, undo) must behave at their limits.
const plant = async (page, raw) => { await page.addInitScript(raw => localStorage.setItem('rh:watershed', raw), raw); await page.reload(); await page.waitForFunction(() => window.__ws, null, { timeout: 15000 }); };
// fast-forward n steps, checking the level's own test/fail every 30 steps (= 0.25 s at 1x), as the game loop does
const FF = `((n, lv) => { const W = __ws, L = W.LV[lv]; let st; for (let i = 1; i <= n; i++) { W.step(0); if (i % 30 === 0) { st = W.measure(); if (L.fail && L.fail(st)) return 'FAIL@' + i; if (L.test(st)) return 'WIN@' + i; } } return 'none'; })`;
const level = (page, i) => page.evaluate(i => { __ws.buildLevel(i); __ws.setSpeed(0); }, i);
const steps = s => +s.split('@')[1];

module.exports = {
  page: 'watershed/index.html',
  ready: page => page.waitForFunction(() => window.__ws, null, { timeout: 15000 }),
  tests: {
    'model: level data, water volume conserved by the pipe model, terrain + sediment conserved by erosion and slumping': async ({ page, eq, ok, near }) => {
      const r = await page.evaluate(() => __ws.LV.map(L => [L.n, !!L.free, typeof L.test, typeof L.prog, Object.keys(L.tools).length > 0]));
      eq(r.length, 10); eq(r[9][1], true); ok(r.slice(0, 9).every(x => !x[1] && x[2] === 'function' && x[3] === 'function' && x[4]), 'level data');
      const w = await page.evaluate(() => { const W = __ws; W.buildLevel(2); W.setSpeed(0); for (let k = 0; k < W.D.length; k++) W.D[k] = (k * 7919 % 13) / 10;
        const vol = () => { let v = 0; for (let k = 0; k < W.D.length; k++) v += W.D[k]; return v; }, v0 = vol();
        for (let i = 0; i < 50; i++) { W.parts.flux(); W.parts.waterStep(); } return [v0, vol()]; });
      near(w[1], w[0], w[0] * 1e-4, 'water');
      const s = await page.evaluate(() => { const W = __ws; W.buildLevel(1); W.setSpeed(0); for (let i = 0; i < 300; i++) W.step(0); // a river is running
        const sum = () => { let b = 0, s = 0; for (let k = 0; k < W.B.length; k++) { b += W.B[k]; s += W.SED[k]; } return b + s; };
        const a0 = sum(); for (let i = 0; i < 20; i++) { W.parts.flux(); W.parts.waterStep(); } const a1 = sum(); W.parts.thermal(); const a2 = sum(); return [a0, a1, a2]; });
      near(s[1], s[0], Math.abs(s[0]) * 1e-6, 'erosion'); near(s[2], s[1], Math.abs(s[1]) * 1e-6, 'thermal');
    },
    'First Spring and Mountain Lake: idle never wins, low springs refused, the right action wins, only basin water counts': async ({ page, eq, ok }) => {
      await level(page, 0); eq(await page.evaluate(`${FF}(400, 0)`), 'none');
      eq(await page.evaluate(() => [__ws.placeSpring(80, 140), __ws.springs.length]), [false, 0], 'a spring by the sea was accepted');
      ok(await page.evaluate(() => __ws.placeSpring(70, 25))); const r = await page.evaluate(`${FF}(900, 0)`); ok(r.startsWith('WIN'), r);
      await level(page, 2); eq(await page.evaluate(`${FF}(600, 2)`), 'none', 'idle lake');
      const l = await page.evaluate(`(() => { __ws.setTool('rain'); Object.assign(__ws.brush, { active: true, x: 80, y: 80 }); const r = ${FF}(2000, 2); __ws.brush.active = false; return r; })()`);
      ok(l.startsWith('WIN'), 'rain in the basin: ' + l);
      // water pooled against the map edge, outside the rim, is not a lake
      eq(await page.evaluate(() => { const W = __ws; W.buildLevel(2); W.setSpeed(0); for (let y = 0; y < 8; y++) for (let x = 0; x < 160; x++) W.D[y * 160 + x] = 3; return W.measure().lakeArea; }), 0);
    },
    'Save the Village: starts paused; idle floods; a levee holds through the storm and until it drains': async ({ page, eq, ok }) => {
      await page.evaluate(() => __ws.buildLevel(5)); eq(await page.evaluate(() => __ws.speed), 0, 'storm level must start paused');
      await page.waitForTimeout(700); eq(await page.evaluate(() => __ws.simT), 0, 'time ran while paused');
      const idle = await page.evaluate(`${FF}(1500, 5)`); ok(idle.startsWith('FAIL'), 'idle: ' + idle);
      await level(page, 5); await page.evaluate(() => { __ws.brushR.raise = 5; __ws.stroke('raise', [[84, 94], [98, 96], [112, 94]]); });
      const lev = await page.evaluate(`${FF}(5000, 5)`); ok(lev.startsWith('WIN') && steps(lev) >= 4200, 'levee: ' + lev);
      ok(await page.evaluate(() => __ws.stat().calmT >= 60), 'won before the water drained');
    },
    'Through the Ridge and The Falls: idle never wins; a notch / a spring on the shelf does': async ({ page, ok, eq }) => {
      await level(page, 7); eq(await page.evaluate(`${FF}(600, 7)`), 'none', 'ridge idle');
      await level(page, 7); const left = await page.evaluate(() => __ws.stroke('dig', [[99, 84], [99, 94]], 10)); ok(left >= 0, 'budget went negative');
      const r = await page.evaluate(`${FF}(4000, 7)`); ok(r.startsWith('WIN'), 'notch: ' + r);
      await level(page, 3); eq(await page.evaluate(`${FF}(600, 3)`), 'none', 'falls idle');
      await level(page, 3); await page.evaluate(() => __ws.placeSpring(80, 50)); const f = await page.evaluate(`${FF}(3000, 3)`); ok(f.startsWith('WIN'), 'falls: ' + f);
      await level(page, 8); await page.evaluate(() => __ws.placeSpring(80, 20)); eq(await page.evaluate(`${FF}(900, 8)`), 'none', 'reservoir without a dam');
    },
    'tools: spring limit moves your oldest; fixed springs stay; budgets never overspent; houses undiggable; undo is exact': async ({ page, ok, eq }) => {
      await level(page, 1); eq(await page.evaluate(() => { const W = __ws; W.placeSpring(40, 40); W.placeSpring(60, 40); W.placeSpring(100, 40); return W.springs.map(s => s.k); }), [40 * 160 + 60, 40 * 160 + 100]);
      await level(page, 6); eq(await page.evaluate(() => { const W = __ws, T = W.LV[6].tools, k0 = W.springs[0].k; T.spring = 1; W.placeSpring(50, 50); W.placeSpring(60, 60); const ks = W.springs.map(s => s.k); delete T.spring; return [ks[0] === k0, ks.length]; }), [true, 2]);
      await level(page, 5);
      const r = await page.evaluate(() => { const W = __ws, B0 = W.B.slice(), b0 = W.budget.raise;
        const left = W.stroke('raise', [[20, 20], [140, 20], [140, 60], [20, 60], [20, 100]], 4); // far more than the budget allows
        const house = W.NOSCULPT.indexOf(1), hb = W.B[house]; W.stroke('dig', [[house % 160, (house / 160) | 0], [house % 160 + 1, (house / 160) | 0]]);
        const houseSame = W.B[house] === hb; W.doUndo(); W.doUndo(); let diff = 0; for (let k = 0; k < B0.length; k++) diff = Math.max(diff, Math.abs(W.B[k] - B0[k]));
        return { left, houseSame, diff, b: W.budget.raise, b0 }; });
      ok(r.left >= 0 && r.left < 1, 'raise budget left ' + r.left); ok(r.houseSame, 'dug under a house'); eq(r.diff, 0, 'undo left terrain changed'); eq(r.b, r.b0);
    },
    'UI: locked landscapes stay shut, sandbox open; slow levels start at 3x; a real click on 1x starts the storm; phone layout': async ({ page, eq, ok }) => {
      await page.evaluate(() => document.querySelector('#levels .lv[data-i="4"]').click()); eq(await page.evaluate(() => document.getElementById('lvName').textContent), 'First Spring');
      await page.evaluate(() => document.querySelector('#levels .lv[data-i="9"]').click()); eq(await page.evaluate(() => document.getElementById('lvName').textContent), 'Sandbox');
      await page.evaluate(() => __ws.buildLevel(1)); eq(await page.evaluate(() => __ws.speed), 3);
      await page.evaluate(() => __ws.buildLevel(5)); eq(await page.evaluate(() => __ws.speed), 0);
      await page.locator('#speed [data-s="1"]').click(); await page.waitForFunction(() => __ws.simT > 0, null, { timeout: 8000 });
      await page.evaluate(() => __ws.buildLevel(0)); eq(await page.evaluate(() => __ws.speed), 1);
      await page.setViewportSize({ width: 390, height: 844 });
      for (const i of [2, 5, 9]) { await page.evaluate(i => __ws.buildLevel(i), i); await page.waitForTimeout(80); }
    },
    'saves: corrupted values load safely; progress counts only goal levels and never exceeds 1': async ({ page, eq }) => {
      eq(await page.evaluate(() => [null, 'x', [], { done: 4, cur: 'q' }, { done: { 0: 1, 9: 1, 99: 1, z: 1 }, cur: 9, intro: 1 }].map(__ws.cleanSave)),
        [{ done: {}, cur: 0, intro: 0 }, { done: {}, cur: 0, intro: 0 }, { done: {}, cur: 0, intro: 0 }, { done: {}, cur: 0, intro: 0 }, { done: { 0: 1 }, cur: 9, intro: 1 }]);
      await plant(page, '{"done":'); eq(await page.evaluate(() => document.getElementById('lvName').textContent), 'First Spring');
      await plant(page, JSON.stringify({ done: Object.fromEntries([...Array(10).keys()].map(i => [i, 1])), cur: 3 }));
      eq(await page.evaluate(() => [document.getElementById('lvName').textContent, JSON.parse(localStorage.getItem('rh:hub')).watershed]), ['The Falls', 1]);
    },
  },
};
