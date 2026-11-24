# Art direction: every experiment is its own world

The rule: **no shared look.** Nothing should resemble a SaaS dashboard: no frosted-glass panels, no rounded pill buttons, no Inter or Space Grotesk, no dark-grey cards with an orange accent.

Each experiment's interface belongs to the world it simulates. Controls are objects from that world: a brass lever, a rubber stamp, a ledger column, a dial on a radio. The page should be recognisable from a thumbnail with the text blurred.

What to change in each game:
1. **Typography.** Pick 1–2 fonts from that world (Google Fonts is fine) and drop the default UI font.
2. **Palette and material.** Use the materials of that world: paper, brass, vellum, phosphor, soil, wax, lacquer. Use real textures drawn procedurally on canvas or with CSS gradients and noise, not flat fills.
3. **Chrome.** Restyle panels, buttons, sliders, lists, modals and toasts as objects from that world. Keep `shared/common.js` behaviour, but override `shared/common.css` per page (or stop using it).
4. **Sound character.** Give `FX.sfx` calls a matching voice: clicks become typewriter keys, relay clacks, quill scratches, bell chimes.
5. **One signature moment.** A single beautiful, world-specific animation for the big success (a wax seal pressed, a telegram unspooling, sand settling into a figure).
6. **Core loop.** What does the player do every 10 seconds? It must involve a decision and give a surprise or visible consequence. If the same action repeats more than about 5 times without anything new, add a twist, merge or cut levels, or automate the rote part and unlock it as a reward.

