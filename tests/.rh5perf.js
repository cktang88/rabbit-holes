const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}); const p=await ctx.newPage();
 await p.goto('http://localhost:8765/rule-hunter/index.html'); await p.waitForTimeout(1000); await p.evaluate(()=>document.querySelectorAll('.modal-bg').forEach(m=>m.remove()));
 const cdp=await ctx.newCDPSession(p); 
 for (const rate of [1,4]){ await cdp.send('Emulation.setCPUThrottlingRate',{rate});
 for (const rs of ['B3/S23','B3678/S34678','B2/S']){
  await p.evaluate(([rs,sp])=>{ __rh.S.noPredict=1; __rh.setRule(__rh.parseRule(rs)); __rh.soup(); document.getElementById("speed").value=sp; __rh.running=true; __rh.setView(80,80,8); },[rs,+process.env.SP||4]);
  await p.waitForTimeout(2200); const f=await p.evaluate(()=>__rh.fps(1500));
  const cost=await p.evaluate(()=>{ const t=performance.now(); for(let i=0;i<30;i++){ __rh.tick(20); __rh.refreshImage(); __rh.render(); } return (performance.now()-t)/30; });
  const st=await p.evaluate(()=>{ const t=performance.now(); for(let i=0;i<30;i++){ __rh.tick(20);} return (performance.now()-t)/30; });
  console.log(rate, rs, 'fps', f.toFixed(1), 'ms/frame', cost.toFixed(2), 'step20', st.toFixed(2)); } }
 await b.close(); })();
