// Soap (hypothesis/): an explorable of soap films. Tests check the physics underneath the pictures (thin-film
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
      const box = await page.evaluate(() => { const c = document.getElementById('gl').getBoundingClientRect(); return [c.width, c.height]; });
      await page.mouse.click(box[0] * .5, box[1] * .42); await page.waitForTimeout(500);
      const s = await page.evaluate(() => ({ rev: __soap.st.revealed, net: !!__soap.fig.net, err: __soap.st.err, txt: document.getElementById('card').textContent }));
      ok(s.rev && s.net && Number.isFinite(s.err), 'tap did not reveal ' + JSON.stringify(s)); ok(s.txt.includes('120'));
      await page.evaluate(() => __soap.go(3)); await page.waitForTimeout(200);
      ok(await page.evaluate(() => __soap.fig.hidden === true), 'cube film should be hidden until you predict');
      await page.click('[data-pred="cube"][data-k="faces"]'); await page.waitForTimeout(200);
      eq(await page.evaluate(() => [__soap.SAVE.preds.cube, __soap.fig.hidden]), ['faces', false]);
      ok(await page.evaluate(() => !!document.querySelector('[data-pred]') === false || document.querySelector('.right')), 'the right answer should be marked');
    },
    'moving a pin: the film follows and its junctions re-balance at 120°': async ({ page, ok }) => {
      await page.evaluate(() => { __soap.SAVE.preds.square = 'h'; __soap.go(2); }); await page.waitForTimeout(300);
      const before = await page.evaluate(() => __soap.fig.pins.map(p => p.slice()));
      const moved = await page.evaluate(() => { const f = __soap.fig; f.pins[0] = [f.pins[0][0] + .3, f.pins[0][1]]; f.net.n[0].x += .3; for (let i = 0; i < 400; i++) f.net.step(); return f.net.junctionAngles(); });
      ok(moved.every(a => Math.abs(a - 120) < 3), 'junctions should re-balance: ' + moved);
      ok(before[0][0] !== (await page.evaluate(() => __soap.fig.pins[0][0])));
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
      for (const junk of ['{', 'null', '{"ch":99,"seen":"x","preds":5}', '{"ch":-1,"seen":[1,2,99,"a"],"best":{"a":"NaN"}}']) {
        await page.evaluate(j => localStorage.setItem('rh:soap', j), junk); await reopen(page);
        ok(await page.evaluate(() => __soap.ch >= 0 && __soap.ch < 6 && !!__soap.fig && document.getElementById('card').textContent.length > 20), 'broken by ' + junk);
      }
    },
    'phone (390x844): the 3D view fills the screen; the caption covers under a third of it': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
      const r = await page.evaluate(() => { const c = document.getElementById('card').getBoundingClientRect(), g = document.getElementById('gl').getBoundingClientRect(); return { card: c.height * c.width / (innerWidth * innerHeight), gl: g.width * g.height / (innerWidth * innerHeight), sx: document.documentElement.scrollWidth }; });
      ok(r.gl > .99, 'canvas'); ok(r.card < .34, 'card covers ' + r.card); ok(r.sx <= 391, 'sideways scroll');
      const small = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && Math.min(r.width, r.height) < 28; }).length); ok(small === 0, small + ' tiny buttons');
    },
  },
};
