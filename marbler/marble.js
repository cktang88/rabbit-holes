// Marbler: the mathematics of a marbling bath. Pure and deterministic; the page's WebGL shader runs the same maths per pixel.
// The bath is slow, thick Stokes flow, so every move is an exact, invertible map of the plane (after Jaffer & Lu,
// "Mathematical Marbling", IEEE CG&A 2012). An ink drop pushes everything outward; a tine pulls a sheet of fluid
// along a line; a wave shears it sideways; a swirl turns it about a point. Pulling the same tine back undoes it.
(function(root){
'use strict';
const TW=600, TH=400;              // the tray, in bath units
const MAXOPS=480;
// Ottoman and Victorian pigments: [name, reflectance rgb 0..1]
const INKS=[
  ['Indigo',[0.16,0.22,0.42]], ['Madder',[0.66,0.18,0.14]], ['Ochre',[0.82,0.60,0.24]], ['Verdigris',[0.30,0.52,0.46]],
  ['Lamp black',[0.11,0.10,0.10]], ['Rose',[0.84,0.56,0.54]], ['Chalk',[0.94,0.92,0.86]], ['Saffron',[0.90,0.72,0.22]],
  ['Prussian',[0.12,0.27,0.38]], ['Umber',[0.40,0.27,0.17]],
];
const BATH=[0.93,0.89,0.80];       // the size (carrageenan), seen through: pale cream
// tools: each is one exact map. alpha: how far it drags fluid at the line; lambda: how fast that falls off with distance
const TOOLS={
  drop:  {n:'Drop',   d:'Tap to float a drop of ink; hold for a bigger one. It spreads and pushes every ring before it outward.'},
  band:  {n:'Line of ink', halfw:9, d:'Drag to lay a line of ink across the bath. It pushes the bath apart on both sides.'},
  stylus:{n:'Stylus', alpha:38, lambda:7,  d:'One fine point drawn straight across the bath.'},
  comb:  {n:'Comb',   alpha:26, lambda:3,  spacing:25, d:'Many tines at once, a finger\'s width apart.'},
  rake:  {n:'Rake',   alpha:40, lambda:5,  spacing:75, d:'A few wide-set tines: the gel-git of the Ottoman masters.'},
  wave:  {n:'Wave',   amp:14, wavelength:100, d:'Rock the tool as you pull: a Spanish wave.'},
  swirl: {n:'Swirl',  alpha:5.5, lambda:36, d:'Turn the stylus round a point: a snail.'},
};
// an op is a plain array, so a sheet is a short list that fits in a link:
//  ['d', x, y, r, ink]          drop
//  ['b', x, y, angleIndex, halfWidth, ink]  a line of ink across the whole bath
//  ['s'|'c'|'k', x, y, angleIndex] stylus / comb / rake: a line through (x,y), direction angleIndex*15°, pulled along it
//  ['w', x, y, angleIndex]      wave
//  ['o', x, y, turns]           swirl about (x,y); turns = +1 / -1 (anticlockwise / clockwise)
const ANG=(i)=>i*Math.PI/12;
// pull one point back through an op (the inverse map), returning [x,y, insideDropRadius|-1]
function back(op, x, y, t=1){
  switch(op[0]){
    case 'd': { const dx=x-op[1], dy=y-op[2], L2=dx*dx+dy*dy, r=op[3]*Math.sqrt(t), r2=r*r; if (L2<r2) return [x,y,r-Math.sqrt(L2)]; const s=Math.sqrt(1-r2/L2); return [op[1]+dx*s, op[2]+dy*s, -1]; }
    case 'b': { const ac=ANG(op[3]%12), nx=-Math.sin(ac), ny=Math.cos(ac), d=(x-op[1])*nx+(y-op[2])*ny, h=op[4]*t; if (Math.abs(d)<h) return [x,y,h-Math.abs(d)]; const s=Math.sign(d)*h; return [x-nx*s, y-ny*s, -1]; }
    case 's': case 'c': case 'k': { const T=TOOLS[op[0]==='s'?'stylus':op[0]==='c'?'comb':'rake'], a=ANG(op[3]), mx=Math.cos(a), my=Math.sin(a), ac=ANG(op[3]%12);
      let d=(x-op[1])*(-Math.sin(ac))+(y-op[2])*Math.cos(ac); if (T.spacing){ const s=T.spacing; d=d-s*Math.round(d/s); } d=Math.abs(d); const f=T.alpha*t*T.lambda/(d+T.lambda); return [x-mx*f, y-my*f, -1]; }
    case 'w': { const T=TOOLS.wave, a=ANG(op[3]), mx=Math.cos(a), my=Math.sin(a), ac=ANG(op[3]%12), d=(x-op[1])*(-Math.sin(ac))+(y-op[2])*Math.cos(ac), f=T.amp*t*Math.sin(2*Math.PI*d/T.wavelength); return [x-mx*f, y-my*f, -1]; }
    case 'o': { const T=TOOLS.swirl, dx=x-op[1], dy=y-op[2], r=Math.hypot(dx,dy), th=-op[3]*T.alpha*t*T.lambda/(r+T.lambda), c=Math.cos(th), s=Math.sin(th); return [op[1]+dx*c-dy*s, op[2]+dx*s+dy*c, -1]; }
  }
  return [x,y,-1];
}
// what ink is at (x,y) on the bath after these ops: the index of the ink, or -1 for bare bath
const inkOf=(op)=>op[0]==='b'? op[5] : op[4];
function inkAt(ops, x, y){ for (let i=ops.length-1;i>=0;i--){ const r=back(ops[i],x,y); if (r[2]>=0) return inkOf(ops[i]); x=r[0]; y=r[1]; } return -1; }
// the same, but also which drop (for exact comparisons)
function dropAt(ops, x, y){ for (let i=ops.length-1;i>=0;i--){ const r=back(ops[i],x,y); if (r[2]>=0) return i; x=r[0]; y=r[1]; } return -1; }
// the forward map of a tool (for strokes): where does a point go?  (used only to draw tool previews)
function inverseOf(op){ if (op[0]==='o') return ['o',op[1],op[2],-op[3]]; if (op[0]==='d'||op[0]==='b') return null; return [op[0],op[1],op[2],(op[3]+12)%24]; }
// a sampled picture of the bath: ink indices on a grid, for judging and tests
function sample(ops, nx=120, ny=80){ const out=new Int8Array(nx*ny); for (let j=0;j<ny;j++) for (let i=0;i<nx;i++) out[j*nx+i]=inkAt(ops,(i+.5)*TW/nx,(j+.5)*TH/ny); return out; }
function likeness(a, b){ let s=0; for (let i=0;i<a.length;i++) if (a[i]===b[i]) s++; return s/a.length; }
// snapping: strokes go on a 12.5-unit grid, 15° steps
const snapPos=(v)=>Math.round(v/12.5)*12.5, snapAng=(a)=>((Math.round(a/(Math.PI/12))%24)+24)%24;
function strokeFromDrag(tool, x0, y0, x1, y1){ const a=snapAng(Math.atan2(y1-y0,x1-x0)), code={stylus:'s',comb:'c',rake:'k',wave:'w'}[tool];
  // the line is placed by its perpendicular offset, snapped; the start point is kept on the line
  const m=[Math.cos(ANG(a)),Math.sin(ANG(a))], n=[-m[1],m[0]], off=snapPos(x0*n[0]+y0*n[1]), along=x0*m[0]+y0*m[1];
  return [code, round2(n[0]*off+m[0]*along), round2(n[1]*off+m[1]*along), a]; }
const round2=(v)=>Math.round(v*100)/100;

// ---------------- grounds: the drops the master lays before the patterning ----------------
// rows of drops in turn give the striped ground of gel-git; a sprinkle gives a stone ground
function stripesGround(inks, n=17, h=12){ const ops=[]; for (let k=0;k<n;k++) ops.push(['b', TW/2, TH/2, 0, h, inks[k%inks.length]]); return ops; }
function columnsGround(inks, n=25, h=12.5){ const ops=[]; for (let k=0;k<n;k++) ops.push(['b', TW/2, TH/2, 6, h, inks[k%inks.length]]); return ops; }
function stoneGround(inks, seed, n=60){ const r=rng(seed), ops=[]; for (let k=0;k<n;k++) ops.push(['d', round2(r()*TW), round2(r()*TH), round2(16+r()*30), inks[k%inks.length]]); return ops; }
function bullseye(x,y,inks,rings=6,r=14){ const ops=[]; for (let k=0;k<rings;k++) ops.push(['d',x,y,r,inks[k%inks.length]]); return ops; }
// tines across the whole tray, every `step` units, all pulled the same way
function pulls(code, ang, offsets){ const m=[Math.cos(ANG(ang)),Math.sin(ANG(ang))], n=[-m[1],m[0]]; return offsets.map(o=>[code, round2(TW/2+n[0]*o), round2(TH/2+n[1]*o), ang]); }

// ---------------- the commission book: historic papers to reproduce ----------------
// ground: laid for you. recipe: the master's strokes (the judge's reference). pass: how alike the sheet must be.
const C=[]; const add=(o)=>C.push(o);
add({id:'battal', n:'Battal (stone)', era:'Istanbul, 16th c.', t:'The oldest ebru: drops and nothing else. Cover the bath with stones of three inks.', tools:['drop'], inks:[0,1,2], ground:[], recipe:null, judge:'cover', need:.9});
add({id:'line', n:'A single line', era:'First lesson', t:'Draw the stylus once, straight up through the middle of the bullseye.', tools:['drop','band','stylus'], inks:[0,1,2],
  ground:bullseye(300,200,[0,2,1,2],8,16), recipe:[['s',300,200,6]], need:0.9});
add({id:'heart', n:'The heart', era:'Ottoman, 17th c.', t:'Two pulls through a bullseye make a heart. Down, then down again beside it.', tools:['drop','band','stylus'], inks:[0,1,2],
  ground:bullseye(300,220,[1,2,0,2],8,15), recipe:[['s',300,220,18]], need:0.9});
add({id:'gelgit', n:'Gel-git', era:'Turkish "come-go"', t:'Rake the striped ground one way, then back between the first tines.', tools:['drop','band','stylus','rake'], inks:[0,1,2,3],
  ground:stripesGround([0,2,1,3]), recipe:[['k',300,200,6],['k',337.5,200,18]], need:0.85});
add({id:'nonpareil', n:'Nonpareil', era:'England, 18th c.', t:'Gel-git, then a fine comb drawn across it. The commonest bookbinder\'s paper.', tools:['drop','band','stylus','rake','comb'], inks:[0,1,2,3],
  ground:stripesGround([0,2,1,3]), recipe:[['k',300,200,6],['k',337.5,200,18],['c',300,200,0]], need:0.85});
add({id:'restore1', n:'The restorer', era:'A damaged sheet', t:'Someone combed this ground. Comb it back. Stokes flow runs backwards exactly.', tools:['drop','band','stylus','rake','comb'], inks:[0,1,2,3],
  ground:stripesGround([0,2,1,3]).concat([['c',300,200,6]]), recipe:[['c',300,200,18]], target:'ground', need:0.95});
add({id:'wave', n:'Spanish wave', era:'Spain, 17th c.', t:'Stone ground, then a wave rocked across it.', tools:['drop','band','stylus','rake','comb','wave'], inks:[1,2,4,6],
  ground:stoneGround([1,2,4,6],'wave',70), recipe:[['w',300,200,0]], need:0.85});
add({id:'peacock', n:'Peacock', era:'Bookbinders, 19th c.', t:'Gel-git, a wave across it, then a fine comb: the eyes of the peacock.', tools:['drop','band','stylus','rake','comb','wave'], inks:[0,2,3,5],
  ground:columnsGround([0,2,3,5]), recipe:[['k',300,200,0],['k',300,237.5,12],['w',300,200,6],['c',300,200,0]], need:0.8});
add({id:'tulip', n:'Turkish tulip', era:'Hatip ebru, 18th c.', t:'A tall bullseye pulled up at the bottom and pinched at the top. Three strokes.', tools:['drop','band','stylus','swirl'], inks:[1,3,2,5],
  ground:bullseye(300,160,[3,1,5,1,2],6,18).concat(bullseye(300,260,[1,5,1],3,12)), recipe:[['s',300,120,6],['s',287.5,300,18],['s',312.5,300,18]], need:0.85});
add({id:'snail', n:'Snail', era:'Shell papers, France', t:'A turn of the stylus about the centre of the stone ground.', tools:['drop','band','stylus','rake','comb','wave','swirl'], inks:[0,2,6,8],
  ground:stoneGround([0,2,6,8],'snail',70), recipe:[['o',300,200,1]], need:0.85});
add({id:'bouquet', n:'Bouquet', era:'Victorian, 1860s', t:'Gel-git, a comb, then a wave and a comb back: flowers in rows.', tools:['drop','band','stylus','rake','comb','wave','swirl'], inks:[1,3,5,7],
  ground:stripesGround([1,3,5,7]), recipe:[['k',300,200,6],['k',337.5,200,18],['c',300,200,0],['w',300,200,6],['c',312.5,200,12]], need:0.8});
add({id:'restore2', n:'The second restorer', era:'A badly damaged sheet', t:'Raked, waved and swirled. Undo all three, in the right order.', tools:['drop','band','stylus','rake','comb','wave','swirl'], inks:[0,2,1,3],
  ground:stripesGround([0,2,1,3]).concat([['k',300,200,0],['w',300,200,6],['o',300,200,-1]]), recipe:[['o',300,200,1],['w',300,200,18],['k',300,200,12]], target:'ground', need:0.95});
const COMMISSIONS=C;
// the reference picture a commission is judged against
function targetOps(c){ if (c.target==='ground'){ const g=c.ground.slice(); let k=g.length; while (k>0 && g[k-1][0]!=='d' && g[k-1][0]!=='b') k--; return g.slice(0,k); } return c.ground.concat(c.recipe||[]); }
function judge(c, ops, cache){ if (c.judge==='cover'){ const s=sample(ops,90,60); let n=0; const inks=new Set(); for (const v of s){ if (v>=0){ n++; inks.add(v); } } return {score:n/s.length, ok:n/s.length>=c.need && inks.size>=3}; }
  const t=cache||sample(targetOps(c)), g=sample(c.ground), m=sample(ops); let u=0, hit=0;
  for (let i=0;i<t.length;i++) if (t[i]!==g[i] || m[i]!==g[i]){ u++; if (m[i]===t[i]) hit++; }
  const score= u? hit/u : 1; return {score, ok:score>=c.need}; }
const strokesOf=(c, ops)=>ops.length-c.ground.length;

// the daily sheet: a ground and three or four strokes, from the date
function daily(key){ const r=rng('marbler:'+key), inks=[]; while (inks.length<4){ const k=Math.floor(r()*INKS.length); if (!inks.includes(k) && k!==6) inks.push(k); }
  const g= r()<.5? stripesGround(inks) : r()<.5? columnsGround(inks) : stoneGround(inks,'d'+key,70);
  const codes=['k','c','w','s','o'], rec=[]; const n=3+Math.floor(r()*2);
  for (let k=0;k<n;k++){ const c=codes[Math.floor(r()*codes.length)]; if (c==='o') rec.push(['o',snapPos(150+r()*300),snapPos(100+r()*200), r()<.5?1:-1]); else rec.push([c, snapPos(100+r()*400), snapPos(100+r()*200), Math.floor(r()*4)*6]); }
  return {id:'daily:'+key, n:'Daily sheet', era:key, t:'Today\'s paper, the same for everyone. Match it in as few strokes as you can.', tools:['drop','band','stylus','rake','comb','wave','swirl'], inks, ground:g, recipe:rec, need:.9, daily:true}; }

// links: a sheet is its op list, packed small
const CODES='dsckwob';
function encode(id, ops){ const parts=[id]; for (const o of ops){ parts.push(CODES.indexOf(o[0])+':'+o.slice(1).map(v=>+(+v).toFixed(2)).join(':')); } return btoa(unescape(encodeURIComponent(parts.join(';')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function decode(s){ try{ const parts=decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/')))).split(';'); const id=parts.shift(); const ops=[];
  for (const p of parts.slice(0,MAXOPS)){ const v=p.split(':').map(Number); const code=CODES[v[0]]; if (!code || v.slice(1).some(x=>!Number.isFinite(x))) continue;
    if (code==='d' && v.length===5) ops.push(['d', clamp(v[1],-50,TW+50), clamp(v[2],-50,TH+50), clamp(v[3],2,120), clamp(v[4]|0,0,INKS.length-1)]);
    else if ('sckw'.includes(code) && v.length===4) ops.push([code, clamp(v[1],-50,TW+50), clamp(v[2],-50,TH+50), ((v[3]|0)%24+24)%24]);
    else if (code==='b' && v.length===6) ops.push(['b', clamp(v[1],-50,TW+50), clamp(v[2],-50,TH+50), ((v[3]|0)%24+24)%24, clamp(v[4],2,60), clamp(v[5]|0,0,INKS.length-1)]);
    else if (code==='o' && v.length===4) ops.push(['o', clamp(v[1],-50,TW+50), clamp(v[2],-50,TH+50), v[3]<0?-1:1]); }
  return {id:String(id).slice(0,40), ops}; } catch(e){ return null; } }
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(seed){ let h=2166136261; for (const ch of String(seed)){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); } let a=h>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

const M={inkOf,TW,TH,MAXOPS,INKS,BATH,TOOLS,COMMISSIONS,back,inkAt,dropAt,inverseOf,sample,likeness,strokeFromDrag,snapPos,snapAng,stripesGround,columnsGround,stoneGround,bullseye,pulls,targetOps,judge,strokesOf,daily,encode,decode,rng,ANG};
if (typeof module!=='undefined' && module.exports) module.exports=M; else root.MB=M;
})(typeof self!=='undefined'? self : this);
