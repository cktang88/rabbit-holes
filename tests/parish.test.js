// Parish: genealogy deductions over a simulated parish register. Logic via window.__parish.
const { parishBot } = require('./parish.bots.js');
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
        C.forEach((c, ci) => c.tasks.forEach((k, ti) => { n++; const f = P.solveTask(W.R, k); if (k.absent ? f.length !== 0 : (f.length !== 1 || f[0].id !== k.truth)) bad.push(ci + ':' + ti); if (!(k.dep < ti)) bad.push('dep ' + ci + ':' + ti); }));
        return { bad, n, letters: C.length };
      });
      eq(r.bad, []); ok(r.n > 20, 'too few tasks'); ok(r.letters >= 12 && r.letters <= 24, 'letters ' + r.letters);
    },
    'task truths are the real family records': async ({ page, eq }) => {
      const bad = await page.evaluate(() => {
        const P = window.__parish, W = P.W(), out = [];
        for (const c of P.COMS()) for (const k of c.tasks) {
          if (k.absent) continue; const a = W.R[k.a], t = W.R[k.truth];
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
      const r = await page.evaluate(() => { const P = window.__parish, ks = P.COMS().flatMap(c => c.tasks.map(t => t.truth)).filter(x => x != null); return { dup: ks.length - new Set(ks).size, seed: P.S.seed, sig: P.W().R.slice(0, 300).map(P.recText).join('|') }; });
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
          if (!k.absent && !cands.some(x => x.id === k.truth)) out.push('truth missing ' + ci + ':' + ti);
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
        const ci = C.findIndex(c => P.candidates(W.R, c.tasks[0]).length >= 2); if (ci < 0) return null;
        P.openLetter(ci); const c = C[ci], k = c.tasks[0], K = P.KIND[k.kind];
        const locked = c.tasks.findIndex(t => t.dep >= 0);
        if (locked >= 0) { const t = c.tasks[locked], d = P.candidates(W.R, t).find(x => x.id !== t.truth); out.locked = d ? P.strike(locked, d.id, K.strikes[0]) : null; }
        const decoys = P.candidates(W.R, k).filter(x => x.id !== k.truth);
        const d0 = decoys[0], good = P.proofFor(0, d0.id), badC = K.strikes.find(code => !P.CITE[code] && !K.why(W.R, d0, k).includes(code));
        if (badC) { out.bad1 = P.strike(0, d0.id, badC); out.bad2 = P.strike(0, d0.id, badC); }
        out.wrong = P.S.wrong[ci] || 0; out.truthStrike = P.strike(0, k.truth, K.strikes[0]);
        out.good = P.strike(0, d0.id, good.code, good.cite); out.left = P.remaining(0).length;
        for (const d of decoys.slice(1)) { const pf = P.proofFor(0, d.id); P.strike(0, d.id, pf.code, pf.cite); }
        P.confirmTask(0);
        out.prog = P.S.prog[ci][0]; out.badC = !!badC; out.wrongEnd = P.S.wrong[ci] || 0;
        return out;
      });
      ok(r, 'no letter whose first task has a decoy');
      if (r.locked !== undefined) eq(r.locked, null, 'locked task struck');
      if (r.badC) { eq(r.bad1, false); eq(r.bad2, false); eq(r.wrong, 1, 'same wrong reason charged twice'); }
      eq(r.truthStrike, false, 'the true record was struck'); eq(r.good, true);
      eq(r.prog, 1, 'last remaining entry should be entered'); eq(r.wrongEnd, (r.badC ? 1 : 0) + 1);
    },
    'real clicks: open an entry, strike it with a reason chip': async ({ page, ok }) => {
      await closeModals(page);
      const t = await page.evaluate(() => {
        const P = window.__parish, W = P.W(), c = P.COMS()[P.cur], prog = P.S.prog[P.cur];
        const i = c.tasks.findIndex((k, j) => !prog[j] && (k.dep < 0 || prog[k.dep]) && P.remaining(j).length > 1); if (i < 0) return null;
        const k = c.tasks[i], d = P.remaining(i).find(x => x.id !== k.truth && !P.proofFor(i, x.id).cite); if (!d) return { skip: 1 }; const code = P.proofFor(i, d.id).code;
        return { i, id: d.id, code, label: P.strikeLabel(code, k) };
      });
      ok(t, 'the first letter should open on a task that needs deduction'); if (t.skip) return;
      await page.locator(`.cand[data-cand="${t.id}"]`).click();
      await page.locator(`.cand[data-cand="${t.id}"] [data-strike="${t.code}"]`).click();
      if (await page.evaluate(i => window.__parish.S.prog[window.__parish.cur][i], t.i)) return; // it was the only decoy: the task is answered
      ok(await page.locator(`.cand.struck[data-cand="${t.id}"]`).count() === 1, 'not struck');
      ok((await page.locator(`.cand.struck[data-cand="${t.id}"] .why`).textContent()).includes(t.label));
    },
    'single-name tasks are filled in automatically; no letter is only those': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const P = window.__parish, W = P.W(); return P.COMS().filter(c => c.tasks.filter(k => P.candidates(W.R, k).length > 1).length < 2).length; });
      eq(r, 0);
    },
    'completing a letter presses a seal and gives stars from blots': async ({ page, eq }) => {
      await closeModals(page);
      await page.evaluate(() => {
        const P = window.__parish, W = P.W(), c = P.COMS()[0]; P.openLetter(0); P.S.wrong[0] = 1;
        c.tasks.forEach((k, i) => { for (const d of P.candidates(W.R, k)) if (d.id !== k.truth) { const pf = P.proofFor(i, d.id); P.strike(i, d.id, pf.code, pf.cite); } if (k.absent) P.declareAbsent(i); else P.confirmTask(i); });
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
    'difficulty: naive play fails the last bundle; a careful reader wins; 3 stars needs the right evidence first time': async ({ page, ok }) => {
      const all = { random: [], dates: [], simple: [], solver: [] };
      for (const seed of [101, 202]) {
        await withSave(page, { seed, intro: 1 }); await closeModals(page);
        await page.addScriptTag({ content: parishBot.toString() });
        const r = await page.evaluate(() => { const P = window.__parish, L = P.COMS().length, out = {};
          for (const pol of ['random', 'dates', 'simple', 'solver']) { out[pol] = []; for (let i = L - 6; i < L; i++) { P.S.done = {}; P.S.prog = {}; P.S.strikes = {}; P.S.pins = []; const b = parishBot(i, pol); out[pol].push(b.done ? b.stars : 0); } }
          return out; });
        for (const k in all) all[k].push(...r[k]);
      }
      const naive = [...all.random, ...all.dates];
      ok(naive.filter(x => x <= 1).length / naive.length >= .8, 'naive genealogists do too well: ' + JSON.stringify(all));
      ok(all.simple.every(x => x >= 1), 'a careful reader should finish every late letter: ' + all.simple);
      ok(all.solver.every(x => x === 3), 'the solver should get 3 stars');
      ok(all.simple.filter(x => x === 3).length / all.simple.length < .6, '3 stars should need the right evidence first time: ' + all.simple);
    },
    'later bundles: candidates appear only when pinned; "buried as a child" must cite the burial': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => {
        const P = window.__parish, W = P.W(), C = P.COMS(), R = W.R; let found = null;
        for (let i = 12; i < C.length && !found; i++) C[i].tasks.forEach((k, ti) => { if (found || ti !== C[i].tasks.findIndex(t => t.dep < 0)) return; const d = P.candidates(R, k).find(x => x.id !== k.truth && P.KIND[k.kind].why(R, x, k).includes('dead')); if (d) found = { i, ti, d: d.id }; });
        if (!found) return null;
        P.openLetter(found.i); const out = { pinMode: P.needPins() };
        out.beforePin = P.strike(found.ti, found.d, 'dead', 0);
        P.togglePin(found.d); out.listed = !!document.querySelector(`.cand[data-cand="${found.d}"]`);
        out.noCite = P.strike(found.ti, found.d, 'dead');
        const k = C[found.i].tasks[found.ti], wrongB = R.find(b => b.t === 'D' && !P.isChildBurial(b, R[found.d], R[k.a].d));
        out.badCite = P.strike(found.ti, found.d, 'dead', wrongB.id); out.blots = P.S.wrong[found.i] || 0;
        const pf = P.proofFor(found.ti, found.d); out.good = P.strike(found.ti, found.d, 'dead', pf.cite);
        return out;
      });
      if (!r) return; // this register has no such case in the later bundles
      eq(r.pinMode, true); eq(r.beforePin, null, 'struck an unpinned entry'); ok(r.listed, 'pinned entry not listed');
      eq(r.noCite, null, 'struck without citing'); eq(r.badCite, false); eq(r.blots, 1); eq(r.good, true);
    },
    'not in this register: some letters ask after someone baptised elsewhere; certain, probable and wrong answers': async ({ page, ok, eq }) => {
      let found = null;
      for (const seed of [11, 22, 33, 44, 55, 66]) {
        await withSave(page, { seed, intro: 1 }); await closeModals(page);
        found = await page.evaluate(() => { const C = window.__parish.COMS(); for (let i = 0; i < C.length; i++) { const t = C[i].tasks.findIndex(k => k.absent); if (t >= 0) return { i, t }; } return null; });
        if (found) break;
      }
      ok(found, 'no letter asks after an absent baptism in six registers');
      const r = await page.evaluate(({ i, t }) => {
        const P = window.__parish, W = P.W(), c = P.COMS()[i], out = {}; P.openLetter(i);
        // solve the tasks before it so it is open
        for (let j = 0; j < t; j++) { const k = c.tasks[j]; if (P.S.prog[i][j]) continue; for (const x of P.candidates(W.R, k)) { if (!P.S.pins.includes(x.id)) P.togglePin(x.id); if (x.id !== k.truth) { const pf = P.proofFor(j, x.id); P.strike(j, x.id, pf.code, pf.cite); } } P.confirmTask(j); if (k.absent) P.declareAbsent(j); }
        const k = c.tasks[t]; for (const x of P.candidates(W.R, k)) if (!P.S.pins.includes(x.id)) P.togglePin(x.id);
        const w0 = P.S.wrong[i] || 0; out.prob = P.answerProbably(t, P.candidates(W.R, k)[0].id); out.blots = (P.S.wrong[i] || 0) - w0; out.open = !P.S.prog[i][t];
        for (const x of P.candidates(W.R, k)) { const pf = P.proofFor(t, x.id); P.strike(t, x.id, pf.code, pf.cite); }
        out.left = P.remaining(t).length; out.btn = document.querySelector(`[data-absent="${t}"]`)?.textContent;
        out.done = P.declareAbsent(t) !== false && !!P.S.prog[i][t]; out.marked = !!(P.S.prob[i] || {})[t];
        // a task whose entry IS in the register: "not in this register" costs two blots
        const pi = c.tasks.findIndex((q, j) => !q.absent && (q.kind === 'B' || q.kind === 'C') && !P.S.prog[i][j] && (q.dep < 0 || P.S.prog[i][q.dep]));
        if (pi >= 0) { const w1 = P.S.wrong[i] || 0; P.declareAbsent(pi); out.wrongAbs = (P.S.wrong[i] || 0) - w1; }
        return out;
      }, found);
      eq(r.prob, false); eq(r.blots, 2, 'a wrong "probably" costs two blots'); ok(r.open);
      eq(r.left, 0); ok(/Certain/.test(r.btn), r.btn); ok(r.done, 'certain absent answer'); eq(r.marked, false);
      if (r.wrongAbs !== undefined) eq(r.wrongAbs, 2);
    },
    'answering "probably" early: right marks the reply and costs a star of confidence': async ({ page, eq, ok }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const P = window.__parish, W = P.W(), C = P.COMS();
        const i = C.findIndex((c, ci) => ci < 12 && c.tasks.every(k => !k.absent)); P.openLetter(i); const c = C[i];
        let early = 1; c.tasks.forEach((k, j) => { if (!P.S.prog[i][j]) { if (early) { early = 0; P.answerProbably(j, k.truth); } else { for (const x of P.candidates(W.R, k)) if (x.id !== k.truth) { const pf = P.proofFor(j, x.id); P.strike(j, x.id, pf.code, pf.cite); } P.confirmTask(j); } } });
        return { done: P.S.done[i], p: Object.keys(P.S.prob[i] || {}).length, s: [P.starsFor(0, 0), P.starsFor(0, 1), P.starsFor(1, 1)] }; });
      eq(r.p, 1); eq(r.done, { stars: 2 }); eq(r.s, [3, 2, 1]);
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
        P.COMS().forEach((c, ci) => { P.S.prog[ci] = c.tasks.map(() => 1); c.tasks.forEach((k, ti) => { if (k.absent) return;
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
