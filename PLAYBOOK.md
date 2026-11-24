# Playbook: making these feel like games

Distilled from research on game feel (Vlambeer's "Art of Screenshake", Jonasson & Purho's "Juice it or lose it", Swink's *Game Feel*, Eiserloh's GDC 2016 camera talk) and from style touchstones (neal.fun, Bartosz Ciechanowski, Townscaper, Mini Metro, Alto). Shared code: `shared/fx.js` (sound, tweens, shake, hit-stop, particles) and `shared/vendor/three` (three.js r170 + bloom/post-processing + OrbitControls, vendored so pages work offline and on any static host).

## Rules
- **The canvas is the game.** Full-bleed canvas/WebGL behind everything. DOM only for floating glassy chips (`backdrop-filter: blur(12px)`, about 10% white), never for the main play surface.
- **First 10 seconds:** something is already moving on load. One verb, no text wall, a pulsing affordance, juicy response within 100 ms (play the sound on `pointerdown`).
- **Pacing:** first reward within 5 s, something new within 30 s, unlocks every 30–90 s, stretching to 2–5 min. Every unlock is a celebration: hit-stop, particles, sound sting.
- **Juice numbers:**
  - Hit-stop: 40–80 ms small, 100–200 ms big.
  - Shake: trauma² × 8–16 px, decaying at about 1.2/s. Respect reduced-motion.
  - Squash: 1.25×0.8, recovering over 150–250 ms with outBack.
  - UI motion: in with outCubic over 200–350 ms, pops with outBack over 250–400 ms, 30 ms stagger between items.
  - Particles: 5–15 per small hit, 30–80 per burst, 200+ for celebrations. Life 0.3–0.8 s.
  - Leave permanence behind (marks, trails).
- **Sound:** transient + body + tail; ±5–10% pitch jitter; pentatonic UI notes; master compressor.
- **Look:** 3–5 colours plus one accent. No pure black or white. Gradient background plus vignette. Additive glow for anything emissive. Bloom strength 0.6–1.2, threshold 0.7–0.9.
  - 3D: hemisphere light, one warm key light, fog matching the background, long lens (FOV 20–35°) for diorama scenes.
- **Performance:**
  - Cap DPR at 2. Use instancing past about 50 copies.
  - No allocations in the frame loop. Fixed-step simulation, dt clamped to 50 ms.
- **Retention:** autosave, silhouettes of locked collectibles, visible next goal and progress bar, a satisfying end or prestige, a shareable seed.

## Importing three.js (vendored)
```html
<script type="importmap">{"imports":{"three":"../shared/vendor/three/build/three.module.min.js","three/addons/":"../shared/vendor/three/addons/"}}</script>
<script type="module">import * as THREE from 'three'; import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';</script>
```
ES modules don't load from `file://`. Serve the folder (`python3 -m http.server`).
