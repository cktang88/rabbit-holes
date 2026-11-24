// Swarm (1914 beekeeping): colony model sanity, mites & oxalic, swarm triggers, scenario solutions, saves and UI.
const ready = async page => { await page.waitForFunction(() => window.__bee && __bee.world()); };
async function reopen(page) { const p = await page.context().newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(page.url()); await ready(p); p.errs = errs; return p; }

// A plain-rules beekeeper that wins every short scenario (the two-year apiary is exercised for sanity only).
const PLAY = `function play(id) {
  const B = __bee; B.load(id);
  if (id === 'first') { for (const t of TUT_TARGETS) B.identify(t); B.step(1); return B.result(); }
  for (let wk = 0; wk < 60 && !B.result(); wk++) {
    const w = B.world();
    for (let i = 0; i < w.hives.length; i++) {
      const h = w.hives[i]; if (!h.alive) continue; const mo = monthOf(w.day), act = a => { if (w.actsLeft > 0) B.act(a, i); };
      if ((id === 'queenless' || id === 'failing') && wk === 0) act('requeen');
      if (id === 'capped' && wk === 0 && i === 0) act('split');
      if (id === 'broodless') { if (wk === 0) act('cage'); if (wk === 3) act('oa'); }
      if (id === 'varroa') { if (wk === 0) { act('harvest'); act('cage'); } if (wk === 4) act('oa'); }
      if (id === 'winter') { if (wk < 3) act('feed'); if (mo === 6 && !h.oaDone) { act('oa'); h.oaDone = 1; } }
      if (['spring', 'swarm', 'flow', 'show', 'failing', 'capped'].includes(id)) {
        if (congestion(h).cong > .62 && h.supers < 5) act('super');
        if (id !== 'spring' && h.q.st === 'laying' && h.boxes === 1 && (h.imp > .3 || h.cups) && !h.demDone) { act('demaree'); h.demDone = 1; }
        if (h.qc.some(q => q.type === 'swarm') && h.q.st === 'laying') act('destroy');
        if (h.sH > 15000 && id !== 'spring') act('harvest');
      }
    }
    B.step(1);
  }
  return B.result();
}`;

