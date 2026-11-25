// Parish: a family saga, 1700–1850. The village is simulated year by year; the player steers one family;
// the register writes itself. Logic via window.__parish.
const { sagaPolicy, runSaga } = require('./parish.bots.js');
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
module.exports = {
  page: 'parish/index.html',
  tests: {
    'a dynasty is deterministic: the same seed and answers give the same register and score': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const P = window.__parish, ans = '1021301201103'.split('').map(Number);
        const a = P.play(4242, ans, 1760), b = P.play(4242, ans, 1760); return [JSON.stringify(a.reg) === JSON.stringify(b.reg), P.scoreOf(a).total === P.scoreOf(b).total, a.reg.length]; });
      ok(r[0] && r[1], 'not deterministic'); ok(r[2] > 200, 'register too thin: ' + r[2]);
    },
    'different seeds make different villages and families': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const P = window.__parish; return [1, 2, 3, 4].map(s => { const V = P.play(s * 31, [], 1720); return V.village + '|' + V.fam.sur + '|' + V.reg.length; }); });
      ok(new Set(r).size >= 3, JSON.stringify(r));
    },
    'demography is sane: the village lives on, a few infants in a hundred die, the register fills': async ({ page, ok }) => {
      await page.addScriptTag({ content: sagaPolicy.toString() + runSaga.toString() });
      const r = await page.evaluate(() => [11, 22, 33].map(s => runSaga(s, 'steward')));
      for (const x of r) { ok(x.pop > 100 && x.pop < 2000, 'population ' + x.pop); ok(x.infant > .03 && x.infant < .25, 'infant deaths ' + x.infant); ok(x.end < 1850 || x.regs > 800, 'register ' + x.regs); }
    },
    'difficulty: a careful steward does far better than an idle or random family': async ({ page, ok }) => {
      await page.addScriptTag({ content: sagaPolicy.toString() + runSaga.toString() });
      const r = await page.evaluate(() => { const o = {}; for (const pol of ['idle', 'random', 'steward']) o[pol] = [1, 2, 3, 4, 5, 6].map(s => runSaga(s * 977, pol).score); return o; });
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      ok(avg(r.steward) > 3 * avg(r.idle) && avg(r.steward) > 3 * avg(r.random), JSON.stringify(r));
      ok(r.steward.filter(x => x > Math.max(...r.idle, ...r.random)).length >= 5, 'the steward should beat every naive run in most villages: ' + JSON.stringify(r));
    },
    'playing by hand: choose an answer, end the year, the register grows; running on stops at a real decision': async ({ page, ok, eq }) => {
      await closeModals(page);
      const n0 = await page.evaluate(() => window.__parish.V.reg.length);
      const choice = page.locator('.choice').first();
      if (await choice.count()) await choice.locator('[data-o]').last().click();
      await page.click('#nextYear');
      ok(await page.evaluate(n0 => window.__parish.V.reg.length > n0, n0), 'register did not grow');
      const y0 = await page.evaluate(() => window.__parish.V.year);
      await page.evaluate(() => { const P = window.__parish; P.picks = {}; }); await page.click('#ffBtn');
      const st = await page.evaluate(() => ({ y: window.__parish.V.year, p: window.__parish.V.pending.map(c => c.k), ended: !!window.__parish.V.ended }));
      ok(st.ended || st.p.some(k => k !== 'land' && k !== 'warden'), 'run on should stop at a real decision: ' + JSON.stringify(st));
      ok(st.y >= y0, 'years should pass');
    },
    'saves replay: reloading restores the same year and family from the stored answers; a shared link replays a dynasty': async ({ page, eq }) => {
      await closeModals(page);
      for (let i = 0; i < 6; i++) await page.click('#ffBtn');
      const a = await page.evaluate(() => ({ y: window.__parish.V.year, n: window.__parish.V.reg.length, seed: window.__parish.V.seed, ans: window.__parish.V.made.join('') }));
      const snap = await page.evaluate(() => localStorage.getItem('rh:parish'));
      await page.addInitScript(s => localStorage.setItem('rh:parish', s), snap); await page.reload(); await page.waitForTimeout(600);
      eq(await page.evaluate(() => ({ y: window.__parish.V.year, n: window.__parish.V.reg.length, seed: window.__parish.V.seed, ans: window.__parish.V.made.join('') })), a);
      await page.evaluate(a => { location.hash = '#saga=' + a.seed + ':' + a.ans; }, a); await page.reload(); await page.waitForTimeout(600);
      eq(await page.evaluate(() => window.__parish.V.reg.length), a.n, 'shared link');
    },
    'the end: the score is kept and a letter from 1900 asks for an ancestor in the register you made': async ({ page, ok }) => {
      await closeModals(page);
      await page.evaluate(() => { const P = window.__parish, V = P.V; let g = 0; while (!V.ended && g++ < 200) { P.resolvePending(V, () => 1); P.stepYear(V); } });
      await page.click('#nextYear').catch(() => {}); await page.evaluate(() => window.__parish.endYear());
      await page.waitForTimeout(900);
      const txt = await page.evaluate(() => document.querySelector('.modal')?.textContent || '');
      ok(/1900|1850|end of the line/i.test(txt), 'end screen: ' + txt.slice(0, 120));
    },
    'corrupted and old saves load safely': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const c = window.__parish.cleanSave; return [c(null).answers, c({ v: 2, seed: 5, answers: '12x' }).answers, c({ seed: 7, done: {} }).v, c({ v: 2, seed: 9, answers: '120' }).answers]; });
      eq(r, ['', '', 2, '120']);
    },
    'touch: phone layout has tabs, no sideways scroll, and answers by tap': async ({ page, ok }) => {
      const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
      await p.goto(page.url()); await p.waitForTimeout(900); await p.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= 392), 'overflow');
      await p.locator('#ptabs [data-tab="reply"]').tap(); await p.locator('#nextYear').tap();
      ok(await p.evaluate(() => window.__parish.V.year > 1701), 'tap did not end the year');
      await p.locator('#ptabs [data-tab="letters"]').tap(); ok(await p.locator('#side .estate').isVisible(), 'family tab');
      await ctx.close();
    },
  },
};
