// PanZoom: one camera for every 2-D play surface: wheel / pinch zoom, two-finger or empty-space drag pan, Fit button.
// Classic script: <script src="../shared/panzoom.js"></script>
//
//   const cam = PanZoom(el, {
//     world: () => ({x, y, w, h}),          // content bounds in world units (used by fit and clamping)
//     onChange: cam => redraw(),             // called after every change
//     canPanFrom: e => !hitSomething(e),     // optional: one-finger/mouse drag pans only when this is true (default: never; two fingers always pan)
//     min: .25, max: 12, pad: 16,            // zoom limits (relative to fit) and fit padding in CSS px
//     button: true,                          // inject a small ⤢ Fit button and + / − into el's parent (styled per page via .pz-*)
//   });
//   Canvas 2-D:  ctx.setTransform(dpr*cam.k, 0, 0, dpr*cam.k, dpr*cam.x, dpr*cam.y)   then draw in world units
//   Pointer:     const [wx, wy] = cam.toWorld(e.clientX, e.clientY)
//   DOM/SVG:     el.firstElementChild.style.transform = cam.css()    (transform-origin: 0 0)
//   cam.fit(animate?) · cam.zoomAt(clientX, clientY, factor) · cam.panBy(dx, dy) · cam.frame({x,y,w,h}) · cam.state / cam.state = {x,y,k}
//   cam.gesturing is true while two fingers are down or a pan drag is in progress, so games can ignore those pointers.
const PanZoom = (el, o = {}) => {
  const min = o.min ?? .25, max = o.max ?? 12, pad = o.pad ?? 16;
  const cam = { x: 0, y: 0, k: 1, base: 1, gesturing: false, touched: false }; // touched: the player has moved the view, so resizes keep it
  const rect = () => el.getBoundingClientRect();
  const changed = () => { o.onChange && o.onChange(cam); };
  const clampK = k => Math.max(cam.base * min, Math.min(cam.base * max, k));
  cam.toWorld = (cx, cy) => { const r = rect(); return [(cx - r.left - cam.x) / cam.k, (cy - r.top - cam.y) / cam.k]; };
  cam.toScreen = (wx, wy) => { const r = rect(); return [wx * cam.k + cam.x + r.left, wy * cam.k + cam.y + r.top]; };
  cam.css = () => `translate(${cam.x}px,${cam.y}px) scale(${cam.k})`;
  let anim = 0;
  const go = (t, ms) => {
    cancelAnimationFrame(anim);
    if (!ms || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) { Object.assign(cam, t); changed(); return; }
    const f = { x: cam.x, y: cam.y, k: cam.k }, t0 = performance.now();
    const step = now => { const u = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - u, 3);
      cam.x = f.x + (t.x - f.x) * e; cam.y = f.y + (t.y - f.y) * e; cam.k = f.k + (t.k - f.k) * e; changed(); if (u < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
  };
  cam.frame = (b, ms = 0) => { const r = rect(), k = Math.min((r.width - 2 * pad) / Math.max(1e-6, b.w), (r.height - 2 * pad) / Math.max(1e-6, b.h));
    go({ k, x: r.width / 2 - (b.x + b.w / 2) * k, y: r.height / 2 - (b.y + b.h / 2) * k }, ms); };
  cam.fit = (animate) => { if (!o.world) return; const b = o.world(); const r = rect();
    cam.touched = false; cam.base = Math.min((r.width - 2 * pad) / Math.max(1e-6, b.w), (r.height - 2 * pad) / Math.max(1e-6, b.h)); cam.frame(b, animate ? 280 : 0); };
  cam.zoomAt = (cx, cy, f) => { const r = rect(), px = cx - r.left, py = cy - r.top, k = clampK(cam.k * f), s = k / cam.k;
    cam.x = px - (px - cam.x) * s; cam.y = py - (py - cam.y) * s; cam.k = k; cam.touched = true; changed(); };
  cam.panBy = (dx, dy) => { cam.x += dx; cam.y += dy; cam.touched = true; changed(); };
  Object.defineProperty(cam, 'state', { get: () => ({ x: cam.x, y: cam.y, k: cam.k }), set: s => { Object.assign(cam, s); changed(); } });

  el.style.touchAction = 'none';
  el.addEventListener('wheel', e => { e.preventDefault();
    if (e.ctrlKey || !e.shiftKey && Math.abs(e.deltaX) < 1) cam.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)));
    else cam.panBy(-e.deltaX, -e.deltaY); }, { passive: false });
  const pts = new Map(); let drag = null, pinch = null;
  el.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; drag = null; cam.gesturing = true; }
    else if (pts.size === 1 && (e.button === 1 || (o.canPanFrom && o.canPanFrom(e)))) { drag = [e.clientX, e.clientY]; cam.gesturing = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} }
  }, true);
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      cam.panBy(m[0] - pinch.m[0], m[1] - pinch.m[1]); cam.zoomAt(m[0], m[1], d / Math.max(1, pinch.d)); pinch = { d, m }; e.stopImmediatePropagation(); }
    else if (drag) { cam.panBy(e.clientX - drag[0], e.clientY - drag[1]); drag = [e.clientX, e.clientY]; e.stopImmediatePropagation(); }
  }, true);
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { drag = null; setTimeout(() => { cam.gesturing = false; }, 0); } };
  el.addEventListener('pointerup', up, true); el.addEventListener('pointercancel', up, true);
  el.addEventListener('dblclick', e => { if (o.canPanFrom && o.canPanFrom(e)) cam.fit(true); });

  if (o.button !== false) {
    const host = el.parentElement; if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const bar = document.createElement('div'); bar.className = 'pz-bar';
    bar.innerHTML = '<button class="pz-in" aria-label="Zoom in">+</button><button class="pz-out" aria-label="Zoom out">−</button><button class="pz-fit" aria-label="Fit to view">⤢</button>';
    const mid = f => () => { const r = rect(); cam.zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); };
    bar.querySelector('.pz-in').onclick = mid(1.4); bar.querySelector('.pz-out').onclick = mid(1 / 1.4); bar.querySelector('.pz-fit').onclick = () => cam.fit(true);
    host.appendChild(bar); cam.bar = bar;
    if (!document.getElementById('pz-style')) { const s = document.createElement('style'); s.id = 'pz-style';
      s.textContent = '.pz-bar{position:absolute;right:8px;bottom:8px;display:flex;gap:4px;z-index:5}.pz-bar button{min-width:32px;min-height:32px;padding:0 6px;font:inherit;font-size:18px;line-height:1;cursor:pointer;opacity:.85}.pz-bar button:hover{opacity:1}';
      document.head.appendChild(s); }
  }
  if (o.world) { const ro = new ResizeObserver(() => { if (!cam.touched) cam.fit(false); }); ro.observe(el); }
  return cam;
};