module.exports = {
  page: 'swarm/index.html',
  ready,
  tests: {
    'every short scenario has a winning line, and doing nothing never wins': async ({ page, ok }) => {
      const r = await page.evaluate(`(() => { ${PLAY}; const out = [];
        for (const id of __bee.scenarios) { if (id === 'free' || id === 'apiary') continue;
          __bee.load(id); __bee.step(200); const idle = __bee.result(); const res = play(id);
          out.push({ id, idle: idle && idle.won, won: res && res.won, msg: res && res.msg }); }
        __bee.load('apiary'); __bee.step(200); out.push({ id: 'apiary', idle: __bee.result().won, won: true });
        return out; })()`);
      ok(r.length === 12, 'scenario count');
      for (const x of r) { ok(!x.idle, `${x.id} wins with no action`); ok(x.won, `${x.id} reference line lost: ${x.msg}`); }
    },
    'mites: they multiply while there is brood and not without it; oxalic kills riders, not sealed mites': async ({ page, ok, near }) => {
      const r = await page.evaluate(() => {
        const W = mkWorld({ ...SCEN.find(s => s.id === 'varroa'), seed: 't1' }), h = W.hives[0], m0 = mitesOf(h);
        for (let k = 0; k < 4; k++) stepWeek(W); const m4 = mitesOf(h);
        // broodless colony (no laying queen, no brood): mites cannot reproduce, they only die off slowly
        const W2 = mkWorld({ ...SCEN.find(s => s.id === 'varroa'), seed: 't2', hives: [{ adults: 30000, broodless: 1, mites: 2000, qst: 'none', noneDays: 0, honey: 12, lay: 0 }] }), h2 = W2.hives[0];
        h2.qc = [{ age: 0, type: 'emerg' }]; const b0 = mitesOf(h2); for (let k = 0; k < 7; k++) stepDay(W2, h2); const b1 = mitesOf(h2);
        // oxalic with brood vs broodless
        const W3 = mkWorld({ ...SCEN.find(s => s.id === 'broodless') }), h3 = W3.hives[0]; W3.actsLeft = 9; const before = mitesOf(h3); applyAct(W3, h3, 'oa'); const kBrood = 1 - mitesOf(h3) / before;
        const W4 = mkWorld({ ...SCEN.find(s => s.id === 'broodless') }), h4 = W4.hives[0]; W4.actsLeft = 9; applyAct(W4, h4, 'cage'); for (let k = 0; k < 25; k++) { W4.weather = 1; dayTick(W4); }
        const sealed = h4.Mw + h4.Md, b4 = mitesOf(h4); W4.actsLeft = 9; applyAct(W4, h4, 'oa'); const kBroodless = 1 - mitesOf(h4) / b4;
        return { m0, m4, b0, b1, kBrood, kBroodless, sealed, q4: h4.q.st }; });
      ok(r.m4 > r.m0 * 1.3 && r.m4 < r.m0 * 4, `mites in a month with brood: ${r.m0} → ${r.m4}`);
      ok(r.b1 <= r.b0, `broodless mites grew: ${r.b0} → ${r.b1}`);
      ok(r.kBrood < .7, 'oxalic with brood kills ' + r.kBrood); ok(r.kBroodless > .95, 'oxalic broodless kills ' + r.kBroodless);
      ok(r.sealed < 1, 'mites still sealed after 25 caged days: ' + r.sealed); near(r.kBroodless, .97, .02);
    },
    'swarm triggers: a crowded colony swarms in late spring, not in winter, and Demaree stops it': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const base = SCEN.find(s => s.id === 'swarm'), run = (start, fn, wk = 10) => { const W = mkWorld({ ...base, start }); for (let k = 0; k < wk; k++) { if (fn) fn(W); stepWeek(W); } return W.hives[0]; };
        const spring = run(D(1914, 10, 15)), winter = run(D(1914, 6, 1)), dem = run(D(1914, 10, 15), W => { if (!W.week) { W.actsLeft = 2; applyAct(W, W.hives[0], 'demaree'); applyAct(W, W.hives[0], 'super'); } });
        return { spring: spring.swarms, winter: winter.swarms, dem: dem.swarms, springQ: spring.q.st, log: spring.log.map(e => e.txt).join(' | ') }; });
      ok(r.spring >= 1, 'crowded colony in Oct/Nov did not swarm'); eq(r.winter, 0, 'swarmed in winter'); eq(r.dem, 0, 'swarmed after Demaree');
      ok(/queen cups/.test(r.log) && /swarm cells/.test(r.log), 'cups → cells → swarm sequence missing: ' + r.log.slice(0, 200));
    },
    'model never goes negative or NaN over ten years of rough handling': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const W = mkWorld({ ...SCEN.find(s => s.id === 'free'), seed: 'stress' }); let bad = null, k = 0;
        const acts = ['super', 'harvest', 'split', 'oa', 'feed', 'cage', 'requeen', 'destroy', 'drone', 'wash', 'checker', 'demaree'];
        for (let wk = 0; wk < 520 && !bad; wk++) { for (const h of W.hives) { if (!h.alive) continue; try { applyAct(W, h, acts[k++ % acts.length]); } catch (e) {} }
          stepWeek(W);
          for (const h of W.hives) { const vals = [...h.A, ...h.WB, ...h.DB, h.W, h.Mp, h.Mw, h.Md, h.bbH, h.bbN, h.sH, h.sN, h.pollen, h.imp, h.drones];
            if (vals.some(v => !isFinite(v) || v < -1e-6)) bad = `${h.name} wk ${wk}: ` + JSON.stringify({ Mp: h.Mp, bbH: h.bbH, sH: h.sH, sN: h.sN, W: h.W }); } }
        return { bad, alive: W.hives.filter(h => h.alive).length, hives: W.hives.length, weeks: W.week, histMax: Math.max(...W.hives.map(h => h.hist.length)) }; });
      ok(!r.bad, r.bad); ok(r.alive <= 6, 'more live hives than boxes'); ok(r.histMax < 700, 'history grows without bound: ' + r.histMax);
    },
    'actions: two per week, refused on dead hives and when not allowed, splits limited by boxes': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const B = __bee; B.load('swarm'); const a = B.act('super'), b = B.act('super'), c = B.act('super'); B.step(1); const d = B.act('super');
        B.load('queenless'); const e = B.act('oa');
        B.load('capped'); const s1 = B.act('split'), s2 = B.act('split', 1);
        B.load('flow'); B.world().hives[0].alive = false; const f = B.act('super');
        return { a, b, c, d, e, s1, s2, f }; });
      ok(!r.a.startsWith('ERR') && !r.b.startsWith('ERR'), 'first two actions'); ok(r.c.startsWith('ERR'), 'third action in a week: ' + r.c); ok(!r.d.startsWith('ERR'), 'new week');
      ok(r.e.startsWith('ERR'), 'oxalic not allowed in Queenless'); ok(!r.s1.startsWith('ERR'), r.s1); ok(r.s2.startsWith('ERR'), 'third box: ' + r.s2); ok(r.f.startsWith('ERR'), 'dead hive');
    },
    'tutorial: real taps on comb cells identify them; empty cells count as wrong guesses': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __bee.load('first'); __bee.open(0); __bee.frame(4, 0); }); await page.waitForTimeout(900);
      const pts = await page.evaluate(() => { const o = {}; for (const [name, t] of [['egg', 1], ['larva', 2], ['empty', 0]]) { const c = __bee.findCell(t); if (c) o[name] = __bee.cellScreen(c.r, c.c); } return o; });
      ok(pts.egg && pts.larva, 'no egg/larva on the brood frame');
      await page.mouse.click(pts.egg.x, pts.egg.y); await page.mouse.click(pts.larva.x, pts.larva.y);
      const t = await page.evaluate(() => ({ ...__bee.world().tut }));
      ok(t.found.egg, 'egg not found by tapping'); ok(t.found.larva, 'larva not found by tapping');
      if (pts.empty) { await page.mouse.click(pts.empty.x, pts.empty.y); eq(await page.evaluate(() => __bee.world().tut.wrong), t.wrong + 1); }
    },
    'autosave: worst-case two-year apiary stays small and round-trips': async ({ page, ok, near, eq }) => {
      const a = await page.evaluate(() => { for (const s of SCEN) SAVE.done[s.id] = 1; persist(); __bee.load('apiary'); const w = __bee.world(); w.sc = { ...w.sc, fail: () => null };
        for (let wk = 0; wk < 103; wk++) { for (let i = 0; i < w.hives.length; i++) { if (w.hives.length < 8 && w.hives[i].alive) __bee.act('split', i); if (w.hives[i].alive) __bee.act('wash', i); } stepWeek(w); weeklyNote(); }
        autosave(); const s = localStorage.getItem('rh:swarm-run'); return { kb: s.length / 1024, sum: __bee.hives().map(h => [h.adults, h.mites, h.honeyKg, h.alive]), week: w.week }; });
      ok(a.kb < 64, 'save is ' + a.kb.toFixed(1) + ' KB');
      const p = await reopen(page); const b = await p.evaluate(() => ({ sum: __bee.hives().map(h => [h.adults, h.mites, h.honeyKg, h.alive]), week: __bee.world().week }));
      eq(b.week, a.week); a.sum.forEach((h, i) => { near(b.sum[i][0], h[0], Math.max(2, h[0] * 1e-3)); near(b.sum[i][2], h[2], .02); eq(b.sum[i][3], h[3]); });
      // the resumed world keeps running
      await p.evaluate(() => __bee.step(2)); ok(!p.errs.length, p.errs[0]); await p.close();
    },
    'corrupted saves and runs never crash, and a locked scenario is never resumed': async ({ page, ok }) => {
      const cases = [['swarm', 'null'], ['swarm', '4'], ['swarm', '{"done":null,"cur":"x"}'], ['swarm-run', '{"v":2,"sc":"swarm","w":{"hives":"x"}}'], ['swarm-run', '{"v":2,"sc":"apiary","w":{"hives":[{"coh":"!!"}]}}'], ['swarm-run', '{"v":2,"sc":"nope"}'], ['swarm-run', '[1']];
      for (const [k, v] of cases) {
        await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem('rh:' + k, v); }, [k, v]);
        const p = await reopen(page); await p.waitForTimeout(300);
        const r = await p.evaluate(() => ({ sc: __bee.world().sc.id, n: __bee.world().hives.length }));
        ok(!p.errs.length, `${k}=${v}: ${p.errs[0]}`); ok(r.sc === 'first' && r.n === 1, `${k}=${v}: resumed into ${r.sc}`); await p.close();
      }
    },
    'progress: wins unlock in order, the fraction never exceeds 1': async ({ page, ok, eq }) => {
      const r = await page.evaluate(`(() => { ${PLAY}; const hub = () => JSON.parse(localStorage.getItem('rh:hub') || '{}').swarm || 0;
        const u0 = unlockedUpTo(); play('first'); const u1 = unlockedUpTo(), h1 = hub(); __bee.load('first'); __bee.step(3); const h2 = hub();
        for (const s of SCEN) if (!s.free) SAVE.done[s.id] = 3; persist(); return { u0, u1, h1, h2, h3: hub(), all: unlockedUpTo() }; })()`);
      eq(r.u0, 0); eq(r.u1, 1); ok(r.h1 > 0); eq(r.h2, r.h1, 'losing a replay lowered progress'); eq(r.h3, 1); eq(r.all, 12);
    },
    'fast-forward: every multi-week scenario can run on until something happens, and it stops at the first warning': async ({ page, ok }) => {
      await page.evaluate(() => __bee.load('spring')); await page.waitForTimeout(200);
      ok(await page.$('#tUntil'), 'no Until button in Spring Build-up');
      await page.click('#tUntil'); await page.waitForFunction(() => !__bee.ff(), null, { timeout: 30000 });
      const r = await page.evaluate(() => ({ wk: __bee.world().week, res: __bee.result(), cong: __bee.state(0).congestion }));
      ok(!r.res, 'ran to the end of the scenario without stopping'); ok(r.wk < 13 && r.cong > .6, `stopped at week ${r.wk}, congestion ${r.cong}`);
    },
    'layouts: no horizontal scroll, buttons on screen, no console errors at phone and desktop sizes': async ({ page, ok }) => {
      for (const [w, h] of [[390, 844], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: h });
        for (const id of ['winter', 'apiary', 'free']) { await page.evaluate(id => { for (const s of SCEN) SAVE.done[s.id] = 1; __bee.load(id); }, id); await page.waitForTimeout(200);
          const ap = await page.evaluate(() => [...document.querySelectorAll('#tray button')].filter(b => b.getBoundingClientRect().right > innerWidth + 1).map(b => b.textContent.trim()));
          ok(!ap.length, `${id}: apiary buttons off-screen at ${w}: ${ap}`); }
        await page.evaluate(() => __bee.load('swarm'));
        await page.evaluate(() => __bee.open(0)); await page.waitForTimeout(500);
        const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, off: [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1); }).map(b => b.textContent.trim()).slice(0, 5) }));
        ok(r.sw <= w, 'horizontal scroll at ' + w); ok(!r.off.length, `off-screen buttons at ${w}: ${r.off}`);
      }
    },
  },
};
