// Rule Hunter: CA stepping, object separation, classifier on known Life patterns, naming/speeds, scanning, bounties, saves, UI.
const P = (t) => t.split('\n').flatMap((r, y) => [...r].map((c, x) => c === 'O' ? [x, y] : null).filter(Boolean));
const PAT = {
  block: [[0, 0], [1, 0], [0, 1], [1, 1]],
  beehive: P('.OO.\nO..O\n.OO.'),
  blinker: [[0, 0], [1, 0], [2, 0]],
  toad: P('.OOO\nOOO.'),
  pulsar: P('..OOO...OOO..\n.............\nO....O.O....O\nO....O.O....O\nO....O.O....O\n..OOO...OOO..\n.............\n..OOO...OOO..\nO....O.O....O\nO....O.O....O\nO....O.O....O\n.............\n..OOO...OOO..'),
  glider: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  lwss: P('.O..O\nO....\nO...O\nOOOO.'),
  gun: P('........................O...........\n......................O.O...........\n............OO......OO............OO\n...........O...O....OO............OO\nOO........O.....O...OO..............\nOO........O...O.OO....O.O...........\n..........O.....O.......O...........\n...........O...O....................\n............OO......................'),
  acorn: [[1, 0], [3, 1], [0, 2], [1, 2], [4, 2], [5, 2], [6, 2]],
};
async function reopen(page) { const p2 = await page.context().newPage(); const errs = []; p2.on('pageerror', e => errs.push(e.message)); await p2.goto(page.url()); await p2.waitForTimeout(300); p2.errs = errs; return p2; }
// Real touch input through Chrome's protocol (touch emulation on, finger drags with intermediate moves).
async function touchSession(page) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); return cdp; }
async function touchDrag(cdp, a, b, steps = 6) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0], y: a[1], id: 1 }] });
  for (let k = 1; k <= steps; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a[0] + (b[0] - a[0]) * k / steps, y: a[1] + (b[1] - a[1]) * k / steps, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
async function touchPinch(cdp, c, d0, d1) { const pts = (d) => [{ x: c[0] - d, y: c[1], id: 1 }, { x: c[0] + d, y: c[1], id: 2 }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(d0) });
  for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d0 + (d1 - d0) * k / 5) }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
const dismiss = (page) => page.evaluate(() => { __rh.setMode('dish'); document.querySelectorAll('.modal-bg').forEach(m => m.remove()); __rh.running = false; });
const noBet = (page) => page.evaluate(() => { if (__rh.mode !== 'dish') { __rh.setMode('dish'); document.querySelectorAll('.modal-bg').forEach(m => m.remove()); } if (__rh.pending) __rh.predict(null); __rh.S.noPredict = 1; __rh.running = false; });

