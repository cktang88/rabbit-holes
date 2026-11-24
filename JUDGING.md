# Judging: 20 candidates -> 10 finalists

Criteria (1-10 each): **Hook** = premise hook/uniqueness; **Depth** = credible path to 3+ hrs without bounce; **Feas** = buildable *well* as one static page in ~800-1500 lines of JS; **Var** = what it adds to the set's genre spread (low = duplicates a stronger pick's genre).

## Score table

| # | Idea | Hook | Depth | Feas | Var | Total | Verdict |
|---|------|-----:|------:|-----:|----:|------:|---------|
| 4 | NAND to Everything | 8 | 10 | 7 | 9 | **34** | FINALIST |
| 5 | First Contact | 10 | 8 | 5 | 10 | **33** | FINALIST |
| 3 | Rule Hunter | 9 | 9 | 7 | 8 | **33** | FINALIST |
| 1 | Universe Seed | 9 | 8 | 8 | 8 | **33** | FINALIST |
| 6 | Slingshot | 7 | 8 | 9 | 8 | **32** | FINALIST |
| 8 | Rumor | 9 | 7 | 6 | 9 | **31** | FINALIST |
| 13 | The Vault | 7 | 8 | 9 | 4 | 28 | Cut (genre clash with First Contact; first alternate) |
| 15 | Ant Mind | 8 | 6 | 7 | 8 | **29** | FINALIST |
| 17 | Mapmaker of Lost Islands | 9 | 6 | 6 | 9 | **30** | FINALIST |
| 9 | Caravan | 5 | 8 | 8 | 8 | **29** | FINALIST |
| 7 | Fold | 6 | 7 | 9 | 7 | **29** | FINALIST |
| 2 | Petri | 9 | 7 | 4 | 5 | 25 | Cut (high tuning risk; overlaps Ant Mind/Rule Hunter "emergent life") |
| 10 | Proto | 7 | 7 | 6 | 3 | 23 | Cut (too niche; overlaps First Contact) |
| 18 | Pandemic Mind | 6 | 4 | 6 | 6 | 22 | Cut |
| 20 | Orchestra of Primes | 6 | 3 | 8 | 5 | 22 | Cut (checklist toy, ~1-2 hrs) |
| 11 | Signal Fire | 5 | 5 | 6 | 5 | 21 | Cut (weak hook, self-admitted 2-3 hrs) |
| 14 | Tectonica | 8 | 4 | 3 | 6 | 21 | Cut (high risk, shallow objectives) |
| 12 | Desire Paths | 7 | 2 | 9 | 3 | 21 | Cut (1-2 hrs, toy) |
| 19 | Contraption | 4 | 5 | 3 | 5 | 17 | Cut (familiar, physics engine too big) |
| 16 | One Second | 6 | 1 | 9 | 1 | 17 | Cut (fails depth bar by its own admission) |

Notes on hard calls:
- **Vault vs First Contact:** both are "decode text" games; the set should have one. First Contact's hook is the best in the list and has no real competitor on the web; Vault is easier but closer to existing cipher puzzles. If First Contact's prototype can't keep the procedural language solvable within the first build pass, swap in Vault — it is the designated fallback.
- **Petri vs Ant Mind:** both are swarm/agent sims. Ant Mind gives the player direct, legible agency (painting scent) and fails gracefully; Petri's fun depends on emergent behaviour that is frequently dull when tuned wrong, and the "wait for 10k generations" loop drags. Rule Hunter already supplies the "discover emergent life" wonder.
- **Caravan** has the weakest hook of the finalists but is the only economy game and the most reliably deep. It is in on the condition that it gets a distinctive twist (see below).
- **Fold** beats Petri/Vault for slot 10 on variety (pure spatial optimisation) and feasibility; its weakness is presentation, which is fixable.

## Finalists, in recommended order

### 1. NAND to Everything
Proven 4-10 hr arc, payoff ("my CPU runs my program") is unbeatable.
- Lock the curriculum at **32 levels in 5 acts**: Logic (NOT..XOR, MUX, DEMUX — 8), Arithmetic (half/full adder, 4-bit then 8-bit adder, incrementer, subtractor, ALU — 7), Memory (SR latch, D latch, D flip-flop, register, counter, 8x8 RAM — 6), CPU (instruction decoder, condition unit, PC, control, full CPU — 5), Software (6 programs: add, max, multiply, fibonacci, sort 4 numbers, draw on an 8x8 pixel display).
- Simulate built chips as **truth-table/behavioural black boxes** once verified (not gate-by-gate) so the CPU level stays fast; this is the single biggest feasibility lever.
- Show **gate-count and par per level** plus an optional "transistor-golf" medal; re-optimising old levels is a major 2nd-hour replay hook.
- Cut free-form wire routing: use straight auto-routed wires and a bus/multi-bit wire type from the 8-bit level on, otherwise the editor eats the line budget and the player's patience.

### 2. First Contact
The most unique premise in the list; the "base-6 because six fingers" moment is the neal.fun shareable.
- Do **not** generate fully free grammar. Generate from a constrained template: number base (5-8, 12), glyph set of ~40, word order from {SOV, SVO, VSO}, one plural marker, one tense marker, ~80-word lexicon. Validate each seed by a solver that checks every chapter answer is deducible from prior transmissions.
- **8 chapters, ~6 transmissions each**: Counting -> Arithmetic -> Periodic table (H, He, C, O by proton count) -> Their star system -> Their bodies -> Verbs/time -> Their history -> Open dialogue. Each chapter ends in a reply the player composes from a glyph palette.
- Add a **lexicon notebook** with confidence states (guess / likely / confirmed) and auto-highlighting of every occurrence of a glyph — this is where the hours go.
- Add a "hint by the SETI team" system (3 per chapter) so stuck players don't bounce; full-text replays with a new seed are the replay hook.

