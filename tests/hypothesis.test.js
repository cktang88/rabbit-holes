// Hypothesis: law generation, journal classification (accept box = machine accepts), prediction rounds, saves.
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const boxes = page => page.evaluate(() => {
  const H = window.__hyp, st = H.lawState(H.cur), L = H.cur === 'free' ? null : H.LAWS[H.cur];
  const read = sel => [...document.querySelectorAll(sel + ' .koan')].map(el => ({ tag: el.querySelector('.tag')?.textContent || '', n: el.querySelectorAll('svg').length }));
  return { yes: read('.jcol.yes'), no: read('.jcol.no'), journal: st.journal.map(e => ({ ok: e.ok, f: L ? L.f(e.k) : e.ok, pred: !!e.pred })) };
});

module.exports = {
  page: 'hypothesis/index.html',
  ready: async page => { await page.waitForFunction(() => window.__hyp); await closeModals(page); },
  tests: {
    'sixty laws in eight tiers, each neither trivial nor near-duplicate': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const H = window.__hyp, fps = H.LAWS.map(H.fp), bad = [];
        fps.forEach((p, i) => { const rate = p.filter(Boolean).length / p.length; if (rate < .1 || rate > .9) bad.push(i + ' rate ' + rate); });
        for (let i = 0; i < fps.length; i++) for (let j = i + 1; j < fps.length; j++) if (fps[i].filter((x, k) => x !== fps[j][k]).length < 25) bad.push(i + '~' + j);
        return { n: H.LAWS.length, tiers: [0, 1, 2, 3, 4, 5, 6, 7].map(t => H.LAWS.filter(l => l.tier === t).length), bad, desc: H.LAWS.every(l => typeof l.d === 'string' && l.d.length > 5 && !/undefined|NaN/.test(l.d)) };
      });
      eq(r.n, 60); eq(r.tiers, [8, 8, 8, 8, 7, 7, 7, 7]); ok(!r.bad.length, r.bad.slice(0, 5).join(', ')); ok(r.desc, 'bad description');
    },
    'law semantics match their wording (hand cases)': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const H = window.__hyp, fake = seq => { let i = 0; const f = () => 0; f.int = () => seq[i++ % seq.length]; f.pick = a => a[f.int()]; return f; };
        const R = 0, B = 1, Y = 2, CI = 0, SQ = 1, TR = 2, SM = 0, MD = 1, LG = 2;
        const odd = H.GEN[1][6](fake([0])), prime = H.GEN[7][5](fake([0])), inc = H.GEN[3][2](fake([0])), big = H.GEN[2][4](fake([0]));
        const has = H.GEN[0][0](fake([0, 1])); // attr 0 (colour) value 1 -> blue
        const k1 = [[R, CI, SM]], k2 = [[R, CI, SM], [B, SQ, LG]], k3 = [[Y, TR, LG], [R, CI, MD], [B, SQ, SM]];
        return [odd.d, odd.f(k1), odd.f(k2), prime.f(k1), prime.f(k2), prime.f([...k3, ...k1]), inc.f(k2), inc.f(k3), big.f(k3), big.f(k2), has.d, has.f(k1), has.f(k2)];
      });
      eq(r, ['An odd number of tokens', true, false, false, true, false, true, false, true, false, 'Contains a blue token', false, true]);
    },
    'every law starts correctly filed: 1+1 given koans, or a 5+5 dossier for sealed cases': async ({ page, ok }) => {
      const bad = await page.evaluate(() => {
        const H = window.__hyp, out = [];
        H.LAWS.forEach((L, i) => { const st = H.lawState(i), y = st.journal.filter(e => e.ok), n = st.journal.filter(e => !e.ok), want = H.isSealed(i) ? 5 : 1;
          if (y.length !== want || n.length !== want || !y.every(e => L.f(e.k)) || n.some(e => L.f(e.k)) || new Set(st.journal.map(e => H.kkey(e.k))).size !== st.journal.length || !!st.sealed !== H.isSealed(i)) out.push(i); });
        if (H.LAWS.filter((L, i) => H.isSealed(i)).length !== 14) out.push('sealed count');
        return out;
      });
      ok(!bad.length, 'laws ' + bad.join(','));
    },
    'regression: after failed predictions the accept box holds only accepted koans and labels misses clearly': async ({ page, ok, eq }) => {
      for (const ans of [true, false]) {
        await page.evaluate(ans => { const H = window.__hyp; H.openLaw(0); H.startPredict(); H.preds.forEach(p => p.ans = ans); H.submitPred(); }, ans);
        await page.waitForTimeout(100); await closeModals(page);
        const b = await boxes(page);
        ok(b.journal.every(e => e.ok === e.f), 'journal verdict differs from the law');
        eq(b.yes.length, b.journal.filter(e => e.f).length, 'accept box count');
        eq(b.no.length, b.journal.filter(e => !e.f).length, 'reject box count');
        ok(b.yes.every(x => x.tag !== 'you said ✓' && x.tag !== 'missed'), 'accept box has a rejected-looking label: ' + JSON.stringify(b.yes));
        ok(b.no.every(x => x.tag !== 'you said ✗' && x.tag !== 'missed'), 'reject box mislabelled');
        const mis = b.journal.filter(e => e.pred).length;
        eq(b.yes.filter(x => x.tag === 'you said ✗').length + b.no.filter(x => x.tag === 'you said ✓').length, mis);
      }
      const head = await page.textContent('.jcol.yes h3'); ok(/accepts/.test(head));
    },
    'testing a koan through the real UI files it by verdict and spends one probe; duplicates are free': async ({ page, eq, ok }) => {
      await page.evaluate(() => window.__hyp.openLaw(0));
      await page.click('#pal button[data-t="000"]'); await page.click('#pal button[data-t="112"]');
      await page.click('#testBtn');
      const r1 = await page.evaluate(() => { const H = window.__hyp, st = H.lawState(0), e = st.journal.at(-1); return { probes: st.probes, ok: e.ok, f: H.LAWS[0].f(e.k), k: e.k, verdict: document.getElementById('verdict').textContent }; });
      eq(r1.probes, 1); eq(r1.ok, r1.f); eq(r1.k, [[0, 0, 0], [1, 1, 2]]); ok(r1.verdict.includes(r1.f ? 'Accepted' : 'Rejected'));
      await page.click('#testBtn');
      eq(await page.evaluate(() => window.__hyp.lawState(0).probes), 1, 'duplicate spent a probe');
      ok((await page.textContent('#verdict')).includes('Already'));
      // Enter key tests, but not while typing notes
      await page.click('#notes'); await page.keyboard.type('x'); await page.keyboard.press('Enter');
      eq(await page.evaluate(() => window.__hyp.lawState(0).probes), 1, 'Enter in notes tested');
    },
    'builder: 8-token limit, move, delete, empty test disabled': async ({ page, eq, ok }) => {
      await page.evaluate(() => window.__hyp.openLaw(0));
      ok(await page.isDisabled('#testBtn'), 'empty test enabled');
      for (let n = 0; n < 10; n++) await page.click('#pal button[data-t="000"]');
      eq(await page.evaluate(() => window.__hyp.builder.length), 8);
      await page.click('#pal button[data-t="000"]');
      await page.click('#brow .tk[data-i="0"]'); await page.click('#pal button[data-t="222"]'); await page.click('#mvR');
      eq(await page.evaluate(() => window.__hyp.builder.slice(0, 2)), [[0, 0, 0], [2, 2, 2]]);
      await page.click('#delBtn'); eq(await page.evaluate(() => window.__hyp.builder.length), 7);
    },
    'a correct prediction round publishes the law with stars; set is fresh and mixed': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const H = window.__hyp, out = []; H.openLaw(1);
        for (let t = 0; t < 30; t++) { H.startPredict(); const L = H.LAWS[1], seen = new Set(H.lawState(1).journal.map(e => H.kkey(e.k)));
          const keys = H.preds.map(p => H.kkey(p.k)); out.push({ n: H.preds.length, uniq: new Set(keys).size, fresh: keys.every(k => !seen.has(k)), pos: H.preds.filter(p => L.f(p.k)).length }); }
        return out;
      });
      ok(r.every(x => x.n === 8 && x.uniq === 8 && x.fresh), 'bad prediction set');
      ok(r.every(x => x.pos >= 3 && x.pos <= 5), 'accepted count outside 3..5');
      ok(new Set(r.map(x => x.pos)).size > 1, 'accepted count always the same (leaks the last answer)');
      await page.evaluate(() => { const H = window.__hyp; H.render(); });
      for (let i = 0; i < 8; i++) { const yes = await page.evaluate(i => window.__hyp.LAWS[1].f(window.__hyp.preds[i].k), i); await page.click(`.pcard[data-i="${i}"] .${yes ? 'y' : 'n'}`); }
      await page.click('#subBtn'); await page.waitForTimeout(100);
      const s = await page.evaluate(() => window.__hyp.S.laws[1].solved);
      eq(s.stars, 3); ok(await page.locator('.modal').count() === 1);
    },
    'wrong predictions cost 2 probes each; reveal offered after 3 failed rounds': async ({ page, eq, ok }) => {
      const r = await page.evaluate(async () => {
        const H = window.__hyp; H.openLaw(2); const out = [];
        for (let t = 0; t < 3; t++) { H.startPredict(); const L = H.LAWS[2]; H.preds.forEach((p, i) => p.ans = i === 0 ? !L.f(p.k) : L.f(p.k)); H.submitPred(); await new Promise(r => setTimeout(r, 30));
          out.push({ probes: H.lawState(2).probes, fails: H.lawState(2).fails, reveal: [...document.querySelectorAll('.modal button')].some(b => /Reveal/.test(b.textContent)) });
          document.querySelectorAll('.modal-bg').forEach(m => m.remove()); }
        return out;
      });
      eq(r.map(x => x.probes), [2, 4, 6]); eq(r.map(x => x.fails), [1, 2, 3]); eq(r.map(x => x.reveal), [false, false, true]);
    },
    'tiers stay locked until 3 laws are solved; progress fraction is bounded': async ({ page, eq, ok }) => {
      ok(!(await page.evaluate(() => window.__hyp.tierOpen(1))));
      await page.click('.law[data-i="9"]'); eq(await page.evaluate(() => window.__hyp.cur), 0, 'locked law opened');
      await page.click('.law[data-i="free"]'); eq(await page.evaluate(() => window.__hyp.cur), 0, 'locked free lab opened');
      const r = await page.evaluate(() => { const H = window.__hyp; for (let i = 0; i < 2; i++) { H.lawState(i).solved = { stars: 3, probes: 1 }; } if (H.tierOpen(1)) return { a: false };
        H.lawState(2).solved = { stars: 3, probes: 1 }; const a = H.tierOpen(1);
        for (let i = 0; i < 60; i++) H.lawState(i).solved = { stars: 3, probes: 1 }; H.openLaw(0); return { a, hub: JSON.parse(localStorage.getItem('rh:hub')).hypothesis }; });
      ok(r.a); eq(r.hub, 1);
    },
    'sealed case: the test lever is locked, stars come from failed rounds, publish engraves the law': async ({ page, eq, ok }) => {
      await page.evaluate(() => { const H = window.__hyp; for (let i = 0; i < 3; i++) H.lawState(i).solved = { stars: 3, probes: 1 }; H.openLaw(10); });
      await page.click('#pal button[data-t="000"]');
      ok(await page.isDisabled('#testBtn'), 'test lever not sealed');
      await page.keyboard.press('Enter');
      eq(await page.evaluate(() => window.__hyp.lawState(10).journal.length), 10, 'Enter probed a sealed case');
      ok((await page.textContent('#center')).includes('Sealed case'));
      // one failed round, then a perfect one: 2 stars
      await page.evaluate(() => { const H = window.__hyp, L = H.LAWS[10]; H.startPredict(); H.preds.forEach((p, i) => p.ans = i ? L.f(p.k) : !L.f(p.k)); H.submitPred(); });
      await page.waitForTimeout(80); await closeModals(page);
      await page.evaluate(() => { const H = window.__hyp, L = H.LAWS[10]; H.startPredict(); H.preds.forEach(p => p.ans = L.f(p.k)); H.submitPred(); });
      await page.waitForTimeout(80);
      eq(await page.evaluate(() => window.__hyp.S.laws[10].solved.stars), 2);
      const plate = await page.evaluate(() => [...document.querySelectorAll('.modal .lawtext .ch')].map(c => c.textContent).join(''));
      const d = await page.evaluate(() => window.__hyp.LAWS[10].d);
      eq(plate, ('“' + d + '”').replace(/ /g, ''), 'engraved plate text');
      await closeModals(page); await page.evaluate(() => window.__hyp.render());
      ok(!(await page.isDisabled('#testBtn')), 'solved sealed case should allow free experiments');
    },
    'free lab: opens, rerolls, gives a valid start journal': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const H = window.__hyp; for (let i = 0; i < 32; i++) H.lawState(i).solved = { stars: 3, probes: 1 }; H.openFree(true); const a = H.lawState('free'); H.openFree(true); const b = H.lawState('free');
        return { a: a.journal.length, b: b.journal.length, sameObj: a === b, okFlags: b.journal.map(e => e.ok) }; });
      ok(r.a === 2 && r.b === 2 && !r.sameObj, JSON.stringify(r)); ok(r.okFlags[0] === true && r.okFlags[1] === false);
    },
    'save loading tolerates junk, partial and malformed journals': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const H = window.__hyp, put = v => localStorage.setItem('rh:hyp', typeof v === 'string' ? v : JSON.stringify(v)), out = [];
        put('nope'); out.push(typeof H.loadState().seed);
        put({ seed: 3, laws: { 0: { journal: [{ k: [[0, 0, 9]], ok: true }] }, 1: { journal: [{ k: [[0, 1, 2]], ok: false }], probes: 'x' }, 77: { journal: [] } }, cur: 'zzz', free: { tier: 99 } });
        const s = H.loadState(); out.push(Object.keys(s.laws), s.laws[1].probes, s.cur, s.free.tier, s.free.st);
        return out;
      });
      eq(r, ['number', ['1'], 0, 0, 3, null]);
    },
    'phone layout: no horizontal scroll in probe and predict modes': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
      ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 392, 'probe overflow');
      await page.evaluate(() => window.__hyp.startPredict());
      ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 392, 'predict overflow');
    },
    'phone: level list is a drawer behind a labelled button; picking a level closes it': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
      const off = await page.evaluate(() => document.getElementById('side').getBoundingClientRect().right <= 0);
      ok(off, 'list visible without opening the drawer');
      ok(await page.isVisible('#lvlBtn'), 'no drawer button');
      await page.click('#lvlBtn'); await page.waitForTimeout(300);
      ok(await page.evaluate(() => document.body.classList.contains('drawer') && document.getElementById('side').getBoundingClientRect().left >= 0), 'drawer did not open');
      await page.click('#side .law:not(.locked) >> nth=1'); await page.waitForTimeout(300);
      ok(!(await page.evaluate(() => document.body.classList.contains('drawer'))), 'drawer stayed open');
      await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(150);
      ok(!(await page.isVisible('#lvlBtn')), 'drawer button on desktop');
    },
  },
};
