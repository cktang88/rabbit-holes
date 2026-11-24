# 20 candidate experiments

Constraint for every idea: a single static page (HTML/JS/Canvas, no backend), saves progress to localStorage, and has a *depth engine* — something that keeps generating new goals for 3+ hours instead of a one-trick toy you leave after 30 minutes.

---

## 1. Universe Seed
**Premise:** You are the Big Bang. Start with a single quark-gluon flicker and grow a universe all the way to heat death — then rewrite the laws of physics and do it again.
**Core loop:** Incremental/idle. Produce energy → particles → hadrons → atoms → stars → stellar nucleosynthesis (actual element ladder H→He→C→O→Fe) → supernovae → planets → chemistry → life → minds → civilizations → stellar engineering → entropy wins.
**Depth engine:** "Rebirth" prestige: each new universe lets you tune constants (fine-structure, gravity strength, cosmological constant, dimensions). Constants change which eras are reachable and produce bizarre universes (no stars, all black holes, life made of plasma). Codex of 40+ discoverable universe types.
**Hours:** Era 1 run ~45 min, prestige runs get faster but deeper; codex completion 4–6 hrs.
**Wow moment:** First supernova seeding iron across your galaxy map.
**Build risk:** Low-medium. Balancing numbers.

## 2. Petri
**Premise:** A real evolution sim in a dish. Creatures have genomes (body plan + tiny neural net); you don't design them — you design the world and watch natural selection.
**Core loop:** Paint terrain, food, toxins, temperature; tune mutation; fast-forward thousands of generations; phylogenetic tree grows in sidebar.
**Depth engine:** 25 "selection challenges" (evolve a predator, evolve something that crosses a toxic river, evolve camouflage, sustain a 3-species food web for 50k ticks). Plus species naming and a hall of fame.
**Hours:** Each challenge 5–20 min of tinkering, plus open sandbox.
**Wow moment:** First time a predator lineage emerges on its own.
**Build risk:** Medium-high (performance, emergent behavior can be dull if tuned wrong).

## 3. Rule Hunter
**Premise:** There are 262,144 Life-like cellular automaton universes. You're a naturalist cataloging the creatures that live in them.
**Core loop:** Pick/mutate a rule (B3/S23 etc.), seed soups, an automatic classifier detects still lifes, oscillators (with period), spaceships (with speed), puffers, and replicators; you capture them into a field guide.
**Depth engine:** Field guide with 120 bounty slots ("a period-7 oscillator", "a c/4 diagonal ship", "a rule where everything explodes"), rarity tiers, a "first discovered by you" log keyed by canonical pattern hash. Genuinely infinite search space.
**Hours:** Effectively endless; bounties carry 3–8 hrs.
**Wow moment:** Catching a spaceship in a rule nobody named.
**Build risk:** Medium (classifier robustness).

## 4. NAND to Everything
**Premise:** You get exactly one logic gate. Build a working computer — then program it.
**Core loop:** Drag-and-wire circuit editor; each level asks for a component with a truth table / test vectors; built components become reusable chips.
**Depth engine:** ~30 levels: NOT, AND, OR, XOR, MUX, half/full adder, 8-bit adder, ALU, latch, flip-flop, register, counter, RAM, CPU decode, then a tiny assembler where you write programs (multiply, fibonacci) on the CPU *you built*. Gate-count leaderboard per level vs. par.
**Hours:** 4–10 hrs (nandgame-proven).
**Wow moment:** Your own CPU running your own program.
**Build risk:** Medium (simulator + editor UX).

## 5. First Contact
**Premise:** A signal arrives from a star 41 light-years away. It's not in any human language. Decode it.
**Core loop:** Procedurally generated alien language per save: unknown base number system, glyph alphabet, grammar (word order, plurals, tense), vocabulary grounded in pictures/diagrams the aliens send (counting, then the periodic table, then their planet, biology, history). You annotate glyphs with guesses; transmissions unlock as you answer correctly in their language.
**Depth engine:** 8 chapters of transmissions, each ending with a reply you must compose in alien glyphs; final chapter is a real conversation. Different seed = different language.
**Hours:** 3–5 hrs.
**Wow moment:** Realizing they count in base 6 because they have 6 fingers — and they've been telling you for an hour.
**Build risk:** Medium-high (procedural language that stays solvable).

## 6. Slingshot
**Premise:** You have one probe and almost no fuel. Use real Newtonian gravity to reach the edges of a hand-built solar system.
**Core loop:** Set launch angle/power and place limited thruster burns; path preview; gravity assists off moons and planets.
**Depth engine:** 40 handcrafted levels (binary stars, rogue planets, Lagrange points, a black hole) + 3-star fuel ratings + infinite procedurally generated "deep space" mode with seeds you can share.
**Hours:** 3+ hrs.
**Wow moment:** A five-body gravity assist chain that shouldn't work.
**Build risk:** Low-medium.

## 7. Fold
**Premise:** Proteins are tiny origami machines. Fold real-style chains to bury the oily parts — the same puzzle that stumped supercomputers.
**Core loop:** 2D HP-lattice model: drag a chain of hydrophobic/polar beads into a self-avoiding fold; score = H–H contacts.
**Depth engine:** Classic benchmark sequences with known optimal energies (length 20 → 100), daily procedurally generated proteins, "pivot/crankshaft" move tools unlocked progressively, 3D lattice bonus tier.
**Hours:** 3+ hrs for puzzle lovers.
**Wow moment:** Matching a published optimum by hand.
**Build risk:** Low. Risk: too niche/abstract.

