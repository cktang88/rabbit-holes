// Escapement: gear-train maths, every commission solvable, constraints, deliberate commit, saves.
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
// train(motorGear, [driven, driving], ..., lastDriven)
const T = (o, ...rest) => ({ ax: [{ o }, ...rest.map(r => Array.isArray(r) ? { i: r[0], o: r[1] } : { i: r, o: null })] });
const SOL = [
  T(20, 40), // Half Speed
  T(20, [20, null], 60), // Same Way Round (idler)
  T(8, [60, 10], 80), T(10, [30, 8], 32), T(10, [100, 10], [100, 10], [60, 10], 60), T(10, [10, null], 70), T(60, 10), T(10, [120, 8], 112),
  T(8, [40, 8], [40, 10], 40), T(8, [56, 8], [52, 10], 20), T(10, [90, 12], 72), T(10, [97, 10], 100), T(9, [81, 9], 45), T(8, [80, 9], [90, 10], 100),
  T(71, [113, 50], 10), T(14, [33, 19], [117, 29], 59), T(89, 55), T(17, [27, 43], 27), T(8, [44, 10], [89, 13], 97), T(9, [61, 11], [95, 31], 119),
  T(8, [60, 10], [80, 8], [60, 10], [80, 10], [30, 10], 40), // A Proper Clock
  T(10, [60, 10], [40, 10], 70), // Calendar
  T(10, [70, 12], [62, 109], 89), // Weeks and Moons
  T(9, [64, 19], [73, 9], [52, 51], 118), // Earth and Moon
  T(235, [19, 16], [223, 10], 160), // Antikythera
  T(10, [21, 10], [59, 10], [71, 29], [83, 93], [83, 19], [16, 43], [83, 15], [23, 75], 92), // Grand Orrery
];

