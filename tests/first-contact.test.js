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
    'grammar: clause() follows word order, negation, tense, question and plural settings': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const { LANG, clause, np } = window.__fc, out = {};
        LANG.neg = 'before'; LANG.qPos = 'initial';
        for (const o of ['SVO', 'SOV', 'VSO', 'VOS', 'OSV']) { LANG.order = o; out[o] = clause({ s: ['S'], v: 'V', o: ['O'] }); }
        LANG.order = 'SVO'; LANG.tenseFinal = true; out.past = clause({ s: ['S'], v: 'V', o: ['O'], neg: 1, past: 1, q: 1 });
        LANG.tenseFinal = false; out.past2 = clause({ s: ['S'], v: 'V', past: 1 });
        LANG.neg = 'after'; out.negA = clause({ s: ['S'], v: 'V', o: ['O'], neg: 1 });
        LANG.neg = 'final'; LANG.qPos = 'final'; out.negF = clause({ s: ['S'], v: 'V', o: ['O'], neg: 1, q: 1 });
        LANG.numAfter = true; LANG.littleEndian = false;
        for (const m of ['marker', 'redup', 'none']) { LANG.plural = m; out[m] = np('ARM', 2); }
        return out;
      });
      eq(r.SVO, ['S', 'V', 'O']); eq(r.SOV, ['S', 'O', 'V']); eq(r.VSO, ['V', 'S', 'O']); eq(r.VOS, ['V', 'O', 'S']); eq(r.OSV, ['O', 'S', 'V']);
      eq(r.past, ['Q', 'S', 'NOT', 'V', 'O', 'PAST']); eq(r.past2, ['PAST', 'S', 'V']);
      eq(r.negA, ['S', 'V', 'NOT', 'O']); eq(r.negF, ['S', 'V', 'O', 'NOT', 'Q']);
      eq(r.marker, ['ARM', 'PL', 'D2']); eq(r.redup, ['ARM', 'ARM', 'D2']); eq(r.none, ['ARM', 'D2']);
    },
    'new signals vary the grammar and the third transmission, not just the glyphs': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const f = { base: new Set(), order: new Set(), plural: new Set(), neg: new Set(), qPos: new Set(), module: new Set() };
        for (let i = 1; i <= 60; i++) { const L = window.__fc.buildLanguage(i * 7919); for (const k in f) f[k].add(L[k]); }
        return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.size])); });
      ok(r.base >= 6 && r.order === 5 && r.plural === 3 && r.neg === 3 && r.qPos === 2 && r.module === 2, JSON.stringify(r));
    },
    'many seeds: every reply can be composed from glyphs already received; no quiz questions remain': async ({ page, eq }) => {
      const bad = [];
      for (let seed = 1; seed <= 16; seed++) {
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
    'replies confirm the symbols they used; no English is printed for glyphs the player never annotated': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const fc = window.__fc, q = fc.CH[0].qs[0]; fc.solve('0:0');
        return { conf: q.ans.every(w => fc.S.known[w]), gl: [...document.querySelectorAll('#feed .g[data-w] .gl')].map(e => e.textContent).filter(Boolean).length }; });
      ok(r.conf, 'reply symbols not confirmed'); eq(r.gl, 0, 'glosses printed without notes');
    },
    'decoding a transmission grades pencilled guesses: right ones confirmed, wrong ones marked, blanks left alone': async ({ page, ok, eq }) => {
      const seed = await page.evaluate(() => { for (let i = 1; ; i++) if (window.__fc.buildLanguage(i * 31).base >= 8) return i * 31; });
      await withSave(page, { seed, intro: 1 }); await closeModals(page);
      const r = await page.evaluate(async () => {
        const fc = window.__fc, S = fc.S, L = fc.LANG;
        const used = new Set(fc.CH[0].qs.flatMap(q => q.ans)), free = Array.from({ length: L.base }, (_, i) => 'D' + i).filter(w => !used.has(w));
        const [dr, dw, db] = free; const names = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
        S.notes[dr] = names[+dr.slice(1)]; S.notes[dw] = String(+dw.slice(1) + 1); // one right, one wrong
        fc.solve('0:0'); fc.solve('0:1'); fc.solve('0:2');
        await new Promise(r => setTimeout(r, 1800));
        return { d2: !!S.known[dr], d1bad: !!(S.bad && S.bad[dw]), blank: db ? !!S.known[db] : false, redCard: !!document.querySelector('.nbRow.bad'), glD2: document.querySelector(`#feed .tx .g[data-w="${dr}"] .gl`).textContent, want: S.notes[dr] };
      });
      ok(r.d2, 'right guess not confirmed'); ok(r.d1bad, 'wrong guess not marked'); ok(!r.blank, 'unannotated glyph was confirmed'); ok(r.redCard); eq(r.glD2, r.want);
    },
    'guess checking accepts sensible wordings and rejects others': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const g = window.__fc.guessRight; return [g('HOT', 'warm'), g('COLD', 'icy'), g('PAST', 'was / past'), g('WE', 'the aliens'), g('D3', '3'), g('D3', 'three'), g('HOT', 'cold'), g('D3', '13'), g('IS', 'island'), g('PLUS', '+')]; });
      eq(r, [true, true, true, true, true, true, false, false, false, true]);
    },
    'newcomer: intro says one species per signal; hot and cold planets are drawn differently': async ({ page, ok }) => {
      const r = await page.evaluate(() => [document.querySelector('.modal')?.textContent || '', window.__fc.planetIn(1), window.__fc.planetIn(0)]);
      ok(/All eight transmissions come from one species/.test(r[0]), 'intro');
      ok(r[1].includes('path') && /stroke="#468"/.test(r[2]) && r[1] !== r[2], 'hot vs cold');
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
