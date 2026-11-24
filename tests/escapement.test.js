// Escapement: gear-train maths, every commission solvable, constraints, deliberate commit, saves.
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
// train(motorGear, [driven, driving], ..., lastDriven)
const T = (o, ...rest) => ({ ax: [{ o }, ...rest.map(r => Array.isArray(r) ? { i: r[0], o: r[1] } : { i: r, o: null })] });
const SOL = [
  T(20, 40), // Half Speed
  T(20, [20, null], 60), // Same Way Round (idler)
  T(8, [60, 10], 80), T(10, [30, 10], 40), T(10, [100, 10], [100, 10], [60, 10], 60), T(10, [10, null], 70), T(60, 10), T(10, [120, 8], 112),
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
  },
};
