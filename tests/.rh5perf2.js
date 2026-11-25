const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}); const p=await ctx.newPage();
 await p.goto('http://localhost:8765/rule-hunter/index.html'); await p.waitForTimeout(1000); await p.evaluate(()=>document.querySelectorAll('.modal-bg').forEach(m=>m.remove()));
 const cdp=await ctx.newCDPSession(p); await p.evaluate(()=>{ __rh.S.noPredict=1; __rh.setRule(__rh.parseRule('B3678/S34678')); __rh.soup(); __rh.running=false; __rh.tick(100); __rh.setView(80,80,8); });
 await cdp.send("Emulation.setCPUThrottlingRate",{rate:4}); await cdp.send("Emulation.setCPUThrottlingRate",{rate:4}); const r=await p.evaluate(()=>{ const cv=document.getElementById('world'), cx=cv.getContext('2d'); const T=(f)=>{ const t=performance.now(); for(let i=0;i<20;i++){ f(); cx.getImageData(0,0,1,1);} return ((performance.now()-t)/20).toFixed(2); };
   return { tick4:T(()=>__rh.tick(4)), refresh:T(()=>__rh.refreshImage()), render:T(()=>__rh.render()), z4:(__rh.setView(80,80,4),T(()=>__rh.render())), z14:(__rh.setView(80,80,14),T(()=>__rh.render())) }; });
 console.log(r); await b.close(); })();
