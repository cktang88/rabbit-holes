// Snowfall: the precomputed tables must match the model, every copy puzzle must be solvable by its recipe and by nothing else,
// a live fall must replay exactly from its recorded schedule, and saves of every age must load safely.
const plant = async (page, raw) => { await page.addInitScript(raw => localStorage.setItem('rh:snowfall', raw), raw); await page.reload(); await page.waitForTimeout(700); };
const fall = async page => { const t0 = Date.now(); while (await page.evaluate(() => __snow.growing)) { if (Date.now() - t0 > 25000) throw new Error('fall never landed'); await page.waitForTimeout(100); } return (Date.now() - t0) / 1000; };

module.exports = {
  page: 'snowfall/index.html',
  tests: {
    'selfCheck: prototypes, targets and (every 4th) pad point replay to the stored tables': async ({ page, eq }) => {
      eq(await page.evaluate(() => __snow.selfCheck(4)), { worst: 0, padMismatch: 0 });
    },
    'copy scoring: each recipe earns 3 stars on its own target and 0 on every other': async ({ page, eq }) => {
      const M = await page.evaluate(() => { const T = __snow.TARGETS, masks = T.map(t => __snow.replay(t.sc)); return T.map((_, i) => masks.map(m => __snow.scoreCopy(m, i).stars)); });
      eq(M, M.map((row, i) => row.map((_, j) => i === j ? 3 : 0)));
    },
    'copy scoring: slightly-off timing still earns stars; the right forms in the wrong order do not': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const T = __snow.TARGETS, i4 = T.findIndex(t => t.n === 'Fern with plate tips'), i5 = T.findIndex(t => t.n === 'Three seasons'), i2 = T.findIndex(t => t.n === 'Plate, then arms');
        const sc = (sc, i) => __snow.scoreCopy(__snow.replay(sc), i).stars;
        return { late: sc([[0, .1, .1], [.84, .3, 1]], i4), early2: sc([[0, .3, 1], [.5, .1, .1]], i2),
          reversed: sc([[0, .1, .1], [.45, .3, 1]], i2), steadyFern: sc([[0, .1, .1]], i4), steadyPlate: sc([[0, .3, 1]], i2), oneSeason: sc([[0, .1, .1], [.25, .3, 1]], i5) }; });
      ok(r.late >= 2 && r.early2 >= 2, 'near-miss timing rejected ' + JSON.stringify(r));
      ok(!r.reversed && !r.steadyFern && !r.steadyPlate && r.oneSeason < 2, 'wrong recipe scored ' + JSON.stringify(r));
    },
    'scribbling all over the pad does not copy the two-change flakes': async ({ page, ok }) => {
      const r = await page.evaluate(() => { let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647, T = __snow.TARGETS, out = [];
        for (let k = 0; k < 5; k++) { const sc = [[0, rnd(), rnd()]]; for (let f = .05; f < 1; f += .05) sc.push([f, rnd(), rnd()]); const m = __snow.replay(sc); out.push(T.map((_, i) => __snow.judgeCopy(m, sc, i, 'frac').stars)); }
        // every recipe stays well inside its travel allowance
        const fair = T.every((t, i) => __snow.padTravel(t.sc, 'frac') + .5 < __snow.travelAllowance(i));
        return { out, fair }; });
      ok(r.fair, 'a recipe exceeds its own travel allowance');
      for (const row of r.out) ok(row.every(s => s < 2), 'scribble scored ' + row);
    },
    'classification: steady weather only ever gives a pure form; combo forms need a switch': async ({ page, eq }) => {
      const r = await page.evaluate(() => [[.1, .1], [.5, .5], [.3, 1], [.3, .75]].map(([x, y]) => { const m = __snow.replay([[0, x, y]]); const f = __snow.classify(m, false); return f && f.id; }));
      eq(r, ['fern', 'stellar', 'plate', 'broad']);
      eq(await page.evaluate(() => __snow.classify(__snow.replay([[0, .3, 1], [.45, .1, .1]]), true).id), 'platearms');
    },
    'model invariants: hex symmetry, ice only grows, descriptor bounds, pad mapping': async ({ page, ok, near, eq }) => {
      const r = await page.evaluate(() => { const { N, Sim, seed, step, desc, ptToParams } = __snow, C = N >> 1, o = Sim(); seed(o, .4, .001); let grew = true, prev = 1;
        for (let i = 0; i < 400; i++) { step(o); let n = 0; for (let k = 0; k < o.fr.length; k++) n += o.fr[k]; if (n < prev) grew = false; prev = n; }
        // 6-fold symmetry: rotate axial (q, r) -> (-r, q + r)
        let asym = 0; for (let r = -40; r <= 40; r++) for (let q = -40; q <= 40; q++) { const a = (r + C) * N + q + C, q2 = -r, r2 = q + r; if (Math.abs(r2) > C || Math.abs(q2) > C) continue; if (o.fr[a] !== o.fr[(r2 + C) * N + q2 + C]) asym++; }
        const d = desc(o.fr), z = desc(new Uint8Array(N * N));
        return { grew, asym, ice: prev, dmin: Math.min(...d), dmax: Math.max(...d), zero: Math.max(...z), p0: ptToParams({ x: 0, y: 0 }), p1: ptToParams({ x: 1, y: 1 }) }; });
      ok(r.grew && r.ice > 7, 'ice must only grow'); eq(r.asym, 0, 'not six-fold symmetric');
      ok(r.dmin >= 0 && r.dmax <= 1 && r.zero === 0, 'descriptor out of range');
      near(r.p0[0], .3, 1e-9); near(r.p0[1], .0001, 1e-9); near(r.p1[0], .55, 1e-9); near(r.p1[1], .05, 1e-9);
    },
    'live fall: ~8 s, buttons locked meanwhile, recorded schedule replays the exact crystal': async ({ page, ok, eq }) => {
      await page.evaluate(() => __snow.setPad(.3, 1)); await page.locator('#rel').click(); await page.locator('#rel').click({ force: true }).catch(() => {});
      ok(await page.evaluate(() => __snow.growing)); ok(await page.locator('#rel').isDisabled());
      // steer mid-fall with the real pad: drag down to the ferns
      await page.waitForTimeout(3600); const b = await page.locator('#pad').boundingBox();
      await page.mouse.move(b.x + b.width * .3, b.y + 4); await page.mouse.down(); await page.mouse.move(b.x + b.width * .1, b.y + b.height * .9, { steps: 5 }); await page.mouse.up();
      await page.evaluate(() => __snow.setMode('gallery')); eq(await page.evaluate(() => __snow.mode), 'free', 'mode changed mid-fall');
      eq(await page.evaluate(() => __snow.setTarget(3)), false);
      const secs = 3.6 + await fall(page); ok(secs > 6 && secs < 12, 'fall took ' + secs);
      const r = await page.evaluate(() => { const live = __snow.mask.slice(), sc = __snow.sched, rep = __snow.replay(sc, 'pad'); let diff = 0; for (let k = 0; k < live.length; k++) diff += live[k] !== rep[k]; return { diff, n: sc.length, got: Object.keys(__snow.SAVE.got), gal: __snow.SAVE.gallery.length }; });
      eq(r.diff, 0, 'replay differs'); ok(r.n > 1, 'pad drag not recorded'); eq(r.gal, 1);
      ok(r.got.length === 1, 'catalogue: ' + r.got);
    },
    'copy mode: the first target copied for real earns stars, unlocks the next, and Next works': async ({ page, ok, eq }) => {
      await page.evaluate(() => __snow.setMode('copy')); await page.waitForTimeout(300);
      eq(await page.evaluate(() => document.querySelectorAll('.tg.lock').length), 5);
      await page.evaluate(() => document.querySelector('.tg[data-i="3"]').click()); eq(await page.evaluate(() => __snow.target), 0, 'locked target opened');
      await page.evaluate(() => __snow.setPad(.3, .5)); await page.locator('#rel').click(); await fall(page);
      const r = await page.evaluate(() => ({ s: __snow.lastScore.stars, c: __snow.SAVE.copies, t: __snow.SAVE.tried, hub: JSON.parse(localStorage.getItem('rh:hub')).snowfall }));
      ok(r.s >= 2, 'steady star scored ' + r.s); eq(r.t, { 0: 1 }); ok(Math.abs(r.hub - 1 / 13) < 1e-9 || Math.abs(r.hub - 2 / 13) < 1e-9, 'progress ' + r.hub);
      await page.locator('#nextT').click(); eq(await page.evaluate(() => __snow.target), 1);
      // re-entering copy mode resumes at the first flake not yet copied
      await page.evaluate(() => { __snow.setMode('free'); __snow.setMode('copy'); }); eq(await page.evaluate(() => __snow.target), 1);
    },
    'saves: corrupted, v1 and v2 saves load safely and migrate': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const c = __snow.cleanSave;
        return [c(null), c(7), c({ v: 2, got: null, gallery: 'x', copies: [], tried: 5, mode: 'evil' }),
          c({ v: 2, got: { plate: { sc: [[0, 50, 200]] }, bogus: 1, fern: { sc: [[0, 'a', 1]] } }, gallery: [null, { sc: [[0, 10, 10]], k: 'pad', name: '<img onerror=x>' }, { sc: [[5, 1, 1]], k: 'pad' }, { sc: [], k: 'pad' }], copies: { 0: 3, 1: 2, 2: 3, 3: 1, 4: 2, 7: 9, x: 1 }, tried: { 5: 2 } }),
          c({ got: { plate: 'data:image/png;base64,AAAA', stellar: 1 }, gallery: [{ sc: [[0, .4, .001], [100, .35, .01]], name: 'Old' }], copies: { 0: 3 }, intro: 1 })]; });
      const empty = { v: 3, got: {}, gallery: [], copies: {}, tried: {}, mode: 'free', slow: 0 };
      eq(r[0], empty); eq(r[1], empty); eq(r[2], empty);
      eq(r[3].got, { plate: { sc: [[0, 50, 200]] }, fern: 1 }); eq(r[3].gallery, [{ sc: [[0, 10, 10]], k: 'pad', name: 'img onerror=x' }]);
      eq(r[3].copies, { 0: 3, 1: 2, 2: 2, 5: 3 }, 'v2 copies remapped (Fern, Broad dropped)'); eq(r[3].tried, { 3: 2 });
      eq(r[4].got, { plate: 1, stellar: 1 }); eq(r[4].gallery, [{ sc: [[0, .4, .001], [100, .35, .01]], k: 'raw', name: 'Old' }]); eq(r[4].copies, {});
      for (const raw of ['{oops', '[]', JSON.stringify({ v: 3, mode: 'gallery', gallery: [{ sc: [[0, 1e9, -4]], k: 'pad' }, { sc: [[0, 60, 120]], k: 'pad', name: 'ok' }] })]) {
        await plant(page, raw); await page.waitForTimeout(800); ok(await page.locator('#rel').isEnabled(), 'page broken by ' + raw);
      }
      eq(await page.evaluate(() => [__snow.mode, __snow.SAVE.gallery.length]), ['gallery', 1]);
    },
    'progress counts only real forms and copies, and never exceeds 1': async ({ page, eq }) => {
      const all = { v: 3, got: Object.fromEntries(['plate', 'broad', 'stellar', 'fern', 'platearms', 'tips', 'seasons', 'x1', 'x2'].map(k => [k, 1])), copies: { 0: 3, 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3 }, tried: {}, gallery: [] };
      await plant(page, JSON.stringify(all)); eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).snowfall), 1);
      eq(await page.evaluate(() => Object.keys(__snow.SAVE.got).length), 7);
    },
    'phone layout: no errors switching modes': async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const m of ['copy', 'gallery', 'free']) { await page.evaluate(m => __snow.setMode(m), m); await page.waitForTimeout(200); }
    },
  },
};
