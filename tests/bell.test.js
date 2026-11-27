// Bellfounder (bell/): design a bell's profile, cast it, tune it on the lathe, ring the changes.
// Tests check the physics underneath (an axisymmetric finite-element model of the bronze shell), casting, the
// commission ladder with naive and competent bots, the change-ringing methods, saves, sharing and the phone layout.
// The page is opened with ?lite so software WebGL in CI renders a tiny frame quickly.
const ready = async page => { await page.waitForFunction(() => window.__bell && __bell.ready, null, { timeout: 90000 }); };
const reopen = async (page, hash = '') => { await page.goto(page.url().split('#')[0].split('?')[0] + '?lite' + hash); await page.reload(); await ready(page); };
const { botSrc } = require('./bell.bots.js');

module.exports = {
  page: 'bell/index.html?lite',
  ready,
  tests: {
    'physics: a real bell spectrum; a true-harmonic pattern sits at 0.5 : 1 : 1.2 : 1.5 : 2': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const { G, BP } = __bell, m = G.unitModes(G.sane(G.PATTERNS.simpson)), o = G.unitModes(G.sane(G.PATTERNS.old));
        const order = ['hum', 'prime', 'tierce', 'quint', 'nominal', 'duodeciem', 'octave2'].map(p => m.f[p]);
        return { order, dev: ['hum', 'tierce', 'quint', 'nominal'].map(p => BP.cents(m.f[p] / m.f.prime, BP.IDEAL[p])), oldT: BP.cents(o.f.tierce / o.f.prime, 1.2), kg: G.designModes({ ...G.sane(G.PATTERNS.simpson), D: .6 }).mass }; });
      ok(r.order.every((f, i) => !i || f > r.order[i - 1]), 'partials out of order ' + r.order);
      ok(r.dev.every(c => Math.abs(c) < 3), 'Simpson pattern not true: ' + r.dev.map(c => c.toFixed(1)));
      ok(r.oldT < -60, 'old-style bell should have a flat tierce: ' + r.oldT);
      ok(r.kg > 100 && r.kg < 200, 'a 600 mm bell should weigh about 140 kg: ' + r.kg);
    },
    'physics sanity: scaling by k scales frequency by 1/k; thinner or larger bells ring lower; waist cuts move the low partials, soundbow cuts the nominal': async ({ page, ok, near }) => {
      const r = await page.evaluate(() => { const { G, BP } = __bell, d = { ...G.sane(G.PATTERNS.simpson), D: .6 }, m1 = BP.modes(d), m2 = BP.modes({ ...d, D: .6 * 1.7 });
        const thin = BP.modes({ ...d, th: d.th.map(t => t * .9) }), big = BP.modes({ ...d, D: .66 });
        const cut = s => { const m = BP.modes(d, { cuts: [{ s, d: .001, w: .06 }] }); return Object.fromEntries(['hum', 'prime', 'nominal'].map(p => [p, BP.cents(m.f[p], m1.f[p])])); };
        return { scale: BP.PART.map(p => m1.f[p] / m2.f[p] / 1.7), mass: m2.mass / m1.mass / 1.7 ** 3, thin: BP.PART.every(p => thin.f[p] < m1.f[p]), big: BP.PART.every(p => big.f[p] < m1.f[p]), waist: cut(.68), bow: cut(.86), alloy: [BP.modes(d, { mat: BP.alloy(20) }).f.nominal, BP.modes(d, { mat: BP.alloy(25) }).f.nominal] }; });
      r.scale.forEach(x => near(x, 1, 1e-6, 'f ∝ 1/k')); near(r.mass, 1, 1e-6, 'mass ∝ k³');
      ok(r.thin, 'thinner walls should lower every partial'); ok(r.big, 'a larger bell should ring lower');
      ok(r.waist.hum < 0 && r.waist.prime < 0 && Math.abs(r.waist.hum) > 2 * Math.abs(r.waist.nominal) && Math.abs(r.waist.prime) > 2 * Math.abs(r.waist.nominal), 'waist thinning should move hum/prime more: ' + JSON.stringify(r.waist));
      ok(r.bow.nominal < 0 && Math.abs(r.bow.nominal) > Math.abs(r.bow.hum) && Math.abs(r.bow.nominal) > Math.abs(r.bow.prime), 'soundbow thinning should move the nominal most: ' + JSON.stringify(r.bow));
      ok(r.alloy[1] > r.alloy[0], 'more tin, stiffer metal');
    },
    'casting is deterministic; tin and cooling trade cracks against porosity': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const { G } = __bell, d = { ...G.sane(G.PATTERNS.simpson), D: .5 }, n = 300;
        const a = JSON.stringify(G.castBell(d, 23, .5, 'x1')), b = JSON.stringify(G.castBell(d, 23, .5, 'x1')), c = JSON.stringify(G.castBell(d, 23, .5, 'x2'));
        const rate = (tin, cool, k) => { let s = 0; for (let i = 0; i < n; i++) if (G.castBell(d, tin, cool, 'r' + i)[k]) s++; return s / n; };
        const b1 = G.freshBell(G.COMMS[3]); G.pour(b1, 'c4'); const b2 = G.freshBell(G.COMMS[3]); G.pour(b2, 'c4');
        return { same: a === b, diff: a !== c, crackHot: rate(27, .9, 'crack'), crackSafe: rate(22, .3, 'crack'), poroSlow: rate(22, 0, 'poro'), poroMid: rate(22, .55, 'poro'),
          pour: [G.bellModes(b1).f.nominal, G.bellModes(b2).f.nominal], q: [G.alloy ? 0 : 0] }; });
      ok(r.same && r.diff, 'cast seeds'); eq(r.pour[0], r.pour[1], 'the same pour twice gives the same bell');
      ok(r.crackHot > 3 * r.crackSafe && r.crackHot > .4, `tin-rich quick-cooled bells should crack: ${r.crackHot} vs ${r.crackSafe}`);
      ok(r.poroSlow > 3 * r.poroMid, `slow cooling should breed porosity: ${r.poroSlow} vs ${r.poroMid}`);
    },
    'bots: naive bells fail the single-bell orders; a competent founder fills every one': async ({ page, ok }) => {
      const r = await page.evaluate(src => { const B = eval(src)(__bell.G, __bell.BP), out = { naive: [], comp: [], shaves: [] };
        for (const c of __bell.G.COMMS.filter(c => !c.kind)) { if (B.play(c, { tune: false, design: false }).ok) out.naive.push(c.id); const p = B.play(c); if (p.ok) { out.comp.push(c.id); out.shaves.push(p.shaves); } else out.fail = [c.id, p.why, p.rows]; }
        return out; }, botSrc);
      ok(r.naive.length <= 1, 'naive bells accepted: ' + r.naive);
      ok(r.comp.length === 8, 'competent founder failed: ' + JSON.stringify(r.fail));
      ok(Math.max(...r.shaves) >= 6, 'some orders should take real work: ' + r.shaves);
    },
    'bots: rings of bells, scaled from one pattern; untuned rings fail': async ({ page, ok }) => {
      const r = await page.evaluate(src => { const B = eval(src)(__bell.G, __bell.BP), out = {};
        for (const c of __bell.G.COMMS.filter(c => c.kind === 'ring')) out[c.id] = [B.play(c, { tune: false }).ok, B.play(c).ok];
        return out; }, botSrc);
      for (const [id, [naive, comp]] of Object.entries(r)) { ok(!naive, id + ': an untuned ring was accepted'); ok(comp, id + ': the competent founder failed'); }
    },
    'change ringing: plain hunt, Plain Bob Minor and Major are true courses; the band hears a sour bell': async ({ page, ok, eq }) => {
      const r = await page.evaluate(src => { const { G } = __bell, B = eval(src)(G, __bell.BP);
        const course = (m, n) => { const R = G.rows(m, n), body = R.slice(3, R.length - 3); return { len: body.length - 1, uniq: new Set(body.slice(0, -1).map(x => x.join(''))).size, end: body[body.length - 1].join(''), perm: R.every(x => x.slice().sort().join() === [...Array(n).keys()].join()) }; };
        const c10 = G.COMMS.find(c => c.id === 'c10'), ring = B.play(c10).bells, res = ring.map(b => G.bellModes(b)), good = G.ringQuality(res, c10.notes);
        const sour = res.map((x, i) => i === 2 ? { ...x, f: Object.fromEntries(Object.entries(x.f).map(([k, v]) => [k, v * Math.pow(2, 22 / 1200)])) } : x);
        return { hunt: course('hunt', 6), minor: course('bobminor', 6), major: course('bobmajor', 8), good: good.q, sour: G.ringQuality(sour, c10.notes).q, words: G.ringQuality(sour, c10.notes).words.join(' ') }; }, botSrc);
      eq([r.hunt.len, r.hunt.uniq, r.hunt.end], [12, 12, '012345'], 'plain hunt on six'); eq([r.minor.len, r.minor.uniq, r.minor.end], [60, 60, '012345'], 'Plain Bob Minor plain course');
      eq([r.major.len, r.major.uniq, r.major.end], [112, 112, '01234567'], 'Plain Bob Major plain course'); ok(r.hunt.perm && r.minor.perm && r.major.perm);
      ok(r.good >= 86, 'a well-tuned ring should satisfy the band: ' + r.good); ok(r.sour < r.good - 15 && /bell 3/i.test(r.words), 'a sour third bell: ' + r.sour + ' ' + r.words);
    },
    'the lathe by hand: a drag outward from the inside wall shaves metal and the bell sounds lower; cuts cannot be undone; recasting starts over': async ({ page, ok, eq }) => {
      await page.waitForTimeout(500);
      const before = await page.evaluate(() => ({ nom: __bell.G.bellModes(__bell.bell()).f.nominal, seed: __bell.bell().cast.seed, st: __bell.stage }));
      eq(before.st, 'tune', 'the game opens at the lathe');
      const h = await page.evaluate(() => { const S = __bell.curSec, k = Math.round(S.i.length * .82), [x, y] = __bell.toScreen(...S.i[k]), [ox, oy] = __bell.toScreen(...S.o[k]), L = Math.hypot(ox - x, oy - y); return [x, y, (ox - x) / L, (oy - y) / L]; });
      await page.mouse.move(h[0], h[1]); await page.mouse.down(); await page.mouse.move(h[0] + h[2] * 90, h[1] + h[3] * 90, { steps: 6 }); await page.mouse.up();
      await page.waitForFunction(() => !__bell.busy, null, { timeout: 30000 });
      const after = await page.evaluate(() => ({ n: __bell.bell().cuts.length, shaves: __bell.bell().shaves, nom: __bell.G.bellModes(__bell.bell()).f.nominal, saved: JSON.parse(localStorage.getItem('rh:bellfounder')).work.c1.bells[0].cuts.length }));
      eq([after.n, after.shaves, after.saved], [1, 1, 1], 'one cut, saved'); ok(after.nom < before.nom - 1, 'nominal should fall: ' + before.nom + ' → ' + after.nom);
      ok(await page.evaluate(() => __bell.stage === 'tune' && !document.querySelector('[data-a="undo"]') && !/undo/i.test(document.getElementById('panel').innerText) && __bell.undo() === false), 'no undo on the lathe');
      // a drag across the empty air turns the view and cuts nothing
      await page.mouse.move(80, 400); await page.mouse.down(); await page.mouse.move(240, 420, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(300);
      eq(await page.evaluate(() => __bell.bell().cuts.length), 1, 'orbiting must not cut');
      await page.evaluate(() => __bell.act('pour')); await page.evaluate(() => __bell.finish()); await page.waitForFunction(() => !__bell.busy && __bell.stage === 'tune', null, { timeout: 30000 });
      const re = await page.evaluate(() => ({ n: __bell.bell().cuts.length, seed: __bell.bell().cast.seed, casts: __bell.bell().casts }));
      eq(re.n, 0, 'recast clears cuts'); ok(re.seed !== before.seed && re.casts === 2, 'a new casting');
    },
    'filling an order: deliver, stamps, the next order opens with a new verb; the book lists locked orders by name': async ({ page, ok, eq }) => {
      await page.evaluate(src => { const B = eval(src)(__bell.G, __bell.BP); B.tune(__bell.comm(), __bell.bell()); __bell.setStage('tune'); }, botSrc);
      await page.click('[data-a="deliver"]'); await page.waitForSelector('.modal');
      const m = await page.evaluate(() => ({ t: document.querySelector('.modal').innerText, open: __bell.S.open, rec: __bell.S.rec.c1 }));
      ok(/Delivered/.test(m.t) && /Next order/.test(m.t), m.t); eq(m.open, 1); ok(m.rec && m.rec.acc < 10 && m.rec.shaves >= 1);
      await page.click('.modal button.primary'); await page.waitForTimeout(400);
      eq(await page.evaluate(() => [__bell.S.cur, __bell.stage]), ['c2', 'design'], 'order 2 opens the drawing board');
      await page.evaluate(() => { __bell.S.open = 3; __bell.go('c4'); }); await page.waitForTimeout(300);
      eq(await page.evaluate(() => [__bell.stage, __bell.stagesFor(__bell.comm()), !!document.getElementById('tin') || (__bell.setStage('cast'), !!document.getElementById('tin'))]), ['design', ['design', 'cast', 'tune'], true], 'order 4 brings mould sizing and metal');
      await page.click('#bookBtn'); const book = await page.evaluate(() => document.querySelector('.ledger').innerText); ok(/Major-Third Bell/.test(book) && /Plain Bob Major/.test(book), 'locked orders are visible by name');
    },
    'casting from the pit: sliders set the mould and metal, the pour animates and lands at the lathe; a tin-poor bell is refused for a bright-bell order': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __bell.S.open = 6; __bell.go('c7'); __bell.setStage('cast'); });
      await page.$eval('#tin', e => { e.value = 21; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); });
      eq(await page.evaluate(() => __bell.bell().tin), 21);
      await page.click('[data-a="pour"]'); ok(await page.evaluate(() => __bell.busy), 'pour animates'); await page.waitForTimeout(300); await page.evaluate(() => __bell.finish());
      await page.waitForFunction(() => !__bell.busy && __bell.stage === 'tune', null, { timeout: 60000 });
      const v = await page.evaluate(src => { const B = eval(src)(__bell.G, __bell.BP); const b = __bell.bell(); if (b.cast.crack) return 'crack'; B.tune(__bell.comm(), b); return __bell.judgeNow().why; }, botSrc);
      ok(v === 'crack' || v.includes('too little tin'), 'should refuse soft metal: ' + v);
    },
    'design board: a spline of points and wall pegs; dragging the waist in raises hum and tierce against the prime, live, then strikes; Reset restores the pattern': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __bell.S.open = 4; __bell.go('c5'); __bell.setStage('design'); }); await page.waitForTimeout(400);
      const hs = await page.evaluate(() => __bell.handles().map(h => ({ ...h, xy: __bell.toScreen(h.r, h.y) })));
      ok(hs.filter(h => h.kind === 'pt' && !h.mirror).length >= 6 && hs.filter(h => h.kind === 'th').length >= 6 && ['height', 'flare', 'width'].every(k => hs.some(h => h.kind === k)), 'points, mirrored points, wall pegs and global grips: ' + hs.length);
      const w = hs.find(x => x.kind === 'pt' && x.k === 4 && !x.mirror);
      const r0 = await page.evaluate(() => __bell.ratios(__bell.G.unitModes(__bell.bell().des).f));
      await page.mouse.move(...w.xy); await page.mouse.down();
      for (let i = 1; i <= 6; i++) { await page.mouse.move(w.xy[0] - i * 4, w.xy[1]); await page.waitForTimeout(150); }
      const mid = await page.evaluate(() => ({ live: __bell.drag && __bell.drag.live, start: __bell.drag && __bell.drag.start, n: __bell.liveStats.length }));
      ok(mid.n >= 3, 'the gauge re-solves while dragging: ' + mid.n); ok(mid.live.hum > mid.start.hum + 5, 'live hum should rise as the waist comes in');
      await page.mouse.up(); await page.waitForTimeout(300);
      const after = await page.evaluate(() => { const b = __bell.bell(); return { p: b.des.pts[4], r: __bell.ratios(__bell.G.unitModes(b.des).f), undo: __bell.undoStack.length }; });
      ok(after.p[0] < w.r - .004, 'the waist moved in ' + after.p); ok(after.r.hum > r0.hum + 5 && after.r.tierce > r0.tierce, `hum and tierce rise against the prime: ${r0.hum.toFixed(1)}→${after.r.hum.toFixed(1)}, ${r0.tierce.toFixed(1)}→${after.r.tierce.toFixed(1)}`);
      eq(after.undo, 1, 'one edit, one undo step');
      // a wall peg: thicken the soundbow, the nominal rises against the prime
      const pk = await page.evaluate(() => { const h = __bell.handles().find(x => x.kind === 'th' && x.k === 6); return { xy: __bell.toScreen(h.r, h.y), nx: h.nx, nz: h.nz, th: __bell.bell().des.th[6], nom: __bell.ratios(__bell.G.unitModes(__bell.bell().des).f).nominal }; });
      const dir = await page.evaluate(([x, y, nx, nz]) => { const a = __bell.toScreen(...__bell.fromScreen(x, y)), p = __bell.fromScreen(x, y), b = __bell.toScreen(p[0] + nx * .1, p[1] + nz * .1); const L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; }, [...pk.xy, pk.nx, pk.nz]);
      await page.mouse.move(...pk.xy); await page.mouse.down(); await page.mouse.move(pk.xy[0] + dir[0] * 40, pk.xy[1] + dir[1] * 40, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(300);
      const pk2 = await page.evaluate(() => ({ th: __bell.bell().des.th[6], nom: __bell.ratios(__bell.G.unitModes(__bell.bell().des).f).nominal }));
      ok(pk2.th > pk.th + .002, 'dragging the soundbow peg inward thickens the wall: ' + pk.th + ' → ' + pk2.th);
      ok(pk2.nom > pk.nom + 3, `a thicker soundbow lifts the nominal against the prime: ${pk.nom.toFixed(1)} → ${pk2.nom.toFixed(1)}`);
      await page.click('[data-a="reset"]'); eq(await page.evaluate(() => __bell.bell().des.pts), await page.evaluate(() => __bell.G.sane(__bell.G.PATTERNS.old).pts));
    },
    'design board: undo steps back through edits; the live solve stays inside its frame budget; the heat map shows where metal matters': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __bell.S.open = 1; __bell.go('c2'); }); await page.waitForTimeout(300);
      const d0 = await page.evaluate(() => JSON.stringify(__bell.bell().des.pts));
      for (const k of [3, 5]) { const h = await page.evaluate(k => { const h = __bell.handles().find(h => h.kind === 'pt' && h.k === k && !h.mirror); return __bell.toScreen(h.r, h.y); }, k);
        await page.mouse.move(...h); await page.mouse.down(); await page.mouse.move(h[0] + 25, h[1] + 5, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(200); }
      eq(await page.evaluate(() => __bell.undoStack.length), 2);
      await page.click('[data-a="undo"]'); await page.keyboard.press('Control+z'); await page.waitForTimeout(200);
      eq(await page.evaluate(() => JSON.stringify(__bell.bell().des.pts)), d0, 'two undos restore the pattern'); eq(await page.evaluate(() => __bell.undoStack.length), 0);
      const t = await page.evaluate(() => { const { G } = __bell, d = __bell.bell().des, ms = []; for (let i = 0; i < 12; i++) { const dd = { ...d, th: d.th.map(x => x * (1 + .003 * i)) }; ms.push(G.liveModes(dd).ms); } ms.sort((a, b) => a - b); return ms[6]; });
      ok(t < 30, 'live re-solve median ' + t.toFixed(1) + ' ms (budget 30 ms)');
      await page.evaluate(() => __bell.computeHeat()); const hd = await page.evaluate(() => __bell.heatData);
      ok(hd && hd.v.length >= 10 && hd.v.some(([, v]) => v < -1) && hd.v.some(([, v]) => v > 1), 'heat map has places that lower and places that raise the partial');
    },
    'phone: the drawing board takes touch drags on its handles': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => { __bell.S.open = 1; __bell.go('c2'); }); await page.waitForTimeout(800);
      await page.waitForFunction(() => !__bell.gliding, null, { timeout: 60000 }); await page.waitForTimeout(300);
      const h = await page.evaluate(() => { const h = __bell.handles().find(h => h.kind === 'pt' && h.k === 4 && !h.mirror); return [...__bell.toScreen(h.r, h.y), h.r]; });
      ok(h[0] > 0 && h[0] < 390 && h[1] > 120 && h[1] < 650, 'waist handle on screen and clear of the panels: ' + h);
      const cam0 = await page.evaluate(() => __bell.camera.position.toArray());
      await page.evaluate(([x, y]) => { const cv = document.getElementById('gl'), ev = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
        ev('pointerdown', x + 6, y + 4); for (let i = 1; i <= 5; i++) ev('pointermove', x + 6 - i * 6, y + 4); ev('pointerup', x - 24, y + 4); }, h);
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({ r: __bell.bell().des.pts[4][0], u: __bell.undoStack.length, cam: __bell.camera.position.toArray() }));
      ok(r.r < h[2] - .002, 'a touch drag moved the waist: ' + r.r); eq(r.u, 1);
      ok(r.cam.every((v, i) => Math.abs(v - cam0[i]) < .05), 'dragging a handle must not turn the view');
      const cover = await page.evaluate(() => { const a = id => { const e = document.getElementById(id).getBoundingClientRect(); return e.width * e.height / (innerWidth * innerHeight); }; return a('ticket') + a('panel') + a('strip'); });
      ok(cover < .36, 'design UI covers ' + cover);
    },
    'ringing orders: the band judges your delivered ring; a sour ring is sent back': async ({ page, ok, eq }) => {
      const r = await page.evaluate(src => { const { G } = __bell, B = eval(src)(G, __bell.BP), c10 = G.COMMS.find(c => c.id === 'c10'), p = B.play(c10); __bell.S.rings.c10 = JSON.parse(JSON.stringify(p.bells)); __bell.S.open = 10; __bell.save(); __bell.go('c11'); return [__bell.stage, p.ok]; }, botSrc);
      eq(r, ['ring', true]);
      const q = await page.evaluate(() => __bell.judgeRing().q); ok(q >= 70, 'quality ' + q); await page.waitForSelector('.modal');
      eq(await page.evaluate(() => [!!__bell.S.rec.c11, __bell.S.open]), [true, 11]);
      await page.evaluate(() => { document.querySelector('.modal-bg').remove(); __bell.startRinging('hunt', false); }); ok(await page.evaluate(() => !!__bell.ringing && __bell.ringing.R.length === 4 + 12 + 3));
      // a ring with a sour bell is refused
      const q2 = await page.evaluate(() => { const b = __bell.S.rings.c10[1]; b.des.D *= 1.02; __bell.S.open = 12; __bell.go('c13'); return __bell.judgeRing().q; });
      ok(q2 < 80, 'sour ring quality ' + q2); eq(await page.evaluate(() => !!__bell.S.rec.c13), false);
    },
    'daily order and share: deterministic, spoiler-free share line, design links round-trip, junk refused': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const { G } = __bell, a = JSON.stringify(G.dailyFor('2026-11-25')), b = JSON.stringify(G.dailyFor('2026-11-25')), c = JSON.stringify(G.dailyFor('2026-11-26'));
        const d = G.sane(G.PATTERNS.old); d.D = .7; const s = G.encodeDesign(d, 24.5), back = G.decodeDesign(s);
        return { oldP: G.sane(G.PATTERNS.old).pts[3], same: a === b, diff: a !== c, back: [back.des.D, back.tin, back.des.pts[3]], bad: ['', 'x', '1_2_3', 'NaN_'.repeat(16), '9'.repeat(400)].map(G.decodeDesign) }; });
      ok(r.same && r.diff); eq(r.back, [.7, 24.5, r.oldP]); ok(r.bad.every(x => x === null), 'junk accepted');
      await page.evaluate(src => { const B = eval(src)(__bell.G, __bell.BP); __bell.S.open = 5; __bell.go('d:' + __bell.G.todayKey()); const c = __bell.comm(), p = B.play(c); __bell.work().bells[0] = p.bells[0]; __bell.setStage('tune'); __bell.deliver(); }, botSrc);
      const line = await page.evaluate(() => __bell.shareLine());
      ok(/^Bellfounder · daily \d{4}-\d\d-\d\d · [✦·][◆·][◉·] · ±\d+\.\d¢ · \d+ kg · \d+ cuts$/.test(line), 'share line: ' + line);
      const link = await page.evaluate(() => __bell.shareLink()); ok(/#b=[\d._]+$/.test(link), link);
      await reopen(page, '#b=' + link.split('#b=')[1]);
      eq(await page.evaluate(() => [__bell.S.cur, __bell.stage, !!__bell.bell().cast]), ['sandbox', 'design', false]);
    },
    'saves: progress persists; corrupted saves are ignored safely': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __bell.S.open = 3; __bell.go('c4'); }); await reopen(page);
      eq(await page.evaluate(() => [__bell.S.cur, __bell.S.open]), ['c4', 3]);
      for (const junk of ['{', 'null', '[]', '"x"', '{"open":99,"cur":"c14","rec":5}', '{"open":-4,"cur":"zz","work":{"c1":{"bells":[null]}}}',
        '{"open":2,"cur":"c3","work":{"c3":{"slot":9,"bells":[{"des":{"D":"x","pts":[[1,2]],"th":"q"},"tin":1e9,"cuts":[{"s":0.5,"d":-1,"w":0.05},{"s":"a"},{"s":0.4,"d":0.001,"w":0.05}],"cast":{"shrink":0.017,"dev":[[1,"x",3]],"split":{}}}]}},"rec":{"c1":{"acc":"NaN"},"c2":{"acc":3,"kg":-1}},"patterns":[{"name":5},{"name":"p","des":{"D":99}}],"rings":{"c10":[{"x":1}]}}',
        '{"open":13,"cur":"c11","stage":"weird","rings":{"c10":"no"},"daily":{"2026-01-01":{"acc":"x"},"bad":{"acc":1}},"sandbox":{"des":null,"cast":{"shrink":"x"}}}']) {
        await page.evaluate(j => localStorage.setItem('rh:bellfounder', j), junk); await reopen(page);
        const s = await page.evaluate(() => { const S = __bell.S, b = __bell.bell(); return { open: S.open, cur: S.cur, stage: __bell.stage, card: document.getElementById('ticket').textContent.length,
          okBells: Object.values(S.work).every(w => w.bells.every(b => b.des.pts.length === __bell.G.NP && b.des.th.every(Number.isFinite) && b.tin <= 32 && b.cuts.every(c => c.d > 0))),
          okRec: Object.values(S.rec).every(r => Number.isFinite(r.acc)) }; });
        ok(s.open >= 0 && s.open < 14 && s.card > 20 && ['design', 'cast', 'tune', 'ring'].includes(s.stage) && s.okBells && s.okRec, 'broken by ' + junk + ' → ' + JSON.stringify(s));
      }
    },
    'no WebGL: the page says so plainly and the foundry still works in flat section': async ({ page, ok, eq }) => {
      await page.goto(page.url().split('?')[0] + '?lite&nogl'); await ready(page);
      ok(await page.isVisible('#rh-nogl'), 'noGL message'); eq(await page.evaluate(() => __bell.ok3d), false);
      const r = await page.evaluate(() => { const b = __bell.bell(), f0 = __bell.G.bellModes(b).f.nominal; __bell.doShave(.85, __bell.G.maxCut(b) * .5); __bell.finish(); return [f0, b.cuts.length]; });
      await page.waitForTimeout(300); eq(r[1], 1); ok(await page.evaluate(f0 => __bell.G.bellModes(__bell.bell()).f.nominal < f0, r[0]), 'the cut still lowers the bell');
    },
    'phone (390x844): the foundry fills the screen; UI stays off most of it; no tiny buttons': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
      const r = await page.evaluate(() => { const a = id => { const e = document.getElementById(id).getBoundingClientRect(); return e.width * e.height / (innerWidth * innerHeight); };
        return { gl: a('gl'), ticket: a('ticket'), panel: a('panel'), strip: a('strip'), sx: document.documentElement.scrollWidth, small: [...document.querySelectorAll('button,input[type=range]')].filter(b => { const q = b.getBoundingClientRect(); return q.width && Math.min(q.width, q.height) < 28; }).map(b => b.textContent) }; });
      ok(r.gl > .99, 'canvas'); ok(r.ticket + r.panel + r.strip < .33, 'UI covers ' + JSON.stringify(r)); ok(r.sx <= 391, 'sideways scroll'); ok(!r.small.length, 'tiny: ' + r.small);
    },
  },
};
