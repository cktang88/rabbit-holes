// Shared helpers for every experiment: saving, toasts, modals, seeded RNG.
const RH = (() => {
  const save = (key, data) => { try { localStorage.setItem('rh:' + key, JSON.stringify(data)); } catch (e) {} };
  const load = (key, fallback) => {
    try { const v = localStorage.getItem('rh:' + key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  };
  const wipe = (key) => { try { localStorage.removeItem('rh:' + key); } catch (e) {} };

  let wrap;
  const toast = (msg, ms = 2600) => {
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = msg; wrap.appendChild(t);
    setTimeout(() => t.remove(), ms);
  };

  const modal = (html, buttons = [{ label: 'OK' }]) => new Promise(res => {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = html;
    const row = document.createElement('div'); row.className = 'row modal-actions'; row.style.marginTop = '14px'; row.style.justifyContent = 'flex-end';
    buttons.forEach((b, i) => {
      const el = document.createElement('button'); el.textContent = b.label;
      if (i === buttons.length - 1) el.className = 'primary';
      el.onclick = () => { bg.remove(); res(b.value ?? b.label); };
      row.appendChild(el);
    });
    m.appendChild(row); bg.appendChild(m); document.body.appendChild(bg);
  });

  // mulberry32 seeded RNG
  const rng = (seed) => {
    let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
    const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    f.int = (n) => Math.floor(f() * n);
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.range = (a, b) => a + f() * (b - a);
    f.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    return f;
  };
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  const fmt = (n) => {
    if (!isFinite(n)) return '∞';
    if (Math.abs(n) < 1000) return (Math.round(n * 10) / 10).toString();
    const u = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    const e = Math.floor(Math.log10(Math.abs(n)) / 3);
    if (e < u.length) return (n / Math.pow(1000, e)).toFixed(2) + u[e];
    return n.toExponential(2).replace('+', '');
  };

  // Track hub progress: each experiment reports a 0..1 completion fraction.
  const progress = (id, frac) => { const p = load('hub', {}); p[id] = Math.max(0, Math.min(1, frac)); save('hub', p); };

  // When the browser refuses WebGL (graphics acceleration off or a blocklisted GPU; recent Chrome no longer falls back to software), say so plainly and how to fix it.
  const noGL = (name) => {
    if (document.getElementById('rh-nogl')) return;
    const d = document.createElement('div'); d.id = 'rh-nogl';
    d.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,10,12,.92);color:#eee;font:16px/1.5 system-ui,sans-serif';
    d.innerHTML = '<div style="max-width:460px"><h2 style="margin:0 0 .5em;font-size:20px">' + name + ' needs 3D graphics (WebGL), and your browser turned it down.</h2>'
      + '<p style="margin:.4em 0">This usually means graphics acceleration is off, or Chrome has blocklisted your GPU driver. Recent Chrome no longer falls back to software 3D.</p>'
      + '<ol style="margin:.4em 0 .8em 1.2em;padding:0"><li>Open <b>chrome://settings/system</b> and switch on <b>Use graphics acceleration when available</b>, then relaunch.</li>'
      + '<li>Open <b>chrome://gpu</b>: "WebGL2" should say <i>Hardware accelerated</i>.</li>'
      + '<li>Still off? Try <b>chrome://flags/#ignore-gpu-blocklist</b>, or update your graphics driver.</li></ol>'
      + '<a href="../" style="color:#9cf">← Back to Rabbit Holes</a></div>';
    document.body.appendChild(d);
  };
  return { save, load, wipe, toast, modal, rng, hashStr, fmt, progress, noGL };
})();

// On experiment pages, add a small "more like this" link beside the "← Rabbit Holes" home link.
// It opens the hub's similar-experiments view for this page (index.html#like=<folder>).
(() => {
  const add = () => {
    const home = document.querySelector('a.home[href="../index.html"]'); if (!home || home.nextElementSibling?.classList.contains('rh-like')) return;
    const id = location.pathname.split('/').filter(Boolean).slice(-2, -1)[0]; if (!id) return;
    const a = document.createElement('a'); a.className = 'rh-like'; a.href = '../index.html#like=' + encodeURIComponent(id); a.textContent = innerWidth < 640 ? '≈' : '≈ more like this'; a.setAttribute('aria-label', 'More experiments like this one'); a.title = 'Experiments like this one';
    a.style.cssText = 'margin-left:8px;font-size:.85em;opacity:.65;color:inherit;text-decoration:none;white-space:nowrap';
    a.onmouseenter = () => a.style.opacity = 1; a.onmouseleave = () => a.style.opacity = .65;
    home.after(a);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
