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
  { id: 'woodcut', look: { f: "'Spectral',serif", bg: "linear-gradient(160deg,#f3ead8,#e4d6bb)", ink: "#2a1f14", ac: "#b5322a" }, k: 'print printmaking linocut picasso carving ink colour', em: '🪵', t: 'Reduction Woodcut', round: 4, time: 'rabbit-hole', diff: 2, tags: ['art', 'history', 'build', 'pretty', 'quick'],
    d: 'One block, every colour. Carve, ink, pull, then carve the same block again; every cut is forever. Then the hidden second game: clients want colours you do not own, so you plan which glazes stack on which shapes to make six colours from three pulls, with paper friskets that make the edition drift.' },
  { id: 'lock-flight', look: { f: "'Rye',serif", bg: "linear-gradient(160deg,#1f4a35,#16382a)", ink: "#f3e7c9", ac: "#d4473a" }, k: 'canal mania lock locks boat tunnel aqueduct reservoir water engineering 1790s build route', em: '⛴️', t: 'Canal Mania', round: 4, time: 'rabbit-hole', diff: 2, tags: ['earth', 'simulation', 'economics', 'history', 'build', 'strategy'],
    d: 'Dig a canal across the hills: climb with locks, tunnel through, or bridge the valley. Every boat drains a lockful from the summit, so feed it with reservoirs before the drought. Ten years of traffic decide your dividend.' },
  { id: 'contraption', look: { f: "'Libre Baskerville',serif", bg: "linear-gradient(160deg,#efe3c6,#d9c39a)", ink: "#2d2014", ac: "#9a5a1c" }, k: 'physics machine egg drop contraption braking springs hammock balloon gentle rube goldberg planck box2d', em: '🥚', t: 'The Gentle Machine', round: 4, time: 'rabbit-hole', diff: 2, tags: ['physics', 'build', 'sandbox', 'emergence', 'pretty'],
    d: 'Build a little machine of planks, cushions, hammocks and balloons that brings a falling egg to rest so softly its shell never cracks, and it has to work in ten slightly different tomorrows. Then a goose egg, a soap bubble, a pocket watch, a jelly…' },
  { id: 'coaster', look: { f: "'Limelight',serif", bg: "linear-gradient(160deg,#1d3557,#14273f)", ink: "#eef3f8", ac: "#e63946" }, k: 'roller coaster ride track loop clothoid g-force physics design engineer theme park', em: '🎢', t: 'Coaster', round: 4, time: 'rabbit-hole', diff: 2, tags: ['physics', 'simulation', 'build', 'sandbox', 'strategy'],
    d: 'Draw a roller coaster on the drafting table and send a train round it. Real energy, real g-forces: circle loops crush riders, so learn the teardrop. Six commissions, a daily site, and a cost histogram to beat.' },
  { id: 'island', look: { f: "Lora,serif", bg: "linear-gradient(160deg,#f5eedb,#e6dcc0)", ink: "#4a3a28", ac: "#6f9a4f" }, k: 'ecosystem ecology food web predator prey wolves yellowstone trophic cascade lotka volterra rabbits foxes island', em: '🦊', t: "Naturalist's Island", round: 4, time: 'rabbit-hole', diff: 2, tags: ['life', 'simulation', 'emergence', 'strategy', 'pretty'],
    d: 'Release rabbits, bees, fungi, foxes, owls and wolves onto a little island and watch a food web emerge: booms, crashes, goats eating everything, wolves bringing the riverside woods back. Seven naturalist\'s commissions and a daily island.' },
  // round 3
  { id: 'watershed', look: { f: "'Barlow Condensed',sans-serif", bg: "linear-gradient(160deg,#e9e4d6,#d6cdb6)", ink: "#2b2a24", ac: "#2f6f8f" }, k: 'erosion river rain terrain canyon delta 3d', em: '💧', t: 'Watershed', round: 3, time: '20-min', diff: 1, tags: ['earth', 'physics', 'simulation', 'pretty', 'sandbox'],
    d: 'A plaster relief model of a river basin and a century of storms. Place fields, levees, dams and forests; every flood ends in an inquest. Levees that save one town drown the next, and dams starve the delta.' },
  { id: 'gridlock', look: { f: "'Barlow Condensed',sans-serif", bg: "linear-gradient(160deg,#f4f1e8,#e6e0cf)", ink: "#1d1d1b", ac: "#e0662a" }, k: 'traffic roads braess pigou tolls congestion bus mohring wardrop city rules', em: '🚦', t: 'Gridlock', round: 3, time: 'rabbit-hole', diff: 2, tags: ['maths', 'economics', 'emergence', 'wait-what', 'strategy'],
    d: 'You can\'t build roads, only rules. Drop toll booths, barriers, signals and bus lanes on a growing city, bet on where couriers, office staff and students will settle, and discover Braess, Pigou and the bus death spiral in your own streets.' },
  { id: 'ruin', look: { f: "'IM Fell English',serif", bg: "linear-gradient(160deg,#4a2e19,#1d1108)", ink: "#f1e5c8", ac: "#8e1f17" }, k: 'insurance lloyds ships underwriting kelly ruin risk correlation 1690s', em: '⚓', t: 'Underwriter', round: 3, time: 'rabbit-hole', diff: 2, tags: ['economics', 'history', 'maths', 'simulation'],
    d: "Lloyd's coffee-house, 1688. Sign your name under merchant voyages, haggle the rate, and lay off risk on rivals. One storm in the Channel sinks a dozen of your ships at once, and the average is not your life." },
  { id: 'snowfall', look: { f: "'Cormorant Garamond',serif", bg: "linear-gradient(160deg,#0d0f14,#1a1d26)", ink: "#e8eef5", ac: "#9fc3e6" }, k: 'snowflake ice crystal snow winter', em: '❄️', t: 'Snowfall', round: 3, time: '20-min', diff: 1, tags: ['physics', 'art', 'emergence', 'simulation', 'pretty', 'sandbox'],
    d: 'Wilson Bentley\'s darkroom. Grow crystals in a cold chamber to learn the Nakaya diagram, then work forensically: rebuild the cloud layers a flake fell through, with a weather balloon for every guess.' },
  { id: 'low-reynolds', look: { f: "'Share Tech Mono',monospace", bg: "linear-gradient(160deg,#c9cdc5,#a9aea4)", ink: "#1c211d", ac: "#3d6b52" }, k: 'bacteria microbe swimming scallop purcell', em: '🔬', t: 'Low Reynolds', round: 3, time: '20-min', diff: 3, tags: ['physics', 'life', 'maths', 'wait-what', 'brain-burner'],
    d: 'Life as a microbe, where water is honey and coasting is impossible. Swim as Purcell\'s three-hinge swimmer, an E. coli that must decide when to tumble toward food, and a sperm cell towing cargo, in fluids that change the rules.' },
  { id: 'floatees', look: { f: "'Special Elite',monospace", bg: "linear-gradient(160deg,#e9dcc0,#d9c6a0)", ink: "#26303b", ac: "#d9a400" }, k: 'ducks ocean currents globe rubber duck sea', em: '🦆', t: 'Floatees', round: 3, time: '20-min', diff: 1, tags: ['earth', 'physics', 'simulation', 'history', 'pretty', 'sandbox'],
    d: '28,800 bath toys fell into the Pacific in 1992. Drop ducks on a 3D globe whose currents come from real ocean physics, then work backwards from beach sightings to find where a spill happened.' },
  { id: 'chladni', look: { f: "'Cormorant Garamond',serif", bg: "linear-gradient(160deg,#3a2a17,#271b0e)", ink: "#f1dfb6", ac: "#d6a648" }, k: 'vibration sand plate resonance sound', em: '〰️', t: 'Chladni', round: 3, time: '20-min', diff: 1, tags: ['light-sound', 'physics', 'art', 'pretty', 'sandbox'],
    d: 'Chladni\'s 1787 workshop: bow a sand-covered brass plate and the sand dances onto its nodal lines. Separate twin figures with a finger and the bow, then scrape a plate to tune it like a violin maker.' },
  { id: 'polarizer', look: { f: "'Share Tech Mono',monospace", bg: "linear-gradient(160deg,#16181b,#0b0c0e)", ink: "#d7dde3", ac: "#ff3b2f" }, k: 'quantum photon light polarisation bomb', em: '💡', t: 'Polarizer', round: 3, time: '20-min', diff: 2, tags: ['physics', 'light-sound', 'wait-what', 'quick'],
    d: 'A black optics breadboard with clicking detectors. A third filter lets more light through, a single photon interferes with itself, and you sort a crate of live and dud bombs without setting one off.' },
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
    d: 'Newton\'s darkened room, then an instrument-maker\'s order book. Clients order instruments by specification (a 3× upright reducer, a white-light burning glass, two spectral lines parted), and you meet them with real glass, real dispersion and every photon counted. Seal a design to light the lamp only once, for double pay.' },
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
  { id: 'alembic', look: { f: "'EB Garamond',serif", bg: "linear-gradient(160deg,#eadcbc,#d9c79f)", ink: "#2a1d12", ac: "#b0301c" }, k: 'falling sand alchemy elements powder reactions chemistry fire water lava glass sandbox', em: '⚗️', t: 'Alembic', round: 1, time: 'rabbit-hole', diff: 1, tags: ['physics', 'emergence', 'sandbox', 'build', 'pretty'],
    d: 'A falling-sand alchemist\'s tray. Start with sand, water, fire and earth; pour, and every new substance that appears joins your shelf: steam, glass, obsidian, rust, fool\'s gold… 43 to find, 22 commissions, a daily tray.' },
  { id: 'ant-mind', look: { f: "'Patrick Hand',cursive", bg: "linear-gradient(160deg,#4a3420,#33230f)", ink: "#f0dfb8", ac: "#c7e36b" }, k: 'ants colony pheromones insects', em: '🐜', t: 'Ant Mind', round: 1, time: 'rabbit-hole', diff: 2, tags: ['life', 'emergence', 'simulation', 'strategy'],
    d: 'Write the five-line instinct card every ant obeys, then debug the society it makes: trails, ant mills that spiral to death, mass raids on spiders, winter huddles. Eleven chambers break your card in new ways; Colony Years brings a new seed every day.' },
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
