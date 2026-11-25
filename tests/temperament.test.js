// Temperament: tuning maths, every commission solvable, deliberate commit, saves.
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const solutions = () => {
  const T = window.__tm, SC = 1200 * Math.log2(81 / 80);
  const just = [0, 1200 * Math.log2(16 / 15), 1200 * Math.log2(9 / 8), 1200 * Math.log2(6 / 5), 1200 * Math.log2(5 / 4), 1200 * Math.log2(4 / 3), 1200 * Math.log2(45 / 32), 1200 * Math.log2(3 / 2), 1200 * Math.log2(8 / 5), 1200 * Math.log2(5 / 3), 1200 * Math.log2(9 / 5), 1200 * Math.log2(15 / 8)];
  // Remote Keys: minimax optimum (worst error ~3.26 cents), found offline by smoothed-max descent.
  // Patron's Third and All Twenty-Four: minimax optima from an offline solver (3 stars).
  const PATRON = [0, 76.411, 200, 269.48, 386.675, 500, 579.832, 700, 772.614, 890.034, 966.113, 1083.254];
  const FINALE = [0, 96.437, 197.12, 297.862, 394.3, 499.286, 595.724, 700.711, 797.149, 893.587, 998.574, 1095.011];
  const WTC = [0, 99.574, 199.161, 298.819, 391.61, 503.769, 599.999, 702.936, 795.805, 895.385, 999.999, 1094.629];
  const remote = [0, 105.213, 208.801, 283.275, 387.944, 494.786, 600, 705.214, 808.795, 882.728, 987.397, 1094.786];
  const P = k => T.PRESET[k].c();
  return [P('pyth'), P('pyth'), P('pyth'), T.wolfAt(2), P('mean'), just, P('mean'), P('mean'), T.chainFrom(-SC / 4, -SC / 4, 11, 0), P('werck'), P('vallotti'), P('et'), WTC, T.chainFrom(-SC / 4, -SC / 4, 9, 2), remote, PATRON, FINALE];
};