module.exports = {
  page: 'rule-hunter/index.html',
  tests: {
    'parseRule / ruleStr round-trip; B0 is stripped; bad text rejected': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const R = __rh; let bad = 0; for (let b = 0; b < 512; b += 2) for (let s = 0; s < 512; s += 37) { const x = R.parseRule(R.ruleStr({ b, s })); if (x.b !== b || x.s !== s) bad++; }
        return { bad, b0: R.parseRule('B03/S23'), compact: R.parseRule('b3s23'), sp: R.parseRule(' B 3 / S 2 3 '), junk: [R.parseRule('B9/S1'), R.parseRule('hello'), R.parseRule(''), R.parseRule('3/23')] }; });
      eq(r.bad, 0); eq(r.b0, { b: 8, s: 12 }); eq(r.compact, { b: 8, s: 12 }); eq(r.sp, { b: 8, s: 12 }); eq(r.junk, [null, null, null, null]);
    },
    'stepGrid: blinker flips, block stays, glider keeps 5 cells across the torus seam': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const R = __rh, life = R.parseRule('B3/S23'), w = 10, h = 10; let a = new Uint8Array(w * h), b = new Uint8Array(w * h);
        const set = (pts, ox, oy) => { a.fill(0); for (const [x, y] of pts) a[((oy + y) % h) * w + (ox + x) % w] = 1; };
        const on = () => [...a].map((v, i) => v ? i : -1).filter(i => i >= 0);
        set([[0, 0], [1, 0], [2, 0]], 3, 3); R.stepGrid(a, b, w, h, life); [a, b] = [b, a]; const bl = on();
        set([[0, 0], [1, 0], [0, 1], [1, 1]], 9, 9); R.stepGrid(a, b, w, h, life); [a, b] = [b, a]; const blk = on();
        set([[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]], 7, 7); const pops = []; for (let g = 0; g < 40; g++) { R.stepGrid(a, b, w, h, life); [a, b] = [b, a]; pops.push(on().length); }
        return { bl, blk, pops: [...new Set(pops)] }; });
      eq(r.bl, [24, 34, 44]); eq(r.blk, [0, 9, 90, 99]); eq(r.pops, [5]);
    },
    'components: separate objects, diagonal touch is one object, wrap-around object is unwrapped': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const R = __rh, w = 20, h = 20, g = new Uint8Array(w * h); const s = (x, y) => g[y * w + x] = 1;
        s(1, 1); s(2, 2); s(10, 10); s(11, 10); s(19, 5); s(0, 5);
        const objs = R.components(g, w, h); const wrapped = objs.find(o => o.length === 2 && o.some(c => c[0] === 19)); const u = R.unwrap(wrapped, w, h);
        return { n: objs.length, sizes: objs.map(o => o.length).sort(), uw: Math.max(...u.map(c => c[0])) - Math.min(...u.map(c => c[0])) }; });
      eq(r.n, 3); eq(r.sizes, [2, 2, 2]); eq(r.uw, 1);
    },
    'classifier on known Life objects (still, oscillators, ships, gun) with correct period and speed': async ({ page, eq }) => {
      const r = await page.evaluate((PAT) => { const R = __rh, life = R.parseRule('B3/S23'), out = {};
        for (const [k, pts] of Object.entries(PAT)) { R.setBudget(3); const x = R.analyzeObject(pts, life); out[k] = x && [x.type, x.p || 0, x.type in { ship: 1, diag: 1, knight: 1 } ? R.speedStr(x) : '']; }
        return out; }, PAT);
      eq(r.block, ['still', 1, '']); eq(r.beehive, ['still', 1, '']); eq(r.blinker, ['osc', 2, '']); eq(r.toad, ['osc', 2, '']); eq(r.pulsar, ['osc', 3, '']);
      eq(r.glider, ['diag', 4, 'c/4']); eq(r.lwss, ['ship', 4, 'c/2']);
      eq(r.gun[0], 'grower', 'Gosper gun grows forever (linear growth)'); eq(r.acorn[0], 'unknown', 'acorn is a methuselah, not a grower');
    },
    'species ids are orientation-independent (rotated/reflected glider and blinker map to one id)': async ({ page, eq }) => {
      const r = await page.evaluate((PAT) => { const R = __rh, life = R.parseRule('B3/S23'); const ids = new Set(), bl = new Set();
        for (let t = 0; t < 8; t++) { const tr = (pts) => pts.map(([x, y]) => { let a = x, b = y; if (t & 1) a = -a; if (t & 2) b = -b; if (t & 4) [a, b] = [b, a]; return [a + 10, b + 10]; });
          ids.add(R.analyzeObject(tr(PAT.glider), life).id); bl.add(R.analyzeObject(tr(PAT.blinker), life).id); }
        return [ids.size, bl.size]; }, PAT);
      eq(r, [1, 1]);
    },
    'speedStr formats speeds; names are deterministic per id': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const R = __rh; return [R.speedStr({ type: 'ship', dx: 2, dy: 0, p: 4 }), R.speedStr({ type: 'ship', dx: 2, dy: 0, p: 5 }), R.speedStr({ type: 'diag', dx: 1, dy: 1, p: 4 }), R.speedStr({ type: 'ship', dx: 1, dy: 0, p: 1 }), R.speedStr({ type: 'knight', dx: 2, dy: 1, p: 6 }), R.speedStr({ type: 'osc', dx: 0, dy: 0, p: 3 }), R.nameFor('x|1', 'ship') === R.nameFor('x|1', 'ship'), R.nameFor('x|1', 'ship').startsWith('Velox')]; });
      eq(r.slice(0, 6), ['c/2', '2c/5', 'c/4', 'c', '(2,1)c/6', '']); ok(r[6] && r[7]);
    },
    'scan: catalogs each new species once, counts known ones, claims bounties, updates progress': async ({ page, eq, ok }) => {
      await dismiss(page);
      const r = await page.evaluate((PAT) => { const R = __rh; R.setRule(R.parseRule('B3/S23')); R.grid.fill(0);
        for (const [x, y] of PAT.glider) R.grid[(20 + y) * R.W + 20 + x] = 1; for (const [x, y] of PAT.block) R.grid[(100 + y) * R.W + 100 + x] = 1; for (const [x, y] of PAT.block) R.grid[(60 + y) * R.W + 120 + x] = 1;
        const n1 = R.scan(); const n2 = R.scan(); const S = R.S;
        return { n1, n2, types: Object.values(S.species).map(s => s.type).sort(), scans: S.scans, bounties: Object.keys(S.bounties).length, prog: JSON.parse(localStorage.getItem('rh:hub'))['rule-hunter'], claimed: R.claimed(), total: R.BOUNTIES.length,
          guide: document.querySelectorAll('#guide .card').length, names: Object.values(S.species).map(s => s.name).sort(), log: document.getElementById('log').textContent }; }, PAT);
      eq(r.n1, 2); eq(r.n2, 0); eq(r.types, ['diag', 'still']); eq(r.scans, 2); ok(r.bounties >= 3); eq(r.prog, r.claimed / r.total); eq(r.guide, 2); ok(/3 already catalogued/.test(r.log), r.log); eq(r.names, ['Block', 'Glider'], 'the famous Life objects keep their real names');
    },
    'no bounties are claimed on a fresh start; stale bounty ids never push progress past 100%': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const R = __rh; const a = R.claimed(); R.checkBounties(); const b = R.claimed();
        for (let i = 0; i < 500; i++) R.S.bounties['old:' + i] = 1; R.setRule(R.S.rule); R.renderBounties();
        return { a, b, c: R.claimed(), prog: JSON.parse(localStorage.getItem('rh:hub'))['rule-hunter'], txt: [...document.querySelectorAll('#p-bounty .small.dim')].map(e=>e.textContent).find(t=>/prizes claimed/.test(t)), top: document.getElementById('totals').textContent }; });
      eq([r.a, r.b, r.c], [0, 0, 0]); eq(r.prog, 0); ok(r.txt.startsWith('0 /'), r.txt);
    },
    'classifyRule: Life is complex, a birth-only-at-8 rule dies': async ({ page, eq }) => {
      eq(await page.evaluate(() => { const R = __rh; R.setRule(R.parseRule('B3/S23')); const a = R.classifyRule(); R.setRule(R.parseRule('B8/S')); return [a, R.classifyRule()]; }), ['complex', 'dies']);
    },
    'UI: rule box accepts valid text and rejects junk; B0 button disabled; bit buttons toggle': async ({ page, eq }) => {
      await dismiss(page); await page.click('#ruleChip'); await page.waitForTimeout(300);
      await page.fill('#ruleStr', 'B36/S23'); await page.press('#ruleStr', 'Enter'); eq(await page.evaluate(() => __rh.ruleStr(__rh.S.rule)), 'B36/S23');
      await page.fill('#ruleStr', 'garbage'); await page.press('#ruleStr', 'Enter'); eq(await page.evaluate(() => __rh.ruleStr(__rh.S.rule)), 'B36/S23');
      eq(await page.isDisabled('#bits button[data-k="b"][data-i="0"]'), true);
      await page.click('#bits button[data-k="s"][data-i="8"]'); eq(await page.evaluate(() => __rh.ruleStr(__rh.S.rule)), 'B36/S238');
    },
    'bounty tips: clicking a suggested rule switches to it': async ({ page, eq }) => {
      await dismiss(page);
      await page.click('#moreBtn'); await page.click('.tabs button[data-t="bounty"]'); await page.waitForTimeout(300); await page.click('#p-bounty a[data-r="B34/S34"] >> nth=0');
      eq(await page.evaluate(() => __rh.ruleStr(__rh.S.rule)), 'B34/S34');
    },
    'rule map click jumps to that rule (never B0)': async ({ page, ok }) => {
      await dismiss(page);
      await page.click('#moreBtn'); await page.click('.tabs button[data-t="map"]'); await page.waitForTimeout(300); const box = await page.locator('#mapCv').boundingBox();
      await page.mouse.click(box.x + 2, box.y + box.height / 2);
      ok(await page.evaluate(() => (__rh.S.rule.b & 1) === 0));
    },
    'corrupted saves load cleanly': async ({ page, eq }) => {
      for (const raw of ['null', '7', '[]', '{"rule":"x","species":[],"rules":null,"bounties":5,"scans":"many"}', '{"rule":{"b":9,"s":12},"species":{"a":{"type":"ship"},"b":null}}']) {
        await page.evaluate((raw) => localStorage.setItem('rh:rh', raw), raw); const p2 = await reopen(page);
        const st = await p2.evaluate(() => ({ b: __rh.S.rule.b, n: Object.keys(__rh.S.species).length, sc: __rh.S.scans }));
        eq(p2.errs, [], raw); eq(st.b % 2, 0); eq(st.n, 0); eq(Number.isFinite(st.sc), true);
        await p2.evaluate(() => document.querySelector('#guide') && 1); await p2.close();
      }
    },
    'save/load round-trip of species and rule': async ({ page, eq }) => {
      await dismiss(page);
      await page.evaluate((PAT) => { const R = __rh; R.setRule(R.parseRule('B3/S23')); R.place(PAT.glider); R.scan(); R.setRule(R.parseRule('B36/S23')); }, PAT);
      const p2 = await reopen(page); eq(await p2.evaluate(() => [__rh.ruleStr(__rh.S.rule), Object.keys(__rh.S.species).length]), ['B36/S23', 1]); await p2.close();
    },
    'click a colony in the dish: it is examined alone and catalogued once (lens)': async ({ page, eq, ok }) => {
      await dismiss(page);
      await page.evaluate((PAT) => { const R = __rh; R.setRule(R.parseRule('B3/S23')); R.place(PAT.glider, 40, 40); }, PAT);
      await page.evaluate(() => __rh.setView(42, 42, 10)); const pt = await page.evaluate(() => __rh.cellToClient(41, 41));
      await page.mouse.click(...pt);
      const a = await page.evaluate(() => [Object.values(__rh.S.species).map(s => s.type), document.getElementById('log').textContent, __rh.S.scans]);
      eq(a[0], ['diag']); ok(/New diagonal ship/.test(a[1]), a[1]); eq(a[2], 0, 'examining is not a scan');
      await page.mouse.click(...pt); ok(/Already in the field guide/.test(await page.textContent('#log')));
      await page.evaluate(() => __rh.examineAt(120, 120)); ok(/Nothing under the lens/.test(await page.textContent('#log')));
    },
    'the assistant (auto-hunt) is locked until 10 hand scans': async ({ page, eq }) => {
      await dismiss(page);
      await page.click('#ruleChip'); await page.waitForTimeout(300); await page.click('#p-rule summary'); eq(await page.isDisabled('#autoBtn'), true); await page.click('#autoBtn', { force: true }); eq(await page.evaluate(() => __rh.auto), false);
      await page.evaluate(() => { for (let i = 0; i < 10; i++) __rh.scan(true); });
      eq(await page.isDisabled('#autoBtn'), false); await page.click('#autoBtn'); eq(await page.evaluate(() => __rh.auto), true);
    },
    'landscape phone: dish fills the screen; the journal is one sheet; the dock makes soups and scans': async ({ page, eq, ok }) => {
      await dismiss(page); await noBet(page); await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(300);
      const open = () => page.evaluate(() => { const r = document.getElementById('sheet').getBoundingClientRect(); return r.left < innerWidth - 5 && getComputedStyle(document.getElementById('sheet')).visibility === 'visible'; });
      const w = await page.evaluate(() => { const r = document.getElementById('world').getBoundingClientRect(); return r.width * r.height / (innerWidth * innerHeight); });
      ok(w > .8, 'dish fills the screen: ' + w); eq(await open(), false);
      await page.click('#moreBtn'); await page.waitForTimeout(350); eq(await open(), true);
      await page.mouse.click(30, 330); await page.waitForTimeout(350); eq(await open(), false, 'tapping the dish closes the journal');
      await page.click('#ruleChip'); await page.waitForTimeout(350); eq(await open(), true); ok(await page.isVisible('#bits'), 'rule chip opens the switches');
      await page.click('#sheetX'); await page.waitForTimeout(350);
      const s0 = await page.evaluate(() => __rh.S.scans); await page.click('#scanBtn'); eq(await page.evaluate(() => __rh.S.scans), s0 + 1);
      await page.evaluate(() => { __rh.tick(30); }); await page.click('#soupBtn'); eq(await page.evaluate(() => __rh.gen), 0);
    },
    'the famous Life objects carry their real names, found in any rule': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => ({ names: Object.values(__rh.CLASSIC).sort(), id: Object.keys(__rh.CLASSIC).find(k => __rh.CLASSIC[k] === 'Glider') }));
      eq(r.names.length, 16, r.names.join(', ')); for (const n of ['Block', 'Beehive', 'Blinker', 'Toad', 'Beacon', 'Pulsar', 'Pentadecathlon', 'Glider', 'Lightweight spaceship', 'Heavyweight spaceship']) ok(r.names.includes(n), n);
      ok(/^diag\|4\|1\|1\|/.test(r.id), 'the glider is a c/4 diagonal ship: ' + r.id);
    },
    'the first bet is on an unfamiliar rule, and shows its λ': async ({ page, ok, eq }) => {
      eq(await page.evaluate(() => __rh.mode), 'law', 'a new player starts on a law'); await page.evaluate(() => __rh.setMode('dish')); await page.waitForTimeout(200);
      ok(await page.isVisible('.modal'), 'the dish introduces itself on the first visit'); ok(/B368\/S245/.test(await page.textContent('.modal')), 'the intro names the rule'); await page.click('.modal button'); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ rule: __rh.ruleStr(__rh.S.rule), pending: !!__rh.pending, txt: document.getElementById('predict').textContent }));
      ok(r.rule !== 'B3/S23', 'not Life: ' + r.rule); ok(r.pending, 'a bet is waiting'); ok(/λ 0\.\d\d: \d+ of 17 switches/.test(r.txt), r.txt);
    },
    'next door: four neighbouring rules, one switch away each, with live thumbnails; picking one goes there': async ({ page, eq, ok }) => {
      await dismiss(page); await noBet(page); await page.click('#ruleChip'); await page.waitForTimeout(300);
      const a = await page.evaluate(() => { const R = __rh, r0 = R.S.rule; const flips = R.NB.map(x => { let d = 0; for (const k of ['b', 's']) { let v = x.r[k] ^ r0[k]; while (v) { d += v & 1; v >>= 1; } } return d; });
        const px = (c) => { const d = c.getImageData(0, 0, 80, 80).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i]) | 0; return h; }; return { n: R.NB.length, flips, h0: R.NB.map(x => px(x.c)), lams: [...document.querySelectorAll('#nbrs button')].map(b => /λ 0\.\d\d/.test(b.textContent)) }; });
      eq(a.n, 4); eq(a.flips, [1, 1, 1, 1]); eq(a.lams, [true, true, true, true]);
      await page.waitForTimeout(700); const h1 = await page.evaluate(() => { const px = (c) => { const d = c.getImageData(0, 0, 80, 80).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i]) | 0; return h; }; return __rh.NB.map(x => px(x.c)); });
      ok(h1.some((h, i) => h !== a.h0[i]), 'the thumbnails are running');
      const want = await page.evaluate(() => __rh.ruleStr(__rh.NB[2].r)); await page.click('#nbrs button[data-j="2"]'); eq(await page.evaluate(() => __rh.ruleStr(__rh.S.rule)), want);
      const b0 = await page.evaluate(() => __rh.NB.map(x => __rh.ruleStr(x.r)).join()); await page.click('#ruleChip'); await page.click('#nbrMore'); ok(await page.evaluate((b0) => __rh.NB.map(x => __rh.ruleStr(x.r)).join() !== b0, b0), 'other neighbours');
      await page.click('#ruleChip'); await page.waitForTimeout(300); ok(await page.evaluate(() => document.body.classList.contains('sheet')), 'the rule chip only ever opens the sheet');
    },
    'toasts come one at a time; breeding gets its own button after a few scans': async ({ page, eq, ok }) => {
      await dismiss(page); await noBet(page);
      ok(!(await page.isVisible('#breedBtn')), 'no breed button on a fresh save');
      const n = await page.evaluate(() => { __rh.toast('one'); __rh.toast('two'); __rh.toast('three'); return document.querySelectorAll('.toast').length; }); eq(n, 1);
      await page.evaluate(() => { for (let i = 0; i < 3; i++) __rh.scan(true); });
      ok(await page.isVisible('#breedBtn'), 'the breed button'); await page.click('#breedBtn'); await page.waitForTimeout(300); ok(await page.isVisible('#p-lab .shelf'), 'opens the breeding shelf');
      eq(await page.evaluate(() => [...document.querySelectorAll('.tabs button[data-t]')].map(b => b.dataset.t).slice(0, 2)), ['rule', 'lab']);
    },
    'species are patterns, not pattern-per-rule: a glider found in two rules is one species living in both': async ({ page, eq }) => {
      await dismiss(page);
      const r = await page.evaluate((PAT) => { const R = __rh; R.S.noPredict = 1; for (const rs of ['B3/S23', 'B36/S23']) { R.setRule(R.parseRule(rs)); R.place(PAT.glider, 40, 40); R.examineAt(41, 41); }
        const sp = Object.values(R.S.species); return { n: sp.length, rules: sp[0].rules, log: document.getElementById('log').textContent }; }, PAT);
      eq(r.n, 1); eq(r.rules, ['B3/S23', 'B36/S23']); eq(/also lives in this rule/.test(r.log), true);
    },
    'old saves with per-rule species are merged on load': async ({ page, eq }) => {
      const old = { rule: { b: 8, s: 12 }, species: {}, rules: {}, bounties: {}, scans: 3 };
      const g = { type: 'diag', p: 4, dx: 1, dy: 1, cells: 5, phases: ['1,0;2,1;0,2;1,2;2,2'], name: 'x', t: 1 };
      old.species['B3/S23|0,0;1,0'] = { ...g, rule: 'B3/S23' }; old.species['B36/S23|0,0;1,0'] = { ...g, rule: 'B36/S23' }; old.species['B3/S23|0,0;0,1'] = { ...g, type: 'still', p: 1, dx: 0, dy: 0, rule: 'B3/S23' };
      await page.evaluate((o) => localStorage.setItem('rh:rh', JSON.stringify(o)), old); const p2 = await reopen(page);
      eq(await p2.evaluate(() => Object.values(__rh.S.species).map(s => [s.type, s.rules.length]).sort()), [['diag', 2], ['still', 1]]); eq(p2.errs, []); await p2.close();
    },
    'predict, then run: an uncharted rule waits for a bet, scores it, and earns a field note': async ({ page, eq, ok }) => {
      await dismiss(page);
      await page.evaluate(() => { const R = __rh; R.setRule(R.parseRule('B1/S1')); R.soup(); });
      ok(await page.isVisible('#predict'), 'prediction card shown'); eq(await page.evaluate(() => __rh.running), false, 'soup waits for the bet');
      await page.click('#predict [data-p="explodes"]');
      const r = await page.evaluate(() => ({ pred: __rh.S.pred, beh: __rh.S.rules[__rh.parseRule('B1/S1').b + ':' + __rh.parseRule('B1/S1').s].beh, note: !!__rh.S.notes.B1, run: __rh.running, txt: document.getElementById('predict').textContent }));
      const hit = r.beh === 'explodes' ? 1 : 0; eq([r.pred.n, r.pred.right, r.pred.streak], [1, hit, hit]); ok(r.note); ok(r.run); ok(/B1 rules almost always explode/.test(r.txt), r.txt);
      await page.evaluate(() => { const R = __rh; R.setRule(R.parseRule('B3/S')); R.soup(); }); await page.click('#predict [data-p="explodes"]');
      eq(await page.evaluate(() => [__rh.S.pred.n, __rh.S.pred.streak, !!__rh.S.notes.noS]), [2, 0, true]);
      await page.evaluate(() => __rh.soup()); eq(await page.isVisible('#predict [data-p]'), false, 'charted rules are not asked again');
    },
    'draw mode: draw a glider by clicking cells, test it, and earn the design prize': async ({ page, eq, ok }) => {
      await dismiss(page); await page.evaluate(() => { __rh.S.noPredict = 1; __rh.setRule(__rh.parseRule('B3/S23')); });
      await page.click('#ruleChip'); await page.waitForTimeout(300); await page.click('#drawBtn'); await page.evaluate(() => __rh.setView(62, 62, 12));
      const pts = await page.evaluate((PAT) => PAT.glider.map(([x, y]) => __rh.cellToClient(60 + x, 60 + y)), PAT);
      for (const p of pts) await page.mouse.click(...p);
      eq(await page.evaluate(() => __rh.grid.reduce((a, b) => a + b, 0)), 5);
      await page.click('#testDrawBtn');
      const r = await page.evaluate(() => ({ sp: Object.values(__rh.S.species).map(s => [s.type, !!s.drawn]), prize: Object.keys(__rh.S.bounties).some(k => /6 cells or fewer/.test(k)) }));
      eq(r.sp, [['diag', true]]); ok(r.prize, 'design prize');
    },
    'rule map compass: clicking a neighbour flips exactly that switch': async ({ page, eq }) => {
      await dismiss(page); await page.evaluate(() => { __rh.S.noPredict = 1; __rh.setRule(__rh.parseRule('B3/S23')); });
      await page.click('#moreBtn'); await page.click('.tabs button[data-t="map"]'); await page.waitForTimeout(300); const box = await page.locator('#mapCv').boundingBox();
      // S row, switch 8: last cell of the second row
      await page.mouse.click(box.x + box.width * (8.5 / 9.5 + .02), box.y + box.height * ((24 + 320 / 9.5 + 18 + 15) / 330));
      eq(await page.evaluate(() => __rh.ruleStr(__rh.S.rule)), 'B3/S238');
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      await dismiss(page);
      const r = await page.evaluate((PAT) => { const R = __rh; R.running = false; const late = R.BOUNTIES.filter(b => b.tier >= 4 && !/^Find a rule that/.test(b.text));
        const lateGot = () => late.filter(b => b.test()).length / late.length;
        const reset = () => { for (const k of Object.keys(R.S.species)) delete R.S.species[k]; for (const k of Object.keys(R.S.rules)) delete R.S.rules[k]; R.S.pred = { n: 0, right: 0, streak: 0, best: 0 }; R.S.notes = {}; };
        let seed = 5; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 16) / 32768; };
        const out = {};
        // random bot: random rules, a soup each, scan; never predicts
        const runs = []; for (let k = 0; k < 3; k++) { reset(); R.S.noPredict = 1; for (let i = 0; i < 10; i++) { let b = 0, s = 0; for (let j = 1; j < 9; j++) if (rnd() < .3) b |= 1 << j; for (let j = 0; j < 9; j++) if (rnd() < .35) s |= 1 << j; if (!b) b = 8; R.setRule({ b, s }); R.soup(); R.tick(260); R.scan(true); } runs.push(lateGot()); }
        out.random = runs;
        // idle bot: Life forever
        reset(); R.setRule(R.parseRule('B3/S23')); for (let i = 0; i < 10; i++) { R.soup(); R.tick(260); R.scan(true); } out.idle = lateGot();
        // competent: knows the field notes, predicts, and designs on purpose
        reset(); R.S.noPredict = 0; let right = 0;
        for (const rs of ['B1/S1', 'B12/S0', 'B3/S', 'B4/S4', 'B2/S', 'B1/S0123']) { R.setRule(R.parseRule(rs)); R.soup(); const r = R.parseRule(rs); const g = (r.b >> 1) & 1 ? 'explodes' : (r.b >> 2) & 1 ? 'explodes' : !((r.s >> 2) & 1) && !((r.s >> 3) & 1) ? 'dies' : 'complex'; const res = R.predict(g); if (res && res.right) right++; }
        R.S.noPredict = 1;
        for (const rs of ['B3/S23', 'B36/S23', 'B38/S23']) { R.setRule(R.parseRule(rs)); R.setDrawing(true); for (const [x, y] of PAT.glider) R.grid[(60 + y) * R.W + 60 + x] = 1; R.testDrawing(); }
        out.competent = lateGot(); out.right = right; out.design = R.BOUNTIES.filter(b => /6 cells or fewer|ship in 3 different/.test(b.text)).every(b => b.test());
        out.master = R.BOUNTIES.find(b => /^Master/.test(b.text)).test();
        return out; }, PAT);
      ok(r.random.filter(x => x > .2).length === 0, 'random bot late-prize rates ' + r.random); ok(r.idle <= .2, 'idle ' + r.idle);
      ok(r.design && r.competent > Math.max(...r.random), 'competent policy beats naive: ' + r.competent); ok(r.right >= 4, 'note-based predictions ' + r.right); ok(!r.master, 'master prize needs more than the simple policy');
    },
    'touch (phone): big cells, one-finger pan, pinch zoom, tap examines, drag-paint in draw mode': async ({ page, ok, eq, near }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.goto(page.url()); await page.waitForTimeout(600); await dismiss(page); await noBet(page);
      const cdp = await touchSession(page);
      const v = await page.evaluate(() => ({ k: __rh.cam.k, sw: document.scrollingElement.scrollHeight, h: innerHeight, dock: !!document.getElementById('scanBtn').getBoundingClientRect().width }));
      ok(v.k >= 8 && v.k <= 14, 'cells are 8-14 CSS px on a phone: ' + v.k); ok(v.sw <= v.h + 1, 'no page scroll'); ok(v.dock);
      const c = await page.evaluate(() => { const r = document.getElementById('world').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      const vx0 = await page.evaluate(() => __rh.view.vx); await touchDrag(cdp, [c[0] + 60, c[1]], [c[0] - 60, c[1]], 8);
      near(await page.evaluate(() => __rh.view.vx) - vx0, 120 / v.k, 1.5, 'one finger pans the dish');
      await touchPinch(cdp, c, 40, 80); const k2 = await page.evaluate(() => __rh.cam.k); ok(k2 > v.k * 1.6, 'pinch zooms in: ' + k2);
      await page.evaluate(() => { __rh.S.noPredict = 1; __rh.setRule(__rh.parseRule('B3/S23')); __rh.place([[0, 0], [1, 0], [0, 1], [1, 1]], 80, 80); __rh.setView(81, 81, 12); });
      const t = await page.evaluate(() => __rh.cellToClient(80, 80));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t[0], y: t[1], id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(100);
      eq(await page.evaluate(() => Object.values(__rh.S.species).map(s => s.type)), ['still'], 'a tap examines the colony');
      await page.evaluate(() => { __rh.setDrawing(true); __rh.setView(73, 80, 12); });
      const pts = await page.evaluate(() => [__rh.cellToClient(70, 80), __rh.cellToClient(76, 80)]);
      await touchDrag(cdp, pts[0], pts[1], 12); eq(await page.evaluate(() => { let n = 0; for (let x = 70; x <= 76; x++) n += __rh.grid[80 * __rh.W + x]; return n; }), 7);
    },
    'view: pan wraps around the torus, wheel zooms about the cursor, fit frames the colonies': async ({ page, ok, near, eq }) => {
      await dismiss(page);
      const r = await page.evaluate(() => { const R = __rh; R.setView(5, 5, 10); const a = R.dishToCell(...(() => { const p = R.cellToClient(158, 3); const q = document.getElementById('world').getBoundingClientRect(); return [p[0] - q.left, p[1] - q.top]; })());
        R.cam.panBy(-1000 * 10, 0); const vx = R.view.vx; R.grid.fill(0); for (const [x, y] of [[150, 10], [151, 10], [152, 10], [5, 10]]) R.grid[y * R.W + x] = 1; R.fitColonies();
        return { a, vx, fit: [R.view.vx, R.view.vy, R.cam.k] }; });
      eq(r.a, [158, 3], 'the cell across the seam is reachable'); ok(r.vx >= 0 && r.vx < 160, 'centre stays on the torus: ' + r.vx);
      ok(r.fit[0] > 150 || r.fit[0] < 6, 'fit frames across the seam: ' + r.fit[0]); near(r.fit[1], 10.5, 1.5);
      const box = await page.locator('#world').boundingBox(); await page.mouse.move(box.x + 100, box.y + 100);
      const before = await page.evaluate(() => { const q = document.getElementById('world').getBoundingClientRect(); return __rh.cam.toWorld(q.left + 100, q.top + 100); });
      await page.mouse.wheel(0, -300); await page.waitForTimeout(80);
      const after = await page.evaluate(() => { const q = document.getElementById('world').getBoundingClientRect(); return __rh.cam.toWorld(q.left + 100, q.top + 100); });
      near(after[0], before[0], .05); near(after[1], before[1], .05);
      await page.click('.pz-fit'); await page.waitForTimeout(400); ok(await page.evaluate(() => __rh.cam.k > 0));
    },
    'UI: the default screen shows a handful of controls; everything else is one tap away in the journal': async ({ page, ok }) => {
      await dismiss(page); for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) { await page.setViewportSize(vp); await page.waitForTimeout(300);
        const n = await page.evaluate(() => [...document.querySelectorAll('button, input, a, select, summary')].filter(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if (!r.width || !r.height || cs.visibility === 'hidden') return false; const x = r.left + r.width / 2, y = r.top + r.height / 2; return x > 0 && x < innerWidth && y > 0 && y < innerHeight && !e.closest('#predict'); }).length);
        ok(n <= 11, `${vp.width}px: ${n} visible controls`); }
    },
    'performance: 60fps on a phone screen, with the frame work fitting the budget on a 4x slower CPU': async ({ page, ok }) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await page.waitForTimeout(300); await dismiss(page);
      await page.evaluate(() => { const R = __rh; R.S.noPredict = 1; R.setRule(R.parseRule('B3678/S34678')); R.soup(); R.running = true; });
      await page.waitForTimeout(2200); const fps = await page.evaluate(() => __rh.fps(2000));
      // a phone CPU is roughly 4x slower than this one: everything the page does per frame (step, paint, composite onto the canvas) must fit in 16.7ms
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const ms = await page.evaluate(() => { const R = __rh, cx = document.getElementById('world').getContext('2d'); R.running = false; const t = performance.now(); for (let i = 0; i < 30; i++) { R.tick(4); R.refreshImage(); R.render(); cx.getImageData(0, 0, 1, 1); } return (performance.now() - t) / 30; });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      ok(fps >= 50, 'frames per second on a 390x844 @2x screen with a busy soup (headless, software compositing): ' + fps.toFixed(1)); ok(ms < 14, 'work per frame on a 4x slower CPU: ' + ms.toFixed(1) + 'ms of the 16.7ms budget');
    },
    'breeding: crossing rules is deterministic (same child, name and behaviour) and every daily commission has a known recipe': async ({ page, eq, ok }) => {
      await dismiss(page);
      const a = await page.evaluate(() => { const R = __rh; R.running = false; const r = R.breed('B3/S23', 'B3678/S34678', 'cross'); return [r.card.n, r.card.r, r.beh, r.first]; });
      const p2 = await reopen(page); const b = await p2.evaluate(() => { const R = __rh; R.running = false; const r = R.breed('B3/S23', 'B3678/S34678', 'cross'); return [r.card.n, r.card.r, r.beh, r.first]; }); await p2.close();
      eq(a.slice(0, 3), b.slice(0, 3)); eq(a[1], 'B3/S34678'); ok(a[3] && !b[3], 'first found by you, once');
      const RECIPES = [[['B3/S23', 'B3678/S34678', 'cross']], [['B3678/S34678', 'B3/S23', 'cross']], [['B3/S23', 'B3678/S34678', 'cross']], [['B3/S23', 'B1357/S1357', 'cross']], [['B3/S23', 'B1357/S1357', 'cross']], [['B3/S23', 'B2/S', 'cross']]];
      const goals = await page.evaluate((RECIPES) => { const R = __rh; return R.GOALS.map((g, i) => { for (const [x, y, op] of RECIPES[i]) R.breed(x, y, op); return g.t(); }); }, RECIPES);
      eq(goals, [true, true, true, true, true, true]);
    },
    'breeding by real clicks: pick two cards, the child joins the shelf; a childless (no-birth) mix is refused': async ({ page, eq, ok }) => {
      await dismiss(page); await page.click('#moreBtn'); await page.click('.tabs button[data-t="lab"]'); await page.waitForTimeout(300);
      await page.click('#p-lab [data-r="B3/S23"]'); await page.click('#p-lab [data-r="B2/S"]');
      ok(await page.evaluate(() => __rh.shelf().some(x => x.r === 'B3/S')));
      await page.click('#p-lab [data-op="overlap"]'); await page.click('#p-lab [data-r="B2/S"]'); await page.click('#p-lab [data-r="B3/S12345"]');
      eq(await page.evaluate(() => __rh.shelf().length), 7, 'B2∩B3 has no births: refused');
    },
    'difficulty: naive play fails (breeding)': async ({ page, ok }) => {
      await dismiss(page);
      const r = await page.evaluate(() => { const R = __rh; R.running = false; let seed = 7; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 16) % n; };
        const reset = () => { for (const k of Object.keys(R.S.species)) delete R.S.species[k]; for (const k of Object.keys(R.S.rules)) delete R.S.rules[k]; R.S.shelf.length = 0; };
        const score = () => Object.values(R.S.species).filter(s => s.rules.some(rr => R.S.shelf.some(x => x.r === rr))).length + 3 * R.S.shelf.filter(x => R.S.rules[R.parseRule(x.r).b + ':' + R.parseRule(x.r).s]?.beh === 'complex').length;
        reset(); const ops = ['cross', 'merge', 'overlap']; for (let k = 0; k < 8; k++) { const sh = R.shelf(); R.breed(sh[rnd(sh.length)].r, sh[rnd(sh.length)].r, ops[rnd(3)]); } const naive = score();
        // competent: keep Life's survival (S23) and borrow births from others; then cross the complex children back with Life
        reset(); for (const x of ['B36/S23', 'B3678/S34678', 'B3/S12345', 'B1357/S1357', 'B2/S']) R.breed(x, 'B3/S23', 'cross');
        for (const x of ['B3678/S34678', 'B3/S12345', 'B1357/S1357']) R.breed('B3/S23', x, 'cross'); const comp = score();
        return { naive, comp }; });
      ok(r.comp > r.naive * 1.5, `competent ${r.comp} vs naive ${r.naive}`);
    },
    'phone layout: no horizontal scroll and the dish is visible': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
      const r = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, w: document.getElementById('world').getBoundingClientRect() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.w.width >= 300, JSON.stringify(r.w));
    },
  },
};
