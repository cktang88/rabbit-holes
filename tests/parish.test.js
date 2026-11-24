// Parish: genealogy deductions over a simulated parish register. Logic via window.__parish.
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const withSave = async (page, save) => { await page.addInitScript(s => localStorage.setItem('rh:parish', s), typeof save === 'string' ? save : JSON.stringify(save)); await page.reload(); await page.waitForTimeout(600); };
module.exports = {
  page: 'parish/index.html',
  tests: {
    'soundex matches the standard American Soundex': async ({ page, eq }) => {
      const r = await page.evaluate(() => ['Robert', 'Rupert', 'Ashcraft', 'Tymczak', 'Pfister', 'Honeyman', 'Cooper', 'Couper', 'Lee', '', '123'].map(window.__parish.soundex));
      eq(r, ['R163', 'R163', 'A261', 'T522', 'P236', 'H555', 'C160', 'C160', 'L000', '', '']);
    },
    'every task has exactly one fitting record, and it is the true one': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => {
        const P = window.__parish, W = P.W(), C = P.COMS(), bad = []; let n = 0;
        C.forEach((c, ci) => c.tasks.forEach((k, ti) => { n++; const f = P.solveTask(W.R, k); if (f.length !== 1 || f[0].id !== k.truth) bad.push(ci + ':' + ti); if (!(k.dep < ti)) bad.push('dep ' + ci + ':' + ti); }));
        return { bad, n, letters: C.length };
      });
      eq(r.bad, []); ok(r.n > 20, 'too few tasks'); ok(r.letters >= 12 && r.letters <= 24, 'letters ' + r.letters);
    },
    'task truths are the real family records': async ({ page, eq }) => {
      const bad = await page.evaluate(() => {
        const P = window.__parish, W = P.W(), out = [];
        for (const c of P.COMS()) for (const k of c.tasks) {
          const a = W.R[k.a], t = W.R[k.truth];
          if (k.kind === 'A' && !(t.t === 'M' && t.groom === a.f && t.bride === a.m)) out.push('A');
          if (k.kind === 'B' && !(t.t === 'B' && t.pid === a.groom)) out.push('B');
          if (k.kind === 'C' && !(t.t === 'B' && t.pid === a.bride)) out.push('C');
          if (k.kind === 'D' && !(t.t === 'D' && t.pid === a.groom)) out.push('D');
          if (k.kind === 'E' && !(t.t === 'D' && t.pid === a.bride)) out.push('E');
        }
        return out;
      });
      eq(bad, []);
    },
    'letters never share a record; registers are deterministic per seed': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const P = window.__parish, ks = P.COMS().flatMap(c => c.tasks.map(t => t.truth)); return { dup: ks.length - new Set(ks).size, seed: P.S.seed, sig: P.W().R.slice(0, 300).map(P.recText).join('|') }; });
      eq(r.dup, 0);
      await withSave(page, { seed: r.seed, intro: 1 });
      const sig2 = await page.evaluate(() => window.__parish.W().R.slice(0, 300).map(window.__parish.recText).join('|'));
      ok(sig2 === r.sig, 'same seed must give the same register, spelt and abbreviated the same way');
    },
    'every decoy can be struck with a true reason; the true record never can': async ({ page, eq }) => {
      const bad = await page.evaluate(() => {
        const P = window.__parish, W = P.W(), out = [];
        P.COMS().forEach((c, ci) => c.tasks.forEach((k, ti) => {
          const K = P.KIND[k.kind], cands = P.candidates(W.R, k);
          if (!cands.some(x => x.id === k.truth)) out.push('truth missing ' + ci + ':' + ti);
          for (const x of cands) { const why = K.why(W.R, x, k).filter(code => K.strikes.includes(code)); if (x.id === k.truth ? why.length : !why.length) out.push(ci + ':' + ti + ':' + x.id); }
        }));
        return out;
      });
      eq(bad, []);
    },
    'striking: a true reason strikes, a false one blots once, locked tasks refuse, last entry is entered': async ({ page, eq, ok }) => {
      await closeModals(page);
      const r = await page.evaluate(async () => {
        const P = window.__parish, W = P.W(), C = P.COMS(), out = {};
        const ci = C.findIndex((c, i) => P.tierOpen(P.tierOf(i)) && P.candidates(W.R, c.tasks[0]).length >= 3); if (ci < 0) return null;
        P.openLetter(ci); const c = C[ci], k = c.tasks[0], K = P.KIND[k.kind];
        const locked = c.tasks.findIndex(t => t.dep >= 0);
        if (locked >= 0) { const t = c.tasks[locked], d = P.candidates(W.R, t).find(x => x.id !== t.truth); out.locked = d ? P.strike(locked, d.id, K.strikes[0]) : null; }
        const decoys = P.candidates(W.R, k).filter(x => x.id !== k.truth);
        const d0 = decoys[0], good = K.why(W.R, d0, k).find(code => K.strikes.includes(code)), badC = K.strikes.find(code => !K.why(W.R, d0, k).includes(code));
        if (badC) { out.bad1 = P.strike(0, d0.id, badC); out.bad2 = P.strike(0, d0.id, badC); }
        out.wrong = P.S.wrong[ci] || 0; out.truthStrike = P.strike(0, k.truth, K.strikes[0]);
        out.good = P.strike(0, d0.id, good); out.left = P.remaining(0).length;
        for (const d of decoys.slice(1)) P.strike(0, d.id, K.why(W.R, d, k).find(code => K.strikes.includes(code)));
        out.prog = P.S.prog[ci][0]; out.badC = !!badC; out.wrongEnd = P.S.wrong[ci] || 0;
        return out;
      });
      ok(r, 'no letter with 3+ candidates in the open tier');
      if (r.locked !== undefined) eq(r.locked, null, 'locked task struck');
      if (r.badC) { eq(r.bad1, false); eq(r.bad2, false); eq(r.wrong, 1, 'same wrong reason charged twice'); }
      eq(r.truthStrike, false, 'the true record was struck'); eq(r.good, true);
      eq(r.prog, 1, 'last remaining entry should be entered'); eq(r.wrongEnd, (r.badC ? 1 : 0) + 1);
    },
    'real clicks: open an entry, strike it with a reason chip': async ({ page, eq, ok }) => {
      await closeModals(page);
      const t = await page.evaluate(() => { const P = window.__parish, W = P.W(), k = P.COMS()[P.cur].tasks[0], K = P.KIND[k.kind]; const d = P.candidates(W.R, k).find(x => x.id !== k.truth); return d ? { id: d.id, code: K.why(W.R, d, k).find(c => K.strikes.includes(c)), label: P.strikeLabel(K.why(W.R, d, k).find(c => K.strikes.includes(c)), k) } : null; });
      if (!t) { ok(await page.locator('[data-confirm="0"]').count() === 1, 'single candidate should offer to enter it'); return; }
      await page.locator(`.cand[data-cand="${t.id}"]`).click();
      await page.locator(`.cand[data-cand="${t.id}"] [data-strike="${t.code}"]`).click();
      ok(await page.locator(`.cand.struck[data-cand="${t.id}"]`).count() === 1, 'not struck');
      ok((await page.locator(`.cand.struck[data-cand="${t.id}"] .why`).textContent()).includes(t.label));
    },
    'completing a letter presses a seal and gives stars from blots': async ({ page, eq }) => {
      await closeModals(page);
      await page.evaluate(() => {
        const P = window.__parish, W = P.W(), c = P.COMS()[0]; P.openLetter(0); P.S.wrong[0] = 2;
        c.tasks.forEach((k, i) => { const K = P.KIND[k.kind]; for (const d of P.candidates(W.R, k)) if (d.id !== k.truth) P.strike(i, d.id, K.why(W.R, d, k).find(x => K.strikes.includes(x))); P.confirmTask(i); });
      });
      eq(await page.locator('#right .letter .seal').count(), 1, 'seal');
      await page.waitForTimeout(1500);
      eq(await page.evaluate(() => window.__parish.S.done[0]), { stars: 2 });
      eq(await page.locator('.modal-bg').count(), 1, 'one completion modal');
    },
    'the next bundle opens on stars, not on letters': async ({ page, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const P = window.__parish; for (let i = 0; i < 4; i++) P.S.done[i] = { stars: 2 }; const a = P.tierOpen(1); P.S.done[4] = { stars: 1 }; const b = P.tierOpen(1); return [a, b, P.STARS_TO_OPEN]; });
      eq(r, [false, true, 9]);
    },
    'saved strikes survive a reload only if the reason holds': async ({ page, eq }) => {
      const info = await page.evaluate(() => { const P = window.__parish, W = P.W(), k = P.COMS()[0].tasks[0], K = P.KIND[k.kind]; const d = P.candidates(W.R, k).find(x => x.id !== k.truth); return { seed: P.S.seed, d: d && d.id, code: d && K.why(W.R, d, k).find(c => K.strikes.includes(c)), truth: k.truth, other: K.strikes[0] }; });
      if (info.d == null) return;
      await withSave(page, { seed: info.seed, intro: 1, strikes: { 0: { 0: { [info.d]: info.code, [info.truth]: info.other, 999999: 'late' } } } });
      eq(await page.evaluate(() => window.__parish.S.strikes[0][0]), { [info.d]: info.code });
    },
    'clicking a pinned record updates the selected-record box (answers go to what you see)': async ({ page, ok }) => {
      await closeModals(page);
      const ids = await page.evaluate(() => { const P = window.__parish; P.S.pins.push(5, 40); P.setSel(5); P.renderAll(); return [5, 40]; });
      await page.locator('.pins .p[data-id="40"]').click();
      const txt = await page.locator('.selbox .txt').textContent();
      const want = await page.evaluate(() => window.__parish.recText(window.__parish.W().R[40]));
      ok(txt.includes(want), 'selected box shows a stale record: ' + txt);
    },
    'a surname with no letters finds nothing (not every baptism)': async ({ page, eq }) => {
      await closeModals(page);
      await page.fill('#qS', '1');
      eq(await page.locator('#book .rec').count(), 0);
      await page.fill('#qS', '');
      await page.fill('#qG', '-');
      eq(await page.locator('#book mark').count(), 0, 'empty highlight marks');
    },
    'look up fills the index and the true record is among the hits': async ({ page, ok }) => {
      await closeModals(page);
      await page.locator('[data-look="0"]').click();
      const truth = await page.evaluate(() => window.__parish.COMS()[window.__parish.cur].tasks[0].truth);
      ok(await page.locator(`#book .rec[data-id="${truth}"]`).count() === 1, 'truth not found by look up');
    },
    'look up finds the true record for every open task of every letter (variant spellings included)': async ({ page, eq }) => {
      await closeModals(page);
      const miss = await page.evaluate(() => {
        const P = window.__parish, out = [];
        P.COMS().forEach((c, ci) => { P.S.prog[ci] = c.tasks.map(() => 1); c.tasks.forEach((k, ti) => {
          P.openLetter(ci); P.lookUp(ti);
          if (!document.querySelector(`#book .rec[data-id="${k.truth}"]`)) out.push(ci + ':' + ti);
        }); });
        return out;
      });
      eq(miss, []);
    },
    'moving parish never lowers hub progress': async ({ page, ok }) => {
      await closeModals(page);
      const before = await page.evaluate(() => { const P = window.__parish; P.COMS().forEach((c, i) => { P.S.done[i] = { stars: 3 }; }); P.renderAll(); P.openLetter(0); return JSON.parse(localStorage.getItem('rh:hub')).parish; });
      await page.click('#newParish'); await page.locator('.modal-bg button', { hasText: 'Move' }).click(); await page.waitForTimeout(500);
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem('rh:hub')).parish);
      ok(before === 1 && after >= before, `progress ${before} -> ${after}`);
    },
    'corrupted and old saves load safely': async ({ page, eq, ok }) => {
      const d = await page.evaluate(() => window.__parish.cleanSave('junk'));
      eq(d.pins, []); eq(d.done, {});
      await withSave(page, { seed: 12345, done: { 0: { stars: 3 }, 400: { stars: 9 }, x: 1 }, prog: { 1: [1], 2: 'no' }, pins: [3, 99999999, 'a', 3], cur: 23, intro: 1, wrong: null });
      const r = await page.evaluate(() => { const S = window.__parish.S; return { done: Object.keys(S.done), pins: S.pins, cur: window.__parish.cur, prog1: S.prog[1] }; });
      eq(r.done, ['0']); eq(r.pins, [3]); eq(r.cur, 0, 'locked letter not reopened'); eq(r.prog1, undefined);
      await withSave(page, '{not json');
      ok(await page.evaluate(() => window.__parish.COMS().length > 0));
    },
    'locked tiers cannot be opened': async ({ page, eq }) => {
      await closeModals(page);
      await page.locator('.cm[data-i="7"]').click();
      eq(await page.evaluate(() => window.__parish.cur), 0);
    },
    'opening a letter jumps the book to its baptism year': async ({ page, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const P = window.__parish; P.openLetter(3); return [P.year, new Date(Date.UTC(1650, 0, 1) + Math.floor(P.W().R[P.COMS()[3].start].d) * 864e5).getUTCFullYear()]; });
      eq(r[0], r[1]);
    },
    'phone layout has no horizontal overflow': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await closeModals(page);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= 392), 'overflow ' + await page.evaluate(() => document.documentElement.scrollWidth));
    },
  },
};
