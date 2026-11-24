// Watershed: a river-basin commission on a live erosion model. Each site must be lost by idling or by the obvious move,
// won by a known plan, and its trade-offs must show up in the numbers.
const plant = async (page, raw) => { await page.addInitScript(raw => localStorage.setItem('rh:watershed', raw), raw); await page.reload(); await page.waitForFunction(() => window.__ws, null, { timeout: 20000 }); };
// build a site, place a plan, run every year headless, report the numbers
const run = (page, lv, plan) => page.evaluate(([lv, plan]) => { const W = __ws; W.buildLevel(lv); const refused = W.plan(plan); const s = W.runYears(99);
  return { refused, goal: s.goalMet, harvest: s.harvest, floods: s.floods, power: s.power, delta: s.deltaPct, medals: W.SC[lv].medals.filter(([, f]) => f(s)).length }; }, [lv, plan]);
const FIELDS_MID = [['farm', [62, 75]], ['farm', [62, 88]], ['farm', [62, 101]], ['farm', [84, 75]], ['farm', [84, 86]], ['farm', [50, 80]]];
const FIELDS_FAR = [['farm', [30, 50]], ['farm', [30, 62]], ['farm', [30, 74]], ['farm', [120, 50]], ['farm', [120, 62]], ['farm', [120, 74]]];
const CROSS_LEVEE = ['levee', [84, 94], [110, 95]];
const BANK_LEVEES = [['levee', [80, 90], [81, 112]], ['levee', [81, 112], [79, 132]]];

