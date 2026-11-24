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
    'answering: wrong costs a star, locked and already-answered tasks cannot be answered': async ({ page, eq, ok }) => {
      await closeModals(page);
      const r = await page.evaluate(async () => {
        const P = window.__parish, c = P.COMS()[0], W = P.W(), out = {};
        const locked = c.tasks.findIndex(k => k.dep >= 0);
        if (locked >= 0) { P.setSel(c.tasks[locked].truth); await P.answer(locked); out.locked = P.S.prog[0][locked]; }
        const wrongRec = W.R.find(x => x.id !== c.tasks[0].truth && x.t === W.R[c.tasks[0].truth].t);
        P.setSel(wrongRec.id); await P.answer(0); out.wrong = P.S.wrong[0]; out.p0 = P.S.prog[0][0];
        P.setSel(c.tasks[0].truth); await P.answer(0); out.p1 = P.S.prog[0][0];
        await P.answer(0); out.wrongAfter = P.S.wrong[0];
        return out;
      });
      if (r.locked !== undefined) eq(r.locked, 0, 'locked task answered');
      eq(r.wrong, 1); eq(r.p0, 0); eq(r.p1, 1); eq(r.wrongAfter, 1, 're-answering an answered task');
    },
    'completing a letter gives stars from mistakes and opens it as done': async ({ page, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(async () => {
        const P = window.__parish, c = P.COMS()[0];
        P.S.wrong[0] = 2;
        const pending = [];
        for (let i = 0; i < c.tasks.length; i++) { P.setSel(c.tasks[i].truth); pending.push(P.answer(i)); }
        await new Promise(r => setTimeout(r, 50));
        return P.S.done[0];
      });
      eq(r, { stars: 2 });
      eq(await page.locator('.modal-bg').count(), 1, 'one completion modal');
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
