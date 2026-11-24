// NAND to Everything: circuit simulator, level data, CPU/assembler, save handling and input edge cases.
// Reference circuits for every level are built from parts the player has at that point, and checked against
// independent reference functions written here (not the game's own l.fn).

// "src.idx>dst.idx" wires; 'in' and 'out' are the level's pins.
const SOL = {
  NOT: [{ n: 'NAND' }, ['in.0>n.0', 'in.0>n.1', 'n.0>out.0']],
  AND: [{ n: 'NAND', i: 'NOT' }, ['in.0>n.0', 'in.1>n.1', 'n.0>i.0', 'i.0>out.0']],
  OR: [{ x: 'NOT', y: 'NOT', n: 'NAND' }, ['in.0>x.0', 'in.1>y.0', 'x.0>n.0', 'y.0>n.1', 'n.0>out.0']],
  NOR: [{ o: 'OR', i: 'NOT' }, ['in.0>o.0', 'in.1>o.1', 'o.0>i.0', 'i.0>out.0']],
  XOR: [{ n: 'NAND', p: 'NAND', q: 'NAND', r: 'NAND' }, ['in.0>n.0', 'in.1>n.1', 'in.0>p.0', 'n.0>p.1', 'in.1>q.0', 'n.0>q.1', 'p.0>r.0', 'q.0>r.1', 'r.0>out.0']],
  XNOR: [{ x: 'XOR', i: 'NOT' }, ['in.0>x.0', 'in.1>x.1', 'x.0>i.0', 'i.0>out.0']],
  MUX: [{ ns: 'NOT', x: 'AND', y: 'AND', o: 'OR' }, ['in.0>ns.0', 'in.1>x.0', 'ns.0>x.1', 'in.2>y.0', 'in.0>y.1', 'x.0>o.0', 'y.0>o.1', 'o.0>out.0']],
  DEMUX: [{ ns: 'NOT', x: 'AND', y: 'AND' }, ['in.0>ns.0', 'in.1>x.0', 'ns.0>x.1', 'in.1>y.0', 'in.0>y.1', 'x.0>out.0', 'y.0>out.1']],
  'HALF ADD': [{ x: 'XOR', a: 'AND' }, ['in.0>x.0', 'in.1>x.1', 'in.0>a.0', 'in.1>a.1', 'x.0>out.0', 'a.0>out.1']],
  'FULL ADD': [{ h1: 'HALF ADD', h2: 'HALF ADD', o: 'OR' }, ['in.0>h1.0', 'in.1>h1.1', 'h1.0>h2.0', 'in.2>h2.1', 'h2.0>out.0', 'h1.1>o.0', 'h2.1>o.1', 'o.0>out.1']],
  ADD4: [{ f0: 'FULL ADD', f1: 'FULL ADD', f2: 'FULL ADD', f3: 'FULL ADD' },
    [0, 1, 2, 3].flatMap(k => [`in.${k}>f${k}.0`, `in.${4 + k}>f${k}.1`, k ? `f${k - 1}.1>f${k}.2` : 'in.8>f0.2', `f${k}.0>out.${k}`]).concat(['f3.1>out.4'])],
  ADD8: [Object.assign({ sa: 'SPLIT', sb: 'SPLIT', j: 'JOIN' }, ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => ({ ['f' + k]: 'FULL ADD' }))),
    ['in.0>sa.0', 'in.1>sb.0', 'j.0>out.0', 'f7.1>out.1'].concat([0, 1, 2, 3, 4, 5, 6, 7].flatMap(k => [`sa.${k}>f${k}.0`, `sb.${k}>f${k}.1`, k ? `f${k - 1}.1>f${k}.2` : 'in.2>f0.2', `f${k}.0>j.${k}`]))],
  INC8: [{ ad: 'ADD8', h: 'HIGH' }, ['in.0>ad.0', 'h.0>ad.2', 'ad.0>out.0']],
  SUB8: [{ nb: 'NOT8', ad: 'ADD8', h: 'HIGH' }, ['in.1>nb.0', 'in.0>ad.0', 'nb.0>ad.1', 'h.0>ad.2', 'ad.0>out.0']],
  ZERO8: [Object.assign({ sp: 'SPLIT', n: 'NOT' }, ...[1, 2, 3, 4, 5, 6, 7].map(k => ({ ['o' + k]: 'OR' }))),
    ['in.0>sp.0', 'sp.0>o1.0', 'sp.1>o1.1'].concat([2, 3, 4, 5, 6, 7].flatMap(k => [`o${k - 1}.0>o${k}.0`, `sp.${k}>o${k}.1`]), ['o7.0>n.0', 'n.0>out.0'])],
  ALU: [{ ad: 'ADD8', sb: 'SUB8', an: 'AND8', or: 'OR8', m1: 'MUX8', m2: 'MUX8', m3: 'MUX8', z: 'ZERO8' },
    ['in.2>ad.0', 'in.3>ad.1', 'in.2>sb.0', 'in.3>sb.1', 'in.2>an.0', 'in.3>an.1', 'in.2>or.0', 'in.3>or.1',
      'in.1>m1.0', 'ad.0>m1.1', 'sb.0>m1.2', 'in.1>m2.0', 'an.0>m2.1', 'or.0>m2.2', 'in.0>m3.0', 'm1.0>m3.1', 'm2.0>m3.2', 'm3.0>z.0', 'm3.0>out.0', 'z.0>out.1']],
  'SR LATCH': [{ ns: 'NOT', nr: 'NOT', q: 'NAND', nq: 'NAND' }, ['in.0>ns.0', 'in.1>nr.0', 'ns.0>q.0', 'nq.0>q.1', 'nr.0>nq.0', 'q.0>nq.1', 'q.0>out.0', 'nq.0>out.1']],
  'D LATCH': [{ s: 'NAND', r: 'NAND', q: 'NAND', nq: 'NAND' }, ['in.0>s.0', 'in.1>s.1', 's.0>r.0', 'in.1>r.1', 's.0>q.0', 'nq.0>q.1', 'r.0>nq.0', 'q.0>nq.1', 'q.0>out.0']],
  DFF: [{ nc: 'NOT', m: 'D LATCH', sl: 'D LATCH' }, ['in.1>nc.0', 'in.0>m.0', 'nc.0>m.1', 'm.0>sl.0', 'in.1>sl.1', 'sl.0>out.0']],
  REG: [{ mx: 'MUX', ff: 'DFF' }, ['in.1>mx.0', 'ff.0>mx.1', 'in.0>mx.2', 'mx.0>ff.0', 'in.2>ff.1', 'ff.0>out.0']],
  DEC2: [{ n1: 'NOT', n0: 'NOT', a0: 'AND', a1: 'AND', a2: 'AND', a3: 'AND' },
    ['in.0>n1.0', 'in.1>n0.0', 'n1.0>a0.0', 'n0.0>a0.1', 'n1.0>a1.0', 'in.1>a1.1', 'in.0>a2.0', 'n0.0>a2.1', 'in.0>a3.0', 'in.1>a3.1', 'a0.0>out.0', 'a1.0>out.1', 'a2.0>out.2', 'a3.0>out.3']],
  COUNTER: [{ r: 'REG8', inc: 'INC8', mx: 'MUX8', h: 'HIGH' }, ['mx.0>r.0', 'h.0>r.1', 'in.2>r.2', 'r.0>inc.0', 'in.0>mx.0', 'inc.0>mx.1', 'in.1>mx.2', 'r.0>out.0']],
  RAM4: [{ dec: 'DEC2', g0: 'AND', g1: 'AND', g2: 'AND', g3: 'AND', r0: 'REG8', r1: 'REG8', r2: 'REG8', r3: 'REG8', m0: 'MUX8', m1: 'MUX8', m: 'MUX8' },
    ['in.0>dec.0', 'in.1>dec.1'].concat([0, 1, 2, 3].flatMap(k => [`dec.${k}>g${k}.0`, `in.2>g${k}.1`, `in.3>r${k}.0`, `g${k}.0>r${k}.1`, `in.4>r${k}.2`]),
      ['in.1>m0.0', 'r0.0>m0.1', 'r1.0>m0.2', 'in.1>m1.0', 'r2.0>m1.1', 'r3.0>m1.2', 'in.0>m.0', 'm0.0>m.1', 'm1.0>m.2', 'm.0>out.0'])],
  COND: [{ sp: 'SPLIT', z: 'ZERO8', pos: 'NOR', a1: 'AND', a2: 'AND', a3: 'AND', o1: 'OR', o2: 'OR' },
    ['in.3>sp.0', 'in.3>z.0', 'sp.7>pos.0', 'z.0>pos.1', 'in.0>a1.0', 'sp.7>a1.1', 'in.1>a2.0', 'z.0>a2.1', 'in.2>a3.0', 'pos.0>a3.1', 'a1.0>o1.0', 'a2.0>o1.1', 'o1.0>o2.0', 'a3.0>o2.1', 'o2.0>out.0']],
  PC: [{ r: 'REG8', inc: 'INC8', m1: 'MUX8', m2: 'MUX8', h: 'HIGH' }, ['m2.0>r.0', 'h.0>r.1', 'in.3>r.2', 'r.0>inc.0', 'in.1>m1.0', 'inc.0>m1.1', 'in.2>m1.2', 'in.0>m2.0', 'm1.0>m2.1', 'r.0>out.0']],
};