### 3. Rule Hunter
Genuinely infinite search space with a collector's loop; the classifier is the product.
- Classifier scope: run 256x256 soup ~2000 gens, extract connected objects, hash canonical form across 8 symmetries, detect period up to 30 and displacement for ships. Puffers/replicators: detect via population-growth signature only, don't try to be clever.
- **120 bounties in 6 tiers** of 20 (Common still lifes -> period-N oscillators -> orthogonal ships -> diagonal/knight ships -> puffers/guns -> "weird rules": explode, freeze, maze, chaos). Make ~30% of bounties require leaving B3/S23.
- Add a **rule map**: a 2D projection of rule-space where explored rules light up — gives a visible "how much have I explored" metric and tempts the player toward dark regions.
- Field guide cards with auto-generated Latin-ish species names and an animated thumbnail; a "capture" moment with a sound is critical for the collection loop.

### 4. Universe Seed
Strongest "crazy cool" scale premise; idle structure guarantees time-on-page.
- Cap the first run at **~40 min with 12 eras**, then prestige. Each prestige unlocks one new tunable constant (6 total), so the player meets constants gradually.
- Make the **codex 40 universe types** deterministic from constant ranges, and show silhouettes of undiscovered ones with a one-line hint ("a universe where nothing ever cools").
- Add active play in each era (e.g. click to collapse a gas cloud, aim a supernova) so it's not pure number-go-up; idle-only is what loses people at 30 min.
- Cut "minds/civilizations" sub-sims to a short ladder; spend the budget on the star/element era where the visual wow lives.

### 5. Slingshot
Lowest risk, high polish ceiling, very satisfying physics.
- **40 levels in 5 systems of 8**, each system introducing one mechanic: single planet, moons, binary stars, Lagrange-point parking, black hole with time dilation on the clock.
- Path preview must be **truncated** (e.g. first 30% of trajectory, extendable with a "scanner" upgrade) — full preview kills the puzzle.
- 3-star ratings on fuel *and* a hidden "elegance" star for zero-burn solutions; plus seeded procedural deep-space with shareable seed strings for endless mode.
- Use a fixed-timestep Verlet/RK4 integrator so solutions replay deterministically (required for sharing and fairness).

### 6. Rumor
Highly original social-graph strategy; mutation of rumours is the memorable twist.
- Legibility first: render the town as a force-directed graph with **heat on belief**, and a per-person card showing what *they* heard (the mutated text). Without this, it fails.
- Rumour mutation via a small grammar of slots (who / did what / to whom / where) where each hop has a chance to swap one slot — readable and funny, not random noise.
- **25 scenarios in 5 acts**, then a procedural endless mode with daily seed. Add counters to play against from act 2 (fact-checkers, a rival gossip spreading a counter-rumour).
- Keep the town at 120-150 people, not 300; fewer, more characterful nodes beat a hairball.

### 7. Ant Mind
"You are the pheromone" is a great indirect-control hook and visually spectacular.
- **20 maps in 4 seasons** with escalating constraints: food scarcity, water/rain that washes scent, rival colony, predator (spider) that ants must route around.
- Pheromone types unlocked progressively: food trail -> alarm -> recruit-soldier -> "build" (dig tunnels). Each new scent is a new verb; that's the depth.
- Simulate on a grid-based diffusion/evaporation field (typed arrays) with ~2000-5000 ants; it's cheap and looks great.
- Cut colony-management menus; upgrades should be 3-way choices between maps, nothing more.

### 8. Mapmaker of Lost Islands
Original and evocative; "draw the map yourself" is something nobody has done well.
- Keep drawing simple: player **places coastline points** (snapping polyline) from sightings, not freehand art; accuracy scored by IoU vs. true coastline.
- Instruments as the progression spine: compass -> log line -> quadrant -> sextant -> chronometer, each reducing position error you can *see* as drift between your map and truth.
- **12 commissions** (chart a harbour, find the strait, map the reef safely, the island that isn't there) + procedural voyages; sell maps to buyers who sometimes wreck on your errors (a dramatic feedback loop).
- Add a hand-inked parchment rendering of the final map you can export as PNG — the shareable artefact.

### 9. Caravan
The only economy game; reliably deep but must earn its slot with a twist.
- Give it a hook: **information is the commodity** — prices you see are stale by travel time; buy rumours, send pigeons, run spies. This makes it distinct from generic trading sims and ties into the "history" flavour.
- **20-year career in seasons**, ~30 cities, ~14 goods with perishability; contracts and a legacy score that unlocks starting perks for the next career (prestige).
- Generate 3-4 shocks per career (plague, war, harvest failure) announced by rumour before they hit, rewarding players who read the signals.
- Cut combat entirely; bandits are a risk roll mitigated by guards/routes.

### 10. Fold
Most feasible finalist and pure spatial puzzling; needs presentation to overcome niche feel.
- Reframe the hook: "Beat the supercomputer" — each benchmark shows the published optimum and the number of CPU-years once spent on it.
- **36 levels**: 6 tutorial, 20 classic benchmark sequences (length 20->64), 10 hard (up to 100); plus a daily seed. Show "% of optimum" so near-misses still feel good.
- Unlock move tools in order: drag end -> corner flip -> crankshaft -> pivot -> pull moves; each unlock is a reason to revisit old levels for a better score.
- Cut the 3D tier from v1; spend the budget on undo history, contact-highlighting and a satisfying "snap" when an H-H contact forms.

## Set check
Genres covered: circuit engineering, language decoding, cellular-automata collecting, cosmic idle, orbital physics puzzle, social strategy, swarm/indirect control, exploration/cartography, economic sim, spatial optimisation puzzle. No two share a core loop.
