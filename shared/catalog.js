// The catalogue of every experiment: used by the hub (tag rows, filters, search) and by
// the "more like this" link that common.js adds next to each page's home link.
// Everything is organised by tags (an experiment has several). time: '20-min' | 'rabbit-hole'; diff: 1 gentle, 2 tricky, 3 fiendish.
const RH_TAGLIST = [
  // subject: what it's about
  { id: 'physics', g: 'subject', name: 'Physics', em: '🧲', hue: 210, blurb: 'Real equations of motion, light and matter you can poke.' },
  { id: 'maths', g: 'subject', name: 'Maths', em: '➗', hue: 160, blurb: 'Theorems you discover with your hands.' },
  { id: 'simulation', g: 'subject', name: 'Simulation', em: '🧪', hue: 280, blurb: 'A living model runs; you nudge it and watch.' },
  { id: 'language', g: 'subject', name: 'Language & codes', em: '🔤', hue: 255, blurb: 'Ciphers, alien grammar, gossip and old handwriting.' },
  { id: 'art', g: 'subject', name: 'Art & craft', em: '🎨', hue: 340, blurb: 'Make something beautiful by understanding how it forms.' },
  { id: 'life', g: 'subject', name: 'Biology', em: '🌱', hue: 120, blurb: 'Molecules, microbes, colonies.' },
  { id: 'logic', g: 'subject', name: 'Logic & computing', em: '🧠', hue: 230, blurb: 'Gates, rules and machines that reason.' },
  { id: 'emergence', g: 'subject', name: 'Emergence', em: '🕸️', hue: 300, blurb: 'Simple rules, many actors, surprising crowds.' },
  { id: 'earth', g: 'subject', name: 'Earth & water', em: '🌊', hue: 190, blurb: 'Rivers, oceans, canals and coastlines.' },
  { id: 'cosmic', g: 'subject', name: 'Space', em: '🪐', hue: 240, blurb: 'Gravity, rotation, signals from the stars.' },
  { id: 'light-sound', g: 'subject', name: 'Light & sound', em: '🌈', hue: 50, blurb: 'Interference, resonance, colour and tuning.' },
  { id: 'economics', g: 'subject', name: 'Money & trade', em: '💰', hue: 45, blurb: 'Markets, bets, tolls and budgets.' },
  { id: 'history', g: 'subject', name: 'Real history', em: '📜', hue: 30, blurb: 'Built on real people, places and documents.' },
  // vibe: what it feels like to play
  { id: 'wait-what', g: 'vibe', name: 'Wait, what?', em: '🤯', hue: 330, blurb: 'Results your intuition gets wrong.' },
  { id: 'pretty', g: 'vibe', name: 'Pretty to watch', em: '✨', hue: 200, blurb: 'Worth opening just to look at.' },
  { id: 'build', g: 'vibe', name: 'Build a machine', em: '🛠️', hue: 35, blurb: 'Make something that works, part by part.' },
  { id: 'detective', g: 'vibe', name: 'Detective work', em: '🔎', hue: 265, blurb: 'Gather clues, form a theory, prove it.' },
  { id: 'strategy', g: 'vibe', name: 'Strategy', em: '♟️', hue: 15, blurb: 'Balance resources over a long game.' },
  { id: 'sandbox', g: 'vibe', name: 'Chill sandbox', em: '🏖️', hue: 175, blurb: 'No pressure: play and see what happens.' },
  { id: 'quick', g: 'vibe', name: 'Quick hits', em: '⚡', hue: 55, blurb: 'A satisfying session in about 20 minutes.' },
  { id: 'brain-burner', g: 'vibe', name: 'Brain-burners', em: '🔥', hue: 5, blurb: 'Hard. Bring coffee.' },
];
const RH_CATALOG = [
  // round 4
  { id: 'woodcut', look: { f: "'Spectral',serif", bg: "linear-gradient(160deg,#f3ead8,#e4d6bb)", ink: "#2a1f14", ac: "#b5322a" }, k: 'print printmaking linocut picasso carving ink colour', em: '🪵', t: 'Reduction Woodcut', round: 4, time: '20-min', diff: 2, tags: ['art', 'history', 'build', 'pretty', 'quick'],
    d: 'One block, every colour. Carve, ink, pull a print, then carve the same block again. Every cut is forever. Match the commission in twenty prints.' },
  { id: 'lock-flight', look: { f: "'Rye',serif", bg: "linear-gradient(160deg,#1f4a35,#16382a)", ink: "#f3e7c9", ac: "#d4473a" }, k: 'canal boat lock panama locks water budget', em: '⛴️', t: 'Lock Flight', round: 4, time: 'rabbit-hole', diff: 2, tags: ['earth', 'simulation', 'economics', 'history', 'strategy', 'wait-what'],
    d: 'Every boat through a lock sends a lockful of water downhill. Run flights, staircases and side ponds up to Panama before the summit runs dry.' },
  { id: 'belt-trick', look: { f: "'IM Fell English',serif", bg: "linear-gradient(160deg,#2c3a33,#1f2a25)", ink: "#e8eadf", ac: "#e9c46a" }, k: 'spinor quaternion rotation dirac plate trick ribbon', em: '🎀', t: 'Belt Trick', round: 4, time: '20-min', diff: 2, tags: ['maths', 'physics', 'wait-what', 'quick'],
    d: 'A lamp wired to the wall by a cable that can\'t be unplugged. Turn it once and no amount of swinging untwists the cable; turn it twice and one swing sets it free. Dirac\'s belt trick, done with your own hands.' },
  { id: 'swarm', look: { f: "'Old Standard TT',serif", bg: "linear-gradient(160deg,#efe4c8,#e0cfa6)", ink: "#2d2312", ac: "#a86b12" }, k: 'bee bees beekeeping honey hive varroa queen', em: '🐝', t: 'Swarm Season', round: 4, time: 'rabbit-hole', diff: 2, tags: ['life', 'simulation', 'history', 'strategy', 'detective'],
    d: 'Keep a 1914 New Zealand hive through spring. Pull frames and read the comb cell by cell: eggs, queen cells, mites. Stop the swarm, beat the varroa, make it through winter.' },
  // round 3
  { id: 'watershed', look: { f: "'Barlow Condensed',sans-serif", bg: "linear-gradient(160deg,#e9e4d6,#d6cdb6)", ink: "#2b2a24", ac: "#2f6f8f" }, k: 'erosion river rain terrain canyon delta 3d', em: '💧', t: 'Watershed', round: 3, time: '20-min', diff: 1, tags: ['earth', 'physics', 'simulation', 'pretty', 'sandbox'],
    d: 'A plaster relief model of a river basin and a century of storms. Place fields, levees, dams and forests; every flood ends in an inquest. Levees that save one town drown the next, and dams starve the delta.' },
  { id: 'gridlock', look: { f: "'Barlow Condensed',sans-serif", bg: "linear-gradient(160deg,#f4f1e8,#e6e0cf)", ink: "#1d1d1b", ac: "#e0662a" }, k: 'traffic roads braess cars city tolls', em: '🚦', t: 'Gridlock', round: 3, time: '20-min', diff: 2, tags: ['maths', 'economics', 'emergence', 'wait-what', 'quick'],
    d: 'A city-planning office and a paper map. Every road shows how traffic slows it, and adding a road can make everyone slower. Close roads, set tolls and spend a budget to fix ten cities.' },
  { id: 'ruin', look: { f: "'Poiret One',sans-serif", bg: "linear-gradient(160deg,#17402e,#0e2a1e)", ink: "#efe2b4", ac: "#d4af37" }, k: 'gambling coin bet kelly ergodicity money', em: '🎲', t: 'Ruin', round: 3, time: '20-min', diff: 1, tags: ['maths', 'economics', 'simulation', 'wait-what', 'quick'],
    d: 'An art-deco casino season. Each round the dealer offers a bet; you stake a share of your bankroll as a thousand parallel selves. Three rivals play the same cards, and one of them is secretly betting the Kelly fraction.' },
  { id: 'snowfall', look: { f: "'Cormorant Garamond',serif", bg: "linear-gradient(160deg,#0d0f14,#1a1d26)", ink: "#e8eef5", ac: "#9fc3e6" }, k: 'snowflake ice crystal snow winter', em: '❄️', t: 'Snowfall', round: 3, time: '20-min', diff: 1, tags: ['physics', 'art', 'emergence', 'simulation', 'pretty', 'sandbox'],
    d: 'Wilson Bentley\'s darkroom. Grow crystals in a cold chamber to learn the Nakaya diagram, then work forensically: rebuild the cloud layers a flake fell through, with a weather balloon for every guess.' },
  { id: 'low-reynolds', look: { f: "'Share Tech Mono',monospace", bg: "linear-gradient(160deg,#c9cdc5,#a9aea4)", ink: "#1c211d", ac: "#3d6b52" }, k: 'bacteria microbe swimming scallop purcell', em: '🔬', t: 'Low Reynolds', round: 3, time: '20-min', diff: 3, tags: ['physics', 'life', 'maths', 'wait-what', 'brain-burner'],
    d: 'Swim like a bacterium, where water is honey and coasting is impossible. Draw strokes in shape space and discover the scallop theorem and the geometric phase.' },
  { id: 'floatees', look: { f: "'Special Elite',monospace", bg: "linear-gradient(160deg,#e9dcc0,#d9c6a0)", ink: "#26303b", ac: "#d9a400" }, k: 'ducks ocean currents globe rubber duck sea', em: '🦆', t: 'Floatees', round: 3, time: '20-min', diff: 1, tags: ['earth', 'physics', 'simulation', 'history', 'pretty', 'sandbox'],
    d: '28,800 bath toys fell into the Pacific in 1992. Drop ducks on a 3D globe whose currents come from real ocean physics, then work backwards from beach sightings to find where a spill happened.' },
  { id: 'chladni', look: { f: "'Cormorant Garamond',serif", bg: "linear-gradient(160deg,#3a2a17,#271b0e)", ink: "#f1dfb6", ac: "#d6a648" }, k: 'vibration sand plate resonance sound', em: '〰️', t: 'Chladni', round: 3, time: '20-min', diff: 1, tags: ['light-sound', 'physics', 'art', 'pretty', 'sandbox'],
    d: 'Bow a sand-covered brass plate and sweep the pitch. At each resonance the sand dances onto the nodal lines. Collect figures across three plates and match targets by ear.' },
  { id: 'polarizer', look: { f: "'Share Tech Mono',monospace", bg: "linear-gradient(160deg,#16181b,#0b0c0e)", ink: "#d7dde3", ac: "#ff3b2f" }, k: 'quantum photon light polarisation bomb', em: '💡', t: 'Polarizer', round: 3, time: '20-min', diff: 2, tags: ['physics', 'light-sound', 'wait-what', 'quick'],
    d: 'Quantum optics on a lab bench. A third filter lets more light through, a single photon interferes with itself, and you can detect a bomb without touching it.' },
  // round 2
  { id: 'vault', look: { f: "'Special Elite',monospace", bg: "linear-gradient(160deg,#e6d3a3,#d2bc85)", ink: "#1e1a12", ac: "#b3261e" }, k: 'cipher code codes enigma cryptography caesar vigenere spy', em: '🔐', t: 'The Vault', round: 2, time: 'rabbit-hole', diff: 2, tags: ['language', 'logic', 'history', 'detective', 'brain-burner'],
    d: 'A Cold War code office. Break real historical ciphers, from Caesar to reused Soviet one-time pads, with tally sheets, crib-dragging and probable words, then decide what the intercepts mean.' },
  { id: 'hypothesis', look: { f: "'Rokkitt',serif", bg: "linear-gradient(160deg,#4a2f1a,#33200f)", ink: "#f1dfb0", ac: "#c9a34a" }, k: 'zendo rules induction science shapes', em: '⚗️', t: 'Hypothesis', round: 2, time: '20-min', diff: 2, tags: ['logic', 'maths', 'detective', 'quick'],
    d: 'A brass Victorian judging machine accepts some rows of shapes and rejects others. Run experiments, refute a rival\'s theory, and stake your reputation on what the hidden law is.' },
  { id: 'escapement', look: { f: "'Pinyon Script',cursive", bg: "linear-gradient(160deg,#1c3540,#12232b)", ink: "#efe3c2", ac: "#c9a34a" }, k: 'clock gears watch orrery antikythera', em: '⚙️', t: 'Escapement', round: 2, time: 'rabbit-hole', diff: 3, tags: ['maths', 'history', 'cosmic', 'build', 'brain-burner'],
    d: 'Cut gears to build a clock, then a calendar, then an orrery that keeps pace with the planets. It ends with the Antikythera mechanism.' },
  { id: 'parish', look: { f: "'IM Fell English',serif", bg: "linear-gradient(160deg,#e8dcc2,#d6c4a0)", ink: "#3a2a18", ac: "#7a1f1a" }, k: 'genealogy family tree ancestors records', em: '⛪', t: 'Parish', round: 2, time: 'rabbit-hole', diff: 3, tags: ['language', 'history', 'detective', 'brain-burner'],
    d: 'A century of baptisms, marriages and burials in a simulated village. Descendants write to you. Trace their ancestors through misspelt names, reused names and a clerk who abbreviated everything.' },
  { id: 'temperament', look: { f: "'Cormorant Garamond',serif", bg: "linear-gradient(160deg,#5a3a1e,#3e2712)", ink: "#f4e6c4", ac: "#d8b25a" }, k: 'music piano tuning harpsichord bach', em: '🎹', t: 'Temperament', round: 2, time: '20-min', diff: 3, tags: ['light-sound', 'maths', 'history', 'art', 'wait-what'],
    d: 'Twelve notes, and the intervals between them can never all be pure. Tune a keyboard by ear, from Pythagoras\' wolf to Bach\'s well-tempered clavier.' },
  { id: 'opticks', look: { f: "'IM Fell English',serif", bg: "linear-gradient(160deg,#121010,#050404)", ink: "#efe2c4", ac: "#ffd27a" }, k: 'optics lenses prism newton mirror telescope', em: '🔦', t: 'Opticks', round: 2, time: 'rabbit-hole', diff: 2, tags: ['physics', 'light-sound', 'history', 'build'],
    d: 'Mirrors, prisms and lenses on an optical bench with real refraction and dispersion. Split sunlight like Newton, build telescopes, then cancel chromatic aberration.' },
  // round 1
  { id: 'nand', look: { f: "'VT323',monospace", bg: "linear-gradient(160deg,#0f4a2c,#0a3520)", ink: "#e8f0dd", ac: "#e0a64a" }, k: 'logic gates computer cpu circuits programming', em: '🔌', t: 'NAND to Everything', round: 1, time: 'rabbit-hole', diff: 3, tags: ['logic', 'build', 'brain-burner'],
    d: 'You get one logic gate. Build gates, adders, registers and memory, then a CPU from your own chips, and watch your programs run clock by clock on the circuit you made.' },
  { id: 'first-contact', look: { f: "'VT323',monospace", bg: "linear-gradient(160deg,#101410,#060806)", ink: "#ffb84a", ac: "#7dff8a" }, k: 'alien language signal seti decode', em: '📡', t: 'First Contact', round: 1, time: 'rabbit-hole', diff: 3, tags: ['language', 'logic', 'cosmic', 'detective', 'brain-burner'],
    d: 'A signal arrives from 41 light-years away. Decode a language no human has seen; every save is a different alien species.' },
  { id: 'rule-hunter', look: { f: "'IM Fell English',serif", bg: "linear-gradient(160deg,#efe2c0,#dcc89c)", ink: "#3b2414", ac: "#b5361f" }, k: 'game of life cellular automata conway', em: '🦠', t: 'Rule Hunter', round: 1, time: 'rabbit-hole', diff: 1, tags: ['emergence', 'logic', 'simulation', 'art', 'pretty', 'sandbox'],
    d: 'A naturalist\'s petri dish holding 262,144 possible universes. Bet on what a rule will do before you run it, catalogue the creatures you find, and engineer spaceships for the bounties.' },
  { id: 'universe-seed', look: { f: "'Cormorant Garamond',serif", bg: "linear-gradient(160deg,#1a1440,#0b0920)", ink: "#f3e6c0", ac: "#d8b25a" }, k: 'big bang cosmology incremental idle stars', em: '🌌', t: 'Universe Seed', round: 1, time: 'rabbit-hole', diff: 1, tags: ['cosmic', 'physics', 'simulation', 'sandbox', 'strategy'],
    d: 'Set the six laws of physics, press Bang and watch the causal chain from baryogenesis to minds. Find out exactly which link your universe broke at, then solve challenges by changing as few laws as possible.' },
  { id: 'slingshot', look: { f: "'Share Tech Mono',monospace", bg: "linear-gradient(160deg,#0f2a4e,#0a1d38)", ink: "#cfe6ff", ac: "#ff8c2a" }, k: 'gravity orbit space probe planets', em: '🛰️', t: 'Slingshot', round: 1, time: 'rabbit-hole', diff: 2, tags: ['physics', 'cosmic', 'maths'],
    d: 'A 1977 JPL trajectory sheet. Planets orbit, fuel is scarce, and the only way to the outer planets is to steal momentum from the ones in between. Plan transfers, time flybys, and fly a Grand Tour.' },
  { id: 'rumor', look: { f: "'Old Standard TT',serif", bg: "linear-gradient(160deg,#efe9dc,#ddd5c2)", ink: "#141414", ac: "#b3261e" }, k: 'gossip social network lies town', em: '🗣️', t: 'Rumor', round: 1, time: '20-min', diff: 2, tags: ['language', 'emergence', 'simulation', 'quick'],
    d: 'A town of strangers with friends, rivals and grudges. Whisper one lie and watch it change as it spreads.' },
  { id: 'ant-mind', look: { f: "'Patrick Hand',cursive", bg: "linear-gradient(160deg,#4a3420,#33230f)", ink: "#f0dfb8", ac: "#c7e36b" }, k: 'ants colony pheromones insects', em: '🐜', t: 'Ant Mind', round: 1, time: '20-min', diff: 2, tags: ['life', 'emergence', 'simulation', 'strategy'],
    d: 'You don\'t steer ants, you tune the chemistry. Ants lay their own trails; you set strength, evaporation and wandering, then watch the colony discover the shortest bridge, or get trapped on yesterday\'s road.' },
  { id: 'mapmaker', look: { f: "'IM Fell English',serif", bg: "linear-gradient(160deg,#eadfc2,#d8c69b)", ink: "#2a2115", ac: "#3f7f6a" }, k: 'map sailing coastline islands navigation', em: '🧭', t: 'Mapmaker of Lost Islands', round: 1, time: 'rabbit-hole', diff: 2, tags: ['earth', 'history', 'art', 'detective'],
    d: 'It\'s 1680 and nobody knows where anything is. Chart islands by dead reckoning and bearings on your own landmarks, then sell sailing directions: merchants sail by your chart, and you pay for every reef you missed.' },
  { id: 'caravan', look: { f: "'Cormorant Garamond',serif", bg: "linear-gradient(160deg,#173a6b,#0f2850)", ink: "#f3e3b8", ac: "#e0b84a" }, k: 'trade silk road merchant prices', em: '🐫', t: 'Caravan', round: 1, time: 'rabbit-hole', diff: 2, tags: ['economics', 'history', 'strategy'],
    d: 'Silk Road trading where information is the real currency. Prices drift, rival houses corner markets, and news travels only as fast as camels. Every price you know is already out of date.' },
  { id: 'fold', look: { f: "'Courier Prime',monospace", bg: "linear-gradient(160deg,#f6f6f1,#e6e6dc)", ink: "#202020", ac: "#c0392b" }, k: 'protein folding hp model biology', em: '🧬', t: 'Fold', round: 1, time: '20-min', diff: 2, tags: ['life', 'maths', 'quick'],
    d: 'Proteins are tiny origami machines. Fold chains by hand and try to match what supercomputers found.' },
];
// Similarity: shared tags; returns best matches with a human reason.
function RH_similar(id, n = 3) {
  const a = RH_CATALOG.find(x => x.id === id); if (!a) return [];
  const name = t => RH_TAGLIST.find(g => g.id === t).name.toLowerCase();
  return RH_CATALOG.filter(b => b.id !== id).map(b => {
    const shared = b.tags.filter(t => a.tags.includes(t) && t !== 'quick');
    return { ...b, s: shared.length * 2 + (b.time === a.time ? .5 : 0) + (b.diff === a.diff ? .3 : 0), why: shared.length ? 'Also ' + shared.slice(0, 2).map(name).join(' · ') : 'A change of scene' };
  }).sort((x, y) => y.s - x.s).slice(0, n);
}
