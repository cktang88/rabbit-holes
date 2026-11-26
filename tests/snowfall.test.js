// Snowfall: the Nakaya/Libbrecht morphology diagram (temperature against vapour excess over ice), diffusion-limited growth with
// sublimation and riming, physically limited falls, the legendary forms and their recipes, the cases, the draw mode, saves,
// first-visit guidance, the plates' zoom, and the difficulty rule (guessing fails; reading the flake or planning a route works).
const close = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
// screen point on the pad for a temperature (°C) and vapour excess (g/m³)
const padPt = (r, T, s) => [r.x + r.width * (T / -30), r.y + r.height * ((.32 - s) / .38)];

module.exports = {
  page: 'snowfall/index.html',
  ready: async page => { await page.waitForFunction(() => window.__snow); await close(page); await page.evaluate(() => __snow.setMode('cases')); }, // the forensic cases; the draw mode has its own tests below
  tests: {
    'habit(): Nakaya/Libbrecht morphology at representative points, and the water-saturation curve': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const h = __snow.habit, w = __snow.waterLine;
        return { h: [h(-2, .02), h(-2, .07), h(-7, .02), h(-5, .13), h(-8, .1), h(-14, .02), h(-14, .07), h(-15, .19), h(-20, .13), h(-26, .03), h(-26, .1)],
          w: [-2, -5, -10, -12, -15, -20, -30].map(T => w(T)) }; });
      eq(r.h, ['plate', 'sector', 'column', 'needle', 'hollow', 'plate', 'sector', 'dendrite', 'stellar', 'plate', 'column']);
      // the excess at water saturation rises from 0 °C, peaks near −12 °C at about 0.22 g/m³ and falls again (Nakaya's curve)
      ok(r.w[0] < r.w[1] && r.w[1] < r.w[2] && r.w[3] > r.w[4] && r.w[4] > r.w[5] && r.w[5] > r.w[6] && Math.abs(r.w[3] - .225) < .01, 'water line: ' + r.w);
    },
    'grow(): centre is oldest; caps after a column; size scales with time and supersaturation; droplets cap growth at the water line': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const S = __snow, g = S.grow, a = g([{ T: -6, s: .03, d: 2 }, { T: -14, s: .08, d: 2 }]), b = g([{ T: -14, s: .08, d: 2 }, { T: -6, s: .03, d: 2 }]);
        const slow = g([{ T: -15, s: .2, d: 1 }]), fast = g([{ T: -15, s: .2, d: 3 }]), dry = g([{ T: -14, s: .02, d: 2 }]), wet = g([{ T: -14, s: .03, d: 2 }]);
        const over = g([{ T: -15, s: .3, d: 2 }]), at = g([{ T: -15, s: S.waterLine(-15), d: 2 }]);
        return { aCaps: a.caps, bCaps: b.caps, aKinds: [a.ax[0].kind, a.rad[0].kind], ratio: (fast.a - .25) / (slow.a - .25), wetRatio: (wet.a - .25) / (dry.a - .25), sameAB: S.similarity(a, b), over: [over.rime, over.a, at.a] }; });
      eq([r.aCaps, r.bCaps], [true, false]); eq(r.aKinds, ['column', 'sector']); ok(Math.abs(r.ratio - 3) < 1e-9, 'growth proportional to time');
      ok(Math.abs(r.wetRatio - 1.5) < 1e-9, 'diffusion-limited: growth proportional to the vapour excess: ' + r.wetRatio);
      ok(r.sameAB < .9, 'the same two layers in the opposite order must not count as a match: ' + r.sameAB);
      ok(r.over[0] === 2 && Math.abs(r.over[1] - r.over[2]) < 1e-9, 'above water saturation the excess goes to rime, not faster growth: ' + r.over);
    },
    'sublimation: below ice saturation the crystal shrinks and its tips round off': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const S = __snow, fern = [{ T: -15, s: .2, d: 2 }], dry = [...fern, { T: -15, s: -.05, d: 2 }];
        const run = L => { const x = S.crystalFor(L); while (!x.done) x.run(800); let n = 0, tips = 0; const o = x.o, NB = [1, -1, 181, -181, 180, -180];
          for (let k = 0; k < o.fr.length; k++) if (o.fr[k]) { n++; let m = 0; for (const d of NB) m += o.fr[k + d] || 0; if (m <= 2) tips++; } return { n, tips, a: S.grow(L).a }; };
        const A = run(fern), B = run(dry), none = S.grow([{ T: -15, s: -.03, d: 3 }]); return { A, B, none: none.a };
      });
      ok(r.B.a < r.A.a, 'did not shrink: ' + JSON.stringify(r)); ok(r.B.n < r.A.n * .9, 'too little ice lost: ' + JSON.stringify(r));
      ok(r.B.tips < r.A.tips * .6, 'tips should go first (rounding): ' + JSON.stringify(r)); ok(r.none <= .25, 'nothing grows below ice saturation');
    },
    'every case: its own sounding matches, the starting sounding does not, and different cases do not match each other': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const S = __snow, out = [];
        S.CASES.forEach((c, i) => { if (c.chamber) return;
          if (S.scoreSounding(c, c.target[0]).score < .999) out.push(i + ' own sounding');
          if (S.scoreSounding(c, [{ T: -10, s: .07, d: 2 }]).score >= S.MATCH) out.push(i + ' default matches');
          S.CASES.forEach((d, j) => { if (j !== i && !d.chamber && S.scoreSounding(c, d.target[0]).score >= S.MATCH) out.push(i + ' matched by case ' + j); }); });
        return out; });
      ok(!bad.length, bad.join('; '));
    },
    'the cold chamber teaches the diagram: kinds you grow are labelled, four open the case files; dry air grows nothing': async ({ page, ok, eq }) => {
      ok(await page.evaluate(() => !__snow.isOpen(1)), 'case 1 open before the chamber');
      await page.evaluate(() => { __snow.sounding = [{ T: -15, s: -.03, d: 2 }]; __snow.launch(); });
      eq(await page.evaluate(() => Object.keys(__snow.SAVE.seen)), [], 'a crystal grew below ice saturation');
      for (const [T, s] of [[-2, .02], [-5, .13], [-15, .19]]) { await page.evaluate(([T, s]) => { __snow.sounding = [{ T, s, d: 2 }]; __snow.launch(); }, [T, s]); }
      ok(await page.evaluate(() => !__snow.isOpen(1)), 'opened after three kinds');
      await page.evaluate(() => { __snow.sounding = [{ T: -7, s: .02, d: 2 }]; __snow.launch(); });
      eq(await page.evaluate(() => Object.keys(__snow.SAVE.seen).sort()), ['column', 'dendrite', 'needle', 'plate']);
      ok(await page.evaluate(() => __snow.isOpen(1)), 'four kinds did not open the cases');
    },
    'balloons: each regrowth costs one; stars by balloons; running out resets the case': async ({ page, eq, ok }) => {
      await page.evaluate(() => { const S = __snow; S.SAVE.done[0] = 1; S.startCase(4); });
      for (let k = 0; k < 2; k++) await page.evaluate(() => { __snow.sounding = [{ T: -2, s: .02, d: 1 }]; __snow.launch(); });
      eq(await page.evaluate(() => __snow.used), 2);
      await page.evaluate(() => { __snow.sounding = __snow.CASES[4].target[0].map(l => ({ ...l })); __snow.launch(); });
      await page.waitForTimeout(1200); eq(await page.evaluate(() => __snow.SAVE.done[4]), 2, 'three balloons should earn two stars');
      ok((await page.textContent('.modal')).includes('developed'));
      await close(page);
      await page.evaluate(() => { const S = __snow; S.startCase(5); for (let k = 0; k < 5; k++) { S.sounding = [{ T: -2, s: .02, d: 1 }]; S.launch(); } });
      ok(await page.evaluate(() => !__snow.SAVE.done[5]), 'solved with the wrong sounding');
      await page.waitForTimeout(2900); eq(await page.evaluate(() => __snow.used), 0, 'balloons not refilled after the storm passed');
      // run out, then open another case at once and launch there: the old storm's reset must not wipe the new case
      await page.evaluate(() => { const S = __snow; S.startCase(5); for (let k = 0; k < 5; k++) { S.sounding = [{ T: -2, s: .02, d: 1 }]; S.launch(); } S.startCase(3); S.sounding = [{ T: -2, s: .02, d: 1 }]; S.launch(); });
      await page.waitForTimeout(2900); eq(await page.evaluate(() => [__snow.cur, __snow.used]), [3, 1], 'the other case kept its balloon and regrowth');
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      const r = await page.evaluate(() => {
        const S = __snow, late = [6, 7, 8]; let sd = 7; const R = () => (sd = (sd * 1103515245 + 12345) % 2147483648) / 2147483648;
        const CAN = { plate: [-14, .02], sector: [-14, .07], stellar: [-20, .13], dendrite: [-15, .19], column: [-7, .02], hollow: [-8, .08], needle: [-5, .13] };
        const order = cr => [...cr.rad.filter(g => !g.cap), ...cr.ax, ...cr.rad.filter(g => g.cap)];
        const naive = [], comp = [];
        for (const i of late) { const c = S.CASES[i], T = S.grow(c.target[0]);
          naive.push(S.scoreSounding(c, [{ T: -10, s: .07, d: 2 }]).score >= S.MATCH);                                   // idle: the starting sounding
          for (let run = 0; run < 10; run++) { let won = false; for (let b = 0; b < S.BALLOONS && !won; b++) {                // random soundings
            const snd = Array.from({ length: 1 + Math.floor(R() * 4) }, () => ({ T: -R() * 30, s: Math.round((-.06 + R() * .3) * 100) / 100, d: 1 + Math.floor(R() * 3) })); won = S.scoreSounding(c, snd).score >= S.MATCH; } naive.push(won); }
          const out = (T.rad.at(-1) || T.ax.at(-1)).kind; naive.push(S.scoreSounding(c, [{ T: CAN[out][0], s: CAN[out][1], d: 3 }]).score >= S.MATCH); // one layer of the outermost habit
          // competent: read the layers from the inside out, guess the textbook condition for each, start every duration at 2,
          // then after each balloon fix the layer whose regrowth is most out of proportion with the specimen
          let snd = order(T).map(g => ({ T: CAN[g.kind][0], s: CAN[g.kind][1], d: 2 })), used = 0, sc = 0;
          while (used < S.BALLOONS) { used++; const res = S.scoreSounding(c, snd); sc = res.score; if (sc >= S.MATCH) break;
            const ext = cr => order(cr).map(g => (g.r1 ?? g.c1) - (g.r0 ?? g.c0)), m = ext(res.mine[0]), t = ext(T); let j = -1, w = 0;
            t.forEach((e, q) => { const lr = Math.log((m[q] || 1e-3) / e); if (Math.abs(lr) > Math.abs(w)) { w = lr; j = q; } }); if (j < 0) break;
            const l = snd[j], stuck = w < 0 ? l.s >= .21 : l.s <= .01; if ((Math.abs(w) > .3 || stuck) && w > 0 && l.d > 1) l.d--; else if ((Math.abs(w) > .3 || stuck) && w < 0 && l.d < 3) l.d++; else l.s = Math.round(Math.max(.01, Math.min(.21, l.s + (w > 0 ? -1 : 1) * Math.max(.01, l.s * .2))) * 100) / 100; }
          comp.push(sc >= S.MATCH ? S.starsFor(used) : 0);
        }
        return { naive: naive.filter(Boolean).length / naive.length, comp, solver: late.map(i => S.scoreSounding(S.CASES[i], S.CASES[i].target[0]).score >= S.MATCH ? S.starsFor(1) : 0) };
      });
      ok(r.naive <= .2, 'naive soundings solved late cases too often: ' + r.naive);
      ok(r.comp.every(s => s >= 1), 'reading the flake should solve every late case: ' + r.comp);
      ok(r.comp.every(s => s < 3) && r.solver.every(s => s === 3), `three stars should need an exact reading: competent ${r.comp}, solver ${r.solver}`);
    },
    'saves: old and corrupt saves load; v2 codices are regraded; progress stays within 1': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => [null, '[]', { done: { 0: 1, 3: 1 }, cur: 2 }, { v: 2, done: { 2: 7, x: 1, 99: 1 }, seen: { plate: 1, bogus: 1 }, cur: 4, codex: { needle: { d: '2026-01-01', p: '0000', n: 2 }, 'bad key!': {} } }].map(__snow.cleanSave));
      eq(r[2].done, {}); eq(r[3].done, { 2: 3 }); eq(r[3].seen, { plate: 1 }); eq(r[3].cur, 4); eq(r[3].v, 3);
      ok(Object.keys(r[3].codex).length === 1 && !('needle' in r[3].codex), 'old entry not regrown under the new diagram: ' + JSON.stringify(r[3].codex));
      await page.evaluate(() => { const S = __snow; S.CASES.forEach((_, i) => S.SAVE.done[i] = 3); S.COMMS.forEach((_, i) => S.SAVE.comm[i] = 3); S.sounding = [{ T: -2, s: .02, d: 2 }]; S.startCase(0); S.launch(); });
      eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).snowfall), 1);
      ok(await page.evaluate(() => localStorage.getItem('rh:snowfall').length) < 50000, 'save too large');
    },
    'the pad: dragging sets temperature and vapour excess of the selected layer': async ({ page, ok }) => {
      const b = await page.locator('#pad').boundingBox(), [x, y] = padPt(b, -5.5, .14);
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 1, y); await page.mouse.up();
      const l = await page.evaluate(() => __snow.sounding[0]);
      ok(Math.abs(l.T + 5.5) <= .5 && Math.abs(l.s - .14) <= .015, JSON.stringify(l));
    },
    'regression (iPhone): a touch drag on the diagram moves the one dot; it never stamps new layers or leaves old dots behind': async ({ page, ok, eq }) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
      await page.waitForTimeout(300); await page.evaluate(() => { __snow.startCase(0); document.getElementById('pad').scrollIntoView(); });
      const r = await page.locator('#pad').boundingBox(), p0 = [r.x + r.width * .1, r.y + r.height * .8];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p0[0], y: p0[1] }] });
      for (let i = 1; i <= 20; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x + r.width * (.1 + .035 * i), y: r.y + r.height * (.8 - .035 * i) }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      eq(await page.evaluate(() => __snow.sounding.length), 1, 'a drag added layers');
      const left = await page.evaluate(([x, y]) => { const c = document.getElementById('pad'), b = c.getBoundingClientRect(), k = c.width / b.width, d = c.getContext('2d').getImageData((x - b.left) * k | 0, (y - b.top) * k | 0, 1, 1).data; return [d[0], d[1], d[2]]; }, p0);
      ok(!(left[0] > 220 && left[1] > 190 && left[2] < 170), 'the dot was left behind where the drag began: ' + left);
      const s = await page.evaluate(() => __snow.sounding[0]); ok(s.T < -8 && s.s > .2, 'dot did not follow the finger: ' + JSON.stringify(s));
    },
    'crystals are grown by Reiter\'s automaton, a ring per layer, all six arms in step: plates are solid, ferns are lacy': async ({ page, ok }) => {
      const r = await page.evaluate(async () => { const S = __snow, fill = l => { const x = S.crystalFor(l); while (!x.done) x.run(500); let n = 0; for (let k = 0; k < x.o.fr.length; k++) if (x.o.fr[k]) n++;
          // symmetry: the six arm tips (along the lattice directions) reach nearly the same distance
          const N = 181, C = 90, dirs = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]], reach = dirs.map(([dq, dr]) => { let t = 0; while (t < 89 && x.o.fr[(C + dr * (t + 1)) * N + C + dq * (t + 1)]) t++; return t; });
          return { n, R: x.o.R, phases: x.ph.length, spread: Math.max(...reach) - Math.min(...reach), reach }; };
        return { plate: fill([{ T: -2, s: .03, d: 2 }]), fern: fill([{ T: -15, s: .2, d: 2 }]), both: fill([{ T: -14, s: .03, d: 3 }, { T: -14, s: .2, d: 1 }]) }; });
      ok(r.plate.R >= 80 && r.fern.R >= 80, 'crystals did not grow to full size');
      ok(r.plate.n > r.fern.n * 2, 'a plate should be far more solid than a fern: ' + r.plate.n + ' vs ' + r.fern.n);
      ok(r.both.phases === 2 && r.both.n < r.plate.n && r.both.n > r.fern.n, 'two layers should leave a solid centre and lacy tips: ' + JSON.stringify(r.both));
      ok(r.fern.spread <= 6 && r.plate.spread <= 3, 'arms should grow in step, with only small noise: ' + JSON.stringify([r.fern.reach, r.plate.reach]));
    },
    'touch: pressing a dot grabs that layer (not just the selected one); new layers do not hide the last': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const S = __snow; S.SAVE.done[0] = 1; S.startCase(6); document.getElementById('addL').click(); document.getElementById('addL').click(); });
      const snd = await page.evaluate(() => __snow.sounding.map(l => [l.T, l.s]));
      ok(snd[1][0] !== snd[0][0] || snd[1][1] !== snd[0][1], 'new layer drawn on top of the previous one');
      const r = await page.locator('#pad').boundingBox(), [x0, y0] = padPt(r, ...snd[0]), [x1, y1] = [r.x + r.width * .8, r.y + r.height * .1];
      await page.evaluate(([x0, y0, x1, y1]) => { const p = document.getElementById('pad'), ev = (t, x, y) => p.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', bubbles: true }));
        ev('pointerdown', x0 + 3, y0 - 2); for (let i = 1; i <= 10; i++) ev('pointermove', x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); ev('pointerup', x1, y1); }, [x0, y0, x1, y1]);
      const after = await page.evaluate(() => __snow.sounding.map(l => [l.T, l.s]));
      eq(after.length, 3); ok(after[0][0] < -15 && after[0][1] > .2, 'layer 1 did not follow the finger: ' + JSON.stringify(after));
      eq(after.slice(1), snd.slice(1), 'other layers moved');
    },
    'draw the fall: a path gives the same flake every time; links round-trip; habits read centre outwards': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const S = __snow, P = [S.P2(-14, .02), S.P2(-14, .2)], a = S.pathLayers(P), b = S.pathLayers(P), d = S.decodePath(S.encodePath(P));
        const grow = L => { const x = S.crystalFor(L); while (!x.done) x.run(800); let n = 0; for (const v of x.o.fr) n += v; return n; };
        return { same: JSON.stringify(a) === JSON.stringify(b), seq: S.habitSeq(a), rt: S.habitSeq(S.pathLayers(d)), name: S.nameOf(S.habitSeq(a)), rev: S.habitSeq(S.pathLayers(P.slice().reverse())), g1: grow(a), g2: grow(S.pathLayers(P.slice())) }; });
      ok(r.same); eq(r.seq, ['plate', 'sector', 'stellar', 'dendrite']); eq(r.rt, r.seq); eq(r.rev, ['dendrite', 'stellar', 'sector', 'plate']); eq(r.g1, r.g2);
      ok(typeof r.name === 'string' && r.name.length > 3);
    },
    'realistic falls: 48 minutes, every step within lapse-rate and humidity limits; scribbles tumble into graupel or polycrystals': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const S = __snow; let sd = 5; const R = () => (sd = (sd * 1103515245 + 12345) % 2147483648) / 2147483648; let worst = 0, scrib = 0, bad = [];
        for (let t = 0; t < 200; t++) { let x = R(), y = R(); const P = Array.from({ length: 2 + (R() * 80 | 0) }, () => [x = Math.min(1, Math.max(0, x + (R() - .5) * .4)), y = Math.min(1, Math.max(0, y + (R() - .5) * .4))]);
          const f = S.fallOf(P); for (let k = 1; k < f.pts.length; k++) worst = Math.max(worst, Math.hypot((f.pts[k][0] - f.pts[k - 1][0]) / 1.4, (f.pts[k][1] - f.pts[k - 1][1]) / .03));
          if (P.length > 30) { scrib++; const c = S.classify(P); if (!['graupel', 'poly'].includes(c.key)) bad.push(c.key); } }
        const calm = S.classify([S.P2(-3, .03), S.P2(-25, .1)]);
        return { worst, scrib, bad, steps: S.fallOf([S.P2(-5, .1)]).pts.length, calm: [calm.f.wild, calm.key] }; });
      ok(r.worst <= 1 + 1e-9, 'a step broke the physical limits: ' + r.worst); ok(r.steps === 24, 'a fall is 24 two-minute steps');
      ok(r.bad.length <= r.scrib * .05, 'frantic scribbles should tumble: ' + r.bad.slice(0, 5)); ok(!r.calm[0], 'a calm sweep across the diagram is a real fall: ' + r.calm);
    },
    'riming: above water saturation droplets freeze on; a long spell there makes graupel': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const S = __snow; return [S.classify([S.P2(-15, .17), S.P2(-15.5, .19), S.P2(-16, .25)]).key, S.classify([S.P2(-12, .3), S.P2(-14, .29)]).key, S.classify([S.P2(-15, .19)]).key]; });
      ok(r[0].startsWith('rimed:'), 'a brief dip above the water line should rime: ' + r[0]); ok(r[1] === 'graupel', 'a long fall through droplets should be graupel: ' + r[1]); ok(!r[2].includes('rime'), 'below the line no rime: ' + r[2]);
    },
    'legendary forms: every documented recipe works; capped columns need column then plate; random lines and scribbles are almost never legendary': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const S = __snow; let sd = 9; const R = () => (sd = (sd * 1103515245 + 12345) % 2147483648) / 2147483648;
        const rec = S.LEGENDS.map(l => S.classify(l.recipe).key === 'legend:' + l.id);
        const capped = [S.classify([S.P2(-7, .03), S.P2(-11.5, .03)]).key, S.classify([S.P2(-11.5, .03), S.P2(-7, .03)]).key, S.classify([S.P2(-7, .03)]).key, S.classify([S.P2(-12, .03)]).key];
        const rate = gen => { let n = 0; for (let t = 0; t < 500; t++) if (S.classify(gen()).rar === 'legendary') n++; return n / 500; };
        const scribble = rate(() => { let x = R(), y = R(); return Array.from({ length: 20 + (R() * 100 | 0) }, () => [x = Math.min(1, Math.max(0, x + (R() - .5) * .3)), y = Math.min(1, Math.max(0, y + (R() - .5) * .3))]); });
        const poly = rate(() => Array.from({ length: 3 + (R() * 5 | 0) }, () => [R(), R()])), line = rate(() => [[R(), R()], [R(), R()]]);
        return { rec, capped, scribble, poly, line, notes: S.LEGENDS.every(l => /−\d/.test(l.where) && l.where.length > 60) }; });
      eq(r.rec, [true, true, true, true, true], 'a legendary recipe failed');
      eq(r.capped[0], 'legend:capped'); ok(r.capped.slice(1).every(k => k !== 'legend:capped'), 'capped column without column-then-plate: ' + r.capped);
      ok(r.scribble <= .02 && r.poly <= .02 && r.line <= .02, `too many accidental legendaries: scribble ${r.scribble}, polyline ${r.poly}, line ${r.line}`);
      ok(r.notes, 'every legendary needs its condition window in the field notes');
    },
    'commissions: each is won by a known route with three stars; the daily sky is winnable for any date': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const S = __snow, out = [];
        S.COMMS.forEach((c, i) => { const j = S.judgeComm(c, c.solver || c.par); if (!j.ok || j.stars !== 3) out.push(i + ' known route fails'); if (!S.judgeComm(c, c.par).ok) out.push(i + ' authored route grows the wrong flake'); if (S.COMMS.some((d, k) => k !== i && d.want.join() === c.want.join())) out.push(i + ' duplicates another commission'); });
        for (let d = 1; d <= 30; d++) { const c = S.dailyComm('2026-12-' + String(d).padStart(2, '0')); if (!c || S.judgeComm(c, c.solver || c.par).stars !== 3 || c.want.length < 2) out.push('daily ' + d); }
        if (JSON.stringify(S.dailyComm('2026-12-01')) !== JSON.stringify(S.dailyComm('2026-12-01'))) out.push('daily not deterministic');
        return out; });
      ok(!bad.length, bad.join('; '));
    },
    'difficulty: random scribbles rarely satisfy a commission; a planned route through the right clouds does': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const S = __snow; let sd = 3; const R = () => (sd = (sd * 1103515245 + 12345) % 2147483648) / 2147483648;
        const late = S.COMMS.slice(3); let hits = 0, tries = 0;
        for (const c of late) for (let t = 0; t < 60; t++) { tries++; const P = Array.from({ length: 2 + Math.floor(R() * 6) }, () => [R(), R()]); if (S.judgeComm(c, P).ok) hits++; }
        // competent: for each wanted habit in order, head for the nearest point well inside that region (no knowledge of the par route),
        // drawn by hand with a little wobble along each stroke; a solver draws the same plan exactly
        const wobble = P => { const out = [P[0]]; for (let i = 1; i < P.length; i++) for (let t = 1; t <= 4; t++) { const f = t / 4, j = t < 4 ? .03 : 0; out.push([P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f + (R() - .5) * j, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f + (R() - .5) * j]); } return out; };
        const comp = late.map(c => { const j = S.judgeComm(c, wobble(S.planRoute(c.want))); return j.ok ? j.stars : 0; });
        const solver = late.map(c => { const j = S.judgeComm(c, c.solver || c.par); return j.ok ? j.stars : 0; }); // the par route, drawn exactly
        return { rate: hits / tries, comp, solver }; });
      ok(r.rate < .1, 'scribbles satisfied commissions too often: ' + r.rate);
      ok(r.comp.filter(x => x >= 1).length >= r.comp.length - 1, 'region-to-region strokes should deliver most late commissions: ' + r.comp);
      ok(r.comp.filter(x => x === 3).length <= 1 && r.solver.every(x => x === 3), 'three stars should need a near-exact line: hand ' + r.comp + ' solver ' + r.solver);
    },
    'first visit: an empty diagram shows the ghost pen and prompt until the first stroke; axes carry units': async ({ page, ok }) => {
      await page.evaluate(() => __snow.setMode('draw')); await page.waitForTimeout(200);
      ok(await page.evaluate(() => __snow.ghostOn && !__snow.SAVE.drew), 'no ghost pen on an empty diagram');
      const ax = await page.evaluate(() => [document.getElementById('xAx').textContent, document.getElementById('yAx').textContent, document.querySelectorAll('#xAx span').length]);
      ok(ax[0].includes('°C') && ax[0].includes('−15') && ax[1].includes('g/m³') && ax[1].includes('0.2') && ax[2] >= 6, 'axes need units and ticks: ' + ax);
      const r = await page.locator('#pad').boundingBox(); let [x, y] = padPt(r, -12, .03); await page.mouse.move(x, y); await page.mouse.down(); [x, y] = padPt(r, -15, .1); await page.mouse.move(x, y, { steps: 6 });
      ok(await page.evaluate(() => __snow.SAVE.drew === 1), 'first stroke not remembered'); await page.mouse.up(); await page.waitForTimeout(150);
      ok(await page.evaluate(() => !__snow.ghostOn), 'ghost pen still running over a drawn fall');
    },
    'draw with a real mouse and a finger: the flake grows, enters the codex, and the link replays it': async ({ page, ok, eq }) => {
      await page.evaluate(() => __snow.setMode('draw')); await page.locator('#pad').scrollIntoViewIfNeeded();
      const r = await page.locator('#pad').boundingBox(), pt = (T, s) => padPt(r, T, s);
      let [x, y] = pt(-14, .02); await page.mouse.move(x, y); await page.mouse.down(); [x, y] = pt(-14, .2); await page.mouse.move(x, y, { steps: 15 }); await page.mouse.up();
      await page.waitForTimeout(300);
      eq(await page.evaluate(() => Object.keys(__snow.SAVE.codex)), ['plate,dendrite']);
      ok(await page.evaluate(() => location.hash.startsWith('#fall=')), 'no share link');
      const cdp = await page.context().newCDPSession(page); [x, y] = pt(-5, .13);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 2, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300); ok(await page.evaluate(() => 'needle' in __snow.SAVE.codex), 'a tap did not grow a needle');
      const hash = await page.evaluate(() => location.hash); await page.goto('about:blank'); await page.goto('http://localhost:8765/snowfall/index.html' + hash); await page.waitForTimeout(800);
      ok(await page.evaluate(() => __snow.drawLayers && __snow.habitSeq(__snow.drawLayers).join() === 'needle'), 'link did not replay the flake');
    },
    'zoom: the plates zoom around the cursor and a pinch there never draws; the diagram still lands under the finger': async ({ page, ok, near }) => {
      await page.evaluate(() => { __snow.setMode('draw'); __snow.release(__snow.LEGENDS[2].recipe); }); await page.waitForTimeout(300);
      const b = await page.locator('#cv').boundingBox(), cx = b.x + b.width * .3, cy = b.y + b.height * .4;
      const w0 = await page.evaluate(([x, y]) => __snow.cam.toWorld(x, y), [cx, cy]); await page.mouse.move(cx, cy); await page.mouse.wheel(0, -400); await page.waitForTimeout(100);
      const r = await page.evaluate(([x, y]) => ({ k: __snow.cam.k, w: __snow.cam.toWorld(x, y) }), [cx, cy]);
      ok(r.k > 1.5, 'wheel did not zoom the plates'); near(r.w[0], w0[0], .5); near(r.w[1], w0[1], .5);
      const before = await page.evaluate(() => [JSON.stringify(__snow.SAVE.codex), __snow.drawPath.length]);
      const pin = await page.evaluate(([x, y]) => { const el = document.getElementById('cv'), ev = (t, id, px) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: px, clientY: y, bubbles: true, pointerType: 'touch' })), k0 = __snow.cam.k;
        ev('pointerdown', 1, x - 20); ev('pointerdown', 2, x + 20); ev('pointermove', 1, x - 40); ev('pointermove', 2, x + 40); ev('pointerup', 1, x - 40); ev('pointerup', 2, x + 40); return __snow.cam.k / k0; }, [cx, cy]);
      ok(pin > 1.5, 'pinch did not zoom: ' + pin);
      ok(JSON.stringify(await page.evaluate(() => [JSON.stringify(__snow.SAVE.codex), __snow.drawPath.length])) === JSON.stringify(before), 'a pinch on the plates changed the fall');
      const pr = await page.locator('#pad').boundingBox(), [x, y] = padPt(pr, -20, .06); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 1, y); await page.mouse.up(); await page.waitForTimeout(200);
      const l = await page.evaluate(() => __snow.drawLayers[0]); ok(Math.abs(l.T + 20) < .6 && Math.abs(l.s - .06) < .01, 'zooming the plates moved where the diagram reads the finger: ' + JSON.stringify(l));
    },
    'a commission through the UI: right flake earns stars, the wrong one explains what you grew': async ({ page, ok }) => {
      await page.evaluate(() => { const S = __snow; S.setMode('draw'); S.SAVE.tab = 'comm'; S.SAVE.ci = 3; S.renderDraw(); S.release([S.P2(-2, .02)]); });
      ok((await page.textContent('#side')).includes('Not quite'), 'no explanation for the wrong flake');
      await page.evaluate(() => { const S = __snow; S.release(S.COMMS[3].solver || S.COMMS[3].par); });
      ok(await page.evaluate(() => __snow.SAVE.comm[3] === 3), 'commission not recorded');
    },
    'a close look at the plates does not follow you into another case, mode or commission; drawing flakes adds no Back-button steps': async ({ page, ok, eq }) => {
      const k = () => page.evaluate(() => [__snow.cam.k, __snow.cam.x, __snow.cam.y]);
      await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); __snow.cam.zoomAt(r.left + r.width * .7, r.top + r.height * .3, 2.5); });
      ok((await k())[0] > 2, 'zoomed'); await page.evaluate(() => __snow.startCase(1)); eq(await k(), [1, 0, 0], 'a new case starts at the whole plate');
      await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); __snow.cam.zoomAt(r.left + 50, r.top + 50, 2); document.getElementById('backDraw').click(); }); eq(await k(), [1, 0, 0], 'back to drawing');
      await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); __snow.cam.zoomAt(r.left + 50, r.top + 50, 2); document.querySelector('[data-tab="comm"]').click(); }); eq(await k(), [1, 0, 0], 'a commission');
      const h0 = await page.evaluate(() => history.length);
      await page.evaluate(() => { const P = [[.1, .5], [.3, .55], [.5, .6]]; __snow.release(P); __snow.release([[.2, .6], [.4, .62]]); __snow.release(P); });
      eq(await page.evaluate(() => history.length), h0, 'each flake replaced the link instead of pushing history'); ok(await page.evaluate(() => /#fall=/.test(location.hash)), 'the link is in the address bar');
    },
    'phone: ☰ List always opens a list, even from the open sky in the draw mode': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => { __snow.SAVE.tab = 'sky'; __snow.setMode('draw'); });
      ok(await page.evaluate(() => !document.getElementById('cases')), 'the sky tab has no list'); await page.click('#lvlBtn'); await page.waitForTimeout(300);
      ok(await page.evaluate(() => { const c = document.getElementById('cases'); if (!c) return false; const r = c.getBoundingClientRect(); return document.body.classList.contains('drawer') && r.right > 100 && r.left >= -1; }), 'the commissions list slid in');
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
