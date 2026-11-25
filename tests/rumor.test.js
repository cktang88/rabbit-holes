// Rumor: town generation, the belief model, every goal type, scenario balance, saves and the whisper UI.
const seedRandom = (page, k) => page.evaluate((k) => { let a = k >>> 0; Math.random = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }, k);
// The harness clears localStorage on every navigation; this injects a save that survives the reload (init scripts run in order)
const reloadWith = async (page, key, v) => { await page.addInitScript(([k, val]) => { try { localStorage.setItem(k, val); } catch (e) {} }, [key, v]); await page.reload(); };
// Gossip bots for the difficulty test: idle; random (random ears and stories); greedy (the default story, always to the busiest person);
// competent (a different well-connected ear in each hamlet, with a story chosen for the goal)
const BOT = "window.__rubot=(i, pol, variant)=>{ const R=window.__rumor; RH.modal=()=>Promise.resolve(); RH.toast=()=>{}; R.start(i,null,variant); const T=R.T, P=T.people, c=T.cast, g=R.sc.goal, rng=RH.rng(variant*31+i);\n  const tId=c.T.id, bad=2, good=6, saved=9;\n  const reach=p=>p.chat*p.friends.reduce((s,f)=>s+f[1],0)*(0.4+p.gull);\n  const ears=P.filter(p=>!p.role&&!p.skeptic&&p.id!==tId).sort((a,b)=>reach(b)-reach(a));\n  const byCluster=(k)=>{ const out=[]; const seen=new Set(); for (const p of ears){ if (!seen.has(p.c)){ seen.add(p.c); out.push(p); } } for (const p of ears) if (!out.includes(p)) out.push(p); return out.slice(0,k); };\n  const whisper=(p,v)=>{ R.sel=p.id; R.renderAll(); const go=document.getElementById('cGo'); if (!go) return; document.getElementById('cWho').value=v.who; document.getElementById('cVerb').value=v.neg?'neg':v.verb; document.getElementById('cWhom').value=v.whom; document.getElementById('cPlace').value=v.place; go.click(); };\n  const other=(a)=> P.find(p=>p.id!==a && !p.role).id;\n  let w=0;\n  while (R.day<=R.sc.days){\n    for (let k=0;k<R.sc.w;k++){\n      if (pol==='idle') break;\n      if (pol==='random'){ const p=P[rng.int(P.length)]; whisper(p,{who:tId,verb:rng.int(10),whom:other(tId),place:rng.int(8)}); continue; }\n      if (pol==='greedy'){ whisper(ears[0],{who:tId,verb:0,whom:c.V.id,place:0}); continue; } // the default story, always to the same busiest person\n      // competent: a different well-connected ear in each hamlet, a story chosen for the goal\n      const pool=byCluster(12); const p=pool[(w++)%pool.length]; let v={who:tId,verb:saved===g.verb?saved:4,whom:c.V.id,place:2};\n      if (g.type==='verb') v={who:tId,verb:9,whom:c.V.id,place:2};\n      if (g.type==='reach'&&g.pol>0 || g.type==='redeem') v={who:tId,verb:8,whom:c.V.id,place:2};\n      if (g.type==='redeem' && (R.day<=3 || w%2===0)) v={who:tId,verb:4,whom:0,place:0,neg:true};\n      if (g.type==='double') v= w%2? {who:tId,verb:4,whom:c.V.id,place:2} : {who:c.V.id,verb:8,whom:tId,place:2};\n      if (g.type==='mixed') v= w%2? {who:tId,verb:4,whom:c.V.id,place:2} : {who:c.V.id,verb:4,whom:0,place:0,neg:true};\n      if (g.type==='defend'||g.type==='counter') v= (g.type==='counter'&&w%2)? {who:c.E.id,verb:4,whom:tId,place:2} : {who:tId,verb:4,whom:0,place:0,neg:true};\n      if (g.type==='reconcile'||g.type==='reconcile+'){ const s=w%3; if (s===0 || (g.type==='reconcile' && s===2)){ whisper(c.A,{who:c.B.id,verb:9,whom:c.A.id,place:2}); continue; } if (s===1){ whisper(c.B,{who:c.A.id,verb:9,whom:c.B.id,place:2}); continue; } }\n      if (g.type==='exact') v={who:tId,verb:4,whom:c.V.id,place:2};\n      if (g.type==='pair') v={who:tId,verb:4,whom:c.V.id,place:2};\n      whisper(p,v);\n    }\n    if (R.day>R.sc.days) break; document.getElementById('nextDay').click();\n  }\n  const st=R.goalStatus(); return {i, pol, won: !!R.SAVE.done[i] && R.lastStars>0 && st.ok, stars: st.ok? R.lastStars : 0, v:Math.round(st.v), label:st.label.replace(/<[^>]+>/g,'')};\n};\n";
// Strategies that win the hardest scenarios (Redemption, Kingmaker, Peace and Pitchforks): deny first then seed the good story;
// keep two stories in different hamlets; reconcile the feud and keep it warm before spreading the third story
const SMART = "// smarter goal-aware strategies for the three hardest scenarios; opts tweak the plan\nwindow.__rusmart=(i, variant, opts={})=>{ const R=window.__rumor; RH.modal=()=>Promise.resolve(); RH.toast=()=>{}; R.start(i,null,variant); const T=R.T, P=T.people, c=T.cast, g=R.sc.goal;\n  const tId=c.T.id; const reach=p=>p.chat*p.friends.reduce((s,f)=>s+f[1],0)*(0.4+p.gull);\n  const whisper=(p,v)=>{ R.sel=p.id; R.renderAll(); const go=document.getElementById('cGo'); if (!go) return false; document.getElementById('cWho').value=v.who; document.getElementById('cVerb').value=v.neg?'neg':v.verb; document.getElementById('cWhom').value=v.whom; document.getElementById('cPlace').value=v.place; go.click(); return true; };\n  const usable=(p,excl=[])=>!p.role&&!p.skeptic&&!excl.includes(p.id);\n  const pick=(f,excl=[],used=new Set())=>P.filter(p=>usable(p,excl)&&f(p)&&!used.has(p.id)).sort((a,b)=>reach(b)-reach(a))[0];\n  const used=new Set(); let w=0;\n  while (R.day<=R.sc.days){\n    for (let k=0;k<R.sc.w;k++){ w++;\n      if (g.type==='redeem'){\n        const st=R.goalStatus(); const goodV={who:tId,verb:opts.goodVerb??9,whom:c.V.id,place:2};\n        // deny to the busiest believers of the bad story; seed the good story with busy people who have heard nothing\n        const denyFirst = opts.denyDays? R.day<=opts.denyDays : (w%2===0);\n        let p= denyFirst? pick(q=>R.believesBad(q,tId),[tId],used) : pick(q=>!q.belief,[tId],used) || pick(q=>q.belief&&q.belief.neg,[tId],used);\n        if (!p) p=pick(()=>true,[tId],used); used.add(p.id); if (used.size>40) used.clear();\n        whisper(p, denyFirst? {who:tId,verb:4,whom:0,place:0,neg:true} : goodV); continue; }\n      if (g.type==='double'){\n        // keep the two stories in different hamlets so they don't overwrite each other\n        const half= (opts.split? opts.split(w) : w%2); const cl=P.reduce((m,p)=>Math.max(m,p.c),0)+1; const myC= half? [0] : [...Array(cl).keys()].filter(x=>x!==0);\n        const p=pick(q=>myC.includes(q.c)&&!q.belief,[tId,c.V.id],used)||pick(q=>myC.includes(q.c),[tId,c.V.id],used)||pick(()=>true,[tId,c.V.id],used); used.add(p.id); if (used.size>30) used.clear();\n        whisper(p, half? {who:c.V.id,verb:opts.goodVerb??8,whom:tId,place:2} : {who:tId,verb:4,whom:c.V.id,place:2}); continue; }\n      if (g.type==='reconcile+'){\n        const A=c.A, B=c.B; const aOk=R.believesGood(P[A.id],B.id), bOk=R.believesGood(P[B.id],A.id);\n        const weak=(q,o)=>!R.believesGood(q,o) || q.str<(opts.keep??0.5);\n        if (weak(P[A.id],B.id) && !(k===2 && R.believesGood(P[A.id],B.id))){ whisper(A,{who:B.id,verb:9,whom:A.id,place:2}); continue; }\n        if (weak(P[B.id],A.id) && !(k===2 && R.believesGood(P[B.id],A.id))){ whisper(B,{who:A.id,verb:9,whom:B.id,place:2}); continue; }\n        const p=pick(q=>!q.belief || !R.believesBad(q,tId),[tId,A.id,B.id],used)||pick(()=>true,[tId],used); used.add(p.id); if (used.size>40) used.clear();\n        whisper(p,{who:tId,verb:4,whom:c.V.id,place:2}); continue; }\n    }\n    if (R.day>R.sc.days) break; const before=R.day; document.getElementById('nextDay').click(); if (R.day===before) break;\n  }\n  const st=R.goalStatus(); return {won: st.ok, v:Math.round(st.v), label:st.label.replace(/<[^>]+>/g,'').slice(0,80), stars:R.lastStars};\n};\n";
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
          if (m.who === m.whom) bad.push('self ' + JSON.stringify(m)); if (!(m.verb >= 0 && m.verb < R.VERBS.length) || !(m.place >= -1 && m.place < 8) || !P[m.who] || !P[m.whom]) bad.push('index ' + JSON.stringify(m));
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
        const play = (i, act, k) => { R.start(i, null, k + 1); const tId = R.T.cast.T.id;
          while (R.day <= R.sc.days) { if (act) for (let k = 0; k < R.sc.w; k++) { const c = R.T.people.filter(p => p.id !== tId && !(p.belief && p.belief.neg)).sort((a, b) => (R.believesBad(b, tId) - R.believesBad(a, tId)) || b.chat * b.friends.length - a.chat * a.friends.length)[0]; R.hear(c, { who: tId, verb: 4, whom: 0, place: 0, neg: true }, 0.9, null); }
            R.simDay(); R.day = R.day + 1; }
          return R.goalStatus().ok; };
        for (const i of [10, 11, 13, 14]) { let idle = 0, act = 0; for (let k = 0; k < 15; k++) { idle += play(i, false, k); act += play(i, true, k); } out[R.SC[i].n] = [idle, act]; }
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
    'a lost scenario explains what went wrong as a principle, not a name to copy': async ({ page, ok }) => {
      const m = await page.evaluate(() => { const R = window.__rumor; R.start(2); R.T.people.forEach(p => p.belief = null); while (!document.getElementById('nextDay').disabled) document.getElementById('nextDay').click(); return window.__lastModal; });
      ok(/moved on/.test(m) && /(hamlet|ear|bridge|starting points)/.test(m) && !/Hint: <b>/.test(m), m);
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
        await reloadWith(page, 'rh:rumor', bad); await page.waitForFunction(() => window.__rumor && window.__rumor.T);
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
    'repeatable: the same whispers on Restart give exactly the same town afterwards': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const R = window.__rumor; const play = () => { R.start(2); const P = R.T.people, t = R.T.cast.T.id; const ears = P.filter(p => p.id !== t && !p.role).slice(0, 3);
          for (const e of ears.slice(0, 2)) { R.sel = e.id; R.renderAll(); document.getElementById('cVerb').value = '2'; document.getElementById('cGo').click(); }
          for (let d = 0; d < 4; d++) document.getElementById('nextDay').click(); return JSON.stringify(R.T.people.map(p => p.belief && [p.belief.who, p.belief.verb, p.belief.whom, p.belief.place, Math.round(p.str * 100)])); };
        const a = play(), b = play(); R.start(2); return [a === b, a.length]; });
      eq(r[0], true); ok(r[1] > 100);
    },
    'who told whom: a believer shows the chain back to your whisper, with the teller who changed it': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const R = window.__rumor; R.start(0); const P = R.T.people; const t = R.T.cast.T.id;
        const [a, b, c] = P.filter(p => p.id !== t && !p.role && !p.skeptic); const v = { who: t, verb: 2, whom: (t + 1) % P.length, place: 0 };
        a.belief = { ...v }; a.str = 1; a.via = -1; b.belief = { ...v, place: 3 }; b.str = 1; b.via = a.id; b.changedAt = a.id; c.belief = { ...v, place: 3 }; c.str = 1; c.via = b.id; c.changedAt = null;
        return R.chainOf(c); });
      ok(/You → .+ → .+changed by.+ → /.test(r), r);
    },
    'every villager has a unique name, so the whisper dropdown is unambiguous': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const R = window.__rumor, bad = []; R.SC.forEach((sc, i) => { const T = R.buildTown(sc, 1000 + i * 17); const n = T.people.map(p => p.name); if (new Set(n).size !== n.length) bad.push(i); }); const T = R.buildTown({ ...R.SC[0], N: 120 }, 5); if (new Set(T.people.map(p => p.name)).size !== 120) bad.push('120'); return bad; });
      ok(!bad.length, 'duplicate names in ' + bad);
    },
    'whispering a story someone already believes says so, instead of "didn\'t believe you"': async ({ page, ok }) => {
      const m = await page.evaluate(() => { const R = window.__rumor; R.start(0); const t = R.T.cast.T.id; const p = R.T.people.find(q => q.id !== t && !q.role && !q.skeptic);
        R.sel = p.id; R.renderAll(); const verb = document.getElementById('cVerb').value, whom = +document.getElementById('cWhom').value, place = +document.getElementById('cPlace').value, who = +document.getElementById('cWho').value;
        p.belief = { who, verb: +verb, whom, place }; p.str = 0.9; document.getElementById('cGo').click(); return R.log[0]; });
      ok(/already believes/.test(m), m);
    },
    'difficulty: in the last third naive gossip never wins; a goal-aware spreading strategy often does, but only at one star': async ({ page, ok }) => {
      await page.addScriptTag({ content: BOT });
      const r = await page.evaluate(() => { const out = []; for (const i of [17, 18, 21, 22, 24]) for (const pol of ['idle', 'random', 'greedy', 'competent']) for (const v of [1, 2]) { window.__rumor.SAVE.done = {}; const x = window.__rubot(i, pol, v); out.push([i, pol, x.won, x.stars]); } return out; });
      const naive = r.filter(x => x[1] !== 'competent'), comp = r.filter(x => x[1] === 'competent');
      ok(naive.filter(x => x[2]).length <= naive.length * 0.2, 'naive wins ' + JSON.stringify(naive.filter(x => x[2])));
      ok(comp.filter(x => x[2]).length >= comp.length * 0.4, 'competent wins ' + JSON.stringify(comp));
      ok(comp.every(x => x[3] < 3), 'three stars need better than the simple strategy: ' + JSON.stringify(comp));
    },
    'the hardest scenarios are winnable: an encoded strategy wins Redemption, Kingmaker and Peace and Pitchforks most of the time; naive play never does': async ({ page, ok }) => {
      await page.addScriptTag({ content: SMART }); await page.addScriptTag({ content: BOT });
      const r = await page.evaluate(() => { const smart = { 19: {}, 20: { split: w => w % 3 !== 0, goodVerb: 9 }, 23: { keep: 0.7 } }, out = {};
        for (const i of [19, 20, 23]) { const row = { smart: 0, naive: 0 }; for (let v = 1; v <= 6; v++) { window.__rumor.SAVE.done = {}; if (window.__rusmart(i, v, smart[i]).won) row.smart++; for (const pol of ['idle', 'random', 'greedy']) { window.__rumor.SAVE.done = {}; if (window.__rubot(i, pol, v).won) row.naive++; } } out[i] = row; } return out; });
      for (const [i, row] of Object.entries(r)) { ok(row.smart >= 4, `scenario ${i}: strategy won ${row.smart}/6`); ok(row.naive === 0, `scenario ${i}: naive won ${row.naive}/18`); }
    },
    'no scenario is unwinnable: an encoded strategy wins every one of the 25 in at least one of four towns of chance': async ({ page, ok }) => {
      await page.addScriptTag({ content: SMART }); await page.addScriptTag({ content: BOT });
      const bad = await page.evaluate(() => { const bad = []; const R = window.__rumor; for (let i = 0; i < R.SC.length; i++) { let w = 0; for (let v = 1; v <= 4 && !w; v++) { R.SAVE.done = {}; const x = i === 19 ? window.__rusmart(i, v, {}) : window.__rubot(i, 'competent', v); if (x.won) w++; }
          if (!w && i === 1) { for (let v = 1; v <= 8 && !w; v++){ R.start(1, null, v); const M = R.T.people[R.T.roleOf.mayor], tid = R.T.cast.T.id, cf = M.friends.map(f => R.T.people[f[0]]); while (R.day <= R.sc.days && !R.goalStatus().ok) { for (let k = 0; k < R.sc.w; k++) R.hear(cf[k % cf.length], { who: tid, verb: 4, whom: (tid + 1) % R.T.people.length, place: 0 }, 0.9, null); R.simDay(); R.day = R.day + 1; } if (R.goalStatus().ok) w++; } }
          if (!w) bad.push(i + ' ' + R.SC[i].n); } return bad; });
      ok(!bad.length, 'no winning strategy found for: ' + bad.join(', '));
    },
    'stories sharpen, level and assimilate as they pass, and the family tree shows which version grew from which': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const R = window.__rumor; R.start(0); const P = R.T.people, r = RH.rng(3), V = R.VERBS; const t = R.T.cast.T.id;
        const chatty = P.find(p => p.chat > 0.6 && p.id !== t), quiet = P.find(p => p.chat < 0.4 && p.id !== t); const base = { who: t, verb: 0, whom: R.T.cast.V.id, place: 2 };
        const hows = new Set(); let sharperUp = 0, sharperDown = 0;
        const grudge = P.find(p => p.rivals.some(x => x !== base.whom) && p.id !== t); for (let k = 0; k < 900; k++) { const m = R.mutate(base, [chatty, quiet, grudge][k % 3], r); if (m.how) hows.add(m.how); if (m.how === 'sharpened') { if (V[m.verb][2] > V[base.verb][2]) sharperUp++; else sharperDown++; } }
        // tree: a child version under its parent
        P.forEach(p => p.belief = null); const child = { ...base, verb: 2, how: 'sharpened' }; R.noteVersion(child, base);
        P.slice(0, 5).forEach(p => { p.belief = { ...base }; p.str = 1; }); P.slice(5, 8).forEach(p => { p.belief = { ...child }; p.str = 1; });
        const tree = R.versionTree();
        return { hows: [...hows].sort(), sharperUp, sharperDown, tree: tree.map(x => [x.depth, x.n, x.how]) }; });
      ok(['assimilated', 'levelled', 'sharpened'].every(h => r.hows.includes(h)), JSON.stringify(r.hows)); ok(r.sharperUp > 0 && r.sharperDown === 0, 'sharpening only ever makes it worse');
      eq(r.tree.slice(0, 2), [[0, 5, null], [1, 3, 'sharpened']]);
    },
    'touch, portrait phone: friend links are big enough to tap (40px), selects use 16px text, and a tap on a friend opens them': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await page.waitForTimeout(300);
      await page.evaluate(() => { const R = window.__rumor; R.sel = R.T.people.find(p => p.friends.length >= 2 && !p.role).id; R.renderAll(); document.querySelector('#person [data-p]').scrollIntoView({ block: 'center' }); });
      const r = await page.evaluate(() => ({ coarse: matchMedia('(pointer:coarse)').matches, links: [...document.querySelectorAll('#person [data-p]')].map(a => { const b = a.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }), sel: getComputedStyle(document.getElementById('cVerb')).fontSize }));
      ok(r.coarse, 'touch emulation should report a coarse pointer'); ok(r.links.length && r.links.every(([w, h]) => h >= 40 && w >= 40), JSON.stringify(r.links)); eq(r.sel, '16px');
      const t = await page.evaluate(() => { const a = document.querySelector('#person [data-p]'), b = a.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, +a.dataset.p]; });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t[0], y: t[1] }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(200);
      eq(await page.evaluate(() => window.__rumor.sel), t[2]);
    },
    'newcomer clarity: the goal states the pass mark and the day, the tick is labelled, and ending a day with whispers unused warns that they don\'t carry over': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const R = window.__rumor; R.start(0); const toasts = []; RH.toast = (m) => toasts.push(m);
        const goal = document.getElementById('goal'); const line = goal.querySelector('.target').textContent, tick = goal.querySelector('.tick').textContent, pill = document.getElementById('wP').textContent;
        document.getElementById('nextDay').click(); return { line, tick, pill, toasts, day: R.day }; });
      ok(/40%/.test(r.line) && /day 7/.test(r.line), r.line); ok(/40%/.test(r.tick), r.tick); ok(/today/.test(r.pill), r.pill);
      ok(r.toasts.some(t => /unused.*don't carry over/.test(t)), JSON.stringify(r.toasts)); ok(r.day === 2, 'the warning never blocks the day');
    },
    'mobile layout: no horizontal scroll, town and Next day visible': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cv: document.getElementById('cv').getBoundingClientRect().toJSON(), nd: document.getElementById('nextDay').getBoundingClientRect().toJSON() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.width >= 380 && r.cv.height >= 300, 'canvas ' + JSON.stringify(r.cv)); ok(r.nd.right <= 390 && r.nd.top >= 0, 'next day ' + JSON.stringify(r.nd));
    },
  },
};
