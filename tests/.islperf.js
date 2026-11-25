const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3}); const p=await ctx.newPage();
 await p.goto('http://localhost:8765/island/index.html'); await p.waitForTimeout(800); await p.evaluate(()=>{ document.querySelectorAll('.modal-bg').forEach(m=>m.remove()); __isl.begin('sandbox','busy'); for (const [id, x, y] of [['rabbit', 20, 20], ['rabbit', 30, 22], ['vole', 25, 20], ['vole', 35, 20], ['bee', 28, 18], ['flower', 28, 18], ['deer', 30, 25], ['fox', 26, 21]]) { __isl.sel = id; __isl.releaseAt(x, y); } for (let t = 0; t < 24 * 4; t++) __isl.advance(); __isl.running=true; });
 const cdp=await ctx.newCDPSession(p);
 for (const rate of [1,4]) for (const sp of [1,4,16]) { await cdp.send('Emulation.setCPUThrottlingRate',{rate}); await p.evaluate(s=>__isl.speed=s, sp); await p.waitForTimeout(2000);
  const r=await p.evaluate(()=>{ const W=__isl.W; let n=0; for (let k=0;k<W.n;k++) if(W.sp[k]>=0) n++; const t0=performance.now(); for(let i=0;i<12;i++) __isl.advance(); const tick=(performance.now()-t0)/12; const t1=performance.now(); for(let i=0;i<10;i++){ __isl.render(performance.now()); document.getElementById('map').getContext('2d').getImageData(0,0,1,1);} return {n,tick:tick.toFixed(1),frame:((performance.now()-t1)/10).toFixed(1),fps:__isl.fps(1500).toFixed(0)}; });
  console.log(rate, sp, JSON.stringify(r)); }
 await b.close(); })();
