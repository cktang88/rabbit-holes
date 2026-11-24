// First Contact: decode a generated alien language. Logic via window.__fc.
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const withSave = async (page, save) => { await page.addInitScript(s => localStorage.setItem('rh:fc', s), typeof save === 'string' ? save : JSON.stringify(save)); await page.reload(); await page.waitForTimeout(500); };
// compose an answer by clicking palette glyphs in question k of the current chapter
async function compose(page, k, words) {
  const q = page.locator(`.q[data-q="${k}"]`);
  for (const w of words) await q.locator(`[data-pw="${w}"]`).click();
  await q.locator('[data-send]').click();
}
module.exports = {
  page: 'first-contact/index.html',
  tests: {
    'languages: 40 seeds give valid bases, unique glyphs, consistent anatomy': async ({ page, eq }) => {
      const bad = await page.evaluate(() => {
        const out = [];
        for (let seed = 1; seed <= 40; seed++) {
          const L = window.__fc.buildLanguage(seed * 7919);
          if (L.arms * L.fingers !== L.base) out.push('hand ' + seed);
          const keys = Object.keys(L.glyph), sig = keys.map(k => { const g = L.glyph[k]; return g ? (g.digit ? 'D' : 'W') + JSON.stringify(g.segs) + JSON.stringify(g.dot) : null; });
          if (sig.includes(null)) out.push('missing glyph ' + seed);
          if (new Set(sig).size !== sig.length) out.push('duplicate glyph ' + seed);
          if (!(L.home > L.oldHome && L.oldHome >= 1 && L.home <= L.planets)) out.push('planets ' + seed);
        }
        return out;
      });
      eq(bad, []);
    },
    'numbers: num() writes n in their base and digit order': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const { LANG, num } = window.__fc, b = LANG.base, bad = [];
        for (let n = 0; n < 400; n++) { let ds = num(n).map(d => +d.slice(1)); if (LANG.littleEndian) ds = ds.reverse(); const v = ds.reduce((a, d) => a * b + d, 0); if (v !== n || ds.some(d => d >= b) || (ds.length > 1 && ds[0] === 0)) bad.push(n); }
        return { bad, zero: num(0), one: num(b) };
      });
      eq(r.bad, []); eq(r.zero, ['D0']);
      eq([...r.one].sort(), ['D0', 'D1']);
    },
    'grammar: clause() follows the word order, negation, tense and question markers': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const { LANG, clause } = window.__fc, out = {};
        for (const o of ['SVO', 'SOV', 'VSO']) { LANG.order = o; out[o] = clause({ s: ['S'], v: 'V', o: ['O'] }); }
        LANG.order = 'SVO'; LANG.tenseFinal = true; out.past = clause({ s: ['S'], v: 'V', o: ['O'], neg: 1, past: 1, q: 1 });
        LANG.tenseFinal = false; out.past2 = clause({ s: ['S'], v: 'V', past: 1 });
        return out;
      });
      eq(r.SVO, ['S', 'V', 'O']); eq(r.SOV, ['S', 'O', 'V']); eq(r.VSO, ['V', 'S', 'O']);
      eq(r.past, ['Q', 'S', 'NOT', 'V', 'O', 'PAST']); eq(r.past2, ['PAST', 'S', 'V']);
    },
    'many seeds: every reply can be composed from glyphs already received; no quiz questions remain': async ({ page, eq }) => {
      const bad = [];
      for (let seed = 1; seed <= 8; seed++) {
        await withSave(page, { seed: seed * 104729, intro: 1 });
        bad.push(...await page.evaluate(() => {
          const fc = window.__fc, out = [];
          fc.CH.forEach((c, i) => { const seen = fc.seenUpTo(i); c.qs.forEach((q, k) => {
            if (q.type !== 'compose') out.push(`ch${i} q${k} is ${q.type}`);
            for (const a of [q.ans, ...(q.alt || [])]) for (const w of a) if (!seen.includes(w)) out.push(`ch${i} q${k} needs ${w}`);
          }); });
          return out;
        }));
      }
      eq(bad, []);
    },
    'palette lists digits first in numeric order': async ({ page, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => [...document.querySelectorAll('.q[data-q="0"] [data-pw]')].map(e => e.dataset.pw));
      const b = await page.evaluate(() => window.__fc.LANG.base);
      eq(r.slice(0, b), Array.from({ length: b }, (_, i) => 'D' + i));
    },
    'composing the right reply with clicks is accepted; a wrong one is not': async ({ page, eq, ok }) => {
      await closeModals(page);
      const ans = await page.evaluate(() => window.__fc.CH[0].qs[0].ans);
      await compose(page, 0, [...ans, ans[0]]);
      ok(!(await page.evaluate(() => window.__fc.S.solved['0:0'])), 'too many symbols accepted');
      ok((await page.locator('.q[data-q="0"] .fb').textContent()).includes('fewer'), 'feedback');
      await page.locator('.q[data-q="0"] [data-clear]').click();
      await page.waitForTimeout(1700); // the channel is jammed after a miss
      await compose(page, 0, ans);
      ok(await page.evaluate(() => !!window.__fc.S.solved['0:0']), 'right answer refused');
    },
    'a half-composed reply survives a SETI hint': async ({ page, eq }) => {
      await closeModals(page);
      const q = page.locator('.q[data-q="1"]');
      await q.locator('[data-pw="D1"]').click(); await q.locator('[data-pw="D0"]').click();
      await page.click('#hintBtn');
      eq(await page.locator('.q[data-q="1"] [data-compose] .g').count(), 2);
    },
    'wrong transmissions jam the channel for longer each time; sending while jammed does nothing': async ({ page, ok, eq }) => {
      await closeModals(page);
      const q = page.locator('.q[data-q="0"]'), ans = await page.evaluate(() => window.__fc.CH[0].qs[0].ans);
      const wrong = ans[0] === 'D1' ? 'D2' : 'D1';
      await q.locator(`[data-pw="${wrong}"]`).click(); await q.locator('[data-send]').click();
      ok(await q.locator('[data-send]').isDisabled(), 'transmit should be jammed');
      await page.waitForTimeout(1700);
      await q.locator('[data-send]').click();
      eq(await page.evaluate(() => window.__fc.lockFor('0:0')), 3000, 'second miss jams twice as long');
      await q.locator('[data-clear]').click();
      for (const w of ans) await q.locator(`[data-pw="${w}"]`).click();
      await q.locator('[data-send]').click({ force: true });
      ok(!(await page.evaluate(() => window.__fc.S.solved['0:0'])), 'accepted while jammed');
      await page.waitForTimeout(3100);
      await q.locator('[data-send]').click();
      ok(await page.evaluate(() => !!window.__fc.S.solved['0:0']), 'right answer after the jam');
    },
    'acknowledged replies confirm their symbols; a decoded transmission confirms all of its symbols': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(async () => {
        const fc = window.__fc, q = fc.CH[0].qs[0]; fc.solve('0:0');
        const after1 = q.ans.every(w => fc.S.known[w]);
        fc.solve('0:1'); fc.solve('0:2');
        const all = fc.CH[0].tx.flatMap(t => t.words).every(w => fc.S.known[w]);
        await new Promise(r => setTimeout(r, 1500));
        return { after1, all, gl: document.querySelector('#feed .tx .g[data-w="D1"] .gl').textContent, decoded: !!document.querySelector('.sheet.decoded'), cards: document.querySelectorAll('.nbRow.kn').length };
      });
      ok(r.after1, 'reply symbols not confirmed'); ok(r.all, 'chapter symbols not confirmed');
      eq(r.gl, '1'); ok(r.cards > 3, 'corkboard cards not confirmed');
    },
    'locked transmissions cannot be opened; finishing one unlocks the next': async ({ page, ok }) => {
      await closeModals(page);
      ok(await page.locator('#chapters button[data-c="1"]').isDisabled());
      await page.evaluate(() => { const fc = window.__fc; fc.CH[0].qs.forEach((q, k) => fc.S.solved['0:' + k] = 1); fc.render(); });
      ok(!(await page.locator('#chapters button[data-c="1"]').isDisabled()));
      await page.click('#nextCh');
      ok(await page.evaluate(() => window.__fc.S.chapter === 1));
    },
    'contact ending fires once, only after every reply': async ({ page, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(async () => {
        const fc = window.__fc, CH = fc.CH, last = CH.length - 1, fin = CH[last].qs.findIndex(q => q.final);
        CH.forEach((c, i) => c.qs.forEach((q, k) => { if (!(i === last)) fc.S.solved[i + ':' + k] = 1; }));
        fc.S.chapter = last; fc.render();
        fc.solve(last + ':' + fin, true);
        await new Promise(r => setTimeout(r, 700));
        const early = fc.S.decoded;
        CH[last].qs.forEach((q, k) => { if (k !== fin) fc.solve(last + ':' + k); });
        fc.solve(last + ':' + fin, true);
        await new Promise(r => setTimeout(r, 3000)); // after the Rosetta sweep
        return [early, fc.S.decoded, document.querySelectorAll('.modal-bg').length, JSON.parse(localStorage.getItem('rh:hub'))['first-contact']];
      });
      eq(r, [0, 1, 1, 1]);
    },
    'corrupted saves load safely': async ({ page, eq, ok }) => {
      await withSave(page, { seed: 'x', notes: [1], conf: null, solved: { '0:0': 1 }, chapter: 99, decoded: -3, intro: 1 });
      const r = await page.evaluate(() => ({ ch: window.__fc.S.chapter, d: window.__fc.S.decoded, n: window.__fc.S.notes, seed: typeof window.__fc.S.seed }));
      eq(r, { ch: 0, d: 0, n: {}, seed: 'number' });
      await withSave(page, 'not json{');
      ok(await page.evaluate(() => window.__fc.CH.length === 8));
      await withSave(page, '[]');
      ok(await page.evaluate(() => window.__fc.CH.length === 8));
    },
    'progress fraction stays within 0..1': async ({ page, ok }) => {
      await closeModals(page);
      await page.evaluate(() => { const fc = window.__fc; fc.solve('0:0'); });
      const v = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub'))['first-contact']);
      ok(v > 0 && v < 1, 'progress ' + v);
    },
    'phone layout has no horizontal overflow': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await closeModals(page);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= 392), 'overflow ' + await page.evaluate(() => document.documentElement.scrollWidth));
    },
  },
};
