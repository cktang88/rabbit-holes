// Naturalist's Island: deterministic islands and runs, the food web's emergent behaviour (cycles, cascades, invasions,
// decomposers, pollinators), commissions that a planner fulfils and naive play fails, the daily island, saves, touch, speed.
// Two players, used by the difficulty tests: a naive one (every release at once, random species, random places) and a planner
// (plants and rot first, grazers when there is food, hunters only once their prey is plentiful, refill what dies out).
const POLICIES = `
function POLICIES(I){
  const N=I.N, GW=I.GW;
  function bestTile(w,id){ let best=0,bv=-1e9; const f=w.f; const cnt=(i,set,R)=>{ let c=0; const x0=i%GW,y0=(i/GW)|0; for(let k=0;k<w.n;k++){ const s=w.sp[k]; if(s>=0&&set.includes(s)&&Math.abs(w.x[k]-x0)<=R&&Math.abs(w.y[k]-y0)<=R) c++; } return c; };
    for(let i=0;i<N;i+=3){ if(!w.isl.land[i]) continue; let v;
      if(id==='bee') v=f.flower[i]; else if(id==='deer'||id==='goat') v=f.grass[i]+f.shrub[i]; else if(id==='rabbit'||id==='vole') v=f.grass[i]+f.shrub[i]*.5+(id==='vole'?w.litter[i]*2:0);
      else if(id==='fox') v=cnt(i,[I.IDX.rabbit,I.IDX.vole],4); else if(id==='wolf') v=cnt(i,[I.IDX.deer,I.IDX.goat],5); else if(id==='owl') v=cnt(i,[I.IDX.vole],4)+f.tree[i]*20;
      else if(id==='tree') v=(w.isl.bank[i]?1:0)+w.isl.moist[i]*.3-f.tree[i]; else if(id==='-goat') v=cnt(i,[I.IDX.goat],4); else v=w.isl.moist[i]-f[id][i];
      if(v>bv){bv=v;best=i;} } return [best%GW,(best/GW)|0]; }
  const play=(c, plan, run)=>{ const w=I.start(c, run); let p=c.permits, res=null; const ctx={ w, c, get p(){return p;}, cnt:(id)=>(w.last_counts||I.counts(w))[I.IDX[id]], has:(id)=>I.present(w,I.IDX[id]), year:0,
      rel:(id,at)=>{ if(p<=0) return false; if(!c.species.includes(id) && !I.TOOLS[id] && !(id[0]==='-' && (c.traps||[]).includes(id.slice(1)))) return false; I.act(w,[w.t,id,...(at||bestTile(w,id))]); p--; return true; } };
    for(let y=0;y<c.years;y++){ ctx.year=y; plan(ctx); for(let t=0;t<I.TPY;t++) I.step(w); res=c.goal(w); if(res==='won'||res==='lost'||res==='done') break; }
    return {w, res, species:I.speciesCount(w)}; };
  // naive: spend every permit on random species at random places, right away
  const naive=(c, seed='n')=>play(c, (x)=>{ if(x.year) return; const r=I.rng('naive:'+seed+c.id); const L=[]; for(let i=0;i<N;i++) if(x.w.isl.land[i]) L.push(i); let guard=0; while(x.p>0 && guard++<100){ const id=c.species[r.int(c.species.length)]; const i=L[r.int(L.length)]; x.rel(id,[i%GW,(i/GW)|0]); } });
  const order=['shrub','flower','fungi','grass','tree','rabbit','vole','bee','deer','fox','owl','wolf'];
  const want={ shrub:x=>true, flower:x=>true, fungi:x=>true, grass:x=>true, tree:x=>x.cnt('tree')<.03||x.c.id==='river', rabbit:x=>true, vole:x=>true, bee:x=>x.cnt('flower')>.004, deer:x=>x.year>=1, fox:x=>x.year>=3&&x.cnt('rabbit')+x.cnt('vole')>150, owl:x=>x.year>=3&&x.cnt('vole')>40&&x.cnt('tree')>.02, wolf:x=>x.cnt('deer')+x.cnt('goat')>30 };
  // the planner: plants and rot first, grazers when there is food, hunters once their prey is plentiful; refill what dies out
  const planner=(c, run)=>play(c, (x)=>{
    if (c.id==='goats'){ if(x.year===0){ x.rel('wolf'); x.rel('wolf'); x.rel('wolf'); x.rel('-goat'); x.rel('-goat'); return; } if(x.cnt('goat')>0 && x.cnt('goat')<30 && x.p>1) { x.rel('-goat'); if (x.p>1) x.rel('-goat'); return; } if(!x.has('wolf') && x.cnt('goat')>10) x.rel('wolf'); else if(x.cnt('goat')<=3 && x.p>0 && x.cnt('shrub')<.05) x.rel('shrub'); return; }
    if (c.id==='meadow'){ if(x.year===0) x.rel('rabbit'); if(x.year===1||x.year===2) x.rel('fox'); if(x.year>2&&!x.has('rabbit')) x.rel('rabbit'); return; }
    if (c.id==='cycle'){ if(x.year===0){x.rel('rabbit');x.rel('shrub');} if(x.year===1) x.rel('fox'); if(x.year>3&&!x.has('fox')) x.rel('fox'); if(x.year>3&&!x.has('rabbit')) x.rel('rabbit'); return; }
    if (c.id==='bees'){ if(x.year===0){ x.rel('flower'); x.rel('flower'); x.rel('flower'); } if(x.year===1) x.rel('bee'); if(x.year===2) x.rel('flower'); return; }
    if (c.id==='river'){ if(x.year===0){ x.rel('wolf'); x.rel('wolf'); } if(x.year===2||x.year===3) x.rel('tree'); if(x.year>3 && x.cnt('wolf')<4 && x.cnt('deer')>40) x.rel('wolf'); return; }
    if (c.id==='drought' && x.year>=6 && x.year<18) return;   // keep the remaining permits for after the drought
    const ids=c.species; const first=x.year===0;
    for(const id of order){ if(!ids.includes(id)) continue; if(x.has(id)&&!(c.id==='bees'&&id==='flower'&&x.year<3)) continue; if(!want[id](x)) continue; if(x.w.actions.filter(a=>a[1]===id).length>=3) continue; if(!first && x.p<=Math.floor((c.years-x.year)/20) && c.id!=='drought') break; if (c.id==='drought' && x.year<6 && x.p<=4) break; if(x.rel(id) && !first) break; } }, run);
  return { play, naive, planner, bestTile };
}
`;
// The campaign bots: naive (every release at once, at random), a fixed textbook recipe per chapter, and one that reads
// the census every year and reacts. Each may rewind a lapsed chapter twice, like a player.
const CBOTS = `
// campaign bots: naive, static recipe, adaptive
function BOTS(I){
  const N=I.N, GW=I.GW, IDX=I.IDX;
  const near=(w,i,set,R)=>{ let c=0; const x0=i%GW,y0=(i/GW)|0; for(let k=0;k<w.n;k++){ const s=w.sp[k]; if(s>=0&&set.includes(s)&&Math.abs(w.x[k]-x0)<=R&&Math.abs(w.y[k]-y0)<=R) c++; } return c; };
  function best(w,id){ let bi=-1,bv=-1e9; const f=w.f;
    for(let i=0;i<N;i+=2){ if(!w.isl.land[i]) continue; let v;
      if(id==='bee') v=f.flower[i]; else if(id==='deer') v=f.grass[i]+f.shrub[i]; else if(id==='rabbit'||id==='vole') v=f.grass[i]+f.shrub[i]*.5+(id==='vole'?w.litter[i]*2:0);
      else if(id==='fox') v=near(w,i,[IDX.rabbit,IDX.vole],4); else if(id==='wolf') v=near(w,i,[IDX.deer,IDX.goat],5); else if(id==='owl') v=near(w,i,[IDX.vole],4)+f.tree[i]*20;
      else if(id==='tree') v=(w.isl.bank[i]?.6:0)+w.isl.moist[i]*.5-f.tree[i]+ (f.tree[i]>0?0:0); else if(id==='-goat') v=near(w,i,[IDX.goat],5); else if(id==='-any') v=near(w,i,[IDX.goat,IDX.deer,IDX.rabbit],5);
      else if(id==='#dam') v=w.isl.bank[i]?near(w,i,[],0)+(1-f.tree[i]):-1; else if(id==='#fence') v=(w.isl.bank[i]?1:0)-f.tree[i]; else if(id==='#burn') v=f.shrub[i]; else v=w.isl.moist[i]-f[id][i];
      if(v>bv){bv=v;bi=i;} } return [bi%GW,(bi/GW)|0]; }
  const has=(w,id)=>I.present(w,IDX[id]); const cnt=(w,id)=>w.last_counts[IDX[id]];
  function run(seed, bot, maxYears=260, tries=3){ let w=I.newCampaign(seed); let snap=I.snapshot(w), snapCh=0, attempt=0, retries=0; const st={};
    const ctx={ get w(){return w;}, st, rel:(id,at)=>!!I.campAct(w,[w.t,id,...(at||best(w,id))]), has:(id)=>has(w,id), cnt:(id)=>cnt(w,id), get ch(){return w.camp.ch;}, get y(){ return w.t/I.TPY - w.camp.y0; }, get p(){ return w.camp.permits; }, best:(id)=>best(w,id), get attempt(){ return attempt; } };
    let yr=0, failed=false; const trace=[];
    while(yr++<maxYears){ bot(ctx); let lost=false; for(let t=0;t<I.TPY;t++){ const ev=I.campTick(w); if(ev&&ev.some(e=>e.kind==='lost')){ lost=true; break; } if(ev&&ev.some(e=>e.kind==='chapter')){ snap=I.snapshot(w); snapCh=w.camp.ch; attempt=0; for(const k in st) delete st[k]; } }
      if(lost){ trace.push(w.camp.ch); if(attempt+1>=tries){ failed=true; break; } attempt++; retries++; w=I.restore(snap); for(const k in st) delete st[k]; }
      if(w.camp.ch>=9) break; }
    return { ch:w.camp.ch, lost:failed, years:w.t/I.TPY, codex:Object.keys(w.codex).length, retries, trace, w }; }
  // spend everything on random species in random places at the start of each chapter
  const naive=(x)=>{ if(x.y!==0) return; const r=I.rng('nv:'+x.w.seed+x.ch); const ark=I.arkAt(x.ch); const L=[]; for(let i=0;i<N;i++) if(x.w.isl.land[i]) L.push(i); let g=0; while(x.p>0&&g++<60){ const i=L[r.int(L.length)]; x.rel(ark[r.int(ark.length)],[i%GW,(i/GW)|0]); } };
  // the textbook recipe for each chapter, done on schedule, never adjusted
  const RECIPE=[ {0:['rabbit'],1:['fox'],2:['fox']}, {0:['shrub','vole'],3:['owl']}, {0:['flower','flower','flower'],1:['bee'],2:['flower']}, {0:['tree','tree','fungi'],4:['owl']}, {0:['wolf','wolf','-goat','-goat'],3:['-goat']}, {0:['wolf','#dam'],2:['tree'],3:['tree']}, {}, {0:['rabbit']}, {0:['tree','owl','deer']} ];
  const fixed=(x)=>{ const r=RECIPE[x.ch]; if(r&&r[x.y]) for(const id of r[x.y]) x.rel(id); };
  // reacts every season to what the census says
  const adaptive=(x)=>{ const ch=x.ch, y=x.y, w=x.w;
    const refill=(ids)=>{ for(const id of ids) if(!x.has(id) && x.p>1) { if(x.rel(id)) return true; } return false; };
    if(ch>=4 && x.cnt('goat')>(ch===4?0:5) && x.p>1){ const g=x.best('-goat'); x.rel('-goat',g); if(ch!==4) return; }
    if(ch===0){ if(y===0) x.rel('rabbit'); if((y===1+(x.attempt===2?1:0)||y===2+(x.attempt>=1?1:0))&&x.cnt('rabbit')>20) x.rel('fox'); if(y>=1&&x.cnt('rabbit')<4) x.rel('rabbit'); return; }
    if(ch===1){ const f=w.years.slice(w.camp.y0).map(r=>r[IDX.fox]); const pk=Math.max(0,...f); if(pk>=20&&f.length>=4&&f.slice(-4).every(v=>v>=.75*pk)&&!x.st.burnt&&x.p>1){ x.st.burnt=1; x.rel('#burn',x.best('#burn')); x.rel('#burn',x.best('#burn')); }
      if(y===0&&x.cnt('shrub')<.08) x.rel('shrub'); if(!x.has('fox')&&x.cnt('rabbit')>30) x.rel('fox'); if(!x.has('rabbit')) x.rel('rabbit'); return; }
    if(ch===3){ if(y===0){ x.rel('tree'); x.rel('tree'); x.rel('fungi'); } if(!x.has('vole')&&x.p>1) x.rel('vole'); if(x.cnt('tree')>.07&&x.cnt('owl')<2&&x.cnt('vole')>20&&(x.st.owl||0)<2){ x.st.owl=(x.st.owl||0)+1; x.rel('owl'); } return; }
    if(ch===4){ if(y===0){ x.rel('wolf'); x.rel('wolf'); x.rel('-goat'); x.rel('-goat'); return; } if(x.cnt('goat')>0&&x.p>1) x.rel('-goat'); else if(!x.has('wolf')&&x.cnt('goat')>10) x.rel('wolf'); return; }
    if(ch===5){ const B=[]; for(let i=0;i<N;i++) if(w.isl.bank[i]) B.push(i); const at=(q)=>{ const i=B[Math.floor(B.length*q)]; return [i%GW,(i/GW)|0]; }; const a=x.attempt;
      if(y===0){ if(x.cnt('wolf')<4) x.rel('wolf'); x.rel('#fence',at(.25+a*.05)); x.rel('#fence',at(.7-a*.05)); } if(y===1){ x.rel('tree',at(.25+a*.05)); x.rel('tree',at(.7-a*.05)); } if(y===5&&x.p>0) x.rel('#fence',at(.25+a*.05)); if(y>2&&!x.has('wolf')&&x.cnt('deer')>30&&x.p>1) x.rel('wolf'); if(x.cnt('deer')<5&&x.p>0&&y>3) x.rel('deer'); return; }
    if(ch===2){ if(y===0){ let bi=0,bv=-1; for(let i=0;i<N;i++) if(w.isl.land[i]){ const v=w.f.tree[i]+w.isl.moist[i]*.3-(w.isl.bank[i]?1:0); if(v>bv){bv=v;bi=i;} } const at=[bi%GW,(bi/GW)|0]; x.st.fl=at; x.rel('#burn',at); x.rel('flower',at); x.rel('flower',[at[0]+3,at[1]+1]); x.rel('#fence',at); }
      if(y===1){ x.rel('bee',x.st.fl); } if(y===2&&!x.has('fox')&&x.cnt('rabbit')>50) x.rel('fox'); if(y===3) x.rel('flower'); if(y===2&&x.cnt('rabbit')>150) x.rel('-any',x.st.fl); if(y>2&&!x.has('bee')&&x.p>0) x.rel('bee'); return; }
    if(ch===6){ if(y>=11) refill(['shrub','fungi','tree','vole','rabbit','fox','flower','bee','owl','deer']); return; }
    if(ch===7){ const d=w.dis; if(y===0&&d) x.rel(d.id); refill(['grass','shrub','fungi','tree','flower','vole','rabbit','bee','fox','owl','deer','wolf']); return; }
    if(ch===8){ if(y%3===0) refill(['grass','shrub','fungi','tree','flower','bee','vole','rabbit','deer','fox','owl','wolf']); return; }
  };
  return { run, naive, fixed, adaptive, best };
}

`;
const withBots = (page) => page.addScriptTag({ content: CBOTS + '\nwindow.BOT = BOTS(IslandSim);' });
const dismiss = (page) => page.evaluate(() => { document.querySelectorAll('.modal-bg').forEach(m => m.remove()); __isl.running = false; });
// play the first chapter's opening by hand: rabbits on the best meadow, foxes a year and two years later
const opening = (page) => page.evaluate(() => { const W = __isl.W; let best = 0, bv = -1; for (let i = 0; i < 2240; i++) if (W.isl.land[i] && W.f.grass[i] > bv) { bv = W.f.grass[i]; best = i; } return [best % 56, best / 56 | 0]; });
const withPolicies = (page) => page.addScriptTag({ content: POLICIES + '\nwindow.POL = POLICIES(IslandSim);' });
async function reopen(page) { const p2 = await page.context().newPage(); const errs = []; p2.on('pageerror', e => errs.push(e.message)); await p2.goto(page.url()); await p2.waitForTimeout(400); p2.errs = errs; return p2; }
async function touchSession(page) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); return cdp; }
async function tap(cdp, p) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p[0], y: p[1], id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
async function pinch(cdp, c, d0, d1) { const pts = (d) => [{ x: c[0] - d, y: c[1], id: 1 }, { x: c[0] + d, y: c[1], id: 2 }]; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(d0) });
  for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d0 + (d1 - d0) * k / 5) }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }

