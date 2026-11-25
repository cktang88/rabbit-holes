// Canal Mania in the page: The Canal Age (1790–1860). Shares the page's map, section, lock card and tools (index.html);
// the economy, the calendar and the bots live in age.js. Every decision goes through AGE.act, so a game is a seed and a log.
'use strict';
const AGE = window.AGE;
let G = null, evIdx = 0, speedBefore = 1, FIELDA = {};
COMS.splice(COMS.findIndex(c => c.id === 'daily'), 0, { id: 'age', n: 'The Canal Age, 1790–1860', age: 1,
  story: 'The company has <b>£280k</b> of capital and seventy years. Water is the whole game: a canal fills only from the <b>streams it crosses</b>, and every boat through a lock spends a lockful of it downhill, for good. <b>Drag from a town</b> to dig your first canal; the prospectus shows what it would earn. Mills and pits will settle along your water, and the railways come about 1830.' });
const NEXT = ['res', 'pair', 'double', 'pump', 'plane', 'fly'];
const TEASE = { res: ['⛲', 'when a summit runs dry'], pair: ['⇄', 'when drought comes'], double: ['⇉', 'when the locks queue'], pump: ['⤒', 'when your canal reaches coal'], plane: ['⟋', 'with coal, after 1812'], fly: ['⚡', 'when the railway comes'] };
const PAUSE = new Set(['unlock', 'rival', 'rail', 'offer']);

// ================= loading, saving, rewinding =================
function ageSave() {
  if (!G) return; SAVE.age = { seed: G.seed, log: AGE.encLog(G.log), m: G.m, draft: mode === 'survey' ? K.enc(D) : '' };
  try { persist(); } catch (e) {}
}
function ageLoad(i, sd) {
  Cm = COMS[i]; SAVE.cur = i;
  const sv = isObj(SAVE.age) ? SAVE.age : null, seedA = sd || (sv && Number.isInteger(sv.seed) && sv.seed > 0 ? sv.seed : dailySeed());
  let log = [], m = 0; if (sv && sv.seed === seedA) { log = AGE.decLog(sv.log); m = Number.isInteger(sv.m) && sv.m >= 0 ? Math.min(sv.m, AGE.E.YEARS * 12) : 0; }
  try { G = log.length ? AGE.replay(seedA, log, m) : AGE.newGame(seedA); } catch (e) { G = AGE.newGame(seedA); }
  M = G.M; seed = seedA; bake(); evIdx = G.events.length;
  D = K.clone(G.D); if (!G.log.length && sv && sv.seed === seedA && sv.draft) { const d2 = K.dec(sv.draft); if (d2) D = d2; }
  mode = G.over ? 'done' : G.log.length ? 'run' : 'survey'; speed = 0; st = G.st; runAn = G.an; an = G.an; lastRec = null; boats = []; hist = []; sel = -1; tool = 'dig'; fore = null;
  closeInsp(); closeNote(); openProf(false); pulseOpen = false; events = {};
  clearTimeout(banner.h); $('banner').classList.remove('on'); $('banner').innerHTML = ''; $('sign').classList.remove('on'); document.querySelectorAll('.modal-bg').forEach(e => e.remove());
  $('tName').textContent = 'The Canal Age · #' + seedA; $('story').innerHTML = Cm.story; setMini(mode !== 'survey');
  ageSave(); reanalyse(); renderLevels(); requestAnimationFrame(() => { fitMap(); kick(); });
  if (mode === 'survey') setTimeout(() => { if (G && !G.hint && mode === 'survey') { G.hint = AGE.firstHint(G); kick(); } }, 60);
  if (mode === 'run') banner('Welcome back', `${monthName(G.m)}. Press ▶ to carry on.`, 2200);
  if (mode === 'done') setTimeout(ageFinish, 300);
}
function ageRewind(years) {
  const target = Math.max(0, G.m - 12 * years), log = G.log.filter(a => a.m < target || (a.m === target && a.k !== 'sell'));
  G = AGE.replay(G.seed, log, target); M = G.M; evIdx = G.events.length; D = K.clone(G.D); mode = G.log.length ? 'run' : 'survey'; speed = 0; an = G.an; runAn = G.an; st = G.st; lastRec = null; boats = [];
  document.querySelectorAll('.modal-bg').forEach(e => e.remove()); closeNote(); ageSave(); reanalyse(); banner('Rewound', `Back to ${monthName(G.m)}. Press ▶ when ready.`, 2200);
}

