const { chromium } = require('playwright');
const D='/tmp/claude-0/-home-user-rabbit-holes/c1fe3433-642f-5542-b5e5-27aeeb280bc3/scratchpad/g4/';
(async()=>{ const b=await chromium.launch(); const [g, tag, script] = process.argv.slice(2);
for (const [w,h] of [[390,844],[844,390]]){ const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:true}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8765/'+g+'/index.html'); await p.waitForTimeout(1200); await p.evaluate(()=>document.querySelectorAll('.modal-bg').forEach(m=>m.remove()));
 if (script) await p.evaluate(script); await p.waitForTimeout(500);
 await p.screenshot({path:D+g+'-m'+tag+'-'+w+'.png'}); console.log(g,w,errs); await ctx.close(); }
await b.close(); })();
