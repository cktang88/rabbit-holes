// Snowfall: the Nakaya morphology map, growth records the fall in order, every case is solvable by its own sounding and not
// at the start, the balloon budget and stars, saves, and the difficulty rule (guessing soundings fails; reading the flake works).
const close = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const L = (T, s, d = 2) => ({ T, s, d });

module.exports = {
  page: 'snowfall/index.html',
  ready: async page => { await page.waitForFunction(() => window.__snow); await close(page); await page.evaluate(() => __snow.setMode('cases')); }, // the forensic cases; the draw mode has its own tests below
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
      await page.evaluate(() => { const S = __snow; S.CASES.forEach((_, i) => S.SAVE.done[i] = 3); S.COMMS.forEach((_, i) => S.SAVE.comm[i] = 3); S.sounding = [{ T: -2, s: .2, d: 2 }]; S.startCase(0); S.launch(); });
      eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).snowfall), 1);
    },
    'the pad: dragging sets temperature and humidity of the selected layer': async ({ page, ok }) => {
      const b = await page.locator('#pad').boundingBox();
      await page.mouse.move(b.x + b.width * (4.5 / 24), b.y + b.height * .1); await page.mouse.down(); await page.mouse.move(b.x + b.width * (4.5 / 24) + 1, b.y + b.height * .1); await page.mouse.up();
      const l = await page.evaluate(() => __snow.sounding[0]);
      ok(Math.abs(l.T + 5.5) <= .5 && l.s >= .85, JSON.stringify(l));
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
      const s = await page.evaluate(() => __snow.sounding[0]); ok(s.T < -8 && s.s > .7, 'dot did not follow the finger: ' + JSON.stringify(s));
    },
    'crystals are grown by Reiter\'s automaton, a ring per layer: plates are solid, ferns are lacy, and a plate-then-fern flake shows both': async ({ page, ok }) => {
      const r = await page.evaluate(async () => { const S = __snow, fill = l => { const x = S.crystalFor(l); while (!x.done) x.run(500); let n = 0, tot = 0; for (let k = 0; k < x.o.fr.length; k++) if (x.o.fr[k]) n++; return { n, R: x.o.R, steps: x.o.steps, phases: x.i }; };
        return { plate: fill([{ T: -2, s: .3, d: 2 }]), fern: fill([{ T: -15, s: .95, d: 2 }]), both: fill([{ T: -14, s: .25, d: 3 }, { T: -14, s: .95, d: 1 }]) }; });
      ok(r.plate.R >= 80 && r.fern.R >= 80, 'crystals did not grow to full size');
      ok(r.plate.n > r.fern.n * 2, 'a plate should be far more solid than a fern: ' + r.plate.n + ' vs ' + r.fern.n);
      ok(r.both.phases === 1 && r.both.n < r.plate.n && r.both.n > r.fern.n, 'two layers should leave a solid centre and lacy tips: ' + JSON.stringify(r.both));
    },
    'touch: pressing a dot grabs that layer (not just the selected one); new layers do not hide the last': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const S = __snow; S.SAVE.done[0] = 1; S.startCase(6); document.getElementById('addL').click(); document.getElementById('addL').click(); });
      const snd = await page.evaluate(() => __snow.sounding.map(l => [l.T, l.s]));
      ok(snd[1][0] !== snd[0][0] || snd[1][1] !== snd[0][1], 'new layer drawn on top of the previous one');
      const r = await page.locator('#pad').boundingBox(), xy = ([T, s]) => [r.x + (T - -1) / (-25 - -1) * r.width, r.y + (1 - s) * r.height];
      const [x0, y0] = xy(snd[0]), [x1, y1] = [r.x + r.width * .8, r.y + r.height * .1];
      await page.evaluate(([x0, y0, x1, y1]) => { const p = document.getElementById('pad'), ev = (t, x, y) => p.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', bubbles: true }));
        ev('pointerdown', x0 + 3, y0 - 2); for (let i = 1; i <= 10; i++) ev('pointermove', x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); ev('pointerup', x1, y1); }, [x0, y0, x1, y1]);
      const after = await page.evaluate(() => __snow.sounding.map(l => [l.T, l.s]));
      eq(after.length, 3); ok(after[0][0] < -15 && after[0][1] > .8, 'layer 1 did not follow the finger: ' + JSON.stringify(after));
      eq(after.slice(1), snd.slice(1), 'other layers moved');
    },
    'draw the fall: a path gives the same flake every time; links round-trip; habits read centre outwards': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const S = __snow, P = [S.P2(-14, .2), S.P2(-14, .95)], a = S.pathLayers(P), b = S.pathLayers(P), d = S.decodePath(S.encodePath(P));
        const grow = L => { const x = S.crystalFor(L); while (!x.done) x.run(800); let n = 0; for (const v of x.o.fr) n += v; return n; };
        return { same: JSON.stringify(a) === JSON.stringify(b), seq: S.habitSeq(a), rt: S.habitSeq(S.pathLayers(d)), name: S.nameOf(S.habitSeq(a)), rev: S.habitSeq(S.pathLayers(P.slice().reverse())), g1: grow(a), g2: grow(S.pathLayers(P.slice())) }; });
      ok(r.same); eq(r.seq, ['plate', 'sector', 'dendrite']); eq(r.rt, r.seq); eq(r.rev, ['dendrite', 'sector', 'plate']); eq(r.g1, r.g2);
      ok(typeof r.name === 'string' && r.name.length > 3);
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
        // competent: for each wanted habit in order, head for the nearest point well inside that region (no knowledge of the par route)
        const G = 48, H = 40, kind = (i, j) => S.habitSeq([{ T: -1 - 24 * (i + .5) / G, s: 1 - (j + .5) / H, d: 1 }, { T: -1 - 24 * (i + .5) / G, s: 1 - (j + .5) / H, d: 1 }])[0];
        const K = []; for (let i = 0; i < G; i++) { K.push([]); for (let j = 0; j < H; j++) K[i].push(kind(i, j)); }
        const inner = []; for (let i = 2; i < G - 2; i++) for (let j = 2; j < H - 2; j++) { let ok = true; for (let a = -2; a <= 2 && ok; a++) for (let b = -2; b <= 2; b++) if (K[i + a][j + b] !== K[i][j]) { ok = false; break; } if (ok) inner.push([i, j, K[i][j]]); }
        const plan = want => { const P = []; let at = [.5, .5]; for (const k of want) { let best = null, bd = 9; for (const [i, j, kk] of inner) if (kk === k) { const x = (i + .5) / G, y = (j + .5) / H, d = Math.hypot(x - at[0], y - at[1]); if (d < bd) { bd = d; best = [x, y]; } } if (best) { P.push(best); at = best; } } return P; };
        // a person draws that plan by hand: the same route with a little wobble along each stroke; a solver draws it exactly
        const wobble = P => { const out = [P[0]]; for (let i = 1; i < P.length; i++) for (let t = 1; t <= 4; t++) { const f = t / 4, j = t < 4 ? .06 : 0; out.push([P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f + (R() - .5) * j, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f + (R() - .5) * j]); } return out; };
        const comp = late.map(c => { const j = S.judgeComm(c, wobble(plan(c.want))); return j.ok ? j.stars : 0; });
        const solver = late.map(c => { const j = S.judgeComm(c, plan(c.want)); return j.ok ? j.stars : 0; });
        return { rate: hits / tries, comp, solver }; });
      ok(r.rate < .1, 'scribbles satisfied commissions too often: ' + r.rate);
      ok(r.comp.filter(x => x >= 1).length >= r.comp.length - 1, 'region-to-region strokes should deliver most late commissions: ' + r.comp);
      ok(r.comp.filter(x => x === 3).length <= 1 && r.solver.every(x => x === 3), 'three stars should need a near-exact line: hand ' + r.comp + ' solver ' + r.solver);
    },
    'draw with a real mouse and a finger: the flake grows, enters the codex, and the link replays it': async ({ page, ok, eq }) => {
      await page.evaluate(() => __snow.setMode('draw')); await page.locator('#pad').scrollIntoViewIfNeeded();
      const r = await page.locator('#pad').boundingBox(), pt = (T, s) => [r.x + r.width * (T + 1) / -24, r.y + r.height * (1 - s)];
      let [x, y] = pt(-14, .2); await page.mouse.move(x, y); await page.mouse.down(); [x, y] = pt(-14, .95); await page.mouse.move(x, y, { steps: 15 }); await page.mouse.up();
      await page.waitForTimeout(300);
      eq(await page.evaluate(() => Object.keys(__snow.SAVE.codex)), ['plate,sector,dendrite']);
      ok(await page.evaluate(() => location.hash.startsWith('#fall=')), 'no share link');
      const cdp = await page.context().newCDPSession(page); [x, y] = pt(-5.5, .85);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 2, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300); ok(await page.evaluate(() => 'needle' in __snow.SAVE.codex), 'a tap did not grow a needle');
      const hash = await page.evaluate(() => location.hash); await page.goto('about:blank'); await page.goto('http://localhost:8765/snowfall/index.html' + hash); await page.waitForTimeout(800);
      ok(await page.evaluate(() => __snow.drawLayers && __snow.habitSeq(__snow.drawLayers).join() === 'needle'), 'link did not replay the flake');
    },
    'a commission through the UI: right flake earns stars, the wrong one explains what you grew': async ({ page, ok }) => {
      await page.evaluate(() => { const S = __snow; S.setMode('draw'); S.SAVE.tab = 'comm'; S.SAVE.ci = 3; S.renderDraw(); S.release([S.P2(-2, .2)]); });
      ok((await page.textContent('#side')).includes('Not quite'), 'no explanation for the wrong flake');
      await page.evaluate(() => { const S = __snow; S.release(S.COMMS[3].solver || S.COMMS[3].par); });
      ok(await page.evaluate(() => __snow.SAVE.comm[3] === 3), 'commission not recorded');
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
