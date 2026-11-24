# Rabbit Holes

Ten browser experiments in the spirit of [neal.fun](https://neal.fun), each built to hold you for an afternoon rather than five minutes.

Every experiment is a single static page with no build step, no backend and no accounts. Progress saves to `localStorage`, so you can close the tab and come back.

**Play:** https://cktang88.github.io/rabbit-holes/ (after turning on GitHub Pages: Settings → Pages → deploy from `main`, root)

| | Experiment | The premise | What keeps it going |
|---|---|---|---|
| 🔌 | [NAND to Everything](nand/) | You get one logic gate. Build a computer, then program it. | 25 circuit levels (logic → arithmetic → memory → CPU), then 9 assembly programs that run on the CPU you built. NAND-count par and stars on every level. |
| 📡 | [First Contact](first-contact/) | Decode a signal from 41 light-years away. | A procedurally generated alien language for every save: its own number base, word order, plurals and tense. 8 transmissions, ending in a real two-way exchange. |
| 🦠 | [Rule Hunter](rule-hunter/) | Be a naturalist across 262,144 Life-like universes. | An automatic classifier catches still lifes, oscillators, spaceships, knightships and growers. Field guide, 103 bounties and a map of rule space. |
| 🌌 | [Universe Seed](universe-seed/) | Grow a universe from the Big Bang to heat death. | 11 eras, then rebirth with different physical constants (gravity, Λ, α, strong force, matter excess, dimensions). A 40-entry codex of universe types. |
| 🛰️ | [Slingshot](slingshot/) | One probe, almost no fuel, real gravity. | 40 levels in 5 systems (static planets, orbiting moons, binary stars, ring gauntlets, a black hole). Each one is checked for solvability when it's generated. Seeded deep-space mode. |
| 🗣️ | [Rumor](rumor/) | Whisper a lie into a town and watch it mutate. | 25 scenarios across 5 acts: smear, defend, reconcile feuds, outmanoeuvre skeptics and rival gossips. Endless seeded towns. |
| 🐜 | [Ant Mind](ant-mind/) | You're not an ant. You're the pheromone. | 20 seasonal maps, 4 scent types (forage, alarm, dig, retreat), spiders, rival colonies, rain, winter. Colony traits carry over between maps. |
| 🧭 | [Mapmaker of Lost Islands](mapmaker/) | Chart islands in 1680 using dead reckoning. | Your chart drifts from the truth with currents and compass error. 8 instruments, 12 commissions, reefs, mutiny. A new archipelago every run, and you can export the parchment. |
| 🐫 | [Caravan](caravan/) | Silk Road trading where information is the real cost. | Every price you know is stale. Pigeons, paid agents and tavern rumours buy fresher information. Plagues, wars and famines, three-year careers, and legacy perks for the next one. |
| 🧬 | [Fold](fold/) | Protein folding by hand, against benchmarks and a computer. | 2D HP-lattice folding: 10 warm-ups with exact optima, 10 classic benchmark chains, and 12 chains where a simulated-annealing opponent folds against you. Moves unlock as you go. |

## Round 2

Six more, dug after the first ten. They fill genres the first set didn't have: cryptanalysis, inductive science, mechanical design, deduction under uncertainty, sound and light (see [IDEAS-2.md](IDEAS-2.md)).

| | Experiment | The premise | What keeps it going |
|---|---|---|---|
| 🔐 | [The Vault](vault/index.html) | Thirty-six vaults locked by real historical ciphers. | Caesar → al-Kindi's frequency analysis → transpositions → Vigenère and Kasiski → layered Black Chamber ciphers → reused Soviet one-time pads. A stackable decryption workbench, analysis tools that unlock as history invents them, and messages generated per save. |
| ⚗️ | [Hypothesis](hypothesis/index.html) | A machine accepts some rows of shapes and rejects others. Find the law. | 60 laws from a procedural grammar across 8 tiers (presence → counting → ends → neighbours → logic → relations → implication → hidden arithmetic). You publish by predicting 8 unseen verdicts. Fewer probes earn more stars. Endless free lab. |
| ⚙️ | [Escapement](escapement/index.html) | Cut gears for clocks, calendars and orreries. | 28 commissions: exact trains with awkward parts, then irrational astronomical ratios measured in ppm with Brocot's table, then multi-hand trains ending in the Antikythera mechanism. Each one was checked by a solver to make sure 3 stars is reachable. |
| ⛪ | [Parish](parish/index.html) | Trace emigrants' ancestors through a village register, 1700–1799. | A simulated village of about 2,000 people becomes about 3,000 baptism, marriage and burial records, with misspelt surnames, abbreviated names, reused names of dead infants and lost years. 24 letters per parish, each checked to have exactly one deducible answer. New parish whenever you like. |
| 🎹 | [Temperament](temperament/index.html) | Tune a keyboard by ear, and fail at it the way history did. | 16 commissions: pure fifths and the Pythagorean comma, just intonation and the syntonic comma, meantone's wolf, Werckmeister, Vallotti, equal temperament, then minimax temperaments for composers' chord sets. Everything is audible: you hear the beats. Star thresholds set from a numerical optimum. |
| 🔦 | [Opticks](opticks/index.html) | Steer light through mirrors, prisms and lenses on an optical bench. | 26 experiments in 5 chapters: reflection, refraction and total internal reflection, lenses and telescopes, Newton's colour experiments and the achromatic doublet, then reflecting telescopes, solar furnaces and fibres. A real ray tracer (Snell's law, dispersion, thin lenses). Every level was authored from a working solution and checked by script. |

