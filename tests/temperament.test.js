// Temperament: a season at one organ. Real interval maths, tuning by beats (no cents shown), whose music pays for the comma.
const { tmBot } = require('./temperament.bots.js');
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const runBots = (page, posts, pols) => page.evaluate(([posts, pols, seeds]) => { const out = {}; for (const p of posts) { out[p] = {}; for (const pol of pols) out[p][pol] = seeds.map(s => tmBot(p, s, pol)); } return out; }, [posts, pols, SEEDS]);

module.exports = {
  page: 'temperament/index.html',
  ready: async page => { await page.waitForFunction(() => window.__tm); await closeModals(page); },
  tests: {
    'interval maths: pure fifth beatless, ET fifth beats ~0.89 Hz, the comma is conserved whatever the pegs do': async ({ page, near, ok }) => {
      const r = await page.evaluate(() => {
        const T = window.__tm, pyth = T.START.pyth(), et = T.START.et(), s = T.newSeason(1, 'x'), sums = [];
        for (let t = 0; t < 20; t++) { T.setNote(s, 1 + (t % 11), s.tun[1 + (t % 11)] + (Math.sin(t * 7) * 30)); sums.push([...Array(12).keys()].reduce((a, i) => a + T.dev(s.tun, i, 7), 0)); }
        return { b0: T.beats(pyth, 0, 7), bet: T.beats(et, 0, 7), bM3: T.beats(et, 0, 4), m3: T.dev(T.START.mean(), 0, 4), sums, wolf: T.dev(T.START.mean(), 8, 7) };
      });
      near(r.b0, 0, 1e-9); near(r.bet, .886, .01); near(r.bM3, 10.4, .2, 'ET C–E beats about 10 times a second'); near(r.m3, 0, 1e-9); near(r.wolf, 35.7, .1, 'meantone wolf');
      r.sums.forEach(x => near(x, -23.46, .01, 'twelve fifths must always lose a Pythagorean comma'));
    },
    'no cents are ever printed: you tune by beats': async ({ page, ok }) => {
      const t = await page.evaluate(() => document.body.innerText);
      ok(!/¢|cents?\b/i.test(t), 'found a cents readout');
    },
    'first ten seconds: C–G is selected, G has sagged into a wolf, nudging G up calms it and the coach moves on': async ({ page, ok }) => {
      ok(await page.evaluate(() => { const T = window.__tm; return T.sel[0] === 0 && T.sel[1] === 7 && Math.abs(T.dev(T.S.ss.tun, 0, 7)) > 12; }), 'C–G not a wolf at start');
      ok((await page.textContent('#coachL')).includes('flame'), 'no first coach step');
      for (let i = 0; i < 5; i++) await page.click('#nud [data-d="3"]');
      const d = await page.evaluate(() => Math.abs(window.__tm.dev(window.__tm.S.ss.tun, 0, 7)));
      ok(d < 7, 'not calmed: ' + d);
      ok((await page.textContent('#coachL')).includes('Hear'), 'coach did not advance');
      ok(await page.evaluate(() => window.__tm.S.ss.moved.join() === '7'), 'one peg should be used');
    },
    'dragging a note on the rose (touch) retunes it, and the drag counts as one peg': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      const b = await page.locator('#wheel .node[data-n="7"]').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      const before = await page.evaluate(() => window.__tm.S.ss.tun[7]);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let dy = 0; dy <= 60; dy += 6) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - dy }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const r = await page.evaluate(b0 => { const s = window.__tm.S.ss; return { d: s.tun[7] - b0, moved: s.moved.length, undo: s.undo.length }; }, before);
      ok(r.d > 2, 'G not raised: ' + r.d); ok(r.moved === 1 && r.undo === 1, 'drag should be one peg and one undo step: ' + JSON.stringify(r));
    },
    'mouse drag: pulling a peg outward sharpens it a useful amount, the peg follows the pointer, and a live readout shows cents and beats': async ({ page, ok }) => {
      const pt = n => page.evaluate(n => { const r = document.querySelector(`#wheel .node[data-n="${n}"]`).getBoundingClientRect(), w = document.getElementById('wheel').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, w.x + w.width / 2, w.y + w.height / 2]; }, n);
      const drag = async (n, f, check) => { const [x, y, cx, cy] = await pt(n), L = Math.hypot(x - cx, y - cy), u = [(x - cx) / L, (y - cy) / L], t0 = await page.evaluate(n => window.__tm.S.ss.tun[n], n);
        const [dx, dy] = f(u); await page.mouse.move(x, y); await page.mouse.down(); for (let k = 1; k <= 6; k++) await page.mouse.move(x + dx * k / 6, y + dy * k / 6);
        if (check) await check(x, y); await page.mouse.up(); return (await page.evaluate(n => window.__tm.S.ss.tun[n], n)) - t0; };
      // G (top right): outward by 45 px
      const up = await drag(7, u => [u[0] * 45, u[1] * 45], async (x, y) => {
        const mid = await page.evaluate(() => ({ txt: document.getElementById('wheel').textContent, tr: document.querySelector('#wheel .node[data-n="7"]').getBoundingClientRect() }));
        ok(/¢/.test(mid.txt) && /beats\/s|no beats/.test(mid.txt), 'no live readout while dragging: ' + mid.txt.slice(-80));
        ok(Math.hypot(mid.tr.x + mid.tr.width / 2 - x, mid.tr.y + mid.tr.height / 2 - y) > 10, 'the peg does not move with the pointer');
      });
      ok(up > 8, 'outward drag barely moved G: ' + up);
      ok(!/¢/.test(await page.evaluate(() => document.getElementById('wheel').textContent)), 'readout should go away after the drag');
      // F♯ sits at the bottom: outward there is downward, and inward flattens
      ok(await drag(6, u => [u[0] * 40, u[1] * 40]) > 6, 'outward on a bottom note should sharpen');
      ok(await drag(2, u => [-u[0] * 40, -u[1] * 40]) < -6, 'inward should flatten');
    },
    'touch drag clockwise along the rim sharpens; the coach says which way to pull': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
      ok(/outward/.test(await page.textContent('#coachL')), 'coach does not say which way to drag');
      const [x, y, cx, cy] = await page.evaluate(() => { const r = document.querySelector('#wheel .node[data-n="7"]').getBoundingClientRect(), w = document.getElementById('wheel').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, w.x + w.width / 2, w.y + w.height / 2]; });
      const L = Math.hypot(x - cx, y - cy), t = [-(y - cy) / L, (x - cx) / L]; // clockwise on screen
      const before = await page.evaluate(() => window.__tm.S.ss.tun[7]), cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + t[0] * 5 * k, y: y + t[1] * 5 * k }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const d = await page.evaluate(b => window.__tm.S.ss.tun[7] - b, before); ok(d > 6, 'clockwise touch drag did not sharpen G: ' + d);
      ok(!/flame calms/.test(await page.textContent('#coachL')) || Math.abs(await page.evaluate(() => window.__tm.dev(window.__tm.S.ss.tun, 0, 7))) >= 7, 'coach state inconsistent');
    },
    'first visit explains the circle once (with the comma spiral); tapping a line names it and its beats; legend and all-lines toggle': async ({ page, ok, eq }) => {
      await page.evaluate(() => localStorage.removeItem('rh:temper3')); await page.reload(); await page.waitForTimeout(600);
      const m = await page.evaluate(() => ({ t: document.querySelector('.modal')?.textContent || '', sp: !!document.querySelector('.modal .spiral path') }));
      ok(/circle of fifths/.test(m.t) && /comma/.test(m.t) && m.sp, 'no circle explainer on a first visit');
      await page.click('.modal .primary'); await page.reload(); await page.waitForTimeout(600);
      eq(await page.locator('.modal').count(), 0, 'explainer shown again after it was read');
      ok(/major thirds/.test(await page.textContent('#legendL')), 'no legend');
      const faint = () => page.evaluate(() => [...document.querySelectorAll('#wheel [data-line]')].filter(p => +p.getAttribute('opacity') < .5).length);
      ok(await faint() > 6, 'lines outside this week\'s music should be faint');
      await page.click('#allB'); eq(await faint(), 0, 'All lines shows every line'); await page.click('#allB');
      await page.evaluate(() => { const h = document.querySelector('#wheel .hit[data-i="0"][data-k="4"]'); const r = h.getBoundingClientRect(); h.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); });
      ok(/C–E major third: (beats [\d.]+×\/s|no beats)/.test(await page.locator('.toast').last().textContent()), 'tapping C–E did not name the interval and its beats');
    },
    'the goal names this week\'s sour lines in plain words and marks the same lines on the rose': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const T = window.__tm; T.S.coach = 9; T.startSeason(1, 'goal'); });
      const g = await page.evaluate(() => ({ txt: document.getElementById('coachL').textContent, marked: [...document.querySelectorAll('#wheel path.goal')].length }));
      if (/Before Sunday, make/.test(g.txt)) { const n = (g.txt.match(/[A-G][♯♭]?–[A-G][♯♭]?/g) || []).length; ok(n >= 1, g.txt); eq(g.marked, n, 'marked lines'); }
      else ok(/smooth/.test(g.txt) && g.marked === 0, 'goal text: ' + g.txt);
      await page.evaluate(() => { const T = window.__tm, s = T.S.ss; T.setNote(s, 7, s.tun[7] - 25); T.renderAll(); });
      ok(/Before Sunday, make .*G/.test(await page.textContent('#coachL')), 'a wolf on C–G is not named as the goal: ' + await page.textContent('#coachL'));
    },
    'mobile: the rose and its controls fit on one 390x844 screen': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
      const r = await page.evaluate(() => { const w = document.getElementById('wheel').getBoundingClientRect(), c = document.getElementById('ctl').getBoundingClientRect(); return { w: [w.top, w.bottom, w.width], c: [c.top, c.bottom], sw: document.documentElement.scrollWidth }; });
      ok(r.w[0] >= 0 && r.c[1] <= 844 && r.w[2] > 330, JSON.stringify(r)); ok(r.sw <= 392, 'sideways scroll');
    },
    'pegs: free ones first, then each costs coin; undo and reset refund': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const T = window.__tm, s = T.newSeason(0, 'p'), c0 = s.coin, out = {};
        [2, 4, 9].forEach(n => T.setNote(s, n, s.tun[n] + 1)); out.free = c0 - s.coin;
        T.setNote(s, 2, s.tun[2] + 1); out.same = c0 - s.coin;
        T.setNote(s, 11, s.tun[11] + 1); out.extra = c0 - s.coin;
        T.undo(s); out.undo = c0 - s.coin;
        T.setNote(s, 11, s.tun[11] + 1); T.setNote(s, 5, s.tun[5] - 2); T.resetWeek(s); out.reset = [c0 - s.coin, s.moved.length];
        out.fork = T.setNote(s, 0, 5); const k = T.newSeason(3, 'k'); out.locked = T.setNote(k, 7, k.tun[7] + 1);
        return out;
      });
      eq(r, { free: 0, same: 0, extra: 2, undo: 0, reset: [0, 0], fork: false, locked: false });
    },
    'tools: Pure makes the selected interval beatless; Temper and Even only once the posting grants them': async ({ page, near, eq }) => {
      const r = await page.evaluate(() => {
        const T = window.__tm, s = T.newSeason(0, 'q'), t = T.newSeason(2, 'q');
        T.applyTool(s, 'pure', 9, 4); const temperVillage = T.applyTool(s, 'temper', 0, 7);
        T.applyTool(t, 'temper', 2, 7); T.applyTool(t, 'even', 4, 7, true);
        return { pure: T.dev(s.tun, 9, 4), tv: temperVillage, temper: T.dev(t.tun, 2, 7), even: T.iv(t.tun, 4, 7) };
      });
      near(r.pure, 0, 1e-9); eq(r.tv, false); near(r.temper, -5.377, .01); near(r.even, 700, 1e-9);
    },
    'naive play fails: an idle or random tuner never earns promotion': async ({ page, ok }) => {
      await page.addScriptTag({ content: tmBot.toString() });
      const r = await runBots(page, [0, 1, 2, 3], ['idle', 'random']);
      for (const p in r) for (const pol in r[p]) ok(r[p][pol].every(x => !x.passed), `${pol} passed post ${p}: ` + JSON.stringify(r[p][pol].map(x => x.rep)));
    },
    'competent adaptive play is promoted at every posting, and no fixed temperament wins every season': async ({ page, ok }) => {
      await page.addScriptTag({ content: tmBot.toString() });
      const r = await runBots(page, [0, 1, 2, 3, 4], ['adaptive', 'et', 'mean']);
      for (const p in r) {
        const a = r[p].adaptive.filter(x => x.passed).length;
        ok(a >= 7, `adaptive passed only ${a}/8 at post ${p}: ` + r[p].adaptive.map(x => x.rep));
        for (const pol of ['et', 'mean']) { const n = r[p][pol].filter(x => x.passed).length; ok(n < SEEDS.length, `${pol} wins every season at post ${p}`);
          ok(r[p][pol].reduce((a, x) => a + x.rep, 0) < r[p].adaptive.reduce((a, x) => a + x.rep, 0), `${pol} should do worse than adaptive at ${p}`); }
      }
      ok([1, 2, 3].every(p => r[p].mean.filter(x => x.passed).length <= 4 && r[p].et.filter(x => x.passed).length <= 4), 'a fixed temperament passes too often after the village');
    },
    'deterministic per seed: the same weeks, drifts and bot result every time': async ({ page, eq, ok }) => {
      await page.addScriptTag({ content: tmBot.toString() });
      const r = await page.evaluate(() => { const T = window.__tm, P = T.postFor(2, 'zz');
        return { w: JSON.stringify(T.genWeek(P, 'zz', 3)) === JSON.stringify(T.genWeek(P, 'zz', 3)), d: JSON.stringify(T.genWeek(P, 'zz', 3)) !== JSON.stringify(T.genWeek(P, 'zy', 3)),
          a: tmBot(1, 'det', 'adaptive'), b: tmBot(1, 'det', 'adaptive'), wa: JSON.stringify(T.postFor(4, 'w1')) === JSON.stringify(T.postFor(4, 'w1')) }; });
      ok(r.w && r.d && r.wa, 'weeks not seeded'); eq(r.a, r.b);
    },
    'a whole week through the page: accept, ring, hurry, results, next week drifts the organ': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const T = window.__tm; T.startSeason(1, 'ui'); });
      await page.click('[data-acc="L0"]'); await page.click('[data-acc="L1"]'); await page.click('[data-acc="L2"]');
      eq(await page.evaluate(() => window.__tm.S.ss.acc.length), 2, 'slots not enforced');
      await page.click('#perf'); await page.waitForTimeout(400); await page.click('#desk'); await page.waitForTimeout(500);
      ok(await page.locator('#nextW').count() === 1, 'no results');
      const before = await page.evaluate(() => window.__tm.S.ss.tun.slice());
      await page.click('#nextW');
      const r = await page.evaluate(b => { const s = window.__tm.S.ss; return { week: s.week, changed: s.tun.filter((x, i) => Math.abs(x - b[i]) > .1).length, log: s.log.length }; }, before);
      eq(r.week, 1); ok(r.changed >= 1, 'no drift'); eq(r.log, 1);
    },
    'ringing for Sunday really plays (the Ring click is not taken as a hurry) and the pegs are locked while it plays': async ({ page, ok, eq }) => {
      await page.click('[data-acc="L0"]'); await page.click('#perf'); await page.waitForTimeout(500);
      eq(await page.evaluate(() => window.__tm.S.ss.phase), 'week', 'the performance was skipped at once');
      ok((await page.textContent('#desk h2')).includes('Sunday'), 'not performing');
      ok(await page.evaluate(() => [...document.querySelectorAll('#nud [data-d], #nud [data-t], #undoB, #resetB')].every(b => b.disabled)), 'tuning controls live during the performance');
      const t = await page.evaluate(() => window.__tm.S.ss.tun.slice());
      const g = await page.evaluate(() => { const n = document.querySelector('#wheel .node[data-n="7"]').getBoundingClientRect(); return [n.x + n.width / 2, n.y + n.height / 2]; });
      await page.mouse.move(g[0], g[1]); await page.mouse.down(); await page.mouse.move(g[0], g[1] - 60, { steps: 4 }); await page.mouse.up();
      eq(await page.evaluate(() => window.__tm.S.ss.tun), t, 'the rose retuned during the performance');
      await page.click('#desk'); await page.waitForTimeout(500); eq(await page.evaluate(() => window.__tm.S.ss.phase), 'done');
    },
    'the first-week frost lesson does not linger into week two': async ({ page, ok }) => {
      ok((await page.textContent('#coachL')).includes('frost'), 'no first coach');
      await page.click('[data-acc="L0"]'); await page.click('#perf'); await page.waitForTimeout(300); await page.click('#desk'); await page.waitForTimeout(500);
      await page.click('#nextW'); await page.waitForTimeout(200);
      ok(!(await page.textContent('#coachL')).includes('frost'), 'week 2 still tells the player G is frost-flat');
    },
    'turning back the week restores purse, reputation and pegs': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const T = window.__tm, s = T.newSeason(1, 'rt'); T.toggleAccept(s, 'L0'); T.setNote(s, 4, s.tun[4] - 3);
        const snap = JSON.stringify([s.coin, s.rep, s.tun, s.acc]); T.perform(s); T.retake(s); return [snap === JSON.stringify([s.coin, s.rep, s.tun, s.acc]), s.phase, s.retakes, s.moved]; });
      eq(r, [true, 'week', 1, [4]]);
    },
    'a dark week hides the colours and the marks but keeps the flame': async ({ page, ok }) => {
      await page.evaluate(() => { const T = window.__tm; T.startSeason(0, 'dk'); const s = T.S.ss; while (!T.genWeek(T.postFor(0, 'dk'), 'dk', s.week).dark) { T.perform(s); T.nextWeek(s); } T.renderAll(); });
      const r = await page.evaluate(() => ({ dark: document.body.classList.contains('dark'), marks: document.querySelectorAll('.ch.sweet,.ch.sour,.ch.fair,.ch.wolf').length, txt: document.getElementById('wheel').textContent }));
      ok(r.dark && r.marks === 0 && r.txt.includes('by ear'), JSON.stringify(r));
    },
    'season end: promotion opens the next posting; the share grid has one glyph a week': async ({ page, ok, eq }) => {
      await page.addScriptTag({ content: tmBot.toString() });
      const r = await page.evaluate(async () => { const T = window.__tm; T.S.ss = T.newSeason(0, 'b'); const s = T.S.ss;
        while (s.phase === 'week') { for (const l of T.genWeek(T.postFor(0, 'b'), 'b', s.week).letters) T.toggleAccept(s, l.id); [7, 4, 9].forEach(n => 0); T.perform(s); if (s.phase === 'done') T.nextWeek(s); }
        return { grid: T.shareGrid(s), phase: s.phase }; });
      eq([...r.grid].length, 6); eq(r.phase, 'end');
      // drive a passing season through the end-of-season modal
      await page.evaluate(() => { const T = window.__tm; T.S.ss = T.newSeason(0, 'b'); const s = T.S.ss; s.week = 5; s.rep = 40; T.perform(s); T.renderAll(); });
      await page.click('#endB'); await page.waitForTimeout(300);
      ok((await page.textContent('.modal')).includes('Promoted'), 'no promotion');
      ok(await page.evaluate(() => window.__tm.S.open === 1 && window.__tm.S.best[0].seal), 'next posting not open');
    },
    'saves: corrupt or hostile saves load safely; a season survives reload': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const T = window.__tm, put = v => localStorage.setItem('rh:temper3', typeof v === 'string' ? v : JSON.stringify(v)), out = [];
        for (const v of ['{{', 'null', '[]', '7', { open: 'x', best: { 0: { rep: 'NaN' }, 99: 1 }, ss: { post: 9, seed: 3 } }, { open: 99, ss: { post: 1, seed: 'a', tun: [0, 1, 2], week: -4 } },
          { ss: { post: 2, seed: 'q', tun: Array(12).fill(1e9), week: 999, phase: 'done', log: 'x', acc: ['L9', 'h', 'L0'], coin: 'lots' }, dailies: { '2026-01-01': 5, 'junk': 'x' } }]) {
          put(v); const s = T.loadState(); out.push([s.open, !!s.ss, Number.isFinite(s.ss.coin), s.ss.tun.every(Number.isFinite) && s.ss.tun.every((x, n) => Math.abs(x - 100 * n) <= 70), s.ss.week < T.POSTS[s.ss.post].weeks, Object.keys(s.dailies).length]); }
        return out; });
      r.forEach(x => ok(x[1] && x[2] && x[3] && x[4] && x[0] >= 0 && x[0] <= 4 && x[5] === 0, 'bad load ' + JSON.stringify(x)));
      await page.evaluate(() => { const T = window.__tm; T.startSeason(2, 'keep'); const s = T.S.ss; T.toggleAccept(s, 'L1'); T.setNote(s, 4, s.tun[4] + 2); T.S.ss.week = 0; localStorage.setItem('rh:temper3', JSON.stringify({ ...T.S, ss: { ...s, undo: undefined } })); });
      await page.reload(); await page.waitForFunction(() => window.__tm); await closeModals(page);
      const k = await page.evaluate(() => { const s = window.__tm.S.ss; return [s.post, s.seed, s.acc, s.moved]; });
      eq(k, [2, 'keep', ['L1'], [4]]);
    },
    'share link: #season=post:seed plays the same weeks (daily seeds included)': async ({ page, eq }) => {
      await page.evaluate(() => { const T = window.__tm; T.S.open = 2; localStorage.setItem('rh:temper3', JSON.stringify({ open: 2 })); });
      await page.goto(page.url().split('#')[0] + '#season=4:daily%3A2026-11-25'); await page.reload(); await page.waitForFunction(() => window.__tm); await closeModals(page);
      const r = await page.evaluate(() => { const s = window.__tm.S.ss; return [s.post, s.seed, s.daily]; });
      eq(r, [4, 'daily:2026-11-25', '2026-11-25']);
    },
  },
};
