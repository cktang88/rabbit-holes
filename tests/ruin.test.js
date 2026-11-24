// Ruin: exact growth rates against closed forms, the simulation against those rates, and every chapter's win rule.
const plant = async (page, raw) => { await page.addInitScript(raw => localStorage.setItem('rh:ruin', raw), raw); await page.reload(); await page.waitForTimeout(500); };
const setSlider = (page, v) => page.evaluate(v => { const s = document.getElementById('sl'); s.value = v; s.dispatchEvent(new Event('input')); }, v);
const done = page => page.evaluate(() => ({ ...__ruin.done }));
const gF = f => .5 * Math.log(1 + .5 * f) + .5 * Math.log(1 - .4 * f);
const gPool = n => { let g = 0; for (let k = 0; k <= n; k++) { let c = 1; for (let j = 0; j < k; j++) c = c * (n - j) / (j + 1); g += c / 2 ** n * Math.log((1.5 * k + .6 * (n - k)) / n); } return g; };
const gRebal = q => .5 * Math.log(1 + q) + .5 * Math.log(1 - q / 2);

module.exports = {
  page: 'ruin/index.html',
  tests: {
    'growth(): fractional bets match ½ln(1+f/2)+½ln(1−0.4f); Kelly is 25%': async ({ page, near, eq }) => {
      const r = await page.evaluate(() => { __ruin.setup(2); const p = __ruin.params(), out = []; for (let f = 1; f <= 100; f++) { p.f = f / 100; out.push(__ruin.growth()); } return out; });
      r.forEach((g, i) => near(g, gF((i + 1) / 100), 1e-12, 'f=' + (i + 1)));
      eq(r.indexOf(Math.max(...r)) + 1, 25, 'argmax');
      near(r[99], .5 * Math.log(.9), 1e-12, 'all-in');
    },
    'growth(): pooled groups match the binomial formula; 3 is the smallest winning group': async ({ page, near, ok }) => {
      const r = await page.evaluate(() => { __ruin.setup(3); const p = __ruin.params(), out = []; for (let n = 1; n <= 10; n++) { p.pool = n; out.push(__ruin.growth()); } return out; });
      r.forEach((g, i) => near(g, gPool(i + 1), 1e-12, 'n=' + (i + 1)));
      near(r[1], .25 * Math.log(.6) + .5 * Math.log(1.05) + .25 * Math.log(1.5), 1e-12);
      ok(r[0] < 0 && r[1] < 0 && r[2] > 0, 'sign pattern');
      for (let i = 3; i < 10; i++) ok(r[i] > r[i - 1], 'bigger pools grow faster');
    },
    'growth(): Shannon rebalancing matches ½ln(1+q)+½ln(1−q/2), best at 50%': async ({ page, near, ok, eq }) => {
      const r = await page.evaluate(() => { __ruin.setup(4); const p = __ruin.params(), out = []; for (let q = 0; q <= 100; q++) { p.q = q / 100; out.push(__ruin.growth()); } return out; });
      r.forEach((g, q) => near(g, gRebal(q / 100), 1e-12, 'q=' + q));
      eq(r.indexOf(Math.max(...r)), 50); near(r[50], .5 * Math.log(1.125), 1e-12); near(r[0], 0, 1e-12); near(r[100], 0, 1e-12);
      const ok55 = r.map((g, q) => g >= .055 ? q : -1).filter(q => q >= 0); ok(ok55.length >= 10 && ok55.length <= 40, 'target band ' + ok55.length);
    },
    'simulation: mean log-growth per round matches the exact rate (bets, pools, rebalancing)': async ({ page, near }) => {
      const run = (ch, key, v) => page.evaluate(([ch, key, v]) => { __ruin.setup(ch); __ruin.params()[key] = v; __ruin.ff(__ruin.CH[ch].rounds); const W = __ruin.W, n = W.length - (W.length % (__ruin.params().pool || 1)); let s = 0; for (let i = 0; i < n; i++) s += Math.log(W[i]); return [s / n / __ruin.t, __ruin.growth()]; }, [ch, key, v]);
      for (const [ch, key, v, tol] of [[2, 'f', .25, .0015], [2, 'f', 1, .004], [3, 'pool', 3, .006], [4, 'q', .5, .006]]) { const [emp, g] = await run(ch, key, v); near(emp, g, tol, `ch${ch} ${key}=${v}`); }
    },
    'simulation: martingale keeps the average at $100, never bets more than it has, never goes negative': async ({ page, near, ok }) => {
      const r = await page.evaluate(() => { __ruin.setup(5); __ruin.params().limit = 64; __ruin.ff(300); const W = __ruin.W, B = __ruin.martiBet; let s = 0, neg = 0, over = 0; for (let i = 0; i < W.length; i++) { s += W[i]; if (W[i] < 0) neg++; if (B[i] > 64) over++; } return [s / W.length, neg, over]; });
      near(r[0], 100, 8, 'mean'); ok(!r[1] && !r[2], 'negative wealth or bet over the limit');
    },
    'A Thousand Players: share poorer after 100 flips ≈ P(heads ≤ 55) = 86.4%': async ({ page, near }) => {
      let p = 0; for (let k = 0; k <= 55; k++) { let c = 1; for (let j = 0; j < k; j++) c = c * (100 - j) / (j + 1); p += c / 2 ** 100; }
      const below = await page.evaluate(() => { __ruin.setup(1); __ruin.guess = 50; __ruin.ff(100); return __ruin.stats().belowPct; });
      near(below, p * 100, 5);
    },
    'chapter 2: a close guess wins, a far guess does not and offers Guess again': async ({ page, ok, eq }) => {
      await page.evaluate(() => { localStorage.setItem('rh:ruin', JSON.stringify({ done: { 0: 1 }, cur: 1 })); }); await page.evaluate(() => __ruin.setup(1));
      await page.evaluate(() => { __ruin.guess = 20; __ruin.ff(100); }); ok(!(await done(page))[1], 'far guess won'); ok(await page.locator('#again').isVisible(), 'no Guess again');
      await page.locator('#again').click(); eq(await page.evaluate(() => __ruin.t), 0);
      await page.evaluate(() => { __ruin.guess = 86; __ruin.ff(100); }); ok((await done(page))[1], 'close guess did not win');
    },
    'chapter 3: winning needs a completed run at a good bet; sweeping the slider after a run resets it': async ({ page, ok, eq }) => {
      await page.evaluate(() => __ruin.setup(2));
      await page.evaluate(() => __ruin.ff(200)); ok(!(await done(page))[2], 'all-in won');
      // drag the real slider from 100% down across the Kelly bet to 1%: the finished run is discarded, nothing is won
      const b = await page.locator('#sl').boundingBox(); await page.mouse.move(b.x + b.width - 2, b.y + b.height / 2); await page.mouse.down();
      await page.mouse.move(b.x + 2, b.y + b.height / 2, { steps: 25 }); await page.mouse.up(); await page.waitForTimeout(200);
      eq(await page.evaluate(() => __ruin.t), 0, 'run not reset'); ok(!(await done(page))[2], 'won by sweeping');
      await setSlider(page, 25); await page.evaluate(() => __ruin.ff(120)); ok(!(await done(page))[2], 'won before 200 rounds');
      await page.evaluate(() => __ruin.ff(80)); ok((await done(page))[2], 'Kelly run did not win');
      ok((await page.locator('#goal').textContent()).includes('bet 25%'), 'run log missing');
    },
    'chapter 4: groups of 4 grow but are not the smallest; groups of 3 win': async ({ page, ok }) => {
      await page.evaluate(() => __ruin.setup(3));
      await setSlider(page, 4); await page.evaluate(() => __ruin.ff(200)); ok(!(await done(page))[3], 'pool 4 won');
      await setSlider(page, 2); await page.evaluate(() => __ruin.ff(200)); ok(!(await done(page))[3], 'pool 2 won');
      await setSlider(page, 3); await page.evaluate(() => __ruin.ff(200)); ok((await done(page))[3], 'pool 3 did not win');
    },
    'chapter 5 and 6: rebalancing at 50% wins; martingale needs two different limits run to the end': async ({ page, ok }) => {
      await page.evaluate(() => __ruin.setup(4)); await page.evaluate(() => __ruin.ff(120)); ok(!(await done(page))[4], '100% stock won');
      await setSlider(page, 50); await page.evaluate(() => __ruin.ff(120)); ok((await done(page))[4]);
      await page.evaluate(() => __ruin.setup(5)); await page.evaluate(() => __ruin.ff(300)); await page.evaluate(() => __ruin.ff(300)); ok(!(await done(page))[5], 'same limit twice won');
      await setSlider(page, 8); await page.evaluate(() => __ruin.ff(150)); await setSlider(page, 7); await page.evaluate(() => __ruin.ff(300)); ok((await done(page))[5], 'two limits did not win');
    },
    'coin: a flip in the air when you switch chapters does not land in the new one': async ({ page, eq, ok }) => {
      await page.evaluate(() => localStorage.setItem('rh:ruin', JSON.stringify({ done: { 0: 1 }, cur: 0 })));
      ok(await page.evaluate(() => __ruin.flip())); await page.evaluate(() => __ruin.setup(1)); await page.waitForTimeout(1300);
      eq(await page.evaluate(() => [__ruin.t, __ruin.flipping]), [0, false]);
      await page.evaluate(() => __ruin.setup(0)); ok(await page.evaluate(() => __ruin.flip())); await page.locator('#rst').click(); await page.waitForTimeout(1300);
      eq(await page.evaluate(() => __ruin.t), 0, 'flip landed after Reset');
    },
    'coin: space flips once at a time; spamming it does not double-count': async ({ page, eq }) => {
      await page.mouse.click(5, 790); for (let i = 0; i < 8; i++) await page.keyboard.press('Space');
      await page.waitForTimeout(1300); eq(await page.evaluate(() => __ruin.t), 1);
    },
    'locked chapters cannot be opened by click or keyboard': async ({ page, eq }) => {
      await page.focus('.ch[data-i="4"]').catch(() => {}); await page.keyboard.press('Enter');
      await page.evaluate(() => document.querySelector('.ch[data-i="4"]').click());
      eq(await page.evaluate(() => document.getElementById('title').textContent), 'The Coin');
      eq(await page.evaluate(() => [...document.querySelectorAll('.ch')].map(b => b.disabled)), [false, true, true, true, true, true]);
    },
    'saves: corrupted values are sanitised; progress never exceeds 1': async ({ page, eq }) => {
      eq(await page.evaluate(() => [null, 3, '[]', { done: 'x', cur: -2 }, { done: { 2: 1, 9: 1, a: 1 }, cur: 99 }].map(__ruin.cleanSave)), [{ done: {}, cur: 0 }, { done: {}, cur: 0 }, { done: {}, cur: 0 }, { done: {}, cur: 0 }, { done: { 2: 1 }, cur: 0 }]);
      for (const raw of ['{broken', '{"done":[1,2],"cur":"3"}']) { await plant(page, raw); eq(await page.evaluate(() => document.getElementById('title').textContent), 'The Coin', raw); }
      await plant(page, JSON.stringify({ done: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, cur: 5 }));
      eq(await page.evaluate(() => document.getElementById('title').textContent), 'The Martingale');
      await page.evaluate(() => { __ruin.setup(4); __ruin.params().q = .5; __ruin.ff(120); });
      eq(await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).ruin), 1);
    },
    'lessons: one per chapter; phone layout has no page errors': async ({ page, eq }) => {
      eq(await page.evaluate(() => __ruin.LESSON.length === __ruin.CH.length), true);
      await page.setViewportSize({ width: 390, height: 844 });
      for (let i = 0; i < 6; i++) { await page.evaluate(i => __ruin.setup(i), i); await page.waitForTimeout(60); }
    },
  },
};