| Experiment | World | Type | Palette / materials | Chrome as objects |
|---|---|---|---|---|
| NAND to Everything | A 1970s hobbyist's breadboard and PCB | Silkscreen mono (IBM Plex Mono / VT323) | Green solder mask, copper traces, white silkscreen, black IC packages | Parts are DIP chips; wires are jumper leads with sag; the test runner is an oscilloscope trace; levels are a datasheet index |
| First Contact | A radio observatory at 3 a.m. | Dot-matrix and teletype (VT323, Courier Prime) | Fanfold green-bar paper with tractor holes, amber CRT, starfield | Transmissions print line by line on fanfold paper; the lexicon is a corkboard of index cards; confidence shown as pencil marks |
| Rule Hunter | A Victorian naturalist's microscope and field journal | Engraved serif (IM Fell, Cormorant), handwritten labels | Agar petri dish, sepia ink, specimen-label cream | The universe is a petri dish under a lens; the catalogue is a plate of pinned specimens with copperplate labels |
| Universe Seed | Cosmology itself: an expanding ink-wash nebula | Thin astronomical serif (Cormorant / Spectral) | Deep indigo, gold leaf, nebular gradients | Upgrades as constellations you connect; the timeline is a spiral of epochs |
| Slingshot | JPL mission planning, 1977 | Eurostile-like (Orbitron sparingly, Share Tech Mono) | Blueprint navy, cyan plot lines, orange trajectory pencil | Planning on plotter paper; fuel as a gauge needle; levels as mission patches |
| Rumor | A village told as a broadsheet and woodcut | Old newspaper (Old Standard TT, UnifrakturCook for the masthead) | Newsprint, black ink, one red for lies | Villagers as woodcut portraits; whispers as torn notes passed along; each day prints a gazette front page |
| Ant Mind | Underground cross-section of soil | Hand-lettered (Patrick Hand / Caveat) | Loam browns, root ochres, pheromone glow in chalky colour | Tools as scent vials; the colony stats are tallies scratched in the dirt |
| Mapmaker | A 1680 vellum chart table | IM Fell English | Vellum, iron-gall ink, verdigris, rhumb lines | Compass rose and dividers; journal entries in a ship's log; commissions sealed with wax |
| Caravan | A Silk Road merchant's ledger and caravanserai | Persian-inflected serif (Amiri / Cormorant Garamond) | Lapis, vermilion, gold, camel-hair paper | Prices on a merchant's abacus and ledger; letters with stale dates; a map in miniature-painting style |
| Fold | Kendrew's 1958 wire-and-ball molecular model | Lab typewriter (Courier Prime) | White lab bench, brass rods, coloured balls, graph paper | The chain is a physical model you bend at joints; the score is a lab notebook; benchmarks as journal citations |
| The Vault | Cold War cryptanalysis office (Bletchley to Arlington Hall) | Typewriter (Special Elite), stencilled stamps | Manila folders, carbon copies, red CLASSIFIED stamps, bakelite | Intercepts as teletype strips; tools as a rotor box, frequency tally sheets, a slide rule; solving stamps DECRYPTED |
| Hypothesis | A brass Victorian judging machine | Engraved / slab serif (Rokkitt, Playfair) | Brass, walnut, green baize, chalkboard | Rows of shapes slide down a chute into ACCEPT/REJECT brass trays; theory written in chalk |
| Escapement | A watchmaker's bench | Engraver's script and a technical drafting font | Brass, blued steel screws, ruby jewels, loupe vignette | Gears cut on a wheel-cutting engine; commissions as customer tickets; error in a micrometer readout |
| Parish | A rural parish register by candlelight | Secretary hand / copperplate (IM Fell, Pinyon Script for headings) | Rag paper, iron-gall ink fading to brown, leather, candle glow | Registers as bound volumes you leaf through; letters from descendants with stamps; tree built with pins and thread |
| Temperament | A harpsichord workshop | Baroque engraving (Cormorant Garamond SC) | Marquetry wood, gilded keys, black/ivory reversed keyboard, score paper | Tuning hammer and pins; beats as a wobbling candle flame or ripple; commissions on score paper |
| Opticks | Newton's darkened room, 1666 | Period serif (IM Fell) | Black room, single sunbeam through a shutter hole, dust motes, oak bench | Optics as glass objects on a wooden bench; targets as paper screens; results noted in a Latin notebook |
| Watershed | Relief-model diorama under studio light | Cartographic sans (Barlow Condensed) | Painted plaster terrain, water glints | HUD as a surveyor's clipboard |
| Gridlock | Transit-map minimalism (keep), but make it a city-planning office | DIN-like (Barlow) | Paper map, transit colours | Tolls as toll booths on the map; closures as orange barriers you drag on |
| Ruin | A smoky casino and a financial chart | Art-deco (Poiret One / Limelight) plus a ticker mono | Green felt, brass, ticker tape | Coin and chips physical; chapters as casino rooms |
| Snowfall | Wilson Bentley's 1885 photomicrographs | Spencerian or Victorian serif | Black velvet, glass plate, frost | Gallery as glass-plate negatives; the pad as a cloud chamber dial |
| Low Reynolds | A microscope slide | Lab mono | Phase-contrast greys, slide label, brownian noise | Shape-space pad as a microscope stage vernier |
| Floatees | A 1992 oceanographer's globe and drift-card reports | Typewriter plus nautical | Globe lacquer, beach-finder postcards | Duck sightings arrive as postcards |
| Chladni | Chladni's 1787 workshop: violin bow, brass plate | Classical serif (Cormorant) | Brass, rosin, sand | Pitch as a bow pressure / frequency dial on a brass instrument |
| Polarizer | A 1960s quantum optics lab | Lab-equipment labels (Share Tech Mono) | Black anodised breadboard with M6 holes, laser red | Optics as kinematic mounts on the breadboard; detectors click like Geiger counters |
| Reduction Woodcut | Printmaker's studio (keep) | — | Already themed: check the chrome is wood/paper, not glass | — |
| Lock Flight | Canal company signage and lockkeeper's cottage | Railway/canal sign lettering (Josefin Sans, Rye for signs) | Painted narrowboat roses and castles, black-and-white lock beams | Paddles and gates as windlass and beam; queues as a lockkeeper's log |
| Belt Trick | Physics demonstration lecture | Victorian lecture-poster serif | Chalkboard, felt ribbons, brass stand | Moves as chalk notation; bets as wagers on a slate |
| Swarm Season | 1914 NZ Beekeeper magazine (keep) | — | Already themed: check the chrome | — |
