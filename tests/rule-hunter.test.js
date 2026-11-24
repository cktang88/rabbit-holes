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
const dismiss = (page) => page.evaluate(() => { document.querySelectorAll('.modal-bg').forEach(m => m.remove()); __rh.running = false; });

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
          guide: document.querySelectorAll('#guide .card').length, log: document.getElementById('log').textContent }; }, PAT);
      eq(r.n1, 2); eq(r.n2, 0); eq(r.types, ['diag', 'still']); eq(r.scans, 2); ok(r.bounties >= 3); eq(r.prog, r.claimed / r.total); eq(r.guide, 2); ok(/2 already known/.test(r.log), r.log);
    },
    'no bounties are claimed on a fresh start; stale bounty ids never push progress past 100%': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const R = __rh; const a = R.claimed(); R.checkBounties(); const b = R.claimed();
        for (let i = 0; i < 500; i++) R.S.bounties['old:' + i] = 1; R.setRule(R.S.rule); R.renderBounties();
        return { a, b, c: R.claimed(), prog: JSON.parse(localStorage.getItem('rh:hub'))['rule-hunter'], txt: document.querySelector('#p-bounty .small').textContent, top: document.getElementById('totals').textContent }; });
      eq([r.a, r.b, r.c], [0, 0, 0]); eq(r.prog, 0); ok(r.txt.startsWith('0 /'), r.txt);
    },
    'classifyRule: Life is complex, a birth-only-at-8 rule dies': async ({ page, eq }) => {
      eq(await page.evaluate(() => { const R = __rh; R.setRule(R.parseRule('B3/S23')); const a = R.classifyRule(); R.setRule(R.parseRule('B8/S')); return [a, R.classifyRule()]; }), ['complex', 'dies']);
    },
    'UI: rule box accepts valid text and rejects junk; B0 button disabled; bit buttons toggle': async ({ page, eq }) => {
      await dismiss(page);
      await page.fill('#ruleStr', 'B36/S23'); await page.press('#ruleStr', 'Enter'); eq(await page.evaluate(() => __rh.ruleStr(__rh.S.rule)), 'B36/S23');
      await page.fill('#ruleStr', 'garbage'); await page.press('#ruleStr', 'Enter'); eq(await page.evaluate(() => __rh.ruleStr(__rh.S.rule)), 'B36/S23');
      eq(await page.isDisabled('#bits button[data-k="b"][data-i="0"]'), true);
      await page.click('#bits button[data-k="s"][data-i="8"]'); eq(await page.evaluate(() => __rh.ruleStr(__rh.S.rule)), 'B36/S238');
    },
    'bounty tips: clicking a suggested rule switches to it': async ({ page, eq }) => {
      await dismiss(page);
      await page.click('.tabs button[data-t="bounty"]'); await page.click('#p-bounty a[data-r="B34/S34"] >> nth=0');
      eq(await page.evaluate(() => __rh.ruleStr(__rh.S.rule)), 'B34/S34');
    },
    'rule map click jumps to that rule (never B0)': async ({ page, ok }) => {
      await dismiss(page);
      await page.click('.tabs button[data-t="map"]'); const box = await page.locator('#mapCv').boundingBox();
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
      const pt = await page.evaluate(() => { const r = document.getElementById('world').getBoundingClientRect(), d = __rh.dish, sc = d.sq / __rh.W; return [r.left + d.x0 + 41.5 * sc, r.top + d.y0 + 41.5 * sc]; });
      await page.mouse.click(...pt);
      const a = await page.evaluate(() => [Object.values(__rh.S.species).map(s => s.type), document.getElementById('log').textContent, __rh.S.scans]);
      eq(a[0], ['diag']); ok(/New diagonal ship/.test(a[1]), a[1]); eq(a[2], 0, 'examining is not a scan');
      await page.mouse.click(...pt); ok(/Already in the field guide/.test(await page.textContent('#log')));
      await page.evaluate(() => __rh.examineAt(120, 120)); ok(/Nothing under the lens/.test(await page.textContent('#log')));
    },
    'the assistant (auto-hunt) is locked until 10 hand scans': async ({ page, eq }) => {
      await dismiss(page);
      eq(await page.isDisabled('#autoBtn'), true); await page.click('#autoBtn', { force: true }); eq(await page.evaluate(() => __rh.auto), false);
      await page.evaluate(() => { for (let i = 0; i < 10; i++) __rh.scan(true); });
      eq(await page.isDisabled('#autoBtn'), false); await page.click('#autoBtn'); eq(await page.evaluate(() => __rh.auto), true);
    },
    'phone layout: no horizontal scroll and the dish is visible': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
      const r = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, w: document.getElementById('world').getBoundingClientRect() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.w.width >= 300, JSON.stringify(r.w));
    },
  },
};
