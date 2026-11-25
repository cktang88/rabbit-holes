// Universe Seed: a family tree of universes. Every black hole buds a child universe with one law nudged a notch; the
// player shelters or prunes one universe per generation and tries to keep minds alive while selection favours black holes.
const { usPolicy, usPlay } = require('./universe-seed.bots.js');
const dismiss = page => page.evaluate(() => { document.querySelectorAll('.modal-bg').forEach(m => m.remove()); if (window.__us.view === 'watch') window.__us.closeWatch(); });
const X = `({ newCosmos: __us.newCosmos, stepGen: __us.stepGen, judge: __us.judge, variants: __us.variants, canShelter: __us.canShelter, STARTS: __us.STARTS, rng: RH.rng, starsOf: __us.starsOf })`;
module.exports = {
  page: 'universe-seed/index.html',
  tests: {
    'the rules: black holes decide the children; dark universes have none; factories out-breed minds; the first universe always buds': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const U = __us, J = c => U.judge(c);
        const ours = J({ G: 2, L: 2, a: 1, s: 1, m: 1, D: 1 }), fac = J({ G: 4, L: 2, a: 1, s: 1, m: 1, D: 1 }), dark = J({ G: 0, L: 2, a: 1, s: 1, m: 1, D: 1 }), hot = J({ G: 3, L: 2, a: 1, s: 1, m: 1, D: 1 });
        const C = U.newCosmos(5, U.STARTS[0]); U.stepGen(C, null);
        return { ours: [ours.kind, ours.raw], fac: [fac.kind, fac.raw], dark: [dark.kind, dark.raw], hot: [hot.kind, hot.raw], first: C.frontier.length, laws: U.LAWS.length }; });
      eq(r.ours[0], 'minds'); eq(r.fac[0], 'factory'); eq(r.dark, ['dark', 0]); eq(r.hot[0], 'stars');
      ok(r.fac[1] > r.hot[1] && r.hot[1] > r.ours[1], 'selection should favour black holes over minds: ' + JSON.stringify(r));
      ok(r.first >= 2, 'the first universe buds'); eq(r.laws, 6);
    },
    'children: one notch down, one notch up in the drift law, then a copy; shelter puts a copy first; twelve shelters, never twice running in a lineage': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const U = __us, C = U.newCosmos(7, U.STARTS[0]); U.stepGen(C, null);
        const u = C.U[C.frontier[0]], ks = U.kidsOf(C, u, false), sh = U.kidsOf(C, u, true), d = u.drift;
        const first = { down: ks[0][d] !== u.c[d] || ks[1][d] !== u.c[d], copyFirstWhenSheltered: JSON.stringify(sh[0]) === JSON.stringify(u.c) };
        U.stepGen(C, { t: 's', id: u.id }); const kid = C.frontier.find(id => C.U[id].parent === u.id);
        const left = C.shelters; const D = U.newCosmos(8, U.STARTS[0]); let n = 0; for (let g = 0; g < 20; g++) { const id = D.frontier.find(i => U.canShelter(D, i)); if (id != null) n++; U.stepGen(D, id != null ? { t: 's', id } : null); }
        return { ...first, sheltered: u.sheltered === 1, kidCan: kid != null ? U.canShelter(C, kid) : null, otherCan: C.frontier.filter(id => C.U[id].parent !== u.id).every(id => U.canShelter(C, id)), left, used: n, after: D.shelters }; });
      ok(r.down, 'children vary'); ok(r.copyFirstWhenSheltered, 'shelter: a faithful copy first'); ok(r.sheltered);
      eq(r.kidCan, false, 'the child of a sheltered universe must stand alone'); ok(r.otherCan, 'other lineages may be sheltered');
      eq(r.left, 11); eq([r.used, r.after], [12, 0], 'only twelve shelters');
    },
    'the laws thaw one at a time, starting with the one this start gets wrong': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const U = __us; return U.STARTS.map((s, i) => { const C = U.newCosmos(1, s); return [U.thawed(C, 1).join(''), U.thawed(C, 4).length, U.thawed(C, 8).length, U.thawed(C, 99).length, U.thawOrder(C)[0] === s.first]; }); });
      for (const x of r) { eq(x[0].length, 1); eq([x[1], x[2], x[3], x[4]], [2, 3, 6, true]); }
    },
    'a cosmos is deterministic: the same seed and interventions give the same tree, and a link replays it': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const U = __us; const a = U.replay(42, 3, 's0-p1s2--s0'), b = U.replay(42, 3, 's0-p1s2--s0'), c = U.replay(43, 3, 's0-p1s2--s0');
        const sig = C => JSON.stringify(C.U.map(u => [u.parent, u.c, u.kind, u.drift])); return [sig(a) === sig(b), sig(a) === sig(c), a.gen, a.mindsGen === b.mindsGen]; });
      eq(r, [true, false, 7, true]);
      await page.goto(page.url().replace(/#.*/, '') + '#c=42.3:s0-p1s2--s0'); await page.reload(); await page.waitForTimeout(700);
      eq(await page.evaluate(() => [__us.cos.seed, __us.cos.gen, __us.cos.start.n === __us.STARTS[3].n]), [42, 7, true]);
    },
    'difficulty: idle and random never reach par; fixed strategies fail some seeds; an adaptive gardener reaches par in most': async ({ page, ok }) => {
      await page.addScriptTag({ content: usPolicy.toString() + usPlay.toString() });
      const r = await page.evaluate(new Function(`const X = ${X}; const o = {}; for (const n of ['idle', 'random', 'pruneBH', 'shelterMinds', 'adaptive']) o[n] = Array.from({ length: 48 }, (_, i) => usPlay(X, i + 1, n, i % 8)); return o;`));
      const win = a => a.filter(x => x.stars >= 2).length;
      ok(win(r.idle) <= 3 && win(r.random) <= 3, `naive play should fail: idle ${win(r.idle)}, random ${win(r.random)}`);
      ok(win(r.adaptive) >= 40, 'adaptive gardener should reach par in most cosmoses: ' + win(r.adaptive) + '/48');
      for (const n of ['pruneBH', 'shelterMinds']) ok(win(r[n]) < 48, n + ' should not win every seed');
      for (const n of ['pruneBH', 'shelterMinds']) ok(win(r[n]) <= 36, `${n} is a fixed rule and should fail often: ${win(r[n])}/48`);
      ok(r.random.some(x => x.dark), 'careless pruning can make the multiverse go dark');
    },
    'two taps a generation: tap a universe card, tap Shelter, and the next generation buds': async ({ page, ok, eq }) => {
      await dismiss(page);
      const g0 = await page.evaluate(() => __us.cos.gen);
      await page.click('#letB'); eq(await page.evaluate(() => __us.cos.gen), g0 + 1, 'let it bud');
      await page.click('#front .card >> nth=0'); await page.click('#shB');
      eq(await page.evaluate(() => [__us.cos.gen, __us.cos.U.some(u => u.sheltered)]), [g0 + 2, true]);
      await page.click('#front .card >> nth=1'); await page.click('#prB');
      ok(await page.evaluate(() => __us.cos.U.some(u => u.fate === 'pruned')), 'pruned');
      const txt = await page.textContent('#front'); ok(/varies/.test(txt) && /buds/.test(txt), 'cards say what they vary and what they bud');
      ok(await page.evaluate(() => [...document.querySelectorAll('#front .card .ln')].every(e => e.textContent.length > 8)), 'every card has a cause line');
    },
    'watching one universe replays its history link by link (the original stage pictures), then back to the tree': async ({ page, ok, eq }) => {
      await dismiss(page);
      await page.click('#front .card >> nth=0'); await page.click('#wB');
      eq(await page.evaluate(() => __us.view), 'watch'); await page.waitForTimeout(1700);
      ok((await page.textContent('#why')).length > 10, 'why-line explains the link');
      await page.click('#backTree'); eq(await page.evaluate(() => __us.view), 'tree');
    },
    'discoveries and the argument are earned by seeing them happen, and kept': async ({ page, ok }) => {
      await dismiss(page);
      await page.evaluate(() => { for (let i = 0; i < 8; i++) __us.act(null); });
      const s = await page.evaluate(() => ({ p: Object.keys(__us.S.props), c: Object.keys(__us.S.codex) }));
      ok(s.p.includes('I') && s.p.includes('II'), 'propositions I and II: ' + s.p); ok(s.c.length >= 2, 'discoveries: ' + s.c);
      ok(/Every black hole buds/.test(await page.textContent('#p-props')));
    },
    'saves: reload resumes the tree; corrupt saves load safely; finishing records the cosmos': async ({ page, ok, eq }) => {
      await dismiss(page);
      await page.evaluate(() => { __us.act(null); __us.sel = __us.cos.frontier[0]; __us.act('s'); });
      const a = await page.evaluate(() => [__us.cos.seed, __us.cos.gen, __us.cos.mindsGen]);
      await page.reload(); await page.waitForTimeout(700); await dismiss(page);
      eq(await page.evaluate(() => [__us.cos.seed, __us.cos.gen, __us.cos.mindsGen]), a);
      const c = await page.evaluate(() => { const f = __us.cleanSave; return [f(null).cur, f({ v: 3, cur: { seed: 1, acts: 'zz' } }).cur, f({ v: 3, cur: { seed: 1, acts: 's1-' }, codex: { minds: 1, bogus: 1 }, runs: [{ minds: 'x' }, { minds: 5, seed: 2, start: 'A' }] })]; });
      eq(c[0], null); eq(c[1], null); eq(c[2].cur.acts, 's1-'); eq(Object.keys(c[2].codex), ['minds']); eq(c[2].runs.length, 1);
      await page.evaluate(() => localStorage.setItem('rh:us3', '{"v":3,"cur":{"seed":"x"},"runs":7}')); await page.reload(); await page.waitForTimeout(700);
      ok(await page.evaluate(() => !!__us.cos), 'corrupt save still loads');
      await dismiss(page); await page.evaluate(() => { while (!__us.cos.over) __us.act(null); }); await page.waitForTimeout(1000);
      ok(await page.evaluate(() => __us.S.runs.length === 1 && /generations|dark/i.test(document.querySelector('.modal')?.textContent || '')), 'cosmos recorded with an end card');
    },
    'share and daily: the share line is a strip of minds per generation and a replay link; today\'s cosmos is stable': async ({ page, ok, eq }) => {
      await dismiss(page);
      await page.evaluate(() => { for (let i = 0; i < 5; i++) __us.act(null); window.__copied = null; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
      await page.evaluate(() => { while (!__us.cos.over) __us.act(null); }); await page.waitForTimeout(900);
      await page.click('.modal button:has-text("Share")'); await page.waitForTimeout(100);
      const t = await page.evaluate(() => window.__copied); ok(/minds-generations/.test(t) && /#c=\d+/.test(t) && t.split('\n')[2].length >= 20, t);
      await page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
      await page.click('.tabs button[data-t="runs"]'); await page.click('#dayB');
      const d = await page.evaluate(() => [__us.cos.seed, __us.cos.gen, document.getElementById('capT').textContent]);
      ok(/today/.test(d[2]) && d[1] === 0, JSON.stringify(d));
    },
    'phone: no sideways scroll, the tree pans and pinches, the act bar stays in reach, two taps by touch': async ({ page, ok, eq }) => {
      const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
      const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(page.url()); await p.waitForTimeout(900); await p.evaluate(() => { document.querySelectorAll('.modal-bg').forEach(m => m.remove()); if (__us.view === 'watch') __us.closeWatch(); });
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= 392), 'overflow');
      await p.locator('#letB').tap(); await p.locator('#front .card').first().tap();
      const bar = await p.evaluate(() => { const r = document.getElementById('shB').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; }); ok(bar, 'shelter button on screen');
      await p.locator('#shB').tap(); eq(await p.evaluate(() => __us.cos.gen), 2);
      ok(await p.locator('.pz-bar button').first().isVisible(), 'zoom buttons');
      ok(!errs.length, errs[0]); await ctx.close();
    },
    'performance: the tree draws at phone frame rates with a full cosmos': async ({ page, ok }) => {
      const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
      await p.goto(page.url()); await p.waitForTimeout(700); await p.evaluate(() => { document.querySelectorAll('.modal-bg').forEach(m => m.remove()); if (__us.view === 'watch') __us.closeWatch(); for (let i = 0; i < 23; i++) __us.act(null); });
      const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const ms = await p.evaluate(() => new Promise(res => { const t = []; let last = performance.now(); const f = now => { t.push(now - last); last = now; if (t.length < 90) requestAnimationFrame(f); else res(t.slice(10).sort((a, b) => a - b)[Math.floor(t.length * .5)]); }; requestAnimationFrame(f); }));
      ok(ms < 20, 'median frame ' + ms.toFixed(1) + 'ms at 4x CPU throttle'); await ctx.close();
    },
  },
};
