// The catalogue of every experiment: used by the hub (cards, filters, search) and by
// the "more like this" link that common.js adds next to each page's home link.
// time: '5-min' | '20-min' | 'rabbit-hole'; diff: 1 gentle, 2 tricky, 3 fiendish; round: when it was built.
const RH_CATS = [
  { id: 'logic', name: 'Logic & Codes', em: '🧩', hue: 265, blurb: 'Deduce, decode and build machines that think.' },
  { id: 'emergence', name: 'Emergence & Networks', em: '🕸️', hue: 320, blurb: 'Simple rules, many actors, surprising crowds.' },
  { id: 'space', name: 'Space & Forces', em: '🪐', hue: 215, blurb: 'Gravity, rotation and the shape of space.' },
  { id: 'waves', name: 'Light, Sound & Waves', em: '🌈', hue: 45, blurb: 'Interference, resonance and colour.' },
  { id: 'life', name: 'Living Things', em: '🌱', hue: 130, blurb: 'Molecules, microbes and colonies.' },
  { id: 'earth', name: 'Earth & Water', em: '🌊', hue: 190, blurb: 'Rivers, oceans and the water budget.' },
  { id: 'history', name: 'History & Craft', em: '🏺', hue: 25, blurb: 'Maps, markets, registers and printing blocks.' },
];
const RH_TAGS = {
  topic: ['computing', 'language', 'cryptography', 'maths', 'probability', 'networks', 'cellular automata', 'physics', 'geometry', 'music', 'biology', 'fluids', 'maps', 'trade', 'art', 'real history'],
  style: ['puzzle levels', 'sandbox', 'simulation', 'deduction', 'making', 'management'],
  time: ['5-min', '20-min', 'rabbit-hole'],
};
const RH_CATALOG = [
  // round 4
  { id: 'woodcut', em: '🪵', t: 'Reduction Woodcut', cat: 'history', round: 4, time: '20-min', diff: 2, tags: ['art', 'making', 'puzzle levels', 'real history'],
    d: 'One block, every colour. Carve, ink, pull a print, then carve the same block again. Every cut is forever. Match the commission in twenty prints.' },
  { id: 'lock-flight', em: '⛴️', t: 'Lock Flight', cat: 'earth', round: 4, time: 'rabbit-hole', diff: 2, tags: ['fluids', 'management', 'puzzle levels', 'real history'],
    d: 'Every boat through a lock sends a lockful of water downhill. Run flights, staircases and side ponds up to Panama before the summit runs dry.' },
  { id: 'belt-trick', em: '🎀', t: 'Belt Trick', cat: 'space', round: 4, time: '20-min', diff: 2, tags: ['geometry', 'maths', 'physics', 'puzzle levels'],
    d: 'Turn a cube tied to the walls by ribbons. After 360° the tangle is stuck forever; after 720° it falls free. Puzzles, bets and machines built on spinors.' },
  { id: 'swarm', em: '🐝', t: 'Swarm Season', cat: 'life', round: 4, time: 'rabbit-hole', diff: 2, tags: ['biology', 'management', 'simulation', 'real history'],
    d: 'Keep a 1914 New Zealand hive through spring. Pull frames and read the comb cell by cell: eggs, queen cells, mites. Stop the swarm, beat the varroa, make it through winter.' },
  // round 3
  { id: 'watershed', em: '💧', t: 'Watershed', cat: 'earth', round: 3, time: '20-min', diff: 1, tags: ['fluids', 'sandbox', 'simulation', 'physics'],
    d: 'A 3D landscape with real hydraulic erosion. Place springs and summon rain, then watch rivers carve canyons, build deltas and drown villages.' },
  { id: 'gridlock', em: '🚦', t: 'Gridlock', cat: 'emergence', round: 3, time: '20-min', diff: 2, tags: ['networks', 'maths', 'puzzle levels'],
    d: 'Selfish drivers, real equilibrium traffic. Adding a road can make everyone slower. Close roads and set tolls to fix eleven cities.' },
  { id: 'ruin', em: '🎲', t: 'Ruin', cat: 'emergence', round: 3, time: '20-min', diff: 1, tags: ['probability', 'maths', 'simulation'],
    d: 'A coin game that pays +5% on average and still bankrupts almost everyone. A thousand glowing fortunes, the Kelly bet, pooling, Shannon\'s demon and the martingale.' },
  { id: 'snowfall', em: '❄️', t: 'Snowfall', cat: 'emergence', round: 3, time: '20-min', diff: 1, tags: ['cellular automata', 'physics', 'sandbox', 'art'],
    d: 'Grow real snow crystals with Reiter\'s hexagonal model. Steer the cloud as the flake falls, collect every form, and reproduce flakes exactly.' },
  { id: 'low-reynolds', em: '🔬', t: 'Low Reynolds', cat: 'life', round: 3, time: '20-min', diff: 3, tags: ['biology', 'fluids', 'physics', 'geometry', 'puzzle levels'],
    d: 'Swim like a bacterium, where water is honey and coasting is impossible. Draw strokes in shape space and discover the scallop theorem and the geometric phase.' },
  { id: 'floatees', em: '🦆', t: 'Floatees', cat: 'earth', round: 3, time: '20-min', diff: 1, tags: ['fluids', 'maps', 'simulation', 'physics', 'real history'],
    d: '28,800 bath toys fell into the Pacific in 1992. Drop ducks on a 3D globe whose currents come from real ocean physics, then stop the Earth spinning and watch the Gulf Stream vanish.' },
  { id: 'chladni', em: '〰️', t: 'Chladni', cat: 'waves', round: 3, time: '20-min', diff: 1, tags: ['music', 'physics', 'sandbox', 'art'],
    d: 'Bow a sand-covered brass plate and sweep the pitch. At each resonance the sand dances onto the nodal lines. Collect figures across three plates and match targets by ear.' },
  { id: 'polarizer', em: '💡', t: 'Polarizer', cat: 'waves', round: 3, time: '20-min', diff: 2, tags: ['physics', 'probability', 'puzzle levels'],
    d: 'Quantum optics on a lab bench. A third filter lets more light through, a single photon interferes with itself, and you can detect a bomb without touching it.' },
  // round 2
  { id: 'vault', em: '🔐', t: 'The Vault', cat: 'logic', round: 2, time: 'rabbit-hole', diff: 2, tags: ['cryptography', 'language', 'deduction', 'puzzle levels', 'real history'],
    d: 'Vaults locked by real historical ciphers, from Caesar to reused Soviet one-time pads. Break them with the analyst\'s tools.' },
  { id: 'hypothesis', em: '⚗️', t: 'Hypothesis', cat: 'logic', round: 2, time: '20-min', diff: 2, tags: ['deduction', 'puzzle levels'],
    d: 'A machine accepts some rows of shapes and rejects others. Run experiments, form a theory, and stake your reputation on eight predictions. Sixty hidden laws.' },
  { id: 'escapement', em: '⚙️', t: 'Escapement', cat: 'logic', round: 2, time: 'rabbit-hole', diff: 3, tags: ['maths', 'making', 'puzzle levels', 'real history'],
    d: 'Cut gears to build a clock, then a calendar, then an orrery that keeps pace with the planets. It ends with the Antikythera mechanism.' },
  { id: 'parish', em: '⛪', t: 'Parish', cat: 'history', round: 2, time: 'rabbit-hole', diff: 3, tags: ['deduction', 'language', 'real history'],
    d: 'A century of baptisms, marriages and burials in a simulated village. Descendants write to you. Trace their ancestors through misspelt names, reused names and a clerk who abbreviated everything.' },
  { id: 'temperament', em: '🎹', t: 'Temperament', cat: 'waves', round: 2, time: '20-min', diff: 3, tags: ['music', 'maths', 'puzzle levels', 'real history'],
    d: 'Twelve notes, and the intervals between them can never all be pure. Tune a keyboard by ear, from Pythagoras\' wolf to Bach\'s well-tempered clavier.' },
  { id: 'opticks', em: '🔦', t: 'Opticks', cat: 'waves', round: 2, time: 'rabbit-hole', diff: 2, tags: ['physics', 'geometry', 'making', 'puzzle levels', 'real history'],
    d: 'Mirrors, prisms and lenses on an optical bench with real refraction and dispersion. Split sunlight like Newton, build telescopes, then cancel chromatic aberration.' },
  // round 1
  { id: 'nand', em: '🔌', t: 'NAND to Everything', cat: 'logic', round: 1, time: 'rabbit-hole', diff: 3, tags: ['computing', 'making', 'puzzle levels'],
    d: 'You get one logic gate. Build a computer out of it, then write programs for the CPU you built.' },
  { id: 'first-contact', em: '📡', t: 'First Contact', cat: 'logic', round: 1, time: 'rabbit-hole', diff: 3, tags: ['language', 'cryptography', 'deduction'],
    d: 'A signal arrives from 41 light-years away. Decode a language no human has seen; every save is a different alien species.' },
  { id: 'rule-hunter', em: '🦠', t: 'Rule Hunter', cat: 'emergence', round: 1, time: 'rabbit-hole', diff: 1, tags: ['cellular automata', 'sandbox', 'computing'],
    d: 'There are 262,144 Life-like universes. Explore them as a naturalist, catching the creatures that live in each.' },
  { id: 'universe-seed', em: '🌌', t: 'Universe Seed', cat: 'space', round: 1, time: 'rabbit-hole', diff: 1, tags: ['physics', 'simulation', 'management'],
    d: 'Start as the Big Bang and run until heat death. Then rewrite the constants of physics and see what grows.' },
  { id: 'slingshot', em: '🛰️', t: 'Slingshot', cat: 'space', round: 1, time: 'rabbit-hole', diff: 2, tags: ['physics', 'puzzle levels'],
    d: 'One probe, almost no fuel, real Newtonian gravity. Thread gravity assists through 40 star systems.' },
  { id: 'rumor', em: '🗣️', t: 'Rumor', cat: 'emergence', round: 1, time: '20-min', diff: 2, tags: ['networks', 'language', 'puzzle levels'],
    d: 'A town of strangers with friends, rivals and grudges. Whisper one lie and watch it change as it spreads.' },
  { id: 'ant-mind', em: '🐜', t: 'Ant Mind', cat: 'emergence', round: 1, time: '20-min', diff: 2, tags: ['biology', 'simulation', 'puzzle levels'],
    d: 'You aren\'t an ant. You\'re the scent. Steer a whole colony by painting pheromones.' },
  { id: 'mapmaker', em: '🧭', t: 'Mapmaker of Lost Islands', cat: 'history', round: 1, time: 'rabbit-hole', diff: 2, tags: ['maps', 'geometry', 'deduction', 'real history'],
    d: 'It\'s 1680. Sail into fog and draw the coastline yourself. Sailors will trust your map with their lives.' },
  { id: 'caravan', em: '🐫', t: 'Caravan', cat: 'history', round: 1, time: 'rabbit-hole', diff: 2, tags: ['trade', 'management', 'maps', 'real history'],
    d: 'Silk Road trading where information is the real currency. Every price you know is already out of date.' },
  { id: 'fold', em: '🧬', t: 'Fold', cat: 'life', round: 1, time: '20-min', diff: 2, tags: ['biology', 'geometry', 'puzzle levels'],
    d: 'Proteins are tiny origami machines. Fold chains by hand and try to match what supercomputers found.' },
];
// Similarity: shared tags, same category, similar length; returns best matches with a reason.
function RH_similar(id, n = 3) {
  const a = RH_CATALOG.find(x => x.id === id); if (!a) return [];
  return RH_CATALOG.filter(b => b.id !== id).map(b => {
    const shared = b.tags.filter(t => a.tags.includes(t) && t !== 'puzzle levels');
    const s = shared.length * 2 + (b.cat === a.cat ? 2.5 : 0) + (b.time === a.time ? .5 : 0) + (b.tags.includes('puzzle levels') && a.tags.includes('puzzle levels') ? .5 : 0);
    const why = shared.length ? 'Also about ' + shared.slice(0, 2).join(' & ') : b.cat === a.cat ? 'Also in ' + RH_CATS.find(c => c.id === a.cat).name : 'Another ' + b.time + ' ' + (b.tags.find(t => RH_TAGS.style.includes(t)) || 'experiment');
    return { ...b, s, why };
  }).sort((x, y) => y.s - x.s).slice(0, n);
}
