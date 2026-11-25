// Ant Mind: the colony runs an instinct card the player writes. These tests drive the real simulation in the page (window.__ant.S)
// with bots: idle and random cards fail, the card you arrive with fails the next chamber, a competent adaptive card wins,
// no fixed card survives every Colony Years seed, runs are deterministic, saves survive corruption, and the UI edits live.
const reloadWith = async (page, key, v) => { await page.addInitScript(([k, val]) => { try { localStorage.setItem(k, val); } catch (e) {} }, [key, v]); await page.reload(); await page.waitForTimeout(500); };
// the adaptive Colony Years bot: reads the season's tags (shown to the player before each season) and picks a card for them
const ADAPT = `(sea) => { const t = sea.tags;
  if (t.includes('cold')) return (t.includes('spider')?'danger>flee,':'')+'always>pick,carry>mark,always>revisit,scout>wander,always>home';
  if (t.includes('spider') && t.includes('rain')) return 'danger>flee,always>pick,carry>mark,tired>home,always>revisit,always>trail';
  if (t.includes('spider')) return 'danger>flee,always>pick,carry>mark,tired>home,always>trail';
  if (t.includes('rain')) return 'always>pick,carry>mark,tired>home,always>revisit,always>trail';
  return 'always>pick,carry>mark,tired>home,always>trail'; }`;
const YEARS = (cards, seeds, adapt) => `(() => { const S = window.__ant.S, adapt = ${adapt || 'null'}; const out = {};
  for (const [name, card] of Object.entries(${JSON.stringify(cards)})) { out[name] = [];
    for (const sd of ${JSON.stringify(seeds)}) { let col = 45, k = 0, fails = 0;
      for (; k < 12 && col >= 20 && fails < 3; k++) { const sea = S.season(sd, k, col); const r = S.run(sea.spec, 'y:' + sd + ':' + k, card || adapt(sea)); if (!r.won) fails++; col = S.after(col, r, sea.spec); }
      out[name].push(col >= 20 && fails < 3 ? k : k - 1); } }
  return out; })()`;

