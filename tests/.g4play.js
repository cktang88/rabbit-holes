const { chromium } = require('playwright');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:800}}); p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/fold/index.html'); await p.waitForTimeout(800); await p.evaluate(()=>document.querySelectorAll('.modal-bg').forEach(m=>m.remove()));
const cs=await p.evaluate(()=>__fold.cellSize);
const drag=async(i,dx,dy)=>{ const [x,y]=await p.evaluate((i)=>__fold.screen(i),i); await p.mouse.move(x,y); await p.mouse.down(); for (let k=1;k<=10;k++) await p.mouse.move(x+dx*cs*k/10,y+dy*cs*k/10); await p.mouse.up(); return p.evaluate(()=>[JSON.stringify(__fold.pos), __fold.contacts().c, JSON.stringify(__fold.ghostFold())]); };
console.log(await p.evaluate(()=>JSON.stringify(__fold.ghostFold())));
console.log(await drag(0,0,1)); console.log(await drag(3,0,1));
await p.screenshot({path:'/tmp/claude-0/-home-user-rabbit-holes/c1fe3433-642f-5542-b5e5-27aeeb280bc3/scratchpad/g4/fold-w1.png'});
await b.close(); })();
