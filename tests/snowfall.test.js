// Snowfall: the Nakaya morphology map, growth records the fall in order, every case is solvable by its own sounding and not
// at the start, the balloon budget and stars, saves, and the difficulty rule (guessing soundings fails; reading the flake works).
const close = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const L = (T, s, d = 2) => ({ T, s, d });

module.exports = {
  page: 'snowfall/index.html',
  ready: async page => { await page.waitForFunction(() => window.__snow); await close(page); },
  tests: {
    'habit(): the real temperature sequence (plates, columns and needles, plates, stars, columns) and humidity branching': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const h = __snow.habit; return [h(-2, .2), h(-2, .9), h(-6, .2), h(-5.5, .9), h(-8.5, .9), h(-14, .2), h(-14, .5), h(-15, .9), h(-20, .9), h(-24, .2)]; });
      eq(r, ['plate', 'sector', 'column', 'needle', 'hollow', 'plate', 'sector', 'dendrite', 'stellar', 'column']);
    },
    'grow(): the centre is the oldest part; plates after a column become caps; durations and humidity set proportions': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const g = __snow.grow, a = g([{ T: -6, s: .2, d: 2 }, { T: -14, s: .5, d: 2 }]), b = g([{ T: -14, s: .5, d: 2 }, { T: -6, s: .2, d: 2 }]);
        const slow = g([{ T: -15, s: .9, d: 1 }]), fast = g([{ T: -15, s: .9, d: 3 }]), dry = g([{ T: -14, s: .2, d: 2 }]), wet = g([{ T: -14, s: .3, d: 2 }]);
        return { aCaps: a.caps, bCaps: b.caps, aKinds: [a.ax[0].kind, a.rad[0].kind], ratio: (fast.a - .25) / (slow.a - .25), wetter: wet.a > dry.a, sameAB: __snow.similarity(a, b) }; });
      eq([r.aCaps, r.bCaps], [true, false]); eq(r.aKinds, ['column', 'sector']); ok(Math.abs(r.ratio - 3) < 1e-9, 'growth proportional to time'); ok(r.wetter);
      ok(r.sameAB < .9, 'the same two layers in the opposite order must not count as a match: ' + r.sameAB);
    },
    'every case: its own sounding matches, the starting sounding does not, and different cases do not match each other': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const S = __snow, out = [];
        S.CASES.forEach((c, i) => { if (c.chamber) return;
          if (S.scoreSounding(c, c.target[0]).score < .999) out.push(i + ' own sounding');
          if (S.scoreSounding(c, [{ T: -10, s: .5, d: 2 }]).score >= S.MATCH) out.push(i + ' default matches');
          S.CASES.forEach((d, j) => { if (j !== i && !d.chamber && S.scoreSounding(c, d.target[0]).score >= S.MATCH) out.push(i + ' matched by case ' + j); }); });
        return out; });
      ok(!bad.length, bad.join('; '));
    },
    'the cold chamber teaches the diagram: kinds you grow are labelled, four open the case files': async ({ page, ok, eq }) => {
      ok(await page.evaluate(() => !__snow.isOpen(1)), 'case 1 open before the chamber');
      for (const [T, s] of [[-2, .2], [-5.5, .9], [-15, .9]]) { await page.evaluate(([T, s]) => { __snow.sounding = [{ T, s, d: 2 }]; __snow.launch(); }, [T, s]); }
      ok(await page.evaluate(() => !__snow.isOpen(1)), 'opened after three kinds');
      await page.evaluate(() => { __snow.sounding = [{ T: -7, s: .2, d: 2 }]; __snow.launch(); });
      eq(await page.evaluate(() => Object.keys(__snow.SAVE.seen).sort()), ['column', 'dendrite', 'needle', 'plate']);
      ok(await page.evaluate(() => __snow.isOpen(1)), 'four kinds did not open the cases');
    },
    'balloons: each regrowth costs one; stars by balloons; running out resets the case': async ({ page, eq, ok }) => {
      await page.evaluate(() => { const S = __snow; S.SAVE.done[0] = 1; S.startCase(4); });
      for (let k = 0; k < 2; k++) await page.evaluate(() => { __snow.sounding = [{ T: -2, s: .2, d: 1 }]; __snow.launch(); });
      eq(await page.evaluate(() => __snow.used), 2);
      await page.evaluate(() => { __snow.sounding = __snow.CASES[4].target[0].map(l => ({ ...l })); __snow.launch(); });
      await page.waitForTimeout(1200); eq(await page.evaluate(() => __snow.SAVE.done[4]), 2, 'three balloons should earn two stars');
      ok((await page.textContent('.modal')).includes('developed'));
      await close(page);
      await page.evaluate(() => { const S = __snow; S.startCase(5); for (let k = 0; k < 5; k++) { S.sounding = [{ T: -2, s: .2, d: 1 }]; S.launch(); } });
      ok(await page.evaluate(() => !__snow.SAVE.done[5]), 'solved with the wrong sounding');
      await page.waitForTimeout(2900); eq(await page.evaluate(() => __snow.used), 0, 'balloons not refilled after the storm passed');
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      const r = await page.evaluate(() => {
        const S = __snow, late = [6, 7, 8]; let sd = 7; const R = () => (sd = (sd * 1103515245 + 12345) % 2147483648) / 2147483648;
        const CAN = { plate: [-14, .2], sector: [-14, .5], stellar: [-20, .9], dendrite: [-15, .9], column: [-7, .2], hollow: [-8, .6], needle: [-5.5, .85] };
        const order = cr => [...cr.rad.filter(g => !g.cap), ...cr.ax, ...cr.rad.filter(g => g.cap)];
        const naive = [], comp = [];
        for (const i of late) { const c = S.CASES[i], T = S.grow(c.target[0]);
          naive.push(S.scoreSounding(c, [{ T: -10, s: .5, d: 2 }]).score >= S.MATCH);                                    // idle: the starting sounding
          for (let run = 0; run < 10; run++) { let won = false; for (let b = 0; b < S.BALLOONS && !won; b++) {                 // random soundings
            const snd = Array.from({ length: 1 + Math.floor(R() * 4) }, () => ({ T: -1 - R() * 24, s: R(), d: 1 + Math.floor(R() * 3) })); won = S.scoreSounding(c, snd).score >= S.MATCH; } naive.push(won); }
          const out = (T.rad.at(-1) || T.ax.at(-1)).kind; naive.push(S.scoreSounding(c, [{ T: CAN[out][0], s: CAN[out][1], d: 3 }]).score >= S.MATCH); // one layer of the outermost habit
          // competent: read the layers from the inside out, guess the textbook condition for each, start every duration at 2,
          // then after each balloon fix the layer whose regrowth is most out of proportion with the specimen
          let snd = order(T).map(g => ({ T: CAN[g.kind][0], s: CAN[g.kind][1], d: 2 })), used = 0, sc = 0;
          while (used < S.BALLOONS) { used++; const res = S.scoreSounding(c, snd); sc = res.score; if (sc >= S.MATCH) break;
            const ext = cr => order(cr).map(g => (g.r1 ?? g.c1) - (g.r0 ?? g.c0)), m = ext(res.mine[0]), t = ext(T); let j = -1, w = 0;
            t.forEach((e, q) => { const lr = Math.log((m[q] || 1e-3) / e); if (Math.abs(lr) > Math.abs(w)) { w = lr; j = q; } }); if (j < 0) break;
            const l = snd[j]; if (Math.abs(w) > .3 && w > 0 && l.d > 1) l.d--; else if (Math.abs(w) > .3 && w < 0 && l.d < 3) l.d++; else l.s = Math.max(0, Math.min(1, l.s + (w > 0 ? -.1 : .1))); }
          comp.push(sc >= S.MATCH ? S.starsFor(used) : 0);
        }
        return { naive: naive.filter(Boolean).length / naive.length, comp, solver: late.map(i => S.scoreSounding(S.CASES[i], S.CASES[i].target[0]).score >= S.MATCH ? S.starsFor(1) : 0) };
      });
      ok(r.naive <= .2, 'naive soundings solved late cases too often: ' + r.naive);
      ok(r.comp.every(s => s >= 1), 'reading the flake should solve every late case: ' + r.comp);
      ok(r.comp.every(s => s < 3) && r.solver.every(s => s === 3), `three stars should need an exact reading: competent ${r.comp}, solver ${r.solver}`);
    },
    'saves: old and corrupt saves load; progress stays within 1': async ({ page, eq }) => {
      const r = await page.evaluate(() => [null, '[]', { done: { 0: 1, 3: 1 }, cur: 2 }, { v: 2, done: { 2: 7, x: 1, 99: 1 }, seen: { plate: 1, bogus: 1 }, cur: 4 }].map(__snow.cleanSave));
      eq(r[2].done, {}); eq(r[3].done, { 2: 3 }); eq(r[3].seen, { plate: 1 }); eq(r[3].cur, 4);
      await page.evaluate(() => { const S = __snow; S.CASES.forEach((_, i) => S.SAVE.done[i] = 3); S.sounding = [{ T: -2, s: .2, d: 2 }]; S.startCase(0); S.launch(); });
      eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).snowfall), 1);
    },
    'the pad: dragging sets temperature and humidity of the selected layer': async ({ page, ok }) => {
      const b = await page.locator('#pad').boundingBox();
      await page.mouse.move(b.x + b.width * (4.5 / 24), b.y + b.height * .1); await page.mouse.down(); await page.mouse.move(b.x + b.width * (4.5 / 24) + 1, b.y + b.height * .1); await page.mouse.up();
      const l = await page.evaluate(() => __snow.sounding[0]);
      ok(Math.abs(l.T + 5.5) <= .5 && l.s >= .85, JSON.stringify(l));
    },
    'phone: plates are the main surface; cases open from a drawer; no sideways scroll': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      ok(await page.evaluate(() => document.getElementById('cv').getBoundingClientRect().height > 400), 'plates too small');
      await page.click('#lvlBtn'); await page.waitForTimeout(300);
      ok(await page.evaluate(() => document.getElementById('cases').getBoundingClientRect().left >= 0), 'drawer did not open');
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= 392), 'sideways scroll');
    },
  },
};
