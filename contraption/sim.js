// The Gentle Machine: the physics. Pure and deterministic: no clock, no Math.random, a fixed 1/60 s step.
// Loaded by index.html (global GM) and by node scripts and tests (module.exports).
(function(root){
'use strict';
const pl = (typeof planck!=='undefined') ? planck : require(__dirname+'/../shared/vendor/planck/planck-1.5.0.min.js');
const BW=24, BH=14, DT=1/60, TMAX=20*60, FUTURES=10;
const V=(x,y)=>pl.Vec2(x,y), RAD=Math.PI/180;
function rng(seed){ let h=1779033703^String(seed).length; for (const ch of String(seed)){ h=Math.imul(h^ch.charCodeAt(0),3432918353); h=h<<13|h>>>19; }
  let a=h>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// ---------- What the machine carries. Each has its own physics personality. ----------
// limit: the hardest single bump (a change of speed, m/s, inside one step) it survives.
const CARGO={
  egg:   {n:'Hen\'s egg', limit:5, d:'Fragile: a drop from your knee cracks it.'},
  goose: {n:'Goose egg', limit:5.4, d:'Bigger, heavier and nearly as fragile: it squashes cushions flat.'},
  bubble:{n:'Soap bubble', limit:1.8, d:'Almost weightless, so the faintest draught carries it, and a tap bursts it.'},
  watch: {n:'Pocket watch', limit:7.5, d:'Tough, but it must come to rest face up.'},
  jelly: {n:'Quince jelly', limit:99, stretch:1.4, d:'Soft: it wobbles, rolls like a wheel and will not sit still. Land it hard and it splits.'},
};
const CARGO_ORDER=['egg','goose','bubble','watch','jelly'];
// ---------- The parts box ----------
const PARTS={
  plank:  {n:'Plank', cost:1, d:'A fixed beech plank. A slope turns a fall into a slide.'},
  cushion:{n:'Cushion', cost:2, d:'A light board on a soft spring: it gives way, and slows what lands on it.'},
  hammock:{n:'Hammock', cost:3, d:'Seven slats on springy cords between two pegs.'},
  seesaw: {n:'Seesaw', cost:3, d:'A board on a pivot: catch something on one end and lower it.'},
  block:  {n:'Block', cost:1, d:'A maple block. Something to bump into, or a light counterweight.'},
  weight: {n:'Weight', cost:2, d:'A small iron weight, eight times heavier than a block.'},
  balloon:{n:'Balloon', cost:2, d:'Placed near the hopper, it is tied to the cargo as a parachute. Draughts push it about.'},
};
const PTYPES=Object.keys(PARTS);

// ---------- Benches ----------
// drop: [x,y,vx,vy] where the hopper lets the cargo go. basket: [x,y] (its floor). fixed: static boards [x,y,halfW,halfH,deg]. pass: how many of the ten tomorrows must come through.
const BENCHES=[
 {id:'first', note:'Dear Porter, thank you. The shop below wants eggs and the stair is steep, so I shall keep sending them down to you. B.', n:'The first egg', t:'Bring the egg down to the basket without cracking it.', cargo:'egg', drop:[3,4], basket:[12,0], bin:{plank:3},
  sol:[['plank',4,3.5,-1],['plank',7,2.5,-1],['plank',10,1.4,-1]]},
 {id:'zigzag', note:'That shaft was the old dumb-waiter. Mind your elbows. B.', n:'The long way down', t:'A deep shaft. Spend the height slowly.', cargo:'egg', drop:[3,9.9], basket:[3.1,0], fixed:[[2,5.25,.15,5.25,0],[5.9,5.25,.15,5.25,0]], bin:{plank:6},
  sol:[['plank',3.65,9.4,-1],['plank',4.25,7.95,1],['plank',3.65,6.5,-1],['plank',4.25,5.05,1],['plank',3.65,3.6,-1],['plank',4.25,2.15,1]]},
 {id:'cushion', note:'Soft landings! I have told nobody it is me sending them. B.', n:'Something soft', t:'Straight down is quickest. Make the landing soft.', cargo:'egg', drop:[8,7], basket:[12,0], bin:{cushion:2, plank:1},
  sol:[['cushion',8.25,3.75,-2],['cushion',9.75,2.5,-2]]},
 {id:'hammock', note:'The hammock is off the ship my grandmother crossed on. She was a sea-hen. B.', n:'The hammock', t:'A high hopper, and the basket almost underneath it.', cargo:'egg', drop:[6,10], basket:[9,0], bin:{hammock:1, cushion:1, plank:2},
  sol:[['hammock',6.5,2,-3]]},
 {id:'wall', note:"The wall is the vicar's. He says it keeps the foxes out. I am not a fox. B.", n:'Over the wall', t:'A wall stands between the hopper and the basket.', cargo:'egg', drop:[3,8], basket:[16,0], fixed:[[11.5,2.5,.2,2.5,0]], bin:{plank:4, hammock:1, cushion:2},
  sol:[['plank',4,7.5,-1],['plank',7,6.6,-1],['plank',10,5.7,-1],['hammock',14,2.5,-2]]},
 {id:'goose', note:'My cousin from the pond has one for you too. She is a good deal heavier than me. B.', n:'A heavier charge', t:'A goose egg: twice the weight, nearly as fragile.', cargo:'goose', drop:[4,10], basket:[16,0], bin:{plank:4, cushion:2, hammock:1},
  sol:[['plank',5,9.5,-1],['plank',8,8.45,-1],['plank',11,7.4,-1],['hammock',14.5,5,-2],['cushion',17,2.5,-1]]},
 {id:'seesaw', note:'We had a seesaw in the yard once. It was the best summer. B.', n:'Catch and lower', t:'No room for a ramp. Catch it, and let it down slowly.', cargo:'goose', drop:[5,4.6], basket:[3.9,0], fixed:[[2.2,2.6,.15,2.6,0],[9.5,2.6,.15,2.6,0]], bin:{seesaw:1, weight:2, block:2, plank:1},
  sol:[['seesaw',6,1.5,0],['block',6,2.1,0],['block',8,2.3,0]]},
 {id:'handoff', note:'Sorry about the hurry. I sat on the lever. B.', n:'In a hurry', t:'This hopper throws the goose egg out fast. Meet it at the angle it is falling.', cargo:'goose', drop:[2,5,6,0], basket:[11,0], bin:{cushion:1, plank:2, block:2},
  sol:[['plank',6.5,2.5,-1]]},
 {id:'parachute', note:'I watched it float all the way down from the roost. I clucked out loud. B.', n:'Parachute', t:'A very high hopper, a shelf in the way, and draughts. Tie on a balloon.', cargo:'goose', drop:[5,13], basket:[2,0], fixed:[[6.5,8,2.5,.12,0]], bin:{balloon:1, plank:3, cushion:1},
  sol:[['balloon',5,14,0],['plank',4.5,10,3],['plank',1,2,-3],['plank',3.5,1.5,4]]},
 {id:'bubble', note:"The bubbles are from Monday's washing. They are a treat, not a delivery. B.", n:'A soap bubble', t:'It floats down by itself. The draughts are the trouble.', cargo:'bubble', drop:[12,12], basket:[12,0], bin:{plank:4},
  sol:[['plank',10.3,3.3,-3],['plank',13.7,3.3,3]]},
 {id:'watch', note:"The watch was my grandfather's. Face up, so he can see where he is going. B.", n:'Face up', t:'A pocket watch. It is tough, but it must come to rest face up.', cargo:'watch', drop:[3,7], basket:[11,0], bin:{plank:4, cushion:1, block:1},
  sol:[['plank',4,6.3,-2],['plank',6.5,4.5,-2],['plank',9,2,-2]]},
 {id:'jelly', note:'The quince jelly is for you, Porter. You have earned it. B.', n:'Quince jelly', t:'It does not mind a bump. It minds being pulled apart.', cargo:'jelly', drop:[4,7], basket:[9,0], bin:{plank:4, hammock:1, cushion:2},
  sol:[['hammock',5,3,-1]]},
 {id:'grand', note:'You have guessed by now. I am Bertha, the brown hen in the loft, and the eggs were never for the shop. They hatch better somewhere soft. Look in your baskets. B.', n:'The grand delivery', t:'A goose egg from the very top corner to the very far one. Cheapest wins.', cargo:'goose', drop:[1.5,13], basket:[22,0], fixed:[[8,9,2,.12,0],[16,5,2,.12,0]], bin:{plank:6, cushion:2, hammock:1, seesaw:1, weight:2, block:2, balloon:1},
  sol:[['plank',2.5,12.5,-1],['plank',5.5,11.45,-1],['plank',8.5,10.4,-1],['plank',11.5,9.35,-1],['plank',14.5,8.3,-1],['plank',17.5,7.25,-1],['cushion',20.5,4,-1]]},
];

// ---------- The ten tomorrows ----------
// Tomorrow 0 is the bench as drawn. The others nudge the drop, tilt the table a little and send a draught at some moment.
function futureParams(B,k){ if (!k) return {k, dx:0, dvx:0, tilt:0, gust:0, g0:0, g1:0, why:'as drawn'};
  const r=rng((B.seed||B.id)+':'+k), dx=(r()-.5)*.4, dvx=(r()-.5)*.6, tilt=(r()-.5)*3, gust=(r()<.5?-1:1)*(.6+r()*1.2), g0=Math.floor((.5+r()*3.5)*60), g1=g0+Math.floor((.6+r()*.8)*60);
  const why=Math.abs(gust)>1.3? `a strong draught from the ${gust>0?'left':'right'}` : Math.abs(tilt)>1.1? `the table tilted ${tilt>0?'left':'right'}` : `the drop ${dx>0?'a little right':'a little left'}`;
  return {k, dx, dvx, tilt, gust, g0, g1, why}; }

// ---------- One run of one tomorrow ----------
const FR=(o)=>Object.assign({friction:.5, restitution:.05, density:1}, o);
class Sim{
  constructor(B, parts, k=0){
    this.B=B; this.k=k; this.fp=futureParams(B,k); this.t=0; this.done=false; this.result=null;
    this.bump=0; this.peak=0; this.stretch=1; this.peakStretch=1; this.hold=0; this.found=new Set(); this.events=[];
    const g=10, a=this.fp.tilt*RAD; this.world=new pl.World({gravity:V(Math.sin(a)*g, -Math.cos(a)*g)});
    this.bodies=[]; this.imp=new Map(); this.cargoBodies=[]; this.free=0; this.vxSign=0; this.flips=0;
    this.build(parts||[]);
    this.world.on('post-solve',(c,imp)=>{ const n=imp.normalImpulses; let s=0; for (const x of n) s+=x; if (!s) return;
      const A=c.getFixtureA().getBody(), Bb=c.getFixtureB().getBody(); if (A===this.basket.b||Bb===this.basket.b) s*=.6;
      for (const b of [A,Bb]) if (b.cg) this.imp.set(b,(this.imp.get(b)||0)+s); });
    this.world.on('begin-contact',(c)=>this.contact(c));
  }
  add(o){ this.bodies.push(o); o.b.o=o; return o; }
  box(type,x,y,hw,hh,deg,fix,kind,extra){ const b=this.world.createBody({type, position:V(x,y), angle:(deg||0)*RAD}); b.createFixture(pl.Box(hw,hh), FR(fix)); return this.add(Object.assign({kind, b, hw, hh, area:4*hw*hh}, extra)); }
  ball(type,x,y,r,fix,kind,extra){ const b=this.world.createBody({type, position:V(x,y)}); b.createFixture(pl.Circle(r), FR(fix)); return this.add(Object.assign({kind, b, r, area:Math.PI*r*r}, extra)); }
  build(parts){ const B=this.B, w=this.world;
    const ground=w.createBody(); ground.createFixture(pl.Box(BW/2+1,.5,V(BW/2,-.5),0),FR({friction:.7})); ground.createFixture(pl.Box(.5,BH*2,V(-.5,BH),0)); ground.createFixture(pl.Box(.5,BH*2,V(BW+.5,BH),0));
    this.add({kind:'ground', b:ground});
    for (const f of B.fixed||[]) this.box('static',f[0],f[1],f[2],f[3],f[4]||0,{friction:.5},'fixed');
    // the basket: a felt-lined tray (its floor is soft felt: the last bump into it counts half)
    const [bx,by]=B.basket, bk=w.createBody({type:'static', position:V(bx,by)});
    bk.createFixture(pl.Box(.8,.06,V(0,.06),0),FR({friction:.9})); bk.createFixture(pl.Box(.06,.3,V(-.8,.3),0),FR()); bk.createFixture(pl.Box(.06,.3,V(.8,.3),0),FR());
    this.basket=this.add({kind:'basket', b:bk});
    parts.forEach((p,i)=>{ for (const o of this.makePart(p,i)) { o.part=i; o.ptype=p[0]; } });
    this.makeCargo();
    for (const o of this.bodies) if (o.part!=null && o.b.isDynamic()) o.y0=o.b.getPosition().y;
    // balloons placed near the hopper are tied to the cargo
    const [dx,dy]=B.drop; for (const o of this.bodies) if (o.kind==='balloon'){ const p=o.b.getPosition(); if (Math.hypot(p.x-dx,p.y-dy)<3){ const c=this.cargo.b;
      w.createJoint(pl.RopeJoint({maxLength:Math.max(.8,Math.hypot(p.x-dx,p.y-dy))}, o.b, c, p, c.getPosition())); o.tied=c; } }
  }
  makePart([t,x,y,turn],i){ const a=(turn||0)*15, w=this.world, out=[]; const push=(o)=>{ out.push(o); return o; };
    switch(t){
      case 'plank': push(this.box('static',x,y,1.5,.1,a,{friction:.45},'plank')); break;
      case 'block': push(this.box('dynamic',x,y,.35,.35,a,{density:1,friction:.6},'block')); break;
      case 'weight': push(this.box('dynamic',x,y,.25,.25,a,{density:8,friction:.6},'weight')); break;
      case 'balloon': { const o=push(this.ball('dynamic',x,y,.5,{density:.05,restitution:.3},'balloon',{windK:1.8})); o.b.setLinearDamping(1.2); o.b.setAngularDamping(2); break; }
      case 'cushion': { // a static foot, and a light board that slides along the foot's axis on a soft spring
        const ax=V(-Math.sin(a*RAD), Math.cos(a*RAD)), base=V(x-ax.x*.7, y-ax.y*.7);
        const foot=w.createBody({type:'static', position:base, angle:a*RAD}); foot.createFixture(pl.Box(.5,.08),FR());
        push(this.add({kind:'cfoot', b:foot, hw:.5, hh:.08}));
        const pad=this.box('dynamic',x,y,.85,.07,a,{density:1,friction:.8},'cushion'); push(pad); pad.base=base; pad.axis=ax;
        w.createJoint(pl.PrismaticJoint({enableLimit:true, lowerTranslation:-.6, upperTranslation:0}, foot, pad.b, V(x,y), ax));
        w.createJoint(pl.DistanceJoint({frequencyHz:4, dampingRatio:.7, length:.95}, foot, pad.b, base, V(x,y)));
        break; }
      case 'hammock': { const n=7, span=3, c=Math.cos(a*RAD), s=Math.sin(a*RAD), seg=span/n*.5, sag=.12;
        const pegs=[[-1,'L'],[1,'R']].map(([d])=>{ const pg=w.createBody({type:'static', position:V(x+d*span/2*c, y+d*span/2*s)}); pg.createFixture(pl.Circle(.1),FR({isSensor:true})); return push(this.add({kind:'peg', b:pg, r:.1})); });
        let prev=null; const slats=[];
        for (let k=0;k<n;k++){ const u=-span/2+seg+k*2*seg, dropY=-sag*(1-(2*u/span)**2); const o=push(this.box('dynamic',x+u*c-dropY*s*0, y+u*s+dropY, seg*.96, .05, a, {density:.6,friction:.9},'slat')); slats.push(o);
          if (prev){ const m=prev.b.getPosition(), q=o.b.getPosition(); w.createJoint(pl.RevoluteJoint({}, prev.b, o.b, V((m.x+q.x)/2,(m.y+q.y)/2))); } prev=o; }
        // springy cords from each peg to the end slats
        for (const [pg,sl,sgn] of [[pegs[0],slats[0],-1],[pegs[1],slats[n-1],1]]){ const e=sl.b.getWorldPoint(V(sgn*seg,0)); w.createJoint(pl.DistanceJoint({frequencyHz:4, dampingRatio:1}, pg.b, sl.b, pg.b.getPosition(), e)); }
        break; }
      case 'seesaw': { const pv=w.createBody({type:'static', position:V(x,y)}); pv.createFixture(pl.Polygon([V(-.35,-.55),V(.35,-.55),V(0,0)]),FR());
        push(this.add({kind:'pivot', b:pv}));
        const bd=this.box('dynamic',x,y+.09,1.8,.08,a,{density:1,friction:.8},'seesaw'); push(bd); w.createJoint(pl.RevoluteJoint({}, pv, bd.b, V(x,y+.04))); break; }
    }
    return out; }
  makeCargo(){ const B=this.B, fp=this.fp, w=this.world, type=B.cargo||'egg', C=CARGO[type]; let [x,y,vx,vy,ang]=B.drop; x+=fp.dx; vx=(vx||0)+fp.dvx; vy=vy||0;
    this.ctype=type; this.limit=C.limit;
    const mk=(b,kind,extra)=>{ b.cg=true; if (ang) b.setAngle(ang*RAD); b.setBullet(true); b.setLinearVelocity(V(vx,vy)); this.cargoBodies.push(b); return this.add(Object.assign({kind, b, cargo:true}, extra)); };
    if (type==='egg'||type==='goose'){ // rolls as a ball (an egg's wobble is its rolling drag); drawn as an egg
      const sx= type==='egg'? .25 : .32, sy= type==='egg'? .32 : .41, r=(sx+sy)/2*.95;
      const b=w.createBody({type:'dynamic', position:V(x,y)}); b.createFixture(pl.Circle(r), FR({density: type==='egg'? 1 : 1.3, friction:.6, restitution:.08}));
      b.setAngularDamping(1.2); this.cargo=mk(b,'egg',{sx,sy,r,area:Math.PI*sx*sy}); }
    else if (type==='bubble'){ const b=w.createBody({type:'dynamic', position:V(x,y)}); b.createFixture(pl.Circle(.42), FR({density:.05, restitution:.3, friction:.2})); b.setLinearDamping(1); this.cargo=mk(b,'bubble',{r:.42, area:Math.PI*.42*.42, windK:1.8}); }
    else if (type==='watch'){ const b=w.createBody({type:'dynamic', position:V(x,y)}); b.createFixture(pl.Box(.34,.1), FR({density:3, friction:.35, restitution:.1})); this.cargo=mk(b,'watch',{hw:.34, hh:.1, area:.14}); }
    else if (type==='jelly'){ // a centre and eight rim drops on springy threads: 16 joints, cheap enough for a phone
      const c=w.createBody({type:'dynamic', position:V(x,y)}); c.createFixture(pl.Circle(.2), FR({density:1.2, friction:.6, filterGroupIndex:-7}));
      this.cargo=mk(c,'jelly',{r:.2, area:.5}); const rim=[], R=.38;
      for (let k=0;k<8;k++){ const th=k/8*Math.PI*2, b=w.createBody({type:'dynamic', position:V(x+Math.cos(th)*R, y+Math.sin(th)*R)}); b.createFixture(pl.Circle(.11), FR({density:1.2, friction:.7, restitution:0, filterGroupIndex:-7})); rim.push(mk(b,'jrim',{r:.11, area:.04})); }
      this.links=[]; const link=(A,Bb)=>{ const pa=A.getPosition(), pb=Bb.getPosition(), L=Math.hypot(pa.x-pb.x,pa.y-pb.y); this.links.push({j:w.createJoint(pl.DistanceJoint({frequencyHz:6, dampingRatio:.5}, A, Bb, pa, pb)), A, B:Bb, L}); };
      for (let k=0;k<8;k++){ link(c, rim[k].b); link(rim[k].b, rim[(k+1)%8].b); } this.rim=rim; }
  }
  contact(c){ const A=c.getFixtureA().getBody().o, B=c.getFixtureB().getBody().o; if (!A||!B) return;
    for (const [x,y] of [[A,B],[B,A]]){ if (!x.cargo || y.cargo) continue;
      // a handoff: the cargo runs into a loose part and gives it its speed
      if ((y.kind==='block'||y.kind==='weight') && !this.handoff){ const vr=x.b.getLinearVelocity().clone().sub(y.b.getLinearVelocity()).length(); if (vr>2) this.handoff={o:y, t:this.t, v:x.b.getLinearVelocity().length()}; }
      if (y.kind==='cushion' && !this.found.has('cushion')) this.onCushion=y;
    } }
  cargoTouching(){ const out=[]; for (const cb of this.cargoBodies) for (let ce=cb.getContactList(); ce; ce=ce.next){ if (ce.contact.isTouching() && ce.other.o && !ce.other.o.cargo) out.push(ce.other.o); } return out; }
  step(){ if (this.done) return true; const fp=this.fp, t=this.t;
    // forces: balloons lift, the bubble floats, the draught pushes light broad things most
    for (const o of this.bodies){ const b=o.b; if (!b.isDynamic()) continue;
      if (o.kind==='balloon'){ const extra=o.tied? this.cargoWeight()*.82 : 0, v=b.getLinearVelocity(), sp=v.length(); b.applyForceToCenter(V(-.35*v.x*sp, b.getMass()*10*1.5+extra-.35*v.y*sp), true); }
      if (o.kind==='bubble') b.applyForceToCenter(V(0, b.getMass()*10*.9), true);
      if (fp.gust && t>=fp.g0 && t<fp.g1) b.applyForceToCenter(V(o.kind==='balloon'? fp.gust*.35 : fp.gust*b.getMass()*(o.windK||1), 0), true); }
    this.imp.clear(); this.world.step(DT, 8, 3); this.t++;
    // the bump this step: the change of speed the contacts forced on the cargo
    let bump=0; for (const [b,s] of this.imp) bump=Math.max(bump, s/b.getMass()); if (this.ctype==='jelly') bump=0;
    this.bump=bump; if (bump>this.peak) this.peak=bump;
    if (this.links){ let st=1; for (const L of this.links){ const pa=L.A.getPosition(), pb=L.B.getPosition(); st=Math.max(st, Math.hypot(pa.x-pb.x,pa.y-pb.y)/L.L); } this.stretch=st; if (st>this.peakStretch) this.peakStretch=st; }
    this.observe();
    const C=CARGO[this.ctype], p=this.cargo.b.getPosition();
    if (this.ctype==='jelly'? this.stretch>C.stretch : bump>C.limit){ return this.finish(false, this.ctype==='egg'||this.ctype==='goose'? 'cracked' : this.ctype==='bubble'? 'burst' : this.ctype==='jelly'? 'torn' : 'smashed'); }
    if (p.y<-2 || p.x<-1 || p.x>BW+1) return this.finish(false,'lost');
    const [bx,by]=this.B.basket, inB=Math.abs(p.x-bx)<.75 && p.y>by && p.y<by+1, slow=this.cargo.b.getLinearVelocity().length()<.4;
    this.hold= inB&&slow? this.hold+1 : 0;
    if (this.hold>=40){ if (this.ctype==='watch'){ const an=Math.cos(this.cargo.b.getAngle()); if (an<.7) return this.finish(false,'face down'); } return this.finish(true,'safe'); }
    this.still= this.cargo.b.getLinearVelocity().length()<.05 && !inB ? (this.still||0)+1 : 0;
    if (this.t>=TMAX || this.still>90) return this.finish(false,'stuck');
    return false; }
  cargoWeight(){ let m=0; for (const b of this.cargoBodies) m+=b.getMass(); return m*10; }
  finish(ok, why){ this.done=true; const C=CARGO[this.ctype];
    const gentle= this.ctype==='jelly'? Math.round(Math.max(0,this.peakStretch-1)/(C.stretch-1)*100) : Math.round(this.peak/C.limit*100);
    if (ok && gentle<=30) this.found.add('feather');
    if (!ok && why==='cracked' && Math.max(this.free,this.lastFree||0)>60) this.found.add('freefall');
    if (!ok && why==='face down') this.found.add('facedown');
    if (!ok && why==='torn') this.found.add('torn');
    if (!ok && why==='burst') this.found.add('burst');
    this.result={ok, why, t:this.t, gentle:Math.min(gentle,999), k:this.k}; return true; }
  // ----- recognising braking techniques from what actually happens -----
  observe(){ const F=this.found, c=this.cargo.b, v=c.getLinearVelocity(), sp=v.length(), touch=this.cargoTouching(), t=this.t;
    if (touch.length){ if (this.free) this.lastFree=this.free; this.free=0; } else this.free++;
    const onPlank=touch.find(o=>o.kind==='plank'); if (onPlank && Math.abs(Math.sin(onPlank.b.getAngle()))>.2){ this.slide=(this.slide||0)+1; if (this.slide>50 && sp<4.5) F.add('ramp');
      if (Math.abs(v.x)>.6){ const sg=Math.sign(v.x); if (this.vxSign && sg!==this.vxSign){ this.flips++; if (this.flips>=2) F.add('switchback'); } this.vxSign=sg; } }
    for (const o of touch){
      if (o.kind==='cushion'){ const p=o.b.getPosition(); const d=(p.x-o.base.x)*o.axis.x+(p.y-o.base.y)*o.axis.y; if (d<.95-.2) F.add('cushion'); }
      if (o.kind==='slat' && o.y0-o.b.getPosition().y>.3) F.add('hammock');
      if (o.kind==='seesaw'){ if (this.lever==null) this.lever=c.getPosition().y; if (this.lever-c.getPosition().y>.8 && Math.abs(o.b.getAngularVelocity())>.2) F.add('lever');
        // something on the other end went up: a counterweight
        for (const q of this.bodies) if ((q.kind==='weight'||q.kind==='block') && q.b.getPosition().y-q.y0>.5 && Math.abs(o.b.getAngularVelocity())>.2) F.add('counterweight'); }
      if (o.kind==='basket' && this.ctype==='watch' && Math.cos(c.getAngle())>.9) { /* face up on arrival */ }
    }
    if (this.cargoBodies.length && this.bodies.some(o=>o.kind==='balloon' && o.tied) && !touch.length && v.y<0 && v.y>-2.5){ this.chute=(this.chute||0)+1; if (this.chute>60) F.add('parachute'); }
    const h=this.handoff; if (h && t-h.t>10 && t-h.t<16 && h.o.b.getLinearVelocity().length()>1 && sp<h.v*.7) F.add('handoff');
    if (this.ctype==='watch' && touch.length && Math.cos(c.getAngle())<-.5) this.wasDown=true;
    if (this.ctype==='watch' && this.wasDown && Math.cos(c.getAngle())>.9 && touch.length && sp<.5) F.add('rightend');
  }
  run(max=TMAX){ while (!this.done && this.t<max) this.step(); return this.result; }
}
// all ten tomorrows, headless
function runAll(B, parts){ const res=[], found=new Set(); for (let k=0;k<FUTURES;k++){ const s=new Sim(B,parts,k); s.run(); res.push(s.result); s.found.forEach(f=>found.add(f)); }
  const saved=res.filter(r=>r.ok).length; if (saved===FUTURES) found.add('tenfold');
  return {res, saved, found:[...found], gentle:score(res), cost:costOf(parts)}; }
// gentleness of a machine: the worst bump among the tomorrows it came through (lower is gentler)
function score(res){ const ok=res.filter(r=>r.ok); return ok.length? Math.max(...ok.map(r=>r.gentle)) : 999; }
const costOf=(ps)=>ps.reduce((s,p)=>s+PARTS[p[0]].cost,0);

// ---------- The book of braking (recognised from behaviour) ----------
const MECHS=[
 ['ramp','The gentle slope','◢','The cargo slid down a slope for most of a second instead of falling.','A slope turns a fall into a slide: the same height, spent slowly.'],
 ['switchback','Switchback','≷','The cargo changed direction twice on the way down.','Mountain roads zigzag for the same reason: every turn is a chance to lose speed.'],
 ['cushion','Spring cradle','≋','A cushion gave way under the cargo.','Hooke, 1678: as the stretch, so the force. A long stop is a soft stop.'],
 ['hammock','Hammock catch','◡','A hammock sagged as it caught the cargo.','A net does not stop you; it lengthens the stop. The same blow, spread over time.'],
 ['lever','Catch and lower','⚖','A seesaw caught the cargo and carried it down.','Archimedes\' lever, run backwards: let it sink instead of lifting it.'],
 ['counterweight','Counterweight','⚓','A weight on the far end rose while the cargo went down.','Lifts and drawbridges balance their load, so only the difference has to move.'],
 ['parachute','Parachute','☂','A balloon held the cargo to a slow, steady fall.','Garnerin, 1797, from a balloon over Paris: a steady fall is a safe fall.'],
 ['handoff','Handoff','●→■','The cargo ran into a loose part and gave it its speed.','Momentum is passed on, not lost: let something else carry the blow away.'],
 ['feather','Featherfall','❦','A delivery where the hardest bump was under a third of what the cargo can take.','A good porter is never in a hurry at the end.'],
 ['tenfold','Ten tomorrows','⁂','All ten tomorrows came through.','Engineers design for the weather they will get, not the weather they would like.'],
 ['rightend','Righted','↻','The watch turned face down, then came back face up.','A tumble can be undone if a second slope turns it again.'],
 ['freefall','Lesson: free fall','✗','An egg fell for over a second untouched, then cracked.','Speed builds by 10 m/s every second of falling. Catch it early.'],
 ['burst','Lesson: the bubble','✗','A bubble burst.','A bubble lives by being left alone: let the air do the work.'],
 ['facedown','Lesson: face down','✗','The watch came to rest face down.','A box tumbles over its edge when it is tipped past its corner.'],
 ['torn','Lesson: the tear','✗','The jelly was stretched until it tore.','Soft things survive blows and fail under pulling: tension, not impact.'],
];

const G={pl, BW, BH, DT, TMAX, FUTURES, CARGO, CARGO_ORDER, PARTS, PTYPES, BENCHES, MECHS, Sim, runAll, futureParams, rng, costOf, score};
if (typeof module!=='undefined' && module.exports) module.exports=G; else root.GM=G;
})(typeof self!=='undefined'? self : this);
