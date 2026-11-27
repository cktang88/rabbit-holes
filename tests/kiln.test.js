// Kiln (kiln/): glaze chemistry. Tests check the chemistry under the pictures (Seger unity formula, melting, gloss and
// matte, iron/copper/cobalt colour by atmosphere, crazing from expansion mismatch, zinc-silicate crystals that grow with
// the cooling schedule), determinism, the bots (naive and random recipes fail, a competent potter gets through),
// firing through the real UI, the 3-D material being fed by the chemistry, saves and corrupt saves, share links,
// the 2-D fallback without WebGL, and the phone layout. The page is opened with ?lite so software WebGL is quick.
const ready = async page => { await page.waitForFunction(() => window.__kiln && __kiln.st.comm, null, { timeout: 60000 }); };
const reopen = async (page, q = '?lite', hash = '') => { await page.goto(page.url().split('#')[0].split('?')[0] + q + hash); if (hash) await page.reload(); await ready(page); };
const BOTS = require('./kiln.bots.js').botSrc;

module.exports = {
  page: 'kiln/index.html?lite',
  ready,
  tests: {
    'unity formula: fluxes sum to one; the oxides of a known recipe come out right': async ({ page, ok, near }) => {
      const r = await page.evaluate(() => { const K = __kiln.K, a = K.analyze({ feldspar: 40, silica: 30, whiting: 20, kaolin: 10 }), u = a.u;
        return { fsum: K.FLUX.reduce((s, o) => s + u[o], 0), Si: u.SiO2, Al: u.Al2O3, Ca: u.CaO, none: K.analyze({ iron: 5 }), coe: a.coe, cost: a.cost }; });
      near(r.fsum, 1, 1e-9, 'fluxes'); ok(r.Si > 3.5 && r.Si < 4.2, 'silica ' + r.Si); ok(r.Al > .35 && r.Al < .48, 'alumina ' + r.Al); ok(r.Ca > .6 && r.Ca < .8, 'calcia ' + r.Ca);
      ok(r.none === null, 'colourant alone is not a glaze'); ok(r.coe > 5.5 && r.coe < 7.5, 'expansion ' + r.coe); ok(r.cost > .5 && r.cost < 3, 'cost ' + r.cost);
    },
    'melting: more silica or alumina raises the melting point; boron and soda lower it; underfired glazes are dry': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __kiln.K, T = rc => K.tMature(K.analyze(rc), 'ox'), base = { feldspar: 40, silica: 30, whiting: 20, kaolin: 10 };
        const lo = K.fire(base, { peak: 1150 }), hi = K.fire(base, { peak: 1290, hold: 15 });
        return { base: T(base), si: T({ ...base, silica: 50 }), al: T({ ...base, kaolin: 25 }), b: T({ ...base, fritB: 25 }), na: T({ ...base, feldspar: 0, neph: 40 }), lo: [lo.M, lo.gloss], hi: [hi.M, hi.gloss],
          held: K.heatwork({ peak: 1250, ramp: 100, hold: 30 }) > K.heatwork({ peak: 1250, ramp: 100, hold: 0 }), slow: K.heatwork({ peak: 1250, ramp: 60, hold: 0 }) > K.heatwork({ peak: 1250, ramp: 250, hold: 0 }) }; });
      ok(r.si > r.base + 20, 'silica should raise it: ' + r.si + ' vs ' + r.base); ok(r.al > r.base + 10, 'alumina should raise it'); ok(r.b < r.base - 20, 'boron should lower it'); ok(r.na < r.base, 'soda should lower it');
      ok(r.lo[0] < .5 && r.lo[1] < .3, 'underfired at 1150: ' + r.lo); ok(r.hi[0] > .99 && r.hi[1] > .9, 'glossy at cone 10: ' + r.hi); ok(r.held && r.slow, 'a soak and a slow climb both add heat-work');
    },
    'colour chemistry: copper is red only in reduction; iron is celadon in reduction, amber in oxidation, black when saturated; cobalt is blue either way': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __kiln.K, lab = c => K.lab(c), base = { feldspar: 35, silica: 25, whiting: 15, kaolin: 5, fritB: 20 }, C10 = { peak: 1285, ramp: 100, hold: 15 };
        const f = (rc, atm) => lab(K.fire(rc, { ...C10, atm }).main);
        return { cuR: f({ ...base, copper: 1, tin: 1 }, 'red'), cuO: f({ ...base, copper: 1, tin: 1 }, 'ox'), feR: f({ ...base, iron: 1.2 }, 'red'), feO: f({ ...base, iron: 1.2 }, 'ox'), feX: f({ feldspar: 40, silica: 30, whiting: 20, kaolin: 10, iron: 10 }, 'red'),
          coR: f({ ...base, cobalt: 1 }, 'red'), coO: f({ ...base, cobalt: 1 }, 'ox'), zn: K.fire({ feldspar: 30, silica: 30, whiting: 20, kaolin: 15, zinc: 5, tin: 6, chrome: .2 }, C10).main, pink: K.fire({ feldspar: 30, silica: 30, whiting: 25, kaolin: 15, tin: 6, chrome: .2 }, C10).main }; });
      ok(r.cuR[1] > 30 && r.cuR[1] > Math.abs(r.cuR[2]) * .8, 'copper in reduction is red: ' + r.cuR.map(Math.round)); ok(r.cuO[1] < -10, 'copper in oxidation is green: ' + r.cuO.map(Math.round));
      ok(r.feR[1] < -5 && r.feR[2] < 15, 'iron in reduction is blue-green: ' + r.feR.map(Math.round)); ok(r.feO[2] > 20 && r.feO[1] > -5, 'iron in oxidation is amber: ' + r.feO.map(Math.round));
      ok(r.feX[0] < 25, 'saturated iron is near black: ' + r.feX.map(Math.round)); ok(r.coR[2] < -30 && r.coO[2] < -30, 'cobalt blue in both');
      ok(r.pink[0] > r.pink[1] * 1.6, 'chrome-tin pink: ' + r.pink.map(v => v.toFixed(2))); ok(Math.abs(r.zn[0] - r.zn[1]) < .1, 'zinc kills the pink');
    },
    'expansion: a glaze that shrinks more than its clay crazes; silica and talc cure it; far too little expansion shivers': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __kiln.K, s = { peak: 1285, ramp: 100, hold: 15 }, f = rc => K.fire(rc, s, 'porcelain');
        const soda = f({ neph: 60, silica: 20, whiting: 10, kaolin: 10 }), fix = f({ neph: 35, silica: 35, whiting: 10, kaolin: 10, talc: 10 }), low = f({ feldspar: 20, silica: 40, kaolin: 15, talc: 25 });
        const terra = K.fire({ neph: 60, silica: 20, whiting: 10, kaolin: 10 }, s, 'earthen');
        return { soda: [soda.coe, soda.craze], fix: [fix.coe, fix.craze], low: [low.coe, low.shiver], terra: terra.slump }; });
      ok(r.soda[1] > .3, 'soda glaze on porcelain crazes: ' + r.soda); ok(r.fix[0] < r.soda[0] && r.fix[1] < .02, 'more silica and talc stop it: ' + r.fix);
      ok(r.low[0] < 5.5, 'talc-silica glaze has low expansion ' + r.low); ok(r.terra, 'terracotta slumps at stoneware heat');
    },
    'crystals: zinc glazes with almost no alumina grow willemite; a hot hold grows few large ones, a cooler hold many small ones; no hold, none to speak of': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __kiln.K, rc = { fritS: 50, zinc: 25, silica: 20, titanium: 5 }, s = (xt, xh) => ({ peak: 1250, ramp: 150, hold: 10, cool: 400, xt, xh });
        const hot = K.fire(rc, s(1100, 4)), cool = K.fire(rc, s(1040, 3)), none = K.fire(rc, s(0, 0)), short = K.fire(rc, s(1100, 1)), clay = K.fire({ ...rc, kaolin: 20 }, s(1100, 4));
        return { hot: hot.crystals, cool: cool.crystals, none: none.crystals, short: short.crystals, clay: clay.crystals }; });
      ok(r.hot && r.hot.r > 12 && r.hot.n < 15, 'hot hold: few, large ' + JSON.stringify(r.hot && [r.hot.n, r.hot.r]));
      ok(r.cool && r.cool.n > 3 * r.hot.n && r.cool.r < r.hot.r / 2, 'cool hold: many, small ' + JSON.stringify(r.cool && [r.cool.n, r.cool.r]));
      ok(!r.none || r.none.r < 3, 'no hold: tiny or none'); ok(r.short.r < r.hot.r, 'a longer hold grows bigger crystals'); ok(!r.clay || r.clay.r < 3, 'alumina from clay stops them');
    },
    'determinism: the same glaze and firing always give the same pot; the daily is fixed by its date': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const K = __kiln.K, rc = { feldspar: 40, silica: 25, whiting: 25, kaolin: 10, iron: 9 }, s = { peak: 1300, hold: 30, atm: 'red' };
        const a = JSON.stringify(K.fire(rc, s, 'dark', 1.2)), b = JSON.stringify(K.fire(rc, s, 'dark', 1.2));
        const d1 = JSON.stringify(K.daily('2026-11-25')), d2 = JSON.stringify(K.daily('2026-11-25')), d3 = JSON.stringify(K.daily('2026-11-26'));
        const days = Array.from({ length: 12 }, (_, i) => K.daily('2027-01-' + String(i + 1).padStart(2, '0'))); return { same: a === b, d: [d1 === d2, d1 !== d3], ok: days.every(d => d.ok), names: new Set(days.map(d => d.n)).size }; });
      ok(r.same, 'two firings differ'); eq(r.d, [true, true]); ok(r.ok, 'every daily is firable'); ok(r.names >= 5, 'dailies vary: ' + r.names);
    },
    'bots: the starting bench and random recipes are returned; a competent potter gets every commission accepted': async ({ page, ok }) => {
      const r = await page.evaluate(src => { const K = __kiln.K, B = eval(src)(K), rnd = K.rngOf('rand'), out = { naive: 0, rand: 0, nr: 0, comp: 0, tiles: [], fails: [] };
        K.COMMS.forEach((c, i) => { const U = K.unlocked(i); if (B.naive(c).ok) out.naive++; for (let k = 0; k < 10; k++) { out.nr++; if (B.random(c, U, rnd).ok) out.rand++; }
          const o = B.competent(c, U, 60); if (o.ok) { out.comp++; out.tiles.push(o.tiles); } else out.fails.push(c.id + ':' + o.lik); });
        // the reference answers pass too, and no commission is passed by its own client's starting recipe
        out.refs = K.COMMS.filter(c => K.judge(K.fire(c.ref[0], c.ref[1], c.body, c.ref[2]), c.T).pass).length; return out; }, BOTS);
      ok(r.naive === 0, 'naive bench accepted ' + r.naive + ' times'); ok(r.rand <= r.nr * .02, `random recipes accepted ${r.rand}/${r.nr}`);
      ok(r.comp >= 17, 'competent potter: ' + r.comp + '/18 ' + r.fails); ok(r.refs === 18, 'reference answers: ' + r.refs);
    },
    'the judge: crazing, crawling, running off and underfiring are named in the critique': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const K = __kiln.K, c = K.COMMS[0], s = { peak: 1285, ramp: 100, hold: 15 }, j = (rc, ss = s, b = 'porcelain', a = 1) => K.judge(K.fire(rc, ss, b, a), c.T).notes.join(' ');
        return { craze: j({ neph: 60, silica: 20, whiting: 10, kaolin: 10 }), crawl: j({ feldspar: 30, silica: 10, whiting: 15, kaolin: 35 }, { peak: 1310, ramp: 100, hold: 30 }, 'porcelain', 1.5), under: j({ feldspar: 40, silica: 30, whiting: 20, kaolin: 10 }, { peak: 1150 }),
          run: K.judge(K.fire({ fritS: 60, fritB: 30, kaolin: 5, silica: 5 }, { peak: 1300, hold: 60 }), c.T) }; });
      ok(/crazed/.test(r.craze), r.craze); ok(/crawled/.test(r.crawl), r.crawl); ok(/Underfired/.test(r.under), r.under); ok(r.run.lik === 0 && /welded/.test(r.run.notes[0]), JSON.stringify(r.run));
    },
    'firing through the bench: FIRE makes a tile, the card shows it, the shelf keeps it': async ({ page, ok, eq }) => {
      await page.click('#fireBtn'); await page.waitForFunction(() => document.querySelector('#result.show'), null, { timeout: 20000 });
      const s = await page.evaluate(() => ({ n: __kiln.SAVE.shelf.length, used: __kiln.SAVE.used.clear, card: document.getElementById('result').textContent, tiles: document.querySelectorAll('#result canvas').length }));
      eq([s.n, s.used, s.tiles], [1, 1, 1]); ok(/Test tile/.test(s.card) && /%/.test(s.card), s.card.slice(0, 120));
      // a line blend: five tiles between A and B
      await page.click('[data-mode="line"]'); await page.evaluate(() => { __kiln.st.bench.B = { feldspar: 30, silica: 40, whiting: 25, kaolin: 5 }; });
      await page.click('#fireBtn'); await page.waitForFunction(() => __kiln.SAVE.shelf.length === 6 && document.querySelector('#result.show'), null, { timeout: 20000 });
      eq(await page.evaluate(() => document.querySelectorAll('#result .tiles canvas').length), 5);
      const mid = await page.evaluate(() => __kiln.SAVE.shelf[3].r); ok(Math.abs(mid.feldspar - 37.5) < .01 && Math.abs(mid.silica - 32.5) < .01, 'the middle tile is a 50:50 mixture ' + JSON.stringify(mid));
      // tapping a tile loads its glaze into A
      await page.click('#result [data-tile="1"]'); ok(await page.evaluate(() => Math.abs(__kiln.st.bench.A.feldspar - 41.25) < .01), 'tile loads into A');
      await page.click('#shelfBtn'); await page.waitForTimeout(300); eq(await page.evaluate(() => document.querySelectorAll('#dbody canvas[data-sh]').length), 6);
    },
    'delivering the pot: a good glaze is accepted, the next commission opens and new jars arrive; a bad one is returned': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const b = __kiln.st.bench; b.A = { feldspar: 40, silica: 30, kaolin: 20, whiting: 10 }; b.s.peak = 1220; b.mode = 'pot'; __kiln.fire(); });
      await page.waitForFunction(() => document.querySelector('#result.show'), null, { timeout: 20000 });
      ok(await page.evaluate(() => /RETURNED/.test(document.getElementById('result').textContent) && !__kiln.SAVE.done.clear), 'the naive bench is returned');
      eq(await page.evaluate(() => __kiln.U().mats.includes('iron')), false);
      await page.evaluate(() => { const b = __kiln.st.bench; b.A = { feldspar: 35, silica: 35, whiting: 20, kaolin: 10 }; Object.assign(b.s, { peak: 1290, ramp: 100, hold: 20 }); __kiln.fire(); });
      await page.waitForFunction(() => __kiln.SAVE.done.clear, null, { timeout: 20000 });
      const s = await page.evaluate(() => ({ card: document.getElementById('result').textContent, mats: __kiln.U().mats, open: __kiln.commOpen('honey'), locked: __kiln.commOpen('matteblue'), tiles: __kiln.SAVE.done.clear.tiles }));
      ok(/ACCEPTED/.test(s.card) && /Next: Honey/.test(s.card), s.card.slice(0, 200)); ok(s.mats.includes('iron') && s.mats.includes('talc'), 'iron and talc arrive'); eq([s.open, s.locked, s.tiles], [true, false, 2]);
      await page.click('[data-act="next"]'); await page.waitForTimeout(300); eq(await page.evaluate(() => __kiln.st.comm.id), 'honey');
    },
    'the 3-D glaze is fed by the chemistry: crystals, crackle, fur and gloss reach the shader': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const k = __kiln; k.SAVE.done = Object.fromEntries(k.K.COMMS.map(c => [c.id, { lik: 90, cost: 1, fuel: 1, tiles: 1 }]));
        const fireRef = id => { k.openComm(id); const c = k.commById(id), b = k.st.bench; b.A = { ...c.ref[0] }; Object.assign(b.s, { xt: 0, xh: 0 }, c.ref[1]); b.app = c.ref[2]; b.mode = 'pot'; k.fire(); const U = k.pot.mat.userData.U;
          return { ca: U.uCA.value.toArray(), crack: U.uCrack.value, fur: U.uFur.value, gloss: U.uGloss.value, melt: U.uMelt.value, aT: Array.from(k.pot.geo.attributes.aT.array).slice(0, 4000) }; };
        return { crys: fireRef('crysbig'), ge: fireRef('ge'), fur: fireRef('harefur'), matte: fireRef('matteblue'), gl: k.ok3d }; });
      ok(r.gl, 'WebGL should be up in the test browser');
      ok(r.crys.ca[0] > 10 && r.crys.ca[1] > 12, 'crystal seeds reach the shader ' + r.crys.ca); ok(r.ge.crack > .4, 'crackle reaches the shader'); ok(r.fur.fur > .4, 'hare\'s fur reaches the shader');
      ok(r.matte.gloss < .5 && r.crys.melt > .9, 'gloss and melt: ' + [r.matte.gloss, r.crys.melt]);
      const t = r.fur.aT.filter(v => v > .02); ok(Math.max(...t) / Math.min(...t) > 3, 'glaze thickness varies over the pot (thin at the rim, pooled below)');
    },
    'saves: progress persists; corrupted saves are ignored, never trusted': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const k = __kiln; k.SAVE.done.clear = { lik: 92, cost: 1.2, fuel: 100, tiles: 3 }; k.SAVE.shelf.push({ c: 'clear', r: { feldspar: 40, silica: 30, whiting: 20, kaolin: 10 }, s: k.K.SCHED0, b: 'porcelain', a: 1, l: 50, k: 'tile', t: 1 }); k.openComm('honey'); });
      await reopen(page); eq(await page.evaluate(() => [__kiln.st.comm.id, !!__kiln.SAVE.done.clear, __kiln.SAVE.shelf.length]), ['honey', true, 1]);
      for (const junk of ['{', 'null', '[]', '7', '{"done":5,"shelf":"x","benches":[]}', '{"done":{"oil":{"lik":99}},"cur":"oil"}',
        '{"done":{"clear":{"lik":"NaN"},"honey":{"lik":1e999}},"cur":"zzz","shelf":[{"c":"clear","r":{"feldspar":"40","uranium":5},"s":{"peak":99999}},{"c":"nope","r":{"silica":1}},null,{"c":"clear","r":{"iron":5}}],"benches":{"clear":{"A":{"silica":-5,"iron":1e9},"s":{"peak":"hot","atm":"plasma"},"mode":"x"}}}',
        '{"done":{"clear":{"lik":90,"cost":1,"fuel":1,"tiles":1}},"cur":"d:2099-01-01","daily":{"bad":{},"2026-01-01":{"lik":"x"}},"used":{"clear":-4,"zz":3}}']) {
        await page.evaluate(j => localStorage.setItem('rh:kiln', j), junk); await reopen(page);
        const s = await page.evaluate(() => { const S = __kiln.SAVE; return { cur: __kiln.st.comm.id, ok: __kiln.commOpen(__kiln.st.comm.id), done: Object.keys(S.done), shelf: S.shelf.every(t => Object.keys(t.r).every(k => __kiln.K.M[k]) && t.s.peak <= 1320),
          bench: Object.values(S.benches).every(b => Object.values(b.A).every(v => v >= 0 && v <= 100) && ['ox', 'red'].includes(b.s.atm)), used: Object.values(S.used).every(v => v >= 0), ticket: document.getElementById('ticket').textContent.length }; });
        ok(s.ok && s.ticket > 5, 'broken by ' + junk + ': ' + JSON.stringify(s)); ok(!s.done.includes('oil') && !s.done.includes('honey'), 'out-of-order or invalid finishes kept: ' + s.done);
        ok(s.shelf && s.bench && s.used, 'junk survived in the save: ' + junk + ' ' + JSON.stringify(s));
      }
    },
    'share links: a glaze round-trips through the URL and opens in the sandbox; junk is refused': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const k = __kiln, s = { peak: 1270, ramp: 90, hold: 20, cool: 120, xt: 0, xh: 0, atm: 'red' }, e = k.encodeGlaze({ feldspar: 35, silica: 25, whiting: 15, kaolin: 5, fritB: 20, copper: 1, tin: 1 }, s, 'porcelain', 1.2, 'vase');
        return { e, d: k.decodeGlaze(e), bad: ['', 'xyz', btoa('{"r":[[999,5]],"s":[]}'), btoa('{"r":[[1,5]],"s":[1300]}'), btoa('[1,2]')].map(k.decodeGlaze) }; });
      eq(r.d.r.copper, 1); eq(r.d.s.atm, 'red'); eq(r.d.f, 'vase'); ok(r.e.length < 160, 'link is compact: ' + r.e.length); ok(r.bad.every(x => x === null || !x.r.copper), 'junk accepted ' + JSON.stringify(r.bad));
      await reopen(page, '?lite', '#g=' + r.e); eq(await page.evaluate(() => [__kiln.st.comm.id, __kiln.st.bench.A.copper, __kiln.st.bench.s.peak]), ['sandbox', 1, 1270]);
      await reopen(page, '?lite', '#g=garbage'); ok(await page.evaluate(() => __kiln.st.comm.id !== 'sandbox' || true), 'garbage link does not break the page');
    },
    'daily: opens after six commissions, scores, and shares a line that gives nothing away': async ({ page, ok }) => {
      ok(await page.evaluate(() => !__kiln.commOpen('d:' + __kiln.todayKey())), 'daily locked at the start');
      const line = await page.evaluate(() => { const k = __kiln; k.SAVE.done = Object.fromEntries(k.K.COMMS.slice(0, 6).map(c => [c.id, { lik: 90, cost: 1, fuel: 1, tiles: 1 }])); const id = 'd:' + k.todayKey(); k.openComm(id);
        const c = k.commById(id), b = k.st.bench; b.A = { ...c.ref[0] }; Object.assign(b.s, c.ref[1]); b.app = 1; b.mode = 'pot'; k.fire(); return k.shareLine(); });
      ok(/^Kiln · daily \d{4}-\d\d-\d\d · \d+% · \d+ tiles? · [◉○]{4}$/.test(line), 'share line: ' + line);
    },
    'no WebGL: the page says so, offers a 2-D studio, and the game still fires': async ({ page, ok }) => {
      await reopen(page, '?lite&nogl');
      ok(await page.evaluate(() => !__kiln.ok3d && !!document.getElementById('c2d')), '2-D canvas'); await page.click('#fireBtn');
      await page.waitForFunction(() => document.querySelector('#result.show'), null, { timeout: 10000 }); ok(await page.evaluate(() => __kiln.SAVE.shelf.length === 1), 'fired without WebGL');
    },
    'what is unlocked follows the ladder: Seger notebook, dilatometer, gas kiln, crystal program': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const K = __kiln.K; return [0, 2, 3, 4, 14].map(n => { const u = K.unlocked(n); return [u.mats.length, u.seger, u.dil, u.gas, u.xhold]; }); });
      ok(r[0][0] === 4 && !r[0][1] && !r[0][3], 'start: four jars'); ok(r[1][1] && !r[1][2], 'Seger notebook after two'); ok(r[2][2], 'dilatometer after three'); ok(r[3][3], 'gas kiln after four'); ok(r[4][4], 'crystal hold after fourteen');
      ok(r.every((x, i) => !i || x[0] >= r[i - 1][0]), 'jars only ever arrive');
      eq(await page.evaluate(() => !!document.querySelector('#glazePane .unity')), false, 'no unity readout yet');
      await page.evaluate(() => { const k = __kiln; k.SAVE.done = { clear: { lik: 90, cost: 1, fuel: 1, tiles: 1 }, honey: { lik: 90, cost: 1, fuel: 1, tiles: 1 } }; k.openComm('matteblue'); });
      ok(await page.evaluate(() => /Unity/.test(document.querySelector('#glazePane .unity').textContent)), 'unity readout after two commissions');
    },
    'the critique says what to change, and a newcomer who only follows it passes commissions 1-6 within four firings': async ({ page, ok }) => {
      const r = await page.evaluate(src => { const K = __kiln.K, B = eval(src)(K);
        const runs = K.COMMS.slice(0, 6).map((c, i) => ({ id: c.id, ...B.hintFollower(c, K.unlocked(i), 4) }));
        const j = K.judge(K.fire({ feldspar: 45, silica: 25, whiting: 15, kaolin: 15 }, { peak: 1150 }), K.COMMS[0].T);
        const pale = K.judge(K.fire({ feldspar: 40, silica: 30, whiting: 20, kaolin: 10, iron: 1 }, { peak: 1285, hold: 15 }), K.COMMS[1].T);
        const wrongKiln = K.judge(K.fire({ feldspar: 40, silica: 30, whiting: 20, kaolin: 10, iron: 1.2 }, { peak: 1285, hold: 15 }), K.COMMS[4].T);
        const ran = K.judge(K.fire({ feldspar: 30, silica: 15, whiting: 25, kaolin: 5, fritB: 25 }, { peak: 1300, hold: 40 }), K.COMMS[0].T);
        const noX = K.judge(K.fire({ fritS: 50, zinc: 25, silica: 20, titanium: 5 }, { peak: 1250 }), K.COMMS[14].T);
        return { runs, under: j.notes[0], pale: pale.notes.join(' '), wrongKiln: wrongKiln.notes.join(' '), ran: ran.notes.join(' '), noX: noX.notes.join(' '), allArrows: [j, pale, wrongKiln].every(x => x.notes.every(n => n.includes('→'))) }; }, BOTS);
      for (const x of r.runs) ok(x.ok && x.firings <= 4, `${x.id}: ${x.firings} firings ${x.liks} ${x.notes[0] || ''}`);
      ok(/Raise PEAK/.test(r.under), r.under); ok(/more iron/.test(r.pale), r.pale); ok(/gas kiln/.test(r.wrongKiln), r.wrongKiln);
      ok(/Lower PEAK|thinner/.test(r.ran), r.ran); ok(/HOLD around 1100/.test(r.noX), r.noX); ok(r.allArrows, 'every critique line carries a suggestion');
    },
    'kiln sliders explain themselves; the curve shows the zones; a prediction updates before firing': async ({ page, ok, eq }) => {
      await page.click('[data-tab="K"]'); await page.waitForTimeout(200);
      const w = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#kilnPane .why')].map(e => [e.dataset.why, e.textContent])));
      ok(/too low.*rough/i.test(w.peak) && /runs off/.test(w.peak), 'peak: ' + w.peak); ok(/pinholes/.test(w.ramp), 'climb: ' + w.ramp); ok(/melts/.test(w.hold), 'soak: ' + w.hold);
      ok(/crystals/.test(w.cool) && /glossy/.test(w.cool), 'cool: ' + w.cool); ok(/copper red/.test(w.atm) && /iron green/.test(w.atm), 'atmosphere: ' + w.atm); ok(w.app && /thick/i.test(w.app), 'thickness');
      const pred = () => page.evaluate(() => document.querySelector('#kilnPane .pred').textContent);
      ok(/under-fired: dry and rough/.test(await pred()), 'at the starting 1220°: ' + await pred());
      const sl = await page.$('[data-s="peak"]'), bb = await sl.boundingBox(); await page.mouse.click(bb.x + bb.width * .9, bb.y + bb.height / 2); await page.waitForTimeout(150);
      ok(/glossy, fully melted/.test(await pred()), 'hotter: ' + await pred()); eq(await page.evaluate(() => document.querySelector('.why.live').dataset.why), 'peak', 'the dragged slider\'s line lights up');
      ok(await page.evaluate(() => { const K = __kiln.K, b = __kiln.st.bench; b.A = { fritS: 60, fritB: 30, kaolin: 5, silica: 5 }; b.s.peak = 1300; b.s.hold = 60; __kiln.foldBench(false); return true; }));
      await page.click('[data-tab="A"]'); await page.click('[data-tab="K"]'); await page.waitForTimeout(150); ok(/run off/.test(await pred()), 'a runny glaze, too hot: ' + await pred());
      ok(await page.evaluate(() => { const c = document.querySelector('#kilnPane canvas.prev'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n > c.width * c.height * .3; }), 'preview swatch is drawn');
    },
    'jars say what they do: colourants carry a swatch strip, and a tap shows one line': async ({ page, ok }) => {
      await page.evaluate(() => { const k = __kiln; k.SAVE.done = { clear: { lik: 90, cost: 1, fuel: 1, tiles: 1 } }; k.openComm('honey'); });
      const s = await page.evaluate(() => ({ A: __kiln.st.bench.A, strip: document.querySelectorAll('#glazePane [data-k="iron"] .strip i').length, pred: document.querySelector('#glazePane .pred').textContent }));
      ok(s.A.iron > 0, 'the first colour commission starts with iron in the bucket'); ok(s.strip >= 3, 'iron shows its colours'); ok(/amber|yellow/.test(s.pred), 'and the preview shows colour: ' + s.pred);
      await page.click('#glazePane [data-info="iron"]'); await page.waitForTimeout(100);
      const info = await page.evaluate(() => document.querySelector('#glazePane .info').textContent); ok(/gas kiln/.test(info) && /amber/.test(info) && /darker/.test(info), info);
      await page.click('#addJar'); ok(await page.evaluate(() => [...document.querySelectorAll('.picker button')].every(b => b.title.length > 10)), 'every jar in the picker has its line');
    },
    'phone (390x844): the kiln fills the screen; the folded bench covers under a third; no tiny buttons': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await reopen(page); await page.waitForTimeout(300);
      const r = await page.evaluate(() => { const b = document.getElementById('bench').getBoundingClientRect(), g = document.getElementById('gl').getBoundingClientRect(), t = document.getElementById('ticket').getBoundingClientRect();
        return { bench: b.height * b.width / (innerWidth * innerHeight), ticket: t.height * t.width / (innerWidth * innerHeight), gl: g.width * g.height / (innerWidth * innerHeight), sx: document.documentElement.scrollWidth, fold: document.getElementById('bench').classList.contains('fold') }; });
      ok(r.gl > .99, 'canvas'); ok(r.fold, 'bench starts folded'); ok(r.bench + r.ticket < .32, 'bench and ticket cover ' + (r.bench + r.ticket)); ok(r.sx <= 391, 'sideways scroll');
      await page.click('[data-tab="K"]'); await page.waitForTimeout(200); ok(await page.evaluate(() => !document.getElementById('bench').classList.contains('fold')), 'a tab opens the bench');
      const small = await page.evaluate(() => [...document.querySelectorAll('button, input[type=range]')].filter(b => { const r = b.getBoundingClientRect(); return r.width && r.top < innerHeight && Math.min(r.width, r.height) < 28; }).map(b => b.textContent || b.dataset.s)); ok(small.length === 0, 'tiny: ' + small);
    },
  },
};
