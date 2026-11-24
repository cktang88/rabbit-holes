# Round 2: more rabbit holes

The ten finalists are being built on `main`. This round looks for experiments that **don't overlap** any finalist. Same constraint: one static page, localStorage saves, and a *depth engine* that keeps making new goals for 3+ hours.

Genres the set already covers: circuits, language decoding, cellular automata, cosmic idle, orbital physics, social strategy, swarm control, cartography, economy, spatial optimisation.
Genres still missing: **inductive science** (form a hypothesis, test it), **cryptanalysis**, **mechanical design**, **deduction under uncertainty**, **music/sound**.

---

## A. Hypothesis
**Premise:** A machine accepts some arrangements of shapes and rejects others. Find the hidden law. You're doing science: build experiments, predict, and stake a claim.
**Core loop:** Each "koan" is a row of 1–6 tokens (shape × colour × size). The lab starts with two examples, one accepted and one rejected. Build koans and submit them (each costs a probe). When you think you know the law, enter **prediction mode**: the machine shows 8 fresh koans and you must classify them all correctly to "publish".
**Depth engine:** Laws come from a procedural grammar (counts, existence, all/none, adjacency, ordering, parity, comparisons between attributes, AND/OR/NOT combos), sorted into 8 tiers of difficulty. 60 campaign laws with par probe counts, then an endless daily law. A journal keeps every experiment so you can scroll your own evidence.
**Wow moment:** Fifty probes in, you realise the law was "the leftmost token is bigger than the rightmost" and every result suddenly makes sense.
**Verdict:** **BUILD.** Genuinely new genre for the set (Zendo/Eleusis-style induction), infinite content from the grammar, cheap to render. Risk: laws that are guessable but not *testable*. Fix: prediction-mode publishing instead of typing the law in.

## B. The Vault
**Premise:** 40 vaults, each locked by one of history's ciphers, Caesar to a homemade Enigma. You get the ciphertext and a toolbench.
**Core loop:** Pick a vault, inspect the ciphertext, use tools (frequency chart, shift wheel, substitution board, Kasiski spacing, column-width tester, crib dragger) to recover the plaintext.
**Depth engine:** Tools unlock vault by vault; procedural plaintexts so it never spoils; par time per vault; 6 eras (Antiquity → Renaissance → Black Chamber → WWI → Enigma → One-time-pad misuse).
**Wow moment:** Kasiski spacing lights up "5", and the Vigenère falls apart into five Caesar ciphers you've already learned to break.
**Verdict:** **BUILD.** Round 1's designated first alternate. It was cut only because of a genre clash with First Contact, but the two play very differently: First Contact is *meaning*, the Vault is *mechanism*.

## C. Escapement
**Premise:** Build a clock from gears. Then a calendar. Then an orrery that predicts eclipses.
**Core loop:** Place gears (tooth counts 8–120) on a grid of axles, mesh them, and hit a target ratio. Compound trains, idlers for direction, then differentials (add/subtract rotations) and pin-and-slot for variable speed.
**Depth engine:** 30 commissions (seconds hand, hour hand, day-of-week, moon phase at 29.53 days, Metonic cycle, the Antikythera saros dial). Scored on gear count and error in parts-per-million.
**Wow moment:** Your moon-phase dial drifts one day in 2,500 years.
**Verdict:** **BUILD (third).** Mechanical design is untouched by the set, and ratio puzzles hide number theory (continued fractions!) for the people who dig.

## D. Differential
**Premise:** Patients arrive with symptoms. You order tests with real sensitivity/specificity and a budget. Bayesian diagnosis as a game.
**Verdict:** Interesting but heavy theme, and medicine invites "is this accurate?" scrutiny. Parked.

## E. Kepler's Notebook
**Premise:** You only get naked-eye sightings of planets from a moving Earth (with retrograde loops). Fit a model: Ptolemy's epicycles, then Copernicus, then ellipses.
**Verdict:** Great hook, but the fitting UI is hard to make fun and the arc is ~1.5 hrs. Parked; could become an Escapement epilogue.

## F. Proto (from round 1)
Still too niche. Cut.

## G. Seismic
**Premise:** Triangulate earthquakes from seismograph traces, then infer the planet's interior from shadow zones.
**Verdict:** One great "aha" (the liquid core) but thin after it. Cut.

## H. Tide Machine
**Premise:** Add sine waves to predict tides for real ports (Kelvin's machine).
**Verdict:** Fourier toy, ~45 min. Cut. Could fold into Escapement as a late commission.

## I. Sortfest
**Premise:** Design sorting networks (compare-swap wires) for n=4..16 against known optimal sizes.
**Verdict:** Nice, but it's NAND's sibling. Could be a NAND bonus act later. Cut as a standalone.

## J. Polyrhythm Garden
**Premise:** Euclidean rhythms and phase music. Plant pulse-flowers that sound when they bloom; match target grooves.
**Verdict:** Fills the music gap, but "match the groove" puzzles run out fast. Parked.

## K. Murmuration
Boids toy. Shallow. Cut.

## L. Black Box (Atomic edition)
**Premise:** Fire rays into a hidden grid of atoms and deduce where they are from where the rays come out.
**Verdict:** A classic, small and solid, but it overlaps Hypothesis's "probe and deduce" loop. Folded into Hypothesis as a possible later mode.

---

## Build order
1. **The Vault**: built (`vault/`). 36 vaults in 6 eras, verified solvable by an automated inverse-key test.
2. **Hypothesis**: built (`hypothesis/`). 60 laws in 8 tiers, plus a free lab.
3. **Escapement**: built (`escapement/`). 28 commissions in 4 acts, all verified to reach 3 stars.

New experiments go in their own folders and appear in a second hub section ("Round 2"), so they don't collide with ongoing finalist work.

---

# Round 3

## M. Parish
**Premise:** Descendants overseas write to you, the village genealogist. Trace their ancestors through 100 years of a parish register: baptisms, marriages and burials, in a clerk's handwriting habits.
**Core loop:** A family-history commission is a chain of tasks ("find the marriage of Mary's parents", "find the groom's baptism", "find his burial"). Each answer is a record you pick out of about 2,000. The register is simulated from a living village, so names repeat across cousins, children are named after siblings who died, ages at burial are approximate, surnames are spelt three ways, and some years are lost.
**Depth engine:** About 24 commissions in 4 tiers, each generated so that its answer is *uniquely deducible* (a checker proves that only the true record survives the constraints a careful genealogist would apply) while being ambiguous on name alone. When the parish runs out, a new seed generates a new village.
**Wow moment:** Three John Coopers were baptised within six years. You rule one out with a burial aged 2, another with a marriage the year before, and the third fits.
**Verdict:** **BUILD.** Deduction under uncertainty (a gap in the set), a real-world obsession (genealogy), and infinite procedural content. Risk: unsolvable questions; mitigated by the uniqueness checker.

## N. Kepler's Notebook (revisited)
Parked again. Better as a guided course than a sandbox.

## O. Polyrhythm Garden (revisited)
Still parked. The music gap stays open; the best bet is a later "phase music" toy.
