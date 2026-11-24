// Polarizer: quantum optics on a grid. Physics checked against analytic results; every level solvable,
// unsolved at start, and wins need a deliberate (held) setting, not a sweep past the answer.
const URL_ = 'polarizer/index.html';
// known solutions: [type, x, y, angle, mirrorOrientation]
const SOL = [
  [['pol', 7, 4, 45]],
  [['pol', 3, 4, 15], ['pol', 5, 4, 30], ['pol', 7, 4, 45], ['pol', 9, 4, 60], ['pol', 11, 4, 75]],
  [['hwp', 6, 4, 45]],
  [['pbs', 7, 4, 0, 1]],
  [['phase', 6, 2, 180]],
  [['hwp', 6, 2, 45]],
  [['pol', 11, 6, 45], ['pol', 10, 7, 45]],
  [['bomb', 6, 2, 0]],
];
const sim = (page, lvIdx, parts, patch) => page.evaluate(([i, parts, patch]) => {
  const X = window.__pz, lv = Object.assign({}, X.LV[i], patch || {});
  const P = parts.map(([t, x, y, a = 0, m = 1]) => ({ t, x, y, a, m }));
  const h = X.simulate(lv, P).hits, out = {}; for (const k in h) out[k] = h[k].p; return out;
}, [lvIdx, parts, patch]);
// a bare test bench: source at (1,4) polarised at `pol`, detector at (13,4)
const bench = (page, pol, parts) => sim(page, 0, parts, { sources: [{ x: 1, y: 4, d: 0, pol }], fixed: [{ t: 'det', x: 13, y: 4, id: 'D' }] });
const sel = async (page, part) => page.evaluate(p => { const X = window.__pz; X.select(X.parts.find(q => q.x === p[1] && q.y === p[2])); }, part);
const sliderAt = async (page, frac) => { const b = await page.locator('#selR').boundingBox(); return [b.x + 8 + (b.width - 16) * frac, b.y + b.height / 2]; };
const openWith = async (page, save) => { // a second page in the same context: the harness only clears storage on the first
  const p2 = await page.context().newPage(), errs = []; p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(page.url()); await p2.evaluate(s => localStorage.setItem('rh:polarizer', s), save); await p2.reload(); await p2.waitForTimeout(300);
  return { p2, errs };
};