// Independent reference behaviour for every level (state object per run).
const REF_SRC = `({
  NOT:([a])=>[1-a], AND:([a,b])=>[a&b], OR:([a,b])=>[a|b], NOR:([a,b])=>[1-(a|b)], XOR:([a,b])=>[a^b], XNOR:([a,b])=>[1-(a^b)],
  MUX:([s,a,b])=>[s?b:a], DEMUX:([s,d])=>[s?0:d,s?d:0], 'HALF ADD':([a,b])=>[(a+b)%2,(a+b)>>1], 'FULL ADD':([a,b,c])=>[(a+b+c)%2,(a+b+c)>>1],
  ADD4:(v)=>{ let A=0,B=0; for(let i=0;i<4;i++){A+=v[i]<<i;B+=v[4+i]<<i;} const t=A+B+v[8]; return [0,1,2,3,4].map(i=>(t>>i)&1); },
  ADD8:([a,b,c])=>[(a+b+c)%256, (a+b+c)>=256?1:0], INC8:([a])=>[(a+1)%256], SUB8:([a,b])=>[((a-b)%256+256)%256], ZERO8:([a])=>[a===0?1:0],
  ALU:([o1,o0,a,b])=>{ const r=[(a+b)%256,((a-b)%256+256)%256,a&b,a|b][o1*2+o0]; return [r, r===0?1:0]; },
  'SR LATCH':([s,r],st)=>{ st.q??=0; if(s) st.q=1; else if(r) st.q=0; return [st.q,1-st.q]; },
  'D LATCH':([d,e],st)=>{ st.q??=0; if(e) st.q=d; return [st.q]; },
  DFF:([d,c],st)=>{ st.q??=0; if(c&&!st.c) st.q=d; st.c=c; return [st.q]; },
  REG:([d,l,c],st)=>{ st.q??=0; if(c&&!st.c&&l) st.q=d; st.c=c; return [st.q]; },
  DEC2:([a,b])=>[0,1,2,3].map(i=>i===a*2+b?1:0),
  COUNTER:([l,d,c],st)=>{ st.q??=0; if(c&&!st.c) st.q = l? d : (st.q+1)%256; st.c=c; return [st.q]; },
  RAM4:([a1,a0,w,d,c],st)=>{ st.m??=[0,0,0,0]; if(c&&!st.c&&w) st.m[a1*2+a0]=d; st.c=c; return [st.m[a1*2+a0]]; },
  COND:([lt,eq,gt,x])=>{ const s=x>=128?x-256:x; return [(lt&&s<0)||(eq&&s===0)||(gt&&s>0)?1:0]; },
  PC:([r,j,a,c],st)=>{ st.q??=0; if(c&&!st.c) st.q = r?0 : j?a : (st.q+1)%256; st.c=c; return [st.q]; },
})`;

