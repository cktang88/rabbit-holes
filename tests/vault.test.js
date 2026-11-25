// The Vault: cipher logic, every vault solvable, deliberate-commit rule, saves and progression.
const closeModals = page => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));
// Build the workbench stages that undo vault i's real key (steps reversed).
const solveFn = () => {
  window.__solution = i => {
    const X = window.__vault, v = X.V[i], b = X.build(i), A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (v.pad) return { padKey: b.padKey.slice() };
    const stages = v.steps.map((s, j) => {
      const k = b.keys[j];
      switch (s.t) {
        case 'caesar': return { t: 'shift', s: { k: k.k } };
        case 'atbash': return { t: 'atbash', s: {} };
        case 'affine': return { t: 'affine', s: { a: k.a, b: k.b } };
        case 'subst': { const m = {}; for (let x = 0; x < 26; x++) m[k.alpha[x]] = A[x]; return { t: 'subst', s: { m } }; }
        case 'rail': return { t: 'rail', s: { n: k.n } };
        case 'col': { const pos = []; k.order.forEach((c, j2) => { pos[c] = j2; }); return { t: 'col', s: { w: k.w, pos } }; }
        case 'rev': return { t: 'rev', s: {} };
        case 'vig': return { t: 'vig', s: { sh: k.sh.slice() } };
        case 'rotor': return { t: 'rotor', s: { set: k.set.slice() } };
      }
    }).reverse();
    return { stages };
  };
};
const setWork = (page, i, work) => page.evaluate(([i, work]) => { const w = window.__vault.workOf(i); Object.assign(w, JSON.parse(JSON.stringify(work))); }, [i, work]);

