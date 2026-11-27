---
name: fast-3d-testing
description: Cheap testing and iteration for the three.js games in this repo (coaster, kiln, bell, floatees, watershed, evolve, hypothesis…) on a GPU-less, shared, CPU-limited machine. Use before verifying any 3D change (proportions, placement, physics, looks, perf budgets) instead of full-scene screenshots. Adapted from cktang88/3d-world-objects.
---

# Fast 3D testing

This sandbox has **no GPU** (SwiftShader software WebGL) and its CPUs are shared by many agents. A full-scene screenshot can take minutes, and software frame times are meaningless. Pick the cheapest check that answers the question:

| Question | Cheapest check |
|---|---|
| Sizes, distances, clearances, angles, physics, determinism, game logic | `page.evaluate` against the game's `window.__<id>` hooks, or plain Node: scene-graph maths, no pixels |
| One number from the real scene (tris, draw calls, a position) | a `__<id>.perf()` hook returning `renderer.info` counts, on a tiny viewport |
| Does it *look* right? | a **lab view** of only that piece (`?lab=<piece>&cam=x,y,z&look=x,y,z`) at 480×270 with `?fast=1` |
| Final look | one full-scene shot at the end of a feature, time-capped |

## Rules

- **Never iterate on the full scene.** Build only the piece you changed (one car, one tree, one crest, one pot) with placeholders or nothing around it.
- **Flags every 3D game should honour:**
  - `?fast=1` is the preset for `notex=1`, `post=0`, `shadows=0`, `people=0`, `scenery=0` and low quality.
  - Explicit flags override the preset.
  - `?lite` / `navigator.webdriver` already drop quality in several games.
- **Perf:**
  - Assert **counts**, not frame times: draw calls, triangles, programs, textures.
  - Phone budget: under 150 draws and under about 300k tris.
- **Rules as tests, not screenshots:**
  - Real-scale ranges, e.g. a person 1.5–1.95 m.
  - AABB overlaps and clearances.
  - Orientation via dot products.
  - Fixed-dt simulation steps.
  - Same-seed hashes.
- **Shared machine:**
  - Wrap every screenshot or perf run in `timeout 240`.
  - If a run fails or times out twice, make the experiment smaller (lab, flat colours, smaller viewport) instead of retrying.
  - Log progress to your scratchpad.
- **Mesh LOD:**
  - Switch LODs by screen-space error (about 1 px at the switch distance).
  - Use one shared error budget per asset, and rebuild crease normals afterwards.
  - Use impostors or billboards for far trees and props.
  - Avoid three.js `SimplifyModifier` at runtime on big meshes; pre-simplify offline (meshoptimizer).

## Stock-three perf fixes that pay (from cktang88/fastrender `three-game-perf`)

Fix the largest bucket first; name it (GPU fill, draws, JS, compile hitch) before changing code. Every fix gets a URL off switch so it can be A/B'd by counts.

1. **No dark/padding lights.** A point/spot light at intensity 0 still costs every lit fragment. Keep light counts fixed for the session (never toggle `light.visible` or add/remove lights: every lit program recompiles = freeze). Fake lamps with emissive + bloom.
2. **InstancedMesh is drawn whole.** Chunk instances spatially, one InstancedMesh per chunk with a recomputed bounding sphere, so the frustum culls per chunk.
3. **Discard draws last.** alphaTest/alphaHash materials defeat phone-GPU hidden-surface removal; use `renderer.setOpaqueSort` to put them after plain opaque draws, nearest first. Few alpha cards, impostors far.
4. **Freeze static subtrees.** `matrixAutoUpdate=false` + one `updateMatrix()`, and a no-op `updateMatrixWorld` on static group roots (`matrixWorldAutoUpdate=false` alone still walks the children).
5. **Shadows:** `shadowMap.autoUpdate=false`; set `needsUpdate` only when the light or casters move.
6. **No compile hitches:** build all materials/defines up front, `renderer.compile(scene, camera)` at load, never set a define/map after the first draw; keep `renderer.info.programs.length` small.
7. **LODs/triangles matter less than draws** on tile-based phone GPUs unless the triangles are on screen. Merge static geometry by material; measure draws first.
8. **Fill:** cap `pixelRatio` (≤1.5 on phones, adaptive if slow); short post chain.
