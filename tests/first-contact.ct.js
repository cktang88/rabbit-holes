// Bots for First Contact's open channel (run in the page). Each plays one contact through the same calls the UI makes
// and returns {t, par}: the round trips it needed and the contact's par.
//  competent - knows their grammar: answers the handshake, asks each dossier question in their word order, files the answers
//  english   - asks with English grammar (subject-verb-object, number word before the noun, question word first);
//              when they do not understand, it guesses the dossier numbers instead
//  random    - sends random strings of the glyphs it has seen, then guesses numbers
function ctBot(seed, policy) {
  const fc = window.__fc; fc.ctEnter(seed); const C = fc.CT, L = C.L, rnd = RH.rng('ctbot' + seed + policy);
  const seenW = [...new Set([...C.tx.flatMap(t => t.words), ...C.hs.words])];
  // handshake: competent and english know the swap from "you" to "we"; random needs many tries and then is shown it
  if (policy === 'random') { for (let k = 0; k < 6 && !fc.ctHandshake(seenW.slice(0, 1 + rnd.int(5)).map(() => seenW[rnd.int(seenW.length)])).ok;) k++; }
  fc.ctHandshake(C.hs.ans);
  const guess = it => { for (let k = 0; k < 300 && fc.CT && !fc.X.cur.done && fc.X.cur.dos[it] !== C.val[it]; k++) fc.ctFile(it, rnd.int(16)); };
  const read = rep => rep && rep.kind === 'answer' ? rep.val : null;
  for (const it of C.items) {
    if (fc.X.cur.dos[it] === C.val[it]) continue;
    if (policy === 'competent') {
      if (it === 'ftot') { fc.ctFile(it, L.base); continue; }
      if (it === 'fpa' && C.items.includes('arms')) { fc.ctFile(it, L.base / C.val.arms); continue; }
      if (it === 'moons' && !C.items.includes('home')) fc.ctSend(fc.ctQuestion(C, 'home'));
      fc.ctFile(it, read(fc.ctSend(fc.ctQuestion(C, it)))); continue;
    }
    if (policy === 'english') {
      const keep = { order: L.order, numAfter: L.numAfter, plural: L.plural, qPos: L.qPos };
      Object.assign(L, { order: 'SVO', numAfter: false, plural: 'marker', qPos: 'initial' });
      let q; try { q = fc.ctQuestion(C, it); } finally { Object.assign(L, keep); }
      const v = read(fc.ctSend(q)); if (v != null) fc.ctFile(it, v); else guess(it); continue;
    }
    for (let k = 0; k < 2; k++) { const v = read(fc.ctSend(Array.from({ length: 2 + rnd.int(5) }, () => seenW[rnd.int(seenW.length)]))); if (v === C.val[it]) { fc.ctFile(it, v); break; } }
    guess(it);
  }
  return { t: fc.X.cur.t, par: C.par, done: fc.X.cur.done };
}
module.exports = { ctBot };
