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
const rnd = s => () => (s = s * 16807 % 2147483647) / 2147483647, R3 = rnd(3), RX = 40 + R3() * 40, RY = 20 + R3() * 110;
// every full-length run the suite needs, computed once and in parallel on a few pages (each run is a few seconds of erosion)
const PLANS = {
  idle: [0, []], noLevee: [0, FIELDS_MID], win: [0, [...FIELDS_MID, CROSS_LEVEE]], banks: [0, [...FIELDS_MID, ...BANK_LEVEES]], far: [0, [...FIELDS_FAR, CROSS_LEVEE]],
  fwOld: [1, []], fwWin: [1, [CROSS_LEVEE, ['cut', [76, 80], [52, 100]], ['cut', [52, 100], [40, 125]]]], fwLevees: [1, [['levee', [84, 90], [110, 91]], ['levee', [84, 98], [110, 99]]]],
  nIdle: [2, []], nGorge: [2, [['dam', [62, 70], [98, 70]]]], nWin: [2, [['dam', [62, 45], [98, 45]], ['cut', [80, 38], [80, 52]]]], nLow: [2, [['dam', [60, 95], [100, 95]]]],
  nRandom: [2, [['dam', [RX, RY], [RX + 36, RY + (R3() - .5) * 10]], ['cut', [RX + 18, RY - 8], [RX + 18, RY + 8]]]],
};
let SIMS = null;
async function sims(page) {
  if (SIMS) return SIMS;
  const keys = Object.keys(PLANS), out = {}, W = 3, pages = [page];
  for (let i = 1; i < W; i++) { const p = await page.context().newPage(); await p.goto(page.url()); pages.push(p); }
  await Promise.all(pages.map(async (p, w) => { await p.waitForFunction(() => window.__ws, null, { timeout: 30000 });
    for (let i = w; i < keys.length; i += W) out[keys[i]] = await run(p, ...PLANS[keys[i]]); }));
  for (const p of pages.slice(1)) await p.close();
  return (SIMS = out);
}

