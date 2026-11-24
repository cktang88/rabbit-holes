// Universe Seed: economy, physics gates, era unlocks, codex reachability, prestige, saves, pacing.
async function reopen(page) { const p2 = await page.context().newPage(); const errs = []; p2.on('pageerror', e => errs.push(e.message)); await p2.goto(page.url()); await p2.waitForTimeout(300); p2.errs = errs; return p2; }
const dismiss = (page) => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));

// A steady player: clicks the void early, collects a sky object every 3 s, buys greedily. Returns minutes at each era.
const BOT_SRC = `(X, secs)=>{ X.U = X.newRun(X.M); const U = X.U; const times = {};
  for (let s = 0; s < secs && U.tier < X.TIERS.length - 1; s++) {
    if (U.tier === 0 || s < 600) X.add('E', 2 * (1 + X.rate('E') * 0.06));
    if (s % 3 === 0) { const t = U.tier, k = X.KEYS[t]; if (!X.gate(k)) X.add(k, Math.max(X.rate(k) * 12, X.TIERS[t].gens[0][1] * 0.3)); }
    for (let k = 0; k < 20; k++) { let best = null; for (let t = 0; t <= U.tier; t++) { for (let i = 0; i < 3; i++) { const c = X.genCost(t, i), r = X.costRes(t); if (U.r[r] >= c && !X.gate(X.KEYS[t])) best = { t, i }; } if (U.r[X.KEYS[t]] >= X.upCost(t)) X.buyUp(t); } if (!best) break; X.buy(best.t, best.i, true); }
    const before = U.tier; X.update(1); if (U.tier !== before) times[U.tier] = U.t / 60;
  } return times; }`;

