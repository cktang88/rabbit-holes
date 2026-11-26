// Underwriter (ruin/): a Lloyd's coffee-house career, 1688-1703. Tests drive the pure engine through window.__ruin
// (headless careers played by bots that see only what a player sees), plus the real slip UI, saves, links and phone layout.
const close = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
const BOTS = {
  // naive play
  random: `o => ({ sign: o.slips.filter(s => s.kind === 'voyage').map(s => ({ i: s.i, line: RND() < .3 ? 0 : o.chips[Math.floor(RND() * 4)] })).filter(x => x.line), retro: o.slips.filter(s => s.kind === 'retro' && RND() < .5).map(s => s.i) })`,
  greedy: `o => ({ sign: o.slips.filter(s => s.kind === 'voyage').map(s => ({ i: s.i, line: o.chips[3] })), retro: o.slips.filter(s => s.kind === 'retro').map(s => s.i) })`,
  flat10: `o => ({ sign: o.slips.filter(s => s.kind === 'voyage').map(s => ({ i: s.i, line: o.chips[2] })) })`,
  flat5: `o => ({ sign: o.slips.filter(s => s.kind === 'voyage').map(s => ({ i: s.i, line: o.chips[1] })) })`,
  timid: `o => ({ sign: o.slips.filter(s => s.kind === 'voyage').map(s => ({ i: s.i, line: o.chips[0] })) })`,
  cheapOnly: `o => ({ sign: o.slips.filter(s => s.kind === 'voyage' && s.rate >= 6).map(s => ({ i: s.i, line: o.chips[2] })) })`,
  // competent and adaptive: prices each voyage from its own ledger, the hull, the captain, letters and the £ per ton,
  // signs only clear bargains, and keeps the £ at risk in any one sea in any one month under 30% of capital
  adaptive: `o => {
    const H = { 'new-built': .6, sound: .9, tired: 1.4, leaky: 2.4 };
    const est = s => { let surv = 1; s.legs.forEach(([z, m], k) => {
        const n = o.ledger[z][m], kk = o.ledger[z][12 + m]; let q = (kk + .3) / (n + 10);
        q += .006 * (H[s.hull] - 1) + .004 * s.capt.k;
        if (k === 0 && o.rumours.some(r => r.z === z && r.src !== 'bar')) q *= 2;
        if (s.perTon > 20 && k < 2) q += .15;
        surv *= 1 - Math.min(.9, Math.max(0, q)); }); return 1 - surv; };
    const g = JSON.parse(JSON.stringify(o.expo)), sign = [];
    for (const s of o.slips) { if (s.kind !== 'voyage') continue; const P = est(s); if (s.rate / 100 < P * 1.3) continue;
      let line = 0;
      for (const c of o.chips.slice().reverse()) { const L = Math.min(c, s.sum); if (s.legs.every(([z], k) => k > 5 || g[z][k] + L <= .3 * o.cap)) { line = L; break; } }
      if (!line) continue; s.legs.forEach(([z], k) => { if (k < 6) g[z][k] += line; }); sign.push({ i: s.i, line }); }
    return { sign };
  }`,
};
const SEEDS = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6'];
const run = (page, bot, seeds = SEEDS) => page.evaluate(([src, seeds]) => { const RND = RH.rng('bot-dice'); return seeds.map(s => __ruin.runBot(s, eval(src), { tries: 2 })); }, [BOTS[bot], seeds]);
const success = r => !r.gaveUp && r.done && r.ruins === 0 && r.judge >= 3;