module.exports = {
  page: URL_,
  tests: {
    "Malus's law: one polariser passes cos²θ": async ({ page, near }) => {
      for (const th of [0, 15, 30, 45, 60, 75, 90, 120, 180]) {
        const h = await bench(page, 0, [['pol', 6, 4, th]]);
        near(h.D || 0, Math.cos(th * Math.PI / 180) ** 2, 1e-9, `θ=${th}`);
      }
      // and relative to the source's own angle
      near((await bench(page, 30, [['pol', 6, 4, 75]])).D, Math.cos(45 * Math.PI / 180) ** 2, 1e-9);
    },
    'three polarisers: 0°, 45°, 90° pass 1/4 of polarised and 1/8 of unpolarised light': async ({ page, near }) => {
      const parts = [['pol', 3, 4, 0], ['pol', 6, 4, 45], ['pol', 9, 4, 90]];
      const H = (await bench(page, 0, parts)).D || 0, V = (await bench(page, 90, parts)).D || 0;
      near(H, 1 / 4, 1e-9, 'H light: 1 · cos²45 · cos²45');
      near(V, 0, 1e-12, 'V light is stopped by the 0° filter');
      near((H + V) / 2, 1 / 8, 1e-9, 'unpolarised = incoherent 50:50 mix of H and V');
      near((await bench(page, 0, [['pol', 3, 4, 0], ['pol', 9, 4, 90]])).D || 0, 0, 1e-12, 'crossed filters block all');
      // N filters stepping 90°/N: cos²(90/N)^N → 1
      let prev = -1; for (const N of [1, 2, 3, 5, 9]) { const ps = []; for (let k = 1; k <= N; k++) ps.push(['pol', 1 + k, 4, 90 * k / N]); const p = (await bench(page, 0, ps)).D || 0; near(p, Math.cos(Math.PI / 2 / N) ** (2 * N), 1e-9, 'N=' + N); near(p > prev ? 1 : 0, 1, 0); prev = p; }
    },
    'half-wave plate rotates polarisation by 2θ and absorbs nothing': async ({ page, near }) => {
      for (const th of [0, 10, 22.5, 45, 70]) {
        const h = await bench(page, 0, [['hwp', 4, 4, th], ['pol', 8, 4, 2 * th]]);
        near(h.D, 1, 1e-9, `θ=${th}`);
        near((await bench(page, 0, [['hwp', 4, 4, th]])).D, 1, 1e-9);
      }
    },
    'Mach–Zehnder: all to D1, phase φ sends sin²(φ/2) to D2, probability conserved': async ({ page, near }) => {
      for (const ph of [0, 45, 90, 135, 180, 270, 360]) {
        const h = await sim(page, 4, [['phase', 6, 2, ph]]);
        near(h.D2 || 0, Math.sin(ph * Math.PI / 360) ** 2, 1e-9, `φ=${ph}`);
        near((h.D1 || 0) + (h.D2 || 0), 1, 1e-9);
      }
      // the phase plate works in either arm (with the sign of the phase flipped)
      near((await sim(page, 4, [['phase', 3, 4, 180]])).D2, 1, 1e-9);
    },
    'which-path label kills interference; diagonal filters erase it': async ({ page, near }) => {
      const h = await sim(page, 5, [['hwp', 6, 2, 45]]); near(h.D1, .5, 1e-9); near(h.D2, .5, 1e-9);
      const e = await sim(page, 6, []); near(e.D1, .5, 1e-9); near(e.D2, .5, 1e-9);
      const er = await sim(page, 6, [['pol', 11, 6, 45], ['pol', 10, 7, 45]]); near(er.D2, 0, 1e-9); near(er.D1, .5, 1e-9);
    },
    'Elitzur–Vaidman bomb tester: 1/4 detect, 1/4 D1, 1/2 explode (either arm)': async ({ page, near }) => {
      for (const at of [[6, 2], [3, 4], [7, 6]]) {
        const h = await sim(page, 7, [['bomb', ...at, 0]]);
        const boom = Object.entries(h).filter(([k]) => k !== 'D1' && k !== 'D2').reduce((a, [, v]) => a + v, 0);
        near(h.D2, .25, 1e-9, 'D2 (bomb detected unexploded) ' + at); near(h.D1, .25, 1e-9); near(boom, .5, 1e-9);
      }
    },
    'every level: unsolved at start, solved by its known solution, wrong answers fail': async ({ page, ok }) => {
      const res = await page.evaluate(SOL => {
        const X = window.__pz, out = [];
        const H = (i, parts) => { const h = X.simulate(X.LV[i], parts.map(([t, x, y, a = 0, m = 1]) => ({ t, x, y, a, m }))).hits, o = {}; for (const k in h) o[k] = h[k].p; return o; };
        X.LV.forEach((lv, i) => {
          if (lv.free) return;
          const atStart = lv.test(H(i, []), {}), sol = SOL[i];
          let solved;
          if (lv.boomBudget) { const h = H(i, sol); solved = h.D2 > .2; } // the bomb level is won by firing; checked below
          else solved = lv.test(H(i, sol), {});
          // wrong: every angle in the solution turned to 0 (a freshly placed part)
          const wrong = lv.boomBudget ? false : lv.test(H(i, sol.map(([t, x, y, a, m]) => t === 'pbs' ? [t, x, y, 0, 0] : [t, x, y, t === 'phase' ? 90 : 0, m])), {}); // fresh angles / flipped splitter
          // tray limits respected
          const counts = {}; for (const [t] of sol) counts[t] = (counts[t] || 0) + 1;
          const fits = Object.entries(counts).every(([t, n]) => (lv.tray[t] || 0) >= n);
          out.push([i, atStart, solved, wrong, fits]);
        });
        return out;
      }, SOL);
      for (const [i, atStart, solved, wrong, fits] of res) { ok(!atStart, `level ${i} solved at start`); ok(solved, `level ${i} not solved by known solution`); ok(!wrong, `level ${i} solved by default angles`); ok(fits, `level ${i} solution exceeds tray`); }
      ok(res.length === 8);
    },
    'staircase: 4 filters at 5° steps cannot reach 60%, 5 can': async ({ page, ok }) => {
      const four = await sim(page, 1, [['pol', 3, 4, 20], ['pol', 5, 4, 35], ['pol', 7, 4, 55], ['pol', 9, 4, 70]]);
      ok(four.D < .6, 'four filters ' + four.D);
      const five = await sim(page, 1, SOL[1]); ok(five.D >= .6, 'five ' + five.D);
    },
    'sweeping the slider past the answer does not win; holding it does': async ({ page, ok, eq }) => {
      await page.evaluate(() => __pz.load(0));
      await page.evaluate(() => __pz.addPart('pol', 7, 4, 0)); await sel(page, ['pol', 7, 4]);
      eq(await page.evaluate(() => __pz.won), false);
      // drag right through 45° to 180° in one go and let go
      let [x0, y] = await sliderAt(page, 0), [x1] = await sliderAt(page, 1);
      await page.mouse.move(x0, y); await page.mouse.down();
      for (let k = 1; k <= 20; k++) { await page.mouse.move(x0 + (x1 - x0) * k / 20, y); await page.waitForTimeout(40); }
      await page.mouse.up(); await page.waitForTimeout(1500);
      eq(await page.evaluate(() => __pz.won), false, 'won by sweeping');
      // drag to 45° and keep holding the mouse: still not won
      let [xm] = await sliderAt(page, .25);
      await page.mouse.move(x1, y); await page.mouse.down(); await page.mouse.move(xm, y, { steps: 5 });
      for (let k = 0; k < 30; k++) { const a = await page.evaluate(() => __pz.parts[0].a); if (a === 45) break; xm += a > 45 ? -1 : 1; await page.mouse.move(xm, y); }
      ok(await page.evaluate(() => __pz.parts[0].a === 45), 'slider at 45');
      ok(await page.evaluate(() => __pz.holding), 'hold hint shown');
      await page.waitForTimeout(1500);
      eq(await page.evaluate(() => __pz.won), false, 'won while slider still held');
      await page.mouse.up(); await page.waitForTimeout(500);
      eq(await page.evaluate(() => __pz.won), false, 'won before settling');
      await page.waitForTimeout(800);
      eq(await page.evaluate(() => __pz.won), true, 'held setting should win');
      ok(await page.$eval('#goal', e => e.className === 'ok'), 'goal marked done, hold hint gone');
    },
    'arrow keys stepping past the answer do not win': async ({ page, eq }) => {
      await page.evaluate(() => __pz.load(0));
      await page.evaluate(() => __pz.addPart('pol', 7, 4, 0)); await sel(page, ['pol', 7, 4]);
      await page.locator('#cv').focus().catch(() => {}); await page.evaluate(() => document.activeElement && document.activeElement.blur());
      for (let k = 0; k < 18; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60); }
      eq(await page.evaluate(() => __pz.parts[0].a), 90);
      await page.waitForTimeout(1300); eq(await page.evaluate(() => __pz.won), false);
      for (let k = 0; k < 9; k++) await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(1300); eq(await page.evaluate(() => __pz.won), true);
    },
    'Mach–Zehnder phase dial swept 0→360 does not win': async ({ page, eq }) => {
      await page.evaluate(() => { __pz.load(0); }); // locked levels are refused
      eq(await page.evaluate(() => __pz.LV.indexOf(__pz.LV.find(l => l.n === document.getElementById('title').textContent))), 0);
      await page.evaluate(() => { const S = __pz.SAVE; for (let i = 0; i < 4; i++) S.done[i] = 1; __pz.load(4); __pz.addPart('phase', 6, 2, 90); });
      await sel(page, ['phase', 6, 2]);
      for (let a = 90; a <= 360; a += 5) await page.evaluate(a => __pz.setAngleUI(a), a);
      await page.waitForTimeout(1300); eq(await page.evaluate(() => __pz.won), false);
      await page.evaluate(() => __pz.setAngleUI(180)); await page.waitForTimeout(1300); eq(await page.evaluate(() => __pz.won), true);
    },
    'removing a part re-checks; level change cancels a pending hold': async ({ page, eq }) => {
      await page.evaluate(() => { __pz.load(0); __pz.addPart('pol', 7, 4, 0); __pz.select(__pz.parts[0]); __pz.setAngleUI(45); });
      eq(await page.evaluate(() => __pz.holding), true);
      await page.evaluate(() => __pz.load(0)); await page.waitForTimeout(1300);
      eq(await page.evaluate(() => __pz.won), false, 'stale hold won the reloaded level');
      eq(await page.$eval('#goal', e => e.classList.contains('hold')), false);
    },
    'bomb tester: 10 detections win with stars, 40 explosions reset the lab': async ({ page, eq, ok }) => {
      await page.evaluate(() => { const S = __pz.SAVE; for (let i = 0; i < 7; i++) S.done[i] = 1; __pz.load(7); __pz.addPart('bomb', 6, 2); });
      const pick = async key => page.evaluate(key => { // force Math.random so the outcome is `key`
        const e = Object.entries(__pz.hits()); let c = 0; for (const [k, v] of e) { if (k === key) { const r = c + v.p / 2; Math.random = () => r; return; } c += v.p; }
      }, key);
      const boomKey = await page.evaluate(() => Object.keys(__pz.hits()).find(k => k !== 'D1' && k !== 'D2'));
      await pick(boomKey); await page.evaluate(() => __pz.fire(40)); await page.waitForTimeout(40 * 90 + 1200);
      eq(await page.evaluate(() => __pz.won), false);
      eq(await page.evaluate(() => __pz.fires.boom || 0), 0, 'counters reset after 40 explosions');
      ok(await page.$eval('#toast', t => /destroyed/i.test(t.textContent)));
      await pick('D2'); await page.evaluate(() => __pz.fire(10)); await page.waitForTimeout(10 * 90 + 1200);
      eq(await page.evaluate(() => __pz.won), true);
      eq(await page.evaluate(() => __pz.SAVE.stars[7]), 3);
    },
    'deleting the bomb mid-volley stops further explosions': async ({ page, eq }) => {
      await page.evaluate(() => { const S = __pz.SAVE; for (let i = 0; i < 7; i++) S.done[i] = 1; __pz.load(7); __pz.addPart('bomb', 6, 2); });
      await page.evaluate(() => { const e = Object.entries(__pz.hits()); let c = 0; for (const [k, v] of e) { if (k !== 'D1' && k !== 'D2') { const r = c + v.p / 2; Math.random = () => r; } c += v.p; } __pz.fire(20); });
      await page.waitForTimeout(200);
      await page.evaluate(() => { __pz.select(__pz.parts[0]); document.getElementById('selDel').click(); });
      await page.waitForTimeout(20 * 90 + 1200);
      const booms = await page.evaluate(() => __pz.fires.boom || 0);
      eq(booms <= 3, true, 'bombs kept exploding after removal: ' + booms);
    },
    'tactile bench: drag an optic from the drawer onto a hole, twist it by its ring, hold to win': async ({ page, ok, eq }) => {
      await page.evaluate(() => __pz.load(0));
      const tray = await page.locator('#tray [data-t="pol"]').boundingBox();
      const [hx, hy, c] = await page.evaluate(() => __pz.screenOf(7, 4));
      await page.mouse.move(tray.x + tray.width / 2, tray.y + tray.height / 2); await page.mouse.down();
      await page.mouse.move(hx, hy, { steps: 12 }); await page.mouse.up();
      eq(await page.evaluate(() => __pz.parts.map(p => [p.t, p.x, p.y, p.a])), [['pol', 7, 4, 0]], 'dropped into the hole');
      eq(await page.$eval('#tray [data-t="pol"] i', e => e.textContent), '0', 'drawer count');
      // grab the ring at 3 o'clock and turn it anticlockwise by 45°
      const r = c * .38;
      await page.mouse.move(hx + r, hy); await page.mouse.down();
      for (let k = 1; k <= 9; k++) { const a = k / 9 * Math.PI / 4; await page.mouse.move(hx + r * Math.cos(a), hy - r * Math.sin(a)); }
      eq(await page.evaluate(() => __pz.parts[0].a), 45, 'twisted to 45');
      await page.waitForTimeout(1300); eq(await page.evaluate(() => __pz.won), false, 'won while still gripping the ring');
      await page.mouse.up(); await page.waitForTimeout(1300);
      eq(await page.evaluate(() => __pz.won), true, 'released at 45 and held');
      ok(await page.evaluate(() => __pz.celeb > 0), 'signature light pulse started');
    },
    'twisting the ring past the answer and on does not win': async ({ page, eq }) => {
      await page.evaluate(() => { __pz.load(0); __pz.addPart('pol', 7, 4, 0); });
      const [hx, hy, c] = await page.evaluate(() => __pz.screenOf(7, 4)), r = c * .38;
      await page.mouse.move(hx + r, hy); await page.mouse.down();
      for (let k = 1; k <= 18; k++) { const a = k / 18 * Math.PI / 2; await page.mouse.move(hx + r * Math.cos(a), hy - r * Math.sin(a)); await page.waitForTimeout(30); }
      await page.mouse.up(); await page.waitForTimeout(1400);
      eq(await page.evaluate(() => __pz.parts[0].a), 90); eq(await page.evaluate(() => __pz.won), false);
    },
    'carry a mount to another hole, tap a mirror twice to flip it, drag off the board to remove': async ({ page, eq }) => {
      await page.evaluate(() => { const S = __pz.SAVE; for (let i = 0; i < 8; i++) S.done[i] = 1; __pz.load(8); __pz.addPart('mirror', 5, 4, 0, 1); __pz.addPart('pol', 3, 4, 30); });
      let [hx, hy] = await page.evaluate(() => __pz.screenOf(3, 4)); const [tx, ty] = await page.evaluate(() => __pz.screenOf(3, 6));
      await page.mouse.move(hx, hy); await page.mouse.down(); await page.mouse.move(tx, ty, { steps: 8 }); await page.mouse.up();
      eq(await page.evaluate(() => { const p = __pz.parts.find(p => p.t === 'pol'); return [p.x, p.y, p.a]; }), [3, 6, 30]);
      // can't drop onto an occupied hole
      [hx, hy] = await page.evaluate(() => __pz.screenOf(3, 6)); const [mx, my] = await page.evaluate(() => __pz.screenOf(5, 4));
      await page.mouse.move(hx, hy); await page.mouse.down(); await page.mouse.move(mx, my, { steps: 8 }); await page.mouse.up();
      eq(await page.evaluate(() => { const p = __pz.parts.find(p => p.t === 'pol'); return [p.x, p.y]; }), [3, 6], 'landed on top of the mirror');
      await page.mouse.click(mx, my); await page.mouse.click(mx, my);
      eq(await page.evaluate(() => __pz.parts.find(p => p.t === 'mirror').m), 0, 'second tap flips the mirror');
      await page.mouse.move(mx, my); await page.mouse.down(); await page.mouse.move(mx, 4, { steps: 10 }); await page.mouse.up();
      eq(await page.evaluate(() => __pz.parts.map(p => p.t)), ['pol'], 'dragged off the board goes back in the drawer');
    },
    'progress and locked levels': async ({ page, eq, ok }) => {
      const locked = await page.$$eval('#levels .lv.lock', els => els.map(e => +e.dataset.i));
      eq(locked, [1, 2, 3, 4, 5, 6, 7]);
      await page.evaluate(() => __pz.load(5)); eq(await page.textContent('#title'), 'Crossed Filters', 'locked level reachable');
      await page.evaluate(() => __pz.load(8)); eq(await page.textContent('#title'), 'Lab Sandbox', 'sandbox is always open');
      await page.evaluate(() => { __pz.load(0); __pz.addPart('pol', 7, 4, 45); });
      eq(await page.evaluate(() => __pz.won), true);
      const hub = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).polarizer); ok(Math.abs(hub - 1 / 8) < 1e-9, 'progress ' + hub);
      // replay: winning again does not change progress
      await page.evaluate(() => { __pz.load(0); __pz.addPart('pol', 7, 4, 45); });
      eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).polarizer), hub);
    },
    'corrupted / odd saves load without errors': async ({ page, eq, ok }) => {
      for (const [save, title] of [['null', 'Crossed Filters'], ['5', 'Crossed Filters'], ['"x"', 'Crossed Filters'], ['[1,2]', 'Crossed Filters'],
        ['{"done":"zz","stars":7,"cur":-3}', 'Crossed Filters'], ['{"cur":6}', 'Crossed Filters'], ['{"cur":"abc"}', 'Crossed Filters'],
        ['{"done":{"0":1,"1":1},"cur":2}', 'A Better Way'], ['{"cur":8}', 'Lab Sandbox'], ['{"done":{"0":1,"99":1,"-1":1},"cur":1}', 'The Staircase'], ['{not json', 'Crossed Filters']]) {
        const { p2, errs } = await openWith(page, save);
        eq(errs, [], 'errors for ' + save); eq(await p2.textContent('#title'), title, 'level for ' + save);
        const hub = await p2.evaluate(() => JSON.parse(localStorage.getItem('rh:hub') || '{}').polarizer);
        ok(hub == null || (hub >= 0 && hub <= 1), 'progress in range ' + hub);
        await p2.close();
      }
    },
    'save round trip': async ({ page, eq }) => {
      await page.evaluate(() => { __pz.load(0); __pz.addPart('pol', 7, 4, 45); __pz.load(1); });
      const { p2 } = await openWith(page, await page.evaluate(() => localStorage.getItem('rh:polarizer')));
      eq(await p2.textContent('#title'), 'The Staircase');
      eq(await p2.evaluate(() => __pz.SAVE.done), { 0: 1 });
    },
    'no console errors at phone and desktop sizes; panels do not overlap the table': async ({ page, ok }) => {
      for (const [w, h] of [[390, 844], [1280, 800]]) {
        await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(300);
        for (let i = 0; i < 9; i++) await page.evaluate(i => { __pz.SAVE.done[i] = 1; __pz.load(i); }, i);
        const r = await page.evaluate(() => { const hud = document.getElementById('hud').getBoundingClientRect(), tray = document.getElementById('tray').getBoundingClientRect(); return { hudB: hud.bottom, trayT: tray.top, trayR: tray.right, W: innerWidth, sw: document.documentElement.scrollWidth }; });
        ok(r.trayR <= r.W + 1 && r.sw <= r.W, `horizontal overflow at ${w}`);
        ok(r.hudB < r.trayT, `hud overlaps tray at ${w}`);
      }
    },
  },
};