const BUILD_SRC = `(spec)=>{ const [cs, ws]=spec; const ids={}; let id=1; const comps=[]; let y=0;
  for (const [n,t] of Object.entries(cs)){ ids[n]=id; comps.push({id:id++, type:t, x:200+(id%4)*120, y:(y+=60)}); }
  const ref=(s)=>{ const [a,b]=s.split('.'); return [a==='in'||a==='out'? a : ids[a], +b]; };
  return {comps, wires: ws.map(w=>{ const [f,t]=w.split('>'); return {from:ref(f), to:ref(t)}; })}; }`;

const PROGS = {
  sum: 'in a\nin b\nadd a, b\nout a\nhlt',
  max: 'in a\nmov c, 4\nloop: in b\njlt b, a, skip\nmov a, b\nskip: dec c\njnz c, loop\nout a\nhlt',
  mul: 'in a\nin b\nmov c, 0\nloop: jz b, done\nadd c, a\ndec b\njmp loop\ndone: out c\nhlt',
  fib: 'mov a, 1\nmov b, 1\nmov d, 13\nloop: out a\nmov c, a\nadd c, b\nmov a, b\nmov b, c\ndec d\njnz d, loop\nhlt',
  div: 'in a\nin b\nmov c, 0\nloop: jlt a, b, done\nsub a, b\ninc c\njmp loop\ndone: out c\nout a\nhlt',
  collatz: 'in a\nloop: out a\nmov b, a\nsub b, 1\njz b, end\nmov c, a\nand c, 1\njz c, even\nmov b, a\nadd a, a\nadd a, b\ninc a\njmp loop\neven: mov b, 0\nhalf: jz a, hd\nsub a, 2\ninc b\njmp half\nhd: mov a, b\njmp loop\nend: hlt',
  sort: 'in a\nst [0], a\nin a\nst [1], a\nin a\nst [2], a\nin a\nst [3], a\nmov d, 3\npass: mov c, 0\ninner: ld a, [c]\nmov b, c\ninc b\nld b, [b]\njlt b, a, swap\njmp nos\nswap: st [c], b\nmov b, c\ninc b\nst [b], a\nnos: inc c\nmov b, c\nsub b, 3\njnz b, inner\ndec d\njnz d, pass\nld a, [0]\nout a\nld a, [1]\nout a\nld a, [2]\nout a\nld a, [3]\nout a\nhlt',
  primes: 'mov a, 2\nouter: ld b, [a]\njnz b, next\nout a\nmov c, a\nadd c, a\nmark: jlt c, 60, domark\njmp next\ndomark: mov d, 1\nst [c], d\nadd c, a\njmp mark\nnext: inc a\njlt a, 60, outer\nhlt',
  smile: [60, 66, 165, 129, 165, 153, 66, 60].map((v, i) => `mov a, ${v}\nst [${56 + i}], a`).join('\n') + '\nhlt',
};