## 8. Rumor
**Premise:** A town of 300 procedurally generated people, each with friends, rivals, gullibility and secrets. Whisper one lie. Watch it travel.
**Core loop:** Strategy puzzle: limited whispers per day; information spreads through a social graph with trust, mutation (rumors distort as they travel), and fact-checkers.
**Depth engine:** Campaign of 25 scenarios (get the mayor ousted, save a scapegoat, make two rival families reconcile) + endless procedural towns.
**Hours:** 3+ hrs.
**Wow moment:** Seeing your rumor mutate into something you never said.
**Build risk:** Medium (making it legible).

## 9. Caravan
**Premise:** A procedurally generated Silk Road. Buy low, sell high, survive deserts, bandits and plagues across 30 cities with real supply/demand.
**Core loop:** Trading sim with dynamic prices, travel time, perishable goods, events, contracts.
**Depth engine:** Grow from one camel to a trading empire; caravanserais, insurance, rumors of shortages; a 20-year career with legacy score.
**Hours:** 3–6 hrs.
**Wow moment:** Cornering the saffron market.
**Build risk:** Low-medium. Risk: familiar genre.

## 10. Proto
**Premise:** Be a historical linguist. Given words in five living daughter languages, reconstruct their dead ancestor and the sound laws that killed it.
**Core loop:** Puzzle: write sound-change rules (p > f / _V) and a proto-form; the engine derives descendants and diffs against attested forms.
**Depth engine:** 30 procedurally generated language families of rising difficulty (rule ordering, conditioned splits, mergers).
**Hours:** 3+ hrs for the right audience.
**Wow moment:** One rule suddenly fixes 40 words at once.
**Build risk:** Medium. Very niche.

## 11. Signal Fire
**Premise:** It's 1400. Build a chain of signal towers, then semaphore, then telegraph, then fiber across a procedural continent; information speed IS the score.
**Core loop:** Network builder with real-ish latency/bandwidth; cities generate messages.
**Depth engine:** Tech ages unlock; wars/markets reward low latency.
**Hours:** 2–3.
**Build risk:** Medium. Weaker hook.

## 12. Desire Paths
**Premise:** Don't plan a city. Let thousands of pedestrians trample paths, then pave what they walk.
**Core loop:** Agents walk between buildings; grass wears; you pave/build.
**Depth engine:** Score on commute time; grow to a city.
**Hours:** ~1–2. Probably shallow.
**Build risk:** Low.

## 13. The Vault (Cipher Heist)
**Premise:** 40 locked vaults guarded by history's ciphers — from Caesar to Enigma to a one-time pad someone reused.
**Core loop:** Crack ciphertexts with in-game tools (frequency chart, Kasiski, crib dragging) you unlock.
**Depth engine:** Procedural plaintexts so no spoilers; escalating ciphers; final Enigma-like machine.
**Hours:** 3–5.
**Build risk:** Low-medium.

## 14. Tectonica
**Premise:** Drift continents for 4 billion years; rain, rivers, climate and life follow.
**Core loop:** Plate sim on a map, erosion, climate bands, biomes.
**Depth engine:** Objectives (make a Pangea, an inland sea, a desert planet).
**Hours:** 1–2 unless very sophisticated.
**Build risk:** High.

## 15. Ant Mind
**Premise:** You are not an ant. You are the *pheromone*. Control a colony only by painting scent.
**Core loop:** Thousands of ants follow gradients; seasons, rivals.
**Depth engine:** Colony upgrades, castes, wars, 20 maps.
**Hours:** 2–3.
**Build risk:** Medium.

## 16. One Second
**Premise:** Everything that happens on Earth in one second, explorable and zoomable.
**Core loop:** Scrolling infographic.
**Depth engine:** None — it's a 20-minute neal.fun piece. Fails the depth bar.

## 17. Mapmaker of Lost Islands
**Premise:** You're a 17th-century cartographer. You can only see what your ship sees; draw the map yourself, and sell it.
**Core loop:** Sail with fog of war; you plot coastlines by hand; accuracy is scored against truth.
**Depth engine:** Procedural archipelagos; reputation; instruments (sextant, chronometer) improve precision.
**Hours:** 2–4.
**Build risk:** Medium.

## 18. Pandemic Mind
**Premise:** Be the immune system. Design antibodies (shape-matching puzzle) against evolving pathogens.
**Core loop:** Pathogens mutate; you breed B-cells.
**Hours:** 2. Theme maybe heavy.
**Build risk:** Medium.

## 19. Infinite Craft-alike for Machines (Contraption)
**Premise:** Rube Goldberg physics puzzles.
**Hours:** 2–3. Familiar.
**Build risk:** High (physics engine).

## 20. Orchestra of Primes
**Premise:** Number theory as music: every integer is a sound, primes are notes; discover patterns (twin primes, Collatz, Ulam spiral) and unlock instruments.
**Core loop:** Explore number sequences sonically/visually; "collect" theorems.
**Depth engine:** 60 discoveries checklist.
**Hours:** 1–3.
**Build risk:** Low. Hook uncertain.
