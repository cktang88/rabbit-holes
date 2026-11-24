// Reduction Woodcut: level solvability, traps, colour compositing, carving budget, saves and UI guards.
const ready = async page => { await page.waitForFunction(() => window.__wc && __wc.L); };
// the runner clears localStorage on every navigation of `page`, so reload-style checks open a second tab in the same context
async function reopen(page) { const p = await page.context().newPage(), errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(page.url()); await ready(p); p.errs = errs; return p; }
const SOLVE = `(i => { const w = __wc, n = w.LV[i].need; w.load(i); for (let k = 0; k < n; k++) { w.carveState(k); w.pull(k); } return w.result; })`;

module.exports = {
  page: 'woodcut/index.html',
  ready,
  tests: {
    'every level: blank sheet scores 0, solvable at par with 3 stars, palette has the right size': async ({ page, ok, eq }) => {
      const r = await page.evaluate(`(() => { const out = []; for (let i = 0; i < __wc.NLV; i++) { const b = __wc.blank(i); const s = (${SOLVE})(i); out.push({ i, b, lk: s.lk, st: s.stars, p: s.passes, par: s.par, str: s.strokes, ps: s.parStrokes, show: __wc.L.show.length, n: __wc.LV[i].inks.length }); } return out; })()`);
      eq(r.length, 20);
      for (const x of r) {
        ok(x.b < .01, `level ${x.i} not blank at start: ${x.b}`);
        ok(x.lk > .99, `level ${x.i} reference solution only ${x.lk}`);
        eq(x.st, 3, `level ${x.i} stars`); eq(x.p, x.par, `level ${x.i} passes`); ok(x.str <= x.ps, `level ${x.i} strokes ${x.str} > par ${x.ps}`);
        eq(x.show, x.n, `level ${x.i} palette`);
      }
    },
    'traps: reversed ink order, printing without carving, and carving too early all fail': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const w = __wc, out = [];
        for (let i = 0; i < w.NLV; i++) { const n = w.LV[i].need;
          w.load(i); for (let k = 0; k < n; k++) { w.carveState(k); w.pull(n - 1 - k); } const rev = w.result.lk;
          w.load(i); w.carveState(0); for (let k = 0; k < n; k++) w.pull(k); const lazy = w.result.lk;
          out.push({ i, rev, lazy, same: w.LV[i].inks.slice(0, n).every(x => x.hex === w.LV[i].inks[0].hex) }); }
        // Red Barn: carving the barn before red is printed means red never lands on it
        w.load(3); w.carveState(0); w.pull(0); w.carveState(1); w.carveState(2); w.pull(1); w.pull(2); const barn = w.result.lk, barnHints = w.result.hints;
        // Cherries: printing red before carving the paper areas
        w.load(0); w.pull(0); w.carveState(0); w.carveState(1); w.pull(1); const cher = w.result.lk;
        return { out, barn, cher, barnHints }; });
      for (const x of r.out) { if (!x.same) ok(x.rev < .85, `level ${x.i}: reversed order passes (${x.rev})`); ok(x.lazy < .85, `level ${x.i}: carve-nothing passes (${x.lazy})`); }
      ok(r.barn < .85, 'barn trap passes ' + r.barn);
      // the result card explains the miss instead of leaving it to trial and error
      ok(r.barnHints.length && /Barn red/.test(r.barnHints[0]) && /carved too early/.test(r.barnHints[0]), 'barn hint: ' + r.barnHints); ok(r.cher < .85, 'cherries out of order passes ' + r.cher);
    },
    'detail matters: skipping small shapes (Moon over Sea stars) fails even above 85% likeness': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const w = __wc, out = [];
        for (const i of [1, 11, 13, 16, 17, 19]) { const n = w.LV[i].need; w.load(i); for (let k = 1; k < n; k++) { w.pull(k - 1); w.carveState(k); } w.pull(n - 1); out.push({ i, lk: w.result.lk, pass: w.result.pass, miss: w.result.miss, next: !!document.querySelector('#toast [data-a="next"]') }); }
        // Moon over Sea, everything right except the seven stars and the horizon line
        w.load(1); const stars = w.T.regions.filter(r => r.s === 0 && r.n < 400).length; return { out, stars }; });
      ok(r.stars >= 7, 'stars are regions: ' + r.stars);
      for (const x of r.out) { eq(x.pass, false, `level ${x.i} passes with paper details skipped (lk ${x.lk.toFixed(2)})`); ok(x.miss >= 1); eq(x.next, false, 'next-print button offered'); }
      ok(r.out[0].lk >= .85, 'Moon over Sea skipped stars still scores ' + r.out[0].lk);
    },
    'difficulty: naive play fails on the last third, the competent plan wins, and the textbook rule is not enough everywhere': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const w = __wc, st = r => r.pass ? r.stars : 0;
        const runOrder = (i, order) => { w.load(i); for (const k of order) { if (w.finished) break; w.greedyCarve(); w.pull(k); } if (!w.finished) w.finish(); return w.result; };
        const late = [13, 14, 15, 16, 17, 18, 19], out = { naive: 0, naiveRuns: 0, competent: [], simple3: 0, spares: late.filter(i => w.LV[i].inks.length > w.LV[i].need).length };
        for (const i of late) { const L = w.LV[i], n = L.inks.length;
          // naive bots: (1) idle/lazy: print every ink in palette order without carving, (2) the obvious light-to-dark rule with every tin on the bench, (3) random orders
          w.load(i); for (let k = 0; k < n && !w.finished; k++) w.pull(L.inks.length - 1 - k > -1 ? k : k); const lazy = w.result || w.finish();
          const light = runOrder(i, w.lightOrder()); const rnd = RH.rng(i * 7 + 1), rand = [];
          for (let t = 0; t < 3; t++) { const o = [...Array(n).keys()]; rnd.shuffle(o); rand.push(runOrder(i, o)); }
          for (const x of [lazy, light, ...rand]) { out.naiveRuns++; if (st(x) <= 1) out.naive++; }
          out.competent.push(st(runOrder(i, [...Array(L.need).keys()])));
          if (st(runOrder(i, w.lightOrder().filter(k => k < L.need))) === 3) out.simple3++; }
        return out; });
      ok(r.naive / r.naiveRuns >= .8, `naive bots got 2★+ in ${r.naiveRuns - r.naive}/${r.naiveRuns} late runs`);
      ok(r.competent.every(s => s === 3), 'competent plan: ' + r.competent);
      ok(r.simple3 <= 4, `light-to-dark (minus spares) still 3★ on ${r.simple3}/7 late prints`);
      ok(r.spares === 7, 'every late commission has a spare tin');
    },
    'colour compositing: transparent multiplies, dark opaque covers, light opaque ghosts, dense covers, fountain blends': async ({ page, ok, near }) => {
      const r = await page.evaluate(() => { const w = __wc, base = w.lin('#203040'), light = w.lin('#f0e8d0');
        const t = w.I('t', '#80c0ff', 't'), dark = w.I('d', '#202020'), lite = w.I('l', '#f8f0e0'), dense = Object.assign(w.I('g', '#f0b545'), { dense: 1 }), ft = w.I('f', '#ff0000', 'o', '#0000ff');
        return { mul: w.over(base.slice(), t, 10, []), base, tc: t.c, darkOnLight: w.over(light.slice(), dark, 10, []), darkC: dark.c, liteOnDark: w.over(base.slice(), lite, 10, []), liteC: lite.c,
          denseOnDark: w.over(base.slice(), dense, 10, []), denseC: dense.c, c0: w.cover(.01, .9, false), c1: w.cover(.9, .01, false), cd: w.cover(.01, .9, true),
          f0: w.over(light.slice(), ft, 0, []), f1: w.over(light.slice(), ft, 319, []), fmid: w.over(light.slice(), ft, 160, []), ftC: ft.c, ftC2: ft.c2,
          mono: Array.from({ length: 33 }, (_, k) => w.ftT(k * 10)).every((v, k, a) => !k || v >= a[k - 1]) }; });
      for (let k = 0; k < 3; k++) {
        near(r.mul[k], r.base[k] * r.tc[k], 1e-6, 'multiply');
        near(r.darkOnLight[k], r.darkC[k], 1e-6, 'dark over light covers');
        near(r.denseOnDark[k], r.denseC[k], 1e-6, 'dense covers');
        near(r.f0[k], r.ftC[k], 1e-6, 'fountain left'); near(r.f1[k], r.ftC2[k], 1e-6, 'fountain right');
      }
      ok(Math.abs(r.liteOnDark[1] - r.liteC[1]) > .1, 'light over dark must ghost');
      ok(r.c0 < 1 && r.c0 > 0, 'cover light-on-dark ' + r.c0); near(r.c1, 1, 0, 'cover dark-on-light'); near(r.cd, 1, 0, 'dense cover');
      ok(r.fmid[0] > .05 && r.fmid[2] > .05, 'fountain middle is a blend'); ok(r.mono, 'fountain ramp monotonic');
    },
    'late blocks come untraced (no pencil lines, no region highlight); clean cuts are unlimited and undo works': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const w = __wc; w.load(4); const early = { u: !!w.L.untraced, inf: w.rLeft() }; w.load(12); const late = { u: !!w.L.untraced, inf: w.rLeft() };
        const reg = w.T.regions.find(x => x.s === 0 && x.n > 100), i0 = reg.px[reg.px.length >> 1]; const n = w.carveRegion(i0 % 320, i0 / 320 | 0), s0 = w.strokes; w.undo();
        return { early, late, n, s0, s1: w.strokes }; });
      eq(r.early, { u: false, inf: Infinity }); eq(r.late, { u: true, inf: Infinity }); ok(r.n > 0); eq(r.s1, r.s0 - 1);
    },
    'inks are single-use, pulling ends undo, signing with no passes does nothing': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const w = __wc; w.load(2); const f0 = w.finish(); w.carveState(0); const u0 = w.undoN; const p1 = w.pull(0); const u1 = w.undoN; const p2 = w.pull(0); return { f0, u0, p1, u1, p2, passes: w.passes }; });
      eq(r.f0, null); ok(r.u0 > 0); ok(r.p1); eq(r.u1, 0, 'undo stack cleared by a pull'); eq(r.p2, false, 'same ink twice'); eq(r.passes, [0]);
    },
    'pulling needs a deliberate confirm: one click arms, second click pulls': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __wc.load(0); __wc.carveState(0); });
      await page.click('#inks [data-k="0"]');
      await page.click('#pullB'); eq(await page.evaluate(() => __wc.passes.length), 0, 'first click must not pull');
      ok(await page.$eval('#pullB', b => b.classList.contains('confirm')), 'pull button armed');
      await page.click('#pullB'); eq(await page.evaluate(() => __wc.passes.length), 1);
      // selecting a different ink disarms
      await page.waitForFunction(() => !__wc.anim, null, { timeout: 6000 });
      await page.click('#inks [data-k="1"]'); await page.click('#pullB'); await page.click('#inks [data-k="1"]'); await page.click('#inks [data-k="1"]'); await page.click('#pullB');
      eq(await page.evaluate(() => __wc.passes.length), 1, 'reselecting disarms the confirm');
    },
    'regression: Sign pressed during the last pull animation signs one edition, not two': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const w = __wc; w.load(0); w.carveState(0); w.pull(0); w.carveState(1); const ed0 = w.SAVE.ed, g0 = w.GAL.length;
        w.pull(1, true); const animating = !!w.anim; w.finish(); return { animating, ed: w.SAVE.ed - ed0, gal: w.GAL.length - g0, fin: w.finished, lk: w.result.lk }; });
      eq(r.animating, true); eq(r.ed, 1, 'edition counter'); eq(r.gal, 1, 'gallery entries'); eq(r.fin, true);
    },
    'carved block autosaves and survives a reload; switching level right after a stroke keeps it': async ({ page, eq, near }) => {
      const a = await page.evaluate(() => { const w = __wc; w.load(0); w.carveState(0); w.pull(0); w.gouge([[10, 10], [60, 60]], 'u'); w.wipSave(); return { p: w.passes, s: w.strokes, lk: w.score() }; });
      const p2 = await reopen(page); await p2.waitForTimeout(300);
      const b = await p2.evaluate(() => ({ p: __wc.passes, s: __wc.strokes, lk: __wc.score(), li: __wc.SAVE.cur }));
      eq(b.p, a.p); eq(b.s, a.s); near(b.lk, a.lk, 1e-6); eq(p2.errs, []); await p2.close();
      // a stroke made within the 400 ms autosave debounce, then an immediate level switch via the real <select>
      await page.evaluate(() => { __wc.SAVE.best[0] = { lk: .9, st: 1 }; __wc.gouge([[200, 200], [240, 240]], 'u'); });
      const s1 = await page.evaluate(() => __wc.strokes);
      await page.evaluate(() => { const s = document.getElementById('lvSel'); s.innerHTML += ''; [...s.options].forEach(o => o.disabled = false); s.value = '1'; s.dispatchEvent(new Event('change')); });
      await page.waitForTimeout(500);
      eq(await page.evaluate(() => __wc.SAVE.wips[0].s), s1, 'stroke made just before switching was lost');
    },
    'corrupted or odd saves never crash the page': async ({ page, ok }) => {
      for (const [k, v] of [['woodcut', 'null'], ['woodcut', '7'], ['woodcut', '"x"'], ['woodcut', '[1,2]'], ['woodcut', '{"best":{"0":null,"1":5},"wips":"x","cur":99,"ed":"q"}'], ['woodcut', '{"wips":{"0":{"p":[0],"c":"garbage"}}}'], ['woodcut-gal', '{"a":1}'], ['woodcut', '{not json']]) {
        await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem('rh:' + k, v); }, [k, v]);
        const p = await reopen(page);
        const st = await p.evaluate(() => ({ li: __wc.L && __wc.LV.indexOf(__wc.L), gal: document.getElementById('gal').textContent }));
        ok(st.li >= 0 && st.li < 21, `bad level after save ${v}`); ok(/Gallery \(\d+\)/.test(st.gal), st.gal);
        await p.click('#gal'); await p.waitForTimeout(100);
        ok(!p.errs.length, `save ${v}: ${p.errs[0]}`); await p.close();
      }
    },
    'progress: failing does not unlock, passing unlocks the next, fraction stays in [0,1]': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const w = __wc, hub = () => JSON.parse(localStorage.getItem('rh:hub') || '{}').woodcut || 0, dis = i => document.querySelector(`#lvSel option[value="${i}"]`).disabled;
        w.load(0); const lock1 = dis(1); w.carveState(0); w.pull(0); w.pull(1); const failLk = w.result.lk, lockAfterFail = dis(1), h0 = hub();
        w.solve(0); const lockAfterWin = dis(1), h1 = hub(); w.solve(0); const h2 = hub();
        for (let i = 0; i < w.NLV; i++) w.solve(i); const h3 = hub(); return { lock1, failLk, lockAfterFail, h0, lockAfterWin, h1, h2, h3, studioOpen: !dis(20) }; });
      ok(r.lock1, 'level 2 locked at first'); ok(r.failLk < .85); ok(r.lockAfterFail, 'fail unlocked'); eq(r.h0, 0); ok(!r.lockAfterWin);
      ok(r.h1 > 0 && r.h2 === r.h1, 'replay must not change progress'); eq(r.h3, 1); ok(r.studioOpen);
    },
    'studio prompts are solvable in their own order and RLE round-trips': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const w = __wc, out = [];
        for (const seed of [1, 7, 42, 999, 31337]) { const pr = w.makePrompt(seed); w.load(20, { prompt: pr }); for (let k = 0; k < pr.order.length; k++) { w.carveState(k); w.pull(pr.order[k]); } out.push(w.score()); }
        const a = new Uint8Array(320 * 320); for (let i = 0; i < a.length; i++) a[i] = (i * 7919 >> 9) % 3 === 0 ? 255 : i % 5; const d = w.rleDec(w.rleEnc(a));
        return { out, rt: d.every((v, i) => v === a[i]) }; });
      for (const s of r.out) ok(s > .99, 'prompt solution ' + s); eq(r.rt, true);
    },
    'phone layout: block, print and target on screen, tray clear of the HUD': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
      const r = await page.evaluate(() => { const b = __wc.boxes, hud = document.getElementById('hud').getBoundingClientRect(), tray = document.getElementById('tray').getBoundingClientRect(); const d = b.dpr;
        return { B: { x: b.B.x / d, y: b.B.y / d, s: b.B.s / d }, P: { x: b.PR.x / d, y: b.PR.y / d, s: b.PR.s / d }, hb: hud.bottom, tt: tray.top, tw: tray.right }; });
      ok(r.B.x >= 0 && r.B.x + r.B.s <= 390 && r.B.y >= r.hb - 1 && r.B.y + r.B.s <= r.tt + 1, 'block fits ' + JSON.stringify(r));
      ok(r.P.x + r.P.s <= 390 && r.P.y >= r.hb - 1, 'print fits'); ok(r.tt > r.hb, 'tray overlaps hud'); ok(r.tw <= 390, 'tray off-screen');
    },
  },
};
