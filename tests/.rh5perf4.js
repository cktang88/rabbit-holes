const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}); const p=await ctx.newPage();
 await p.goto('http://localhost:8765/rule-hunter/index.html'); await p.waitForTimeout(1000);
 const cdp=await ctx.newCDPSession(p);
 for (const rate of [1,4]){ await cdp.send('Emulation.setCPUThrottlingRate',{rate});
 const r=await p.evaluate(()=>{ const cv=document.getElementById('world'), cx=cv.getContext('2d'); const W2=cv.width,H2=cv.height;
   const T=(f)=>{ const t=performance.now(); for(let i=0;i<20;i++){ f(); cx.getImageData(0,0,1,1);} return ((performance.now()-t)/20).toFixed(2); };
   const sp=document.createElement('canvas'); sp.width=sp.height=18; const g=sp.getContext('2d'); g.fillStyle='#7a2e12'; g.beginPath(); g.arc(9,9,7.5,0,7); g.fill();
   const out={}; for (const n of [500,1500,3000]) out[n]=T(()=>{ cx.clearRect(0,0,W2,H2); for (let i=0;i<n;i++){ cx.drawImage(sp, (i*37)%W2|0, ((i*91)%H2)|0); } });
   return out; });
 console.log(rate, r); }
 await b.close(); })();
