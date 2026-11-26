// Soap (hypothesis/): an explorable of soap films, and a surveyor's book of 24 commissions plus a daily plate. Tests check the physics underneath the pictures (thin-film
// interference, Steiner networks with 120° junctions and local minima, mean-curvature relaxation of 3D films with
// Plateau's angles, the double bubble), the predict-then-reveal flow, share links and saves.
// The page is opened with ?lite so software WebGL in CI renders a tiny frame quickly.
const ready = async page => { await page.waitForFunction(() => window.__soap && __soap.fig, null, { timeout: 60000 }); };
const reopen = async (page, hash = '') => { await page.goto(page.url().split('#')[0].split('?')[0] + '?lite' + hash); await page.reload(); await ready(page); };

module.exports = {
  page: 'hypothesis/index.html?lite',
  ready,
  tests: {
    'thin-film interference: a film thinner than ~20 nm is black; colours cycle with thickness': async ({ page, ok, near }) => {
      const r = await page.evaluate(() => { const S = __soap; return {
        r0: S.filmR(550, 0), rq: S.filmR(550, 550 / 4 / 1.33), rh: S.filmR(550, 550 / 2 / 1.33),
        black: S.filmRGB(12).every(c => c < .004), thick: S.filmRGB(300), hue: [150, 250, 350, 450, 550].map(d => S.filmRGB(d).map(c => +c.toFixed(3))) }; });
      near(r.r0, 0, 1e-9, 'no film, no reflection'); ok(r.rq > .07 && r.rq < .1, 'quarter-wave film reflects most: ' + r.rq); near(r.rh, 0, 1e-6, 'half-wave film cancels');
      ok(r.black, 'very thin film should be black'); ok(new Set(r.hue.map(c => c.indexOf(Math.max(...c)))).size >= 2, 'colours should change with thickness');
    },
    'three pins: the films meet once, at 120°; past 120° the junction dives into the pin': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const S = __soap;
        const tri = S.Net.dip([[0, 1], [-.87, -.5], [.87, -.5]], .3, -.2).settle(2500), j = tri.n.find(p => p.on && !p.pin);
        const obt = S.Net.dip([[-1.5, 0], [1.5, 0], [0, .3]], 0, -.4).settle(2500);
        return { free: tri.freeCount(), j: [j.x, j.y], ang: tri.junctionAngles(), obtFree: obt.freeCount(), obtL: obt.length() }; });
      eq(r.free, 1); ok(Math.hypot(...r.j) < .02, 'junction should sit at the Fermat point'); ok(r.ang.every(a => Math.abs(a - 120) < 1.5), 'angles ' + r.ang);
      eq(r.obtFree, 0, 'with a corner over 120° the film runs pin to pin'); ok(Math.abs(r.obtL - 2 * Math.hypot(1.5, .3)) < .01);
    },
    'four pins in a square: two 120° junctions and a bridge; soap beats straight roads by up to the Steiner ratio': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const S = __soap, sq = [[-1, -1], [1, -1], [1, 1], [-1, 1]], N = S.Net.dip(sq, .05, .02).settle(3000);
        return { free: N.freeCount(), L: N.length(), mst: S.mst(sq), ang: N.junctionAngles() }; });
      ok(r.free === 2, 'expected two junctions, got ' + r.free); ok(Math.abs(r.L - 2 * (1 + Math.sqrt(3))) < .02, 'length ' + r.L);
      ok(r.ang.every(a => Math.abs(a - 120) < 2)); ok(r.L / r.mst >= Math.sqrt(3) / 2 - 1e-3 && r.L < r.mst, 'ratio ' + r.L / r.mst);
    },
    'soap finds local minima: re-dipping gives different networks; the best known is the minimum and deterministic per seed': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const S = __soap, towns = [[-1.5, .2], [-.6, 1.4], [.9, 1.2], [1.6, -.2], [.4, -1.5], [-1, -1.1]], rnd = RH.rng('x');
        const Ls = Array.from({ length: 24 }, () => +S.soapDip(towns, rnd).length().toFixed(3));
        return { Ls, best: S.bestKnown(towns, 'k1', 40), best2: S.bestKnown(towns, 'k1', 40), mst: S.mst(towns) }; });
      ok(new Set(r.Ls).size >= 2, 'every dip gave the same network: ' + r.Ls); eq(r.best, r.best2);
      ok(r.best <= r.mst + 1e-6, 'best known should be no longer than straight roads: ' + r.best + ' vs ' + r.mst); ok(Math.min(...r.Ls) <= r.mst + 1e-6, 'some dip should beat or match straight roads');
    },
    'films in 3D: relaxation lowers area, borders meet at 120°, and the cube grows its little square': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const S = __soap, out = {};
        for (const [k, F] of [['tet', S.buildTetra(9)], ['cube', S.buildCube(8)]]) { const a0 = F.area(); for (let i = 0; i < 8; i++) F.relax(100); const a1 = F.area();
          const angs = [...F.lineNb.keys()].filter((_, i) => i % 5 === 2).map(i => S.borderAngle(F, i)).filter(Boolean).flat();
          const sq = k === 'cube' ? F.get(F.keys.get('s-1-1')).distanceTo(F.get(F.keys.get('s1-1'))) : null; out[k] = { a0, a1, angs, sq, fin: F.X.every(Number.isFinite) }; }
        return out; });
      for (const k of ['tet', 'cube']) { const x = r[k]; ok(x.fin, k + ' blew up'); ok(x.a1 <= x.a0 + 1e-6, `${k} area rose ${x.a0} → ${x.a1}`); ok(x.angs.length > 5 && x.angs.every(a => Math.abs(a - 120) < 8), `${k} angles ${x.angs.map(Math.round)}`); }
      ok(r.cube.sq > .15 && r.cube.sq < .8, 'square edge ' + r.cube.sq);
    },
    'the double bubble: outer films meet at 120° and the wall curves as 1/r_small − 1/r_big': async ({ page, ok, near }) => {
      const r = await page.evaluate(() => { const S = __soap, g = S.doubleBubble(1, .6), eq = S.doubleBubble(.7, .7);
        // angle between the two outer spheres' normals at the junction circle
        const cosA = (1 + .36 - g.d * g.d) / (2 * 1 * .6); return { g, eq, ang: Math.acos(cosA) * 180 / Math.PI }; });
      near(r.ang, 60, 1e-6, 'sphere normals at 60° means films meet at 120°'); near(1 / r.g.r3, 1 / .6 - 1 / 1, 1e-9); ok(!isFinite(r.eq.r3), 'equal bubbles share a flat wall');
    },
    'predict, then reveal: Plate II waits for a tap; Plate III/IV/V record the guess and reveal': async ({ page, ok, eq }) => {
      await page.evaluate(() => __soap.go(1)); await page.waitForTimeout(300);
      ok(await page.evaluate(() => !__soap.fig.net && !__soap.st.revealed), 'films should wait for a guess');
      const at = await page.evaluate(() => { __soap.camera.position.copy(__soap.camGoal.p); __soap.controls.target.copy(__soap.camGoal.t); __soap.controls.update(); return __soap.toScreen(.1, 0, .1); });
      await page.mouse.click(...at); await page.waitForTimeout(500);
      const s = await page.evaluate(() => ({ rev: __soap.st.revealed, net: !!__soap.fig.net, err: __soap.st.err, txt: document.getElementById('card').textContent }));
      ok(s.rev && s.net && Number.isFinite(s.err), 'tap did not reveal ' + JSON.stringify(s)); ok(s.txt.includes('120'));
      await page.evaluate(() => __soap.go(3)); await page.waitForTimeout(200);
      ok(await page.evaluate(() => __soap.fig.hidden === true), 'cube film should be hidden until you predict');
      await page.click('[data-pred="cube"][data-k="faces"]'); await page.waitForTimeout(200);
      eq(await page.evaluate(() => [__soap.SAVE.preds.cube, __soap.fig.hidden]), ['faces', false]);
      ok(await page.evaluate(() => !!document.querySelector('[data-pred]') === false || document.querySelector('.right')), 'the right answer should be marked');
    },
    'moving a pin: the film follows and its junctions re-balance at 120°': async ({ page, ok }) => {
      await page.evaluate(() => { __soap.go(5); __soap.act('sb-pins'); __soap.fig.net.settle(2000); }); await page.waitForTimeout(300);
      const before = await page.evaluate(() => __soap.fig.pins.map(p => p.slice()));
      const moved = await page.evaluate(() => { const f = __soap.fig; f.pins[0] = [f.pins[0][0] + .3, f.pins[0][1]]; f.net.n[0].x += .3; for (let i = 0; i < 1500; i++) f.net.step(); return f.net.junctionAngles(); });
      ok(moved.length && moved.every(a => Math.abs(a - 120) < 3), 'junctions should re-balance: ' + moved);
      ok(before[0][0] !== (await page.evaluate(() => __soap.fig.pins[0][0])));
    },
    'glass walls and posts: films end on them square (90°), pass through them for free, never through them; junctions stay at 120°': async ({ page, ok, near }) => {
      const r = await page.evaluate(() => { const S = __soap, rnd = () => RH.rng('t');
        const wall = { t: 'wall', a: [-2, 0], b: [2, 0] }, post = { t: 'post', c: [0, 0], r: .4 };
        const W = S.Net.build([[-1, .8], [1.2, .8]], [wall]).rest(rnd()), P = S.Net.build([[-1.5, .05], [1.5, -.05]], [post]).rest(rnd());
        // a film forced straight through a post is cut in two, and both halves end on it
        const X = new S.Net([[-1.5, .1], [1.5, .1]], [post]); X.link(0, 1); X.settle(800, rnd());
        const plates = [7, 11, 13, 17, 20, 23].map(i => { const pl = S.plateFor(i), N = S.lift(pl, S.BAKED[i][3]); return { i, tilt: N.contactTilts(), ang: N.junctionAngles(), joined: N.connected(), L: N.length(), best: pl.best, nC: N.n.filter(p => p.on && p.s >= 0).length }; });
        return { W: [W.length(), W.contactTilts()], P: [P.length(), P.contactTilts()], X: [X.length(), X.connected(), X.contactTilts()], plates }; });
      near(r.W[0], 1.6, 2e-3, 'two pins reach the wall square on'); ok(r.W[1].every(t => t < 1), 'wall tilts ' + r.W[1]);
      near(r.P[0], 2 * Math.hypot(1.5, .05) - .8, .01, 'two pins reach the post along its radii'); ok(r.P[1].every(t => t < 1.5), 'post tilts ' + r.P[1]);
      ok(r.X[1] && r.X[0] < 2.3, 'film through a post should be cut: ' + r.X); ok(r.X[2].length === 2 && r.X[2].every(t => t < 1.5), 'cut film meets post square: ' + r.X[2]);
      for (const p of r.plates) { ok(p.joined, `plate ${p.i} fell apart`); ok(p.nC > 0, `best network of ${p.i} should lean on glass`); ok(p.tilt.every(t => t < 2.5), `plate ${p.i} tilts ${p.tilt.map(Math.round)}`);
        ok(p.ang.every(a => Math.abs(a - 120) < 2.5), `plate ${p.i} angles ${p.ang.map(Math.round)}`); near(p.L, p.best, 1e-3, 'baked best reproduces'); }
    },
    'the catenoid: none past a gap of 1.3255 radii; the stable film is the fatter one; it outgrows two discs past 1.0554 (Goldschmidt)': async ({ page, ok, near }) => {
      const r = await page.evaluate(() => { const S = __soap, c = S.catenoid, two = 2 * Math.PI;
        const a = c(1, .8), ok1 = Math.abs(a.a * Math.cosh(.4 / a.a) - 1) < 1e-9; let lo = .5, hi = 1.32; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (c(1, m).A < two) lo = m; else hi = m; }
        return { hmax: S.CAT_HMAX, at: !!c(1, 1.325), past: c(1, 1.326), ok1, gold: lo, neck08: a.neck, neck12: c(1, 1.2).neck }; });
      near(r.hmax, 1.3255, 1e-4); ok(r.at && r.past === null, 'existence edge'); ok(r.ok1, 'the film meets the rings'); near(r.gold, 1.0554, 1e-3, 'Goldschmidt gap');
      ok(r.neck08 > r.neck12 && r.neck12 > .4, 'neck narrows as rings part: ' + [r.neck08, r.neck12]);
      await page.evaluate(() => { __soap.SAVE.preds.cube = 'square'; __soap.go(3); __soap.act('rings'); }); await page.waitForTimeout(300);
      ok(await page.evaluate(() => document.getElementById('card').textContent.includes('snap')), 'asks for a guess first');
      await page.click('[data-pred="neck"][data-k="r13"]'); await page.evaluate(() => { __soap.fig.h = 1.45; }); await page.waitForTimeout(1500);
      const s = await page.evaluate(() => ({ sn: __soap.fig.cat.snapped, neck: __soap.SAVE.neck.slice(), txt: document.getElementById('readout').textContent }));
      ok(s.sn && s.neck.length === 1 && s.neck[0] > 1.25 && s.neck[0] < 1.4, 'snap recorded ' + JSON.stringify(s)); ok(s.txt.includes('snapped'));
      await page.evaluate(() => { __soap.fig.h = .7; }); await page.waitForTimeout(400); ok(await page.evaluate(() => __soap.fig.cat.snapped), 'two discs do not rejoin when the rings come back');
    },
    'commissions are deterministic: plates, lifts, the daily plate, and the baked table match what the page works out': async ({ page, ok, eq, near }) => {
      const r = await page.evaluate(() => { const S = __soap, B = S.BAKED;
        const same = [0, 5, 12, 23].every(i => JSON.stringify(S.plateFor(i)) === JSON.stringify(S.plateFor(i)));
        const bake = [3, 9, 18].map(i => { const pl = S.genPlate(i, B[i][0]); return [S.bestFor(pl).best, B[i][1]]; });
        const pl = S.plateFor(15), m = [[.3, .2], [-.5, .9]], L1 = S.lift(pl, m).length(), L2 = S.lift(pl, m).length();
        const d1 = JSON.stringify(S.plateFor('d:2026-11-25')), d2 = JSON.stringify(S.plateFor('d:2026-11-25')), d3 = JSON.stringify(S.plateFor('d:2026-11-26'));
        return { same, bake, L1, L2, d: [d1 === d2, d1 !== d3], n: Object.keys(B).length }; });
      ok(r.same, 'plates differ between calls'); r.bake.forEach(([a, b]) => near(a, b, 1e-4, 'baked best')); eq(r.L1, r.L2); eq(r.d, [true, true]); eq(r.n, 24);
      // the animated lift ends exactly where the pure one does
      await page.evaluate(() => { __soap.SAVE.preds.square = 'h'; __soap.go(2); __soap.fig.setMarks([[.9, .1], [-1.1, 0]]); __soap.act('lift'); });
      await page.waitForFunction(() => __soap.st.out, null, { timeout: 30000 });
      const a = await page.evaluate(() => [__soap.st.animL, __soap.st.out.L]); near(a[0], a[1], 1e-9, 'animation and score agree');
    },
    'bots: naive lifts and scattered marks fail; a competent surveyor gets nearly every commission accepted': async ({ page, ok }) => {
      const r = await page.evaluate(src => { const B = eval(src), S = __soap, out = { naive: 0, scatter: 0, comp: 0, lifts: [], n: S.NCOMM }, rnd = RH.rng('scatter');
        for (let i = 0; i < S.NCOMM; i++) { const pl = S.plateFor(i); if (B.naive(pl).ok) out.naive++; for (let k = 0; k < 3; k++) if (B.scatter(pl, rnd).ok) out.scatter++;
          const c = B.competent(pl); if (c.ok) { out.comp++; out.lifts.push(c.lifts); } }
        return out; }, require('./hypothesis.bots.js').botSrc);
      ok(r.naive <= 2, `naive lifts were accepted on ${r.naive}/24`); ok(r.scatter <= .25 * 3 * r.n, `scattered marks accepted ${r.scatter}/${3 * r.n}`);
      ok(r.comp >= 20, `competent surveyor accepted only ${r.comp}/24`); ok(Math.max(...r.lifts) > 5, 'some commissions should take real work');
    },
    'a lift is scored three ways and kept; the book opens the next commission, the daily, and later plates': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __soap.SAVE.preds.square = 'h'; __soap.go(2); __soap.act('lift'); }); await page.waitForFunction(() => __soap.st.out, null, { timeout: 30000 });
      let s = await page.evaluate(() => ({ o: __soap.st.out, rec: __soap.SAVE.rec.c0, card: document.getElementById('card').textContent }));
      ok(s.o.acc && s.o.tru && !s.o.cle, 'unmarked lift: accepted but no foresight ' + JSON.stringify(s.o)); eq(s.rec.s, 'at'); ok(s.card.includes('foresight'));
      await page.evaluate(() => { __soap.fig.setMarks(__soap.BAKED[0][3].map(([x, y]) => [x + .03, y - .02])); __soap.act('lift'); }); await page.waitForFunction(() => !__soap.st.anim && __soap.st.lifts === 2, null, { timeout: 30000 });
      s = await page.evaluate(() => ({ o: __soap.st.out, rec: __soap.SAVE.rec.c0 })); ok(s.o.cle && s.o.f < .05, 'marked lift earns foresight'); eq(s.rec.s, 'atc'); eq(s.rec.first, 1);
      eq(await page.evaluate(() => [__soap.chOpen(3), __soap.accepted()]), [false, 1]);
      // a locked plate stays shut from the nav
      await page.click('#nav [data-c="3"]'); await page.waitForTimeout(200); eq(await page.evaluate(() => __soap.ch), 2);
      await page.click('[data-act="cnext"]'); await page.waitForTimeout(300); eq(await page.evaluate(() => __soap.st.id), 1);
      await page.evaluate(() => { for (let i = 0; i < 6; i++) __soap.SAVE.rec['c' + i] = { L: 9, f: 9, n: 1, first: 1, s: 'a' }; __soap.go(2); });
      eq(await page.evaluate(() => [__soap.chOpen(3), __soap.chOpen(4), __soap.st.id]), [true, false, 1], 'the book reopens where you were');
      await page.click('.ladder [data-cm="d"]'); await page.waitForTimeout(400); ok(await page.evaluate(() => typeof __soap.st.id === 'string' && __soap.st.plate.pins.length >= 6), 'daily opens');
      await page.evaluate(() => __soap.act('lift')); await page.waitForFunction(() => __soap.st.out, null, { timeout: 60000 });
      const line = await page.evaluate(() => __soap.shareLine()); ok(/^Soap · daily \d{4}-\d\d-\d\d · [✦·][◆·][◉·] · [+−]\d+\.\d% · foresight/.test(line) && line.length < 140 && !/\d\.\d{3}/.test(line), 'share line: ' + line);
    },
    'pencil marks by hand: a tap marks the glass, a drag turns the view, a tap on a mark rubs it out; marks survive a reload': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __soap.SAVE.preds.square = 'h'; __soap.go(2, { snap: true }); }); await page.waitForTimeout(500);
      const at = await page.evaluate(() => __soap.toScreen(.6, .6, .4)); await page.mouse.click(...at); await page.waitForTimeout(200);
      let m = await page.evaluate(() => __soap.fig.marks); eq(m.length, 1, 'tap adds a mark'); ok(Math.hypot(m[0][0] - .6, m[0][1] - .4) < .08, 'mark lands where tapped ' + m);
      const cam0 = await page.evaluate(() => __soap.camera.position.toArray()); const p2 = await page.evaluate(() => __soap.toScreen(-.8, .6, -.6));
      await page.mouse.move(...p2); await page.mouse.down(); await page.mouse.move(p2[0] + 120, p2[1] + 10, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
      eq(await page.evaluate(() => __soap.fig.marks.length), 1, 'a drag must not mark'); ok(await page.evaluate(c => __soap.camera.position.distanceTo(new __soap.camera.position.constructor(...c)) > .05, cam0), 'a drag turns the view');
      await page.reload(); await page.waitForFunction(() => window.__soap && __soap.fig, null, { timeout: 60000 }); await page.waitForTimeout(800);
      eq(await page.evaluate(() => [__soap.ch, __soap.fig.marks.length]), [2, 1], 'marks kept');
      const mk = await page.evaluate(() => { const [x, z] = __soap.fig.marks[0]; return __soap.toScreen(x, .6, z); }); await page.mouse.click(...mk); await page.waitForTimeout(200);
      eq(await page.evaluate(() => __soap.fig.marks.length), 0, 'tap on a mark rubs it out');
    },
    'share links: a frame round-trips through the URL; junk is refused': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const S = __soap; return { a: S.decode(S.encodeStr({ f: 'pins', p: [[0, 1], [1, 0], [-1, -1]] })), b: S.decode(S.encodeStr({ f: 'cube', o: Array(8).fill([.1, 0, 9]) })),
        bad: ['', 'xyz', btoa('{"f":"pins","p":[[1,2]]}'), btoa(encodeURIComponent('{"f":"evil"}'))].map(S.decode) }; });
      eq(r.a.f, 'pins'); eq(r.a.p.length, 3); ok(r.b.o.every(v => v[2] === .45), 'offsets should be clamped'); ok(r.bad.every(x => x === null), 'junk accepted');
      const h = await page.evaluate(() => '#frame=' + __soap.encodeStr({ f: 'pins', p: [[-1, 0], [1, 0], [0, 1.2], [0, -1.2]] }));
      await reopen(page, h);
      eq(await page.evaluate(() => [__soap.ch, __soap.fig.kind, __soap.fig.pins.length]), [5, 'pins', 4]);
      ok((await page.evaluate(() => __soap.shareLink())).includes('#frame='));
    },
    'saves: progress persists; corrupted saves are ignored': async ({ page, ok, eq }) => {
      await page.evaluate(() => __soap.go(2)); await reopen(page);
      eq(await page.evaluate(() => __soap.ch), 2);
      for (const junk of ['{', 'null', '[]', '{"ch":99,"seen":"x","preds":5}', '{"ch":-1,"seen":[1,2,99,"a"],"best":{"a":"NaN"}}',
        '{"ch":2,"preds":{"square":"h"},"cur":77,"rec":{"c0":{"L":"x"},"c99":{"L":1,"s":"atc"},"c1":{"L":-3},"c2":7},"marks":{"c0":[[1,"a"],[99,99],null],"c5":"zz"},"bk":{"d:2026-01-01":{"best":"NaN","hist":[1]}},"g2":"x","neck":[1,null],"streak":{"d":5,"n":"9"}}',
        '{"ch":2,"preds":{"square":"h"},"cur":3,"rec":{"c0":{"L":1e999,"s":{}}},"marks":{"c0":[[0.1,0.2,{"x":1}]]}}']) {
        await page.evaluate(j => localStorage.setItem('rh:soap', j), junk); await reopen(page);
        ok(await page.evaluate(() => __soap.ch >= 0 && __soap.ch < 6 && !!__soap.fig && document.getElementById('card').textContent.length > 20), 'broken by ' + junk);
        ok(await page.evaluate(() => { const S = __soap.SAVE; return Object.keys(S.rec).every(k => /^c\d+$|^d:/.test(k) && S.rec[k].L > 0 && isFinite(S.rec[k].L)) && S.cur >= 0 && S.cur < 24 && Object.values(S.marks).every(a => Array.isArray(a) && a.every(p => p.length === 2 && p.every(Number.isFinite))); }), 'junk survived in the save: ' + junk);
      }
    },
    'phone (390x844): the 3D view fills the screen; the caption covers under a third of it': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
      const r = await page.evaluate(() => { const c = document.getElementById('card').getBoundingClientRect(), g = document.getElementById('gl').getBoundingClientRect(); return { card: c.height * c.width / (innerWidth * innerHeight), gl: g.width * g.height / (innerWidth * innerHeight), sx: document.documentElement.scrollWidth }; });
      ok(r.gl > .99, 'canvas'); ok(r.card < .34, 'card covers ' + r.card); ok(r.sx <= 391, 'sideways scroll');
      await page.evaluate(() => { __soap.SAVE.preds.square = 'h'; __soap.go(2); __soap.act('lift'); }); await page.waitForFunction(() => __soap.st.out, null, { timeout: 30000 });
      const c2 = await page.evaluate(() => { const c = document.getElementById('card').getBoundingClientRect(); return c.height * c.width / (innerWidth * innerHeight); }); ok(c2 < .34, 'commission card covers ' + c2);
      const small = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && Math.min(r.width, r.height) < 28; }).length); ok(small === 0, small + ' tiny buttons');
    },
  },
};
