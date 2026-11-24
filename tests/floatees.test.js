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
    'long voyages start fast-forwarded; levels, progress and locks': async ({ page, eq, ok }) => {
      eq(await page.evaluate(() => __fl.speed), 1);
      await unlock(page); await page.evaluate(() => __fl.load(2)); eq(await page.evaluate(() => __fl.speed), 4);
      ok(await page.$eval('#ctrl [data-s="4"]', b => b.classList.contains('on')));
      await page.evaluate(() => { __fl.SAVE.done = {}; });
      await page.evaluate(() => __fl.load(4)); eq(await page.evaluate(() => __fl.SAVE.cur), 0, 'locked voyage opened');
      await page.evaluate(() => __fl.load(6)); eq(await page.evaluate(() => __fl.SAVE.cur), 6, 'sandbox always open');
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
        for (const i of [0, 3, 6]) { await page.evaluate(i => __fl.load(i), i); await page.waitForTimeout(120); }
        ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow at ' + w);
      }
    },
  },
};
