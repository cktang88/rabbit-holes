// Ruin: Kelly maths against closed forms, deterministic fair seasons, scoring against the Kelly bot, the real betting UI,
// saves, and the difficulty rule (naive bettors fail, a simple sound bettor wins, three stars need near-Kelly play).
const close = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const play = (page, ti, pol) => page.evaluate(([ti, pol]) => { const R = __ruin, f = eval(pol); return R.score(ti, Array.from({ length: R.TABLES[ti].rounds }, (_, r) => f(R.offerAt(ti, r), R))); }, [ti, pol]);

module.exports = {
  page: 'ruin/index.html',
  ready: async page => { await page.waitForFunction(() => window.__ruin); await close(page); },
  tests: {
    'Kelly fractions match closed forms; traps get nothing': async ({ page, near, eq, ok }) => {
      const r = await page.evaluate(() => Object.fromEntries(Object.values(__ruin.OFFERS).map(o => [o.id, [o.kelly, __ruin.mean(o)]])));
      near(r.coin[0], .25, 1e-6); near(r.long[0], 1 / 6 - (5 / 6) / 7, 1e-6); near(r.stock[0], .5, 1e-6); near(r.lotto[0], .01 - .99 / 149, 1e-6);
      eq(r.fee[0], 0); eq(r.wheel[0], 0); near(r.sure[0], 1, 1e-6);
      ok(r.fee[1] < 0 && r.wheel[1] < 0, 'traps should lose on average'); ok(r.synd[0] > .9 && r.synd[0] < 1, 'pooling should allow a much bigger stake: ' + r.synd[0]);
    },
    'growth(): expected log-growth, peaking at the Kelly stake; all-in on the coin shrinks the typical player': async ({ page, near, ok }) => {
      const r = await page.evaluate(() => { const o = __ruin.OFFERS.coin; return { all: __ruin.growth(o, 1), k: __ruin.growth(o, .25), a: __ruin.growth(o, .2), b: __ruin.growth(o, .3) }; });
      near(r.all, .5 * Math.log(.9), 1e-12); near(r.k, .5 * Math.log(1.125) + .5 * Math.log(.9), 1e-12); ok(r.k > r.a && r.k > r.b);
    },
    'seasons are deterministic and fair: the same stakes give the same result, and you face the same cards as the regulars': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const R = __ruin, k = R.botFracs(3, 'kate'), a = R.simulate(3, k), b = R.simulate(3, k.slice()), deck = Array.from({ length: 24 }, (_, i) => R.offerAt(3, i).id);
        return { same: a.final === b.final, kinds: new Set(deck).size, kateIsYou: R.score(3, k).share }; });
      ok(r.same); ok(r.kinds >= 3, 'table 4 should deal a mix of games'); eq(Math.round(r.kateIsYou * 1000) / 1000, 1);
    },
    'the Kelly stake earns three stars on every table': async ({ page, eq }) => {
      for (let i = 0; i < 7; i++) eq((await play(page, i, 'o => o.kelly')).stars, 3, 'table ' + (i + 1));
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      const naive = { idle: 'o => 0', allIn: 'o => 1', timid: '(o, R) => R.mean(o) > 0 ? .02 : 0', flat10: 'o => .1', random: '(o) => [0,.01,.02,.05,.1,.25,.5,1][Math.floor(Math.random() * 8)]', biggestMean: '(o, R) => R.mean(o) > 0 ? 1 : 0' };
      const late = [4, 5, 6], res = [];
      for (const ti of late) for (const [k, pol] of Object.entries(naive)) for (let s = 0; s < (k === 'random' ? 5 : 1); s++) res.push((await play(page, ti, pol)).stars);
      const lowRate = res.filter(x => x <= 1).length / res.length;
      ok(lowRate >= .8, 'naive bettors scored above one star too often: ' + res);
      // competent but simple: half of the mean/variance rule on games that pay on average
      const comp = []; for (let ti = 0; ti < 7; ti++) comp.push((await play(page, ti, '(o, R) => { const m = R.mean(o), v = o.out.reduce((a, [p, r]) => a + p * r * r, 0) - m * m; return m > 0 ? Math.min(1, v ? m / v / 2 : 1) : 0; }')).stars);
      ok(comp.every(s => s >= 1), 'a sound simple bettor should win every table: ' + comp);
      ok(comp.filter(s => s === 3).length <= 1, 'three stars should need near-Kelly stakes: ' + comp);
    },
    'the real UI: chips, the fine slider and Place the bet advance the season; finishing unlocks the next table': async ({ page, ok, eq }) => {
      await page.click('.chip[data-v="0.25"]');
      eq(await page.evaluate(() => document.getElementById('betV').textContent), '25%');
      for (let r = 0; r < 20; r++) { const k = await page.evaluate(() => { const R = __ruin; return R.offerAt(0, R.SAVE.play[0]?.length || 0).kelly; }); await page.evaluate(k => { __ruin.bet = k; }, k); await page.click('#betBtn'); }
      await page.waitForTimeout(200);
      ok(await page.locator('.modal .stars').count() === 1, 'no end-of-season verdict');
      ok((await page.textContent('.modal')).includes('Kelly'), 'Kate\'s secret not revealed');
      await close(page);
      eq(await page.evaluate(() => __ruin.SAVE.done[0]), 3);
      ok(!(await page.isDisabled('.tb[data-i="1"]')), 'next table still locked');
      ok(await page.isDisabled('.tb[data-i="2"]'), 'table 3 open too early');
    },
    'keyboard: digits pick chips, Enter bets; locked tables cannot be opened': async ({ page, eq }) => {
      await page.keyboard.press('5'); eq(await page.evaluate(() => document.getElementById('betV').textContent), '10%');
      await page.keyboard.press('Enter'); eq(await page.evaluate(() => __ruin.SAVE.play[0].length), 1);
      await page.evaluate(() => __ruin.open(4)); eq(await page.evaluate(() => __ruin.cur), 0);
    },
    'reloading mid-season resumes the same round; saves are sanitised; progress stays within 1': async ({ page, eq }) => {
      const c = await page.evaluate(() => [null, 3, { v: 2, done: { 0: 9, 1: 'x', 99: 2 }, play: { 0: [.1, 2], 1: [.1, .2] }, cur: 50 }, { done: { 0: 1, 5: 1 }, cur: 5 }].map(__ruin.cleanSave));
      eq(c[2].done, { 0: 3 }); eq(c[2].play, { 1: [.1, .2] }); eq(c[2].cur, 0); eq(c[3].done, {});
      await page.evaluate(() => { __ruin.bet = .25; __ruin.placeBet(); __ruin.placeBet(); });
      await page.reload(); await page.waitForTimeout(400); await close(page);
      eq(await page.evaluate(() => __ruin.SAVE.play[0].length), 2);
      eq(await page.evaluate(() => document.querySelector('.lbl').textContent.includes('round 3 of 20')), true);
      await page.evaluate(() => { const R = __ruin; for (let i = 0; i < 7; i++) R.SAVE.done[i] = 3; R.render(); R.placeBet(); });
      eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).ruin), 1);
    },
    'touch (portrait): the chart and the betting controls are on screen together; a tapped bet moves the chart without scrolling': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      const vis = sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height > 0; }, sel);
      ok(await vis('#chart'), 'chart off screen'); ok(await vis('#betBtn'), 'Place the bet off screen'); ok(await vis('.chip[data-v="1"]'), 'chips off screen');
      await page.dispatchEvent('.chip[data-v="0.25"]', 'click'); await page.dispatchEvent('#betBtn', 'click');
      eq(await page.evaluate(() => [scrollY, __ruin.SAVE.play[0].length]), [0, 1]);
      ok(await vis('#chart') && await vis('#betBtn'), 'layout moved after betting');
    },
    'phone: the chart is the main surface; tables open from a drawer': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      const h = await page.evaluate(() => document.getElementById('chart').getBoundingClientRect().height); ok(h > 380, 'chart too small ' + h);
      await page.click('#lvlBtn'); await page.waitForTimeout(300);
      ok(await page.evaluate(() => document.getElementById('tables').getBoundingClientRect().left >= 0), 'drawer did not open');
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= 392), 'sideways scroll');
    },
  },
};
