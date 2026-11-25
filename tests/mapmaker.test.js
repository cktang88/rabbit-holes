// Mapmaker: the chart room. Ship's logs become rays; the player's corrections (close the traverse, turn a bent compass,
// strike a liar, leave off a phantom, buy a survey) decide where landmarks land; merchants then sail the chart against the truth.
// Bots run the real model in the page (window.__map): idle, naive and random charts fail, a competent navigator passes,
// no single fixed strategy passes every sheet, play is deterministic, saves survive corruption and the UI works by mouse.
const reloadWith = async (page, key, v) => { await page.addInitScript(([k, val]) => { try { localStorage.setItem(k, val); } catch (e) {} }, [key, v]); await page.reload(); await page.waitForTimeout(600); };
const RUN = (bot, sheets) => `(() => { const A = window.__map, M = A.M; return ${JSON.stringify(sheets)}.map(i => { const d = A.SHEETS[i]; const S = M.sheet(d.spec, d.n + ':a');
  const r = A.NAV[${JSON.stringify(bot)}](M, S); const sc = M.score(S, r.st, r.est); return { i, coins: sc.coins, target: d.target, pass: sc.coins >= d.target, wrecks: sc.wrecks }; }); })()`;
const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

module.exports = {
  page: 'mapmaker/index.html',
  tests: {
    'opens straight onto sheet I: no modal, logs in the book, a hint on the chart': async ({ page, ok, eq }) => {
      eq(await page.locator('.modal').count(), 0, 'no intro modal');
      ok(await page.locator('#tabs button').count() >= 2); ok(await page.locator('#note').textContent().then(t => /log/.test(t)));
      await page.click('#tabs button >> nth=0'); eq(await page.evaluate(() => __map.sel), 0);
      ok(await page.locator('#page .entries div').count() > 2, 'the log page lists its entries');
    },
    'idle and naive charts fail; the competent navigator passes every sheet': async ({ page, ok }) => {
      const idle = await page.evaluate(RUN('idle', ALL)), nav = await page.evaluate(RUN('competent', ALL));
      for (const r of idle) ok(!r.pass, `idle passed sheet ${r.i + 1}: ${r.coins}/${r.target}`);
      for (const r of nav) ok(r.pass, `navigator failed sheet ${r.i + 1}: ${r.coins}/${r.target}`);
    },
    'no single fixed strategy passes every sheet': async ({ page, ok }) => {
      for (const bot of ['close', 'closeStrike', 'noSurvey']) { const r = await page.evaluate(RUN(bot, ALL)); ok(r.some(x => !x.pass), `${bot} passed every sheet`); }
      const close = await page.evaluate(RUN('close', [2, 3, 5, 6])); ok(close.every(x => !x.pass), 'closing traverses alone fails the liar, needle, phantom and lost-ship sheets');
    },
    'random fiddling fails': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const A = __map, M = A.M, rr = M.rngOf('rnd'); let pass = 0, n = 0;
        for (const i of [2, 3, 5, 6, 7, 9]) for (let k = 0; k < 2; k++) { const d = A.SHEETS[i], S = M.sheet(d.spec, d.n + ':a'), st = M.newState(S);
          st.logs.forEach(s => { s.dev = rr.int(5) - 2; s.drift = [rr.range(-12, 12), rr.range(-12, 12)]; s.struck = rr() < 0.25; }); n++; if (M.score(S, st, M.estimate(S, st, S.logs)).coins >= d.target) pass++; }
        return { pass, n }; });
      ok(r.pass === 0, `random charts passed ${r.pass}/${r.n}`);
    },
    'deterministic per seed; different seeds differ': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const A = __map, M = A.M, d = A.SHEETS[6]; const s1 = M.sheet(d.spec, 'x'), s2 = M.sheet(d.spec, 'x'), s3 = M.sheet(d.spec, 'y');
        const j = (S) => JSON.stringify({ l: S.logs.map(L => L.entries), f: Object.values(S.T.feats).map(f => f.p) });
        const sc = (S) => { const r = A.NAV.closeStrike(M, S); return M.score(S, r.st, r.est).coins; };
        return { same: j(s1) === j(s2), diff: j(s1) !== j(s3), sc: sc(s1) === sc(s2) }; });
      ok(r.same && r.diff && r.sc);
    },
    'dragging the ship onto her port closes the traverse and the rays agree': async ({ page, ok }) => {
      await page.evaluate(() => { __map.closeOn(1); __map.recompute(); __map.renderAll(); }); await page.click('#tabs button >> nth=0');
      const before = await page.evaluate(() => { const A = __map, L = A.logs[0], tr = A.M.track(A.S, L, A.st.logs[0]), e = tr[tr.length - 1], p = A.S.T.ports[L.to].p; let s = 0, n = 0; for (const f of Object.values(A.est)) if (f.fixed) for (const r of f.rays) if (r.li === 0 && r.on) { s += r.res; n++; } return { e, p, res: s / n }; });
      const a = await page.evaluate(([x, y]) => __map.toScreen(x, y), before.e), b = await page.evaluate(([x, y]) => __map.toScreen(x, y), before.p);
      await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let k = 1; k <= 12; k++) await page.mouse.move(a[0] + (b[0] - a[0]) * k / 12 + 3, a[1] + (b[1] - a[1]) * k / 12 + 2); await page.mouse.up();
      const after = await page.evaluate(() => { const A = __map, L = A.logs[0], tr = A.M.track(A.S, L, A.st.logs[0]), e = tr[tr.length - 1], p = A.S.T.ports[L.to].p; let s = 0, n = 0; for (const f of Object.values(A.est)) if (f.fixed) for (const r of f.rays) if (r.li === 0 && r.on) { s += r.res; n++; } return { gap: Math.hypot(e[0] - p[0], e[1] - p[1]), res: s / n }; });
      ok(after.gap < 0.05, 'snapped onto the port: ' + after.gap); ok(after.res < before.res, `rays agree better: ${before.res} -> ${after.res}`);
      ok(await page.locator('#page .status.ok').count() === 1, 'the log page says the traverse is closed');
    },
    'compass, strike and ray toggles change the estimate immediately': async ({ page, ok }) => {
      await page.evaluate(() => __map.openSheet(3)).catch(() => {});
      await reloadWith(page, 'rh:mapmaker2', JSON.stringify({ v: 2, best: { 0: { coins: 70, stars: 1 }, 1: { coins: 110, stars: 1 }, 2: { coins: 100, stars: 1 } }, cur: 3 }));
      ok(await page.evaluate(() => __map.si === 3));
      const r = await page.evaluate(() => { const A = __map; const i = A.logs.findIndex(L => L.kind === 'dev'); A.sel = i; const f0 = JSON.stringify(Object.values(A.est).map(e => e.p)); return { i, f0, dev: A.logs[i].truth.dev }; });
      await page.click(`#page [data-dv="${r.dev > 0 ? 1 : -1}"]`);
      ok(await page.evaluate(f0 => JSON.stringify(Object.values(__map.est).map(e => e.p)) !== f0, r.f0), 'turning the compass moves the marks');
      await page.click('#strikeBtn'); ok(await page.evaluate(i => __map.st.logs[i].struck, r.i)); await page.click('#strikeBtn');
      const ray = await page.evaluate(() => { const A = __map, R = A.M.rays(A.S, A.st, A.logs).filter(r => r.li === A.sel); const r = R[0], d = A.M.dirOf(r.b); return A.toScreen(r.o[0] + d[0] * 3, r.o[1] + d[1] * 3); });
      await page.mouse.click(ray[0], ray[1]);
      ok(await page.evaluate(() => Object.keys(__map.st.logs[__map.sel].off).length === 1), 'tapping a ray strikes that one sighting');
    },
    'publishing seals, sails the merchants, reveals the truth and saves the best': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __map.closeOn(0); __map.closeOn(1); __map.recompute(); __map.renderAll(); });
      await page.click('#publish'); await page.waitForTimeout(3200);
      const r = await page.evaluate(() => ({ p: __map.published && __map.published.won, best: __map.SAVE.best[0], res: document.getElementById('result').textContent }));
      ok(r.p, 'a closed fair copy passes sheet I'); ok(r.best && r.best.coins >= 60); ok(/truly lies/.test(r.res), 'the red truth is explained');
      await page.click('#nextSheet'); eq(await page.evaluate(() => __map.si), 1);
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:mapmaker2'))); ok(stored.best[0] && stored.v === 2);
    },
    'an uncorrected chart wrecks or falls short, and the result says where': async ({ page, ok }) => {
      await page.click('#publish'); await page.waitForTimeout(3200);
      const r = await page.evaluate(() => ({ won: __map.published.won, txt: document.getElementById('result').textContent }));
      ok(!r.won); ok(/outside|wrecked/.test(r.txt), r.txt.slice(0, 200));
      await page.click('#redraw'); ok(await page.evaluate(() => !__map.published && __map.st.logs.every(s => s.drift[0] === 0)), 'redraw restarts instantly');
    },
    'a survey voyage costs 10 and adds an honest log': async ({ page, ok, eq }) => {
      const n0 = await page.evaluate(() => __map.logs.length);
      await page.click('#feats [data-s] >> nth=0');
      eq(await page.evaluate(() => __map.logs.length), n0 + 1); eq(await page.evaluate(() => __map.st.spent), 10);
    },
    'corrupted saves are survived': async ({ page, ok }) => {
      for (const bad of ['{', 'null', '[]', '{"v":2,"best":{"0":{"coins":"x"},"42":{"coins":5}},"cur":99,"daily":{"<x>":3,"2026-01-01":"9"}}', '{"v":1,"stuff":true}']) {
        await reloadWith(page, 'rh:mapmaker2', bad);
        const s = await page.evaluate(() => ({ si: __map.si, logs: __map.logs.length })); ok(s.si === 0 && s.logs >= 2, 'boots from ' + bad);
      }
    },
    'Survey of the day: a seeded link, a target, and idle fails it': async ({ page, ok, eq }) => {
      await page.goto(page.url().split('#')[0] + '#survey=2026-11-25'); await page.reload(); await page.waitForTimeout(600);
      const r = await page.evaluate(() => ({ d: __map.daily && __map.daily.seed, t: __map.daily && __map.daily.target, logs: __map.logs.length }));
      eq(r.d, '2026-11-25'); ok(r.t > 40 && r.logs >= 4);
      const days = await page.evaluate(() => { const A = __map, M = A.M; return ['2026-11-25', '2026-11-26', '2026-11-28', '2026-12-02'].map(k => { const d = A.dailySpec(k); d.seed = k; const S = M.sheet(d.spec, 'daily:' + k); const t = Math.round(0.9 * (S.routes.length * 30 + Object.values(S.T.feats).filter(f => f.kind === 'cape').length * 5 + S.T.reefs.length * 4));
        const sc = (b) => { const r = A.NAV[b](M, S); return M.score(S, r.st, r.est).coins; }; return { idle: sc('idle') >= t, close: sc('close') >= t }; }); });
      ok(days.every(d => !d.idle), 'idle never passes a daily'); ok(days.some(d => !d.close), 'closing traverses alone fails some days');
    },
  },
};
