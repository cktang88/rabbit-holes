const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}); const p=await ctx.newPage();
 await p.goto('http://localhost:8765/rule-hunter/index.html'); await p.waitForTimeout(1000);
 const r=await p.evaluate(()=>{ const cv=document.getElementById('world'), cx=cv.getContext('2d'); const W2=cv.width,H2=cv.height; const off=document.createElement('canvas'); off.width=off.height=160;
   const T=(f)=>{ const t=performance.now(); for(let i=0;i<20;i++){ f(); cx.getImageData(0,0,1,1);} return ((performance.now()-t)/20).toFixed(2); };
   const m=document.createElement('canvas'); m.width=m.height=32; const mg=m.getContext('2d'); mg.arc(16,16,15,0,7); mg.fill(); const pat=cx.createPattern(m,'repeat');
   const full=document.createElement('canvas'); full.width=W2+32; full.height=H2+32; const fg=full.getContext('2d'); const p2=fg.createPattern(m,'repeat'); fg.fillStyle=p2; fg.fillRect(0,0,full.width,full.height);
   return { clear:T(()=>cx.clearRect(0,0,W2,H2)), scaled:T(()=>{ cx.imageSmoothingEnabled=false; cx.drawImage(off,0,0,160*16,160*16); }),
     mask:T(()=>{ cx.globalCompositeOperation='destination-in'; pat.setTransform(new DOMMatrix([0.5,0,0,0.5,3,3])); cx.fillStyle=pat; cx.fillRect(0,0,W2,H2); cx.globalCompositeOperation='source-over'; }),
     maskInt:T(()=>{ cx.globalCompositeOperation='destination-in'; pat.setTransform(new DOMMatrix([1,0,0,1,3,3])); cx.fillStyle=pat; cx.fillRect(0,0,W2,H2); cx.globalCompositeOperation='source-over'; }),
     maskImg:T(()=>{ cx.globalCompositeOperation='destination-in'; cx.drawImage(full,-5,-7); cx.globalCompositeOperation='source-over'; }),
   }; });
 console.log(r); await b.close(); })();
