// Chladni · Sand Score: plate physics, sand that flows to nodal lines, scores that are order-dependent and deterministic,
// commissions that are reachable but not by chance, the finger and the drill, speed, saves, links, pan/zoom, phones.
const fresh = async page => { await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForFunction(() => window.__ch); };
const BEAM = `window.__beam = (c, n = 300, W = 6) => { const X = __ch, DURS = [.25, .5, 1, 2], cfg = { shape: c.shape, start: c.start, finger: c.finger || null, holes: c.holes || [] }, M = X.plateOf(c.shape, c.holes || []).modes.length;
  let beams = [{ s: [], m: 0 }], best = { s: [], m: 0 };
  for (let len = 0; len < c.par + 1; len++) { const cand = []; for (const bm of beams) for (const k of c.pal) if (k < M) for (const d of DURS) { const s2 = [...bm.s, [k, d]]; cand.push({ s: s2, m: X.matchOf(c, X.perform(cfg, s2, n), n) }); }
    cand.sort((a, b) => b.m - a.m); beams = cand.slice(0, W); if (beams[0].m > best.m) best = beams[0]; }
  return best; };`;
module.exports = {
  page: 'chladni/index.html',
  ready: async page => { await page.waitForFunction(() => window.__ch); await page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove())); await page.evaluate(BEAM); },
  tests: {
    'square plate: the cos·cos families, f ∝ n²+m² (twins split by a hair), symmetric, zero on their nodal lines; the solver reproduces them': async ({ page, ok, near }) => {
      const r = await page.evaluate(() => { const X = __ch, sq = X.SQ.map(m => ({ id: m.id, ratio: m.f / (46 * (m.n * m.n + m.m * m.m)), sym: m.z(.2, .7) - m.s * m.z(.7, .2), diag: m.s < 0 ? m.z(.3, .3) : 0 }));
        // the grid solver (a free-edge membrane approximation) on a square with a hole in one corner: λ ∝ n²+m² → 1, 1, 2, 4
        const pl = X.plateOf('square', [[.03, .03]]), lam = pl.modes.map(m => m.lam);
        return { sq, r: [1, 2, 3].map(k => lam[k] / lam[0]) }; });
      for (const m of r.sq) { ok(m.ratio >= 1 && m.ratio < 1.15, m.id + ' ratio ' + m.ratio); near(m.sym, 0, 1e-12, m.id + ' symmetry'); near(m.diag, 0, 1e-12, m.id + ' diagonal node'); }
      [1, 2, 4].forEach((want, k) => ok(Math.abs(r.r[k] / want - 1) < .2, `solver ratio ${k + 1}: ${r.r[k]} vs ${want}`));
    },
    'sand flows to the nodal lines: one long note puts most grains where the plate is still; a note stops the sand where it is when it ends': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __ch, pl = X.plateOf('square'), cfg = { shape: 'square', start: 'even', finger: null, holes: [] };
        const still = s => { let n = 0; const F = X.fieldOf(pl, 3, null); for (let i = 0; i < s.n; i++) { const c = Math.floor(s.sy[i] * 64) * 64 + Math.floor(s.sx[i] * 64); if (Math.abs(F.u[c]) < .2) n++; } return n / s.n; };
        const s0 = X.perform(cfg, [], 1500), sq = X.perform(cfg, [[3, .25]], 1500), s2 = X.perform(cfg, [[3, 2]], 1500);
        return { start: still(s0), quarter: still(sq), long: still(s2), same: JSON.stringify(Array.from(X.perform(cfg, [[3, 1], [1, .5]], 800).sx)) === JSON.stringify(Array.from(X.perform(cfg, [[3, 1], [1, .5]], 800).sx)) }; });
      ok(r.start < .4 && r.long > .8, JSON.stringify(r)); ok(r.quarter > r.start + .1 && r.quarter < r.long - .1, 'a quarter note should be partway: ' + JSON.stringify(r)); ok(r.same, 'not deterministic');
    },
    'order matters: a commission\'s notes played backwards never earn two stars, and mostly miss': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __ch; return X.COMMS.filter(c => c.ref.length > 1).map(c => { const cfg = { shape: c.shape, start: c.start, finger: c.finger || null, holes: c.holes || [] }; return [c.id, X.matchOf(c, X.perform(cfg, c.ref.slice().reverse(), 600), 600)]; }); });
      const good = r.filter(([, m]) => m >= .9); ok(!good.length, 'backwards earns stars: ' + JSON.stringify(good));
      ok(r.filter(([, m]) => m < .7).length >= r.length * .6, JSON.stringify(r));
    },
    'every commission: the start is 0%, its hidden score is 100%; a methodical composer (beam search) delivers it; random apprentices rarely earn 90%': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __ch; return X.COMMS.map(c => { const cfg = { shape: c.shape, start: c.start, finger: c.finger || null, holes: c.holes || [] };
        return { id: c.id, start: X.matchOf(c, X.perform(cfg, [])), ref: X.matchOf(c, X.perform(cfg, c.ref)), beam: window.__beam(c).m, appr: X.apprentices(c, 10) }; }); });
      for (const c of r) { ok(c.start < .01 && c.ref > .99, `${c.id} start ${c.start} ref ${c.ref}`); ok(c.beam >= .8, `${c.id} beam only ${c.beam}`); }
      const late = r.filter(c => !/^c[12]$/.test(c.id)), hits = late.reduce((a, c) => a + c.appr.filter(v => v >= .9).length, 0);
      ok(hits <= late.length * 10 * .05, `apprentices hit 90% ${hits} times`);
    },
    'the first commission is tiny: three notes to choose from, two to play, found by trying pairs within about a minute': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const X = __ch, c = X.COMMS[0], cfg = { shape: c.shape, start: c.start, finger: null, holes: [] }; let hits = 0, tot = 0;
        for (const a of c.pal) for (const b of c.pal) { tot++; if (X.matchOf(c, X.perform(cfg, [[a, 1], [b, 1]])) >= .8) hits++; }
        return { pal: c.pal.length, par: c.par, hits, tot, play: c.ref.reduce((a, [, d]) => a + d, 0) * X.BEAT_MS }; });
      eq(r.pal, 3); eq(r.par, 2); ok(r.hits >= 1 && r.tot <= 9, JSON.stringify(r)); ok(r.play <= 1000, 'first score plays too long');
    },
    'speed: the longest score plays in about 8 s or less, a whole score computes in a blink, replay restarts from the same sand': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __ch, cfg = { shape: 'square', start: 'even', finger: null, holes: [] }, t = performance.now(); for (let k = 0; k < 5; k++) X.perform(cfg, X.COMMS[5].ref); return { ms: (performance.now() - t) / 5, maxPlay: 12 * 2 * X.BEAT_MS, longest: Math.max(...X.COMMS.map(c => c.ref.reduce((a, [, d]) => a + d, 0))) * X.BEAT_MS }; });
      ok(r.ms < 250, 'perform takes ' + r.ms); ok(r.longest <= 3000, 'set pieces play ' + r.longest); ok(r.maxPlay <= 8000, 'max score ' + r.maxPlay);
    },
    'the finger: twin notes turn to put a nodal line under it; a note that moves a lot under it is choked and leaves the sand alone': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __ch, pl = X.plateOf('square'), f = [.37, .21], at = (u, x, y) => u[Math.floor(y * 64) * 64 + Math.floor(x * 64)];
        const twin = pl.modes.findIndex((m, k) => m.pair && pl.modes.some((q, j) => j !== k && q.pair === m.pair)), F = X.fieldOf(pl, twin, f);
        const lone = pl.modes.findIndex(m => m.id === '01-'); // cos πy − cos πx has no twin; at (.1, .5) it moves hard
        const D = X.fieldOf(pl, lone, [.1, .5]), cfg = { shape: 'square', start: 'even', finger: [.1, .5], holes: [] }, a = X.perform(cfg, [], 400), b = X.perform(cfg, [[lone, 2]], 400);
        return { under: Math.abs(at(F.u, ...f)), before: Math.abs(at(pl.modes[twin].u, ...f)), dead: D.dead, still: Array.from(a.sx).every((x, i) => x === b.sx[i]) }; });
      ok(r.under < .08 && r.before > .1, JSON.stringify(r)); ok(r.dead && r.still, 'choked note moved sand: ' + JSON.stringify(r));
    },
    'the drill: a hole re-solves the plate (new notes) and sand that reaches it falls through': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __ch, a = X.plateOf('square'), b = X.plateOf('square', [[.5, .5]]), cfg = { shape: 'square', start: 'heap', finger: null, holes: [[.5, .5]] }, s0 = X.perform(cfg, [], 600), s = X.perform(cfg, [[2, 2], [4, 1]], 600);
        return { differ: Math.abs(b.modes[3].lam / b.modes[0].lam - a.modes[3].f / a.modes[0].f) > .01, lost0: s0.lost.reduce((x, y) => x + y, 0), lost: s.lost.reduce((x, y) => x + y, 0) }; });
      ok(r.differ, 'hole did not change the notes'); ok(r.lost0 === 0 && r.lost > 0, JSON.stringify(r));
    },
    'compose through the page: tap notes, change a length, Play, deliver with stars; the next commission unlocks; the score survives a reload': async ({ page, ok, eq }) => {
      await fresh(page); await page.evaluate(BEAM);
      ok(!(await page.$('.modal-bg')), 'a modal greets a new player');
      const ref = await page.evaluate(() => __ch.COMMS[0].ref);
      for (const [k] of ref) await page.click(`.pm[data-k="${k}"]`);
      eq(await page.evaluate(() => __ch.sc.notes.length), 2);
      await page.click('.chip[data-i="0"] img'); eq(await page.evaluate(() => __ch.sc.notes[0][1]), 2); // 1 → 2 beats
      for (let i = 0; i < 3; i++) await page.click('.chip[data-i="0"] img'); // 2 → ¼ → ½ → 1
      eq(await page.evaluate(() => __ch.sc.notes[0][1]), 1);
      await page.click('#playBtn'); await page.waitForFunction(() => !__ch.playing, null, { timeout: 5000 });
      ok(await page.evaluate(() => (__ch.SAVE.done.c1?.stars | 0) === 3), 'not delivered with 3 stars');
      ok(await page.isVisible('#nextBtn'), 'no Next button');
      await page.click('#listBtn'); ok(await page.evaluate(() => !document.querySelector('.clist [data-c="c2"]').disabled && document.querySelector('.clist [data-c="c3"]').disabled), 'unlocks wrong');
      await page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
      await page.click('#nextBtn'); await page.click('.pm[data-k="2"]');
      await page.reload(); await page.waitForFunction(() => window.__ch);
      eq(await page.evaluate(() => [__ch.C.id, __ch.sc.notes.length]), ['c2', 1]);
    },
    'the field preview: adding a note draws its nodal lines and arrows; the target can be laid over the plate': async ({ page, ok }) => {
      await page.click('.pm[data-k="1"]'); await page.waitForTimeout(100);
      const shot = async () => page.evaluate(() => { const c = document.getElementById('cv'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 4 * 97) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1e9; return h; });
      const a = await shot(); await page.dispatchEvent('#tgt', 'pointerdown'); await page.waitForTimeout(120); const b = await shot(); await page.dispatchEvent('#tgt', 'pointerup'); await page.waitForTimeout(120); const c = await shot();
      ok(a !== b && a === c, 'ghost overlay did not appear and go');
    },
    'pan and zoom: zoomed, a finger lands under the pointer; a pinch places nothing; the zoom buttons never cover the plate': async ({ page, ok }) => {
      for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
        await page.setViewportSize(vp); await page.waitForTimeout(250); await page.evaluate(() => __ch.cam.fit());
        const over = await page.evaluate(() => { const bar = document.querySelector('.pz-bar').getBoundingClientRect(), [x0, y0] = __ch.cam.toScreen(0, 0), [x1, y1] = __ch.cam.toScreen(1, 1);
          return !(bar.right <= x0 || bar.left >= x1 || bar.bottom <= y0 || bar.top >= y1); });
        ok(!over, `zoom bar overlaps the plate at ${vp.width}×${vp.height}`);
      }
      await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(200);
      await page.evaluate(() => { const X = __ch; X.openComm(X.COMMS.find(c => c.id === 'f1')); X.tool = 'finger'; const r = document.getElementById('view').getBoundingClientRect(); X.cam.zoomAt(r.left + r.width / 2, r.top + r.height / 2, 2.5); });
      const [sx, sy] = await page.evaluate(() => __ch.cam.toScreen(.55, .45));
      await page.mouse.click(sx, sy);
      const f = await page.evaluate(() => __ch.sc.finger); ok(f && Math.abs(f[0] - .55) < .01 && Math.abs(f[1] - .45) < .01, 'finger landed at ' + f);
      await page.evaluate(() => { __ch.sc.finger = null; });
      const cdp = await page.context().newCDPSession(page);
      const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
      await tp('touchStart', [[sx - 40, sy], [sx + 40, sy]]); await tp('touchMove', [[sx - 80, sy], [sx + 80, sy]]); await tp('touchEnd', []);
      await page.waitForTimeout(100); ok(!(await page.evaluate(() => __ch.sc.finger)), 'a pinch placed the finger');
    },
    'workshop: seeded commissions are deterministic, reachable by their own score, and open after chapter II; a #score= link carries a piece': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const X = __ch, a = JSON.stringify(X.workshop('abc')), b = JSON.stringify(X.workshop('abc')), c = JSON.stringify(X.workshop('abd'));
        const ok = ['a', 'b', 'c', 'd'].every(s => { const w = X.workshop(s); return X.matchOf(w, X.perform({ shape: w.shape, start: w.start, finger: w.finger, holes: [] }, w.ref)) > .99; });
        return { same: a === b, differ: a !== c, ok }; });
      ok(r.same && r.differ && r.ok, JSON.stringify(r));
      const link = await page.evaluate(() => { const X = __ch; X.openComm(X.COMMS[2]); X.sc.notes = [[1, .5], [3, 2]]; return X.share(); });
      const p2 = await page.context().newPage(); await p2.goto(link); await p2.waitForFunction(() => window.__ch);
      eq(await p2.evaluate(() => [__ch.C.id, JSON.stringify(__ch.sc.notes)]), ['c3', '[[1,0.5],[3,2]]']); await p2.close();
    },
    'odd and corrupted saves load without errors': async ({ page, ok }) => {
      for (const bad of ['null', '[]', '{"v":2,"done":5,"scores":{"c1":{"notes":[[99,3]]}},"cur":7}', '{"v":2,"scores":{"c1":{"notes":[[1,1]],"finger":[2,2]}},"cur":"w:zz"}', '{"v":1,"mode":"tune"}', '{"v":2,"cur":"nope"}']) {
        const p2 = await page.context().newPage(), errs = []; p2.on('pageerror', e => errs.push(e.message));
        await p2.goto(page.url()); await p2.evaluate(s => localStorage.setItem('rh:chladni', s), bad); await p2.reload(); await p2.waitForTimeout(400);
        ok(!errs.length && await p2.evaluate(() => !!__ch.C), bad + ': ' + errs.join('; ')); await p2.close();
      }
    },
    'no sideways scroll at phone sizes; the plate gets most of the screen': async ({ page, ok }) => {
      for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(vp); await page.waitForTimeout(250);
        const r = await page.evaluate(() => { const s = document.getElementById('stage').getBoundingClientRect(); return { h: document.documentElement.scrollWidth > innerWidth + 1, frac: s.width * s.height / (innerWidth * innerHeight) }; });
        ok(!r.h && r.frac > .45, `${vp.width}×${vp.height}: ${JSON.stringify(r)}`);
      }
    },
  },
};