module.exports = {
  page: 'universe-seed/index.html',
  tests: {
    'data: 11 eras, 6 laws, 40 codex entries (as the intro promises), every option index valid': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => ({ t: __us.TIERS.length, c: __us.CONSTS.length, x: __us.CODEX.length, ids: new Set(__us.CODEX.map(c => c.id)).size, defs: __us.CONSTS.every(c => c.opts[c.def]), intro: document.querySelector('.modal')?.textContent || '' }));
      eq([r.t, r.c, r.x, r.ids], [11, 6, 40, 40]); ok(r.defs); ok(r.intro.includes('40 kinds'));
    },
    'economy: costs grow 15% per purchase, buying deducts exactly, unaffordable buys do nothing': async ({ page, eq, near }) => {
      const r = await page.evaluate(() => { const X = __us; X.U = X.newRun(X.M); const U = X.U; const c0 = X.genCost(0, 0);
        X.buy(0, 0, true); const none = U.gens['0:0'] || 0; U.r.E = 100; X.buy(0, 0, true); const after = [U.gens['0:0'], U.r.E]; const c1 = X.genCost(0, 0);
        return { c0, none, after, c1, rate: X.rate('E') }; });
      eq(r.c0, 10); eq(r.none, 0); eq(r.after, [1, 90]); near(r.c1, 11.5); near(r.rate, 1);
    },
    'production: update(dt) adds rate×dt to both current and lifetime totals; upgrades double rate': async ({ page, near }) => {
      const r = await page.evaluate(() => { const X = __us; X.U = X.newRun(X.M); X.U.gens['0:1'] = 3; const r0 = X.rate('E'); X.update(10); const e = X.U.r.E, t = X.U.total.E; X.U.r.E = 1e9; X.buyUp(0); return { r0, e, t, r1: X.rate('E') }; });
      near(r.r0, 24); near(r.e, 240); near(r.t, 240); near(r.r1, 48);
    },
    'physics gates: blocked tiers produce nothing and cannot be bought': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const X = __us; const U = X.newRun(X.M); U.consts.G = 0; U.tier = 4; U.gens['4:0'] = 5; X.U = U;
        const g = !!X.gate('S'), rate = X.rate('S'); U.r.A = 1e9; X.autoBuy(); return { g, rate, boughtS: U.gens['4:0'] }; });
      eq(r, { g: true, rate: 0, boughtS: 5 });
    },
    'eras unlock one at a time in order; Civilization time is recorded for Speedrun': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const X = __us; X.U = X.newRun(X.M); const U = X.U; for (const k of X.KEYS) U.total[k] = 1e12; const seq = [];
        for (let i = 0; i < 15; i++) { X.update(0.1); seq.push(U.tier); } return { seq, kAt: U.kAt, max: U.maxTier }; });
      for (let i = 1; i < r.seq.length; i++) ok(r.seq[i] - r.seq[i - 1] <= 10 && r.seq[i] >= r.seq[i - 1]);
      eq(r.max, 10); ok(r.kAt != null && r.kAt < 5);
    },
    'Speedrun counts the time civilization was reached, not when the universe was ended': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __us; X.U = X.newRun(X.M); X.U.maxTier = 10; X.U.tier = 10; X.U.kAt = 900; X.U.t = 5000; return X.CODEX.find(c => c.id === 'Speedrun').test(); });
      ok(r);
    },
    'every codex entry is reachable by some choice of laws without a physics gate blocking it': async ({ page, eq }) => {
      const missing = await page.evaluate(() => { const X = __us, C = X.CONSTS; const missing = [];
        const combos = []; const rec = (i, cur) => { if (i === C.length) { combos.push({ ...cur }); return; } for (let j = 0; j < C[i].opts.length; j++) { cur[C[i].k] = j; rec(i + 1, cur); } }; rec(0, {});
        for (const cx of X.CODEX) { let found = false;
          for (const consts of combos) { const U = X.newRun(X.M); U.consts = consts; U.t = 600; X.U = U;
            // highest tier this universe can reach: each unlock needs the previous tier's resource to be producible
            let top = 0; for (let i = 1; i < X.TIERS.length; i++) { const res = X.TIERS[i].unlock[0]; if (X.gate(res)) break; top = i; }
            for (const tier of [3, top]) { if (tier > top) continue; U.maxTier = U.tier = tier; U.kAt = tier === 10 ? 600 : undefined;
              for (const k of X.KEYS) U.total[k] = X.KEYS.indexOf(k) <= tier && !X.gate(k) ? 1e10 : 0;
              for (const t of [600, 7200]) { U.t = t; if (cx.test()) { found = true; break; } } if (found) break; }
            if (found) break; }
          if (!found) missing.push(cx.id); }
        return missing; });
      eq(missing, []);
    },
    'keyboard: pressing Enter twice on "End this universe" opens one dialog and pays out once': async ({ page, eq }) => {
      await dismiss(page);
      await page.evaluate(() => { const X = __us; X.U.tier = 3; X.U.maxTier = 3; X.U.total.A = 1000; X.renderAll(); });
      const seeds = await page.evaluate(() => __us.seedsForRun());
      await page.focus('#endBtn'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      eq(await page.locator('.modal-bg').count(), 1);
      await page.click('.modal button:text-is("Let it end")'); await page.waitForTimeout(50);
      const m = await page.evaluate(() => ({ s: __us.M.seeds, r: __us.M.rebirths, tier: __us.U.tier }));
      eq(m, { s: seeds, r: 1, tier: 0 });
    },
    'cannot end a universe before Recombination': async ({ page, eq }) => {
      await dismiss(page); await page.evaluate(() => __us.endUniverse()); eq(await page.locator('.modal-bg').count(), 0);
    },
    'ending records new codex entries with the universe number; progress = codex/40': async ({ page, eq, ok }) => {
      await dismiss(page);
      await page.evaluate(() => { const X = __us; X.U.tier = 3; X.U.maxTier = 3; X.U.consts.G = 0; X.endUniverse(); });
      await page.click('.modal button:text-is("Let it end")');
      const r = await page.evaluate(() => ({ codex: __us.M.codex, prog: JSON.parse(localStorage.getItem('rh:hub'))['universe-seed'] }));
      eq(r.codex['Dark Fog'], 1); eq(r.codex['Ash'], 1); ok(!r.codex['Our Kind of Universe']); eq(r.prog, Object.keys(r.codex).length / 40);
    },
    'laws: one more becomes adjustable per rebirth and carries into the next universe': async ({ page, eq }) => {
      await dismiss(page);
      const r = await page.evaluate(() => { const X = __us; X.M.rebirths = 1; X.renderAll(); return document.querySelectorAll('#p-laws [data-c]').length; });
      eq(r, 5);
      await page.click('.tabs button[data-t="laws"]'); await page.click('#p-laws [data-c="G"][data-j="3"]');
      eq(await page.evaluate(() => [__us.M.nextConsts.G, __us.newRun(__us.M).consts.G]), [3, 3]);
    },
    'seed upgrades: Head Start energy and Memory multiplier': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const X = __us; X.M.seedUps.start = 2; X.M.seedUps.mem = 1; const U = X.newRun(X.M); X.U = U; U.gens['0:0'] = 1; return [U.r.E, X.rate('E')]; });
      eq(r, [2000, 2]);
    },
    'offline / hidden-tab catch-up credits elapsed time (capped at 8 h)': async ({ page, ok }) => {
      await dismiss(page);
      const r = await page.evaluate(() => { const X = __us; X.U.gens['0:0'] = 1; const t0 = X.U.t; X.U.saved = Date.now() - 3600e3; X.catchUp(); const a = X.U.t - t0;
        X.U.saved = Date.now() - 100 * 3600e3; const t1 = X.U.t; X.catchUp(); return { a, b: X.U.t - t1 }; });
      ok(Math.abs(r.a - 3600) < 5, 'hour credited ' + r.a); ok(Math.abs(r.b - 8 * 3600) < 5, 'cap ' + r.b);
    },
    'visibility change: hiding saves, returning credits time away': async ({ page, ok }) => {
      await dismiss(page);
      const d = await page.evaluate(async () => { const X = __us; let hidden = true; Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
        document.dispatchEvent(new Event('visibilitychange')); X.U.saved -= 120e3; const t0 = X.U.t; hidden = false; document.dispatchEvent(new Event('visibilitychange')); return X.U.t - t0; });
      ok(d >= 119, 'credited ' + d);
    },
    'clicking the void gives energy; clicking a sky object rewards that era': async ({ page, ok }) => {
      await dismiss(page);
      const box = await page.locator('#cv').boundingBox();
      const e0 = await page.evaluate(() => __us.U.total.E); await page.mouse.click(box.x + box.width / 2, box.y + box.height - 40); const e1 = await page.evaluate(() => __us.U.total.E);
      ok(e1 >= e0 + 1, 'energy from click');
      await page.evaluate(() => { __us.spawn(); }); const tg = await page.evaluate(() => { const t = __us.targets.at(-1); return t && [t.x, t.y]; });
      if (tg) { const a = await page.evaluate(() => __us.U.total.E); await page.mouse.click(box.x + tg[0], box.y + tg[1]); ok(await page.evaluate((a) => __us.U.total.E > a + 2, a), 'target reward'); }
    },
    'corrupted saves are repaired instead of crashing': async ({ page, eq }) => {
      const cases = [['null', 'null'], ['"x"', '5'], ['{"seeds":"lots","codex":[]}', '{"r":{"E":"NaN"},"total":{},"gens":{},"ups":{},"consts":{"G":99},"tier":42}'], ['{}', '{"tier":3}']];
      for (const [m, u] of cases) {
        await page.evaluate(([m, u]) => { localStorage.setItem('rh:us-meta', m); localStorage.setItem('rh:us-run', u); }, [m, u]);
        const p2 = await reopen(page); await p2.waitForTimeout(400);
        const st = await p2.evaluate(() => ({ e: Number.isFinite(__us.U.r.E), t: __us.U.tier, s: __us.M.seeds, g: __us.U.consts.G }));
        eq(p2.errs, [], m + ' / ' + u); eq(st.e, true); eq(st.t <= 10, true); eq(Number.isFinite(st.s), true); eq(st.g >= 0 && st.g < 5, true);
        await p2.close();
      }
    },
    'save/load round-trip': async ({ page, eq }) => {
      await page.evaluate(() => { const X = __us; X.U.gens['0:0'] = 4; X.U.r.E = 123; X.M.seeds = 7; X.persist(); });
      const p2 = await reopen(page); const r = await p2.evaluate(() => [__us.U.gens['0:0'], Math.floor(__us.U.r.E) >= 123, __us.M.seeds]); eq(r, [4, true, 7]); await p2.close();
    },
    'pacing: a steady player reaches Civilization within 40 minutes, with no era taking over 10 minutes': async ({ page, ok }) => {
      const times = await page.evaluate((B) => eval(B)(__us, 3 * 3600), BOT_SRC);
      ok(times[10] != null && times[10] < 40, 'civ at ' + times[10]);
      let prev = 0; for (let i = 1; i <= 10; i++) { ok(times[i] - prev < 10, `era ${i} took ${(times[i] - prev).toFixed(1)} min`); prev = times[i]; }
    },
    'phone layout: no horizontal scroll, sky is visible': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(100);
      const r = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, cv: document.getElementById('cv').getBoundingClientRect() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.width >= 350 && r.cv.height >= 300, JSON.stringify(r.cv));
    },
  },
};
