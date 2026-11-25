// Readers for Parish (run in the page, or in Node against the engine). They see only what a player sees:
// each slot's candidates, what sealed links strike out, the letters, and whether three pins sealed.
//  random   - pins any candidate (or "not in this book") for any open slot; when the pins jam, pulls a random one
//  first    - fixed: the first candidate listed, or "not in this book"; when jammed, cuts every pin and moves on
//  nearest  - fixed: the unstruck same-surname candidate whose age fits best, else "not in this book"; when jammed, cuts all
//  reader   - adaptive: pins what the book leaves certain, tests one doubtful thread at a time beside two sure ones,
//             reads the seals as evidence, follows the letters, and lets the curate file the plain links
function parishBot(E, seed, name, budget) {
  const V = E.makeVillage(seed), D = E.newDesk(), R = V.reg; let acts = 0, rs = 7 + seed, curated = -1;
  const rnd = n => { rs = (rs * 1103515245 + 12345) % 2147483648; return rs % n; };
  const tr = () => Object.keys(D.sealed).length >= E.TRANSCRIPT_AT;
  const visible = sl => tr() || !R[sl.e].lost;
  const cands = (k, P) => E.candidates(V, k, D.sealed, tr(), P);
  const secretsOut = () => V.secrets.filter(x => E.secretOut(V, x, D.sealed)).length;
  const pinned = k => D.pins.some(p => p[0] === k);
  const done = () => secretsOut() === 4;
  const curate = () => { const n = Object.keys(D.sealed).length; if (n >= E.CURATE_AT && n - curated >= 6) { E.curateFile(V, D, tr()); curated = n; acts++; } };
  // letters: the reader looks first at what the letters name (the visible targets), and at entries those lead to
  const letterKeys = () => { const ks = []; for (const L of V.letters) L.targets.forEach((k, i) => { const st = L.steps[i] || {}; if (!st.hidden && st.from == null) ks.push(k); }); return ks; };
  const fit = (k, c) => { const s = V.slotOf[k], e = R[s.e], x = R[c.id]; if (s.k === 'g') return Math.abs(e.d - x.d - 27); if (s.k === 'b') return Math.abs(e.d - x.d - 24); if (s.k === 'd') return Math.abs(e.d - x.d - e.w.age); return Math.abs(e.d - x.d - 6); };
  if (name === 'random') {
    const open = () => V.slots.filter(s => visible(s) && !(s.key in D.sealed));
    while (acts < budget && !done()) {
      if (D.pins.length >= E.MAXPINS) { E.deskUnpin(V, D, D.pins[rnd(D.pins.length)][0]); acts++; continue; }
      const o = open().filter(s => !pinned(s.key)); if (!o.length) break; const s = o[rnd(o.length)];
      const c = cands(s.key); const opts = [...c.map(x => x.id), null]; E.deskPin(V, D, s.key, opts[rnd(opts.length)]); acts++;
    }
  } else if (name === 'first' || name === 'nearest') {
    const order = [...new Set([...letterKeys(), ...V.slots.map(s => s.key)])];
    let i = 0;
    while (acts < budget && !done() && i < order.length * 2) {
      curate();
      const k = order[i++ % order.length], s = V.slotOf[k]; if (k in D.sealed || pinned(k) || !visible(s)) continue;
      const c = cands(k); let a = null;
      if (name === 'first') a = c.length ? c[0].id : null;
      else { const m = c.filter(x => !x.strike && !x.other).sort((x, y) => fit(k, x) - fit(k, y)); a = m.length ? m[0].id : null; }
      E.deskPin(V, D, k, a); acts++;
      if (D.pins.length >= E.MAXPINS) { while (D.pins.length) { E.deskUnpin(V, D, D.pins[0][0]); acts++; } }
    }
  } else { // the adaptive reader
    const tried = {}; let probe = null;
    const certain = (k, P) => {
      const s = V.slotOf[k], c = cands(k, P).filter(x => !x.strike);
      if (!c.length) return !tr() && Math.abs(R[s.e].y - V.lost) < 50 ? undefined : null;
      if (c.length === 1 && !c[0].other && !E.mayBeAbsent(V, s, tr())) return c[0].id;
      return undefined;
    };
    const options = (k, P) => { const c = cands(k, P).filter(x => !x.strike); const main = c.filter(x => !x.other).sort((x, y) => fit(k, x) - fit(k, y)), oth = c.filter(x => x.other).sort((x, y) => fit(k, x) - fit(k, y)); return [...main.map(x => x.id), ...oth.map(x => x.id), null].filter(a => !(tried[k] || []).includes(a)); };
    let stall = 0;
    while (acts < budget && !done()) {
      curate();
      if (D.pins.length >= E.MAXPINS) { const p = D.pins[0]; (tried[p[0]] ||= []).push(p[1]); E.deskUnpin(V, D, p[0]); acts++; probe = null; continue; }
      const P = E.persons(V, D.sealed), prio = [...new Set([...letterKeys(), ...V.secrets.length ? [] : []])];
      const focusKeys = new Set(prio);
      // the entries the letters name, and every slot one thread away from them, come first
      for (const k of prio) { const e = R[V.slotOf[k].e]; for (const c of cands(k, P)) { for (const k2 of (R[c.id].sl || [])) focusKeys.add(k2); for (const k3 of (V.rev[c.id] || [])) focusKeys.add(k3); } }
      const all = [...focusKeys, ...V.slots.map(s => s.key)].filter((k, i, a) => a.indexOf(k) === i && !(k in D.sealed) && visible(V.slotOf[k]));
      const sure = D.pins.filter(p => p[0] !== (probe && probe[0])).length;
      // keep two sure pins waiting, so a third pin tests a doubtful thread
      if (probe) { // the probe did not seal: it was wrong
        if (probe[0] in D.sealed) probe = null;
        else { (tried[probe[0]] ||= []).push(probe[1]); E.deskUnpin(V, D, probe[0]); acts++; probe = null; continue; }
      }
      let placed = false;
      if (sure < 2) { for (const k of all) { if (pinned(k)) continue; const a = certain(k, P); if (a !== undefined) { const r = E.deskPin(V, D, k, a); acts++; placed = true; break; } } }
      if (placed) continue;
      if (sure >= 2 || !placed) { // test the most promising doubtful slot near the letters
        let best = null;
        for (const k of all) { if (pinned(k)) continue; if (certain(k, P) !== undefined) continue; const o = options(k, P); if (o.length) { best = [k, o[0]]; break; } }
        if (!best) break;
        const before = Object.keys(D.sealed).length; E.deskPin(V, D, best[0], best[1]); acts++;
        if (Object.keys(D.sealed).length === before) { if (sure >= 2) probe = best; else if (++stall > 50) break; }
      }
    }
  }
  return { secrets: secretsOut(), seals: Object.keys(D.sealed).length, cut: D.cut, acts, letters: V.letters.filter(L => E.letterDone(L, D.sealed)).length, slots: V.slots.length };
}
if (typeof module !== 'undefined') module.exports = { parishBot };
