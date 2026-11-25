// Floatees: Stommel ocean model on the real coastlines. Western intensification (and its reversal), every
// voyage solvable / not solved at start / cheap tricks refused, bets locked during a run, saves.
const SEED = `(() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()`;
const ready = page => page.waitForFunction(() => window.__fl && __fl.ready2, null, { timeout: 60000 });
const unlock = page => page.evaluate(() => { for (let i = 0; i < __fl.LV.length - 1; i++) __fl.SAVE.done[i] = 1; });
const spin = (page, r) => page.evaluate(async r => { if (__fl.rot !== r) __fl.setSpin(r, true); while (!__fl.ready2) await new Promise(res => setTimeout(res, 100)); }, r);
// run a voyage to the end in fixed steps, judging it like the game does
const voyage = (page, lv, lat, lon, opts = {}) => page.evaluate(async ([lv, lat, lon, seed, rot]) => {
  eval(seed); const X = __fl; X.load(lv);
  if (rot != null && rot !== X.rot) { X.setSpin(rot, true); while (!X.ready2) await new Promise(r => setTimeout(r, 100)); }
  const ok = lat == null ? (X.drop(...X.LV[lv].drop, 120), true) : X.dropAt(lat, lon); if (!ok) return { rejected: true };
  const L = X.level; let won = false;
  for (let t = 0; t < L.years && !X.won && !X.resolved; t += .02) { X.step(.02); X.simT = Math.min(L.years, X.simT); X.check(); }
  const S = X.stats(); return { won: X.won, resolved: X.resolved, S: { uk: S.regions.uk, eu: S.regions.europe + S.regions.uk, patch: S.patch, lap: S.maxLap, first: S.first } };
}, [lv, lat, lon, SEED, opts.rot]);

