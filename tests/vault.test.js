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
      const r = await page.evaluate(() => { const V = window.__vault.V; return { n: V.length, per: [0, 1, 2, 3, 4, 5].map(e => V.filter(v => v.e === e).length), ids: new Set(V.map(v => v.id)).size }; });
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
        X.openVault(i); const before = X.build(i).cipher; X.workOf(i).stages[0].s.k = 7; const left0 = X.alarmLeft(i);
        for (let t = 0; t < X.V[i].alarm; t++) X.alarmTick(i);
        return { i, left0, alarm: X.V[i].alarm, changed: X.build(i).cipher !== before, variant: X.S.variant[i], k: X.workOf(i).stages[0].s.k, t: X.workOf(i).stages[0].t, left: X.alarmLeft(i), shown: !!document.getElementById('alarm') };
      });
      eq(r.left0, r.alarm); ok(r.changed, 'same intercept after alarm'); eq(r.variant, 1); eq([r.t, r.k], ['shift', 0]); eq(r.left, r.alarm); ok(r.shown);
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