// Solve every hardware level in order (unlocking parts as a player would). Returns per-level info.
async function solveAll(page, upTo) {
  return page.evaluate(async ({ SOL, BUILD_SRC, upTo }) => {
    const N = window.__nand, build = eval(BUILD_SRC), out = [];
    for (let i = 0; i < N.L.length && (upTo == null || i <= upTo); i++) {
      const l = N.L[i]; if (!N.unlocked(i)) { out.push({ id: l.id, err: 'locked' }); break; }
      N.showCircuit(i);
      const pal = N.paletteFor(i);
      const need = [...new Set(Object.values(SOL[l.id][0]))].filter(t => !pal.includes(t));
      if (need.length) { out.push({ id: l.id, err: 'parts not in palette: ' + need }); break; }
      N.circ = { comps: [], wires: [] }; N.runTests();
      const emptyPasses = N.SAVE.best[l.id] != null;
      N.circ = build(SOL[l.id]); N.runTests();
      out.push({ id: l.id, solved: N.SAVE.best[l.id] != null, emptyPasses, gates: N.SAVE.best[l.id], par: l.par, res: document.getElementById('result').textContent.slice(0, 160) });
      if (N.SAVE.best[l.id] == null) break;
    }
    return out;
  }, { SOL, BUILD_SRC, upTo });
}
// The harness clears localStorage on every navigation of the test page, so "reload" opens a second page in the same context.
async function reopen(page) { const p2 = await page.context().newPage(); const errs = []; p2.on('pageerror', e => errs.push(e.message)); await p2.goto(page.url()); await p2.waitForTimeout(200); p2.errs = errs; return p2; }
const dismissModals = (page) => page.evaluate(() => document.querySelectorAll('.modal-bg').forEach(m => m.remove()));

