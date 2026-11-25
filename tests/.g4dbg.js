const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage(); p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/rule-hunter/index.html'); await p.waitForTimeout(800);
console.log(await p.evaluate(()=>{ const R=__rh; R.running=false; const st=R.shelf().map(x=>x.r); const rec={};
 for (const a of st) for (const b of st) for (const op of ['cross','merge','overlap']){ if (a===b) continue; const r=R.breed(a,b,op); if (r.err) continue; R.GOALS.forEach((g,i)=>{ if (!rec[i] && g.t()) rec[i]=[a,b,op]; }); if (Object.keys(rec).length===R.GOALS.length) return rec; }
 return rec; }));
await b.close(); })();