module.exports = {
  page: 'ant-mind/index.html',
  tests: {
    'loads into chamber 1 with a one-line card and ants already walking': async ({ page, eq, ok }) => {
      const s = await page.evaluate(() => ({ ci: __ant.ci, card: __ant.S.text(__ant.card), ants: __ant.w.ants.length, t: __ant.w.t }));
      eq(s.ci, 0); eq(s.card, 'always>wander'); ok(s.ants >= 40); ok(s.t > 0.3, 'the colony runs immediately: no intro wall');
      ok(await page.locator('.rule.new.pulse button').isVisible(), 'the empty line invites the first tap');
    },
    'every chamber: the card you arrive with fails, the reference card wins, idle fails': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const S = __ant.S, C = S.CHAMBERS; return C.map((c, i) => ({ n: c.n,
        prev: S.run(c.spec, c.seed, i ? C[i - 1].ref : c.start).won, ref: S.run(c.spec, c.seed, c.ref).won, idle: S.run(c.spec, c.seed, 'always>wander').won,
        lines: S.parse(c.ref).length, slots: c.slots, t: c.spec.t })); });
      for (const c of r) { ok(!c.prev, `${c.n}: the previous card should fail`); ok(c.ref, `${c.n}: the reference card should win`); ok(!c.idle, `${c.n}: idle should fail`); ok(c.lines <= c.slots, `${c.n}: reference fits the card`); ok(c.t >= 60 && c.t <= 90, `${c.n}: resolves in 60–90 s`); }
    },
    'random cards almost never win (naive play fails)': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const S = __ant.S, C = S.CHAMBERS, rr = S.rngOf('random-bot'); let wins = 0, n = 0;
        C.forEach((c, i) => { const cs = new Set(['always']), as = new Set(['wander']); for (let j = 0; j <= i; j++) { (C[j].conds || []).forEach(k => cs.add(k)); (C[j].acts || []).forEach(k => as.add(k)); }
          const cl = [...cs], al = [...as]; for (let k = 0; k < 8; k++) { const m = 1 + rr.int(c.slots), card = []; for (let q = 0; q < m; q++) card.push((rr() < .3 ? '!' : '') + cl[rr.int(cl.length)] + '>' + al[rr.int(al.length)]); n++; if (S.run(c.spec, c.seed, card.join(',')).won) wins++; } });
        return { wins, n }; });
      ok(r.wins / r.n < 0.08, `random cards won ${r.wins}/${r.n}`);
    },
    'line order matters: the same lines in the wrong order mill to death': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const S = __ant.S, c = S.CHAMBERS[2]; return [S.run(c.spec, c.seed, 'always>pick,carry>mark,tired>home,always>trail'), S.run(c.spec, c.seed, 'always>pick,carry>mark,always>trail,tired>home')]; });
      ok(r[0].won && !r[1].won, 'tired above trail breaks the mill; below it does not'); ok(r[1].seen.includes('mill') && r[1].lost > 8, 'the wrong order shows a mill and deaths');
    },
    'Colony Years: no fixed card survives every seed; idle dies fast': async ({ page, ok }) => {
      const cards = { idle: 'always>wander', trail: 'always>pick,carry>mark,tired>home,always>trail', flee: 'danger>flee,always>pick,carry>mark,tired>home,always>trail',
        rain: 'danger>flee,always>pick,carry>mark,tired>home,always>revisit,always>trail', winter: 'tired>home,always>pick,carry>mark,always>trail,scout>wander,always>home', fight: 'danger>attack,always>pick,carry>mark,tired>home,always>trail' };
      const r = await page.evaluate(YEARS(cards, ['s1', 's2', 's3', 's4', 's5', 's6']));
      for (const [n, v] of Object.entries(r)) ok(v.some(x => x < 12), `${n} survived every seed: ${v}`);
      ok(r.idle.every(x => x <= 2), 'idle dies within two seasons: ' + r.idle);
    },
    'Colony Years: an adaptive card (re-written each season) survives': async ({ page, ok }) => {
      const r = await page.evaluate(YEARS({ adapt: null }, ['s1', 's2', 's3', 's4', 's5', 's6'], ADAPT));
      ok(r.adapt.filter(x => x >= 10).length >= 5, 'adaptive should last 10+ seasons on most seeds: ' + r.adapt);
    },
    'deterministic per seed and card; different seeds differ': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const S = __ant.S, c = S.CHAMBERS[4]; const a = S.run(c.spec, 'x1', c.ref), b = S.run(c.spec, 'x1', c.ref), d = S.run(c.spec, 'x2', c.ref);
        const s1 = S.season('2026-01-01', 3, 50), s2 = S.season('2026-01-01', 3, 50); return { a, b, d, same: JSON.stringify(s1) === JSON.stringify(s2) }; });
      eq(r.a, r.b); ok(JSON.stringify(r.a) !== JSON.stringify(r.d)); ok(r.same);
    },
    'editing a line applies to the running colony at once (no reset)': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __ant.paused = true; __ant.run(200); });
      const t0 = await page.evaluate(() => __ant.w.t);
      await page.click('.rule.new button'); await page.click('#picker .opts button:has-text("pick up food")');
      const s = await page.evaluate(() => ({ t: __ant.w.t, card: __ant.S.text(__ant.card) }));
      eq(s.card, 'always>wander,always>pick'); ok(Math.abs(s.t - t0) < 1e-9, 'the world was not reset');
      // the new line sits below "always wander", so nobody runs it: move it up from its action picker
      await page.click('.rule .act[data-i="1"]'); await page.click('#picker [data-mv="-1"]');
      eq(await page.evaluate(() => __ant.S.text(__ant.card)), 'always>pick,always>wander');
      await page.evaluate(() => __ant.run(100));
      const used = await page.evaluate(() => __ant.w.counts[0] + __ant.w.ants.filter(a => a.carry).length);
      ok(used > 0, 'ants obey the new line: some are carrying');
      // conditions: unless + carrying
      await page.click('.rule .cond[data-i="1"]'); await page.click('#picker [data-neg="1"]'); await page.click('#picker .opts button:has-text("carrying food")');
      eq(await page.evaluate(() => __ant.S.text(__ant.card)), 'always>pick,!carry>wander');
    },
    'locked pieces show as ? and cannot be chosen': async ({ page, ok }) => {
      await page.click('.rule .act[data-i="0"]');
      const dis = await page.locator('#picker .opts button:disabled').count(); ok(dis >= 6, 'later actions are locked in chamber 1: ' + dis);
      await page.keyboard.press('Escape');
    },
    'the scent brush is scarce: painting spends the gland and lays trail': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const A = __ant, w = A.w; const g0 = w.gland; let laid = 0; for (let x = 30; x < 110; x += 0.8) A.S.paint(w, x, 40, false);
        for (let i = 0; i < w.trail.length; i++) laid += w.trail[i]; return { g0, g1: w.gland, laid }; });
      ok(r.g0 > 0.9 && r.g1 < 0.15, `gland ${r.g0} -> ${r.g1}`); ok(r.laid > 20);
      // real pointer painting on the canvas
      await page.evaluate(() => { __ant.w.gland = 1; __ant.paused = true; });
      const a = await page.evaluate(() => __ant.toScreen(60, 20)), b = await page.evaluate(() => __ant.toScreen(90, 20));
      await page.mouse.move(a[0], a[1]); await page.mouse.down(); for (let k = 1; k <= 10; k++) await page.mouse.move(a[0] + (b[0] - a[0]) * k / 10, a[1]); await page.mouse.up();
      ok(await page.evaluate(() => __ant.w.gland < 0.9 && __ant.w.trail[__ant.S.idx(75, 20)] > 0.3), 'dragging paints');
    },
    'winning a chamber saves the best, opens the next and keeps the card': async ({ page, ok, eq }) => {
      await page.evaluate(() => { __ant.setCard('always>pick,carry>home'); __ant.paused = true; __ant.run(2000); });
      ok(await page.evaluate(() => __ant.ended && __ant.w.won));
      await page.waitForSelector('.modal', { timeout: 4000 });
      ok(await page.locator('.modal').textContent().then(t => /par/.test(t)), 'result shows axes vs par');
      await page.click('.modal button:has-text("Next chamber")');
      const s = await page.evaluate(() => ({ ci: __ant.ci, card: __ant.S.text(__ant.card), best: __ant.SAVE.best[0] }));
      eq(s.ci, 1); eq(s.card, 'always>pick,carry>home'); ok(s.best && s.best.lines === 2);
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:ant')));
      ok(stored.best[0] && stored.v === 2);
    },
    'failing shows a diagnosis and retry is one tap': async ({ page, ok }) => {
      await page.evaluate(() => { __ant.openChamber(0); __ant.paused = true; __ant.run(3000); });
      await page.waitForSelector('.modal', { timeout: 3000 });
      const t = await page.locator('.modal').textContent(); ok(/food/.test(t), t);
      const t0 = Date.now(); await page.click('.modal button'); ok(await page.evaluate(() => !__ant.ended && __ant.w.t < 1)); ok(Date.now() - t0 < 2000);
    },
    'corrupted saves are survived': async ({ page, ok }) => {
      for (const bad of ['{', 'null', '[]', '{"v":2,"best":{"0":{"t":"x","lost":null},"99":{}},"cur":42,"card":"always>explode,carry>home,!!x>y","seen":"yes","years":{"<script>":5,"ok":"9"}}', '{"v":2,"cards":{"0":5,"7":"always>pick"},"ycard":3}']) {
        await reloadWith(page, 'rh:ant', bad);
        const s = await page.evaluate(() => ({ ci: __ant.ci, card: __ant.S.text(__ant.card), ants: __ant.w.ants.length, best: Object.keys(__ant.SAVE.best).length }));
        ok(s.ants > 0 && s.ci === 0, 'game boots from ' + bad); ok(!/explode/.test(s.card));
      }
    },
    'a shared card link loads the card; Colony Years daily seed link works once open': async ({ page, ok, eq }) => {
      await page.goto(page.url().split('#')[0] + '#c=1&card=' + encodeURIComponent('always>pick,carry>home,always>wander')); await page.reload(); await page.waitForTimeout(500);
      eq(await page.evaluate(() => __ant.S.text(__ant.card)), 'always>pick,carry>home,always>wander');
      const best = {}; for (let i = 0; i < 7; i++) best[i] = { t: 50, lost: 0, lines: 5 };
      await reloadWith(page, 'rh:ant', JSON.stringify({ v: 2, best }));
      await page.goto(page.url().split('#')[0] + '#years=2026-11-25'); await page.reload(); await page.waitForTimeout(500);
      const y = await page.evaluate(() => ({ seed: __ant.years && __ant.years.seed, paused: __ant.paused, tags: __ant.years.sea.tags }));
      eq(y.seed, '2026-11-25'); ok(y.paused, 'a season starts paused so you can edit first'); ok(y.tags.length >= 1);
      ok(await page.locator('#yearsBox button:has-text("Today")').isVisible());
    },
  },
};