// ================= designing and building =================
function ageReanalyse() {
  if (!G) return;
  if (mode === 'survey') {
    an = K.analyse(M, K.clone(D)); fore = D.paths.length ? AGE.forecast(G, D, 120) : null;
    if (fore && fore.low < .2 && !G.unlocked.has('res')) { AGE.unlock(G, 'res'); ageDrainNews(); }
    ageSave();
  } else if (mode === 'run' && K.enc(D) !== K.enc(G.D)) { // works while the canal is open: a costed proposal first, paid from the bank
    const price = AGE.priceOf(G, D); an = K.analyse(M, K.clone(D));
    propose(K.clone(D), price);
  } else { an = G.an; }
  hud(); renderTools(); kick();
}
// the engineer's proposal: price now against the prospectus for the next ten years, with and without the works
function propose(D2, price) {
  if (speed) speedBefore = speed; speed = 0; const left = Math.min(120, AGE.E.YEARS * 12 - G.m), base = AGE.forecast(G, null, left), withW = AGE.forecast(G, D2, left), gain = withW.net - base.net;
  const water = withW.lostW - base.lostW, afford = price <= G.cash + 1e-6;
  let el = $('note'); if (!el) { el = document.createElement('div'); el.id = 'note'; el.className = 'chip'; document.body.appendChild(el); }
  el.innerHTML = `<h4>The engineer's estimate</h4><div>These works cost <b>${fmtK(price)}</b> now (the bank holds ${fmtK(G.cash)}).</div>
    <div>Over the next ${Math.round(left / 12)} years they would ${gain >= 0 ? 'add' : 'cost'} <b>${fmtK(Math.abs(gain))}</b> in net tolls${Math.abs(water) > 5 ? `, and ${water > 0 ? 'strand' : 'save'} <b>${Math.round(Math.abs(water) / (left / 12))}</b> boats a year for want of water` : ''}.</div>
    <div class="opts"><button class="tool go" id="pBuild" ${afford ? '' : 'disabled'}>${afford ? 'Build it' : 'Not enough in the bank'}</button><button class="tool" id="pNo">Cancel</button></div>`;
  el.style.display = 'block';
  $('pBuild').onclick = () => { closeNote(); if (AGE.act(G, { k: 'build', d: K.enc(D2) })) { if (price > .5) { toastWorks(price); FX.sfx('coin'); } ageSave(); } D = K.clone(G.D); an = runAn = G.an; st = G.st; speed = speedBefore || 1; hud(); renderTools(); kick(); };
  $('pNo').onclick = () => { closeNote(); D = K.clone(G.D); an = runAn = G.an; speed = speedBefore || 1; FX.sfx('click'); hud(); renderTools(); kick(); };
}
function toastWorks(price) { banner('', `Works done: ${fmtK(price)} from the bank.`, 1400); }
function ageOpen() {
  if (!D.paths.length) { banner('', 'Dig your first canal: drag from a town.', 2200); FX.sfx('fail'); return; }
  const price = AGE.priceOf(G, D);
  if (price > G.cash) { banner('Beyond the capital', `This canal costs ${fmtK(price)}; the proprietors subscribed ${fmtK(G.cash)}. Shorten it, or hold a level.`, 3000); FX.sfx('fail'); return; }
  if (!AGE.act(G, { k: 'build', d: K.enc(D) })) return;
  D = K.clone(G.D); mode = 'run'; speed = 1; an = runAn = G.an; st = G.st; lastRec = null; boats = []; closeInsp(); setMini(true);
  banner('The canal is open', `${AGE.E.START}: seventy years of trade begin`, 2200); FX.sfx('win'); ageSave(); renderTools(); hud(); kick();
}
function ageStepOne() {
  const rec = AGE.step(G); if (!rec) { ageFinish(); return; }
  lastRec = rec; an = runAn = G.an; st = G.st;
  ageDrainNews();
  G.an.routes.forEach((r, ri) => { const n = Math.min(3, Math.round((rec.flows[ri] || 0) / 14 + Math.random() * .5)); for (let k2 = 0; k2 < n && boats.length < 60; k2++) boats.push({ route: r, s: 0, dir: Math.random() < .5 ? 1 : -1, delay: Math.random() * .5, col: ['#e0663a', '#2f9e8f', '#e9b53b', '#6b5bd2', '#d8456b', '#3a7bd5'][(Math.random() * 6) | 0], wait: 0 }); });
  if (rec.rev > .3 && Math.random() < .3) FX.sfx('coin');
  if (G.m % 12 === 0) { ageSave(); const y = G.years[G.years.length - 1]; if (y) ledgerLine(y); }
  if (G.over) ageFinish();
}
function ledgerLine(y) { // the proprietors' annual report, one line
  ageLedger = `${y.year}: ${Math.round(y.boats).toLocaleString()} boats, tolls ${fmtK(y.rev)}, net ${fmtK(y.net)}${y.lostW > y.boats * .15 ? `, ${Math.round(y.lostW)} turned away for water` : ''}${y.lostC > y.boats * .08 ? `, ${Math.round(y.lostC)} lost to queues` : ''}.`;
}
let ageLedger = '';
function ageDrainNews() {
  while (evIdx < G.events.length) { const n = G.events[evIdx++];
    if (PAUSE.has(n.kind) && mode === 'run') { if (speed) speedBefore = speed; speed = 0; showNote(n); renderTools(); }
    else if (PAUSE.has(n.kind)) showNote(n);
    else if ($('note') && $('note').style.display === 'block') { const x = $('noteAlso'); if (x) x.innerHTML += `<div>· ${n.t}</div>`; }
    else banner(n.t, n.s, n.kind === 'spawn' ? 2600 : 3000);
    if (n.kind === 'rail' && G.rails.length === 1) hangSign('The Railway Age', `${AGE.year(G)} · now, survive`);
    if (n.kind === 'unlock') FX.sfx('chime', 5); else if (n.kind === 'rival' || n.kind === 'rail') FX.sfx('warn'); }
}
// the news card: the game pauses; unlocks hand over their tool, offers ask for an answer
function showNote(n) {
  let el = $('note'); if (!el) { el = document.createElement('div'); el.id = 'note'; el.className = 'chip'; document.body.appendChild(el); }
  const T = n.unlock ? TEASE[n.unlock] : null;
  el.innerHTML = `<h4>${T ? T[0] + ' ' : ''}${n.t}</h4><div>${n.s}</div><div id="noteAlso" style="font-size:12px;color:#cdbf9a;margin-top:4px"></div><div class="opts">${n.kind === 'offer' ? `<button class="tool go" id="nSell">Sell for ${fmtK(G.offer.price)}</button><button class="tool" id="nOk">Refuse, fight on</button>` : `<button class="tool go" id="nOk">${n.unlock ? 'Show me' : 'Carry on'}</button>`}</div>`;
  el.style.display = 'block';
  $('nOk').onclick = () => { closeNote(); if (n.unlock === 'res') { tool = 'res'; banner('', 'Tap a ringed stream above your canal to dam it.', 2400); } else if (n.unlock && n.unlock !== 'fly') banner('', 'Tap a lock on the map for its card.', 2000); else if (n.unlock === 'fly') banner('', 'Tap a canal for its section card.', 2000); if (mode === 'run' && !speed) speed = speedBefore || 1; renderTools(); kick(); };
  if ($('nSell')) $('nSell').onclick = () => { closeNote(); if (AGE.act(G, { k: 'sell' })) { ageSave(); ageDrainNews(); ageFinish(); } };
}
function closeNote() { if ($('note')) $('note').style.display = 'none'; }