module.exports = {
  page: 'nand/index.html',
  tests: {
    'level data: 25 circuit + 9 software levels, unique ids, solutions exist for each': async ({ page, eq, ok }) => {
      const d = await page.evaluate(() => ({ n: __nand.L.length, sw: __nand.SW.length, ids: __nand.L.map(l => l.id) }));
      eq(d.n, 25); eq(d.sw, 9); eq(new Set(d.ids).size, d.ids.length, 'unique ids');
      for (const id of d.ids) ok(SOL[id], 'test has reference solution for ' + id);
    },
    'combinational test vectors: exhaustive when ≤10 input bits, and l.fn matches an independent reference': async ({ page, eq, ok }) => {
      const r = await page.evaluate((REF_SRC) => {
        const REF = eval(REF_SRC), bad = [], counts = {};
        for (const l of __nand.L) { if (l.seq) continue; const T = __nand.genTests(l); counts[l.id] = T.length;
          const bits = l.ins.reduce((s, p) => s + p[1], 0);
          if (bits <= 10) { const keys = new Set(T.map(t => t.inp.join(','))); if (keys.size !== 1 << bits) bad.push(l.id + ' not exhaustive'); }
          for (const t of T) { const a = l.fn(t.inp, {}), b = REF[l.id](t.inp, {}); if (a.join() !== b.join()) { bad.push(l.id + ' ' + t.inp + ' ' + a + ' vs ' + b); break; } } }
        return { bad, counts };
      }, REF_SRC);
      eq(r.bad, []); eq(r.counts.NOT, 2); eq(r.counts.ADD4, 512); eq(r.counts.ZERO8, 256); ok(r.counts.ALU >= 70);
    },
    'sequential test vectors: l.fn matches independent reference over the generated sequence': async ({ page, eq }) => {
      const bad = await page.evaluate((REF_SRC) => {
        const REF = eval(REF_SRC), bad = [];
        for (const l of __nand.L) { if (!l.seq) continue; const T = __nand.genTests(l); const s1 = {}, s2 = {};
          for (const t of T) { const a = l.fn(t.inp, s1), b = REF[l.id](t.inp, s2); if (a.join() !== b.join()) { bad.push(l.id + ' @' + t.inp); break; } } }
        return bad;
      }, REF_SRC);
      eq(bad, []);
    },
    'every level: empty circuit fails, reference circuit passes; progress and stars update': async ({ page, eq, ok }) => {
      const res = await solveAll(page);
      await dismissModals(page);
      for (const r of res) { ok(!r.err, r.id + ': ' + r.err); ok(!r.emptyPasses, r.id + ' solved by empty circuit'); ok(r.solved, r.id + ' reference failed: ' + r.res); }
      eq(res.length, 25);
      const st = await page.evaluate(() => ({ prog: JSON.parse(localStorage.getItem('rh:hub')).nand, soft: __nand.softUnlocked(), total: document.getElementById('total').textContent }));
      eq(st.prog, 25 / 34); ok(st.soft, 'software unlocked after PC'); eq(st.total, '25 / 34 solved');
    },
    'reference circuits also agree with the independent reference on extra random vectors': async ({ page, eq }) => {
      await solveAll(page); await dismissModals(page);
      const bad = await page.evaluate(({ SOL, BUILD_SRC, REF_SRC }) => {
        const N = __nand, build = eval(BUILD_SRC), REF = eval(REF_SRC), bad = []; let seed = 7; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 16) % n; };
        for (let i = 0; i < N.L.length; i++) { const l = N.L[i]; if (l.seq) continue; N.showCircuit(i); N.circ = build(SOL[l.id]); N.reset();
          for (let k = 0; k < 200; k++) { const inp = l.ins.map(p => rnd(p[1] === 1 ? 2 : 256)); N.setInputs(inp); N.settle(); const g = N.outputs(), e = REF[l.id](inp, {}); if (g.join() !== e.join()) { bad.push(l.id + ' ' + inp); break; } } }
        return bad;
      }, { SOL, BUILD_SRC, REF_SRC });
      eq(bad, []);
    },
    'DFF level: a plain D latch (level-sensitive) no longer passes': async ({ page, ok }) => {
      await solveAll(page, 17); // through D LATCH
      const r = await page.evaluate(() => { const N = __nand; N.showCircuit(18);
        N.circ = { comps: [{ id: 1, type: 'D LATCH', x: 300, y: 100 }], wires: [{ from: ['in', 0], to: [1, 0] }, { from: ['in', 1], to: [1, 1] }, { from: [1, 0], to: ['out', 0] }] };
        N.runTests(); return { best: N.SAVE.best.DFF, msg: document.getElementById('result').textContent }; });
      ok(r.best == null, 'latch passed DFF: ' + r.msg);
    },
    'REG level: a D latch with a MUX (no edge) fails too': async ({ page, ok }) => {
      await solveAll(page, 18);
      const r = await page.evaluate(() => { const N = __nand; N.showCircuit(19);
        N.circ = { comps: [{ id: 1, type: 'MUX', x: 200, y: 100 }, { id: 2, type: 'D LATCH', x: 400, y: 100 }],
          wires: [{ from: ['in', 1], to: [1, 0] }, { from: [2, 0], to: [1, 1] }, { from: ['in', 0], to: [1, 2] }, { from: [1, 0], to: [2, 0] }, { from: ['in', 2], to: [2, 1] }, { from: [2, 0], to: ['out', 0] }] };
        N.runTests(); return N.SAVE.best.REG; });
      ok(r == null, 'level-sensitive REG passed');
    },
    'wrong circuits fail: OR built as AND, full adder without carry, output unwired': async ({ page, ok }) => {
      await solveAll(page, 9);
      const r = await page.evaluate(() => { const N = __nand; const out = []; const msg = () => document.getElementById('result').textContent;
        N.showCircuit(2); N.circ = { comps: [{ id: 1, type: 'AND', x: 300, y: 100 }], wires: [{ from: ['in', 0], to: [1, 0] }, { from: ['in', 1], to: [1, 1] }, { from: [1, 0], to: ['out', 0] }] }; N.runTests(); out.push(msg());
        N.showCircuit(9); N.circ = { comps: [{ id: 1, type: 'XOR', x: 300, y: 100 }, { id: 2, type: 'XOR', x: 450, y: 100 }], wires: [{ from: ['in', 0], to: [1, 0] }, { from: ['in', 1], to: [1, 1] }, { from: [1, 0], to: [2, 0] }, { from: ['in', 2], to: [2, 1] }, { from: [2, 0], to: ['out', 0] }] }; N.runTests(); out.push(msg());
        N.showCircuit(4); N.circ = { comps: [{ id: 1, type: 'NAND', x: 300, y: 100 }], wires: [{ from: ['in', 0], to: [1, 0] }, { from: ['in', 1], to: [1, 1] }] }; N.runTests(); out.push(msg());
        return out; });
      for (const m of r) ok(/Failed on test/.test(m), m);
    },
    'oscillating loop is detected and reported, and never passes': async ({ page, ok }) => {
      const r = await page.evaluate(() => { const N = __nand; N.showCircuit(0);
        N.circ = { comps: [{ id: 1, type: 'NAND', x: 300, y: 100 }], wires: [{ from: [1, 0], to: [1, 0] }, { from: [1, 0], to: [1, 1] }, { from: [1, 0], to: ['out', 0] }] };
        N.reset(); N.settle(); const u = N.unstable; N.runTests(); return { u, best: N.SAVE.best.NOT, msg: document.getElementById('result').textContent }; });
      ok(r.u, 'unstable flag'); ok(r.best == null); ok(/oscillat/.test(r.msg), r.msg);
    },
    'unconnected inputs read 0 (NAND with nothing wired outputs 1)': async ({ page, eq }) => {
      const v = await page.evaluate(() => { const N = __nand; N.showCircuit(0); N.circ = { comps: [{ id: 1, type: 'NAND', x: 300, y: 100 }], wires: [{ from: [1, 0], to: ['out', 0] }] }; N.reset(); N.setInputs([0]); N.settle(); return N.outputs(); });
      eq(v, [1]);
    },
    'locked levels cannot be opened by clicking': async ({ page, eq }) => {
      await dismissModals(page); await page.click('#levels [data-i="5"]'); eq(await page.evaluate(() => __nand.SAVE.cur), 0);
      await page.click('#levels [data-s="0"]'); eq(await page.evaluate(() => __nand.softOn), false);
    },
    'palette never offers the chip being built (or its 8-bit twin)': async ({ page, eq }) => {
      await solveAll(page); await dismissModals(page);
      const bad = await page.evaluate(() => __nand.L.flatMap((l, i) => __nand.paletteFor(i).filter(p => p === l.id || ({ NOT: 'NOT8', AND: 'AND8', OR: 'OR8', XOR: 'XOR8', MUX: 'MUX8', REG: 'REG8' })[l.id] === p || __nand.L.findIndex(x => x.id === p) > i).map(p => l.id + ':' + p)));
      eq(bad, []);
    },
    'assembler: errors for bad input, no crash on prototype-named labels, whitespace tolerant': async ({ page, eq, ok }) => {
      const r = await page.evaluate(() => { const A = __nand.assemble; return {
        proto: A('jmp constructor\nhlt').errs.length, proto2: A('jz a, __proto__').errs.length, tostr: A('jmp toString').errs.length,
        tab: A('mov\ta,\t5\nout a').errs, spaced: A('ld a, [ b ]\nst [ 3 ], a').errs, dup: A('x: hlt\nx: hlt').errs.length,
        unknown: A('foo a').errs.length, argc: A('add a').errs.length, num: A('mov a, 0x1f').errs, badreg: A('mov e, 1').errs.length,
        empty: A('').errs.length, comment: A('; hi\n# also\nhlt ; done').prog.length }; });
      ok(r.proto > 0 && r.proto2 > 0 && r.tostr > 0, 'prototype labels rejected'); eq(r.tab, []); eq(r.spaced, []); ok(r.dup > 0);
      ok(r.unknown && r.argc && r.badreg); eq(r.num, []); eq(r.empty, 0); eq(r.comment, 1);
    },
    'CPU: instruction semantics, wraparound, memory masking, read-past-input error': async ({ page, eq }) => {
      const r = await page.evaluate(() => { const N = __nand; const run = (src, inp = []) => { const a = N.assemble(src); if (a.errs.length) return a.errs; const c = N.newCpu(a, inp); while (!c.halted && c.cycles < 5000) N.stepCpu(c); return { r: c.r, out: c.out, err: c.err, mem: c.mem, cyc: c.cycles }; };
        return { wrap: run('mov a, 250\nadd a, 10\nmov b, 3\nsub b, 5\nout a\nout b\nhlt').out, dec0: run('dec a\nout a').out, big: run('mov a, 300\nout a').out,
          mem: run('mov a, 7\nst [70], a\nld b, [6]\nout b').out, andor: run('mov a, 12\nand a, 10\nmov b, 12\nor b, 3\nout a\nout b').out,
          jlt: run('mov a, 200\njlt a, 5, x\nout 1\nhlt\nx: out 2').out, inErr: run('in a\nin b', [4]).err, fall: run('mov a, 1').cyc }; });
      eq(r.wrap, [4, 254]); eq(r.dec0, [255]); eq(r.big, [44]); eq(r.mem, [7]); eq(r.andor, [8, 15]); eq(r.jlt, [1]); eq(r.inErr, 'read past the end of the input'); eq(r.fall, 1);
    },
    'every software level is solvable, earns stars, and progress reaches 1': async ({ page, eq, ok }) => {
      await solveAll(page); await dismissModals(page);
      for (const [id, src] of Object.entries(PROGS)) {
        await page.evaluate(([id, src]) => { const i = __nand.SW.findIndex(s => s.id === id); __nand.showSoft(i); const c = document.getElementById('code'); c.value = src; c.dispatchEvent(new Event('input')); }, [id, src]);
        await page.click('#runBtn'); await dismissModals(page);
        const msg = await page.textContent('#softResult'); ok(/All 12 tests passed/.test(msg), id + ': ' + msg);
      }
      const st = await page.evaluate(() => ({ p: JSON.parse(localStorage.getItem('rh:hub')).nand, n: Object.keys(__nand.SAVE.soft).length }));
      eq(st.n, 9); eq(st.p, 1);
    },
    'software: wrong programs fail (hard-coded answer, never halts, smile with wrong pixel)': async ({ page, ok }) => {
      await solveAll(page); await dismissModals(page);
      for (const [id, src] of [['sum', 'out 5\nhlt'], ['max', 'loop: jmp loop'], ['smile', PROGS.smile.replace('mov a, 165', 'mov a, 164')], ['smile', 'in a\n' + PROGS.smile]]) {
        await page.evaluate(([id, src]) => { __nand.showSoft(__nand.SW.findIndex(s => s.id === id)); const c = document.getElementById('code'); c.value = src; c.dispatchEvent(new Event('input')); }, [id, src]);
        await page.click('#runBtn'); const msg = await page.textContent('#softResult'); ok(/failed/.test(msg), id + ' should fail: ' + msg);
      }
      ok(await page.evaluate(() => !__nand.SAVE.soft.sum && !__nand.SAVE.soft.smile));
    },
    'software Step / Run once buttons work and report halts': async ({ page, ok }) => {
      await solveAll(page); await dismissModals(page);
      await page.evaluate(() => { __nand.showSoft(0); const c = document.getElementById('code'); c.value = 'in a\nin b\nadd a, b\nout a\nhlt'; c.dispatchEvent(new Event('input')); });
      for (let i = 0; i < 5; i++) await page.click('#stepBtn');
      ok(/Halted after 5 cycles/.test(await page.textContent('#softResult')));
      await page.click('#playBtn'); ok(/Halted/.test(await page.textContent('#softResult')));
      ok((await page.textContent('#outT')).trim() !== '—');
    },
    'mouse: add a NAND, wire it as NOT, and pass level 1 through the UI': async ({ page, eq, ok }) => {
      await dismissModals(page);
      await page.click('#palette button:text-is("NAND")');
      const pts = await page.evaluate(() => { const N = __nand, v = N.view, r = document.getElementById('cv').getBoundingClientRect(); const c = N.circ.comps[0];
        const s = (p) => [r.left + p.x * v.z + v.x, r.top + p.y * v.z + v.y];
        return { pin: s(N.portPos(['in', 0], 'out')), a: s(N.portPos([c.id, 0], 'in')), b: s(N.portPos([c.id, 1], 'in')), o: s(N.portPos([c.id, 0], 'out')), out: s(N.portPos(['out', 0], 'in')) }; });
      const wire = async (p, q) => { await page.mouse.move(...p); await page.mouse.down(); await page.mouse.move((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, { steps: 4 }); await page.mouse.move(...q, { steps: 4 }); await page.mouse.up(); };
      await wire(pts.pin, pts.a); await wire(pts.pin, pts.b); await wire(pts.o, pts.out);
      eq(await page.evaluate(() => __nand.circ.wires.length), 3);
      await page.click('#testBtn'); ok(/All 2 tests passed/.test(await page.textContent('#result')));
      ok(await page.isVisible('#nextBtn'), 'next button shown'); await page.click('#nextBtn'); eq(await page.evaluate(() => __nand.SAVE.cur), 1);
    },
    'Backspace typed in the bus-value box does not delete the selected wire': async ({ page, eq }) => {
      await solveAll(page, 11); await dismissModals(page);
      await page.evaluate(({ SOL, BUILD_SRC }) => { __nand.showCircuit(12); __nand.circ = eval(BUILD_SRC)(SOL.INC8); __nand.selWire = 0; }, { SOL, BUILD_SRC });
      const p = await page.evaluate(() => { const N = __nand, v = N.view, r = document.getElementById('cv').getBoundingClientRect(); return [r.left + (-20) * v.z + v.x, r.top + N.pinY(0, 1) * v.z + v.y]; });
      await page.mouse.click(...p); await page.waitForSelector('#busVal');
      await page.keyboard.press('Backspace'); await page.keyboard.type('77'); await page.keyboard.press('Enter');
      eq(await page.evaluate(() => __nand.circ.wires.length), 3);
    },
    'selected wire does not carry over to another level (Delete on new level deletes nothing)': async ({ page, eq }) => {
      await solveAll(page, 2); await dismissModals(page);
      const n = await page.evaluate(({ SOL, BUILD_SRC }) => { const N = __nand; N.showCircuit(1); N.circ = eval(BUILD_SRC)(SOL.AND); N.selWire = 3; N.showCircuit(2); N.circ = eval(BUILD_SRC)(SOL.OR); return N.circ.wires.length; }, { SOL, BUILD_SRC });
      await page.keyboard.press('Delete');
      eq(await page.evaluate(() => __nand.circ.wires.length), n);
    },
    'click a part to select it, then the Delete button removes it with its wires': async ({ page, eq, ok }) => {
      await dismissModals(page);
      await page.evaluate(({ SOL, BUILD_SRC }) => { __nand.circ = eval(BUILD_SRC)(SOL.NOT); }, { SOL, BUILD_SRC });
      const p = await page.evaluate(() => { const N = __nand, v = N.view, r = document.getElementById('cv').getBoundingClientRect(), c = N.circ.comps[0], s = N.compSize(c); return [r.left + (c.x + s.w / 2) * v.z + v.x, r.top + (c.y + s.h / 2) * v.z + v.y]; });
      await page.mouse.click(...p); ok(await page.isVisible('#delBtn'));
      await page.click('#delBtn'); eq(await page.evaluate(() => [__nand.circ.comps.length, __nand.circ.wires.length]), [0, 0]);
    },
    'corrupted / odd saves load without errors': async ({ page, eq }) => {
      for (const raw of ['null', '"x"', '42', '[]', '{"cur":999,"best":null}', '{"cur":"a","best":{"NOT":"x","ZZZ":3}}', '{"cur":3,"best":{"NOT":1,"AND":2,"OR":3},"circuits":{"NOR":{"comps":[{"id":1,"type":"BOGUS","x":0,"y":0}],"wires":[{"from":[1,0],"to":["out",0]},{"from":["in",9],"to":["out",0]}]}}}']) {
        await page.evaluate((raw) => localStorage.setItem('rh:nand', raw), raw);
        const p2 = await reopen(page), errs = p2.errs;
        const st = await p2.evaluate(() => ({ cur: __nand.SAVE.cur, w: __nand.circ.wires.length, c: __nand.circ.comps.length }));
        eq(errs, [], raw); eq(Number.isInteger(st.cur), true);
        if (raw.includes('BOGUS')) eq([st.cur, st.c, st.w], [3, 0, 0]);
        await p2.close();
      }
    },
    'save/load round-trip: circuit and best survive a reload': async ({ page, eq }) => {
      await solveAll(page, 2); const p2 = await reopen(page);
      const r = await p2.evaluate(() => ({ best: __nand.SAVE.best, cur: __nand.SAVE.cur, n: __nand.circ.comps.length }));
      eq(r.best, { NOT: 1, AND: 2, OR: 3 }); eq(r.cur, 2); eq(r.n, 3);
    },
    'phone layout: no horizontal scroll and the canvas is usable': async ({ page, ok }) => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(100);
      const r = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, cv: document.getElementById('cv').getBoundingClientRect() }));
      ok(r.sw <= 390, 'scrollWidth ' + r.sw); ok(r.cv.width >= 350 && r.cv.height >= 300, JSON.stringify(r.cv));
    },
  },
};
