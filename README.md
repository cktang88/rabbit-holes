# Rabbit Holes

Ten browser experiments in the spirit of [neal.fun](https://neal.fun), each built to hold you for an afternoon rather than five minutes.

Every experiment is a single static page with no build step, no backend and no accounts. Progress saves to `localStorage`, so you can close the tab and come back.

**Play:** https://cktang88.github.io/rabbit-holes/

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

## How this was made

Twenty ideas were drafted (see [IDEAS.md](IDEAS.md)). An independent judge scored them on hook, depth, feasibility and variety, then picked the ten (see [JUDGING.md](JUDGING.md)).

## Running locally

```sh
python3 -m http.server
# open http://localhost:8000
```

Shared helpers (saving, toasts, modals, seeded RNG) live in `shared/`.