module.exports = {
  page: 'vault/index.html',
  ready: async page => { await page.waitForFunction(() => window.__vault); await closeModals(page); await page.evaluate(solveFn); },
  tests: {
    'there are 24 vaults, 4 per era, with unique original ids': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const V = window.__vault.V.slice(0, window.__vault.CAMPAIGN); return { n: V.length, per: [0, 1, 2, 3, 4, 5].map(e => V.filter(v => v.e === e).length), ids: new Set(V.map(v => v.id)).size }; });
      eq(r.n, 24); eq(r.per, [4, 4, 4, 4, 4, 4]); eq(r.ids, 24);
    },
    'every vault: closed at start, opened by its real key, not by a near miss': async ({ page, ok }) => {
      const bad = await page.evaluate(() => {
        const X = window.__vault, out = [];
        X.V.forEach((v, i) => {
          const w = X.workOf(i);
          if (v.pad) w.padKey = Array(v.len).fill(null); else w.stages = [];
          if (X.isOpenNow(i)) out.push(i + ' open at start');
          const sol = window.__solution(i); Object.assign(w, JSON.parse(JSON.stringify(sol)));
          if (!X.isOpenNow(i)) out.push(i + ' not opened by key');
          // near miss: perturb one parameter
          if (v.pad) { w.padKey[0] = (w.padKey[0] + 1) % 26; }
          else {
            const st = w.stages.find(s => !['atbash', 'rev'].includes(s.t));
            if (!st) { w.stages = []; }
            else if (st.t === 'shift') st.s.k = (st.s.k + 1) % 26;
            else if (st.t === 'affine') st.s.b = (st.s.b + 1) % 26;
            else if (st.t === 'subst') { const ks = Object.keys(st.s.m); const t = st.s.m[ks[0]]; st.s.m[ks[0]] = st.s.m[ks[1]]; st.s.m[ks[1]] = t; }
            else if (st.t === 'rail') st.s.n++;
            else if (st.t === 'col') { const p = st.s.pos;[p[0], p[1]] = [p[1], p[0]]; }
            else if (st.t === 'vig') st.s.sh[0] = (st.s.sh[0] + 1) % 26;
          }
          if (X.isOpenNow(i)) out.push(i + ' opened by near miss');
          w.stages = []; w.padKey = v.pad ? Array(v.len).fill(null) : null;
        });
        return out;
      });
      ok(!bad.length, bad.join('; '));
    },
    'regression: the tool a vault starts you with never opens it at its default setting': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const X = window.__vault, out = [];
        X.V.forEach((v, i) => { if (v.pad) return; for (let variant = 0; variant < 12; variant++) { X.S.variant[i] = variant; delete X.S.work[i]; X.openVault(i); if (X.isOpenNow(i)) out.push(i + ':' + variant); } X.S.variant[i] = 0; delete X.S.work[i]; });
        X.openVault(0); return out; });
      ok(!bad.length, 'open at start with the default tool: ' + bad.join(', '));
    },
    'cipher primitives round-trip (rail fence, columns, affine, vigenere)': async ({ page, eq }) => {
      const r = await page.evaluate(() => {
        const X = window.__vault, out = [];
        out.push(X.APPLY.rail('WECRLTEERDSOEEFEAOCAIVDEN', { n: 3 }) === 'WEAREDISCOVEREDFLEEATONCE');
        out.push(X.APPLY.affine('IHHWVCSWFRCP', { a: 5, b: 8 }) === 'AFFINECIPHER');
        out.push(X.APPLY.vig('LXFOPVEFRNHR', { sh: [11, 4, 12, 14, 13] }) === 'ATTACKATDAWN');
        out.push(X.APPLY.shift('KHOOR', { k: 3 }) === 'HELLO');
        out.push(X.APPLY.atbash('SVOOL', {}) === 'HELLO');
        out.push(X.APPLY.col('ACEBDF', { w: 2, pos: [0, 1] }) === 'ABCDEF');
        out.push(X.APPLY.col('ABCDE', { w: 2, pos: null }) === 'ABCDE'); // non-divisible width leaves text alone
        out.push(X.APPLY.rail('AB', { n: 5 }) === 'AB');
        return out;
      });
      eq(r, [true, true, true, true, true, true, true, true]);
    },
    'sweeping the shift slider past the answer does not open the vault': async ({ page, ok, eq }) => {
      await page.evaluate(() => window.__vault.openVault(0));
      const box = await page.locator('input[data-r=k]').boundingBox();
      const xAt = k => box.x + 8 + (box.width - 16) * k / 25;
      await page.mouse.move(xAt(0), box.y + box.height / 2); await page.mouse.down();
      for (let k = 0; k <= 20; k += 0.5) { await page.mouse.move(xAt(k), box.y + box.height / 2); await page.waitForTimeout(40); }
      await page.mouse.up(); await page.waitForTimeout(1400);
      ok(!(await page.evaluate(() => window.__vault.S.solved[0])), 'swept past k=3 and it opened');
      // keyboard sweep: arrow keys through 3 without stopping
      await page.evaluate(() => { const w = window.__vault.workOf(0); w.stages[0].s.k = 0; window.__vault.update(); });
      await page.focus('input[data-r=k]');
      for (let k = 0; k < 8; k++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150); }
      await page.waitForTimeout(1300);
      ok(!(await page.evaluate(() => window.__vault.S.solved[0])), 'keyboard sweep opened it');
      eq(await page.evaluate(() => window.__vault.workOf(0).stages[0].s.k), 8);
    },
    'holding the slider on the answer opens only after release + settle': async ({ page, ok }) => {
      await page.evaluate(() => window.__vault.openVault(0));
      const box = await page.locator('input[data-r=k]').boundingBox();
      const xAt = k => box.x + 8 + (box.width - 16) * k / 25;
      await page.mouse.move(xAt(0), box.y + box.height / 2); await page.mouse.down();
      let k = -1;
      for (let x = xAt(2.3); x < xAt(3.8) && k !== 3; x += 1) { await page.mouse.move(x, box.y + box.height / 2); k = await page.evaluate(() => window.__vault.workOf(0).stages[0].s.k); }
      ok(k === 3, 'slider landed on ' + k);
      await page.waitForTimeout(1500);
      ok(!(await page.evaluate(() => window.__vault.S.solved[0])), 'opened while still dragging');
      await page.mouse.up(); await page.waitForTimeout(300);
      ok(!(await page.evaluate(() => window.__vault.S.solved[0])), 'opened instantly on release');
      await page.waitForTimeout(1100);
      ok(await page.evaluate(() => !!window.__vault.S.solved[0]), 'did not open after settling');
      ok(await page.locator('#otext .stamp').count() === 1, 'no DECRYPTED stamp on the carbon');
      await page.waitForTimeout(1300);
      ok(await page.locator('.modal .stamp').count() === 1, 'no case-file modal');
    },
    'stepping with the arrow button and stopping on the answer opens it': async ({ page, ok }) => {
      await page.evaluate(() => window.__vault.openVault(0));
      for (let n = 0; n < 3; n++) await page.click('button[data-a="k+"]');
      ok(!(await page.evaluate(() => window.__vault.S.solved[0])), 'opened instantly');
      await page.waitForTimeout(1300);
      ok(await page.evaluate(() => !!window.__vault.S.solved[0]), 'did not open');
    },
    'leaving the vault during the settle window cancels it': async ({ page, ok }) => {
      await page.evaluate(() => { const X = window.__vault; X.openVault(0); X.workOf(0).stages[0].s.k = 3; X.update(); X.openVault(1); });
      await page.waitForTimeout(1300);
      ok(!(await page.evaluate(() => window.__vault.S.solved[0])), 'solved a vault you left');
    },
    'one-time pad completes only when settled': async ({ page, ok }) => {
      const i = await page.evaluate(() => { const X = window.__vault, i = X.V.findIndex(v => v.pad); X.S.solved = {}; X.V.forEach((v, j) => { if (v.e < X.V[i].e) X.S.solved[j] = { stars: 3, time: 0 }; }); X.openVault(i); const w = X.workOf(i); w.padKey = X.build(i).padKey.slice(); w.padKey[0] = null; X.update(); return i; });
      await page.click('.pc[data-r="0"][data-c="0"]');
      const b = await page.evaluate(i => window.__vault.build(i).plains[0][0], i);
      await page.keyboard.press(b);
      ok(!(await page.evaluate(i => window.__vault.S.solved[i], i)), 'opened instantly');
      await page.waitForTimeout(1300);
      ok(await page.evaluate(i => !!window.__vault.S.solved[i], i), 'pad vault did not open');
    },
    'eras unlock after 3 vaults; progress never exceeds 1': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => {
        const X = window.__vault; X.S.solved = {};
        const a = X.eraOpen(1);
        [0, 1].forEach(i => X.S.solved[i] = { stars: 3, time: 0 }); const b = X.eraOpen(1);
        X.S.solved[2] = { stars: 3, time: 0 }; const c = X.eraOpen(1);
        X.V.forEach((v, i) => X.S.solved[i] = { stars: 3, time: 0 }); X.openVault(0);
        return { a, b, c, hub: JSON.parse(localStorage.getItem('rh:hub')).vault };
      });
      eq([r.a, r.b, r.c], [false, false, true]); eq(r.hub, 1);
    },
    'locked vaults cannot be opened from the sidebar': async ({ page, ok }) => {
      await page.click('.vlt[data-i="10"]');
      ok(await page.evaluate(() => window.__vault.cur) !== 10, 'opened a locked vault');
    },
    'save loading: corrupt, partial and v1 saves': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const X = window.__vault, put = v => localStorage.setItem('rh:vault', typeof v === 'string' ? v : JSON.stringify(v)), out = {};
        put('{not json'); out.junk = X.loadState().v;
        put('null'); out.nul = X.loadState().v;
        put({ seed: 5, solved: null, work: [], cur: 99 }); const p = X.loadState(); out.partial = [p.cur, typeof p.solved, Array.isArray(p.work)];
        // v1: 36 vaults by position. 35 was The Last Vault (now 23); 1 (Legion Orders) was cut.
        put({ seed: 7, solved: { 0: { stars: 3, time: 5 }, 1: { stars: 2 }, 35: { stars: 1 } }, hints: { 35: 2 }, work: { 35: { stages: [{ t: 'vig', s: { sh: 'bad' } }] }, 3: { stages: [{ t: 'shift', s: { k: 4 } }], time: 9 } }, variant: {}, cur: 35, intro: 1 });
        const m = X.loadState(); out.v1 = { solved: Object.keys(m.solved), hints: m.hints, cur: m.cur, work: Object.keys(m.work), v: m.v };
        put({ v: 2, seed: 1, solved: { 3: { stars: 'x' }, 900: { stars: 3 } }, hints: {}, work: {}, variant: {} }); out.stars = X.loadState().solved;
        return out;
      });
      eq(r.junk, 2); eq(r.nul, 2); eq(r.partial, [0, 'object', false]);
      eq(r.v1, { solved: ['0', '23'], hints: { 23: 2 }, cur: 23, work: ['2'], v: 2 });
      eq(r.stars, { 3: { stars: 1 } });
    },
    'localStorage that throws does not break the game': async ({ page, ok }) => {
      await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceeded'); }; window.__vault.openVault(0); window.__vault.update(); });
      ok(true);
    },
    'recognised words glow; new intercept keeps the vault solved and resets work': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const X = window.__vault;
        const a = X.findWords('THE GOLD IS AT tHE MILL', true).length; // THE, GOLD, MILL (tHE is undecoded)
        const b = X.findWords('XXLANTERNQQHARBOURZ', false).map(([s, e]) => 'XXLANTERNQQHARBOURZ'.slice(s, e));
        X.S.solved[0] = { stars: 3, time: 1 }; X.openVault(0); document.getElementById('newMsg').click();
        return { a, b, solved: !!X.S.solved[0], stages: X.workOf(0).stages.length, variant: X.S.variant[0] };
      });
      eq(r.a, 3); eq(r.b, ['LANTERN', 'HARBOUR']); ok(r.solved); eq(r.stages, 1); eq(r.variant, 1);
    },
    'a half-made column swap does not carry over to another vault': async ({ page, eq }) => {
      await page.evaluate(() => { const X = window.__vault; for (let j = 0; j < 8; j++) X.S.solved[j] = { stars: 3, time: 0 }; X.openVault(11); });
      await page.evaluate(() => { const X = window.__vault; X.workOf(11).stages = [{ t: 'col', s: { w: X.build(11).keys[0].w, pos: null } }]; X.openVault(11); });
      await page.click('.colx[data-p="0"]');
      await page.evaluate(() => { window.__vault.openVault(10); window.__vault.openVault(11); });
      await page.click('.colx[data-p="2"]');
      eq(await page.evaluate(() => window.__vault.workOf(11).stages[0].s.pos.slice(0, 3)), [0, 1, 2]);
    },
    'probable word: pattern match, consistency with the board, and applying a hit': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const X = window.__vault, P = X.probable;
        return {
          spaced: P('XYZZW QRS XYZZW ABCCD', 'HELLO', {}),            // XYZZW twice, ABCCD once
          conflict: P('XYZZW ABCCD', 'HELLO', { A: 'Q' }),           // ABCCD ruled out by A->Q
          reverse: P('XYZZW ABCCD', 'HELLO', { Q: 'H' }),            // H already used by Q: both ruled out
          known: P('XYZZW', 'HELLO', { X: 'H', Y: 'E', Z: 'L', W: 'O' }), // nothing new to learn
          unspaced: P('QQATTACKQQ', 'ATTACK', {}).map(x => x[0]),
          short: P('AB CD', 'AB', {}),
        };
      });
      eq(r.spaced, [['XYZZW', 2], ['ABCCD', 1]]); eq(r.conflict, [['XYZZW', 1]]); eq(r.reverse, []); eq(r.known, []);
      eq(r.unspaced, ['ATTACK']); eq(r.short, []);
      // through the UI on The Vizier's Letter: a real word from the message fills its letters in
      const word = await page.evaluate(() => { const X = window.__vault; for (let j = 0; j < 4; j++) X.S.solved[j] = { stars: 3, time: 0 }; X.openVault(5); X.workOf(5).stages = [{ t: 'subst', s: { m: {} } }]; X.openVault(5);
        return X.build(5).plain.split(/[^A-Z]+/).filter(w => w.length >= 6).sort((a, b) => b.length - a.length)[0]; });
      await page.fill('[data-pw]', word);
      const hits = await page.$$eval('[data-pwres] button', bs => bs.map(b => b.dataset.seg));
      ok(hits.length >= 1, 'no hits for a word in the message');
      const truth = await page.evaluate(w => { const X = window.__vault, b = X.build(5), k = b.keys[0].alpha, A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; return [...w].map(c => k[A.indexOf(c)]).join(''); }, word);
      ok(hits.includes(truth), 'true encipherment not offered');
      await page.click(`[data-pwres] button[data-seg="${truth}"]`);
      const m = await page.evaluate(() => window.__vault.workOf(5).stages[0].s.m);
      ok([...truth].every((c, j) => m[c] === word[j]), 'mapping not applied');
      ok(await page.$$eval('.sub input', is => is.filter(i => i.value).length) >= new Set(word).size, 'board not refreshed');
    },
    'probable-word slot only appears from The Vizier\'s Letter on': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const X = window.__vault, out = []; for (let j = 0; j < 8; j++) X.S.solved[j] = { stars: 3, time: 0 };
        for (const i of [4, 5]) { X.workOf(i).stages = [{ t: 'subst', s: { m: {} } }]; X.openVault(i); out.push(!!document.querySelector('[data-pw]')); } return out; });
      eq(r, [false, true]);
    },
    'alarm vault: when time runs out the intercept and key change, tools stay': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => {
        const X = window.__vault, i = X.V.findIndex(v => v.alarm); X.S.solved[0] = X.S.solved[1] = { stars: 3, time: 0 };
        X.openVault(i); const pre = X.alarmLeft(i); for (let t = 0; t < 5; t++) X.alarmTick(i); if (X.alarmLeft(i) !== pre) throw new Error('alarm ran before the bench was touched'); X.workOf(i).armed = true; const before = X.build(i).cipher, st0 = X.workOf(i).stages[0], key = Object.keys(st0.s)[0], t0 = st0.t; st0.s[key] = 7; const left0 = X.alarmLeft(i);
        for (let t = 0; t < X.V[i].alarm; t++) X.alarmTick(i);
        return { i, left0, alarm: X.V[i].alarm, changed: X.build(i).cipher !== before, variant: X.S.variant[i], k: X.workOf(i).stages[0].s[key] !== 7, t: X.workOf(i).stages[0].t === t0, left: X.alarmLeft(i), shown: !!document.getElementById('alarm') };
      });
      eq(r.left0, r.alarm); ok(r.changed, 'same intercept after alarm'); eq(r.variant, 1); eq([r.t, r.k], [true, true]); eq(r.left, r.alarm); ok(r.shown);
      // a solved alarm vault never re-keys
      const v = await page.evaluate(i => { const X = window.__vault; X.S.solved[i] = { stars: 3, time: 0 }; for (let t = 0; t < 400; t++) X.alarmTick(i); return X.S.variant[i]; }, r.i);
      eq(v, 1);
    },
    'phone layout: no horizontal scroll, no errors': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
      for (const i of [0, 4, 11]) {
        await page.evaluate(i => { const X = window.__vault; X.V.forEach((v, j) => { if (j < 12) X.S.solved[j] = { stars: 3, time: 0 }; }); X.openVault(i); }, i);
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        ok(sw <= 392, 'horizontal overflow ' + sw + ' on vault ' + i);
      }
    },
    'carbon vault: output hidden until you pull; wrong pulls run out and the intercept changes; the right pull opens it': async ({ page, eq, ok }) => {
      const i = await page.evaluate(() => { const X = window.__vault, i = X.V.findIndex(v => v.carbons); X.S.solved[0] = X.S.solved[1] = { stars: 3, time: 0 }; X.openVault(i); return i; });
      ok(/NO CARBON/.test(await page.textContent('#otext')), 'output visible before pulling');
      ok(await page.evaluate(() => !document.querySelector('#p-freq').textContent.includes('unlocks')), 'frequency tab not open on a carbon vault');
      const n = await page.evaluate(i => window.__vault.V[i].carbons, i), before = await page.evaluate(i => window.__vault.build(i).cipher, i);
      for (let k = 0; k < n; k++) { await page.evaluate(i => { const X = window.__vault, w = X.workOf(i), b = X.build(i); w.stages[0].s.k = (b.keys[0].k + 1) % 26; }, i); await page.click('#pullBtn'); }
      ok(await page.evaluate(([i, b]) => window.__vault.build(i).cipher !== b && !window.__vault.S.solved[i], [i, before]), 'running out of carbons did not change the intercept');
      await page.evaluate(i => { const X = window.__vault, w = X.workOf(i); w.stages[0].s.k = X.build(i).keys[0].k; X.update(); }, i);
      await page.waitForTimeout(1300);
      ok(!(await page.evaluate(i => window.__vault.S.solved[i], i)), 'opened without pulling a carbon');
      await page.click('#pullBtn');
      ok(await page.evaluate(i => !!window.__vault.S.solved[i], i), 'right carbon did not open it');
    },
    'intel: the decrypted fact is in the message, unambiguous, and a wrong call costs a star': async ({ page, eq, ok }) => {
      const bad = await page.evaluate(() => { const X = window.__vault, out = [];
        X.V.forEach((v, i) => { if (!v.intel) return; for (let variant = 0; variant < 4; variant++) { X.S.variant[i] = variant; const b = X.build(i), txt = v.pad ? b.plains[v.intel.row] : X.build(i).plain.replace(/[^A-Z]/g, '');
          if (!b.intel || b.intel.opts.length !== 4 || !b.intel.opts.includes(b.intel.ans) || !txt.includes(b.intel.start.replace(/[^A-Z]/g, '').slice(0, v.pad ? 20 : 999))) out.push(i + ':' + variant);
          if (!v.pad && v.intel.excl.some(w => b.plain.split(b.intel.start).join('').includes(w))) out.push(i + ' ambiguous'); } X.S.variant[i] = 0; });
        return out; });
      ok(!bad.length, bad.join(', '));
      // Phelippes' Desk through the UI: answer wrongly
      const i = await page.evaluate(() => { const X = window.__vault, i = X.V.findIndex(v => v.n === "Phelippes' Desk"); for (let j = 0; j < 4; j++) X.S.solved[j] = { stars: 3, time: 0 };
        X.openVault(i); const w = X.workOf(i); w.stages = window.__solution(i).stages; X.openVault(i); return i; });
      await page.waitForTimeout(2400);
      const opts = await page.$$eval('.modal button', bs => bs.map(b => b.textContent));
      const ans = await page.evaluate(i => window.__vault.build(i).intel.ans, i);
      ok(opts.includes(ans) && opts.length === 4, 'intel question missing: ' + opts);
      await page.click(`.modal button:not(:text-is("${ans}"))`);
      await page.waitForTimeout(100);
      eq(await page.evaluate(i => window.__vault.S.solved[i], i).then(x => [x.stars, x.intel]), [2, false]);
    },
    'difficulty: naive play fails': async ({ page, ok }) => {
      const r = await page.evaluate(() => {
        const X = window.__vault, V = X.V, late = V.map((v, i) => i).filter(i => i >= 16), runs = [];
        const R0 = s => () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
        const tools = ['shift', 'atbash', 'affine', 'rev', 'rail', 'col', 'vig', 'subst'], A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const randStage = R => { const t = tools[Math.floor(R() * tools.length)], s = { shift: { k: Math.floor(R() * 26) }, atbash: {}, affine: { a: [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25][Math.floor(R() * 12)], b: Math.floor(R() * 26) }, rev: {}, rail: { n: 2 + Math.floor(R() * 8) }, col: { w: 2 + Math.floor(R() * 8), pos: null }, vig: { sh: Array.from({ length: 2 + Math.floor(R() * 8) }, () => Math.floor(R() * 26)) }, subst: { m: Object.fromEntries(A.split('').map(c => [c, A[Math.floor(R() * 26)]])) } }[t]; return { t, s }; };
        const tryOpen = (i, stages, pad) => { const w = X.workOf(i); if (V[i].pad) w.padKey = pad; else w.stages = stages; return X.isOpenNow(i); };
        for (const i of late) {
          const v = V[i];
          runs.push(tryOpen(i, [], Array(v.len || 0).fill(null)));                                   // idle
          for (let seed = 1; seed <= 4; seed++) { const R = R0(seed * 97 + i); let won = false;   // random stacks / random pad keys
            for (let t = 0; t < 250 && !won; t++) won = tryOpen(i, Array.from({ length: 1 + Math.floor(R() * 2) }, () => randStage(R)), Array.from({ length: v.len || 0 }, () => Math.floor(R() * 26)));
            runs.push(won); }
          { let won = false; if (!v.pad) {                                                                  // brute force every small key space, alone and with a reversal
              const singles = [...Array(26).keys()].map(k => ({ t: 'shift', s: { k } })).concat([{ t: 'atbash', s: {} }, { t: 'rev', s: {} }], [...Array(19).keys()].map(n => ({ t: 'rail', s: { n: n + 2 } })));
              for (const st of singles) { if (tryOpen(i, [st]) || tryOpen(i, [st, { t: 'rev', s: {} }]) || tryOpen(i, [{ t: 'rev', s: {} }, st])) { won = true; break; } } }
            runs.push(won); }
          X.workOf(i).stages = []; if (v.pad) X.workOf(i).padKey = Array(v.len).fill(null);
        }
        // competent but simple: read the key off the three hints (every hint taken = 1 star)
        const competent = late.filter(i => !V[i].pad).map(i => { const w = X.workOf(i); w.stages = window.__solution(i).stages; const o = X.isOpenNow(i); w.stages = []; return o; });
        return { naiveFail: runs.filter(x => !x).length / runs.length, competent };
      });
      ok(r.naiveFail >= .8, 'naive bots opened late vaults too often: ' + (1 - r.naiveFail));
      ok(r.competent.every(Boolean), 'hint-following policy failed');
    },
    'every vault names its lock and key; the walkthrough (first step) appears only where a vault teaches a new tool, or after a hint; only tools you have are named': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const X = window.__vault, out = [], names = Object.entries(X.TOOLS).map(([k, t]) => [k, t.name]);
        X.V.forEach((v, i) => { const av = X.toolsAt(i), text = X.caseCard(i).replace(/<[^>]+>/g, '') + ' ' + [0, 1, 2].map(k => X.hintText(i, k)).join(' ');
          const card = X.caseCard(i).replace(/<[^>]+>/g, ''), teaches = i === 0 || (v.intro || []).some(t => X.TOOLS[t]);
          if (!v.pad && i !== X.POST && !/Lock:.*Key:/.test(card)) out.push(i + ' missing lock/key');
          if (!v.pad && i !== X.POST && teaches !== /First step:/.test(card)) out.push(i + (teaches ? ' teaches a tool without a first step' : ' gives the first step away'));
          if (!v.pad && i !== X.POST && !teaches) { X.S.hints[i] = 1; if (!/First step:/.test(X.caseCard(i))) out.push(i + ' no walkthrough after a hint'); delete X.S.hints[i]; }
          if (!v.pad) for (const s of v.steps) { const need = { caesar: 'shift', atbash: 'atbash', affine: 'affine', subst: 'subst', rail: 'rail', col: 'col', rev: 'rev', vig: 'vig' }[s.t]; if (!av.has(need)) out.push(i + ' needs ' + need + ' before it is introduced'); }
          for (const [k, nm] of names) if (text.includes(nm) && !av.has(k)) out.push(i + ' mentions ' + nm);
          if (/Probable word slot under the substitution/.test(text) && !av.has('crib')) out.push(i + ' mentions the crib slot early'); });
        return out; });
      ok(!bad.length, bad.join('; '));
    },
    'Sealed in Rome: the hint word plus the Probable word slot gives the shift, and one carbon opens it': async ({ page, ok }) => {
      const i = await page.evaluate(() => { const X = window.__vault, i = X.V.findIndex(v => v.n === 'Sealed in Rome'); X.S.solved[0] = X.S.solved[1] = { stars: 3, time: 0 }; X.openVault(i); return i; });
      const word = await page.evaluate(i => window.__vault.build(i).plain.split(/[^A-Z]+/).filter(w => w.length >= 6)[0], i);
      await page.fill('[data-kw2]', word);
      const k = await page.evaluate(i => window.__vault.build(i).keys[0].k, i);
      ok(await page.locator(`[data-kwres] button:has-text("shift ${k}")`).count() === 1, 'the right shift was not offered');
      await page.click(`[data-kwres] button:has-text("shift ${k}")`);
      await page.click('#pullBtn');
      ok(await page.evaluate(i => !!window.__vault.S.solved[i], i), 'did not open');
    },
    'Listening Post: the network is deterministic per seed; day 1 is one man, one short Caesar message under a lazy habit, with the shift wheel ready': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const X = window.__vault, a = JSON.stringify(X.postNet('abc')), b = JSON.stringify(X.postNet('abc')), c = JSON.stringify(X.postNet('abd'));
        const out = []; for (const seed of ['abc', 'xyz', 'daily:2026-11-25', 'q1', 'q2', 'q3']) { const run = X.postNew(seed), m = X.postMsgs(run, 1);
          if (m.length !== 1 || m[0].sys !== 'caesar' || m[0].rule !== 'FIX' || m[0].target.length > 80 || !m[0].facts.some(f => f.k === 'op')) out.push(seed + ' ' + JSON.stringify([m.length, m[0].sys, m[0].rule, m[0].target.length])); }
        for (let i = 0; i < 3; i++) X.S.solved[i] = { stars: 3, time: 0 }; X.postStart('abc'); X.S.post.run.cur = X.postMsgs(X.S.post.run, 1)[0].id; X.openVault(X.POST);
        return { same: a === b, differ: a !== c, out, tool: X.workOf(X.POST).stages.map(s => s.t), open: X.isOpenNow(X.POST), roles: X.postNet('abc').ops.map(o => o.role).join() }; });
      ok(r.same && r.differ, 'network not deterministic per seed'); ok(!r.out.length, r.out.join('; '));
      eq(r.tool, ['shift']); ok(!r.open, 'open at the start'); eq(r.roles, 'resident,handler,agent,agent,agent,agent');
    },
    'Listening Post: every message of a fortnight is closed at the start and opened by its key; every rotor message can be read by a habit or by the bombe on his opening': async ({ page, ok }) => {
      const bad = await page.evaluate(() => { const X = window.__vault, out = []; let rot = 0, bombed = 0;
        for (const seed of ['abc', 'xyz', 'q1', 'q2']) { const run = X.postNew(seed); X.S.post.run = run; const net = X.postNet(seed);
          for (let d = 1; d <= 14; d++) { run.day = d; for (const m of X.postMsgs(run, d)) { run.cur = m.id; X.openVault(X.POST); const w = X.workOf(X.POST); w.stages = [];
            if (X.isOpenNow(X.POST)) out.push(seed + ' ' + m.id + ' open at start');
            w.stages = window.__solution(X.POST).stages; if (!X.isOpenNow(X.POST)) out.push(seed + ' ' + m.id + ' unsolvable');
            if (m.sys === 'rotor') { rot++; const op = net.ops[m.o], crib = op.opening ? op.opening.replace(/[^A-Z]/g, '').slice(0, 10) : '';
              const hits = crib ? X.bombe(m.cipher, crib) : [], viaBombe = hits.some(h => h.join() === m.key.set.join()); if (viaBombe) bombed++;
              if (!viaBombe && (m.rule === 'RANDOM' || (m.rule === 'FIX' && !op.opening))) out.push(seed + ' ' + m.id + ' unreadable rotor'); } } } }
        return { out, rot, bombed }; });
      ok(!bad.out.length, bad.out.slice(0, 6).join('; ')); ok(bad.rot > 100 && bad.bombed > bad.rot * .4, `rotor ${bad.rot}, bombe-able ${bad.bombed}`);
    },
    'habit cards are falsifiable: the right card reads his next message, a wrong card prints garbage and is struck, and an arrest re-keys the cell so its cards fail': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const X = window.__vault, net = X.postNet('abc'), first = net.order[0];
        const day1 = run => { X.postMsgs(run, 1).forEach(m => X.postLearn(run, m, 'hand')); };
        const right = X.postNew('abc'); day1(right); const fitsR = X.cardFits(right, first, 'FIX').ok, fitsS = X.cardFits(right, first, 'STEP').ok, fitsD = X.cardFits(right, first, 'DATE').ok;
        X.postFile(right, first, 'FIX'); X.postEndDay(right); const m2 = X.postMsgs(right, 2).find(m => m.o === first);
        const wrong = X.postNew('abc'); day1(wrong); X.postFile(wrong, first, 'STEP'); X.postEndDay(wrong); const w2 = X.postMsgs(wrong, 2).find(m => m.o === first), f = wrong.failed[w2.id];
        const letters = s => s.replace(/[^A-Z]/g, ''), garbage = f && f.text && !letters(w2.plain).startsWith(letters(f.text).slice(0, 12));
        // re-keying: read everyone up to day 6 with true cards, then arrest a man and watch his cell's cards fail the next day
        const run = X.postNew('abc'); let failedAfter = 0, readAfter = 0, cell = [];
        for (let d = 1; d <= 6; d++) { X.postMsgs(run, d).forEach(m => { X.postLearn(run, m, 'hand'); }); for (const o of [0, 1, 2, 3, 4, 5]) if (run.logs[o] && !run.cards[o]) { const rule = X.postMsgs(run, d).find(m => m.o === o)?.rule; if (rule) X.postFile(run, o, rule); } X.postEndDay(run); }
        const target = net.ops.find(o => o.role === 'agent' && X.postStatus(run, o.id, run.day) === 'air' && net.ops.some(q => q.id !== o.id && q.h === o.h && run.cards[q.id]));
        run.arrests.push({ o: target.id, day: run.day, how: 'arrest' }); cell = net.ops.filter(q => q.id !== target.id && (q.h === target.h || q.id === target.h) && run.cards[q.id]).map(q => q.id);
        const ev = X.postEndDay(run);
        X.postMsgs(run, run.day).forEach(m => { if (cell.includes(m.o)) { if (run.failed[m.id]) failedAfter++; if (run.read[m.id] === 'card') readAfter++; } });
        return { fitsR, fitsS, fitsD, read2: right.read[m2.id], wrongRead: !!wrong.read[w2.id], struck: (wrong.struck[first] || []).length, garbage, cardGone: !wrong.cards[first], cell: cell.length, failedAfter, readAfter, rekeyNote: X.postMsgs(run, run.day).filter(m => cell.includes(m.o)).every(m => m.plain.includes('IS TAKEN')) };
      });
      ok(r.fitsR && r.fitsS && !r.fitsD, 'day-1 card fits wrong: ' + JSON.stringify(r));
      eq(r.read2, 'card'); ok(!r.wrongRead && r.struck === 1 && r.cardGone && r.garbage, 'wrong card did not visibly fail: ' + JSON.stringify(r));
      ok(r.cell > 0 && r.failedAfter === r.cell && r.readAfter === 0 && r.rekeyNote, 're-key did not fail the cell\'s cards: ' + JSON.stringify(r));
    },
    'acting: a watched strike catches the man, an unwatched one does damage; arrest needs his address; taking a handler sends his agents to ground': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const X = window.__vault, net = X.postNet('abc'), s0 = net.strikes.find(s => s.day === 3 && net.ops[s.o].arr === 1);
        const a = X.postNew('abc'); X.postMsgs(a, 1).forEach(m => X.postLearn(a, m, 'hand')); const known = X.postKnown(a).strikes.has(s0.s); X.postWatch(a, s0.s); X.postEndDay(a); X.postEndDay(a); X.postEndDay(a);
        const b = X.postNew('abc'); X.postEndDay(b); X.postEndDay(b); X.postEndDay(b);
        const c = X.postNew('abc'); const noAddr = X.postArrest(c, net.order[0]);
        const h = net.ops[1], agents = net.ops.filter(o => o.h === 1).map(o => o.id), d = X.postNew('abc'); for (let k = 1; k < Math.max(h.arr, ...agents.map(o => net.ops[o].arr)); k++) X.postEndDay(d);
        d.arrests.push({ o: 1, day: d.day, how: 'arrest' }); X.postEndDay(d);
        const fled = agents.every(o => X.postStatus(d, o, d.day) === 'fled') && !X.postMsgs(d, d.day).some(m => agents.includes(m.o));
        return { known, caught: a.arrests.some(x => x.o === s0.o && x.how === 'caught'), dmgA: a.damage, dmgB: b.damage, value: s0.value, noAddr, fled };
      });
      ok(r.known && r.caught && r.dmgA === 0, 'watch did not catch: ' + JSON.stringify(r)); eq(r.dmgB, r.value); ok(!r.noAddr, 'arrested without an address'); ok(r.fled, 'agents of a taken handler stayed on the air');
    },
    'bots: careful analysts (read, watch, draw threads) beat listeners who never act and reckless arresters on average; the dossier compares you with 64 of them': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const X = window.__vault, seeds = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10'];
        const sc = pol => seeds.map(s => X.postSim(s, pol, 7)); const comp = sc({ read: 1, act: 1, thr: 1 }), naive = sc({ read: 1, act: 0, thr: 0 }), reck = sc({ read: .8, reckless: 1, thr: .5 }), half = sc({ read: .5, act: .5, thr: .3, guess: .5 });
        const pop = X.postPop('a1'), spread = Math.max(...pop) - Math.min(...pop);
        return { comp, naive, reck, half, spread, beatN: comp.filter((v, k) => v > naive[k]).length, beatR: comp.filter((v, k) => v > reck[k]).length, beatH: comp.filter((v, k) => v > half[k]).length }; });
      const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
      ok(r.beatN >= 9 && r.beatH >= 9 && mean(r.comp) > mean(r.reck) + 40, JSON.stringify(r)); ok(r.spread >= 100, 'bot population too narrow: ' + r.spread);
    },
    'Listening Post through the page: break day 1 on the wheel, file a card, end the day, the card reads day 2; the run survives a reload; a fortnight ends in a dossier': async ({ page, ok, eq }) => {
      await page.evaluate(() => { const X = window.__vault; for (let i = 0; i < 3; i++) X.S.solved[i] = { stars: 3, time: 0 }; X.S.post.run = null; X.openVault(X.POST); });
      ok(await page.evaluate(() => document.getElementById('pDaily').textContent.includes('network')), 'no daily network');
      await page.click('#pNew'); await page.click('.ptr');
      const k = await page.evaluate(() => window.__vault.V[window.__vault.POST].msg.key.k);
      for (let j = 0; j < k; j++) await page.click('[data-a="k+"]');
      await page.waitForTimeout(2400);
      ok(await page.evaluate(() => Object.values(window.__vault.S.post.run.read).includes('hand')), 'day 1 did not break');
      await page.click('#pCard'); await page.click('[data-card="FIX"]'); await page.click('#pEnd'); await page.waitForTimeout(150);
      ok(await page.evaluate(() => [...document.querySelectorAll('.ptr .pst')].some(e => e.textContent === 'READ BY CARD')), 'card did not read day 2');
      ok(await page.evaluate(() => (localStorage.getItem('rh:vault') || '').length < 60000), 'save too big');
      await page.reload(); await page.waitForFunction(() => window.__vault);
      eq(await page.evaluate(() => window.__vault.S.post.run.day), 2);
      await page.evaluate(() => { const X = window.__vault, run = X.S.post.run; while (run.day < X.DAYS) X.postEndDay(run); X.postDash(); });
      await page.click('#pEnd'); await page.waitForTimeout(150); await page.click('.modal-bg .primary'); await page.waitForTimeout(300);
      const dossier = await page.evaluate(() => document.querySelector('.modal')?.textContent || '');
      ok(/dossier/i.test(dossier) && /simulated analysts/.test(dossier) && /resident/.test(dossier), 'no dossier: ' + dossier.slice(0, 120));
    },
    'Era I: no modal on arrival and the first vault is one click from opening; a fortnight rarely repeats a sentence': async ({ page, ok }) => {
      const r = await page.evaluate(() => { localStorage.clear(); return 1; });
      await page.reload(); await page.waitForFunction(() => window.__vault);
      ok(!(await page.$('.modal-bg')), 'a modal greets a new player');
      ok(await page.isVisible('[data-a="k+"]'), 'the shift wheel is not on screen');
      const rep = await page.evaluate(() => { const X = window.__vault, run = X.postNew('variety'), c = {}; let n = 0;
        for (let d = 1; d <= 8; d++) X.postMsgs(run, d).forEach(m => m.plain.split(/(?<=[.!?])\s+/).forEach(t => { if (t.length > 25 && !/^(REPORT|TELL|I PAID|MY NEW|ON |THE NEW)/.test(t)) { n++; c[t] = (c[t] || 0) + 1; } }));
        return { n, dup: Object.values(c).filter(x => x > 2).length }; });
      ok(rep.dup <= 3, 'sentences repeat too often: ' + JSON.stringify(rep));
    },
    'phone: level list is a drawer behind a labelled button; picking a level closes it': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
      const off = await page.evaluate(() => document.getElementById('side').getBoundingClientRect().right <= 0);
      ok(off, 'list visible without opening the drawer');
      ok(await page.isVisible('#lvlBtn'), 'no drawer button');
      await page.click('#lvlBtn'); await page.waitForTimeout(300);
      ok(await page.evaluate(() => document.body.classList.contains('drawer') && document.getElementById('side').getBoundingClientRect().left >= 0), 'drawer did not open');
      await page.click('#side .vlt:not(.locked) >> nth=1'); await page.waitForTimeout(300);
      ok(!(await page.evaluate(() => document.body.classList.contains('drawer'))), 'drawer stayed open');
      await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(150);
      ok(!(await page.isVisible('#lvlBtn')), 'drawer button on desktop');
    },
  },
};
