const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const url=process.argv[2]||'rule-hunter/index.html'; const out=process.argv[3]||'rh';
 for (const [n,vp,dpr] of [['phone',{width:390,height:844},2],['desk',{width:1280,height:800},1],['land',{width:844,height:390},2]]){
  const ctx=await b.newContext({viewport:vp,deviceScaleFactor:dpr, hasTouch:n!=='desk'}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/'+url); await p.waitForTimeout(1500); await p.evaluate(()=>document.querySelectorAll('.modal-bg').forEach(m=>m.remove()));
  if (process.env.PRE) await p.evaluate(process.env.PRE);
  await p.waitForTimeout(+process.env.WAIT||800);
  await p.screenshot({path:`/tmp/claude-0/-home-user-rabbit-holes/c1fe3433-642f-5542-b5e5-27aeeb280bc3/scratchpad/rh5/${out}-${n}.png`}); console.log(n, errs); await ctx.close(); }
 await b.close(); })();
