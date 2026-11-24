// Rumor: town generation, the belief model, every goal type, scenario balance, saves and the whisper UI.
const seedRandom = (page, k) => page.evaluate((k) => { let a = k >>> 0; Math.random = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }, k);
module.exports = {
  page: 'rumor/index.html',
  ready: async (page) => { await page.waitForFunction(() => window.__rumor && window.__rumor.T); await page.evaluate(() => { document.querySelectorAll('.modal-bg').forEach(m => m.remove()); RH.modal = (h) => { window.__lastModal = h; return Promise.resolve(); }; }); },
  tests: {
    'towns are deterministic, friendships symmetric, the mayor listens to at most two, and the cast is distinct': async ({ page, ok, eq }) => {
      const bad = await page.evaluate(() => {
        const R = window.__rumor, bad = [];
        R.SC.forEach((spec, i) => {
          const A = R.buildTown(spec, 1000 + i * 17), B = R.buildTown(spec, 1000 + i * 17);
          if (JSON.stringify(A.people.map(p => [p.name, p.friends])) !== JSON.stringify(B.people.map(p => [p.name, p.friends]))) bad.push(i + ' nondeterministic');
          if (A.people.length !== spec.N) bad.push(i + ' size');
          for (const p of A.people) for (const [j] of p.friends) { if (j === p.id) bad.push(i + ' self-friend'); if (!A.people[j].friends.some(f => f[0] === p.id)) bad.push(i + ' asymmetric ' + p.id + '-' + j); }
          if (A.people[A.roleOf.mayor].friends.length > 2 || !A.people[A.roleOf.mayor].friends.length) bad.push(i + ' mayor friends');
          const c = A.cast; if (c.T === c.V || c.E === c.T || c.E === c.V || c.E === c.F || c.T.role || c.T.skeptic) bad.push(i + ' cast');
          if (spec.feud && (!c.A || !c.B || c.A === c.B)) bad.push(i + ' feud cast');
        });
        return bad;
      });
      ok(!bad.length, bad.slice(0, 8).join(', '));
    },
    'every scenario description is filled in (no {placeholders} or undefined names)': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const R = window.__rumor, bad = []; for (let i = 0; i < R.SC.length; i++) { R.start(i); const d = document.getElementById('goal').innerText; if (/[{}]|undefined|NaN/.test(d)) bad.push(i + ': ' + d.slice(0, 80)); } return bad; });
      ok(!bad.length, bad.join(' | '));
    },
    'belief model: no self-slander, skeptics flip to denial, repeats reinforce, rivals are hard to convince': async ({ page, eq, ok }) => {
      await seedRandom(page, 3);
      const r = await page.evaluate(() => {
        const R = window.__rumor; R.start(0); const P = R.T.people, t = R.T.cast.T;
        const v = { who: t.id, verb: 2, whom: R.T.cast.V.id, place: 1 };
        const self = R.hear(t, v, 1, null);
        const sk = P.find(p => p !== t); sk.skeptic = true; sk.belief = null; R.hear(sk, v, 1, null); const skNeg = !!sk.belief.neg; sk.skeptic = false;
        const q = P.find(p => p !== t && p !== sk && !p.skeptic); q.belief = { ...v }; q.str = 0.3; const again = R.hear(q, v, 0.5, null);
        let friendly = 0, rival = 0; const from = P.find(p => p !== t && p !== q && !p.skeptic);
        for (let k = 0; k < 400; k++) { q.belief = null; q.rivals = []; if (R.hear(q, v, 0.6, from)) friendly++; q.belief = null; q.rivals = [from.id]; if (R.hear(q, v, 0.6, from)) rival++; }
        return { self, tBelief: t.belief, skNeg, again, str: q.str, friendly, rival };
      });
      eq(r.self, false); eq(r.tBelief, null); eq(r.skNeg, true); eq(r.again, false);
      ok(r.friendly > r.rival * 3, `friends ${r.friendly} vs rivals ${r.rival}`);
    },
    'mutation keeps stories well-formed: valid indices, never "X did it to X", denials never change': async ({ page, ok }) => {
      await seedRandom(page, 9);
      const bad = await page.evaluate(() => {
        const R = window.__rumor; R.start(4); const P = R.T.people, r = RH.rng(5), bad = [];
        for (let k = 0; k < 3000; k++) { const teller = P[k % P.length]; const who = P[(k * 7) % P.length].id; let whom = P[(k * 11 + 1) % P.length].id; if (whom === who) whom = (who + 1) % P.length;
          const v = { who, verb: k % R.VERBS.length, whom, place: k % 8 }; const m = R.mutate(v, teller, r);
          if (m.who === m.whom) bad.push('self ' + JSON.stringify(m)); if (!(m.verb >= 0 && m.verb < R.VERBS.length) || !(m.place >= 0 && m.place < 8) || !P[m.who] || !P[m.whom]) bad.push('index ' + JSON.stringify(m));
          const n = R.mutate({ ...v, neg: true }, teller, r); if (!R.sameV(n, { ...v, neg: true })) bad.push('neg changed'); }
        return bad;
      });
      ok(!bad.length, bad.slice(0, 5).join(', '));
    },
    'goal scoring for every goal type, at and around the thresholds': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const R = window.__rumor, out = {};
        const bad = (p, who, whom) => { p.belief = { who, verb: 2, whom: whom ?? ((who + 1) % R.T.people.length), place: 0 }; p.str = 0.8; };
        const good = (p, who, verb = 6) => { p.belief = { who, verb, whom: (who + 1) % R.T.people.length, place: 0 }; p.str = 0.8; };
        const fill = (n, fn, excl = []) => { R.T.people.forEach(p => { p.belief = null; }); let k = 0; for (const p of R.T.people) { if (k >= n) break; if (excl.includes(p.id)) continue; fn(p); k++; } };
        // reach 40% on 50 people (T excluded => 49): 20 people is 40.8%, 19 is 38.8%
        R.start(0); let t = R.T.cast.T.id; fill(19, p => bad(p, t), [t]); out.reach19 = R.goalStatus().ok; fill(20, p => bad(p, t), [t]); out.reach20 = R.goalStatus().ok;
        fill(30, p => { bad(p, t); p.str = 0.1; }, [t]); out.faint = R.goalStatus().ok; // half-remembered stories don't count
        R.start(1); t = R.T.cast.T.id; const m = R.T.people[R.T.roleOf.mayor]; m.belief = null; out.ear0 = !!R.goalStatus().ok; bad(m, t); out.ear1 = R.goalStatus().ok;
        R.start(3); out.exactNone = R.goalStatus().ok;
        R.start(5); t = R.T.cast.T.id; const F = R.T.cast.F.id; fill(40, p => bad(p, t), [t, F]); out.shieldOk = R.goalStatus().ok; good(R.T.people[F], R.T.cast.V.id); const sh = R.goalStatus(); out.shieldFail = [sh.ok, !!sh.fail];
        R.start(7); t = R.T.cast.T.id; const V = R.T.cast.V.id; fill(40, p => bad(p, t, (t + 1) % R.T.people.length === V ? (t + 2) % R.T.people.length : (t + 1) % R.T.people.length), [t, V]); out.pairWrong = R.goalStatus().ok; fill(40, p => bad(p, t, V), [t, V]); out.pairRight = R.goalStatus().ok;
        R.start(10); t = R.T.cast.T.id; // 60 people, T excluded: 11/59 = 18.6%, 12/59 = 20.3%
        fill(11, p => bad(p, t), [t]); out.defend11 = R.goalStatus().ok; fill(12, p => bad(p, t), [t]); out.defend12 = R.goalStatus().ok;
        R.start(15); const A = R.T.cast.A, B = R.T.cast.B; R.T.people.forEach(p => p.belief = null); good(A, B.id); out.rec1 = !!R.goalStatus().ok; good(B, A.id); out.rec2 = R.goalStatus().ok;
        R.start(17); t = R.T.cast.T.id; fill(30, p => good(p, t, 6), [t]); out.verbHelped = R.goalStatus().ok; fill(30, p => good(p, t, 9), [t]); out.verbSaved = R.goalStatus().ok;
        return out;
      });
      eq(r, { reach19: false, reach20: true, faint: false, ear0: false, ear1: true, exactNone: false, shieldOk: true, shieldFail: [false, true], pairWrong: false, pairRight: true, defend11: true, defend12: false, rec1: false, rec2: true, verbHelped: false, verbSaved: true });
    },
    'defence scenarios cannot be won by just pressing Next day, but a player who denies the lie usually wins': async ({ page, ok }) => {
      await seedRandom(page, 77);
      const r = await page.evaluate(() => {
        const R = window.__rumor, out = {};
        const play = (i, act) => { R.start(i); const tId = R.T.cast.T.id;
          while (R.day <= R.sc.days) { if (act) for (let k = 0; k < R.sc.w; k++) { const c = R.T.people.filter(p => p.id !== tId && !(p.belief && p.belief.neg)).sort((a, b) => (R.believesBad(b, tId) - R.believesBad(a, tId)) || b.chat * b.friends.length - a.chat * a.friends.length)[0]; R.hear(c, { who: tId, verb: 4, whom: 0, place: 0, neg: true }, 0.9, null); }
            R.simDay(); R.day = R.day + 1; }
          return R.goalStatus().ok; };
        for (const i of [10, 11, 13, 14]) { let idle = 0, act = 0; for (let k = 0; k < 15; k++) { idle += play(i, false); act += play(i, true); } out[R.SC[i].n] = [idle, act]; }
        return out;
      });
      for (const [n, [idle, act]] of Object.entries(r)) { ok(idle <= 5, `${n}: idle play won ${idle}/15`); ok(act >= 9, `${n}: denying won only ${act}/15`); }
    },
    'a scenario runs exactly its number of days, logs each day once, then records the win and progress': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const R = window.__rumor; R.start(0); let clicks = 0; R.T.people.forEach(p => p.belief = null);
        while (!document.getElementById('nextDay').disabled && clicks < 50) { document.getElementById('nextDay').click(); clicks++; }
        const heads = R.log.filter(l => /— Day/.test(l)); const dup = heads.length !== new Set(heads).size;
        // now a won run: everyone believes it before the day ends
        R.start(0); const t = R.T.cast.T.id; R.T.people.forEach(p => { if (p.id !== t) { p.belief = { who: t, verb: 2, whom: (t + 1) % R.T.people.length, place: 0 }; p.str = 1; } });
        document.getElementById('nextDay').click();
        return { clicks, days: R.sc.days, dup, done: R.SAVE.done[0], hub: JSON.parse(localStorage.getItem('rh:hub')).rumor, disabled: document.getElementById('nextDay').disabled, modal: window.__lastModal };
      });
      eq(r.clicks, r.days); eq(r.dup, false); eq(r.done, 1); ok(r.hub > 0 && r.hub <= 1, 'hub ' + r.hub); eq(r.disabled, true); ok(/Village Gazette/.test(r.modal) && /class="big"/.test(r.modal), 'the win prints a gazette front page');
    },
    'a lost scenario explains why and names a promising first ear': async ({ page, ok }) => {
      const m = await page.evaluate(() => { const R = window.__rumor; R.start(2); R.T.people.forEach(p => p.belief = null); while (!document.getElementById('nextDay').disabled) document.getElementById('nextDay').click(); return window.__lastModal; });
      ok(/moved on/.test(m) && /Hint: <b>/.test(m), m);
    },
    'whispers: cannot exceed the daily allowance by spamming the button, and none after the end': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const R = window.__rumor; R.start(0); R.sel = R.T.people.find(p => p !== R.T.cast.T).id; R.renderAll();
        for (let k = 0; k < 6; k++) { const b = document.getElementById('cGo'); b.disabled = false; b.click(); }
        const w = R.wLeft; R.day = R.sc.days + 1; R.renderAll(); return [w, !!document.getElementById('cGo')];
      });
      eq(r, [0, false]);
    },
    'locked scenarios cannot be opened; corrupted saves load safely': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const R = window.__rumor; document.querySelector('.sc[data-i="7"]').click(); return [R.sc.n, R.scenOpen(7), R.cleanSave(null), R.cleanSave({ done: { 3: 1, 99: 1, x: 1 }, cur: 50, endless: 'lots' })]; });
      eq(r[0], 'Village Talk'); eq(r[1], false); eq(r[2], { done: {}, cur: 0, endless: 0 }); eq(r[3], { done: { 3: 1 }, cur: 0, endless: 0 });
      for (const bad of ['{oops', 'null', '[]', '{"done":"x","cur":"3"}', '{"done":{},"cur":12}']) {
        await page.evaluate((v) => localStorage.setItem('rh:rumor', v), bad); await page.reload(); await page.waitForFunction(() => window.__rumor && window.__rumor.T);
        eq(await page.evaluate(() => window.__rumor.sc.n), 'Village Talk', bad);
      }
    },
    'endless town names are shown as text, not HTML, and clipped': async ({ page, eq, ok }) => {
      await page.fill('#eSeed', '<img src=x onerror="window.__pwned=1">' + 'z'.repeat(80)); await page.click('#eGo'); await page.waitForTimeout(100);
      const r = await page.evaluate(() => [!!window.__pwned, document.querySelectorAll('#goal img').length, window.__rumor.sc.n.length]);
      eq(r.slice(0, 2), [false, 0]); ok(r[2] < 80, 'name length ' + r[2]);
    },
    'clicking a person on the canvas selects them and shows the composer': async ({ page, eq }) => {
      const pos = await page.evaluate(() => { const R = window.__rumor, p = R.T.people[5], r = document.getElementById('cv').getBoundingClientRect(); return [r.left + p.x * R.view.s + R.view.ox, r.top + p.y * R.view.s + R.view.oy]; });
      await page.mouse.click(pos[0], pos[1]);
      eq(await page.evaluate(() => [window.__rumor.sel, !!document.getElementById('cGo')]), [5, true]);
    },
    "The Mayor's Ear: the mayor never takes a stranger's whisper, but listens to a confidant": async ({ page, ok, eq }) => {
      await seedRandom(page, 21);
      const r = await page.evaluate(() => {
        const R = window.__rumor; R.start(1); const m = R.T.people[R.T.roleOf.mayor], t = R.T.cast.T.id, v = { who: t, verb: 4, whom: (t + 1) % R.T.people.length, place: 0 };
        let direct = 0; for (let k = 0; k < 300; k++) { m.belief = null; if (R.hear(m, v, 0.9, null)) direct++; }
        const conf = R.T.people[m.friends[0][0]]; let via = 0; for (let k = 0; k < 300; k++) { m.belief = null; if (R.hear(m, v, 0.9, conf)) via++; }
        R.sel = m.id; R.renderAll(); const ui = [!!document.getElementById('cGo'), document.querySelectorAll('#person .note [data-p]').length];
        // a naive player who only ever whispers to the mayor's confidants
        let wins = 0, directWins = 0;
        for (let k = 0; k < 20; k++) { R.start(1); const M = R.T.people[R.T.roleOf.mayor], tid = R.T.cast.T.id; const cf = M.friends.map(f => R.T.people[f[0]]);
          while (R.day <= R.sc.days && !R.goalStatus().ok) { for (let w = 0; w < R.sc.w; w++) R.hear(cf[w % cf.length], { who: tid, verb: 4, whom: (tid + 1) % R.T.people.length, place: 0 }, 0.9, null); R.simDay(); R.day = R.day + 1; } wins += !!R.goalStatus().ok;
          R.start(1); while (R.day <= R.sc.days && !R.goalStatus().ok) { R.hear(R.T.people[R.T.roleOf.mayor], { who: R.T.cast.T.id, verb: 4, whom: 0, place: 0 }, 0.9, null); R.simDay(); R.day = R.day + 1; } directWins += !!R.goalStatus().ok; }
        return { direct, via, ui, wins, directWins };
      });
      eq(r.direct, 0); ok(r.via > 50, 'a confidant convinces the mayor sometimes: ' + r.via); eq(r.ui[0], false, 'no whisper button for the mayor'); ok(r.ui[1] >= 1, 'the note names the confidants');
      ok(r.wins >= 4, 'working through confidants wins ' + r.wins + '/20'); eq(r.directWins, 0);
    },
    'the gazette prints the most repeated version each day and notices when it has drifted': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const R = window.__rumor; R.start(0); const P = R.T.people, t = R.T.cast.T.id; P.forEach(p => p.belief = null);
        const a = { who: t, verb: 2, whom: (t + 1) % P.length, place: 3 }, b = { ...a, place: 5 };
        P.slice(0, 10).forEach(p => { p.belief = { ...a }; p.str = 0.9; }); P.slice(10, 14).forEach(p => { p.belief = { ...b }; p.str = 0.9; }); P[20].belief = { ...a, neg: true }; P[20].str = 0.9;
        const top = R.topStory(); return { same: R.sameV(top.v, a), pct: top.pct, neg: top.negPct, n: P.length };
      });
      eq(r.same, true); ok(Math.abs(r.pct - 1000 / r.n) < 1e-9 && Math.abs(r.neg - 100 / r.n) < 1e-9, JSON.stringify(r));
      await page.evaluate(() => { const R = window.__rumor; R.start(0); const t = R.T.cast.T.id; R.sel = R.T.people.find(p => p.id !== t && !p.role).id; R.renderAll(); document.getElementById('cVerb').value = '3'; document.getElementById('cGo').click(); });
      await page.click('#nextDay');
      const g = await page.evaluate(() => [document.getElementById('gazette').className, document.getElementById('gazette').textContent, document.getElementById('cVerb') ? document.getElementById('cVerb').value : 'none']);
      ok(/on/.test(g[0]) && /Village Gazette/.test(g[1]) && /Day 2/.test(g[1]), g[1]);
    },
    'the whisper form remembers your last story so repeating it is one click': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const R = window.__rumor; R.start(3); const P = R.T.people, t = R.T.cast.T.id; const ears = P.filter(p => p.id !== t && !p.role);
        R.sel = ears[0].id; R.renderAll(); document.getElementById('cVerb').value = '5'; document.getElementById('cPlace').value = '6'; document.getElementById('cGo').click();
        R.sel = ears[1].id; R.renderAll(); return [document.getElementById('cVerb').value, document.getElementById('cPlace').value]; });
      eq(r, ['5', '6']);
    },
    'mobile layout: no horizontal scroll, town and Next day visible': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cv: document.getElementById('cv').getBoundingClientRect().toJSON(), nd: document.getElementById('nextDay').getBoundingClientRect().toJSON() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.width >= 380 && r.cv.height >= 300, 'canvas ' + JSON.stringify(r.cv)); ok(r.nd.right <= 390 && r.nd.top >= 0, 'next day ' + JSON.stringify(r.nd));
    },
  },
};