module.exports = {
  page: 'island/index.html',
  tests: {
    'islands are generated deterministically per seed, and every island is a usable island': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const I = IslandSim; const sig = (w) => [w.isl.nLand, w.isl.nBank, [...w.isl.land].join('').slice(0, 400), [...w.f.grass].slice(0, 300).map(v => v.toFixed(4)).join()].join('|');
        const a = sig(I.create('x1')), b = sig(I.create('x1')), c = sig(I.create('x2'));
        const shapes = []; for (let k = 0; k < 25; k++) { const w = I.create('s' + k); shapes.push([w.isl.nLand / I.N, w.isl.nBank, w.isl.river.reduce((p, q) => p + q, 0)]); }
        return { same: a === b, diff: a !== c, shapes }; });
      ok(r.same, 'same seed, same island'); ok(r.diff, 'different seeds, different islands');
      for (const [land, bank, river] of r.shapes) { ok(land > .25 && land < .5, 'land fraction ' + land); ok(river >= 4 && bank >= 8, 'a stream with banks ' + river + ' ' + bank); }
    },
    'runs are deterministic: the same releases give the same history, and a run replays exactly from its list of releases': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const I = IslandSim; const go = (seed) => { const w = I.create(seed); I.release(w, 'rabbit', 20, 20); I.release(w, 'vole', 30, 22); for (let t = 0; t < 72; t++) { if (t === 48) I.release(w, 'fox', 25, 21); I.step(w); } return w; };
        const a = go('d1'), b = go('d1'), c = go('d2'); const re = I.replay('d1', a.actions, 72);
        const h = (w) => w.census.map(x => x.join()).join('|');
        return { ab: h(a) === h(b), ac: h(a) !== h(c), replay: h(re) === h(a), acts: a.actions.length, rab: a.last_counts[I.IDX.rabbit] }; });
      ok(r.ab); ok(r.ac); ok(r.replay, 'replay reproduces the run'); eq(r.acts, 3); ok(r.rab > 8, 'rabbits bred: ' + r.rab);
    },
    'the food web emerges: grazers boom on an empty meadow, then settle at what the grass can feed': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const I = IslandSim, out = []; for (const sd of ['f1', 'f2', 'f3']) { const w = I.create(sd); I.release(w, 'rabbit', 20, 20); I.release(w, 'rabbit', 30, 22);
        const yr = []; for (let y = 0; y < 15; y++) { for (let t = 0; t < I.TPY; t++) I.step(w); yr.push(w.last_counts[I.IDX.rabbit]); } out.push({ yr, grass0: w.census[I.IDX.grass][0], grass: w.last_counts[I.IDX.grass] }); } return out; });
      for (const x of r) { const peak = Math.max(...x.yr.slice(0, 6)), late = x.yr.slice(8); ok(peak > 150, 'boom ' + x.yr); ok(Math.min(...late) > 20 && Math.max(...late) < peak, 'settles below the peak ' + x.yr); ok(x.grass < x.grass0 * .6, 'the meadow is grazed down'); }
    },
    'predators and prey cycle: with refuges, foxes rise and fall a little behind the rabbits': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const I = IslandSim, out = []; for (const run of ['c1', 'c2', 'c3']) { const w = I.create('cyc', { run }); for (const x of [10, 20, 30, 40]) I.release(w, 'shrub', x, 20);
        I.release(w, 'rabbit', 22, 20); I.release(w, 'rabbit', 32, 22); I.release(w, 'vole', 27, 21); const fox = [], rab = [];
        for (let y = 0; y < 30; y++) { if (y === 3) I.release(w, 'fox', 27, 20); for (let t = 0; t < I.TPY; t++) I.step(w); fox.push(w.last_counts[I.IDX.fox]); rab.push(w.last_counts[I.IDX.rabbit]); } out.push({ fox, rab }); } return out; });
      // a real swing, not just a climb: a peak, a crash to 60% of it or less, then a recovery of half as many again
      const swing = (f) => { let pk = 0, tr = Infinity, st = 0; for (const v of f) { if (st < 2) { pk = Math.max(pk, v); if (pk >= 6 && v <= .6 * pk) { st = 2; tr = v; } } else { tr = Math.min(tr, v); if (v >= Math.max(tr * 1.5, tr + 4)) return true; } } return false; };
      let cycles = 0; for (const { fox, rab } of r) if (Math.min(...rab.slice(4)) > 0 && swing(fox)) cycles++;
      ok(cycles >= 1, 'foxes boom, crash and recover while rabbits hang on: ' + JSON.stringify(r.map(x => x.fox.join(','))));
    },
    'trophic cascade: wolves bring back the riverside woods that deer had browsed bare': async ({ page, ok }) => {
      await withPolicies(page);
      const r = await page.evaluate(() => { const I = IslandSim, c = I.SCN.river; const go = (wolves, run) => POL.play(c, (x) => { if (wolves && (x.year === 0 || (!x.has('wolf') && x.cnt('deer') > 40))) x.rel('wolf'); }, run);
        const out = []; for (const run of ['w1', 'w2', 'w3']) { const a = go(false, run).w, b = go(true, run).w; out.push([Math.max(...a.riverHist), Math.max(...b.riverHist), a.last_counts[I.IDX.deer]]); } return out; });
      const none = r.map(x => x[0]), wolves = r.map(x => x[1]); ok(Math.max(...none) < .12, 'without wolves the banks stay bare: ' + none); ok(wolves.reduce((a, b) => a + b) > none.reduce((a, b) => a + b) * 1.8, 'with wolves the woods come back: ' + wolves); ok(r.every(x => x[2] > 60), 'deer stay abundant without wolves');
    },
    'invasives run away, decomposers keep the soil, pollinators spread the flowers': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const I = IslandSim;
        const g = I.create('inv'); for (const [x, y] of [[20, 20], [30, 22], [26, 16]]) I.release(g, 'goat', x, y); for (let t = 0; t < 15 * I.TPY; t++) I.step(g);
        const soil = (fungi) => { const w = I.create('soil'); I.release(w, 'rabbit', 22, 20); if (fungi) for (const x of [15, 25, 35]) I.release(w, 'fungi', x, 20); for (let t = 0; t < 25 * I.TPY; t++) I.step(w); let s = 0; for (let i = 0; i < I.N; i++) if (w.isl.land[i]) s += w.fert[i]; return s / w.isl.nLand; };
        const fl = (bees) => { const w = I.create('fl'); for (const x of [18, 28, 38]) I.release(w, 'flower', x, 20); if (bees) I.release(w, 'bee', 28, 20); for (let t = 0; t < 8 * I.TPY; t++) I.step(w); return w.last_counts[I.IDX.flower]; };
        return { goats: g.last_counts[I.IDX.goat], cover0: g.coverHist[0], cover: g.coverHist[g.coverHist.length - 1], soilWith: soil(true), soilWithout: soil(false), flBees: fl(true), flNone: fl(false) }; });
      ok(r.goats > 54, 'goats with no predator multiply (from 18): ' + r.goats); ok(r.cover < r.cover0 * .6, 'and strip the island: ' + r.cover0.toFixed(2) + ' → ' + r.cover.toFixed(2));
      ok(r.soilWith > r.soilWithout + .05, `fungi keep the soil rich: ${r.soilWith.toFixed(2)} vs ${r.soilWithout.toFixed(2)}`); ok(r.flBees > r.flNone * 1.5, `bees spread the flowers: ${r.flBees.toFixed(3)} vs ${r.flNone.toFixed(3)}`);
    },
    'difficulty: on the daily island the planner keeps clearly more species alive than naive play': async ({ page, ok }) => {
      await withPolicies(page);
      const r = await page.evaluate(() => { const I = IslandSim, p = [], n = []; for (const d of ['2026-01-01', '2026-03-14', '2026-07-30']) { const c = I.daily(d); p.push(POL.planner(c).species); n.push(POL.naive(c).species); } return { p, n }; });
      const avg = (a) => a.reduce((x, y) => x + y) / a.length; ok(avg(r.p) >= avg(r.n) + 2, `planner ${r.p} vs naive ${r.n}`);
    },
    'the steward\'s island: naive play fails, a fixed recipe stalls, reading the census each year goes furthest, and no recipe wins every island': async ({ page, ok }) => {
      await withBots(page);
      const r = await page.evaluate(() => { const out = { naive: [], fixed: [], adaptive: [] }; for (const seed of ['a', 'd', 'f', 'g']) for (const b of Object.keys(out)) { const x = BOT.run(seed, BOT[b]); out[b].push(x.lost ? x.ch : 9); } return out; });
      const avg = (a) => a.reduce((x, y) => x + y) / a.length;
      ok(r.naive.every(c => c === 0), 'naive play fails the first chapter: ' + r.naive); ok(avg(r.adaptive) >= avg(r.fixed) + 2, `adapting beats a fixed recipe: ${r.adaptive} vs ${r.fixed}`);
      ok(r.fixed.every(c => c < 9), 'no fixed recipe finishes: ' + r.fixed); ok(r.adaptive.some(c => c === 9) && r.adaptive.some(c => c < 9), 'adaptive play finishes some islands, not all: ' + r.adaptive);
    },
    'snapshots: a whole world saves in under 80 KB and restores to continue identically': async ({ page, ok, eq }) => {
      const r = await page.evaluate(() => { const I = IslandSim, w = I.newCampaign('snap'); I.campAct(w, [0, 'rabbit', 30, 20]); for (let t = 0; t < 60; t++) I.campTick(w); I.campAct(w, [w.t, 'fox', 30, 20]); for (let t = 0; t < 30; t++) I.campTick(w);
        const sn = I.snapshot(w), size = JSON.stringify(sn).length, a = I.restore(sn); for (let t = 0; t < 72; t++) { I.campTick(w); I.campTick(a); } return { size, same: w.last_counts.join() === a.last_counts.join() && w.r.get() === a.r.get(), t: a.t }; });
      ok(r.size < 80000, 'snapshot ' + r.size + ' bytes'); ok(r.same, 'the restored world runs on exactly as the original'); eq(r.t, 162);
    },
    'first minute by real clicks: rabbits, then foxes, and chapter one is fulfilled; chapter two opens on the same island': async ({ page, eq, ok }) => {
      ok(!(await page.isVisible('.modal')), 'no intro screen'); ok(/Rabbits/.test(await page.textContent('#brief')), 'one line saying what to tap');
      const t0 = await page.evaluate(() => __isl.W.t); await page.waitForTimeout(800); eq(await page.evaluate(() => __isl.W.t), t0, 'no time passes before the first move');
      const pt = await opening(page); const cp = await page.evaluate((p) => __isl.tileToClient(...p), pt);
      await page.click('.card[data-k="rabbit"]'); await page.click('.card[data-k="rabbit"]'); eq(await page.evaluate(() => __isl.sel), 'rabbit', 'a second tap keeps the card');
      await page.mouse.click(cp[0], cp[1]); await page.evaluate(() => { __isl.running = false; });
      eq(await page.evaluate(() => [__isl.permits, __isl.W.actions.length]), [3, 1]); ok(await page.isDisabled('.card[data-k="owl"]'), 'owls are locked until chapter 2'); ok(/ch\. 2/.test(await page.textContent('.card[data-k="owl"]')));
      for (let y = 1; y <= 2; y++) { await page.evaluate((y) => { while (__isl.W.t < y * 24) __isl.advance(); }, y); await page.click('.card[data-k="fox"]'); const c2 = await page.evaluate((p) => __isl.tileToClient(...p), pt); await page.mouse.click(c2[0], c2[1]); }
      await page.evaluate(() => { for (let k = 0; k < 6 * 24 + 1 && __isl.W.camp.ch === 0; k++) __isl.advance(); }); await page.waitForTimeout(1800);
      const b = await page.evaluate(() => ({ ch: __isl.W.camp.ch, best: __isl.M.best.meadow, snapT: __isl.M.camp.snap.t, t: __isl.W.t, permits: __isl.permits, modal: document.querySelector('.modal')?.textContent || '', prog: JSON.parse(localStorage.getItem('rh:hub')).island }));
      eq(b.ch, 1, 'chapter two'); ok(b.best && b.best.y === 8 && b.best.r === 3, JSON.stringify(b.best)); eq(b.snapT, b.t, 'the new chapter is saved where it starts'); eq(b.permits, 6, 'one release left over, five more given');
      ok(/Fulfilled: A meadow for rabbits/.test(b.modal) && /Boom and bust/.test(b.modal), 'the chapter card: ' + b.modal.slice(0, 120)); ok(b.prog > 0);
      await page.click('.modal button'); ok(!(await page.isDisabled('.card[data-k="owl"]')), 'owls arrive in chapter 2'); ok(!(await page.isDisabled('.card[data-k="#burn"]')), 'and fire');
    },
    'a lapsed chapter rewinds in under a second to its start, keeping the journal and everything before it': async ({ page, eq, ok }) => {
      await dismiss(page);
      const r = await page.evaluate(() => { const w = __isl.W; for (const [x, y] of [[30, 20], [20, 25], [40, 25]]) { __isl.sel = 'rabbit'; __isl.releaseAt(x, y); } for (let k = 0; k < 9 * 24 + 2; k++) __isl.advance(); return { status: w.camp.status, codex: Object.keys(__isl.M.codex).length }; });
      eq(r.status, 'lost', 'rabbits alone lose the meadow'); await page.waitForTimeout(400); ok(/lapsed/i.test(await page.textContent('.modal h2')));
      const t0 = Date.now(); await page.click('.modal button:has-text("Rewind")'); const dt = Date.now() - t0;
      const s = await page.evaluate(() => ({ t: __isl.W.t, acts: __isl.W.actions.length, permits: __isl.permits, codex: Object.keys(__isl.M.codex).length, waiting: __isl.waiting }));
      ok(dt < 1000, 'rewind took ' + dt + 'ms'); eq([s.t, s.acts, s.permits], [0, 0, 4]); eq(s.codex, r.codex, 'phenomena seen stay in the journal'); ok(s.waiting, 'and the clock waits for your move');
    },
    'the island survives a reload exactly; corrupted saves load cleanly': async ({ page, eq }) => {
      await dismiss(page);
      const a = await page.evaluate(() => { __isl.sel = 'rabbit'; __isl.releaseAt(30, 20); for (let t = 0; t < 30; t++) __isl.advance(); __isl.sel = 'fox'; __isl.releaseAt(28, 20); for (let t = 0; t < 18; t++) __isl.advance(); return { t: __isl.W.t, y: JSON.stringify(__isl.W.years) }; });
      const p2 = await reopen(page); const b = await p2.evaluate((n) => ({ t: __isl.W.t, y: JSON.stringify(__isl.W.years.slice(0, n)) }), JSON.parse(a.y).length); eq(b.t >= a.t, true); eq(b.y, a.y); eq(p2.errs, []); await p2.close();
      for (const raw of ['null', '7', '[]', '{"best":5,"codex":{"x":1},"camp":{"seed":"a","snap":{"v":1},"a":[[1,"dragon",3,3]],"t":5}}', '{"camp":{"seed":"b","snap":{"v":1,"fl":"!!"},"a":[],"t":4},"run":{"c":"daily","a":"nope","t":-4}}']) {
        await page.evaluate((raw) => localStorage.setItem('rh:island', raw), raw); const p3 = await reopen(page);
        const st = await p3.evaluate(() => ({ mode: __isl.MODE, ch: __isl.W.camp.ch })); eq(p3.errs, [], raw); eq(st, { mode: 'camp', ch: 0 }, raw); await p3.close(); }
    },
    'the notebook: chapters with best results, a journal of phenomena, census with your moves marked; the daily island opens after chapter one': async ({ page, ok, eq }) => {
      await dismiss(page);
      await page.click('#bookBtn'); await page.waitForTimeout(300);
      ok(!(await page.isVisible('[data-day]')), 'daily locked at first'); ok(/Boom and bust/.test(await page.textContent('#p-com')), 'the next chapter is in view');
      await page.click('.tabs button[data-t="jr"]'); eq(await page.locator('#p-jr .ph').count(), 24); ok(/0 of 24/.test(await page.textContent('#p-jr')));
      await page.evaluate(() => { __isl.closeBook(); __isl.sel = 'rabbit'; __isl.releaseAt(30, 20); for (let t = 0; t < 40; t++) __isl.advance(); __isl.M.best.meadow = { y: 8, r: 3, s: 4 }; __isl.openBook('cen'); });
      ok(await page.isVisible('#bigChart')); ok(/your moves/.test(await page.textContent('#legend')));
      await page.evaluate(() => __isl.openBook('com')); ok(await page.isVisible('[data-day]')); await page.click('[data-day]'); await page.waitForTimeout(200);
      const r = await page.evaluate(() => ({ mode: __isl.MODE, seed: __isl.C.seed, hash: location.hash, permits: __isl.permits, cards: document.querySelectorAll('#cards .card').length }));
      eq(r.mode, 'daily'); eq(r.hash, '#day=' + r.seed.slice(4)); eq(r.permits, 10); ok(r.cards >= 12);
      await page.click('#bookBtn'); await page.click('[data-camp]'); eq(await page.evaluate(() => [__isl.MODE, __isl.W.actions.length]), ['camp', 1], 'back to the steward\'s island as it was');
      await page.click('#bookBtn'); await page.click('.tabs button[data-t="guide"]'); ok((await page.textContent('#p-guide')).includes('Eaten by'));
    },
    'the daily island is the same for everyone that day, scored at year 30 and recorded': async ({ page, eq, ok }) => {
      await page.goto(page.url().split('#')[0] + '#day=2026-02-02'); await page.reload(); await page.waitForTimeout(500); await dismiss(page);
      const r = await page.evaluate(() => { const a = __isl.C.seed, land = __isl.W.isl.nLand; __isl.sel = 'rabbit'; __isl.releaseAt(20, 20); __isl.sel = 'flower'; __isl.releaseAt(25, 20);
        for (let t = 0; t < 30 * 24; t++) __isl.advance(); return { a, land, res: __isl.result, rec: __isl.M.daily['2026-02-02'], fresh: IslandSim.daily('2026-02-02').seed }; });
      eq(r.a, 'day:2026-02-02'); eq(r.fresh, r.a); eq(r.res, 'done'); ok(r.rec && r.rec.score >= 3, JSON.stringify(r.rec));
    },
    'free island links carry the releases and replay the same island; island links share the steward\'s seed': async ({ page, eq }) => {
      await dismiss(page);
      const h = await page.evaluate(() => { __isl.begin('sandbox', 'pond'); __isl.sel = 'rabbit'; __isl.releaseAt(20, 20); __isl.sel = 'deer'; __isl.releaseAt(30, 20); return location.hash; });
      eq(/^#free=pond&r=/.test(h), true);
      const p2 = await page.context().newPage(); await p2.goto(page.url().split('#')[0] + h); await p2.waitForTimeout(500);
      const r = await p2.evaluate(() => ({ seed: __isl.C.seed, acts: __isl.W.actions.map(a => a[1]), rab: __isl.W.sp.filter(s => s === IslandSim.IDX.rabbit).length }));
      eq(r.seed, 'free:pond'); eq(r.acts, ['rabbit', 'deer']); eq(r.rab >= 8, true); await p2.close();
      eq(await page.evaluate(() => __isl.decodeActs(__isl.encodeActs([[5, 'fox', 3, 4], [70, '-goat', 50, 39], [80, '#burn', 2, 2]]))), [[5, 'fox', 3, 4], [70, '-goat', 50, 39], [80, '#burn', 2, 2]]);
      const p3 = await page.context().newPage(); await p3.goto(page.url().split('#')[0] + '#camp=tern'); await p3.waitForTimeout(600); eq(await p3.evaluate(() => [__isl.MODE, __isl.W.camp.seed]), ['camp', 'tern']); await p3.close();
    },
    'fire and water: burning feeds the soil and kills the slow, a dam keeps the ground wet; tools wait for their chapter': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const I = IslandSim, w = I.create('tools'); I.release(w, 'rabbit', 25, 20); let i = 20 * 56 + 25; const f0 = w.fert[i], sh0 = w.f.shrub[i] + w.f.tree[i];
        I.burn(w, 25, 20); let rb = 0; for (let k = 0; k < w.n; k++) if (w.sp[k] === I.IDX.rabbit) rb++;
        let j = -1; for (let q = 0; q < I.N; q++) if (w.isl.bank[q]) { j = q; break; } const m0 = w.isl.moist[j]; const dn = I.dam(w, j % 56, j / 56 | 0); const no = I.dam(w, 2, 2);
        const c = I.newCampaign('x'); return { fert: w.fert[i] >= f0, bare: w.f.shrub[i] + w.f.tree[i] <= sh0 * .2 + .01, rb, wet: w.isl.moist[j] > m0, dn, no, burn0: I.allowed(c, '#burn'), dam0: I.allowed(c, '#dam'), fence0: I.allowed(c, '#fence') }; });
      ok(r.fert && r.bare, 'burnt ground: bare and richer'); ok(r.rb < 8, 'rabbits caught in the fire: ' + (8 - r.rb)); ok(r.wet && r.dn > 0 && r.no === 0, 'a dam only by the stream, and it wets the ground');
      ok(!r.burn0 && !r.dam0 && r.fence0, 'fire and dams come later; the fence is there from the start');
    },
    'phone layout: the island fills the screen, every card is in view with its sparkline, the notebook is a full page': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.goto(page.url()); await page.waitForTimeout(600); await dismiss(page);
      await page.evaluate(() => { __isl.sel = 'rabbit'; __isl.releaseAt(30, 20); for (let t = 0; t < 72; t++) __isl.advance(); });
      const r = await page.evaluate(() => { const cards = [...document.querySelectorAll('#cards .card')]; const vis = cards.filter(c => { const b = c.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.width > 30; }).length;
        const sp = document.querySelector('.card[data-k="rabbit"] canvas.spark'); const d = sp.getContext('2d').getImageData(0, 0, sp.width, sp.height).data; let ink = 0; for (let i = 3; i < d.length; i += 4) ink += d[i] > 0;
        const m = document.getElementById('map').getBoundingClientRect(); const fs = parseFloat(getComputedStyle(document.getElementById('note')).fontSize); return { n: cards.length, vis, map: m.height / innerHeight, fs, k: __isl.cam.k, ink }; });
      ok(r.vis >= 12, `cards in view ${r.vis} of ${r.n}`); ok(r.ink > 20, 'the rabbit card draws its sparkline'); ok(r.map > .6, 'the island has most of the height: ' + r.map.toFixed(2)); ok(r.fs <= 19, 'captions sized for a phone: ' + r.fs);
      ok(Math.max(.55, Math.min(1.7, 13 / r.k)) * r.k >= 10, 'an animal is at least 10px across at the starting zoom (k=' + r.k.toFixed(1) + ')');
      await page.click('#bookBtn'); await page.waitForTimeout(400);
      const b = await page.evaluate(() => { const r = document.getElementById('book').getBoundingClientRect(); return r.height / innerHeight; }); ok(b > .95, 'the notebook is a full page: ' + b.toFixed(2));
      await page.click('#bookX'); await page.waitForTimeout(400); ok(!(await page.evaluate(() => document.body.classList.contains('book'))));
    },
    'touch (phone): pinch zooms, a tap on the island releases, nothing scrolls sideways': async ({ page, ok, eq }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.goto(page.url()); await page.waitForTimeout(600); await dismiss(page);
      const cdp = await touchSession(page);
      const v = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, k: __isl.cam.k })); ok(v.sw <= 390, 'scrollWidth ' + v.sw);
      const c = await page.evaluate(() => { const r = document.getElementById('map').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await pinch(cdp, c, 40, 90); const k2 = await page.evaluate(() => __isl.cam.k); ok(k2 > v.k * 1.8, `pinch zooms ${v.k} → ${k2}`);
      await tap(cdp, await page.evaluate(() => { const r = document.querySelector('.card[data-k="rabbit"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
      eq(await page.evaluate(() => __isl.sel), 'rabbit');
      const t = await page.evaluate(() => { const W = __isl.W; const r = document.getElementById('map').getBoundingClientRect(); for (let i = 0; i < 2240; i++) if (W.isl.land[i]) { const p = __isl.tileToClient(i % 56, i / 56 | 0); if (p[0] > r.left + 40 && p[0] < r.right - 40 && p[1] > r.top + 90 && p[1] < r.bottom - 90) return p; } });
      await tap(cdp, t); eq(await page.evaluate(() => __isl.permits), 3, 'a tap released the rabbits');
    },
    'performance: a busy island stays smooth on a throttled phone': async ({ page, ok }) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }); await page.waitForTimeout(300); await dismiss(page);
      await page.evaluate(() => { __isl.begin('sandbox', 'busy'); for (const [id, x, y] of [['rabbit', 20, 20], ['rabbit', 30, 22], ['vole', 25, 20], ['vole', 35, 20], ['bee', 28, 18], ['flower', 28, 18], ['deer', 30, 25], ['rabbit', 15, 25], ['vole', 40, 22], ['rabbit', 38, 15], ['fox', 26, 21]]) { __isl.sel = id; __isl.releaseAt(x, y); }
        for (let t = 0; t < 24 * 4; t++) __isl.advance(); __isl.speed = 24; __isl.running = true; });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await page.waitForTimeout(2500);
      const r = await page.evaluate(() => { const W = __isl.W; let n = 0; for (let k = 0; k < W.n; k++) if (W.sp[k] >= 0) n++; const t0 = performance.now(); for (let i = 0; i < 24; i++) __isl.advance(); const tick = (performance.now() - t0) / 24;
        const t1 = performance.now(); for (let i = 0; i < 10; i++) { __isl.render(performance.now()); document.getElementById('map').getContext('2d').getImageData(0, 0, 1, 1); } return { n, tick, frame: (performance.now() - t1) / 10, fps: __isl.fps(2000) }; });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      ok(r.n > 120, 'a busy island: ' + r.n + ' animals'); ok(r.tick < 8, 'a tick of the world takes ' + r.tick.toFixed(1) + 'ms on a 4x slower CPU');
      ok(r.fps >= 25, 'frames per second at ×24 on a 4x-throttled phone, software compositing: ' + r.fps.toFixed(0)); ok(r.frame + r.tick < 16, `page work per frame ${(r.frame + r.tick).toFixed(1)}ms (paint ${r.frame.toFixed(1)} + one tick ${r.tick.toFixed(1)})`);
    },
  },
};