module.exports = {
  page: 'watershed/index.html',
  viewport: { width: 900, height: 600 },
  ready: page => page.waitForFunction(() => window.__ws, null, { timeout: 20000 }),
  tests: {
    'model: water volume conserved by the pipe model; terrain + sediment conserved by erosion and slumping': async ({ page, near }) => {
      const w = await page.evaluate(() => { const W = __ws; W.buildLevel(0); for (let k = 0; k < W.D.length; k++) W.D[k] = (k * 7919 % 13) / 10;
        for (let k = 0; k < W.D.length; k++) if (W.SEA[k]) W.D[k] = 0; W.SEA.fill(0);
        const vol = () => { let v = 0; for (let k = 0; k < W.D.length; k++) v += W.D[k]; return v; }, v0 = vol();
        for (let i = 0; i < 50; i++) { W.parts.flux(); W.parts.waterStep(); } return [v0, vol()]; });
      near(w[1], w[0], w[0] * 1e-4, 'water');
      const s = await page.evaluate(() => { const W = __ws; W.buildLevel(2); const sum = () => { let b = 0, s = 0; for (let k = 0; k < W.B.length; k++) { b += W.B[k]; s += W.SED[k]; } return b + s; };
        const a0 = sum(); for (let i = 0; i < 20; i++) { W.parts.flux(); W.parts.waterStep(); } const a1 = sum(); W.parts.thermal(); return [a0, a1, sum()]; });
      near(s[1], s[0], Math.abs(s[0]) * 1e-6, 'erosion'); near(s[2], s[1], Math.abs(s[1]) * 1e-6, 'thermal');
    },
    'The Levee: idle loses; riverside fields alone flood the town; fields + a levee across the flood path wins': async ({ page, ok, eq }) => {
      const S = await sims(page);
      ok(!S.idle.goal && S.idle.harvest === 0, 'idle');
      ok(!S.noLevee.goal && Math.max(...S.noLevee.floods) > 2, 'fields without a levee should flood Upper Town ' + JSON.stringify(S.noLevee));
      eq(S.win.refused, []); ok(S.win.goal, 'known plan ' + JSON.stringify(S.win)); ok(S.win.medals >= 2, 'the known plan keeps both towns dry');
    },
    'The Levee trade-offs: bank levees push the flood onto Upper Town; far fields yield less than riverside ones': async ({ page, ok }) => {
      const S = await sims(page);
      ok(S.banks.floods[0] > S.idle.floods[0], `levees along the banks should make Upper Town worse (${S.banks.floods[0]} vs ${S.idle.floods[0]})`);
      ok(S.win.harvest > S.far.harvest * 1.15, `riverside ${S.win.harvest} vs far ${S.far.harvest}`);
    },
    'The Floodway (campaign): the 1927 works carry over and fail the bigger floods; more levees alone fail; a higher levee plus a floodway wins': async ({ page, ok, eq }) => {
      const S = await sims(page);
      ok(!S.fwOld.goal && Math.max(...S.fwOld.floods) > 2, 'inherited works alone ' + JSON.stringify(S.fwOld));
      ok(!S.fwLevees.goal, 'two more levees ' + JSON.stringify(S.fwLevees));
      ok(S.fwWin.goal, 'known plan ' + JSON.stringify(S.fwWin));
      // the plan you win a site with is what the next decade inherits
      const inh = await page.evaluate(() => { const W = __ws; localStorage.removeItem('rh:watershed'); W.buildLevel(0); W.plan([['farm', [62, 75]], ['levee', [84, 94], [110, 95]]]);
        W.SC[0].medals[0][1] = () => true; W.runYears(99); W.buildLevel(1); return W.works.map(w => w.t + (w.old ? '*' : '')); });
      eq(inh, ['farm*', 'levee*']);
    },
    'The High Dam: a dam in the gorge starves the delta; higher up with a spillway it meets both goals': async ({ page, ok }) => {
      const S = await sims(page);
      ok(!S.nIdle.goal && S.nIdle.power === 0, 'idle');
      ok(!S.nGorge.goal && S.nGorge.delta < S.nIdle.delta - 3, 'gorge dam should cost the delta ' + JSON.stringify([S.nGorge, S.nIdle.delta]));
      ok(S.nWin.goal, 'known plan ' + JSON.stringify(S.nWin));
    },
    'difficulty: naive play fails the late sites (idle, the obvious move, random works); competent plans win; 3 medals need more': async ({ page, ok }) => {
      const S = await sims(page), naive = [S.nIdle, S.nGorge, S.nLow, S.nRandom, S.fwOld, S.fwLevees];
      const wins = naive.filter(r => r.goal).length; ok(wins / naive.length <= .2, `naive plans won ${wins}/${naive.length}`);
      ok(S.nWin.goal && S.nWin.medals < 3 && S.fwWin.goal && S.fwWin.medals < 3, 'competent plans should win without the third medal ' + JSON.stringify([S.nWin, S.fwWin]));
    },
    'works: kits are limited, fields refuse the river and towns, removing a piece restores the ground exactly': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const W = __ws; W.buildLevel(0); const B0 = W.B.slice();
        let rk = -1; for (let k = 60 * W.N; k < 70 * W.N; k++) if (W.D[k] > W.D[rk] || rk < 0) rk = k; // the deepest water in rows 60-69 is the river
        const river = W.placeWork('farm', [rk % W.N, (rk / W.N) | 0]), town = W.placeWork('levee', [90, 100], [100, 115]);
        const okField = W.placeWork('farm', [62, 75]), lev = W.placeWork('levee', [84, 94], [110, 95]);
        const left = W.kitLeft('levee'); W.placeWork('levee', [40, 40], [40, 60]); W.placeWork('levee', [45, 40], [45, 60]); const full = W.placeWork('levee', [50, 40], [50, 60]);
        while (W.works.length) W.removeWork(W.works.length - 1); let diff = 0; for (let k = 0; k < B0.length; k++) diff = Math.max(diff, Math.abs(W.B[k] - B0[k]));
        return { river: typeof river, town: typeof town, okField: typeof okField, lev: typeof lev, left, full: typeof full, diff, use: W.USE.reduce((a, b) => a + b, 0) }; });
      eq([r.river, r.town, r.okField, r.lev, r.full], ['string', 'string', 'object', 'object', 'string']); eq(r.left, 2); eq(r.diff, 0); eq(r.use, 0);
    },
    'rounds: the clock stops after a flood year and the inquest names what happened where': async ({ page, ok }) => {
      await page.evaluate(() => { __ws.buildLevel(0); __ws.plan([['farm', [62, 75]], ['levee', [84, 94], [110, 95]]]); __ws.runYears(6); __ws.stepN(450); __ws.setSpeed(3); });
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
      await page.evaluate(() => document.querySelector('#levels .lv[data-i="3"]').click()); eq(await page.evaluate(() => document.getElementById('lvName').textContent), 'Open Basin');
    },
    'saves: corrupted and old saves load safely; progress counts medals and never exceeds 1': async ({ page, eq }) => {
      eq(await page.evaluate(() => [null, 'x', { v: 2, done: { 0: 1 }, cur: 3 }, { v: 3, medals: { 0: 2, 1: 9, 5: 1, z: 1 }, cur: 1, plans: { 0: [['farm', [62, 75], [62, 75]]], 1: [['bomb', [1, 1], [1, 1]]], 2: 'x' } }].map(__ws.cleanSave)),
        [{ v: 3, medals: {}, plans: {}, cur: 0, intro: 0 }, { v: 3, medals: {}, plans: {}, cur: 0, intro: 0 }, { v: 3, medals: {}, plans: {}, cur: 0, intro: 0 }, { v: 3, medals: { 0: 2, 1: 3 }, plans: { 0: [['farm', [62, 75], [62, 75]]] }, cur: 1, intro: 0 }]);
      await plant(page, '{"medals":'); eq(await page.evaluate(() => document.getElementById('lvName').textContent), 'The Levee');
      await plant(page, JSON.stringify({ v: 3, medals: { 0: 3, 1: 3, 2: 3 }, cur: 2 }));
      eq(await page.evaluate(() => [document.getElementById('lvName').textContent, JSON.parse(localStorage.getItem('rh:hub')).watershed]), ['The High Dam', 1]);
    },
  },
};