module.exports = {
  page: 'escapement/index.html',
  ready: async page => { await page.waitForFunction(() => window.__esc); await closeModals(page); },
  tests: {
    'gear maths: meshes multiply, every mesh flips direction, idlers keep the ratio': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const E = window.__esc, c = { T: [{ n: 'x', r: [1, 2] }] }, a = d => E.analyse(c, d).axles.map(x => `${x.sign > 0 ? '+' : '-'}${x.p}/${x.q}`);
        return [a({ ax: [{ o: 20 }, { i: 40 }] }), a({ ax: [{ o: 20 }, { i: 33, o: null }, { i: 40 }] }), a({ ax: [{ o: 10 }, { i: 30, o: 12 }, { i: 48 }] })];
      });
      eq(r, [['+1/1', '-1/2'], ['+1/1', '-20/33', '+1/2'], ['+1/1', '-1/3', '+1/12']]);
    },
    'every commission: default train fails, the known train passes, a one-tooth slip fails': async ({ page, ok }) => {
      const bad = await page.evaluate(SOL => {
        const E = window.__esc, out = [];
        if (SOL.length !== E.C.length) return ['count ' + SOL.length + ' vs ' + E.C.length];
        E.C.forEach((c, i) => {
          if (E.analyse(c, { ax: [{ o: 20 }, { i: 20, o: null }] }).ok) out.push(i + ' solved at start');
          const r = E.analyse(c, SOL[i]); if (!r.ok) out.push(i + ' known train fails: ' + r.problems.join('/') + ' ' + JSON.stringify(r.T.map(t => [t.ok, t.err])));
          const slip = JSON.parse(JSON.stringify(SOL[i])); slip.ax[slip.ax.length - 1].i += 1;
          if (c.T.some(t => t.r) && E.analyse(c, slip).ok) out.push(i + ' slip passes');
        });
        return out;
      }, SOL);
      ok(!bad.length, bad.join('; '));
    },
    'workshop rules are enforced: tooth range, odd, distinct, spare-parts bin, gear limit, direction': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const E = window.__esc, C = E.C, by = n => C.find(c => c.n === n), p = (n, d) => E.analyse(by(n), d).problems.length > 0;
        return [
          p('Small Parts', { ax: [{ o: 10 }, { i: 100, o: 10 }, { i: 100 }] }),
          p('Odd Teeth', { ax: [{ o: 10 }, { i: 90, o: 10 }, { i: 50 }] }),
          p('No Two Alike', { ax: [{ o: 10 }, { i: 100, o: 10 }, { i: 100, o: 10 }, { i: 10 }] }),
          p('The Spare-Parts Bin', { ax: [{ o: 10 }, { i: 90, o: 10 }, { i: 60 }] }),
          p('The Spare-Parts Bin', { ax: [{ o: 11 }, { i: 90, o: 12 }, { i: 72 }] }),
          p('The Golden Gear', { ax: [{ o: 89 }, { i: 55, o: 10 }, { i: 10 }] }),
          E.analyse(by('Same Way Round'), { ax: [{ o: 20 }, { i: 60 }] }).ok, // right ratio, wrong direction
          p('Half Speed', { ax: [{ o: 7 }, { i: 14 }] }),
        ];
      });
      eq(r, [true, true, true, true, true, true, false, true]);
    },
    'regression: clicking a gear through the answer does not deliver; stopping on it does': async ({ page, ok }) => {
      await page.evaluate(() => window.__esc.open(0));
      const plus = page.locator('.ax[data-ax="1"] button[data-d="1"]'), minus = page.locator('.ax[data-ax="1"] button[data-d="-1"]');
      for (let n = 0; n < 25; n++) await plus.click({ delay: 0 }); // 20 -> 45, passing 40
      await page.waitForTimeout(1300);
      ok(!(await page.evaluate(() => window.__esc.S.done[0])), 'delivered by clicking through 40');
      for (let n = 0; n < 5; n++) await minus.click();
      ok(!(await page.evaluate(() => window.__esc.S.done[0])), 'delivered instantly');
      await page.waitForTimeout(1300);
      ok(await page.evaluate(() => !!window.__esc.S.done[0]), 'not delivered after stopping at 40');
    },
    'regression: typing through a working tooth count does not deliver': async ({ page, ok }) => {
      await page.evaluate(() => window.__esc.open(0));
      const inp = page.locator('.ax[data-ax="1"] input'); await inp.fill(''); await inp.type('405', { delay: 60 });
      await page.waitForTimeout(1300);
      ok(!(await page.evaluate(() => window.__esc.S.done[0])), 'typing 405 delivered at 40');
      await inp.fill('0'); await inp.dispatchEvent('change');
      ok(await inp.inputValue() === '405', 'invalid entry left a stale value on screen');
    },
    'leaving the commission during the settle window cancels delivery': async ({ page, ok }) => {
      await page.evaluate(() => { const E = window.__esc; E.open(0); E.design().ax[1].i = 40; E.update(); E.open(1); });
      await page.waitForTimeout(1300);
      ok(!(await page.evaluate(() => window.__esc.S.done[0])), 'delivered a commission that was left');
    },
    'acts unlock after 4; progress bounded; corrupt saves load': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const E = window.__esc, put = v => localStorage.setItem('rh:esc', typeof v === 'string' ? v : JSON.stringify(v)), out = {};
        for (let i = 0; i < 3; i++) E.S.done[i] = { stars: 3, gears: 2 }; out.a = E.actOpen(1); E.S.done[3] = { stars: 3, gears: 2 }; out.b = E.actOpen(1);
        put('x'); out.junk = Object.keys(E.loadState().done).length;
        put({ done: { 0: { stars: 9, gears: 2 }, 1: 5, 77: { stars: 3 } }, designs: { 0: { ax: [{ o: 20 }, { i: 1.5 }] }, 1: { ax: [{ o: 20 }, { i: 40 }] }, free: { ax: 'no' } }, cur: 99, freeX: 3 });
        const s = E.loadState(); out.s = [s.done, Object.keys(s.designs), s.cur, s.freeX];
        for (let i = 0; i < E.C.length; i++) E.S.done[i] = { stars: 3, gears: 2 }; E.open(0); out.hub = JSON.parse(localStorage.getItem('rh:hub')).escapement;
        return out;
      });
      eq([r.a, r.b], [false, true]); eq(r.junk, 0); eq(r.s, [{ 0: { stars: 3, gears: 2 } }, ['1'], 0, undefined]); eq(r.hub, 1);
    },
    'Act III twists: moon disc must be last, teeth budget, odd teeth for Venus, no Brocot table for the golden gear': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const E = window.__esc, by = n => E.C.find(c => c.n === n), pr = (n, d) => E.analyse(by(n), d).problems;
        return [
          pr('Moon Phase', { ax: [{ o: 8 }, { i: 59, o: 8 }, { i: 32 }] }).some(p => /59-tooth disc/.test(p)),   // 59 in the wrong place
          pr('Moon Phase', { ax: [{ o: 14 }, { i: 33, o: 19 }, { i: 117, o: 29 }, { i: 59 }] }).length,
          pr('Sidereal Time', { ax: [{ o: 51 }, { i: 41, o: 79 }, { i: 98 }] }).some(p => /budget 120/.test(p)), // Brocot-sized gears blow the budget
          pr('Venus', { ax: [{ o: 8 }, { i: 52, o: 11 }, { i: 85, o: 19 }, { i: 85 }] }).some(p => /even/.test(p)),
          !!by('The Golden Gear').brocot, E.C.filter(c => c.a === 2).length, E.C.some(c => /Root Two|Euler/.test(c.n)),
        ];
      });
      eq(r, [true, 0, true, true, false, 6, false]);
    },
    'v1 saves map onto the trimmed commission list': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const E = window.__esc; localStorage.setItem('rh:esc', JSON.stringify({ done: { 0: { stars: 3, gears: 2 }, 19: { stars: 2, gears: 2 }, 21: { stars: 1, gears: 6 }, 27: { stars: 3, gears: 18 } }, designs: { 21: { ax: [{ o: 10 }, { i: 20 }] }, free: { ax: [{ o: 9 }, { i: 18 }] } }, cur: 27 }));
        const s = E.loadState(); return [Object.keys(s.done), Object.keys(s.designs).sort(), s.cur, s.v, E.C[19].n, E.C[25].n];
      });
      eq(r, [['0', '19', '25'], ['19', 'free'], 25, 2, 'Venus', 'Grand Orrery']);
    },
    'delivery shows the swinging ticket': async ({ page, ok }) => {
      await page.evaluate(() => { const E = window.__esc; E.open(0); E.design().ax[1].i = 40; E.update(); });
      await page.waitForTimeout(1400);
      ok(await page.locator('.modal .tag').count() === 1, 'no Delivered ticket');
      ok(await page.evaluate(() => document.getElementById('cv').classList.contains('zoom')), 'no loupe zoom');
    },
    'locked commissions cannot be opened from the sidebar': async ({ page, eq }) => {
      await page.click('.cm[data-i="9"]'); eq(await page.evaluate(() => window.__esc.cur), 0);
    },
    'free workshop accepts fractions and ignores junk': async ({ page, ok }) => {
      await page.evaluate(() => window.__esc.open('free'));
      for (const v of ['1/0', 'abc', '-3', '', '355/113']) await page.fill('#freeX', v);
      const x = await page.evaluate(() => document.querySelector('#tgt td.mono').textContent);
      ok(x.startsWith('3.14159292'), 'target ' + x);
    },
    'phone layout: no horizontal scroll': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
      for (const i of [0, 14, 25]) { await page.evaluate(i => { const E = window.__esc; for (let j = 0; j < 26; j++) E.S.done[j] = { stars: 3, gears: 2 }; E.open(i); }, i);
        ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 392, 'overflow on ' + i); }
    },
    'motion work: the hour hand is coaxial, so both meshes need equal tooth sums': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const E = window.__esc, c = E.C.find(c => c.n === 'The Hour Hand'), a = d => { const x = E.analyse(c, d); return [x.ok, x.problems.some(p => /centre distances/.test(p))]; };
        return [a({ ax: [{ o: 12 }, { i: 36, o: 8 }, { i: 32 }] }), a({ ax: [{ o: 10 }, { i: 30, o: 8 }, { i: 32 }] }), a({ ax: [{ o: 10 }, { i: 120 }] })[0]]; });
      eq(r, [[false, true], [true, false], false]);
    },
    'error is shown as drift on the sky': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const E = window.__esc, D = 86400; return [E.drift(100, 29.53 * D), E.drift(1, 365 * D), E.drift(1000, 1), E.drift(0, D)]; });
      eq(r, ['a day out every 27.4 years', 'a day out every 2,738 years', '86 s a day off', 'never drifts']);
    },
    'Brocot\'s table is earned: walk the tree by hand until the Pi Wheel is delivered': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const E = window.__esc; for (let i = 0; i < 14; i++) E.S.done[i] = { stars: 3, gears: 2 }; E.open(14); });
      ok(await page.locator('#wOut').count() === 1 && await page.locator('#bOut').count() === 0, 'table handed over before it was earned');
      // walk towards pi: 1/1 below, 2/1 below, 3/1 below, 4/1 above, 7/2 above, 10/3 above, 13/4 above ... 22/7 eventually
      const steps = [true, true, true, false, false, false, false, false, false, false];
      for (const up of steps) await page.click(up ? '#wHi' : '#wLo');
      const hist = await page.$$eval('#wOut .bt td.l:first-child', t => t.map(x => x.textContent));
      ok(hist.includes('22/7'), 'walk did not reach 22/7: ' + hist);
      await page.click('#wHi'); // wrong direction does not advance
      await page.evaluate(() => { const E = window.__esc; E.S.done[14] = { stars: 1, gears: 4 }; E.open(15); });
      ok(await page.locator('#bOut').count() === 1, 'table not unlocked after the Pi Wheel');
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      const r = await page.evaluate(SOL => {
        const E = window.__esc, C = E.C, late = C.map((c, i) => i).filter(i => i >= 17);
        let sd = 5; const R = () => (sd = (sd * 1103515245 + 12345) % 2147483648) / 2147483648;
        const stars = (c, d) => { const a = E.analyse(c, d); return a.ok ? a.stars : 0; };
        const ratioOf = t => t.r ? t.r[0] / t.r[1] : t.x;
        const segs = c => c.T.map((t, j) => ratioOf(t) / (j ? ratioOf(c.T[j - 1]) : 1));
        const ok = (c, g) => g >= (c.tmin || 8) && g <= (c.tmax || 120) && (!c.odd || g % 2) && (!c.inv || c.inv.includes(g));
        const split = (c, n, m) => { if (m === 1) return ok(c, n) ? [n] : null; for (let a = c.tmin || 8; a <= (c.tmax || 120); a++) if (n % a === 0 && ok(c, a)) { const r = split(c, n / a, m - 1); if (r) return [a, ...r]; } return null; };
        const build = segsPQ => { const ax = [{ o: null }]; const drivers = [], driven = []; segsPQ.forEach(([ps, qs]) => { drivers.push(...ps); driven.push(...qs); });
          ax[0].o = drivers[0]; for (let k = 0; k < driven.length; k++) ax.push({ i: driven[k], o: drivers[k + 1] ?? null }); return { ax }; };
        // fractions a careful player reads off Brocot's table (the Stern–Brocot path), best first, that split into 2 gears each side
        const brocot = (c, x) => { let a = [0, 1], b = [1, 0]; const out = []; for (let it = 0; it < 3000; it++) { const m = [a[0] + b[0], a[1] + b[1]]; if (m[0] > 20000 || m[1] > 20000) break; out.push(m); const v = m[0] / m[1]; if (v < x) a = m; else if (v > x) b = m; else break; }
          for (const m of [2, 3]) for (const [p, q] of out.slice().reverse()) { if (Math.abs(p / q / x - 1) * 1e6 > 1000) continue;
            for (let k = 1; k <= 64; k++) { const P = p * k, Q = q * k, ps = split(c, P, m), qs = split(c, Q, m); if (ps && qs && (!c.budget || [...ps, ...qs].reduce((a, b) => a + b, 0) <= c.budget)) return [ps, qs]; } } return null; };
        const runs = [], competent = [], solver = [];
        for (const i of late) { const c = C[i];
          runs.push(stars(c, { ax: [{ o: 20 }, { i: 20, o: null }] }));                                                      // idle
          for (let k = 0; k < 4; k++) { let best = 0; for (let t = 0; t < 300; t++) { const n = 2 + Math.floor(R() * 6), g = () => 8 + Math.floor(R() * 113);  // random trains
            const ax = [{ o: g() }]; for (let a = 1; a < n; a++) ax.push({ i: g(), o: a < n - 1 ? g() : null }); best = Math.max(best, stars(c, { ax })); } runs.push(best); }
          { const pq = segs(c).map(x => { let best = null; for (let p = 8; p <= 120; p++) { const q = Math.round(p / x); if (q >= 8 && q <= 120 && ok(c, p) && ok(c, q) && (!best || Math.abs(p / q / x - 1) < Math.abs(best[0][0] / best[1][0] / x - 1))) best = [[p], [q]]; } return best; }); // one mesh per hand
            runs.push(pq.every(Boolean) ? stars(c, build(pq)) : 0); }
          const pq = segs(c).map(x => brocot(c, x)); competent.push(pq.every(Boolean) ? stars(c, build(pq)) : 0);
          solver.push(stars(c, SOL[i]));
        }
        return { naive: runs, competent, solver };
      }, SOL);
      const lowRate = r.naive.filter(x => x <= 1).length / r.naive.length;
      ok(lowRate >= .8, 'naive policies scored above 1 star too often: ' + JSON.stringify(r.naive));
      ok(r.competent.filter(x => x >= 1).length >= r.competent.length - 1, 'Brocot-table policy failed late commissions: ' + r.competent);
      ok(r.competent.filter(x => x === 3).length < r.solver.filter(x => x === 3).length, `3 stars should need better than the first Brocot fraction: competent ${r.competent}, solver ${r.solver}`);
    },
    'phone: level list is a drawer behind a labelled button; picking a level closes it': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
      const off = await page.evaluate(() => document.getElementById('side').getBoundingClientRect().right <= 0);
      ok(off, 'list visible without opening the drawer');
      ok(await page.isVisible('#lvlBtn'), 'no drawer button');
      await page.click('#lvlBtn'); await page.waitForTimeout(300);
      ok(await page.evaluate(() => document.body.classList.contains('drawer') && document.getElementById('side').getBoundingClientRect().left >= 0), 'drawer did not open');
      await page.click('#side .cm:not(.locked) >> nth=1'); await page.waitForTimeout(300);
      ok(!(await page.evaluate(() => document.body.classList.contains('drawer'))), 'drawer stayed open');
      await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(150);
      ok(!(await page.isVisible('#lvlBtn')), 'drawer button on desktop');
    },
    'the Guild: commissions are deterministic per seed and every one has a healthy field of working designs': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const E = __esc, out = [];
        const same = JSON.stringify(E.guildDef('s1', 5)) === JSON.stringify(E.guildDef('s1', 5)) && JSON.stringify(E.guildPop(E.guildDef('s1', 5))) === JSON.stringify(E.guildPop(E.guildDef('s1', 5)));
        const differ = JSON.stringify(E.guildDef('s1', 5)) !== JSON.stringify(E.guildDef('s2', 5));
        for (let lv = 1; lv <= 14; lv++) for (const sd of ['a', 'b', 'daily:2026-12-01']) { const d = E.guildDef(sd, lv), pop = E.guildPop(d);
          if (pop.length < 30) out.push(`${sd}:${lv} only ${pop.length} designs`);
          for (const m of pop.slice(0, 5)) { const R = E.analyse(d, E.gToAx(m.ax)); if (!R.ok) out.push(`${sd}:${lv} a member's design fails: ${R.problems}`); } }
        return { same, differ, out }; });
      ok(r.same && r.differ, 'not deterministic per seed'); ok(!r.out.length, r.out.slice(0, 6).join('; '));
    },
    'the Guild: naive trains rank low; a competent Brocot-style train beats 90% on error': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const E = __esc, res = [];
        for (const sd of ['n1', 'n2', 'n3', 'n4', 'n5', 'n6']) { const d = E.guildDef(sd, 1 + (sd.charCodeAt(1) % 8)), pop = E.guildPop(d), es = pop.map(x => x.e), r = RH.rng('naive:' + sd);
          // naive: random gears, nudged one tooth at a time until the train first passes, then stop
          let naive = null; for (let t = 0; t < 400 && !naive; t++) { const g = E.gClimb(d, r, E.kMin(d), 0, 0, false); const m = E.gEval(d, g); if (m.ok && m.e <= E.G_TOL) naive = m; }
          if (!naive) { const g = E.gClimb(d, r, E.kMin(d), 60, 0, false); naive = E.gEval(d, g); }
          const M = E.guildMaster(d); res.push({ naive: naive.e <= E.G_TOL ? E.beats(naive.e, es) : 0, comp: E.beats(M.e, es) }); }
        return res; });
      const avg = k => r.reduce((a, x) => a + x[k], 0) / r.length;
      ok(avg('naive') < .5, 'a first-passing train should rank in the bottom half on error: ' + avg('naive'));
      ok(r.every(x => x.comp >= .9), 'the master should beat 90% on error: ' + r.map(x => x.comp.toFixed(2)));
    },
    'the Guild through the UI: deliver, see your rank, earn marks, next commission, today\'s commission, share link': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const E = __esc; for (let i = 0; i < 4; i++) E.S.done[i] = { stars: 3, gears: 2 }; E.guildSet('ui', 2, false); E.open('guild'); });
      ok(await page.evaluate(() => document.getElementById('gNext').disabled), 'next commission open before delivering');
      await page.evaluate(() => { const E = __esc, M = E.guildMaster(E.GUILD); E.S.designs.guild = E.gToAx(M.ax); E.render(); });
      await page.waitForTimeout(1300);
      const r = await page.evaluate(() => { const E = __esc, b = E.S.guild.best['ui:2']; return { b, n: E.S.guild.n, next: document.getElementById('gNext').disabled, hist: document.querySelectorAll('#guildBox svg').length, txt: document.getElementById('hn-e').textContent }; });
      ok(r.b && r.b.m >= 1 && r.n === 1 && !r.next && r.hist === 3 && /better than/.test(r.txt), 'delivery not ranked: ' + JSON.stringify(r));
      await page.click('#gNext'); eq(await page.evaluate(() => [__esc.S.guild.level, __esc.S.guild.lv, __esc.S.designs.guild.ax.length]), [3, 3, 2]);
      await page.click('#gDaily'); ok(await page.evaluate(() => __esc.S.guild.seed === 'daily:' + __esc.todayStr() && __esc.S.guild.daily === 1), 'daily commission');
      await page.click('#gShare'); const h = await page.evaluate(() => location.hash); ok(h.startsWith('#guild='), 'no share link');
      await page.goto('about:blank'); await page.goto('http://localhost:8765/escapement/index.html' + h); await page.waitForFunction(() => window.__esc); await closeModals(page);
      ok(await page.evaluate(() => __esc.cur === 'guild' && __esc.S.guild.seed.startsWith('daily:')), 'link did not open the commission');
      ok(await page.evaluate(() => localStorage.getItem('rh:esc').length) < 50000, 'save too large');
    },
    'pan and zoom: tapping a gear when zoomed selects the gear under the finger; a pinch never selects; the wheel zooms about the cursor': async ({ page, ok, near }) => {
      await page.evaluate(() => { __esc.open(4); }); await page.waitForTimeout(400);
      const b = await page.locator('#cv').boundingBox(), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const w0 = await page.evaluate(([x, y]) => __esc.cam.toWorld(x, y), [cx, cy]); await page.mouse.move(cx, cy); await page.mouse.wheel(0, -500); await page.waitForTimeout(150);
      const w1 = await page.evaluate(([x, y]) => [__esc.cam.k, ...__esc.cam.toWorld(x, y)], [cx, cy]); ok(w1[0] > 1.5, 'wheel did not zoom'); near(w1[1], w0[0], .5); near(w1[2], w0[1], .5);
      // tap the gear of the last axle on screen, wherever zoom has put it
      const tgt = await page.evaluate(() => { const h = __esc.gearHits.at(-1), [x, y] = __esc.cam.toScreen(h.x, h.y), r = document.getElementById('cv').getBoundingClientRect(); return { k: h.k, x, y, inside: x > r.left && x < r.right && y > r.top && y < r.bottom }; });
      if (!tgt.inside) await page.evaluate(() => __esc.cam.fit());
      const t2 = await page.evaluate(() => { const h = __esc.gearHits.at(-1), [x, y] = __esc.cam.toScreen(h.x, h.y); return { k: h.k, x, y }; });
      await page.mouse.click(t2.x, t2.y); await page.waitForTimeout(100);
      ok(await page.evaluate(k => __esc.selectedAxle === k && document.querySelector(`.ax[data-ax="${k}"]`).classList.contains('flash'), t2.k), 'tap did not select the gear under the finger');
      const sel = await page.evaluate(([x, y]) => { const el = document.getElementById('cv'), ev = (t, id, px) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: px, clientY: y, bubbles: true, pointerType: 'touch' }));
        window.__esc_sel0 = __esc.selectedAxle; const k0 = __esc.cam.k; ev('pointerdown', 11, x - 15); ev('pointerdown', 12, x + 15); ev('pointermove', 11, x - 35); ev('pointermove', 12, x + 35); ev('pointerup', 11, x - 35); ev('pointerup', 12, x + 35);
        el.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true })); return { ratio: __esc.cam.k / k0, same: __esc.selectedAxle === window.__esc_sel0 }; }, [b.x + 30, b.y + 30]);
      ok(sel.ratio > 1.3, 'pinch did not zoom: ' + sel.ratio); ok(sel.same, 'a pinch acted as a tap');
    },
  },
};