module.exports = {
  page: 'temperament/index.html',
  ready: async page => { await page.waitForFunction(() => window.__tm); await closeModals(page); },
  tests: {
    'interval maths: pure fifth has no beats, ET fifth beats ~0.89 Hz, comma is conserved': async ({ page, near, ok }) => {
      const r = await page.evaluate(() => {
        const T = window.__tm, pyth = T.PRESET.pyth.c(), et = T.ET();
        const sums = []; for (let t = 0; t < 20; t++) { const c = T.ET().map((x, i) => i ? x + (Math.random() - .5) * 60 : 0); sums.push([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].reduce((a, i) => a + T.dev(c, i, 7), 0)); }
        return { b0: T.beats(pyth, 0, 7), bet: T.beats(et, 0, 7), dEt: T.dev(et, 0, 7), m3: T.dev(T.PRESET.mean.c(), 0, 4), sums, octave: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every(i => Math.abs(T.iv(et, i, 7) - 700) < 1e-9) };
      });
      near(r.b0, 0, 1e-9); near(r.bet, 0.886, 0.01); near(r.dEt, -1.955, 0.001); near(r.m3, 0, 1e-9); ok(r.octave, 'ET fifths not 700');
      r.sums.forEach(s => near(s, -23.46, 0.01, 'sum of fifth deviations around the circle must be minus the Pythagorean comma'));
    },
    'every commission: unmet at start, met by a known tuning': async ({ page, ok, eq }) => {
      const r = await page.evaluate(sol => {
        const T = window.__tm, S = eval('(' + sol + ')')();
        return T.C.slice(0, T.CAMP).map((c, i) => ({ i, start: Math.min(...c.goals.map(g => T.goalEval(g, T.startTuning(i)).stars)), sol: Math.min(...c.goals.map(g => T.goalEval(g, S[i]).stars)) }));
      }, solutions.toString());
      eq(r.length, 17);
      ok(r.slice(11).every(x => x.sol === 3), 'late known tunings should reach 3 stars: ' + JSON.stringify(r.slice(11)));
      ok(r.every(x => x.start === 0), 'met at start: ' + r.filter(x => x.start).map(x => x.i));
      ok(r.every(x => x.sol >= 1), 'unsolvable: ' + JSON.stringify(r.filter(x => x.sol < 1)));
    },
    'The Comma: the wolf tool tunes eleven pure fifths, and where you put the wolf decides the commission': async ({ page, eq, near }) => {
      const r = await page.evaluate(() => {
        const T = window.__tm, [f11, off] = T.C[3].goals, out = [];
        for (let w = 0; w < 12; w++) { const c = T.wolfAt(w), d = [...Array(12).keys()].map(i => T.dev(c, i, 7));
          out.push({ w, c0: c[0], wolf: d[w], others: Math.max(...d.filter((_, i) => i !== w).map(Math.abs)), f11: T.goalEval(f11, c).stars, off: T.goalEval(off, c).ok }); }
        return out;
      });
      r.forEach(x => { eq(x.c0, 0, 'C moved'); near(x.wolf, -23.46, .01, 'wolf size'); near(x.others, 0, 1e-6, 'other fifths'); eq(x.f11, 3); });
      // the piece is in flats down to A-flat: C, F, B-flat, E-flat, A-flat (G#), G fifths are taken
      eq(r.filter(x => x.off).map(x => x.w), [1, 2, 4, 6, 9, 11]);
    },
    'wolf button: select a fifth, press it, the tuning follows': async ({ page, ok }) => {
      await page.evaluate(() => { const T = window.__tm; T.S.done = { 0: 3, 1: 3, 2: 3 }; T.setCur(3); });
      await page.click('#wheel .arc[data-k="7"][data-i="2"]');
      await page.click('#ivWolf');
      const r = await page.evaluate(() => { const T = window.__tm, t = T.tun(); return Math.abs(T.dev(t, 2, 7) + 23.46) < .01; });
      ok(r, 'wolf not placed on D–A');
      await page.waitForTimeout(1300);
      ok(await page.evaluate(() => window.__tm.S.done[3] === 3), 'commission not met');
      ok(await page.locator('.modal .seal').count() === 1, 'no seal');
      ok(await page.evaluate(() => document.getElementById('kbd').classList.contains('gliss')), 'no glissando');
    },
    'regression: dragging the G peg through pure without stopping does not complete the commission': async ({ page, ok }) => {
      const b = await page.locator('.peg').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      for (let dy = 0; dy <= 250; dy += 5) { await page.mouse.move(x, y - dy); await page.waitForTimeout(15); }
      await page.mouse.up(); await page.waitForTimeout(1400);
      ok(!(await page.evaluate(() => window.__tm.S.done[0])), 'swept through pure and it completed');
      ok(await page.evaluate(() => window.__tm.tun()[7] > 700 + 15), 'the peg did not retune G');
    },
    'newcomer: drag the G peg to pure (mouse), hold, release: level 1 clears after the settle, with the coach steps': async ({ page, ok, eq }) => {
      ok((await page.textContent('#coach')).includes('Drag the G peg'), 'no first coach step');
      ok(await page.evaluate(() => document.querySelector('.peg').classList.contains('hl')), 'peg not highlighted');
      const b = await page.locator('.peg').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      for (let dy = 0; dy <= 110; dy += 10) { await page.mouse.move(x, y - dy); await page.waitForTimeout(20); }
      const e = await page.evaluate(() => { const T = window.__tm; return Math.abs(T.dev(T.tun(), 0, 7)); });
      ok(e <= .5, 'did not land near pure: ' + e);
      await page.waitForTimeout(1400); ok(!(await page.evaluate(() => window.__tm.S.done[0])), 'completed while still holding');
      ok(await page.evaluate(() => document.getElementById('ivPlay').classList.contains('hl')), 'Listen not highlighted once close to pure');
      await page.mouse.up(); await page.waitForTimeout(1300);
      ok(await page.evaluate(() => window.__tm.S.done[0] >= 2), 'level 1 not cleared');
    },
    'newcomer (touch, phone): drag the G node on the wheel to pure and it clears': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      await page.locator('#wheel .node[data-n="7"]').scrollIntoViewIfNeeded();
      const b = await page.locator('#wheel .node[data-n="7"]').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let dy = 0; dy <= 110; dy += 10) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - dy }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(1400);
      ok(await page.evaluate(() => window.__tm.S.done[0] >= 1), 'touch drag on the wheel did not clear level 1: G at ' + await page.evaluate(() => window.__tm.dev(window.__tm.tun(), 0, 7)));
    },
    'rapid clicks through the target do not complete; stopping there does': async ({ page, ok }) => {
      // G starts 9 cents flat; pure needs about +11. Click +5 three times quickly (passes through pure at +10) then -5 back.
      for (const d of ['5', '5', '5']) { await page.click(`#noteBox [data-n="${d}"]`); await page.waitForTimeout(120); }
      await page.click('#noteBox [data-n="-5"]'); await page.click('#noteBox [data-n="-5"]'); await page.click('#noteBox [data-n="-5"]');
      await page.waitForTimeout(1300);
      ok(!(await page.evaluate(() => window.__tm.S.done[0])), 'completed by clicking through');
      for (let n = 0; n < 2; n++) await page.click('#noteBox [data-n="5"]');
      await page.click('#noteBox [data-n="1"]');
      await page.waitForTimeout(1300);
      ok(await page.evaluate(() => window.__tm.S.done[0] >= 1), 'did not complete when stopped on pure');
    },
    'switching commission during the settle window cancels the award': async ({ page, ok }) => {
      await page.evaluate(() => { const T = window.__tm, t = T.tun(); t[7] = 1200 * Math.log2(1.5); T.render(); T.setCur(1); });
      await page.waitForTimeout(1300);
      ok(!(await page.evaluate(() => window.__tm.S.done[0])), 'awarded a commission that was left');
      await page.evaluate(() => window.__tm.setCur(0)); await page.waitForTimeout(1300);
      ok(await page.evaluate(() => window.__tm.S.done[0] === 3), 'settled pure fifth not awarded on return');
    },
    'acts unlock in order; progress bounded; corrupt saves load': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const T = window.__tm, put = v => localStorage.setItem('rh:temper', typeof v === 'string' ? v : JSON.stringify(v)), out = {};
        out.a1 = T.actOpen(1); T.S.done[0] = 3; T.S.done[1] = 1; T.S.done[2] = 2; out.a1b = T.actOpen(1);
        put('{{'); out.junk = Object.keys(T.loadState().done).length;
        put({ done: { 0: 7, 1: 0, 99: 3, 2: 'x' }, tun: { 0: [1, 2], 1: Array(12).fill(0), 2: Array(12).fill(null) }, cur: 'q' });
        const s = T.loadState(); out.s = [s.done, Object.keys(s.tun), s.cur];
        for (let i = 0; i < 16; i++) T.S.done[i] = 3; T.render(); out.hub = JSON.parse(localStorage.getItem('rh:hub')).temperament;
        return out;
      });
      eq([r.a1, r.a1b], [false, true]); eq(r.junk, 0); eq(r.s, [{ 0: 3 }, ['1'], 0]);
      ok(r.hub === undefined || r.hub <= 1, 'hub ' + r.hub);
    },
    'phone layout: no horizontal scroll': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
      ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 392, 'overflow');
    },
    'presets are earned: equal temperament only after building it, never on its own commission': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const T = window.__tm, opts = () => [...document.querySelectorAll('#preset option')].map(o => o.value);
        T.S.done = {}; for (let i = 0; i < 11; i++) T.S.done[i] = 3; T.setCur(11); const a = opts(); T.setCur(16); const b = opts();
        T.S.done[11] = 3; T.setCur(16); const c = opts(); T.setCur(11); const d = opts(); return { a, b, c, d }; });
      ok(!r.a.includes('et') && !r.b.includes('et'), 'ET offered before it was built'); ok(r.c.includes('et'), 'ET not offered after building it'); ok(!r.d.includes('et'), 'ET offered on its own commission');
      const fin = await page.evaluate(() => { const T = window.__tm; return Math.min(...T.C[16].goals.map(g => T.goalEval(g, T.PRESET.et.c()).stars)); });
      eq(fin, 0, 'equal temperament must not pass the finale');
    },
    'commissions show the worst chord and the interval that limits it': async ({ page, ok }) => {
      await page.evaluate(() => { const T = window.__tm; for (let i = 0; i < 13; i++) T.S.done[i] = 3; T.setCur(13); });
      ok(await page.locator('#wheel polygon').count() === 10, 'chord triangles');
      const txt = await page.textContent('.bindbtn'); ok(/is limited by its (fifth|major third|minor third)/.test(txt), txt);
      await page.click('.bindbtn');
      const sel = await page.evaluate(() => document.querySelector('#ivBox h3').textContent); ok(txt.includes(sel.split(' ')[0]), 'binding interval not selected: ' + sel);
      ok(/Comma budget/.test(await page.textContent('#goals')), 'no comma budget');
      const sum = await page.evaluate(() => { const T = window.__tm; return T.chordInfo(T.tun(), 'C').parts.length; }); ok(sum === 3);
    },
    'v1 saves: the finale result moves past the inserted commission': async ({ page, eq }) => {
      const r = await page.evaluate(() => { localStorage.setItem('rh:temper', JSON.stringify({ done: { 14: 2, 15: 3 }, tun: { 15: Array(12).fill(0).map((_, i) => i * 100) }, cur: 15 }));
        const s = window.__tm.loadState(); return [s.done, Object.keys(s.tun), s.cur, s.v]; });
      eq(r, [{ 14: 2, 16: 3 }, ['16'], 16, 2]);
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      const r = await page.evaluate(() => {
        const T = window.__tm, late = [11, 12, 13, 14, 15, 16], stars = (i, c) => Math.min(...T.C[i].goals.map(g => T.goalEval(g, c).stars));
        const rng = s => () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
        const avail = i => Object.keys(T.PRESET).filter(k => ({ pyth: 3, mean: 7, werck: 9, vallotti: 10, et: 11 })[k] < i);
        const descend = (i, temps, iters) => { const g = T.C[i].goals, c = T.ET();
          const fine = c => g.flatMap(x => x.k === 'ch' ? x.list.map(n => T.chordInfo(c, n).err / x.tol[2]) : x.k === 'tCFG' ? [0, 5, 7].map(q => T.dev(c, q, 4) / x.tol[2]) : x.k === 't' ? [Math.abs(T.dev(c, x.i, 4)) / x.tol[2]] : [T.goalEval(x, c).err / x.tol[2]]);
          for (const Tm of temps) { const sm = c => { const v = fine(c), m = Math.max(...v); return m + Tm * Math.log(v.reduce((a, x) => a + Math.exp((x - m) / Tm), 0)); }; let lr = .5;
            for (let it = 0; it < iters; it++) { const f0 = sm(c), gr = []; for (let n = 1; n < 12; n++) { c[n] += 1e-4; gr[n] = (sm(c) - f0) / 1e-4; c[n] -= 1e-4; } const c2 = c.map((x, n) => n ? x - lr * gr[n] : 0); if (sm(c2) < f0) { for (let n = 1; n < 12; n++) c[n] = c2[n]; lr *= 1.2; } else lr *= .5; if (lr < 1e-8) break; } }
          return c; };
        const runs = [];
        for (const i of late) {
          runs.push(stars(i, T.startTuning(i)));                                                    // idle
          for (let seed = 1; seed <= 6; seed++) { const R = rng(seed), c = T.startTuning(i); let best = 0;     // random nudges
            for (let t = 0; t < 300; t++) { c[1 + Math.floor(R() * 11)] += [-5, -1, -.1, .1, 1, 5][Math.floor(R() * 6)]; best = Math.max(best, stars(i, c)); } runs.push(best); }
          runs.push(Math.max(0, ...avail(i).map(k => stars(i, T.PRESET[k].c()))));                  // load the best earned preset
          { const g = T.C[i].goals, c = T.startTuning(i); let best = 0;                               // greedy: make the worst interval pure
            for (let t = 0; t < 40; t++) { let sel; const ch = g.find(x => x.k === 'ch');
              if (ch) sel = ch.list.map(n => T.chordInfo(c, n)).reduce((a, b) => b.err > a.err ? b : a).bind;
              else { let m = -1; for (let n = 0; n < 12; n++) for (const k of [7, 4]) { const d = Math.abs(T.dev(c, n, k)); if (d > m) { m = d; sel = { i: n, k }; } } }
              const j = (sel.i + sel.k) % 12, pure = { 7: 701.955, 4: 386.314, 3: 315.641 }[sel.k];
              if (j !== 0) c[j] = c[sel.i] + pure - (sel.i + sel.k >= 12 ? 1200 : 0); else c[sel.i] = c[j] + 1200 - pure;
              best = Math.max(best, stars(i, c)); } runs.push(best); }
        }
        const competent = late.map(i => stars(i, descend(i, [1, .3], 300)));
        return { naiveOk: runs.filter(x => x <= 1).length / runs.length, competent };
      });
      ok(r.naiveOk >= .8, 'naive policies scored above 1 star too often: ' + r.naiveOk);
      ok(r.competent.every(s => s >= 1), 'competent policy failed a late commission: ' + r.competent);
      ok(r.competent.slice(1).filter(s => s === 3).length <= 1, 'a simple optimiser already gets 3 stars: ' + r.competent);
    },
    'Music Room: pieces are deterministic per seed, wander through more keys as you climb, and the solver tuning earns three stars': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const T = window.__tm, a = JSON.stringify(T.pieceGen('s1', 4)), b = JSON.stringify(T.pieceGen('s1', 4)), c = JSON.stringify(T.pieceGen('s2', 4));
        const keys = [1, 3, 5, 9].map(l => T.pieceGen('s1', l).keys.length), out = [];
        for (let l = 1; l <= 12; l++) { const p = T.pieceGen('lad', l), sol = T.solvePiece(p.chords), g = { k: 'ch', list: [...new Set(p.chords)], tol: [sol.worst + 6, sol.worst + 2, sol.worst + .2] };
          const st = T.goalEval(g, sol.c).stars, et = T.goalEval(g, T.ET()).stars; out.push([st, et, Math.round(sol.worst * 10) / 10]); }
        return { same: a === b, differ: a !== c, keys, out }; });
      ok(r.same && r.differ, 'not deterministic per seed'); ok(r.keys[0] === 1 && r.keys[3] >= 4, 'later pieces should modulate more: ' + r.keys);
      ok(r.out.every(([st]) => st === 3), 'solver tuning should earn 3 stars: ' + JSON.stringify(r.out));
      ok(r.out.filter(([, et]) => et === 3).length <= 2, 'equal temperament should rarely be good enough for three stars: ' + JSON.stringify(r.out));
    },
    'Music Room: perform, advance, daily piece and your own composition, all through the UI': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const T = window.__tm; for (let i = 0; i < 4; i++) T.S.done[i] = 3; T.setCur(T.ROOM); });
      ok(await page.isDisabled('#rNext'), 'next piece before performing');
      await page.evaluate(() => { const T = window.__tm; T.S.tun[T.ROOM] = T.C[T.ROOM].solver.slice(); T.render(); }); await page.waitForTimeout(1300);
      ok(await page.evaluate(() => window.__tm.S.room.best[window.__tm.roomKey()] === 3), 'solver tuning not awarded');
      await page.click('#rNext'); eq(await page.evaluate(() => window.__tm.S.room.level), 2);
      await page.click('#rDaily'); ok(await page.evaluate(() => window.__tm.S.room.seed.startsWith('daily:')));
      await page.click('#rCompose'); for (const ch of ['C', 'Am', 'F', 'G']) await page.click(`[data-ch="${ch}"]`); await page.click('#cUse');
      eq(await page.evaluate(() => window.__tm.C[window.__tm.ROOM].goals[0].list), ['C', 'Am', 'F', 'G']);
      ok(await page.evaluate(() => location.hash === '#piece=C.Am.F.G'), 'no share link');
      ok(await page.evaluate(() => (localStorage.getItem('rh:temper') || '').length < 50000));
    },
    'Music Room difficulty: naive tunings score worse than a sensible tuner, who falls short of the solver': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const T = window.__tm, res = { naive: [], comp: [] };
        for (let l = 7; l <= 12; l++) { const p = T.pieceGen('diff', l), list = [...new Set(p.chords)], sol = T.solvePiece(p.chords), g = { k: 'ch', list, tol: [sol.worst + 6, sol.worst + 2, sol.worst + .2] };
          const st = c => T.goalEval(g, c).stars;
          res.naive.push(st(T.ET()), st(T.PRESET.mean.c()), st(T.PRESET.pyth.c()), st(T.PRESET.vallotti.c()));
          // a sensible tuner: from equal temperament, follow the worst chords downhill at a coarse focus only (no fine cooling)
          const fine = c => list.flatMap(n => T.chordInfo(c, n).parts.map(q => Math.abs(q.d))), c = T.ET();
          for (const Tm of [1, .5]) { const sm = c => { const v = fine(c), m = Math.max(...v); return m + Tm * Math.log(v.reduce((a, x) => a + Math.exp((x - m) / Tm), 0)); }; let lr = .5;
            for (let it = 0; it < 150; it++) { const f0 = sm(c), gr = []; for (let q = 1; q < 12; q++) { c[q] += 1e-4; gr[q] = (sm(c) - f0) / 1e-4; c[q] -= 1e-4; } const c2 = c.map((x, q) => q ? x - lr * gr[q] : 0); if (sm(c2) < f0) { for (let q = 1; q < 12; q++) c[q] = c2[q]; lr *= 1.2; } else lr *= .5; } }
          res.comp.push(st(c)); }
        return res; });
      ok(r.naive.filter(x => x <= 1).length / r.naive.length >= .8, 'naive presets score too well: ' + r.naive);
      ok(r.comp.every(x => x >= 1), 'a sensible tuner should perform every late piece: ' + r.comp);
      ok(r.comp.filter(x => x === 3).length <= 2, 'three stars should need a solver-level tuning: ' + r.comp);
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
