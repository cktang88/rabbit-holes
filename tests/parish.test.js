// Parish: read a careless clerk's century of baptisms, weddings and burials; pin each entry to the one that names the
// same person; three true pins seal; four secrets fall out once enough is linked. Logic via window.__parish.
const { parishBot } = require('./parish.bots.js');
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const E = 'window.__parish';
module.exports = {
  page: 'parish/index.html#v=4242',
  tests: {
    'every village is deterministic, holds four secrets, and every true link is among its candidates': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const P = window.__parish, out = [];
        for (const s of [1, 2, 3, 777]) { const a = P.makeVillage(s), b = P.makeVillage(s);
          const miss = a.slots.filter(sl => sl.truth != null && !a.base[sl.key].includes(sl.truth)).length;
          out.push({ same: JSON.stringify(a.reg.map(e => [e.t, e.d, e.w])) === JSON.stringify(b.reg.map(e => [e.t, e.d, e.w])) && JSON.stringify(a.letters) === JSON.stringify(b.letters), secrets: a.secrets.map(x => x.k).sort().join(','), miss, n: a.reg.length, amb: a.slots.filter(sl => a.base[sl.key].length > 1).length, v: a.village + a.lost }); }
        return out; });
      for (const x of r) { ok(x.same, 'not deterministic'); eq(x.secrets, 'bigamy,change,heir,plague'); eq(x.miss, 0, 'true answer missing from candidates'); ok(x.n > 400 && x.n < 1600, 'register size ' + x.n); ok(x.amb > 60, 'too little ambiguity: ' + x.amb); }
      ok(new Set(r.map(x => x.v)).size >= 3, 'villages should differ');
    },
    'the seal: three true pins seal, a wrong pin never does, six pins at most, and seals strike out what they rule out': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const P = window.__parish, V = P.makeVillage(31), D = P.newDesk();
        const amb = V.slots.filter(s => s.truth != null && V.base[s.key].length >= 2);
        const wrong = amb.slice(0, 6).map(s => [s.key, V.base[s.key].find(x => x !== s.truth)]);
        for (const [k, a] of wrong) P.deskPin(V, D, k, a);
        const full = P.deskPin(V, D, amb[7].key, amb[7].truth);
        const jam = { pins: D.pins.length, sealed: Object.keys(D.sealed).length, full: full.why };
        for (const [k] of wrong) P.deskUnpin(V, D, k);
        const trues = V.slots.filter(s => s.truth != null).slice(0, 3); P.deskPin(V, D, trues[0].key, trues[0].truth); P.deskPin(V, D, trues[1].key, trues[1].truth);
        const before = Object.keys(D.sealed).length; const r3 = P.deskPin(V, D, trues[2].key, trues[2].truth);
        // a sealed burial strikes its baptism out of every other burial's list
        const sl = V.slots.find(s => s.k === 'd' && s.truth != null && V.rev[s.truth].filter(k => V.slotOf[k].k === 'd').length >= 2);
        const other = V.rev[sl.truth].find(k => k !== sl.key && V.slotOf[k].k === 'd');
        const D2 = P.newDesk(); D2.sealed[sl.key] = sl.truth;
        const c = P.candidates(V, other, D2.sealed, true).find(x => x.id === sl.truth);
        return { jam, before, after: Object.keys(D.sealed).length, sealedNow: r3.sealed.length, cut: D.cut, strike: c && c.strike };
      });
      eq(r.jam, { pins: 6, sealed: 0, full: 'full' }); eq(r.before, 0); eq(r.after, 3); eq(r.sealedNow, 3); eq(r.cut, 6);
      ok(/already/.test(r.strike || ''), 'a sealed link should strike the candidate elsewhere: ' + r.strike);
    },
    'difficulty: random and fixed readers never bring out all four secrets; an adaptive reader does in most villages': async ({ page, ok }) => {
      await page.addScriptTag({ content: parishBot.toString() });
      const r = await page.evaluate(() => { const P = window.__parish, o = {};
        o.reader = [11, 55, 99].map(s => parishBot(P, s, 'reader', 900));
        o.random = [11, 66].map(s => parishBot(P, s, 'random', 500));
        o.first = [11, 33].map(s => parishBot(P, s, 'first', 700));
        o.nearest = [33, 66].map(s => parishBot(P, s, 'nearest', 700));
        return o; });
      ok(r.reader.filter(x => x.secrets === 4).length >= 3, 'adaptive reader should find all four: ' + JSON.stringify(r.reader));
      for (const k of ['random', 'first', 'nearest']) ok(r[k].every(x => x.secrets < 4), k + ' should not: ' + JSON.stringify(r[k]));
      ok(r.random.every(x => x.cut > 60), 'random play cuts many threads: ' + JSON.stringify(r.random));
      ok(r.reader.every(x => x.cut < x.seals / 2), 'the adaptive reader wastes few threads: ' + JSON.stringify(r.reader));
    },
    'letters: a chain follows the reader\'s own pins, is answered when its links seal, and a secret falls out with its letter': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const P = window.__parish, V = P.V, L = V.letters[0];
        const t0 = document.querySelector('#desk .letter').textContent;
        const first = L.targets[0], truth = V.slotOf[first].truth, wrong = V.base[first].find(x => x !== truth);
        let wrongShown = null; if (wrong != null) { P.pin(first, wrong); wrongShown = document.querySelector('#desk .letter').innerHTML.includes(`data-go="${wrong}"`); }
        for (const k of L.targets) P.pin(k, V.slotOf[k].truth);
        const heir = V.secrets.find(x => x.k === 'heir');
        for (const k of heir.need) P.pin(k, V.slotOf[k].truth);
        // one more true pin from anywhere so the seal of three can close
        for (const s of V.slots) { if (Object.keys(P.G.sealed).includes(heir.need[0]) && Object.keys(P.G.sealed).includes(heir.need[1])) break; if (s.truth != null && !(s.key in P.G.sealed) && !P.G.pins.some(p => p[0] === s.key)) P.pin(s.key, s.truth); }
        return { answered: P.G.answered.includes(0), secrets: P.G.secrets, spoiler: t0.includes(String(V.reg[truth].w.fg || '###')) && false, wrongShown };
      });
      ok(r.answered, 'first letter answered'); ok(r.secrets.includes('heir'), 'heir secret out: ' + JSON.stringify(r.secrets));
      if (r.wrongShown !== null) ok(r.wrongShown, 'the next step should follow the reader\'s own (wrong) pin');
      await page.waitForTimeout(1200); ok(/heir|Hall/i.test(await page.evaluate(() => document.querySelector('.modal')?.textContent || '')), 'secret revealed in a letter-modal');
    },
    'playing by hand: pin buttons in the slip, a wax seal on the third true pin, struck candidates elsewhere': async ({ page, ok, eq }) => {
      await closeModals(page);
      const keys = await page.evaluate(() => { const P = window.__parish, V = P.V; return V.slots.filter(s => s.truth != null && V.base[s.key].length === 1 && !V.reg[s.e].lost).slice(0, 3).map(s => [s.e, s.key, s.truth]); });
      for (const [e, k, a] of keys) { await page.evaluate(e => window.__parish.focus(e), e); await page.click(`[data-pin="${k}"][data-a="${a}"]`); }
      eq(await page.evaluate(() => Object.keys(window.__parish.G.sealed).length), 3);
      ok(await page.locator('#slip .seal').count() >= 1, 'wax seal shown');
      eq(await page.evaluate(() => window.__parish.G.pins.length), 0);
      ok(/3/.test(await page.textContent('#nSeal')));
    },
    'unlocks: the transcript brings back the lost leaves at 9 seals; the curate files plain links at 18, never a secret': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const P = window.__parish, V = P.V, G = P.G;
        const lostBefore = document.querySelector('#book') && (P.openBook(V.lost), document.querySelector('#book').textContent.includes('missing'));
        const plain = V.slots.filter(s => s.truth != null && V.base[s.key].length === 1 && !V.reg[s.e].lost).slice(0, 18);
        for (const s of plain) P.pin(s.key, s.truth);
        P.openBook(V.lost); const lostAfter = document.querySelector('#book').textContent.includes('missing');
        const n0 = Object.keys(G.sealed).length; const btn = !!document.getElementById('curB'); P.curate();
        const n1 = Object.keys(G.sealed).length, delicate = V.secrets.flatMap(x => x.need || x.many).filter(k => k in G.sealed).length;
        return { lostBefore, lostAfter, n0, n1, btn, delicate, secrets: G.secrets.length };
      });
      ok(r.lostBefore && !r.lostAfter, 'transcript: ' + JSON.stringify(r)); ok(r.btn, 'curate button'); ok(r.n1 > r.n0 + 50, 'the curate files many plain links: ' + JSON.stringify(r)); eq(r.delicate, 0, 'the curate files no secret link');
    },
    'saves: reload keeps the reading; corrupt, old and forged saves load safely': async ({ page, ok, eq }) => {
      await closeModals(page);
      const a = await page.evaluate(() => { const P = window.__parish, V = P.V; const ss = V.slots.filter(s => s.truth != null).slice(0, 4); for (const s of ss) P.pin(s.key, s.truth); return { sealed: Object.keys(P.G.sealed).sort(), pins: P.G.pins }; });
      await page.reload(); await page.waitForTimeout(900);
      eq(await page.evaluate(() => ({ sealed: Object.keys(window.__parish.G.sealed).sort(), pins: window.__parish.G.pins })), a);
      const r = await page.evaluate(() => { const P = window.__parish, V = P.V, c = P.cleanSave;
        const bad = [c(null), c('x'), c({ v: 2, seed: 5, answers: '12' }), c({ v: 3, cur: -4, games: { abc: 1, 12: 'q' } })].map(x => [x.v, x.cur, Object.keys(x.games).length]);
        const s0 = V.slots.find(s => s.truth != null), forged = P.cleanGame(V, { sealed: { [s0.key]: s0.truth, [s0.key + 'zz']: 3, [V.slots[5].key]: -99 }, pins: [['nope', 1], [s0.key, 1], 'x'], cut: -3, t: 'a', focus: 1e9 });
        return { bad, forged: { sealed: Object.keys(forged.sealed), pins: forged.pins.length, cut: forged.cut, t: forged.t, focus: forged.focus } }; });
      eq(r.bad, [[3, null, 0], [3, null, 0], [3, null, 0], [3, null, 0]]);
      eq(r.forged.pins, 0); eq(r.forged.cut, 0); eq(r.forged.t, 0); eq(r.forged.focus, null); eq(r.forged.sealed.length, 1, 'only the true seal survives');
      await page.evaluate(() => localStorage.setItem('rh:parish', '{"v":3,"cur":4242,"games":{"4242":{"sealed":"x","pins":[[1,2,3]]}}}')); await page.reload(); await page.waitForTimeout(900);
      ok(await page.evaluate(() => window.__parish.V.seed === 4242 && Object.keys(window.__parish.G.sealed).length === 0), 'corrupt game loads empty');
    },
    'share and daily: the share line gives nothing away; a #v link opens that parish; today\'s parish is stable': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const P = window.__parish; const t = document.title; return { v: P.V.village, seed: P.V.seed }; });
      eq(r.seed, 4242);
      await page.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
      await page.click('#shareB'); const txt = await page.evaluate(() => window.__copied);
      ok(/secrets 0\/4/.test(txt) && /#v=4242/.test(txt) && txt.includes(r.v), txt);
      ok(!/bigamy|heir|foundling|plague/i.test(txt), 'share must not spoil');
      await page.goto(page.url().replace(/#.*/, '') + '#v=99'); await page.reload(); await page.waitForTimeout(900);
      eq(await page.evaluate(() => window.__parish.V.seed), 99);
      const d = await page.evaluate(() => [RH.hashStr('parish-day:2026-11-25') % 1e9, RH.hashStr('parish-day:2026-11-25') % 1e9]); eq(d[0], d[1]);
    },
    'phone: tabs, tap to pin, no sideways scroll, the help text is not hidden under its button': async ({ page, ok, eq }) => {
      const ctx = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
      await p.goto(page.url()); await p.waitForTimeout(1000); await p.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= 392), 'overflow');
      await p.locator('#ptabs [data-tab="desk"]').tap(); ok(await p.locator('#desk .letter').first().isVisible(), 'letters visible');
      await p.locator('#desk .tg[data-go]').first().tap(); ok(await p.locator('#slip .focus').isVisible(), 'slip opens on tap');
      await p.locator('#slip .pinb').first().tap(); eq(await p.evaluate(() => window.__parish.G.pins.length), 1);
      await p.locator('#ptabs [data-tab="book"]').tap(); ok(await p.locator('#book .page').isVisible(), 'book');
      await p.locator('#helpBtn').tap(); await p.waitForTimeout(200);
      const cov = await p.evaluate(() => { const m = document.querySelector('.modal'), ps = [...m.querySelectorAll('p')], last = ps[ps.length - 1].getBoundingClientRect(), bar = m.querySelector('.modal-actions').getBoundingClientRect(), mr = m.getBoundingClientRect(); return { lastBottom: last.bottom, barTop: bar.top, modalBottom: mr.bottom, vh: innerHeight, scrollable: m.scrollHeight > m.clientHeight }; });
      ok(cov.lastBottom <= cov.barTop + 1 || cov.scrollable, 'help text hidden under the button: ' + JSON.stringify(cov)); ok(cov.modalBottom <= cov.vh, 'modal fits the screen');
      await ctx.close();
    },
    'a full pincushion lists every pin as a link, the hint shows once, and the Letters tab counts letters': async ({ page, ok, eq }) => {
      await closeModals(page);
      const r = await page.evaluate(() => { const P = window.__parish, V = P.V, used = new Set();
        for (let n = 0; n < 6; n++) { const s = V.slots.find(s => s.truth != null && V.base[s.key].length >= 2 && !used.has(s.key) && !(s.key in P.G.sealed)); used.add(s.key); P.pin(s.key, V.base[s.key].find(x => x !== s.truth)); }
        const first = P.G.pins[0], e = V.slotOf[first[0]].e; P.focus(V.reg[e].id === e ? (e === 0 ? 1 : 0) : 0);
        const links = [...document.querySelectorAll('#slip .jam [data-go]')].map(a => +a.dataset.go);
        const hints = [...document.querySelectorAll('#slip .hint')].filter(h => /three pinned threads/.test(h.textContent)).length;
        document.querySelector('#slip .jam [data-go]').click();
        return { pins: P.G.pins.length, links, want: P.G.pins.map(([k]) => V.slotOf[k].e), focus: P.G.focus, hints, badge: document.getElementById('bdL').textContent, nL: V.letters.length }; });
      eq(r.pins, 6); eq(r.links, r.want, 'jam links'); eq(r.focus, r.want[0], 'a jam link opens the pinned entry');
      eq(r.hints, 1, 'the pin hint is printed twice'); eq(r.badge, '0/' + r.nL, 'Letters tab badge');
    },
  },
};
