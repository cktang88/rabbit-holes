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
  const letterKeys = () => { const ks = []; for (const L of V.letters.filter(L => !E.letterDone(L, D.sealed)).slice(0, 4)) L.targets.forEach((k, i) => { const st = L.steps[i] || {}; if (!st.hidden && st.from == null) ks.push(k); }); return ks; };
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
    const tried = {}; let probe = null, streak = [], doubted = new Set(), nearList = [], ver = '', P = null, sureQ = [], order = [];
    const certain = k => {
      const s = V.slotOf[k], c = cands(k, P).filter(x => !x.strike);
      if (!c.length) return !tr() && Math.abs(R[s.e].y - V.lost) < 50 ? undefined : null;
      if (c.length === 1 && !c[0].other && !E.mayBeAbsent(V, s, tr())) return c[0].id;
      return undefined;
    };
    const resets = {};
    const options = k => { const c = cands(k, P).filter(x => !x.strike); const main = c.filter(x => !x.other).sort((x, y) => fit(k, x) - fit(k, y)), oth = c.filter(x => x.other).sort((x, y) => fit(k, x) - fit(k, y)); const all = [...main.map(x => x.id), ...oth.map(x => x.id), null];
      let o = all.filter(a => !(tried[k] || []).includes(a));
      if (!o.length && (resets[k] || 0) < 2) { resets[k] = (resets[k] || 0) + 1; tried[k] = []; o = all; } // every option failed: some evidence was bad, so look again
      return o; };
    const near = () => { // the letters' entries, and what lies one or two threads from them, come first
      const f = new Set(letterKeys()); for (let hop = 0; hop < 2; hop++) for (const k of [...f]) for (const id of [V.slotOf[k].e, ...V.base[k]]) { for (const k2 of (R[id].sl || [])) f.add(k2); for (const k3 of (V.rev[id] || [])) f.add(k3); }
      return [...f];
    };
    while (acts < budget && !done()) {
      const v = Object.keys(D.sealed).length + ':' + D.ver;
      if (v !== ver) { ver = v; P = E.persons(V, D.sealed); const nr = near(); nearList = nr; order = [...new Set([...nr, ...V.slots.map(s => s.key)])].filter(k => !(k in D.sealed) && visible(V.slotOf[k])); sureQ = order.filter(k => !doubted.has(k)).map(k => [k, certain(k)]).filter(x => x[1] !== undefined); }
      if (probe) {
        if (!(probe[0] in D.sealed)) { (tried[probe[0]] ||= []).push(probe[1]); streak.push(probe); E.deskUnpin(V, D, probe[0]); acts++; }
        else streak = [];
        probe = null;
        // four doubtful threads in a row failed beside the same 'sure' pins: one of those was never sure. Cut them, and doubt them.
        if (streak.length >= 4) { for (const p of D.pins.slice()) { (tried[p[0]] ||= []).push(p[1]); doubted.add(p[0]); E.deskUnpin(V, D, p[0]); acts++; } for (const p of streak) tried[p[0]] = (tried[p[0]] || []).filter(a => a !== p[1]); streak = []; }
        continue;
      }
      if (D.pins.length >= E.MAXPINS) { const p = D.pins[0]; E.deskUnpin(V, D, p[0]); acts++; continue; }
      if (D.pins.length < 2) { const nx = sureQ.find(x => !(x[0] in D.sealed) && !pinned(x[0]) && !doubted.has(x[0])); if (nx) { E.deskPin(V, D, nx[0], nx[1]); acts++; continue; } }
      // two sure threads wait on the cushion: a third pin tests a doubtful one, and the seal (or its absence) is the answer
      // the most constrained doubtful slot near the open letters (fewest live options) is tested first
      let best = null, bn = 1e9; const sureSet = new Set(sureQ.filter(x => !doubted.has(x[0])).map(x => x[0]));
      for (const k of nearList) { if (k in D.sealed || pinned(k) || sureSet.has(k) || !visible(V.slotOf[k])) continue; const o = options(k); if (o.length && o.length < bn) { bn = o.length; best = [k, o[0]]; if (bn === 1) break; } }
      if (!best) for (const k of order) { if (k in D.sealed || pinned(k) || sureSet.has(k)) continue; const o = options(k); if (o.length) { best = [k, o[0]]; break; } }
      if (!best) { const nx = sureQ.find(x => !(x[0] in D.sealed) && !pinned(x[0]) && !doubted.has(x[0])); if (!nx) break; E.deskPin(V, D, nx[0], nx[1]); acts++; continue; }
      const before = Object.keys(D.sealed).length; E.deskPin(V, D, best[0], best[1]); acts++;
      if (Object.keys(D.sealed).length === before && D.pins.length >= 3) probe = best;
    }
  }
  if (typeof process !== 'undefined' && process.env.PDEBUG) for (const x of V.secrets) if (!E.secretOut(V, x, D.sealed)) { const ks = x.atLeast ? x.many : [...x.need, ...(x.any || []).slice(0, 2)]; console.log(' missing', x.k, ks.map(k => { const s = V.slotOf[k], e = R[s.e]; return `${k}${k in D.sealed ? '[S]' : ''} ${e.t}${e.y} truth=${s.truth} cands=${JSON.stringify(E.candidates(V, k, D.sealed, true).map(c => c.id + (c.strike ? 'x' : '') + (c.other ? 'o' : '')))}`; }).join(' | ')); }
  return { secrets: secretsOut(), seals: Object.keys(D.sealed).length, cut: D.cut, acts, letters: V.letters.filter(L => E.letterDone(L, D.sealed)).length, slots: V.slots.length };
}
if (typeof module !== 'undefined') module.exports = { parishBot };