// ================= cards: a lock, a section =================
function ageLockCard(key) {
  const s = an.sites.find(z => z.key === key); if (!s) return; selSite = key; const el = $('insp'), U = G.unlocked, run = mode === 'run';
  const md = G.mode[key] || 'open', load = lastRec ? s.routes.reduce((a, ri) => a + (lastRec.flows[ri] || 0), 0) : null, wpb = s.w * (md === 'pair' ? .5 : 1);
  const kind = s.t === 'plane' ? 'Inclined plane' : s.t === 'stair' ? `Staircase of ${s.n}` : s.n > 1 ? `Flight of ${s.n} locks` : 'A lock';
  const opt = (attr, v, label, on, dis) => `<button class="tool${on ? ' on' : ''}" ${attr}="${v}" ${dis ? 'disabled' : ''}>${label}</button>`;
  el.innerHTML = `<button class="x" aria-label="Close">×</button><h4>${kind}${s.dbl ? ', doubled' : ''}${md !== 'open' ? ` · ${md === 'pair' ? 'paired' : 'SHUT'}` : ''}</h4>
    <div>Every boat spends <b>${wpb.toFixed(2)}</b> lockful${wpb === 1 ? '' : 's'} from the pound above · passes ${Math.round(s.cap * (md === 'pair' ? .6 : 1))} boats a month${load != null ? ` · last month <b>${Math.round(load)}</b>` : ''}</div>
    ${run && U.has('pair') ? `<div class="opts">${opt('data-m', 'open', 'Open', md === 'open')}${opt('data-m', 'pair', 'Paired: half the water, slower', md === 'pair')}${opt('data-m', 'shut', 'Shut', md === 'shut')}</div>` : ''}
    <div class="opts">${opt('data-t', 'flight', 'Flight', s.t === 'flight')}${opt('data-t', 'stair', 'Staircase', s.t === 'stair')}${U.has('plane') ? opt('data-t', 'plane', 'Inclined plane', s.t === 'plane') : ''}
      ${U.has('pair') ? opt('data-f', 'ponds', 'Side ponds', s.ponds, s.t === 'plane') : ''}${U.has('double') ? opt('data-f', 'dbl', 'Double it', s.dbl) : ''}${U.has('pump') ? opt('data-f', 'pump', 'Back-pump', s.pump) : ''}</div>
    <div style="margin-top:6px;font-size:12px;color:#cdbf9a">${run ? 'Works are paid from the bank at once. ' : ''}${{ flight: 'A flight passes one lockful per boat down the hill, whatever its rise.', stair: 'A staircase is cheaper, but each chamber is refilled: more water, and boats queue.', plane: 'A steam plane hauls boats up the slope with no water at all, but it is dear to build and to run.' }[s.t]}</div>`;
  el.style.display = 'block'; el.querySelector('.x').onclick = closeInsp;
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { AGE.act(G, { k: 'mode', key, v: b.dataset.m }); FX.sfx('click'); ageSave(); ageLockCard(key); kick(); });
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { if (mode === 'survey') snapshot(); D.locks[key] = { ...(D.locks[key] || {}), t: b.dataset.t }; if (b.dataset.t === 'plane') delete D.locks[key].ponds; FX.sfx('place'); reanalyse(); ageLockCard(key); });
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { if (mode === 'survey') snapshot(); const f = b.dataset.f, n = { ...(D.locks[key] || {}) }; if (n[f]) delete n[f]; else n[f] = 1; D.locks[key] = n; FX.sfx('click'); reanalyse(); ageLockCard(key); });
  kick();
}
function ageSectionCard(pi) {
  if (mode !== 'run') return; const p = G.D.paths[pi]; if (!p) return; const el = $('insp');
  const rts = G.an.routes.map((r, ri) => [r, ri]).filter(([r]) => r.cells.some(c => G.cellPath && G.cellPath.get(c) === pi));
  const boatsM = lastRec ? rts.reduce((a, [, ri]) => a + (lastRec.flows[ri] || 0), 0) : 0, rail = rts.some(([, ri]) => G.rf[ri] && G.rf[ri].rail < 1);
  el.innerHTML = `<button class="x" aria-label="Close">×</button><h4>Canal section ${pi + 1}</h4><div>${p.length} furlongs · ${Math.round(boatsM)} boats along it last month${rail ? ' · <b>trains compete here</b>' : ''}</div>
    ${G.unlocked.has('fly') ? `<div class="opts"><button class="tool${G.fly[pi] ? ' on' : ''}" id="sFly">Fly-boats ${G.fly[pi] ? 'running' : 'off'}</button></div><div style="font-size:12px;color:#cdbf9a;margin-top:4px">Express boats, day and night: a third quicker, so trade stays off the trains. About ${fmtK(.12 + .015 * p.length).replace('k', 'k')} a month to run.</div>` : '<div style="font-size:12px;color:#cdbf9a;margin-top:4px">Drag a pound in the section below to change its level (paid from the bank).</div>'}`;
  el.style.display = 'block'; el.querySelector('.x').onclick = closeInsp;
  if ($('sFly')) $('sFly').onclick = () => { AGE.act(G, { k: 'fly', pi, v: !G.fly[pi] }); FX.sfx('click'); ageSave(); ageSectionCard(pi); };
}