module.exports = {
  page: 'watershed/index.html',
  ready: page => page.waitForFunction(() => window.__ws, null, { timeout: 20000 }),
  tests: {
    'model: water volume conserved by the pipe model; terrain + sediment conserved by erosion and slumping': async ({ page, near }) => {
      const w = await page.evaluate(() => { const W = __ws; W.buildLevel(0); for (let k = 0; k < W.D.length; k++) W.D[k] = (k * 7919 % 13) / 10;
        for (let k = 0; k < W.D.length; k++) if (W.SEA[k]) W.D[k] = 0; W.SEA.fill(0);
        const vol = () => { let v = 0; for (let k = 0; k < W.D.length; k++) v += W.D[k]; return v; }, v0 = vol();
        for (let i = 0; i < 50; i++) { W.parts.flux(); W.parts.waterStep(); } return [v0, vol()]; });
      near(w[1], w[0], w[0] * 1e-4, 'water');
      const s = await page.evaluate(() => { const W = __ws; W.buildLevel(1); const sum = () => { let b = 0, s = 0; for (let k = 0; k < W.B.length; k++) { b += W.B[k]; s += W.SED[k]; } return b + s; };
        const a0 = sum(); for (let i = 0; i < 20; i++) { W.parts.flux(); W.parts.waterStep(); } const a1 = sum(); W.parts.thermal(); return [a0, a1, sum()]; });
      near(s[1], s[0], Math.abs(s[0]) * 1e-6, 'erosion'); near(s[2], s[1], Math.abs(s[1]) * 1e-6, 'thermal');
    },
    'The Levee: idle loses; riverside fields alone flood the town; fields + a levee across the flood path wins': async ({ page, ok, eq }) => {
      const idle = await run(page, 0, []); ok(!idle.goal && idle.harvest === 0, 'idle');
      const noLevee = await run(page, 0, FIELDS_MID); ok(!noLevee.goal && Math.max(...noLevee.floods) > 2, 'fields without a levee should flood Upper Town ' + JSON.stringify(noLevee));
      const win = await run(page, 0, [...FIELDS_MID, CROSS_LEVEE]); eq(win.refused, []); ok(win.goal, 'known plan ' + JSON.stringify(win));
      ok(win.medals >= 2, 'the known plan keeps both towns dry');
    },
    'The Levee trade-offs: bank levees push the flood onto Upper Town; far fields yield less than riverside ones': async ({ page, ok }) => {
      const idle = await run(page, 0, []), banks = await run(page, 0, [...FIELDS_MID, ...BANK_LEVEES]);
      ok(banks.floods[0] > idle.floods[0], `levees along the banks should make Upper Town worse (${banks.floods[0]} vs ${idle.floods[0]})`);
      const mid = await run(page, 0, [...FIELDS_MID, CROSS_LEVEE]), far = await run(page, 0, [...FIELDS_FAR, CROSS_LEVEE]);
      ok(mid.harvest > far.harvest * 1.15, `riverside ${mid.harvest} vs far ${far.harvest}`);
    },
    'The High Dam: a dam in the gorge starves the delta; higher up with a spillway it meets both goals': async ({ page, ok }) => {
      const idle = await run(page, 1, []); ok(!idle.goal && idle.power === 0, 'idle');
      const gorge = await run(page, 1, [['dam', [62, 70], [98, 70]]]); ok(!gorge.goal && gorge.delta < idle.delta - 3, 'gorge dam should cost the delta ' + JSON.stringify([gorge, idle.delta]));
      const win = await run(page, 1, [['dam', [62, 45], [98, 45]], ['cut', [80, 38], [80, 52]]]); ok(win.goal, 'known plan ' + JSON.stringify(win));
    },
    'difficulty: naive play fails the late site (idle, the obvious gorge dam, random works); a competent plan wins; 3 medals need more': async ({ page, ok }) => {
      // seeded random policy: a dam and a cut at random places and angles
      const rnd = s => () => (s = s * 16807 % 2147483647) / 2147483647;
      const naive = [[], [['dam', [62, 70], [98, 70]]], [['dam', [60, 95], [100, 95]]]];
      for (const seed of [3, 7]) { const r = rnd(seed), y = 20 + r() * 110, x = 40 + r() * 40, cy = y + (r() - .5) * 30; naive.push([['dam', [x, y], [x + 36, y + (r() - .5) * 10]], ['cut', [x + 18, cy - 8], [x + 18, cy + 8]]]); }
      let wins = 0; for (const p of naive) if ((await run(page, 1, p)).goal) wins++;
      ok(wins / naive.length <= .2, `naive plans won ${wins}/${naive.length}`);
      const comp = await run(page, 1, [['dam', [62, 45], [98, 45]], ['cut', [80, 38], [80, 52]]]); ok(comp.goal && comp.medals < 3, 'competent plan should win without the third medal ' + JSON.stringify(comp));
    },
    'works: kits are limited, fields refuse the river and towns, removing a piece restores the ground exactly': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const W = __ws; W.buildLevel(0); const B0 = W.B.slice();
        const river = W.placeWork('farm', [72, 60]), town = W.placeWork('levee', [90, 100], [100, 115]);
        const okField = W.placeWork('farm', [62, 75]), lev = W.placeWork('levee', [84, 94], [110, 95]);
        const left = W.kitLeft('levee'); W.placeWork('levee', [40, 40], [40, 60]); W.placeWork('levee', [45, 40], [45, 60]); const full = W.placeWork('levee', [50, 40], [50, 60]);
        while (W.works.length) W.removeWork(W.works.length - 1); let diff = 0; for (let k = 0; k < B0.length; k++) diff = Math.max(diff, Math.abs(W.B[k] - B0[k]));
        return { river: typeof river, town: typeof town, okField: typeof okField, lev: typeof lev, left, full: typeof full, diff, use: W.USE.reduce((a, b) => a + b, 0) }; });
      eq([r.river, r.town, r.okField, r.lev, r.full], ['string', 'string', 'object', 'object', 'string']); eq(r.left, 2); eq(r.diff, 0); eq(r.use, 0);
    },
    'rounds: the clock stops after a flood year and the inquest names what happened where': async ({ page, ok }) => {
      await page.evaluate(() => { __ws.buildLevel(0); __ws.plan([['farm', [62, 75]], ['levee', [84, 94], [110, 95]]]); __ws.runYears(6); __ws.setSpeed(3); });
      await page.waitForFunction(() => __ws.inquest && __ws.speed === 0, null, { timeout: 40000 });
      const txt = await page.locator('#inq').textContent(); ok(/Year 7/.test(txt) && /Upper Town/.test(txt) && /Fields/.test(txt), txt);
      ok(await page.locator('.tag').count() >= 3, 'map tags missing');
      await page.locator('#go').click(); ok(!(await page.locator('.tag').count()), 'tags stay after resuming');
    },
    'UI: a real tap places a field, a drag draws a levee; locked sites stay shut': async ({ page, eq, ok }) => {
      await page.evaluate(() => __ws.buildLevel(0)); await page.waitForTimeout(400);
      const S = (x, y) => page.evaluate(([x, y]) => __ws.toScreen(x, y), [x, y]);
      await page.locator('.tool[data-t="farm"]').click(); let [x, y] = await S(62, 75); await page.mouse.click(x, y);
      await page.locator('.tool[data-t="levee"]').click(); [x, y] = await S(84, 94); const [x2, y2] = await S(108, 95);
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 8 }); await page.mouse.up();
      eq(await page.evaluate(() => __ws.works.map(w => w.t)), ['farm', 'levee']);
      ok((await page.locator('#works').textContent()).includes('Levee'), 'works list');
      await page.evaluate(() => document.querySelector('#levels .lv[data-i="1"]').click()); eq(await page.evaluate(() => document.getElementById('lvName').textContent), 'The Levee');
      await page.evaluate(() => document.querySelector('#levels .lv[data-i="2"]').click()); eq(await page.evaluate(() => document.getElementById('lvName').textContent), 'Open Basin');
    },
    'saves: corrupted and old saves load safely; progress counts medals and never exceeds 1': async ({ page, eq }) => {
      eq(await page.evaluate(() => [null, 'x', { v: 2, done: { 0: 1 }, cur: 3 }, { v: 3, medals: { 0: 2, 1: 9, 5: 1, z: 1 }, cur: 1 }].map(__ws.cleanSave)),
        [{ v: 3, medals: {}, cur: 0, intro: 0 }, { v: 3, medals: {}, cur: 0, intro: 0 }, { v: 3, medals: {}, cur: 0, intro: 0 }, { v: 3, medals: { 0: 2, 1: 3 }, cur: 1, intro: 0 }]);
      await plant(page, '{"medals":'); eq(await page.evaluate(() => document.getElementById('lvName').textContent), 'The Levee');
      await plant(page, JSON.stringify({ v: 3, medals: { 0: 3, 1: 3 }, cur: 1 }));
      eq(await page.evaluate(() => [document.getElementById('lvName').textContent, JSON.parse(localStorage.getItem('rh:hub')).watershed]), ['The High Dam', 1]);
    },
  },
};
