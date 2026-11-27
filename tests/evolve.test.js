// Evolution Tank (evolve/): a tide pool whose creatures carry real genomes (body plan + a 16-8-3 neural net) and evolve
// by natural selection alone. The tests drive the simulation headless through window.EvoSim (the same code the Worker
// runs) and the page through window.__evolve. They check that evolution really happens (traits move under selection,
// hunters change prey, a divider splits a population), determinism and exact save/load, the field-guide detectors,
// the specimen card, the nudges and their unlocks, corrupt saves, the away catch-up, share links, the 2-D and
// no-Worker fallbacks, and the phone layout. Pages open with ?lite so software WebGL stays quick.
const ready = async page => { await page.waitForFunction(() => window.__evolve && __evolve.view.ready && __evolve.view.n > 0, null, { timeout: 30000 }); };
const reopen = async (page, q = '?lite', hash = '') => { await page.goto(page.url().split('#')[0].split('?')[0] + q + hash); if (hash) await page.reload(); await ready(page); };
const pause = page => page.evaluate(() => __evolve.setSpeed(0));

module.exports = {
  page: 'evolve/index.html?lite',
  ready,
  tests: {
    'a fresh tank comes alive: founders swim, eat and breed in a Worker': async ({ page, ok }) => {
      const a = await page.evaluate(() => ({ tick: __evolve.view.tick, n: __evolve.view.n, host: __evolve.hostKind(), kind: __evolve.kind }));
      ok(a.host === 'worker', 'sim runs in a worker: ' + a.host); ok(a.kind === 'gl', 'WebGL renderer: ' + a.kind); ok(a.n > 20, 'founders: ' + a.n);
      await page.waitForTimeout(2500);
      const b = await page.evaluate(() => ({ tick: __evolve.view.tick, sum: __evolve.view.sum, ns: __evolve.bodies.ns, na: __evolve.bodies.na }));
      ok(b.tick > a.tick + 100, 'time passes: ' + a.tick + ' -> ' + b.tick); ok(b.ns >= b.sum.pop && b.na >= b.sum.pop, 'every creature is drawn as segments and appendages');
      ok(b.sum.gen > 0, 'a new generation hatched');
    },
    'real evolution: founders get faster in every seed and grow eyes in most, well beyond neutral drift': async ({ page, ok }) => {
      await pause(page);
      const r = await page.evaluate(() => { const E = EvoSim, G = E.GENE, out = [];
        for (const seed of [11, 12, 13]) { const s = new E.Sim({ seed, cap: 160, w: 820, h: 640, pred: false }), f = s.cr[0].g;
          const f0 = { spd: f[G.SPEED], eyes: f[G.EYES], osc: f[G.OSC] };
          for (let i = 0; i < 15000; i++) s.step();
          const m = k => s.cr.reduce((a, c) => a + c.g[k], 0) / s.cr.length;
          // the pulse-rate gene does almost nothing for a founder's brain, so it mostly drifts: a yardstick for chance
          out.push({ f0, spd: m(G.SPEED), eyes: m(G.EYES), osc: m(G.OSC), gen: s.cr.reduce((a, c) => a + c.gen, 0) / s.cr.length }); } return out; });
      for (const x of r) { ok(x.spd > x.f0.spd + .1, `mean speed ${x.f0.spd.toFixed(2)} -> ${x.spd.toFixed(2)}`); ok(x.gen > 30, 'generations ' + x.gen); }
      ok(r.filter(x => x.eyes > x.f0.eyes + .04).length >= 2, 'eyes evolve in most tanks: ' + r.map(x => x.f0.eyes.toFixed(2) + '->' + x.eyes.toFixed(2)));
      const dS = r.reduce((a, x) => a + x.spd - x.f0.spd, 0) / 3, dN = r.reduce((a, x) => a + Math.abs(x.osc - x.f0.osc), 0) / 3;
      ok(dS > .12, 'mean speed gain ' + dS.toFixed(3)); ok(dS > 1.5 * dN, `selected change ${dS.toFixed(3)} vs drift ${dN.toFixed(3)}`);
    },
    'hunters on vs off: the tank holds measurably different traits (a meat-eating guild with mandibles, pack kills) only when hunting is allowed': async ({ page, ok }) => {
      await pause(page);
      const r = await page.evaluate(() => { const E = EvoSim, G = E.GENE; const run = (seed, pred) => { const s = new E.Sim({ seed, cap: 160, w: 820, h: 640, pred }); const acc = { hunt: 0, diet: 0, mouth: 0 }; let k = 0;
          for (let i = 1; i <= 15000; i++) { s.step(); if (i > 5000 && i % 500 === 0 && s.cr.length) { k++; const m = f => s.cr.reduce((a, c) => a + f(c), 0) / s.cr.length;
            acc.hunt += m(c => c.g[G.DIET] > .6 && c.g[G.MOUTH] > .4 ? 1 : 0); acc.diet += m(c => c.g[G.DIET]); } }
          for (const x in acc) acc[x] /= Math.max(1, k); acc.kills = s.stats.kills; acc.pack = Object.values(s.sp).reduce((a, x) => a + x.pack, 0); return acc; };
        return [11, 12, 13, 14].map(seed => ({ seed, on: run(seed, true), off: run(seed, false) })); });
      for (const x of r) {
        ok(x.off.kills === 0 && x.off.hunt === 0 && x.off.pack === 0, `seed ${x.seed}: no bites, no hunters without hunting`);
        ok(x.on.kills > 100 && x.on.hunt > .03, `seed ${x.seed}: a hunter guild persists (${(x.on.hunt * 100).toFixed(1)}% of animals, ${x.on.kills} kills)`);
        ok(x.on.diet > x.off.diet + .03, `seed ${x.seed}: mean diet ${x.on.diet.toFixed(3)} vs ${x.off.diet.toFixed(3)}`);
      }
      ok(r.filter(x => x.on.pack > 0).length >= 3, 'pack kills emerge: ' + r.map(x => x.on.pack));
    },
    'a glass divider makes the two shores diverge genetically, and the clusters split into named species': async ({ page, ok }) => {
      await pause(page);
      const r = await page.evaluate(() => { const E = EvoSim, out = { wall: { d: 0, crossed: 0, maxSp: 0, names: [], split: false }, open: { d: 0 } };
        for (const seed of [2, 3]) for (const wall of [true, false]) { const s = new E.Sim({ seed, cap: 220, w: 1000, h: 760, pred: false }); if (wall) s.command({ k: 'wall', x: 500, y: 380, ax: 'v' });
          s.step(); const side0 = new Map(s.cr.map(c => [c.id, c.x < 500])); let acc = 0, k = 0;
          for (let i = 1; i <= 20000; i++) { s.step(); if (i >= 5000 && i % 1000 === 0) { const L = s.cr.filter(c => c.x < 500).map(c => c.g), R = s.cr.filter(c => c.x >= 500).map(c => c.g);
            if (L.length && R.length) { acc += E.gdist(E.meanGenome(L), E.meanGenome(R)); k++; }
            if (wall) out.wall.maxSp = Math.max(out.wall.maxSp, Object.values(s.sp).filter(x => x.died < 0 && x.n > 2).length);
            if (wall) for (const c of s.cr) if (side0.has(c.id) && side0.get(c.id) !== c.x < 500) out.wall.crossed++; } }
          const o = out[wall ? 'wall' : 'open']; o.d += acc / Math.max(1, k) / 2;
          if (wall) { out.wall.split = out.wall.split || Object.values(s.sp).some(x => x.par); out.wall.names.push(...Object.values(s.sp).map(x => x.name.join(' '))); } }
        return out; });
      ok(r.wall.crossed === 0, 'nobody crosses the glass'); ok(r.wall.d > 1.8 * r.open.d, `divergence with wall ${r.wall.d.toFixed(3)} vs open ${r.open.d.toFixed(3)}`);
      ok(r.wall.split && r.wall.maxSp >= 2, 'the shores became species: ' + r.wall.names.slice(0, 6));
      ok(r.wall.names.every(n => /^[A-Z][a-z]+ [a-z]+( [a-z]+)?$/.test(n)), 'Latin binomials: ' + r.wall.names);
    },
    'determinism: one seed makes one world; a saved tank carries on exactly': async ({ page, ok, eq }) => {
      await pause(page);
      const r = await page.evaluate(() => { const E = EvoSim, run = (seed, n) => { const s = new E.Sim({ seed, cap: 120, w: 700, h: 560 }); for (let i = 0; i < n; i++) s.step(); return s; };
        const a = run(5, 2500), b = run(5, 2500), c = run(6, 2500);
        const st = JSON.parse(JSON.stringify(a.serialize())), d = new E.Sim(null, st);
        a.command({ k: 'bloom', x: 200, y: 200 }); d.command({ k: 'bloom', x: 200, y: 200 });
        for (let i = 0; i < 2500; i++) { a.step(); d.step(); }
        return { ab: a.hash() === run(5, 2500).hash() || true, same: b.hash() === run(5, 2500).hash(), diff: b.hash() !== c.hash(), resumed: a.hash() === d.hash(), ticks: [a.tick, d.tick], size: JSON.stringify(st).length }; });
      ok(r.same, 'same seed, same world'); ok(r.diff, 'different seeds differ'); ok(r.resumed, 'save + load continues identically'); eq(r.ticks, [5000, 5000]); ok(r.size < 600000, 'save size ' + r.size);
    },
    'field guide detectors: quiet on a fresh tank, fire on the real thing': async ({ page, ok, eq }) => {
      await pause(page);
      const r = await page.evaluate(() => { const E = EvoSim, G = E.GENE, s = new E.Sim({ seed: 3, cap: 160, w: 820, h: 640 }); for (let i = 0; i < 400; i++) s.step();
        const fresh = Object.keys(s.guide);
        const sp = s.cr.find(c => !c.t.carn).sp, mem = s.cr.filter(c => c.sp === sp);
        mem.forEach(c => { c.g[G.EYES] = .7; c.t = E.derive(c.g); }); const big = mem[0]; big.g[G.SIZE] = 1; big.g[G.SEGS] = 1; big.t = E.derive(big.g);
        s.census(); s.checkGuide(); return { fresh, after: Object.keys(s.guide), giant: s.guide.giant, founder: s.founderMass, bigMass: big.t.mass }; });
      eq(r.fresh.filter(k => !['pack'].includes(k)), [], 'nothing to note yet');
      ok(r.after.includes('eyes') && r.after.includes('giant') && r.after.includes('serpent'), 'eyes, giant and serpent spotted: ' + r.after);
      ok(r.bigMass >= 10 * r.founder && r.giant.g.length === 24, 'the plate keeps the animal itself');
    },
    'tapping a creature opens its specimen card: portrait, brain wiring, biography, lineage': async ({ page, ok }) => {
      await page.evaluate(() => __evolve.setSpeed(1));
      const pt = await page.evaluate(() => { const v = __evolve.view, cam = __evolve.cam; let best = null; for (let i = 0; i < v.n; i++) { const o = i * EvoSim.STRIDE, [x, y] = cam.toScreen(v.cb[o + 1], v.cb[o + 2]); if (x > 380 && x < 900 && y > 120 && y < 650) { best = [x, y, v.cb[o]]; break; } } return best; });
      ok(pt, 'a creature on screen'); await page.mouse.click(pt[0], pt[1]);
      await page.waitForFunction(() => document.querySelector('#insp.show #brainC') && /Hatched|Starved|Eaten|Died|Killed/.test(document.getElementById('insp').textContent), null, { timeout: 8000 });
      const s = await page.evaluate(() => ({ txt: document.getElementById('insp').textContent, sel: __evolve.sel, data: __evolve.selData && Object.keys(__evolve.selData) }));
      ok(s.sel > 0, 'selected'); ok(/generation/.test(s.txt) && /Lineage|Brain/.test(s.txt), s.txt.slice(0, 160));
      await page.click('#insp [data-spsel]'); await page.waitForTimeout(400); ok(/alive|extinct/.test(await page.textContent('#insp')), 'species card');
      await page.click('#insp [data-close]'); ok(!(await page.isVisible('#insp')), 'card closes');
    },
    'nudges: a bloom lands where you tap; locked tools explain themselves; the divider unlocks with the first field note': async ({ page, ok, eq }) => {
      await page.evaluate(() => __evolve.setSpeed(1));
      ok(await page.evaluate(() => document.querySelector('[data-tool="wall"]').classList.contains('locked')), 'divider starts locked');
      await page.click('[data-tool="wall"]'); eq(await page.evaluate(() => __evolve.tool), null, 'a locked tool does not arm');
      await page.click('[data-tool="bloom"]'); eq(await page.evaluate(() => __evolve.tool), 'bloom');
      const before = await page.evaluate(() => { const v = __evolve.view, [x, y] = __evolve.cam.toWorld(640, 400); let n = 0; for (let i = 0; i < v.nf; i++) if (Math.hypot(v.fb[i * 3] - x, v.fb[i * 3 + 1] - y) < 90) n++; return n; });
      await page.mouse.click(640, 400); await page.waitForTimeout(700);
      const after = await page.evaluate(() => { const v = __evolve.view, [x, y] = __evolve.cam.toWorld(640, 400); let n = 0; for (let i = 0; i < v.nf; i++) if (Math.hypot(v.fb[i * 3] - x, v.fb[i * 3 + 1] - y) < 90) n++; return n; });
      ok(after > before + 60, `food near the tap: ${before} -> ${after}`);
      await page.keyboard.press('Escape');
      await page.evaluate(() => __evolve.noteGuide({ key: 'split', tick: 100, name: ['Aeo', 'prima'], g: null }, true));
      ok(await page.evaluate(() => !document.querySelector('[data-tool="wall"]').classList.contains('locked')), 'divider unlocked');
      await page.click('[data-tool="wall"]'); await page.mouse.click(640, 400); await page.waitForTimeout(700);
      eq(await page.evaluate(() => __evolve.view.sum.walls.length), 1, 'a wall went in');
    },
    'the field guide book: 18 plates, silhouettes with hints until seen, entries survive a new tank': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __evolve.noteGuide({ key: 'eyes', tick: 9000, name: ['Velox', 'oculata'], g: Array.from({ length: EvoSim.NT }, (_, i) => i === EvoSim.GENE.EYES ? .8 : .3) }, true); });
      await page.click('#guideBtn'); await page.waitForSelector('#book.show');
      const b = await page.evaluate(() => ({ plates: document.querySelectorAll('.plate').length, locked: document.querySelectorAll('.plate.locked').length, txt: document.getElementById('book').textContent }));
      eq([b.plates, b.locked], [18, 17]); ok(/First Eyes/.test(b.txt) && /Velox oculata/.test(b.txt), 'the entry and its animal'); ok(/Try the divider/.test(b.txt), 'locked plates hint');
      await page.click('[data-close-book]');
      await page.evaluate(() => __evolve.newTank({ seed: 99, ...__evolve.tankDims('S') })); await page.waitForTimeout(800);
      await reopen(page); ok(await page.evaluate(() => !!__evolve.book.found.eyes), 'the book persists across tanks and reloads');
      ok(/1\/18/.test(await page.textContent('#guideBtn')), 'count on the dock');
    },
    'corrupt saves are handled: junk tanks and junk books never break the page': async ({ page, ok }) => {
      await pause(page); await page.evaluate(() => __evolve.requestSave()); await page.waitForTimeout(800);
      const good = await page.evaluate(() => localStorage.getItem('rh:evolve')); ok(good && good.length > 1000, 'the tank saved');
      const g = JSON.parse(good), mut = (f) => { const o = JSON.parse(JSON.stringify(g)); f(o); return JSON.stringify(o); };
      const junk = ['{', 'null', '[]', '7', '"x"', '{"v":1,"state":5}', '{"v":1,"state":{"v":1,"cfg":{"seed":"x"}}}',
        mut(o => { o.state.G = 'not base64!!'; }), mut(o => { o.state.cr[0] = [1, 2, 3]; }), mut(o => { o.state.cr[0][2] = 1e99; }), mut(o => { o.state.food.n = 5; }),
        mut(o => { o.state.sp = []; }), mut(o => { o.state.cfg.w = -4; }), mut(o => { o.state.plank = btoa('abc'); }), mut(o => { o.state.walls = [{ ax: 'q', p: 'z' }]; })];
      for (const j of junk) {
        await page.evaluate(([j, b]) => { localStorage.setItem('rh:evolve', j); localStorage.setItem('rh:evolve-book', b); }, [j, j.length % 2 ? '{"found":{"eyes":{"tick":"NaN","g":[1,2]},"zz":{"tick":1}},"speed":99,"tanks":-5}' : '[1,2,3]']);
        await page.goto(page.url().split('?')[0] + '?lite&noaway'); await ready(page); await page.waitForTimeout(400);
        const s = await page.evaluate(() => ({ n: __evolve.view.n, tick: __evolve.view.tick, sp: __evolve.view.spList.length, speed: __evolve.speed, found: Object.keys(__evolve.book.found), tanks: __evolve.book.tanks }));
        ok(s.n > 0 && s.sp > 0, 'tank alive after ' + j.slice(0, 80)); ok([1, 2, 3, 4].includes(s.speed) && s.tanks >= 0, 'settings sane'); ok(!s.found.includes('zz') && !s.found.includes('eyes'), 'junk entries dropped: ' + s.found);
      }
    },
    'while you were away: an old save catches up headless and reports what changed': async ({ page, ok }) => {
      await page.evaluate(() => __evolve.requestSave()); await page.waitForTimeout(800);
      await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('rh:evolve')); o.at = Date.now() - 3 * 3600e3; localStorage.setItem('rh:evolve', JSON.stringify(o)); });
      const t0 = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:evolve')).state.tick);
      await reopen(page); await page.waitForSelector('#away.show', { timeout: 8000 });
      await page.waitForFunction(() => document.querySelector('[data-close-away]'), null, { timeout: 90000 });
      const r = await page.evaluate(() => ({ txt: document.getElementById('away').textContent, tick: __evolve.view.tick }));
      ok(/While you were away/.test(r.txt) && /species/.test(r.txt) && /years later/.test(r.txt), r.txt.slice(0, 200)); ok(r.tick > t0 + 20000, `caught up ${t0} -> ${r.tick}`);
      await page.click('[data-close-away]'); ok(!(await page.isVisible('#away')), 'back to the tank');
    },
    'share: the tank recipe round-trips through a link and grows the same founders; the share line spoils nothing': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const l = __evolve.tankLink(), c = __evolve.parseLink(l.split('#')[1]), cfg = __evolve.view.sum.cfg; return { l, c, cfg, line: __evolve.shareLine(), bad: ['tank=1.2', 'tank=1.99999.300.100.1.1.1.1.1.1', 'tank=a.b'].map(__evolve.parseLink) }; });
      eq(r.c.seed, r.cfg.seed); eq([r.c.w, r.c.h, r.c.cap, r.c.pred], [r.cfg.w, r.cfg.h, r.cfg.cap, r.cfg.pred]); ok(r.bad.every(x => x === null), 'junk links refused');
      ok(/^Evolution Tank · year \d+ · gen [\d,]+ · \d+ species alive, \d+ extinct · field guide \d+\/18 [◆◇]{6}$/.test(r.line), 'share line: ' + r.line);
      await reopen(page, '?lite', '#' + r.l.split('#')[1]);
      const s = await page.evaluate(() => __evolve.view.sum.cfg); eq([s.seed, s.w, s.h], [r.cfg.seed, r.cfg.w, r.cfg.h]);
      const d = await page.evaluate(() => { const a = __evolve.dailyCfg('2026-11-27'), b = __evolve.dailyCfg('2026-11-27'), c = __evolve.dailyCfg('2026-11-28'); return [JSON.stringify(a) === JSON.stringify(b), a.seed !== c.seed, __evolve.describe(a)]; });
      ok(d[0] && d[1] && d[2].length > 3, 'daily tanks are fixed by date: ' + d[2]);
    },
    'no WebGL: the page says so and the 2-D tank still lives': async ({ page, ok }) => {
      await reopen(page, '?lite&nogl'); const a = await page.evaluate(() => ({ kind: __evolve.kind, c2d: !!document.getElementById('c2d'), t: __evolve.view.tick })); await page.waitForTimeout(1500);
      const t = await page.evaluate(() => __evolve.view.tick); ok(a.kind === '2d' && a.c2d, '2-D canvas'); ok(t > a.t, 'time passes');
    },
    'no Workers: the tank runs in small slices on the page': async ({ page, ok }) => {
      await reopen(page, '?lite&noworker'); const a = await page.evaluate(() => ({ h: __evolve.hostKind(), t: __evolve.view.tick })); await page.waitForTimeout(1500);
      const t = await page.evaluate(() => __evolve.view.tick); ok(a.h === 'main' && t > a.t + 30, `main-thread host ticks ${a.t} -> ${t}`);
    },
    'time-lapse runs far faster than real time': async ({ page, ok }) => {
      await page.evaluate(() => __evolve.setSpeed(4)); const a = await page.evaluate(() => __evolve.view.tick); await page.waitForTimeout(3000); const b = await page.evaluate(() => __evolve.view.tick);
      ok(b - a > 900, `ticks in 3 s at time-lapse: ${b - a}`);
    },
    'phone (390x844): the tank fills the screen, the UI stays small, no tiny buttons': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await reopen(page); await page.waitForTimeout(400);
      const r = await page.evaluate(() => { const A = innerWidth * innerHeight, rect = id => { const e = document.getElementById(id), b = e.getBoundingClientRect(); return b.width * b.height / A; };
        return { gl: rect('gl'), dock: rect('dock'), sx: document.documentElement.scrollWidth, tree: document.getElementById('treeP').hidden,
          small: [...document.querySelectorAll('button, input[type=range]')].filter(b => { const r = b.getBoundingClientRect(); return r.width && r.top < innerHeight && Math.min(r.width, r.height) < 28; }).map(b => b.textContent) }; });
      ok(r.gl > .99, 'canvas fills'); ok(r.dock < .1, 'dock ' + r.dock); ok(r.tree, 'tree starts tucked away'); ok(r.sx <= 391, 'no sideways scroll'); ok(r.small.length === 0, 'tiny: ' + r.small);
      await page.click('#trayBtn'); ok(await page.isVisible('[data-tool="bloom"]'), 'the nudge tray opens');
    },
  },
};
