// The catalogue of every experiment: used by the hub (tag rows, filters, search) and by
// the "more like this" link that common.js adds next to each page's home link.
// Everything is organised by tags (an experiment has several). time: '20-min' | 'rabbit-hole'; diff: 1 gentle, 2 tricky, 3 fiendish.
const RH_TAGLIST = [
  { id: 'wait-what', name: 'Wait, what?', em: '🤯', hue: 330, blurb: 'Results your intuition gets wrong.' },
  { id: 'pretty', name: 'Pretty to watch', em: '✨', hue: 200, blurb: 'Worth opening just to look at.' },
  { id: 'build', name: 'Build a machine', em: '🛠️', hue: 35, blurb: 'Make something that works, part by part.' },
  { id: 'detective', name: 'Detective work', em: '🔎', hue: 265, blurb: 'Gather clues, form a theory, prove it.' },
  { id: 'emergence', name: 'Emergence', em: '🕸️', hue: 300, blurb: 'Simple rules, many actors, surprising crowds.' },
  { id: 'physics', name: 'Physics toys', em: '🧲', hue: 210, blurb: 'Real equations you can poke.' },
  { id: 'history', name: 'Real history', em: '📜', hue: 30, blurb: 'Built on real people, places and documents.' },
  { id: 'life', name: 'Living things', em: '🌱', hue: 120, blurb: 'Molecules, microbes, colonies.' },
  { id: 'water', name: 'Water', em: '💧', hue: 190, blurb: 'Rivers, oceans, canals and honey-thick water.' },
  { id: 'light-sound', name: 'Light & sound', em: '🌈', hue: 50, blurb: 'Interference, resonance, colour and tuning.' },
  { id: 'maths', name: 'Maths in disguise', em: '➗', hue: 160, blurb: 'Theorems you discover with your hands.' },
  { id: 'cosmic', name: 'Cosmic', em: '🪐', hue: 240, blurb: 'Gravity, rotation, signals from the stars.' },
  { id: 'strategy', name: 'Strategy & management', em: '♟️', hue: 15, blurb: 'Balance resources over a long game.' },
  { id: 'sandbox', name: 'Chill sandbox', em: '🏖️', hue: 175, blurb: 'No pressure: play and see what happens.' },
  { id: 'quick', name: 'Quick hits', em: '⚡', hue: 55, blurb: 'A satisfying session in about 20 minutes.' },
  { id: 'brain-burner', name: 'Brain-burners', em: '🔥', hue: 5, blurb: 'Hard. Bring coffee.' },
];
const RH_CATALOG = [
  // round 4
  { id: 'woodcut', k: 'print printmaking linocut picasso carving ink colour', em: '🪵', t: 'Reduction Woodcut', round: 4, time: '20-min', diff: 2, tags: ['build', 'history', 'pretty', 'quick'],
    d: 'One block, every colour. Carve, ink, pull a print, then carve the same block again. Every cut is forever. Match the commission in twenty prints.' },
  { id: 'lock-flight', k: 'canal boat lock panama locks water budget', em: '⛴️', t: 'Lock Flight', round: 4, time: 'rabbit-hole', diff: 2, tags: ['water', 'strategy', 'history', 'wait-what'],
    d: 'Every boat through a lock sends a lockful of water downhill. Run flights, staircases and side ponds up to Panama before the summit runs dry.' },
  { id: 'belt-trick', k: 'spinor quaternion rotation dirac plate trick ribbon', em: '🎀', t: 'Belt Trick', round: 4, time: '20-min', diff: 2, tags: ['wait-what', 'maths', 'physics', 'quick'],
    d: 'Turn a cube tied to the walls by ribbons. After 360° the tangle is stuck forever; after 720° it falls free. Puzzles, bets and machines built on spinors.' },
  { id: 'swarm', k: 'bee bees beekeeping honey hive varroa queen', em: '🐝', t: 'Swarm Season', round: 4, time: 'rabbit-hole', diff: 2, tags: ['life', 'strategy', 'history', 'detective'],
    d: 'Keep a 1914 New Zealand hive through spring. Pull frames and read the comb cell by cell: eggs, queen cells, mites. Stop the swarm, beat the varroa, make it through winter.' },
  // round 3
  { id: 'watershed', k: 'erosion river rain terrain canyon delta 3d', em: '💧', t: 'Watershed', round: 3, time: '20-min', diff: 1, tags: ['water', 'pretty', 'sandbox', 'physics'],
    d: 'A 3D landscape with real hydraulic erosion. Place springs and summon rain, then watch rivers carve canyons, build deltas and drown villages.' },
  { id: 'gridlock', k: 'traffic roads braess cars city tolls', em: '🚦', t: 'Gridlock', round: 3, time: '20-min', diff: 2, tags: ['wait-what', 'maths', 'emergence', 'quick'],
    d: 'Selfish drivers, real equilibrium traffic. Adding a road can make everyone slower. Close roads and set tolls to fix eleven cities.' },
  { id: 'ruin', k: 'gambling coin bet kelly ergodicity money', em: '🎲', t: 'Ruin', round: 3, time: '20-min', diff: 1, tags: ['wait-what', 'maths', 'quick'],
    d: 'A coin game that pays +5% on average and still bankrupts almost everyone. A thousand glowing fortunes, the Kelly bet, pooling, Shannon\'s demon and the martingale.' },
  { id: 'snowfall', k: 'snowflake ice crystal snow winter', em: '❄️', t: 'Snowfall', round: 3, time: '20-min', diff: 1, tags: ['pretty', 'physics', 'sandbox', 'emergence'],
    d: 'Grow real snow crystals with Reiter\'s hexagonal model. Steer the cloud as the flake falls, collect every form, and reproduce flakes exactly.' },
  { id: 'low-reynolds', k: 'bacteria microbe swimming scallop purcell', em: '🔬', t: 'Low Reynolds', round: 3, time: '20-min', diff: 3, tags: ['wait-what', 'life', 'water', 'physics', 'brain-burner'],
    d: 'Swim like a bacterium, where water is honey and coasting is impossible. Draw strokes in shape space and discover the scallop theorem and the geometric phase.' },
  { id: 'floatees', k: 'ducks ocean currents globe rubber duck sea', em: '🦆', t: 'Floatees', round: 3, time: '20-min', diff: 1, tags: ['water', 'pretty', 'sandbox', 'history', 'cosmic'],
    d: '28,800 bath toys fell into the Pacific in 1992. Drop ducks on a 3D globe whose currents come from real ocean physics, then stop the Earth spinning and watch the Gulf Stream vanish.' },
  { id: 'chladni', k: 'vibration sand plate resonance sound', em: '〰️', t: 'Chladni', round: 3, time: '20-min', diff: 1, tags: ['light-sound', 'pretty', 'sandbox', 'physics'],
    d: 'Bow a sand-covered brass plate and sweep the pitch. At each resonance the sand dances onto the nodal lines. Collect figures across three plates and match targets by ear.' },
  { id: 'polarizer', k: 'quantum photon light polarisation bomb', em: '💡', t: 'Polarizer', round: 3, time: '20-min', diff: 2, tags: ['wait-what', 'light-sound', 'physics', 'quick'],
    d: 'Quantum optics on a lab bench. A third filter lets more light through, a single photon interferes with itself, and you can detect a bomb without touching it.' },
  // round 2
  { id: 'vault', k: 'cipher code codes enigma cryptography caesar vigenere spy', em: '🔐', t: 'The Vault', round: 2, time: 'rabbit-hole', diff: 2, tags: ['detective', 'history', 'brain-burner'],
    d: 'Vaults locked by real historical ciphers, from Caesar to reused Soviet one-time pads. Break them with the analyst\'s tools.' },
  { id: 'hypothesis', k: 'zendo rules induction science shapes', em: '⚗️', t: 'Hypothesis', round: 2, time: '20-min', diff: 2, tags: ['detective', 'quick', 'maths'],
    d: 'A machine accepts some rows of shapes and rejects others. Run experiments, form a theory, and stake your reputation on eight predictions. Sixty hidden laws.' },
  { id: 'escapement', k: 'clock gears watch orrery antikythera', em: '⚙️', t: 'Escapement', round: 2, time: 'rabbit-hole', diff: 3, tags: ['build', 'maths', 'history', 'brain-burner', 'cosmic'],
    d: 'Cut gears to build a clock, then a calendar, then an orrery that keeps pace with the planets. It ends with the Antikythera mechanism.' },
  { id: 'parish', k: 'genealogy family tree ancestors records', em: '⛪', t: 'Parish', round: 2, time: 'rabbit-hole', diff: 3, tags: ['detective', 'history', 'brain-burner'],
    d: 'A century of baptisms, marriages and burials in a simulated village. Descendants write to you. Trace their ancestors through misspelt names, reused names and a clerk who abbreviated everything.' },
  { id: 'temperament', k: 'music piano tuning harpsichord bach', em: '🎹', t: 'Temperament', round: 2, time: '20-min', diff: 3, tags: ['light-sound', 'maths', 'history', 'wait-what'],
    d: 'Twelve notes, and the intervals between them can never all be pure. Tune a keyboard by ear, from Pythagoras\' wolf to Bach\'s well-tempered clavier.' },
  { id: 'opticks', k: 'optics lenses prism newton mirror telescope', em: '🔦', t: 'Opticks', round: 2, time: 'rabbit-hole', diff: 2, tags: ['light-sound', 'build', 'physics', 'history'],
    d: 'Mirrors, prisms and lenses on an optical bench with real refraction and dispersion. Split sunlight like Newton, build telescopes, then cancel chromatic aberration.' },
  // round 1
  { id: 'nand', k: 'logic gates computer cpu circuits programming', em: '🔌', t: 'NAND to Everything', round: 1, time: 'rabbit-hole', diff: 3, tags: ['build', 'brain-burner'],
    d: 'You get one logic gate. Build a computer out of it, then write programs for the CPU you built.' },
  { id: 'first-contact', k: 'alien language signal seti decode', em: '📡', t: 'First Contact', round: 1, time: 'rabbit-hole', diff: 3, tags: ['detective', 'cosmic', 'brain-burner'],
    d: 'A signal arrives from 41 light-years away. Decode a language no human has seen; every save is a different alien species.' },
  { id: 'rule-hunter', k: 'game of life cellular automata conway', em: '🦠', t: 'Rule Hunter', round: 1, time: 'rabbit-hole', diff: 1, tags: ['emergence', 'sandbox', 'pretty'],
    d: 'There are 262,144 Life-like universes. Explore them as a naturalist, catching the creatures that live in each.' },
  { id: 'universe-seed', k: 'big bang cosmology incremental idle stars', em: '🌌', t: 'Universe Seed', round: 1, time: 'rabbit-hole', diff: 1, tags: ['cosmic', 'sandbox', 'strategy', 'physics'],
    d: 'Start as the Big Bang and run until heat death. Then rewrite the constants of physics and see what grows.' },
  { id: 'slingshot', k: 'gravity orbit space probe planets', em: '🛰️', t: 'Slingshot', round: 1, time: 'rabbit-hole', diff: 2, tags: ['cosmic', 'physics'],
    d: 'One probe, almost no fuel, real Newtonian gravity. Thread gravity assists through 40 star systems.' },
  { id: 'rumor', k: 'gossip social network lies town', em: '🗣️', t: 'Rumor', round: 1, time: '20-min', diff: 2, tags: ['emergence', 'quick'],
    d: 'A town of strangers with friends, rivals and grudges. Whisper one lie and watch it change as it spreads.' },
  { id: 'ant-mind', k: 'ants colony pheromones insects', em: '🐜', t: 'Ant Mind', round: 1, time: '20-min', diff: 2, tags: ['emergence', 'life', 'strategy'],
    d: 'You aren\'t an ant. You\'re the scent. Steer a whole colony by painting pheromones.' },
  { id: 'mapmaker', k: 'map sailing coastline islands navigation', em: '🧭', t: 'Mapmaker of Lost Islands', round: 1, time: 'rabbit-hole', diff: 2, tags: ['history', 'detective'],
    d: 'It\'s 1680. Sail into fog and draw the coastline yourself. Sailors will trust your map with their lives.' },
  { id: 'caravan', k: 'trade silk road merchant prices', em: '🐫', t: 'Caravan', round: 1, time: 'rabbit-hole', diff: 2, tags: ['strategy', 'history'],
    d: 'Silk Road trading where information is the real currency. Every price you know is already out of date.' },
  { id: 'fold', k: 'protein folding hp model biology', em: '🧬', t: 'Fold', round: 1, time: '20-min', diff: 2, tags: ['life', 'quick', 'maths'],
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
