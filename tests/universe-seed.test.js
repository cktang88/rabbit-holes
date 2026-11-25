// Universe Seed: six laws → a simulated causal history; challenges need combinations of laws; stars reward elegance.
async function reopen(page) { const p2 = await page.context().newPage(); const errs = []; p2.on('pageerror', e => errs.push(e.message)); await p2.goto(page.url()); await p2.waitForTimeout(300); p2.errs = errs; return p2; }
const dismiss = (page) => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const idx = (X, k, v) => X.LAWS.find(l => l.k === k).opts.findIndex(o => o[1] === v);

module.exports = {
  page: 'universe-seed/index.html',
  tests: {
    'data: six laws all adjustable from the start; nine links; every challenge is achievable': async ({ page, eq, ok }) => {
      await dismiss(page);
      const r = await page.evaluate(() => ({ laws: document.querySelectorAll('#p-laws .law').length, opts: document.querySelectorAll('#p-laws [data-k]').length, st: __us.STAGES.length, chal: __us.CHAL.length, min: __us.MIN_CHANGES }));
      eq(r.laws, 6); eq(r.opts, 24); eq(r.st, 9); eq(Object.keys(r.min).length, r.chal, 'every challenge has a solution');
    },
    'our laws run all nine links to minds; famous fine-tuning arguments break the right link': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const X = __us; const at = (o) => o.broke ? o.broke.name : 'none'; const set = (ch) => { const c = { ...X.OURS }; for (const [k, v] of Object.entries(ch)) c[k] = X.LAWS.find(l => l.k === k).opts.findIndex(o => o[1] === v); return X.simulate(c); };
        return { ours: at(X.simulate(X.OURS)), weakG: at(set({ G: 0.1 })), bigL: at(set({ L: 10 })), d4: at(set({ D: 4 })), d2: at(set({ D: 2 })), s09: at(set({ s: 0.9 })), a40: at(set({ a: 40 })), s12: at(set({ s: 1.2 })), bh: at(set({ G: 10 })), g3: at(set({ G: 3 })) }; });
      eq(r, { ours: "none", weakG: "Galaxies", bigL: 'Galaxies', d4: 'Planets', d2: 'Life', s09: 'Carbon', a40: 'Carbon', s12: 'Carbon', bh: 'First stars', g3: 'Life' });
    },
    'every link explains itself; broken histories stop at the broken link': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const X = __us, bad = []; for (const c of X.ALL_COMBOS.filter((_, i) => i % 37 === 0)) { const o = X.simulate(c); let seenBroken = false;
          for (const s of o.stages) { if (seenBroken && s.status !== 'none') bad.push('after broken'); if (s.status === 'broken') seenBroken = true; if (s.status !== 'none' && !(s.why && s.why.length > 20)) bad.push('no reason'); } } return bad; });
      ok(!bad.length, bad.slice(0, 3).join(','));
    },
    'trade-offs: stronger gravity shortens stars; sticky chemistry speeds life; more matter beats dark energy': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __us; const sim = (ch) => { const c = { ...X.OURS }; for (const [k, v] of Object.entries(ch)) c[k] = X.LAWS.find(l => l.k === k).opts.findIndex(o => o[1] === v); return X.simulate(c); };
        return { tau1: sim({}).v.tau, tau3: sim({ G: 3 }).v.tau, life137: sim({}).v.tLife, life80: sim({ a: 80 }).v.tLife, heavyFix: sim({ G: 3, a: 80 }).stages[7].status, darkAlone: sim({ L: 3 }).broke && sim({ L: 3 }).broke.name, darkFix: sim({ L: 3, m: -8 }).stages[8].status }; });
      ok(r.tau3 < r.tau1 / 5); ok(r.life80 < r.life137); ok(r.heavyFix !== 'broken' && r.heavyFix !== 'none'); ok(r.darkAlone); ok(r.darkFix === 'ok');
    },
    'Bang plays the history link by link, Skip jumps to the end, ribbon and why-line explain each link': async ({ page, eq, ok }) => {
      await dismiss(page);
      await page.click('#p-laws [data-k="D"][data-j="2"]'); await page.click('#bangBtn'); await page.waitForTimeout(100);
      ok(await page.isVisible('#skipBtn')); await page.waitForTimeout(2500);
      eq(await page.evaluate(() => __us.run.idx), 1);
      await page.click('#skipBtn'); eq(await page.evaluate(() => [__us.run.done, __us.run.o.broke.name]), [true, 'Planets']);
      ok(/stable orbits/.test(await page.textContent('#why')), await page.textContent('#why'));
      eq(await page.locator('#ribbon button.broken').count(), 1); eq(await page.locator('#ribbon button.ok').count(), 6);
      await page.click('#ribbon button[data-i="4"]'); ok(/sun-like star lives/.test(await page.textContent('#why')));
      ok(/Universe 1/.test(await page.textContent('#p-atlas')));
    },
    'measurements are only shown for universes you have run, not the laws you are about to try': async ({ page, ok }) => {
      await dismiss(page);
      ok(/Bang a universe/.test(await page.textContent('#stats')));
      await page.click('#p-laws [data-k="G"][data-j="3"]'); ok(!/billion/.test(await page.textContent('#stats')), 'no preview of the next universe');
      await page.click('#bangBtn'); await page.click('#skipBtn'); ok(/A sun-like star lives/.test(await page.textContent('#stats')));
    },
    'challenges: take one on, attempts are counted, stars depend on elegance and attempts': async ({ page, eq }) => {
      await dismiss(page);
      await page.click('.tabs button[data-t="chal"]'); await page.click('[data-take="heavy"]');
      await page.click('.tabs button[data-t="laws"]');
      await page.click('#p-laws [data-k="G"][data-j="3"]'); await page.click('#bangBtn'); await page.click('#skipBtn'); // fails: stars burn out
      eq(await page.evaluate(() => [__us.M.chal.heavy, __us.M.att.heavy]), [undefined, 1]);
      await page.click('.tabs button[data-t="laws"]'); await page.click('#p-laws [data-k="a"][data-j="2"]'); await page.click('#bangBtn'); await page.click('#skipBtn');
      eq(await page.evaluate(() => [__us.M.chal.heavy, __us.M.active]), [{ n: 2, st: 3 }, null]);
      eq(await page.evaluate(() => [__us.starsFor('heavy', 2, 5), __us.starsFor('heavy', 3, 1), __us.starsFor('heavy', 4, 1), __us.starsFor('heavy', 2, 0)]), [2, 2, 1, 2]);
      eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub'))['universe-seed']), 1 / 14);
    },
    'law cards explain in plain words, with "in our universe / at this setting" on hover, and live previews': async ({ page, ok, eq }) => {
      await dismiss(page);
      eq(await page.locator('#p-laws canvas.prev').count(), 6);
      ok(/A sun lives about 10 billion years/.test(await page.textContent('[data-cmp="G"]')));
      await page.hover('#p-laws [data-k="G"][data-j="4"]'); const t = await page.textContent('[data-cmp="G"]'); ok(/In our universe/.test(t) && /black hole/.test(t), t);
      ok(await page.evaluate(() => { const c = document.querySelector('canvas.prev[data-prev="G"]').getContext('2d').getImageData(0, 0, 96, 60).data; let n = 0; for (let i = 0; i < c.length; i += 4) if (c[i] > 150) n++; return n > 10; }), 'preview drawn');
    },
    'first experiment walks through changing one law; History names the culprit of a broken link': async ({ page, ok, eq }) => {
      await dismiss(page);
      ok(await page.isVisible('.tut')); ok(await page.isVisible('#p-laws [data-k="G"][data-j="1"].pulse'));
      await page.click('#p-laws [data-k="G"][data-j="1"]'); await page.click('#bangBtn'); await page.click('#skipBtn');
      ok(await page.evaluate(() => !!__us.M.chal.first)); ok(await page.isVisible('#p-hist'), 'History tab opens after the bang');
      ok(/Gravity 0\.3× → a sun-like star lives/.test(await page.textContent('#p-hist')));
      await page.click('.tabs button[data-t="laws"]'); eq(await page.isVisible('.tut'), false);
      await page.click('#p-laws [data-k="G"][data-j="4"]'); await page.click('#bangBtn'); await page.click('#skipBtn');
      ok(/Culprit: Gravity 10×/.test(await page.textContent('#p-hist .hl.broken')), await page.textContent('#p-hist .hl.broken'));
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = __us; const late = X.CHAL.slice(-4); let seed = 1; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 16) % n; };
        const play = (policy, ch, runs) => { let good = 0; for (let k = 0; k < runs; k++) { let st = 0; for (let att = 1; att <= 3; att++) { const c = policy(ch, att); const o = X.simulate(c); if (ch.t(o, c)) { st = X.starsFor(ch.id, o.changed, att); break; } } if (st >= 2) good++; } return good / runs; };
        const randomBot = () => Object.fromEntries(X.LAWS.map(l => [l.k, rnd(l.opts.length)]));
        const idleBot = () => ({ ...X.OURS });
        const NAME = { heavy: { G: 3 }, diproton: { s: 1.05 }, tuned: { G: 3, L: 3 }, alien: { G: 3, L: 3, a: 300, s: 1.2, m: -12, D: 4 } };
        const set = (ch) => { const c = { ...X.OURS }; for (const [k, v] of Object.entries(ch)) c[k] = X.LAWS.find(l => l.k === k).opts.findIndex(o => o[1] === v); return c; };
        const obviousBot = (ch) => set(NAME[ch.id] || {});
        const KNOWN = { heavy: { G: 3, a: 80 }, diproton: { s: 1.05, a: 80 }, tuned: { L: 3, m: -8 }, alien: { G: 3, L: 0, a: 80, s: 1.05, m: -8, D: 2 } };
        const competent = (ch) => set(KNOWN[ch.id]);
        // a competent-but-simple player: tries the obvious law first, then walks one more law at a time
        const walker = (ch, att) => { const c = obviousBot(ch); if (att === 1) return c; const keys = ['a', 'm', 'L']; c[keys[att - 2]] = (c[keys[att - 2]] + 1) % X.LAWS.find(l => l.k === keys[att - 2]).opts.length; return c; };
        const out = { random: 0, idle: 0, obvious: 0, competent: 0, walker3: 0 };
        for (const ch of late) { out.random += play(randomBot, ch, 40) / late.length; out.idle += play(idleBot, ch, 1) / late.length; out.obvious += play(obviousBot, ch, 1) / late.length;
          const c = competent(ch); const o = X.simulate(c); if (ch.t(o, c)) out.competent += 1 / late.length;
          for (let att = 1; att <= 3; att++) { const c2 = walker(ch, att); const o2 = X.simulate(c2); if (ch.t(o2, c2)) { if (X.starsFor(ch.id, o2.changed, att) === 3) out.walker3 += 1 / late.length; break; } } }
        return out; });
      ok(r.random <= 0.2, 'random bot ≥2★ rate ' + r.random); ok(r.idle <= 0.2, 'idle ' + r.idle); ok(r.obvious <= 0.2, 'obvious ' + r.obvious);
      ok(r.competent === 1, 'competent policy wins all late challenges'); ok(r.walker3 < 1, 'simple walker does not 3★ everything: ' + r.walker3);
    },
    'corrupted saves are repaired': async ({ page, eq }) => {
      for (const raw of ['null', '"x"', '{"consts":{"G":99,"a":-1},"chal":{"heavy":"x","zzz":{"n":1,"st":3}},"atlas":[5,{"c":{},"s":[]}],"active":"nope"}']) {
        await page.evaluate((raw) => localStorage.setItem('rh:us2', raw), raw); const p2 = await reopen(page);
        const st = await p2.evaluate(() => ({ g: __us.M.consts.G, chal: Object.keys(__us.M.chal).length, a: __us.M.active ?? null }));
        eq(p2.errs, [], raw); eq(st, { g: 2, chal: 0, a: null }); await p2.close();
      }
    },
    'save/load round-trip of laws, challenges and atlas': async ({ page, eq }) => {
      await dismiss(page); await page.click('#p-laws [data-k="D"][data-j="0"]'); await page.click('#bangBtn'); await page.click('#skipBtn');
      const p2 = await reopen(page); eq(await p2.evaluate(() => [__us.M.consts.D, __us.M.atlas.length, !!__us.M.chal.flat]), [0, 1, true]); await p2.close();
    },
    'phone layout: no horizontal scroll, sky visible, law buttons big enough': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
      const r = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, sky: document.getElementById('sky').getBoundingClientRect(), b: Math.min(...[...document.querySelectorAll('#p-laws button')].map(b => b.getBoundingClientRect().height)) }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.sky.height >= 300); ok(r.b >= 32, 'button ' + r.b);
    },
  },
};
