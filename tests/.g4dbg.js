const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage(); p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/universe-seed/index.html'); await p.waitForTimeout(800);
console.log(await p.evaluate(()=>{ const X=__us; const key=(c)=>JSON.stringify(X.observe(c)); const obsCache=new Map(X.ALL_COMBOS.map(c=>[c,X.observe(c)]));
 const fb=(g,tObs)=>JSON.stringify(X.compareObs(X.observe(g),tObs)); let naive=0, comp=0, compG=[]; const N=60;
 let seed=1; const rnd=(n)=>{ seed=(seed*1103515245+12345)&0x7fffffff; return (seed>>>16)%n; };
 for (let s=0;s<N;s++){ const t=X.genMystery('t'+s), tO=X.observe(t);
   // naive: 6 random law sets
   let won=false; for (let g=0;g<6;g++){ const c=X.ALL_COMBOS[rnd(X.ALL_COMBOS.length)]; if (X.compareObs(X.observe(c),tO).win){won=true;break;} } if (won) naive++;
   // competent: keep only law sets consistent with every comparison so far; start from our laws
   let cands=X.ALL_COMBOS.slice(); let g={...X.OURS}; let k;
   for (k=1;k<=6;k++){ const f=fb(g,tO); if (X.compareObs(X.observe(g),tO).win) break; cands=cands.filter(c=>fb(g,obsCache.get(c))===f); g=cands[0]; }
   if (k<=6){ comp++; compG.push(k); } }
 return {naive:naive/N, comp:comp/N, avg:compG.reduce((a,b)=>a+b,0)/compG.length}; }));
await b.close(); })();