// ================= the HUD, the tools =================
function ageHud() {
  if (!G) return; const lab = (id, t) => { const e = document.querySelector('#' + id + ' span'); if (e && e.textContent !== t) e.textContent = t; };
  $('sub').textContent = G.rails.length ? 'The Railway Age' : 'Canal Mania';
  if (mode === 'survey') {
    const cost = an ? an.total * AGE.E.COST : 0; setText('vS', fmtK(cost)); lab('stS', `of ${fmtK(G.cash)}`); $('stS').className = 'stat' + (cost > G.cash ? ' bad' : '');
    setText('vR', fore ? fmtK(fore.net) : '–'); lab('stR', '10 yrs net'); setText('vD', fore && fore.net > 0 ? Math.round(cost / (fore.net / 10)) + ' yrs' : '–'); setText('lD', 'pays back in'); $('stD').className = 'stat' + (fore ? (fore.net > cost * .5 ? ' ok' : ' bad') : '');
    setText('vT', String(AGE.E.START)); setText('lT', 'survey'); $('stT').className = 'stat';
    setWater(fore ? fore.low : 1, fore ? 'forecast low' : '');
    $('goals').innerHTML = D.paths.length ? `Prospectus for ten years: ${fore ? Math.round(fore.boats / 10).toLocaleString() : 0} boats a year${fore && fore.lostW > fore.boats * .1 ? `, <i>${Math.round(fore.lostW / 10)} turned away for want of water</i>` : ''}. Press <i>▶ Open</i> when it pays.` : 'Drag from a town to dig. The port and the first pit want a canal.';
  } else {
    const ly = G.years[G.years.length - 1], net = ly ? ly.net : (G.yr.rev - G.yr.run) * 12 / Math.max(1, G.m % 12);
    setText('vS', fmtK(G.cash)); lab('stS', 'in the bank'); $('stS').className = 'stat' + (G.cash < 0 ? ' bad' : '');
    setText('vR', fmtK(net)); lab('stR', 'a year'); $('stR').className = 'stat' + (net < 0 ? ' bad' : '');
    setText('vD', fmtK(G.sold || AGE.value(G))); setText('lD', G.sold ? 'sold for' : 'company value'); $('stD').className = 'stat ok';
    setText('vT', monthName(Math.min(G.m, AGE.E.YEARS * 12 - 1))); setText('lT', mode === 'done' ? 'closed' : G.debt ? `in debt ${G.debt} mo` : K.inDrought(M, G.m) ? 'drought!' : speed ? 'open' : 'paused');
    $('stT').className = 'stat' + (K.inDrought(M, G.m) || G.debt ? ' bad' : '');
    // the water book at a glance: the pound that strands the most trade
    let worst = 1, wl = ''; if (lastRec) G.an.pounds.forEach((p, pi) => { if (p.cells.length < 2) return; const f = lastRec.fill[pi]; if (f < worst) { worst = f; wl = p.lv === Math.max(...G.an.pounds.map(q => q.lv)) ? 'summit' : 'pound ' + p.lv; } });
    setWater(worst, wl ? wl + (lastRec.dry.length ? ' · boats stopped' : '') : '');
    const pend = G.rivals.filter(v => !v.open && !v.gone), rail = G.rails.length;
    let keep = ''; if (rail) { let a = 0, b = 0; G.an.routes.forEach((r, ri) => { const f = G.rf[ri]; if (f && f.rail < 1) { a += f.d; b += f.d / Math.max(.01, f.rail); } }); if (b) keep = `Trade kept from the trains: <i>${Math.round(a / b * 100)}%</i>. `; }
    $('goals').innerHTML = (G.offer && G.m <= G.offer.until && mode === 'run' ? `<i>Railway offer ${fmtK(G.offer.price)}</i> until ${monthName(G.offer.until)}. ` : '')
      + keep + (pend.length ? `Rival Act: <i>${G.places[pend[0].i].name}–${G.places[pend[0].j].name}</i> in ${AGE.year(G, pend[0].at)}. ` : '') + (ageLedger ? `<span style="color:#cdbf9a">${ageLedger}</span>` : '');
  }
}
function ageTools() {
  const el = $('tools'), U = G ? G.unlocked : new Set();
  const b = (id, txt, lbl, cls = '', title = '', dis) => `<button class="tool ${cls}" id="${id}" title="${title || lbl}" ${dis ? 'disabled' : ''}>${txt}<span class="lbl"> ${lbl}</span></button>`;
  const nx = NEXT.find(k => !U.has(k)), tease = nx ? b('tNext', TEASE[nx][0], '?', '', `Locked: ${TEASE[nx][1]}`, true) : '';
  el.innerHTML = (mode === 'survey' ? b('tDig', '✎', 'Dig', tool === 'dig' ? 'on' : '', 'Dig: drag from a town or a canal') + b('tFill', '⌫', 'Fill in', tool === 'fill' ? 'on' : '') + (U.has('res') ? b('tRes', '⛲', 'Reservoir', tool === 'res' ? 'on' : '', 'Dam a stream') : tease) + b('tUndo', '↶', 'Undo') + b('tOpen', '▶', 'Open', 'go', 'Open the canal: the Canal Age begins')
    : mode === 'run' ? b('tSpd', speed ? '❚❚' : '▶', speed ? speed + '×' : 'paused', speed ? '' : 'go', 'Pause, play, faster') + b('tDig', '✎', 'Dig', tool === 'dig' ? 'on' : '', 'Dig a branch (paid from the bank)') + (U.has('res') ? b('tRes', '⛲', 'Reservoir', tool === 'res' ? 'on' : '') : '') + tease + b('tRew', '⟲', '−10 yrs', '', 'Rewind ten years')
    : b('tRew', '⟲', '−10 yrs', '', 'Rewind ten years') + b('tNew', '⟳', 'New country')) + b('tLv', '☰', 'Commissions');
  const on = (id, f) => { if ($(id)) $(id).onclick = f; };
  on('tDig', () => { tool = 'dig'; FX.sfx('click'); renderTools(); }); on('tFill', () => { tool = 'fill'; FX.sfx('click'); renderTools(); });
  on('tRes', () => { tool = tool === 'res' ? 'dig' : 'res'; FX.sfx('click'); if (tool === 'res') banner('', 'Tap a ringed stream above your canal to dam it.', 1800); renderTools(); });
  on('tUndo', () => { if (!hist.length) return; const o = JSON.parse(hist.pop()); D.paths = o.paths; D.lv = o.lv; D.locks = o.locks; D.res = o.res; sel = Math.min(sel, D.paths.length - 1); FX.sfx('click'); reanalyse(); });
  on('tOpen', openCanal);
  on('tSpd', () => { speed = speed ? 0 : (speedBefore || 1); FX.sfx('click'); renderTools(); hud(); });
  on('tRew', () => ageRewind(10)); on('tNew', () => { SAVE.age = null; loadCom(COMS.indexOf(Cm), null, (Math.random() * 1e6 | 0) + 1); });
  on('tLv', () => { $('lvBox').classList.toggle('open'); renderLevels(); });
  // faster: 1×, 2×, 4×
  if (mode === 'run' && speed) { const f = document.createElement('button'); f.className = 'tool'; f.id = 'tFast'; f.title = 'Faster'; f.innerHTML = '»<span class="lbl"> faster</span>'; f.onclick = () => { speed = speed >= 4 ? 1 : speed * 2; speedBefore = speed; renderTools(); }; $('tSpd').after(f); }
}

