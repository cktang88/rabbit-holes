const { chromium } = require('playwright'); const spec=require('./mobile.test.js');
(async()=>{ const b=await chromium.launch(); for (const [name,fn] of Object.entries(spec.tests)){ if (!/^(fold|nand) /.test(name)) continue;
  const ctx=await b.newContext({viewport:{width:1280,height:800}}); const page=await ctx.newPage(); await page.goto('http://localhost:8765/index.html');
  try { await fn({page, ok:(v,m)=>{ if(!v) throw new Error(m); }}); console.log('ok  ',name); } catch(e){ console.log('FAIL',name,e.message); } await ctx.close(); }
await b.close(); })();