module.exports = {
  page: 'floatees/index.html',
  ready,
  tests: {
    'Stommel: fastest North Atlantic current hugs the west; reversed spin moves it east; no spin weakens it; field is finite': async ({ page, ok, near }) => {
      const prof = async () => page.evaluate(() => { let best = 0, at = 0; for (let lat = 26; lat <= 40; lat += 2) for (let lon = -80; lon <= -12; lon += .5) { const v = __fl.vel(lat, lon), s = Math.hypot(v[0], v[1]); if (s > best) { best = s; at = lon; } } return [best, at]; });
      // the game's own measurement box off the US coast (where the Gulf Stream runs)
      const box = () => page.evaluate(() => { let best = 0; for (let lat = 26; lat <= 44; lat += 1) for (let lon = -81; lon <= -63; lon += .5) { const v = __fl.vel(lat, lon); best = Math.max(best, Math.hypot(v[0], v[1])); } return best; });
      const [s1, lon1] = await prof(), b1 = await box(); ok(lon1 < -60, 'normal spin: fastest at ' + lon1);
      await spin(page, -1); const [sr, lonr] = await prof(); ok(lonr > -35, 'reversed spin: fastest at ' + lonr);
      await spin(page, 0); const b0 = await box(); ok(b1 > 1.25 * b0, `no spin should have no Gulf Stream: ${b1} vs ${b0}`);
      await spin(page, 1);
      // velocity field: finite everywhere, continuous across the date line
      const r = await page.evaluate(() => { let bad = 0; for (let lat = -84; lat <= 84; lat += 3) for (let lon = -180; lon <= 180; lon += 3) { const v = __fl.vel(lat, lon); if (!isFinite(v[0]) || !isFinite(v[1])) bad++; }
        const a = Array.from(__fl.vel(10, 179.999)), b = Array.from(__fl.vel(10, -179.999)); return { bad, a, b }; });
      ok(r.bad === 0, 'non-finite velocities: ' + r.bad); near(r.a[0], r.b[0], .05); near(r.a[1], r.b[1], .05);
    },
    'no voyage is won before any drop; every voyage is solvable with a sensible drop': async ({ page, ok }) => {
      await unlock(page);
      const st = await page.evaluate(() => __fl.LV.map((l, i) => { __fl.load(i); return !!(l.win && l.win(__fl.stats())); }));
      ok(st.every(x => !x), 'won at start: ' + JSON.stringify(st));
      await page.evaluate(() => { __fl.load(0); __fl.bet = 'nawest'; });
      const v0 = await page.evaluate(async seed => { eval(seed); const X = __fl; X.load(0); X.bet = 'nawest'; X.drop(...X.LV[0].drop, 120); for (let t = 0; t < 2 && !X.won && !X.resolved; t += .02) { X.step(.02); X.check(); } return [X.won, X.stats().first]; }, SEED);
      ok(v0[0], 'bet on North America: first ashore was ' + v0[1]);
      const cases = [[1, 30, -78], [2, 25, -150], [4, 25, -70, -1], [5, -55, -60]];
      for (const [lv, lat, lon, rot] of cases) { const r = await voyage(page, lv, lat, lon, { rot }); ok(r.won, `voyage ${lv} not won: ` + JSON.stringify(r)); }
      // Why the West: measure with spin on, then off
      const m = await page.evaluate(async seed => { eval(seed); const X = __fl; X.load(3);
        const run = async r => { if (X.rot !== r) { X.setSpin(r, true); while (!X.ready2) await new Promise(res => setTimeout(res, 100)); } X.dropAt(33, -77); for (let t = 0; t < 1 && !X.won; t += .02) { X.step(.02); X.check(); } };
        await run(1); const after1 = X.won; await run(0); const S = X.stats(); X.setSpin(1, true); return [after1, X.won, S.meas[1], S.meas[0]]; }, SEED);
      ok(!m[0] && m[1], 'measure level: ' + JSON.stringify(m));
    },
    'cheap tricks are refused; a miss explains how close it was': async ({ page, ok, eq }) => {
      await unlock(page);
      // a drop right inside the garbage patch, or next to Europe on the backwards planet, or off Europe for the bottle
      eq((await voyage(page, 2, 21, 165)).rejected, true, 'drop inside the patch');
      eq((await voyage(page, 2, 25, 160)).rejected, true, 'drop inside the patch ring edge');
      eq((await voyage(page, 4, 45, -20, { rot: -1 })).rejected, true, 'drop next to Europe');
      eq((await voyage(page, 1, 50, -20)).rejected, true, 'bottle dropped mid-Atlantic');
      eq((await voyage(page, 1, 40, 10)).rejected, true, 'land / Mediterranean');
      // the Backwards Planet needs the planet reversed
      const n = await voyage(page, 4, 25, -70, { rot: 1 }); ok(!n.won, 'won with normal spin');
      await spin(page, 1);
      // the 1992 spill can't be moved
      await page.evaluate(() => __fl.load(0)); eq(await page.evaluate(() => __fl.dropAt(30, -140)), false);
      // and a miss explains how close it was
      
      const r = await voyage(page, 1, 25, -98); // Gulf of Mexico: few reach Britain
      ok(r.resolved && !r.won, JSON.stringify(r));
      const t = await page.textContent('#toast'); ok(/need 15/.test(t) && /Britain/.test(t), t);
        },
    'the bet cannot be changed while ducks are at sea': async ({ page, eq, ok }) => {
      await page.click('#bets [data-k="japan"]');
      await page.click('#rel');
      ok(await page.$eval('#bets [data-k="nawest"]', b => b.disabled), 'bet buttons still enabled during the run');
      await page.evaluate(() => document.querySelector('#bets [data-k="nawest"]').click());
      eq(await page.evaluate(() => __fl.stats().bet), 'japan');
      // once resolved, betting opens again
      await page.evaluate(async seed => { eval(seed); const X = __fl; for (let t = 0; t < 2 && !X.won && !X.resolved; t += .02) { X.step(.02); X.check(); } }, SEED);
      eq(await page.evaluate(() => __fl.resolved), true);
      eq(await page.$eval('#bets [data-k="nawest"]', b => b.disabled), false);
      await page.click('#bets [data-k="nawest"]'); eq(await page.evaluate(() => __fl.stats().bet), 'nawest');
      eq(await page.evaluate(() => __fl.won), false, 'changing the bet after the result must not win');
    },
    'playback: slow by default (½× 1× 4× 12×, remembered), eased after a drop, skip to result; levels and locks': async ({ page, eq, ok }) => {
      eq(await page.evaluate(() => __fl.speed), 1);
      await unlock(page); await page.evaluate(() => __fl.load(2)); eq(await page.evaluate(() => __fl.speed), 1, 'no automatic fast-forward');
      eq(await page.$$eval('#ctrl [data-s]', bs => bs.map(b => b.textContent)), ['½×', '1×', '4×', '12×']);
      await page.click('#ctrl [data-s="4"]'); await page.evaluate(() => __fl.load(1)); eq(await page.evaluate(() => __fl.speed), 4, 'speed remembered');
      await page.click('#ctrl [data-s="1"]');
      // 1× is about two weeks of drift a second, and starts gently after a drop
      const pb = await page.evaluate(async () => { __fl.dropAt(30, -78); const t0 = __fl.simT; await new Promise(res => setTimeout(res, 1000)); const a = __fl.simT - t0; await new Promise(res => setTimeout(res, 2500)); const t1 = __fl.simT; await new Promise(res => setTimeout(res, 1000)); return [a, __fl.simT - t1]; });
      ok(pb[0] < pb[1], 'eased in after the drop: ' + pb); ok(pb[1] <= .045, 'about two weeks per second at 1×: ' + pb);
      ok(await page.isVisible('#skipB')); await page.click('#skipB');
      const end = await page.evaluate(() => [__fl.simT, __fl.won || __fl.resolved]); ok(end[1], 'skip runs the voyage to a verdict: ' + end);
      await page.evaluate(() => { __fl.SAVE.done = {}; });
      await page.evaluate(() => __fl.load(4)); eq(await page.evaluate(() => __fl.SAVE.cur), 0, 'locked voyage opened');
      await page.evaluate(() => __fl.load(9)); eq(await page.evaluate(() => __fl.SAVE.cur), 9, 'sandbox always open');
      const r = await voyage(page, 0, null); // the spill with no bet placed: release is a no-op in the UI, but the debug drop runs
      const p = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).floatees); ok(p >= 0 && p <= 1);
    },
    'stars reward a better drop; postcards arrive for new coasts; the success is a stamped beachcomber report': async ({ page, ok, eq }) => {
      await unlock(page);
      const r = await page.evaluate(async seed => { eval(seed); const X = __fl; X.load(1); X.dropAt(30, -78); let wonAt = -1;
        for (let t = 0; t < 3 && !X.resolved; t += .02) { X.step(.02); X.simT = Math.min(3, X.simT); X.check(); if (X.won && wonAt < 0) wonAt = X.simT; }
        return { wonAt, resolved: X.resolved, stars: X.SAVE.stars[1], cards: Object.keys(X.SAVE.cards), att: X.attempts, report: X.reportOn, uk: X.stats().regions.uk }; }, SEED);
      ok(r.wonAt > 0 && r.wonAt < 3, 'goal reached mid-voyage at ' + r.wonAt);
      ok(r.resolved, 'voyage ran to the end and was graded');
      eq(r.stars, r.uk >= 45 ? 3 : r.uk >= 30 ? 2 : 1, 'stars match the final count ' + r.uk);
      ok(r.cards.includes('uk'), 'a postcard from Britain: ' + r.cards);
      ok(r.report, 'beachcomber report shown');
      ok(/CONFIRMED/.test(await page.textContent('#report')));
      eq(r.att.length, 1); ok(/30°N 78°W/.test(await page.textContent('#tally')), 'logbook shows the drop');
      // stars never go down on a worse replay
      const r2 = await page.evaluate(async seed => { eval(seed); const X = __fl; document.getElementById('rclose').click(); X.load(1); X.dropAt(25, -95);
        for (let t = 0; t < 3 && !X.resolved; t += .02) { X.step(.02); X.simT = Math.min(3, X.simT); X.check(); } return X.SAVE.stars[1]; }, SEED);
      eq(r2, r.stars);
      eq(await page.evaluate(() => __fl.grade({ t: 3, regions: { uk: 50 }, maxLap: 0 })), 3);
    },
    'forensic cases: the logbook comes from the model, the true spill reproduces it, hindcasts cost computer time': async ({ page, ok, eq }) => {
      await unlock(page);
      const r = await page.evaluate(() => { const X = __fl, o = {};
        for (const lv of [6, 7, 8]) { X.load(lv); const C = X.level.case, log = X.caseLog(); X.caseState.month = C.truthMonth || 0;
          o[lv] = { n: log.length, self: X.caseTry(...C.truth).mis, off: X.caseTry(C.truth[0] + 8, C.truth[1] + 10).mis, budget: X.caseState.left }; }
        return o; });
      for (const lv of [6, 7, 8]) { ok(r[lv].n >= 2, `case ${lv} has a logbook (${r[lv].n})`); eq(r[lv].self, 0, `case ${lv}: the truth fits exactly`); ok(r[lv].off > 3, `case ${lv}: 8° off fails (${r[lv].off})`); }
      // play it through the UI path: a wrong hindcast uses one run and shows residuals; the truth closes the case with a report
      const v = await page.evaluate(() => { const X = __fl; X.load(6); const C = X.level.case;
        const run = (la, lo) => { X.dropAt(la, lo); for (let t = 0; t < X.level.years; t += .05) X.step(.05); X.simT = X.level.years; X.check(); };
        run(20, -40); const a = [X.caseState.left, X.won, X.resolved, document.querySelector('.logb').textContent.includes('mo')];
        run(...C.truth); return [...a, X.caseState.left, X.won, X.SAVE.stars[6], X.reportOn, document.getElementById('report').textContent.includes('Case closed')]; });
      eq(v, [11, false, true, true, 10, true, 3, true, true]);
      // out of computer time: further hindcasts are refused until the case is reopened
      const w = await page.evaluate(() => { const X = __fl; X.load(7); X.caseState.left = 0; return [X.dropAt(30, -60), X.caseState.left]; });
      eq(w, [false, 0]);
      eq(await page.evaluate(() => { __fl.load(7); return __fl.dropAt(10, 150); }), false, 'a drop in the wrong ocean is refused');
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      await unlock(page);
      const R = await page.evaluate(() => { const X = __fl, out = { naive: 0, naiveN: 0, comp: [], compMis: [] };
        for (const lv of [6, 7, 8]) {
          X.load(lv); const C = X.level.case, lim = 3, log = X.caseLog(), B = C.budget, A = C.area;
          const f = (la, lo, m = 0) => { X.caseState.month = m; return X.caseTry(la, lo); };
          let rs = 11 + lv; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
          for (let k = 0; k < 6; k++) { // random hindcasts anywhere in the basin (random month too)
            let best = 99; for (let j = 0; j < B; j++) best = Math.min(best, f(A[0] + rnd() * (A[1] - A[0]), A[2] + rnd() * (A[3] - A[2]), (rnd() * 12) | 0).mis); out.naiveN++; if (best <= lim) out.naive++; }
          for (let k = 0; k < 3; k++) { // the obvious guess: just offshore from the first sighting
            let best = 99; for (let j = 0; j < B; j++) { const q = log[0].at; best = Math.min(best, f(q[0] + (rnd() - .5) * 6, q[1] + (rnd() - .5) * 6 - 4).mis); } out.naiveN++; if (best <= lim) out.naive++; }
          out.naiveN++; // idling: no hindcast, no answer
          // competent: survey the basin with 6 probes, then a local pattern search; refit the month from the residuals
          let m = 0, n = 0, best = { mis: 99 };
          const refit = r => { const d = r.rows.filter(x => x.dt != null).map(x => x.dt).sort((a, b) => a - b); return d.length ? Math.max(0, Math.min(11, m - d[d.length >> 1])) : m; };
          const tryP = q => { if (n >= B) return; let r2 = f(q[0], q[1], m); n++; if (C.unknownDate) { const m2 = refit(r2); if (m2 !== m && n < B) { m = m2; r2 = f(q[0], q[1], m); n++; } } if (r2.mis < best.mis) best = { ...r2, pt: q }; };
          for (const fy of [.3, .7]) for (const fx of [.15, .45, .75]) tryP([A[0] + (A[1] - A[0]) * fy, A[2] + (A[3] - A[2]) * fx]);
          for (const st of [6, 3]) for (const [dl, dn] of [[st, 0], [-st, 0], [0, st], [0, -st]]) { if (best.mis <= lim * .7) break; tryP([best.pt[0] + dl, best.pt[1] + dn]); }
          out.comp.push(best.mis <= lim); out.compMis.push(+best.mis.toFixed(2));
        }
        return out; });
      ok(R.naive / R.naiveN <= .2, `naive bots solved ${R.naive}/${R.naiveN} late cases`);
      ok(R.comp.every(Boolean), 'competent survey-and-refine solves every case: ' + R.compMis);
      ok(R.compMis.every(m => m > 1.2), '3★ (≤1.2 months) needs better than the simple competent search: ' + R.compMis);
    },
    'touch: no hover tooltip left behind after a finger drag; jittery taps still drop': async ({ page, eq, ok }) => {
      const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), p2 = await ctx.newPage();
      await p2.goto(page.url()); await p2.waitForFunction(() => window.__fl && __fl.ready2, null, { timeout: 60000 });
      await p2.evaluate(() => { for (let i = 0; i < 9; i++) __fl.SAVE.done[i] = 1; __fl.load(9); });
      const cdp = await ctx.newCDPSession(p2), touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await touch('touchStart', 195, 420); for (let k = 1; k <= 6; k++) await touch('touchMove', 195 - k * 15, 420 - k * 4); await touch('touchEnd');
      await p2.waitForTimeout(100);
      eq(await p2.$eval('#tip', t => t.style.display), 'none', 'tooltip stuck after a drag');
      const [x, y, vis] = await p2.evaluate(() => __fl.screenOf(0, -150));
      if (vis) { await touch('touchStart', x, y); await touch('touchMove', x + 9, y + 3); await touch('touchEnd'); await p2.waitForTimeout(100); ok(await p2.evaluate(() => __fl.ducks.length === 100), 'a 9 px finger jitter should still drop'); }
      await ctx.close();
    },
    'case files: generated per seed, crackable by the scripted detective, not by random hindcasts; runs score and climb': async ({ page, eq, ok }) => {
      await unlock(page);
      const r = await page.evaluate(() => { const X = __fl, o = {}; X.load(9);
        const a = X.genCase(77, 3), b = X.genCase(77, 3), c = X.genCase(78, 3); o.det = JSON.stringify([a.truth, a.windage, a.truthMonth]) === JSON.stringify([b.truth, b.windage, b.truthMonth]); o.differ = JSON.stringify(a.truth) !== JSON.stringify(c.truth);
        o.solved = [X.detective(a).solved, X.detective(c).solved];
        // random detectives: twelve hindcasts anywhere, random month and cargo
        let rs = 5, wins = 0; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
        for (const C of [a, c]) for (let k = 0; k < 4; k++) { let best = 99; for (let j = 0; j < C.budget; j++) { const sim = X.sightingsOf(X.hindcast(5 + rnd() * 45, -98 + rnd() * 88, 5, rnd() < .5 ? 6 : 22, 400, 7)).map(q => ({ ...q, t: q.t + Math.floor(rnd() * 12) / 12 })); best = Math.min(best, X.misfit(C.log, sim)); } if (best <= 3) wins++; }
        o.naive = wins;
        // play a run: the true answer solves case 1, scores, and the next file is harder
        X.load(10); X.startCaseFile(501, 1); const C1 = X.level.case; X.caseState.left = C1.budget; X.caseState.month = C1.truthMonth; X.caseState.wnd = C1.windage;
        X.dropAt(...C1.truth); for (let t = 0; t < 5; t += .05) X.step(.05); X.simT = 5; X.check();
        o.run = [X.run.n, X.run.score > 0, X.SAVE.runBest > 0, X.reportOn];
        document.getElementById('tnext').click(); o.next = [X.level.case.rung, X.level.case.seed, location.hash];
        return o; });
      ok(r.det && r.differ, 'deterministic per seed, different across seeds');
      eq(r.solved, [true, true]);
      ok(r.naive <= 1, 'random hindcasting cracked ' + r.naive + '/8');
      eq(r.run, [1, true, true, true]); eq(r.next, [2, 502, '#case=502-2']);
    },
    'globe view: + and − dolly, drag turns the globe, wheel zooms, reset returns to the voyage view': async ({ page, ok, near }) => {
      await page.evaluate(() => __fl.load(0)); await page.waitForTimeout(200);
      const home = await page.evaluate(() => __fl.camPos), d0 = await page.evaluate(() => __fl.camDist);
      await page.click('#vIn'); await page.waitForTimeout(900); const d1 = await page.evaluate(() => __fl.camDist); ok(d1 < d0 * .85, `zoomed in ${d0} → ${d1}`);
      await page.click('#vOut'); await page.click('#vOut'); await page.waitForTimeout(900); ok(await page.evaluate(() => __fl.camDist) > d1 * 1.4, 'zoomed out');
      const vp = page.viewportSize(); await page.mouse.move(vp.width / 2, vp.height / 2); await page.mouse.wheel(0, -400); await page.waitForTimeout(600);
      ok(await page.evaluate(() => __fl.camDist) < await page.evaluate(() => 9), 'wheel zoom stays in range');
      const before = await page.evaluate(() => __fl.camPos);
      await page.mouse.move(vp.width / 2, vp.height / 2); await page.mouse.down(); await page.mouse.move(vp.width / 2 + 160, vp.height / 2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(500);
      const after = await page.evaluate(() => __fl.camPos); ok(Math.hypot(after[0] - before[0], after[2] - before[2]) > .3, 'drag turned the view');
      await page.click('#vReset'); await page.waitForTimeout(1500);
      const back = await page.evaluate(() => __fl.camPos); for (let i = 0; i < 3; i++) near(back[i], home[i], .1, 'reset axis ' + i);
      ok((await page.evaluate(() => __fl.ducks.length)) === 0, 'view controls drop nothing');
    },
    'corrupted / odd saves load without errors': async ({ page, eq }) => {
      const u = page.url(); await page.goto('about:blank'); // stop the first globe rendering while the others load
      for (const [save, cur] of [['null', 0], ['{"done":{"0":1,"9":1,"x":1},"stars":"q","cards":7,"cur":3}', 1]]) {
        const p2 = await page.context().newPage(), errs = []; p2.on('pageerror', e => errs.push(e.message));
        await p2.goto(u); await p2.evaluate(s => localStorage.setItem('rh:floatees', s), save); await p2.reload(); await p2.waitForFunction(() => window.__fl, null, { timeout: 30000 });
        eq(errs, [], 'errors for ' + save); eq(await p2.evaluate(() => __fl.SAVE.cur), cur, 'voyage for ' + save);
        await p2.close();
      }
    },
    'no overflow or console errors at phone and desktop sizes': async ({ page, ok }) => {
      await unlock(page);
      for (const [w, h] of [[390, 844], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: h });
        for (const i of [0, 3, 6, 9]) { await page.evaluate(i => __fl.load(i), i); await page.waitForTimeout(120); }
        ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow at ' + w);
      }
    },
  },
};