module.exports = {
  page: 'ruin/index.html',
  ready: async page => { await page.waitForFunction(() => window.__ruin); await page.waitForTimeout(300); await close(page); },
  tests: {
    'careers are deterministic per seed: same seed, same ships and same fate; another seed differs': async ({ page, eq, ok }) => {
      const r = await page.evaluate(src => { const R = __ruin, b = eval(src), a1 = R.runBot('k7', b), a2 = R.runBot('k7', b), c = R.runBot('k8', b);
        const s1 = R.newState('k7'), s2 = R.newState('k7'); return { a1, a2, c, slips: JSON.stringify(s1.slips) === JSON.stringify(s2.slips) && JSON.stringify(s1.voy) === JSON.stringify(s2.voy) }; }, BOTS.adaptive);
      eq(r.a1, r.a2); ok(r.slips, 'opening slips differ'); ok(r.c.cap !== r.a1.cap, 'different seeds gave the same career');
      ok(r.a1.done && r.a1.years === 16, 'career should run 1688-1703: ' + JSON.stringify(r.a1));
    },
    'difficulty: naive play fails, the adaptive underwriter succeeds': async ({ ok }) => {
      const naive = [];
      for (const b of ['random', 'greedy', 'flat10', 'timid']) naive.push(...(await run(globalThis.__page, b)).map(r => [b, success(r), r]));
      const passRate = naive.filter(x => x[1]).length / naive.length;
      ok(passRate <= .15, 'naive bots succeed too often: ' + naive.filter(x => x[1]).map(x => x[0] + ' j' + x[2].judge).join(', '));
      ok(naive.filter(x => x[0] === 'greedy').every(x => x[2].ruins > 0), 'over-writing every slip should be ruined at least once');
      const comp = await run(globalThis.__page, 'adaptive');
      ok(comp.filter(success).length >= 5, 'adaptive should succeed on 5+ of 6 seeds: ' + comp.map(r => `j${r.judge}/${r.ruins}r`).join(' '));
    },
    'no single fixed strategy wins every seed': async ({ ok }) => {
      const names = ['greedy', 'flat10', 'flat5', 'timid', 'cheapOnly'], seeds = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8'], res = {};
      for (const n of names) res[n] = await run(globalThis.__page, n, seeds);
      const winners = seeds.map((_, i) => names.slice().sort((a, b) => (res[b][i].gaveUp ? -1e9 : res[b][i].cap) - (res[a][i].gaveUp ? -1e9 : res[a][i].cap))[0]);
      ok(new Set(winners).size >= 2, 'one fixed strategy won every seed: ' + winners);
    },
    'correlation: the same £ at risk is far more dangerous in one sea in one month than spread out': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const R = __ruin;
        const mk = (routes) => { const S = R.newState('corr'); S.t = 7; S.cap = 3000; S.pol = []; S.voy = {}; let id = 900;
          for (const rt of routes) { const v = { id: ++id, r: rt, s: 7, h: 'sound', c: 0, tn: 200, b: 1680, cv: 0, fr: 0, nm: 'x', sum: 9999, st: 0, rate: 10, res: 10 }; S.voy[id] = v; S.pol.push({ v: id, line: 1200, prem: 0 }); } return R.halley(S); };
        return { together: mk(['jamaica', 'jamaica', 'jamaica', 'jamaica']), apart: mk(['jamaica', 'baltic', 'lisbon', 'virginia']) }; });
      ok(r.together > r.apart * 3 && r.together > .08, `concentrated ${r.together} vs spread ${r.apart}`);
    },
    'haggling carries adverse selection: brokers accept a high ask mostly on ships that were underpriced': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const R = __ruin, acc = [], ref = [];
        for (const seed of ['h1', 'h2', 'h3', 'h4']) { const S = R.newState(seed); S.t = 24;
          for (let k = 0; k < 30; k++) { R.openSitting(S); S.slips.forEach((sl, i) => { if (sl.k !== 'v') return; const v = S.voy[sl.vid], P = R.fairP(S, v, true, 0, true), cap = S.cap;
              const res = R.sign(S, i, 100, 2); (res === 'signed' ? acc : ref).push(v.rate / 100 / P); if (res === 'signed') R.strike(S, i); }); S.t++; } }
        const avg = a => a.reduce((x, y) => x + y, 0) / a.length; return { acc: avg(acc), ref: avg(ref), n: [acc.length, ref.length] }; });
      ok(r.n[0] > 10 && r.n[1] > 10, 'both outcomes should occur: ' + r.n); ok(r.acc < r.ref, `offered/true price: accepted ${r.acc.toFixed(2)} vs refused ${r.ref.toFixed(2)}`); ok(r.acc < 1.05, 'accepted asks should mark underpriced ships');
    },
    'reinsurance: a rival who breaks pays you only what he has left, goes to the Fleet, and your other cover with him lapses': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const R = __ruin;
        for (let k = 0; k < 60; k++) { const S = R.newState('re' + k); S.t = 40; R.openSitting(S); S.voy = {}; S.slips = []; S.pol = []; S.ys.pols = [];
          const mkv = (id, rt, c) => (S.voy[id] = { id, r: rt, s: 40, h: 'leaky', c, tn: 200, b: 1680, cv: 0, fr: 0, nm: 'v' + id, sum: 5000, st: 0, rate: 10, res: 10 });
          mkv(1, 'lisbon', 0); mkv(2, 'virginia', 1); S.caps[0].sk = 1e4; S.caps[1].sk = .5;
          S.pol.push({ v: 1, line: 1000, prem: 0, yi: 0 }, { v: 2, line: 1000, prem: 0, yi: 1 }); S.ys.pols.push({}, {});
          const q = R.cedeQuote(S, 0, 0); R.cede(S, 0, 0); R.cede(S, 1, 0);
          S.riv[0].cap = 100; S.riv[0].lines = {}; const cap0 = S.cap;
          const ev = R.advance(S);
          if (ev.lost.includes(1) && !ev.lost.includes(2)) return { q, lost: ev.lost, defaults: ev.defaults, out: S.riv[0].out, capDelta: S.cap - cap0, ced2: S.pol.find(p => p.v === 2).ced }; }
        return null; });
      ok(r, 'no seed lost ship 1 alone');
      ok(r.q > 0, 'Sir Josiah should quote'); ok(r.lost.includes(1), 'forced loss'); eq(r.defaults[0], [0, 100, 500]);
      ok(r.out, 'the broken rival should be out'); ok(Math.abs(r.capDelta - (-1000 + 100)) < 1, 'you pay the line and recover only his last £100: ' + r.capDelta);
      eq(r.ced2, null, 'cover with a broken rival should lapse');
    },
    'ruin sends you back to the start of the year with the same ships but fresh weather': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const R = __ruin, S = R.newState('ruin1'); let guard = 0;
        while (!S.ruined && guard++ < 200) { R.applyDecisions(S, { sign: S.slips.map((s, i) => ({ i, line: s.k === 'v' ? S.voy[s.vid].sum : 0 })) }); R.closeSitting(S); }
        const y = R.yr(S.snap.t), capAt = S.snap.cap, slips0 = JSON.stringify(S.snap.voy); R.restartYear(S);
        return { ruined: guard < 200, att: S.att[y], back: S.cap === capAt, month: S.t % 12, voyKept: Object.keys(JSON.parse(slips0)).every(k => S.voy[k]), ruins: S.ruins }; });
      ok(r.ruined, 'writing whole ships should ruin you'); eq([r.att, r.back, r.month, r.ruins], [1, true, 0, 1]); ok(r.voyKept);
    },
    'every December is reckoned: 100 replays of your own book, three seals and a luck-free judgement': async ({ page, ok }) => {
      const r = await page.evaluate(src => { const R = __ruin, S = R.newState('yr'); const b = eval(src); while (S.t < 12) { R.applyDecisions(S, b(R.observe(S))); R.closeSitting(S); if (S.ruined) R.restartYear(S); } return S.yrs[1688]; }, BOTS.adaptive);
      ok(r && r.caps.length === 100, 'replays'); ok([r.f, r.s, r.st].every(x => x === 0 || x === 1)); ok(r.med > 0 && r.ruin >= 0 && r.ruin <= 100);
    },
    'the real slip: a chip signs (premium paid), the signature strikes it out, Close the sitting moves a month': async ({ page, ok, eq }) => {
      const cap0 = await page.evaluate(() => __ruin.S.cap);
      await page.click('.slip[data-i="0"] .chips button[data-act="sign"]');
      const a = await page.evaluate(() => ({ cap: __ruin.S.cap, st: __ruin.S.slips[0].st, sig: !!document.querySelector('.slip[data-i="0"] .sig') }));
      ok(a.cap > cap0 && a.st === 'signed' && a.sig, 'sign failed ' + JSON.stringify(a));
      await page.click('.slip[data-i="0"] .sig'); eq(await page.evaluate(() => [__ruin.S.cap, __ruin.S.slips[0].st]), [cap0, 'open']);
      await page.click('.slip[data-i="0"] .chips button[data-act="sign"]');
      await page.click('#closeBtn'); await page.waitForFunction(() => !__ruin.busy && __ruin.S.t === 1, null, { timeout: 5000 }); await close(page);
      ok(await page.evaluate(() => __ruin.S.pol.length >= 0 && document.getElementById('when').textContent.startsWith('February')), 'month did not advance');
      await page.keyboard.press('Enter'); await page.waitForFunction(() => !__ruin.busy && __ruin.S.t === 2, null, { timeout: 5000 });
    },
    'tabs: the Book shows £ at risk by sea and month; the Ledger counts losses': async ({ page, ok }) => {
      await page.click('.slip[data-i="0"] .chips button[data-act="sign"]');
      await page.click('.tabs button[data-tab="book"]'); ok(await page.locator('#pane table.grid td').count() > 6, 'no exposure grid');
      await page.click('.tabs button[data-tab="ledger"]'); ok((await page.textContent('#pane')).includes('ledger'), 'no ledger');
    },
    'saves: reload resumes the sitting; corrupted saves never break the page': async ({ page, ok, eq }) => {
      await page.click('.slip[data-i="0"] .chips button[data-act="sign"]');
      const before = await page.evaluate(() => [__ruin.S.seed, __ruin.S.cap, __ruin.S.pol.length]);
      await page.reload(); await page.waitForFunction(() => window.__ruin); await close(page);
      eq(await page.evaluate(() => [__ruin.S.seed, __ruin.S.cap, __ruin.S.pol.length]), before);
      const c = await page.evaluate(() => { const R = __ruin, good = JSON.parse(JSON.stringify(R.S));
        const bads = ['{', 'null', '3', '[]', JSON.stringify({ v: 2 }), JSON.stringify({ ...good, cap: 'NaN' }), JSON.stringify({ ...good, t: 9999 }), JSON.stringify({ ...good, pol: [{ v: 12345, line: 1 }] }), JSON.stringify({ ...good, riv: [] })];
        return { bad: bads.map(b => R.cleanSave(b)), snapOnly: !!R.cleanSave({ ...good, cap: null }), good: !!R.cleanSave(good) }; });
      ok(c.good, 'a good save should load'); ok(c.snapOnly, 'a damaged save should fall back to its January snapshot');
      ok(c.bad.slice(0, 5).every(x => x === null), 'garbage should be refused');
      for (const junk of ['{"v":2,"seed":"x"', '{"v":2,"seed":"x","mode":"career","t":5,"t0":0,"cap":1e400}', '"hello"']) {
        await page.evaluate(j => localStorage.setItem('rh:ruin', j), junk); await page.reload(); await page.waitForFunction(() => window.__ruin); await close(page);
        ok(await page.evaluate(() => __ruin.validState(__ruin.S) && document.querySelectorAll('.slip').length > 0), 'page broken by ' + junk);
      }
    },
    'links: #daily opens the seeded daily sitting; #seed= starts that career; share text names the seed': async ({ page, ok, eq }) => {
      await page.goto(page.url().split('#')[0] + '#daily=2026-03-04'); await page.reload(); await page.waitForFunction(() => window.__ruin); await close(page);
      const d = await page.evaluate(() => { const R = __ruin, ref = R.dailyState('2026-03-04'); return { mode: R.S.mode, same: JSON.stringify(R.S.slips) === JSON.stringify(ref.slips), t0: R.S.t0, text: R.shareText(), link: R.shareLink() }; });
      eq(d.mode, 'daily'); ok(d.same, 'daily slips differ from the seeded daily'); ok(d.t0 >= 12 && d.t0 % 12 === 0); ok(d.link.endsWith('#daily=2026-03-04') && d.text.includes('2026-03-04'));
      await page.goto(page.url().split('#')[0] + '#seed=zebra'); await page.reload(); await page.waitForFunction(() => window.__ruin); await close(page);
      const s = await page.evaluate(() => [__ruin.S.seed, __ruin.S.mode, __ruin.shareLink(), __ruin.shareText()]);
      eq(s.slice(0, 2), ['zebra', 'career']); ok(s[2].endsWith('#seed=zebra') && s[3].includes('zebra'));
    },
    'a fresh player is taught the first slip in plain words: the premium now, kept if she arrives, the line paid if she sinks': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const S = __ruin.S, sl = document.querySelector('.slip[data-i="0"]'), v = S.voy[S.slips[0].vid], chip = sl.querySelector('.chips button[data-act="sign"]');
        const q = c => (sl.querySelector(c) || {}).textContent || '';
        return { lesson: q('.lesson'), nm: v.nm, line: +chip.dataset.line, rate: v.rate, chip: chip.textContent, sum: q('.sum'), rt: q('.rt'), chiplab: q('.chiplab'), purse: document.getElementById('capital').textContent }; });
      const prem = r.line * r.rate / 100, L = '£' + r.line.toLocaleString('en-GB');
      ok(r.lesson.includes(`The ${r.nm} sails`), 'no plain-language lesson on the first slip: ' + r.lesson);
      for (const w of ['her owner pays you', '(the premium)', 'If she arrives, you keep it', `If she sinks, you pay ${L}`, '(your line)']) ok(r.lesson.includes(w), `lesson lacks "${w}": ${r.lesson}`);
      const num = t => { const m = t.match(/£([\d,]+)(½)?/); return m ? +m[1].replace(/,/g, '') + (m[2] ? .5 : 0) : NaN; };
      ok(Math.abs(num(r.lesson.split('pays you')[1]) - prem) <= .5, `the premium in the lesson should be ${prem}: ${r.lesson}`);
      ok(r.chip.includes(L) && Math.abs(num(r.chip.split('+')[1]) - prem) <= .5, 'a chip should show the line and the premium it earns: ' + r.chip);
      ok(r.sum.includes('insured for') && r.rt.includes('rate') && r.chiplab.includes('you pay it if she sinks') && r.purse.includes('your purse'), 'numbers need plain labels');
      // sign it: the lesson gives way, and closing the sitting writes the month's account as ledger lines
      await page.click('.slip[data-i="0"] .chips button[data-act="sign"]');
      ok(!(await page.$('.slip[data-i="0"] .lesson')), 'lesson should go once signed'); ok((await page.textContent('#pane')).includes('close the sitting'), 'next step not taught');
      await page.click('#closeBtn'); await page.waitForFunction(() => !__ruin.busy && __ruin.S.t === 1, null, { timeout: 5000 }); await close(page);
      const acct = await page.evaluate(() => { const a = document.querySelector('.acct'); return a && { text: a.textContent, rows: __ruin.S.acct.rows, cap: __ruin.S.cap }; });
      ok(acct && acct.text.includes('Premiums you took for signing'), 'no account of the month');
      const rows = acct.rows, sum = rows.slice(1, -1).reduce((x, rw) => x + rw[1], rows[0][1]);
      ok(Math.abs(sum - acct.cap) < .01 && Math.abs(rows[rows.length - 1][1] - acct.cap) < .01, 'the account should add up to the purse: ' + JSON.stringify(rows));
    },
    'every later slip shows why it is priced so: each sea and month, ship, captain, the odds and the break-even': async ({ page, ok }) => {
      await page.click('.slip[data-i="0"] .chips button[data-act="sign"]');
      const r = await page.evaluate(() => { const S = __ruin.S, i = S.slips.findIndex(s => s.k === 'v' && s.st === 'open'), el = document.querySelector(`.slip[data-i="${i}"] details.why`), v = S.voy[S.slips[i].vid];
        el.open = true; return { text: el.textContent, rate: v.rate, legs: __ruin.ROUTES[v.r].legs.length, rows: el.querySelectorAll('.wr').length, est: __ruin.reckon(v).p }; });
      const pc = (r.rate % 1 ? Math.floor(r.rate) + '½' : r.rate) + '%';
      ok(r.text.includes(`Why ${pc}?`) && r.text.includes(`pays if her true risk is under ${pc}`), 'no break-even: ' + r.text);
      ok(r.text.includes(`you risk £${Math.round(100 / r.rate)} to win £1`), 'no odds');
      ok(r.text.includes('Ship:') && r.text.includes('Captain:') && r.rows >= r.legs + 3, 'reasons missing');
      ok(r.est > 0 && r.est < .6, 'ledger guess out of range ' + r.est);
      // the chart's dangers follow the war: privateers marked in home waters in wartime, not in peacetime
      const d = await page.evaluate(() => { const S = __ruin.S, out = [S.t]; out.push(__ruin.dangers().home.raid); S.t = 20; __ruin.render(); out.push(__ruin.dangers().home.raid); return out; });
      ok(d[1] === false && d[2] === true, 'privateers on the chart: ' + d);
    },
    'phone (390x844): chart, a whole slip with its chips, and Close the sitting are on screen together; a tap signs': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
      const vis = sel => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height > 0 && r.left >= 0 && r.right <= innerWidth; }, sel);
      ok(await vis('#chart'), 'chart'); ok(await vis('.slip[data-i="0"] .chips'), 'chips'); ok(await vis('#closeBtn'), 'close button');
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= 391), 'sideways scroll');
      await page.tap('.slip[data-i="0"] .chips button[data-act="sign"]').catch(() => page.click('.slip[data-i="0"] .chips button[data-act="sign"]'));
      ok(await page.evaluate(() => __ruin.S.slips[0].st === 'signed'), 'tap did not sign');
    },
  },
};
// tests that loop over bots use the page through a global (set by the runner's page for each test)
const wrap = fn => async ctx => { globalThis.__page = ctx.page; return fn(ctx); };
for (const k of Object.keys(module.exports.tests)) module.exports.tests[k] = wrap(module.exports.tests[k]);
