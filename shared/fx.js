// FX: shared "game feel" toolkit — procedural sound, easing/tweens, screen shake, glow particles.
// Classic script (no modules) so any page can use it: <script src="../shared/fx.js"></script>
const FX = (() => {
  // ---------- audio ----------
  let ac = null, master = null, muted = false;
  try { muted = localStorage.getItem('rh:muted') === '1'; } catch (e) {}
  const ctx = () => {
    if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = .5; master.connect(ac.destination); }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  // tone({f, f2, type, dur, vol, attack, noise, delay, pan})
  function tone(o) {
    if (muted) return;
    const a = ctx(), t = a.currentTime + (o.delay || 0), dur = o.dur ?? .15, vol = o.vol ?? .2;
    const g = a.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (o.attack ?? .005)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let src;
    if (o.noise) {
      const n = a.sampleRate * dur | 0, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      src = a.createBufferSource(); src.buffer = buf;
      const flt = a.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = o.f || 1200; flt.Q.value = o.q ?? 1.2; src.connect(flt); flt.connect(g);
    } else {
      src = a.createOscillator(); src.type = o.type || 'sine'; src.frequency.setValueAtTime(o.f || 440, t);
      if (o.f2) src.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
      src.connect(g);
    }
    let out = g;
    if (o.pan && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = o.pan; g.connect(p); out = p; }
    out.connect(master); src.start(t); src.stop(t + dur + .02);
  }
  const jitter = (x, j = .06) => x * (1 + (Math.random() * 2 - 1) * j); // pitch variance stops repetition fatigue
  const SFX = {
    click: () => tone({ f: jitter(1800), f2: 900, type: 'triangle', dur: .04, vol: .12 }),
    tick: () => tone({ f: jitter(2400), type: 'square', dur: .015, vol: .05 }),
    pop: () => tone({ f: jitter(520), f2: 1100, type: 'sine', dur: .09, vol: .2 }),
    place: () => { tone({ f: jitter(180), f2: 90, type: 'sine', dur: .12, vol: .25 }); tone({ noise: 1, f: 2500, dur: .05, vol: .06 }); },
    whoosh: () => tone({ noise: 1, f: 700, q: .6, dur: .35, vol: .12, attack: .12 }),
    coin: () => { tone({ f: 988, type: 'square', dur: .07, vol: .07 }); tone({ f: 1319, type: 'square', dur: .25, vol: .07, delay: .07 }); },
    fail: () => tone({ f: 220, f2: 110, type: 'sawtooth', dur: .25, vol: .08 }),
    boom: () => { tone({ f: 120, f2: 30, type: 'sine', dur: .5, vol: .4 }); tone({ noise: 1, f: 400, q: .4, dur: .45, vol: .2 }); },
    zap: () => tone({ f: jitter(1400), f2: 200, type: 'sawtooth', dur: .12, vol: .07 }),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ f, type: 'triangle', dur: .45, vol: .14, delay: i * .085 })),
    chime: (k = 0) => { const sc = [0, 2, 4, 7, 9, 12, 14, 16]; const f = 523.25 * Math.pow(2, sc[((k % 8) + 8) % 8] / 12); tone({ f, type: 'sine', dur: .6, vol: .12 }); tone({ f: f * 2, type: 'sine', dur: .3, vol: .04 }); },
  };
  const sfx = (name, ...a) => { try { (SFX[name] || SFX.click)(...a); } catch (e) {} };
  const setMuted = m => { muted = m; try { localStorage.setItem('rh:muted', m ? '1' : '0'); } catch (e) {} };

  // ---------- easing & tweens ----------
  const ease = {
    linear: t => t, inQuad: t => t * t, outQuad: t => 1 - (1 - t) * (1 - t), inOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    outCubic: t => 1 - Math.pow(1 - t, 3), inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: t => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI) / 3) + 1,
  };
  const tweens = new Set();
  // tween(obj, {x: 10}, 300, 'outBack') -> Promise
  function tween(obj, to, ms = 300, e = 'outCubic') {
    return new Promise(res => {
      const from = {}; for (const k in to) from[k] = obj[k];
      tweens.add({ obj, from, to, ms, e: typeof e === 'function' ? e : ease[e], t0: performance.now(), res });
    });
  }
  // damp: frame-rate independent smoothing toward a target (lambda ~ 8-20)
  const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

  // ---------- shake & hit-stop ----------
  const trauma = { v: 0 }; // 0..1, decays; shake offset = maxPx * trauma^2
  const shake = (amount = .4) => { trauma.v = Math.min(1, trauma.v + amount); };
  function shakeOffset(maxPx = 12, t = performance.now() / 1000) {
    const k = trauma.v * trauma.v;
    return [maxPx * k * (Math.sin(t * 61.3) * .6 + Math.sin(t * 97.1) * .4), maxPx * k * (Math.sin(t * 53.7 + 1) * .6 + Math.sin(t * 89.3) * .4), k * .03 * Math.sin(t * 43.1)];
  }
  let freezeUntil = 0;
  const hitstop = (ms = 60) => { freezeUntil = performance.now() + ms; };
  const frozen = () => performance.now() < freezeUntil;

  // ---------- 2D glow particles ----------
  // ps = FX.particles(); ps.burst(x, y, {n, color, speed, life, size, gravity}); ps.update(dt); ps.draw(ctx)
  function particles(max = 2000) {
    const P = [];
    return {
      list: P,
      burst(x, y, o = {}) {
        const n = o.n ?? 24;
        for (let i = 0; i < n && P.length < max; i++) {
          const a = (o.angle ?? Math.random() * Math.PI * 2) + (o.spread != null ? (Math.random() - .5) * o.spread : 0), sp = (o.speed ?? 180) * (.35 + Math.random() * .65);
          P.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (o.life ?? .8) * (.6 + Math.random() * .4), age: 0, size: (o.size ?? 3) * (.6 + Math.random() * .8), color: Array.isArray(o.color) ? o.color[Math.random() * o.color.length | 0] : (o.color || '#ffd27a'), g: o.gravity ?? 0, drag: o.drag ?? 2.5 });
        }
      },
      update(dt) {
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i]; p.age += dt; if (p.age >= p.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
          const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy = p.vy * d + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        }
      },
      draw(c) {
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const p of P) { const k = 1 - p.age / p.life; c.globalAlpha = k; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * (.4 + .6 * k), 0, 6.283); c.fill(); }
        c.restore();
      },
    };
  }

  // ---------- frame loop ----------
  function step(now) {
    for (const tw of tweens) {
      const k = Math.min(1, (now - tw.t0) / tw.ms), v = tw.e(k);
      for (const key in tw.to) tw.obj[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * v;
      if (k >= 1) { tweens.delete(tw); tw.res(); }
    }
    trauma.v = Math.max(0, trauma.v - .016 * 1.6);
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  // ---------- canvas helpers ----------
  // Size a canvas to its CSS box with a capped devicePixelRatio. Returns dpr.
  function fit(cv, maxDpr = 2) { const r = cv.getBoundingClientRect(), d = Math.min(maxDpr, devicePixelRatio || 1); const w = Math.max(1, r.width * d | 0), h = Math.max(1, r.height * d | 0); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return d; }
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  return { sfx, tone, setMuted, get muted() { return muted; }, ease, tween, damp, shake, shakeOffset, hitstop, frozen, particles, fit, lerp, clamp };
})();