// ================= drawing: places, tanks, rivals and railways =================
function ageDraw(t) {
  if (!G) return; const A = an, run = mode !== 'survey' && lastRec;
  if (G.rails.length) { g.fillStyle = 'rgba(70,60,50,.07)'; g.fillRect(0, 0, W, H); }
  // railways: black and white chequered lines; rival canals: purple
  for (const [i, j] of G.rails) { const a = G.places[i], b = G.places[j]; g.lineCap = 'butt'; g.strokeStyle = '#1b1712'; g.lineWidth = .28; g.beginPath(); g.moveTo(cx(a.c), cy(a.c)); g.lineTo(cx(b.c), cy(b.c)); g.stroke(); g.strokeStyle = '#f3e6c4'; g.lineWidth = .14; g.setLineDash([.35, .35]); g.stroke(); g.setLineDash([]); }
  for (const v of G.rivals) { if (v.gone) continue; const a = G.places[v.i], b = G.places[v.j]; g.strokeStyle = v.open ? 'rgba(110,60,150,.85)' : 'rgba(110,60,150,.45)'; g.lineWidth = v.open ? .3 : .12; g.setLineDash(v.open ? [] : [.2, .25]); g.beginPath(); g.moveTo(cx(a.c), cy(a.c)); g.lineTo(cx(b.c), cy(b.c)); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(110,60,150,.95)'; g.font = FONT(.4); g.textAlign = 'center'; label(v.open ? v.name : `${v.name}: Act ${AGE.year(G, v.at)}`, (cx(a.c) + cx(b.c)) / 2, (cy(a.c) + cy(b.c)) / 2, .35); }
  // tanks: every pound that spends water through a lock, as a gauge beside it
  if (A && A.pounds) { const top = Math.max(...A.pounds.map(p => p.lv));
    A.pounds.forEach((p, pi) => { if (p.cells.length < 2) return; const c = p.cells[Math.floor(p.cells.length / 2)], X = cx(c) + .55, Y = cy(c) - .95, ff = run ? lastRec.fill : mode === 'survey' && fore && fore.fill && fore.an && fore.an.pounds.length === A.pounds.length ? fore.fill : null, f = ff ? Math.max(0, Math.min(1, ff[pi] ?? 1)) : 1;
      g.fillStyle = 'rgba(243,230,196,.92)'; g.fillRect(X - .3, Y - .45, .6, .9); g.fillStyle = f < .25 ? '#b3261e' : '#3f7fa8'; g.fillRect(X - .24, Y + .39 - .78 * f, .48, .78 * f); g.strokeStyle = '#1b1712'; g.lineWidth = .06; g.strokeRect(X - .3, Y - .45, .6, .9);
      if (p.lv === top && A.pounds.length > 1) { g.fillStyle = '#1b1712'; g.font = FONT(.34); g.textAlign = 'center'; label('summit', X, Y, .62); } }); }
  // places
  G.places.forEach((p, i) => {
    const X = cx(p.c), Y = cy(p.c), wh = G.M.towns[i], on = A && wh && A.cells.has(wh.c), T = AGE.TYPES[p.type];
    if (on && wh.c !== p.c) { g.strokeStyle = '#5b4a30'; g.lineWidth = .08; g.setLineDash([.12, .1]); g.beginPath(); g.moveTo(X, Y); g.lineTo(cx(wh.c), cy(wh.c)); g.stroke(); g.setLineDash([]); }
    const r = p.type === 'town' || p.type === 'port' ? .95 : .55 + .3 * Math.sqrt(p.p / (T.o0 || 10));
    g.fillStyle = on ? 'rgba(227,178,60,.35)' : 'rgba(179,38,30,.16)'; g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill();
    if (!on) { g.strokeStyle = 'rgba(179,38,30,.6)'; g.lineWidth = .06; g.setLineDash([.15, .12]); g.stroke(); g.setLineDash([]); }
    g.save(); g.translate(X, Y); if (ROT) g.rotate(-Math.PI / 2);
    if (p.type === 'town' || p.type === 'port') { const r2 = K.rng(i * 7 + 3), nh = Math.min(10, 2 + Math.round(p.p));
      for (let j = 0; j < nh; j++) { const hx = (r2() - .5) * 1.5, hy = (r2() - .5) * 1.3; g.fillStyle = '#efe4c4'; g.fillRect(hx - .17, hy - .1, .34, .22); g.fillStyle = j % 3 ? '#a8402c' : '#7d2a1e'; g.beginPath(); g.moveTo(hx - .22, hy - .08); g.lineTo(hx, hy - .3); g.lineTo(hx + .22, hy - .08); g.fill(); }
      if (p.type === 'port') { g.strokeStyle = '#1d3f2e'; g.lineWidth = .1; g.beginPath(); g.moveTo(0, -.55); g.lineTo(0, .35); g.moveTo(-.3, .1); g.quadraticCurveTo(0, .55, .3, .1); g.moveTo(-.18, -.35); g.lineTo(.18, -.35); g.stroke(); } }
    else { const k = r * .9; // little works: pit head, bottle kiln, furnace, mill
      if (p.type === 'coal') { g.fillStyle = '#1b1712'; g.beginPath(); g.moveTo(-k * .8, k * .5); g.lineTo(-k * .1, -k * .1); g.lineTo(k * .5, k * .5); g.fill(); g.strokeStyle = '#3b342b'; g.lineWidth = .08; g.beginPath(); g.moveTo(k * .2, k * .5); g.lineTo(k * .45, -k * .7); g.lineTo(k * .7, k * .5); g.moveTo(k * .45, -k * .7); g.arc(k * .45, -k * .7, k * .15, 0, 7); g.stroke(); }
      else if (p.type === 'pottery') { g.fillStyle = '#9c4a2c'; g.beginPath(); g.moveTo(-k * .45, k * .5); g.quadraticCurveTo(-k * .6, -k * .1, -k * .15, -k * .6); g.lineTo(k * .15, -k * .6); g.quadraticCurveTo(k * .6, -k * .1, k * .45, k * .5); g.fill(); }
      else if (p.type === 'iron') { g.fillStyle = '#4a3f36'; g.fillRect(-k * .5, -k * .2, k, k * .7); g.fillStyle = `rgba(240,${120 + 60 * Math.sin(t * 5 + i)},40,.9)`; g.beginPath(); g.moveTo(-k * .2, -k * .2); g.quadraticCurveTo(0, -k * .9, k * .2, -k * .2); g.fill(); }
      else if (p.type === 'mill') { g.fillStyle = '#c9b48a'; g.fillRect(-k * .55, -k * .35, k * .8, k * .85); g.fillStyle = '#7d2a1e'; g.fillRect(k * .3, -k * .9, k * .18, k * 1.4); g.strokeStyle = '#3f7fa8'; g.lineWidth = .07; g.beginPath(); g.arc(-k * .55, k * .25, k * .3, 0, 7); g.stroke(); } }
    g.restore();
    const big = p.type === 'town' || p.type === 'port'; g.font = big ? `400 ${.62}px Rye,Georgia,serif` : FONT(.4); g.textAlign = 'center'; g.lineWidth = .14; g.strokeStyle = 'rgba(243,230,196,.9)'; g.fillStyle = big ? '#1d3f2e' : '#3b342b';
    label(big ? p.name : p.name.replace(/ (Colliery|Potteries|Ironworks|Mill)$/, ' ' + { coal: 'pit', pottery: 'pots', iron: 'iron', mill: 'mill' }[p.type]), X, Y, big ? 1.1 : r + .3, true);
  });
  // first move: a hint from the port toward the nearest pit or town
  if (mode === 'survey' && !D.paths.length && G.hint) { const a = G.places[G.hint.i], b = G.places[G.hint.j], u = (t * .35) % 1;
    g.strokeStyle = 'rgba(179,38,30,.5)'; g.lineWidth = .14; g.setLineDash([.3, .25]); g.beginPath(); g.moveTo(cx(a.c), cy(a.c)); g.lineTo(cx(a.c) + (cx(b.c) - cx(a.c)) * u, cy(a.c) + (cy(b.c) - cy(a.c)) * u); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#b3261e'; g.beginPath(); g.arc(cx(a.c) + (cx(b.c) - cx(a.c)) * u, cy(a.c) + (cy(b.c) - cy(a.c)) * u, .3, 0, 7); g.fill(); kick(); }
}

// ================= the end: the ledger, the other engineers, the share =================
const STRAT_FIELD = () => [['Straight-line', AGE.naive], ['Day-one design', AGE.staticBest], ['Trunk only', AGE.STRATS.trunk], ['Coal first', AGE.STRATS.coal], ['Cheap tolls', AGE.STRATS.cheap], ['Dear tolls', AGE.STRATS.dear], ['Steady', AGE.STRATS.steady],
  ['Cautious', { ...AGE.STRATS.steady, reserve: 60 }], ['Eager', { ...AGE.STRATS.cheap, branches: 3, reserve: 0 }], ['Careless', { ...AGE.STRATS.steady, care: 0 }], ['Engineer', AGE.STRATS.adaptive]];
function ageField(seedA, done) {
  if (FIELDA[seedA] && FIELDA[seedA].length === STRAT_FIELD().length) return done(FIELDA[seedA]);
  const out = FIELDA[seedA] = [], L = STRAT_FIELD(); let k = 0;
  const next = () => { if (Cm.age !== 1 || !G || G.seed !== seedA) return; if (k >= L.length) return done(out); const [nm, cfg] = L[k++]; try { out.push([nm, AGE.score(AGE.play(seedA, cfg))]); } catch (e) { out.push([nm, 0]); } setTimeout(next, 30); };
  next();
}
function ageFinish() {
  mode = 'done'; speed = 0; boats = []; renderTools(); hud(); ageSave();
  const v = AGE.score(G), y0 = AGE.E.START, cargo = G.years.reduce((a, y) => a + y.boats, 0) * CC.TONS, served = G.places.filter((p, i) => G.an.cells.has(G.M.towns[i].c)).length;
  SAVE.ageBest = isObj(SAVE.ageBest) ? SAVE.ageBest : {}; const prev = SAVE.ageBest[G.seed]; if (prev == null || v > prev) SAVE.ageBest[G.seed] = v; persist();
  const fate = G.sold ? `Sold to the railway in ${AGE.year(G)} for ${fmtK(G.sold)}.` : G.wound >= 0 ? `Wound up in ${AGE.year(G, G.wound)}: three years in debt.` : `The company survived the railway age to ${y0 + AGE.E.YEARS}.`;
  if (v > 0) { hangSign(G.sold ? 'Sold!' : 'Survived!', `Company value ${fmtK(v)}`); FX.sfx('win'); } else FX.sfx('fail');
  const quotes = [];
  const wasted = G.years.reduce((a, y) => a + y.lostW, 0), boatsT = G.years.reduce((a, y) => a + y.boats, 0);
  if (wasted > boatsT * .2) quotes.push(['The lock-keeper', `${Math.round(wasted).toLocaleString()} boats turned away for want of water. The summit was never full.`]);
  if (G.rivals.some(r => r.open)) quotes.push(['A rival proprietor', `We thank you for the valley you left us.`]);
  if (G.rails.length) quotes.push(['A railway director', G.sold ? 'A fine canal. We shall fill it in presently.' : `Your boats still carry ${Math.round(100 * (G.years.at(-1) ? G.years.at(-1).boats / Math.max(1, Math.max(...G.years.map(y => y.boats))) : 0))}% of their best year. Remarkable.`]);
  if (quotes.length < 3) quotes.push(['A shareholder', v > 4000 ? 'The finest canal stock in England.' : v > 1500 ? 'A handsome return over a lifetime.' : v > 0 ? 'We did better than the Funds. Just.' : 'Sunk in a ditch.']);
  setTimeout(() => {
    RH.modal(`<h2 style="margin:0">The Canal Age · #${G.seed}</h2><p style="margin:6px 0;font-weight:700;color:${v > 0 ? '#1d3f2e' : '#b3261e'}">${fate}</p>
      <div class="ledger"><span><b>Company value</b></span><b>${fmtK(v)}</b><span>Tolls taken</span><b>${fmtK(G.rev)}</b><span>Spent on works</span><b>−${fmtK(G.spent)}</b><span>Running costs</span><b>−${fmtK(G.run)}</b><span>Cargo carried</span><b>${tons(cargo)}</b><span>Places on your water</span><b>${served} of ${G.places.length}</b>${prev != null ? `<span>Your best on this map</span><b>${fmtK(Math.max(prev, v))}</b>` : ''}</div>
      <div id="ageHist" class="hist"><h5>The other engineers are still digging…</h5></div>
      ${quotes.map(([w, q]) => `<p class="quote">“${q}”<em>${w}</em></p>`).join('')}`,
      [{ label: 'Share', value: 's' }, { label: '⟲ 10 years', value: 'r' }, { label: 'New country', value: 'n' }, { label: 'Close', value: 'c' }]).then(x => {
      if (x === 's') ageShare(); else if (x === 'r') ageRewind(10); else if (x === 'n') { SAVE.age = null; loadCom(COMS.indexOf(Cm), null, (Math.random() * 1e6 | 0) + 1); } });
    ageField(G.seed, f => { const el = $('ageHist'); if (!el) return; const vals = f.map(x => x[1]); el.outerHTML = histHtml(vals, v).replace('Dividend against', 'Company value against').replace("other engineers' canals", 'engineers with other plans on this map') + `<div style="font-size:11.5px;color:#5b544b;margin-top:3px">${f.slice().sort((a, b) => b[1] - a[1]).map(x => `${x[0]} ${fmtK(x[1])}`).join(' · ')}</div>`; });
  }, 1400);
}
function ageShare() {
  const v = AGE.score(G), url = location.href.split('#')[0] + `#age=${G.seed}`, decades = [];
  for (let d = 0; d < 7; d++) { const ys = G.years.slice(d * 10, d * 10 + 10); if (!ys.length) { decades.push('⬛'); continue; } const n = ys.reduce((a, y) => a + y.net, 0) / ys.length; decades.push(n > 40 ? '🟩' : n > 15 ? '🟨' : n > 0 ? '🟧' : '🟥'); }
  const txt = `Canal Mania · The Canal Age #${G.seed}\n${decades.join('')} 1790→1860\n${G.sold ? 'Sold to the railway' : G.wound >= 0 ? 'Wound up' : 'Survived the railways'} · company value £${v.toLocaleString()}k\n${url}`;
  try { navigator.clipboard.writeText(txt); } catch (e) {} banner('', 'Copied: your decades, your value, this map.', 2200);
}

// ================= boot =================
resize();
{ const a = /#age=(\d+)/.exec(location.hash), m = /#c=([a-z]+)(?:&s=(\d+))?&d=([A-Za-z0-9_~.!-]*)/.exec(location.hash), ci = m ? COMS.findIndex(c => c.id === m[1]) : -1;
  if (a) { const sd = +a[1]; if (!(isObj(SAVE.age) && SAVE.age.seed === sd)) SAVE.age = null; loadCom(COMS.findIndex(c => c.age), null, sd); }
  else if (ci >= 0) { const d = K.dec(m[3]); loadCom(ci, d || null, m[2] ? +m[2] : undefined); if (d) banner('', 'A shared canal. Press <b>Open</b> to run it.', 2400); }
  else loadCom(Math.min(COMS.length - 1, Math.max(0, Number.isInteger(SAVE.cur) ? SAVE.cur : 0))); }
if (document.fonts) document.fonts.ready.then(() => kick());
