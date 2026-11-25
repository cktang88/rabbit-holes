const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext(); const p=await ctx.newPage(); p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('http://localhost:8765/island/index.html'); await p.waitForTimeout(800);
 const a=await p.evaluate(()=>{ document.querySelectorAll('.modal-bg').forEach(m=>m.remove()); __isl.running=false; __isl.begin('cycle'); __isl.sel='rabbit'; __isl.releaseAt(22,20); for(let t=0;t<30;t++) __isl.advance(); __isl.sel='vole'; __isl.releaseAt(28,20); for(let t=0;t<18;t++) __isl.advance(); return {c:__isl.W.census[0].length, t:__isl.W.t, run:localStorage.getItem('rh:island'), acts:JSON.stringify(__isl.W.actions)}; });
 console.log(a);
 const p2=await ctx.newPage(); await p2.goto('http://localhost:8765/island/index.html'); await p2.waitForTimeout(800);
 console.log(await p2.evaluate(()=>({c:__isl.W.census[0].length,t:__isl.W.t, acts:JSON.stringify(__isl.W.actions)})));
 await b.close(); })();
