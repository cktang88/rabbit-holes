// Scripted decoders for First Contact (run in the page). Each answers every question of chapter ci with up to 25 transmissions.
//  random  - random strings of glyphs it has seen
//  echo    - the obvious move: send back the question's own symbols, or a frame from the transmission
//  english - competent but simple: knows every word and the number base, but builds sentences with English grammar
//            (subject-verb-object, number before noun, a plural word, "not" before the verb); on a miss it then gets it right
//  solver  - knows the language
function fcBot(ci, policy) {
  const fc = window.__fc, CH = fc.CH, L = fc.LANG, seen = fc.seenUpTo(ci), rnd = RH.rng('fcb' + ci + policy + fc.S.seed);
  let ENG = null; // the same transmissions, rebuilt as if they spoke with English grammar
  if (policy === 'english') { const save = { order: L.order, numAfter: L.numAfter, plural: L.plural, neg: L.neg, qPos: L.qPos, tenseFinal: L.tenseFinal };
    Object.assign(L, { order: 'SVO', numAfter: false, plural: 'marker', neg: 'before', qPos: 'initial', tenseFinal: false });
    try { ENG = fc.buildChapters(); } finally { Object.assign(L, save); } }
  const english = q => ENG[ci].qs[CH[ci].qs.indexOf(q)].ans;
  CH[ci].qs.forEach((q, k) => {
    const id = ci + ':' + k; let tries = 0;
    const send = w => { tries++; return w && w.length && fc.transmit(id, w).ok; };
    if (policy === 'solver') { send(q.ans); return; }
    if (policy === 'english') { const e = english(q); if (e && e.join() !== q.ans.join()) send(e); send(q.ans); return; }
    while (!fc.S.solved[id] && tries < 25) {
      if (policy === 'echo') { const tx = CH[ci].tx; send(tries === 0 && q.words ? q.words : tx[rnd.int(tx.length)].words); }
      else { const n = 1 + rnd.int(q.ans.length + 1), w = []; for (let j = 0; j < n; j++) w.push(seen[rnd.int(seen.length)]); send(w); }
    }
  });
  return fc.chStars(ci);
}
module.exports = { fcBot };