## Round 3

Round 3 started from a research sweep of random Wikipedia pages, the best interactive web toys and counterintuitive phenomena: 56 candidates in [IDEAS-3.md](IDEAS-3.md). It also has a new rule: the play surface is a canvas or WebGL scene, never DOM panels (see [PLAYBOOK.md](PLAYBOOK.md)).

| | Experiment | The premise | What keeps it going |
|---|---|---|---|
| 💧 | [Watershed](watershed/index.html) | Sculpt a 3D landscape and let water carve it. | A real hydraulic erosion simulation (virtual-pipe water, sediment transport, rock strata, slope collapse) rendered in three.js. Ten landscapes: springs, canyons, waterfalls retreating through caprock, deltas, levees against a storm, irrigation, dams, then a sandbox. |
| 🚦 | [Gridlock](gridlock/index.html) | Fix traffic in cities full of selfish drivers. | A Wardrop-equilibrium traffic model with drivers re-routing live. Braess's paradox (closing a road speeds everyone up), Seoul's Cheonggyecheon, Pigou tolls and congestion charges that approach the system optimum. Every city was checked by brute force for a solution. |
| 🎲 | [Ruin](ruin/index.html) | A bet with positive expected value that ruins almost everyone. | Six chapters on ergodicity: flip the coin yourself; watch the average of 1,000 players soar while the typical player collapses; find the Kelly bet; pool risk (three people is the smallest group that wins); Shannon's demon rebalancing; and the martingale's ruin. Goals use exact growth rates, not noisy samples. |
| ❄️ | [Snowfall](snowfall/index.html) | Every snowflake is a record of the cloud it fell through. | Reiter's hexagonal crystal-growth model runs live and renders as glowing ice. Steer the conditions mid-fall to collect 7 crystal forms (plates, sectored plates, stellar dendrites, ferns, plates with arms, dendrites with plate tips), keep a gallery, and solve 8 "copy this flake" puzzles scored by overlap. |
| 🦠 | [Low Reynolds](low-reynolds/index.html) | Swim as a bacterium, in water that behaves like honey. | Purcell's three-link swimmer in resistive-force theory (zero net force and torque at every instant). Draw a loop in shape space over a heat map of the geometric-phase field. 8 levels: the scallop theorem, reversing, stroke efficiency, turning, steering round sand grains, and an energy budget. All levels were checked by a scripted autopilot. |

## How this was made

Twenty ideas were drafted (see [IDEAS.md](IDEAS.md)). An independent judge scored them on hook, depth, feasibility and variety, then picked the ten (see [JUDGING.md](JUDGING.md)).

## Running locally

```sh
python3 -m http.server
# open http://localhost:8000
```

Shared helpers (saving, toasts, modals, seeded RNG) live in `shared/`.
