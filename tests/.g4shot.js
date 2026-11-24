const { chromium } = require('playwright');
const D='/tmp/claude-0/-home-user-rabbit-holes/c1fe3433-642f-5542-b5e5-27aeeb280bc3/scratchpad/g4/';
(async()=>{ const b=await chromium.launch(); const [g, tag, script, wait] = process.argv.slice(2);
for (const [w,h] of [[1280,800],[390,844]]){ const ctx=await b.newContext({viewport:{width:w,height:h}}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push('console:'+m.text()); });
 await p.goto('http://localhost:8765/'+g+'/index.html'); await p.waitForTimeout(1200); await p.evaluate(()=>document.querySelectorAll('.modal-bg').forEach(m=>m.remove()));
 if (script) await p.evaluate(script); await p.waitForTimeout(+wait||400);
 await p.screenshot({path:D+g+'-'+tag+'-'+w+'.png'}); console.log(g,w,errs, await p.evaluate(()=>document.scrollingElement.scrollWidth)); await ctx.close(); }
await b.close(); })();
