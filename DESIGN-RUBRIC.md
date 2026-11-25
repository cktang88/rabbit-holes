# Browser games that hold players for hours: design rubric

Sources: Hacker News threads (via the HN Algolia API), designer interviews, postmortems and press. Reddit could not be fetched directly: reddit.com and its mirrors refused or returned 503. Reddit sentiment therefore comes through secondary coverage only and is not quoted.

## 1. Evidence: why people stayed

| Game | Why it held people | Player or designer words |
|---|---|---|
| **Universal Paperclips** | Each phase rewrites the interface; many small levers at once; a real ending | "There's so much to do. Work the quantum computer. Find best deal for wire. Train the machine. Fine tune pricing." [HN](https://news.ycombinator.com/item?id=36979100) · "It looks like something you can knock out on a quick break. It is not." [HN](https://news.ycombinator.com/item?id=33454590) · Lantz: "it's fun to make this number go up"; the game has "a very definitive conclusion" [IF50](https://if50.substack.com/p/2017-universal-paperclips) |
| **A Dark Room** | One button grows into a world; story and systems are revealed together | "hooked for about six or seven hours on gameplay alone, even without graphics or sound" [HN](https://news.ycombinator.com/item?id=5964104) · "After two times stoking the fire the room changes… a shivering stranger" [HN](https://news.ycombinator.com/item?id=5966051) |
| **Candy Box** | Starts almost empty; secrets that players pass to each other | "social component became actually-essential to progress" [Game Developer](https://gamedeveloper.com/design/why-i-candy-box-i-became-more-social-than-social-games-) |
| **Cookie Clicker** | Compounding growth; random golden cookies | Orteil: the appeal is "getting something done"; a player spent hours "waiting for the golden cookies to appear… my singular joy" [Vice](https://www.vice.com/en/article/cookie-clicker-wasnt-meant-to-be-fun-why-is-it-so-popular-8-years-later) |
| **Kittens Game** | Slow, deep economy with real trade-offs | "Numbers go up, but at what cost! (hundreds of hours)" [HN](https://news.ycombinator.com/item?id=33453779) |
| **Opus Magnum / Zachtronics** | Easy to solve, deep to optimise; histograms; GIFs of solutions | "Your solution is a subtly-unique creation that you can emotionally own." [HN](https://news.ycombinator.com/item?id=16574640) · "not a lot of challenge to just getting through a level… depth if you want to optimize" [HN](https://news.ycombinator.com/item?id=16572844) · Histograms are "so much smarter than a leaderboard" [PC Gamer](https://www.pcgamer.com/perfectly-solving-opus-magnums-puzzles-is-impossible-but-thats-ok) · GIFs were designed as seamless loops that "required little context" [Game Developer](https://gamedeveloper.com/design/how-zachtronics-makes-personality-filled-puzzlers-like-i-opus-magnum-i-) |
| **Factorio / shapez / Bitburner** | Scaling problems that feel like refactoring code | "Spaghetti bases will bite you just the same way as spaghetti code." [HN](https://news.ycombinator.com/item?id=16574869) · "First you are mainly thinking about how to create specific shapes, while in the end it's all about optimization" [HN](https://news.ycombinator.com/item?id=24686702) · Bitburner: rewriting your own spaghetti code "is so sublime… why some of us get so addicted" [HN](https://news.ycombinator.com/item?id=48320403) |
| **Line Rider** | A blank canvas, physics and a play button; creations are watched by others | Čadež: "I was mostly amazed by how much patience people have" [Game Developer](https://gamedeveloper.com/game-platforms/q-a-riding-the-lines-with-bostjan-cadez) · A Kottke writer didn't much like playing it but spent "a solid hour" watching other people's tracks [Kottke](https://kottke.org/06/10/line-rider) |
| **Fantastic Contraption** | Physics construction; every solution has its own URL | Northway: sharing solutions lets you "reward people for what they want to do"; he called it "pride-based marketing" [Game Developer](https://www.gamedeveloper.com/pc/gdc-austin-how-i-fantastic-contraption-i-became-a-fantastic-hit) |
| **Powder Toy / Sandspiel / Sandboxels** | Element interactions combine into emergent machines; a gallery of player creations | "Ended up spending so much time trying to build some basic electronics once I found out how to build logic gates" [HN](https://news.ycombinator.com/item?id=24416258) · "loved going through the gallery and seeing all the super elaborate stuff people built" [HN](https://news.ycombinator.com/item?id=24416538) |
| **Desktop Tower Defense** | The player builds the maze; every tower has a counter | Preece: "as long a learning curve as I could"; "nothing went into the game that didn't have a counterpoint" [blog quoting interview](https://dtddtd.blogspot.com/2008/04) · "the only game that ever made me stay up hours past my bedtime" [HN](https://news.ycombinator.com/item?id=31073648) |
| **Agar.io** | Instant start; growing bigger makes you a target | Valadares: "The more successful you are, the bigger a target you become" [GamesBeat](https://gamesbeat.com/the-surprising-momentum-behind-io-games-like-agar-io/) |
| **The Password Game** | Rules escalate and stack on each other; each new rule is a surprise | One player finished "after 10 attempts and several hours" [HN](https://news.ycombinator.com/item?id=36531972) |
| **Infinite Craft / Little Alchemy** | Combinatorial discovery; the "First Discovery" label | Players "swap rare finds on Reddit", and the wiki tracks First Discoveries as "a playful race" [Dot Esports](https://dotesports.com/?p=1156488) |
| **Wordle** | One shared puzzle a day; a share grid that gives nothing away | Wardle says one puzzle a day creates scarcity and caps play at about 3 minutes [Wikipedia](https://en.wikipedia.org/wiki/Wordle) · "the one-a-day format… had the opposite effect, keeping people coming back every day" [HN](https://news.ycombinator.com/item?id=30155414) |
| **Townscaper** | A toy with no score; the algorithm does the work of making it look good | Stålberg: "When you can win, you play to win. When you keep score, you play to the score." [PC Gamer](https://pcgamer.com/townscapers-developer-on-how-its-radically-casual-design-is-inspiring-a-new-wave-of-low-stress-builders-to-adapt-the-blueprint) |
| **QWOP** | Failing is funny; restarting is instant | Foddy: "It makes success matter if there's suffering in the game" [Game Developer](https://gamedeveloper.com/design/the-benefits-of-making-your-players-suffer-and-maybe-throw-up-) |
| **Nicky Case explorables** | Withholding the explanation so players go looking for it (a "cognitive gate") | Take about 30 minutes, not hours, but are shared widely [Case](https://blog.ncase.me/how-i-make-an-explorable-explanation/) |

## 2. Rubric: 12 criteria, each testable in 10 minutes

Score each 0–2. A total of 16 or more out of 24 suggests multi-hour play. Criteria 1, 2 and 9 matter most: no game in the evidence held people for hours without them.

**1. Verbs or elements unlock through play.** New interactions appear because of what the player did, not on a timer. (Paperclips, A Dark Room, Candy Box, Powder Toy, Infinite Craft)
*Test:* In 10 minutes, count new verbs or elements that change what you can do. Two or more, earned through play, scores 2. Pure number inflation scores 0.

**2. Clear goal, ambiguous best play.** Anyone can tell what success is, but there are several defensible ways to get there. (Opus Magnum, DTD mazing, Kittens Game)
*Test:* Can you say the goal in one sentence after 60 seconds? Did you face at least one choice where two options both looked right? Yes to both scores 2.

**3. Solutions are authored, then measured on more than one axis.** The player builds a solution, and it is scored on 2–3 axes that trade off, such as cost, speed and size, not a single star rating.
*Test:* Finish one level or task. Can you immediately see a different solution that wins on another axis? Does the game show you where you stand?

**4. Emergence that surprises.** Rules combine into results the player didn't plan, such as logic gates built from powder, a run-on chain in Line Rider, or Paul catching fire.
*Test:* Did something happen that you could explain only after it happened? Did you try to reproduce it?

**5. Short session loop nested inside a long meta loop.** Each loop is 5 seconds to 3 minutes and pays something into a structure that lasts hours. (Wordle's streak, Paperclips' phases, Cookie Clicker's prestige)
*Test:* Time one loop; it should take under 3 minutes. Name what that loop added to a longer-term goal.

**6. Under 5 seconds to retry, with progress kept.** Failure is cheap, instant and often funny. Long-term progress survives failure. (QWOP, Agar.io, Opus Magnum's rewind)
*Test:* Fail on purpose. Time it from failure to having control again. Over 5 seconds, or losing more than about 2 minutes of work, scores 0.

**7. Mastery you can see.** The player can see their own improvement as a number, a faster solution or a cleaner design. (Paperclips' completion timer, histograms, Wordle's guess distribution)
*Test:* Replay the first task. Is your second attempt visibly better, and does the game show you that?

**8. Shareable artefact.** The game produces something compact that is worth posting: a URL, a GIF, an emoji grid or a seed. Sharing it rewards the sender and doesn't spoil the game. (Fantastic Contraption URLs, Opus Magnum GIFs, the Wordle grid, First Discoveries)
*Test:* Can you share something you made in one click? Would it make sense to someone who has never played?

**9. The first 30 seconds is the game.** No sign-up, no wall of text and no forced tutorial. The first click is a meaningful action and its feedback arrives within about a second. ("light fire"; "make paperclip")
*Test:* From page load to first meaningful input in under 10 seconds, with no reading needed? Is the second state of the screen different from the first?

**10. Systems that play against each other.** Each strong option has a counter. No single strategy is both the best and the most fun. (Preece's "counterpoint" rule)
*Test:* Find the strongest thing you can do. Does the game push back against it within 10 minutes?

**11. Novelty paced by a ratchet.** Something new keeps arriving while the player is still digesting the last thing. In the evidence, games that held people for hours rarely let 3–5 minutes pass without a reveal early on.
*Test:* Note the time of each reveal in your 10 minutes. Any gap over 4 minutes with nothing new, and no decision to make, scores 0.

**12. Curiosity pulls forward: there is a visible "what's that?"** A greyed-out project, a door, a locked column or a hint of a next phase sits in view. (Paperclips' project list, Candy Box's map, the locked rows in Wordle-likes)
*Test:* At minute 10, can you name something you have seen but can't do yet and want to?

## 3. Anti-patterns: why people abandoned similar games within 10–20 minutes

- **Waiting with no decision.** "a 'wait until you can click again' mechanic that was purely there to waste my time… So I quit." [HN](https://news.ycombinator.com/item?id=5969759) Waiting is fine only while there are other levers to pull. Players also open the JavaScript console and cheat when gaps get too long [HN](https://news.ycombinator.com/item?id=5963687).
- **Switching genre partway through.** The Password Game lost players when "it took the game from solving puzzles to fast-reaction video gaming" [HN](https://news.ycombinator.com/item?id=36512116). Keep the core skill the same as the game escalates.
- **A reset that wipes out a long run.** Losing Paul to fire, or a single mistake that erases 30 minutes of work: "I lost Paul to a fire… so I gave up redoing it" [HN](https://news.ycombinator.com/item?id=36507743). Rule of thumb: what a failure costs should be well under the length of the current session.
- **Losing the save.** "my save file got corrupted… I lost a couple hundred hours of progress" [HN](https://news.ycombinator.com/item?id=36978119); "accidentally losing my first run state 57 minutes in" [HN](https://news.ycombinator.com/item?id=24406971). Browser storage is fragile.
- **Content runs out with no sandbox to fall back on.** "After a few hours… I unlocked all levels and then I don't see a point to continue" [HN](https://news.ycombinator.com/item?id=24683671).
- **The late game turns idle.** In Paperclips, "the last hour… turned into an idle game where I just have to sit and wait" [HN](https://news.ycombinator.com/item?id=24405264).
- **The optimal strategy is the boring one.** In Agar.io, "playing cautiously and defensively is the best strategy. But splitting frequently and being aggressive is a lot more fun" [HN](https://news.ycombinator.com/item?id=9468978). Also runaway leaders: "a HUGE russian blob" made the game unplayable [HN](https://news.ycombinator.com/item?id=9476829).
- **Long tutorials and walls of text.** itch.io players report skipping or quitting at long tutorials. Browser players have no sunk cost from installing, so they leave quickly [itch.io](https://itch.io/post/14219639).
- **Wanting to optimise with no way to measure.** Without a score axis or histogram, people who want to optimise drift away. Forcing optimisation drives casual players away too: "you don't have to optimise. If I had to do this to progress, I probably would have quit" (Tom Francis on Opus Magnum, quoted on [HN](https://news.ycombinator.com/item?id=16574033)). Make optimisation optional and measured.
- **Opacity with no community to fill the gaps.** Candy Box's obscurity worked because players shared secrets. In a solo page with no server, hidden content needs in-game hints.
- **Discoveries that become noise.** Combination games decay once most combinations give nothing interesting or can be found by brute force. One player let a script run for "near 20 hours" [HN](https://news.ycombinator.com/item?id=39224656).
- **A theme stuck on afterwards.** "The opening does feel a bit more generic" because the theme never shaped the core actions [Game Developer](https://www.gamedeveloper.com/design/lessons-of-my-first-incremental-game).

## 4. Genre patterns for a single-page browser game with no server

**Constraints that shape the design:**
- no leaderboards, accounts or LLM calls;
- saves live in `localStorage`, which is fragile;
- sharing works only through URLs or copied text.

**Patterns that work in that setting:**
1. **An incremental game that reveals itself and has an ending** (Paperclips, A Dark Room, Candy Box). This is the strongest pattern with no server. Give it 3–5 phases, each of which changes the UI. Make it 2–8 hours long and give it a real ending, which people then talk about. Add a completion timer to invite replays and speedruns.
2. **A cellular-automaton or falling-sand sandbox** (Powder Toy, Sandspiel, Sandboxels, Life). Start with 10–30 elements whose pairwise interactions were designed by hand. Encode scenes in the URL hash; this replaces a server-side gallery.
3. **An optimisation puzzle measured on several axes** (Opus Magnum, shapez). Ship histograms computed in advance from playtests, or synthetic distributions, as JSON. These stand in for the global ones. Export solutions as URLs or animated loops.
4. **A daily seeded puzzle** (Wordle). Seed the puzzle from the date with a deterministic random number generator. Keep streaks and a distribution chart locally. Share an emoji or text grid that spoils nothing.
5. **A physics construction or drawing toy** (Line Rider, Fantastic Contraption, Poly Bridge). Use a deterministic simulation so the same design gives the same run and can be replayed from a URL.
6. **Combinatorial discovery with a hand-authored graph** (Little Alchemy rather than Infinite Craft). Since no LLM is available, write a finite graph of 300 or more nodes with hints and show "N of M found". Surprise has to come from the writing.
7. **Tower defense where the player builds the maze** (Desktop Tower Defense, Bloons). Player-built paths plus counter-designed towers give long learning curves in very little code.
8. **A toy builder** (Townscaper). Procedural rules such as wave function collapse make every click look good. There's no score; the artefact is a screenshot or URL. Better for 20–60 minutes than for marathon sessions unless combined with pattern 2 or 3.
9. **A programming game** (Bitburner, TIS-100). Let players write code against an in-page API, which gives the "refactor the spaghetti" pleasure. The audience is narrow, but they play for hundreds of hours.
10. **An escalating rule stack** (Password Game). Very good for one viral session of 30–180 minutes. It needs checkpoints, and the core skill must not change partway through.

**Engineering checklist, all from the abandonment evidence:**
- autosave every few seconds;
- export and import saves as a text string;
- keep the game working offline;
- run the simulation in fixed steps so it stays deterministic;
- keep sharing state compact enough to fit in a URL hash;
- let the game progress while the tab is in the background (time-delta catch-up);
- allow a full restart to cost under 5 seconds.

## House rule: originality (from the owner)
Every game must bring something genuinely new, not "yet another" tower defense, incremental clicker, falling-sand clone, match-3 or bridge builder.
- Borrow *what makes those genres sticky* (the rubric above), never their surface mechanic.
- The test: describe the game in one sentence without naming an existing game or genre. If the sentence still sounds like one, rethink it.
- Each game's core verb should come from its real-world subject (the physics, history, biology or maths it is about), so the mechanic could only exist for this topic.
- Prefer a fresh twist a player has never seen: a new verb, a new kind of goal, a surprising simulation, an unusual perspective.

---

# Reinventing a Genre: Cases, Moves, Anti-moves

Research brief for a browser-game collection. All quotes are short excerpts from the linked sources. Where a source only gave a paraphrase, it is marked *(paraphrase)*.

## 1. Cases

| Game | Familiar genre | Twist | Why it worked |
|---|---|---|---|
| **A Dark Room** (Townsend, 2013) | Idle clicker | The clicker grows into a village sim, then a world-map roguelike with a dark reveal | Minimalism carries the story: "absence becomes an active design material" ([GDC 2021 review](https://media.gdcvault.com/GDC+2021/ArthurDavis_ADarkRoomNarrativeReview.pdf)). Townsend took Candy Box's sparse look and used it "in service of a broader narrative" ([PocketGamer.biz](https://www.pocketgamer.biz/shedding-light-the-making-of-a-dark-room)). "Nearly all the game play takes place in your head" ([InformIT](https://informit.com/articles/article.aspx?p=2228802)). |
| **Candy Box!** (aniwey, 2013) | Counter clicker | An ASCII RPG with quests, a map and secrets unfolds out of one number | aniwey called it essentially "an RPG whose features reach the player gradually" ([PC Gamer](https://www.pcgamer.com/candy-box-1/)) *(paraphrase)*. Each new button is a surprise, and the UI expands as you play. |
| **Universal Paperclips** (Lantz, 2017) | Incremental | You play the paperclip-maximizer AI. The game changes phase three times (business, then Earth, then the universe) and the UI is replaced each time | The number-go-up compulsion *is* the alignment argument. You feel the AI's single-mindedness from the inside ([YC interview](https://blog.ycombinator.com/frank-lantz-director-of-nyus-game-center-and-creator-of-universal-paperclips)). |
| **Frog Fractions** (Crawford, 2012) | Edutainment | Escalates through a shooter, a dance-off, a text adventure, a space trade sim and more | A "nested series of surprises" hidden under "unassuming educational software" ([Waypoint](https://waypoint.vice.com/en_us/article/inside-the-development-of-gamings-biggest-mystery-frog-fractions-2)). Crawford's later GDC talk asked how to keep surprise alive once players expect it ([Game Developer](https://gamedeveloper.com/design/-i-frog-fractions-2-i-surprising-players-who-expect-to-be-surprised)). |
| **Baba Is You** (Teikari, 2019) | Sokoban | Rules are word blocks you push to rewrite physics ("WALL IS STOP" becomes "WALL IS WIN") | It came from a jam theme. "The theme gave me this idea of how the word 'not' works... like logic and programming" ([MCV](https://mcvuk.com/when-we-made-baba-is-you/)). Objects have no default properties, so every rule is visible and can be edited. |
| **Papers, Please** (Pope, 2013) | Sim / time-management | Border-inspection bureaucracy with moral pressure | "Just moving documents is fun" (Pope, via [Automaton](https://automaton-media.com/articles/interviewsjp/20190720-97710/2/)). "The rigid structure of an oppressive bureaucracy works really well with how I like to design game mechanics" ([OnPause](https://www.onpause.org/2013/04/onpause-interview-papers-please-developer-lucas-pope.html)). |
| **Return of the Obra Dinn** (Pope, 2018) | Mystery / adventure | The core verb is *deduce*: fill in a ledger of 60 fates, confirmed three at a time | The batch-of-three check stops guessing. Pope cut the crew from about 120 to 60 to keep each death distinct ([Automaton](https://automaton-media.com/articles/interviewsjp/20190719-97599/)). |
| **Her Story** (Barlow, 2015) | FMV / adventure | A police-database search box over 271 clips | "If you can Google, you can play Her Story." Barlow wanted the story chopped up "in the database and finding it in this disordered fashion" ([Game Developer](https://gamedeveloper.com/audio/road-to-the-igf-sam-barlow-s-i-her-story-i-)). The player's own curiosity is the parser. |
| **Outer Wilds** (Mobius, 2019) | Open-world exploration / Metroidvania | No ability unlocks. The only thing that persists through the 22-minute loop is knowledge | The team wanted players to only "collect knowledge about the world they're exploring" ([Game Developer, IGF](https://gamedeveloper.com/design/road-to-the-igf-alex-beachum-s-i-outer-wilds-i-)). A first-time player could finish in minutes if they knew what to do. |
| **The Witness** (Blow, 2016) | Myst-like puzzles | One wordless line-drawing grammar, taught only through sequence and the environment. Some puzzles are hidden in the landscape itself | "The key to these puzzles is in the player's head" ([Engadget](https://www.engadget.com/2014/06/12/the-witness-and-the-joy-of-intuition/)). |
| **Stephen's Sausage Roll** (Lavelle, 2016) | Sokoban | One tiny mechanic (a fork and rolling sausages) explored with extreme depth and no tutorial | "There is no tutorial, no hand-holding" ([Kotaku](https://kotaku.com/puzzle-game-about-cooking-sausages-is-way-harder-than-i-1772038805)). Critics called it "some of the tightest puzzle design I've seen in years" ([Game Informer](https://gameinformer.com/games/stephens_sausage_roll/b/pc/archive/2016/05/02/stephens-sausage-roll-game-informer-review)). |
| **Desert Golfing** (Smith, 2014) | Golf | One button, endless procedural holes, no menus, no reset | Smith found golf games boring and wanted "a more immediate challenge" ([Wikipedia](https://en.wikipedia.org/wiki/Desert_Golfing), citing Kris Graft's Game Developer interview). The stroke counter becomes a lifelong diary. |
| **Noita** (Nolla, 2019) | Roguelite | Every pixel is a falling-sand cellular automaton | "Every pixel... follows rather simple rules, but when you combine them together you get surprising and unexpected results" ([80.lv](https://80.lv/articles/noita-a-game-based-on-falling-sand-simulation/); [GDC talk](https://gdcvault.com/play/1025695/Exploring-the-Tech-and-Design)). |
| **Undertale / Inscryption / DDLC** | JRPG / deckbuilder / dating VN | The game remembers, comments on and attacks its own form | Undertale was made "to subvert the need to fight monsters in RPGs," and it "doesn't judge, but it does react" ([Game Developer](https://www.gamedeveloper.com/design/how-i-undertale-i-makes-you-think-hard-before-killing-monsters)). Inscryption layers creepypasta and found footage on a tight deckbuilder ([Game Rant](https://gamerant.com/inscryption-interview-horror-genre-medium-blending-world-design/)). Each one works because the base game is good *before* the twist. |
| **Townscaper** (Stålberg, 2020) | City builder | No goals, no resources. Click and the town resolves itself | "When you can win, you play to win. When you keep score, you play to the score" ([PC Gamer](https://pcgamer.com/townscapers-developer-on-how-its-radically-casual-design-is-inspiring-a-new-wave-of-low-stress-builders-to-adapt-the-blueprint)). |
| **Opus Magnum** (Zachtronics, 2017) | Puzzle | An open-ended machine builder scored on cost, cycles and area histograms instead of a single leaderboard, with GIF export | Histograms are "so much smarter than a leaderboard" ([PC Gamer](https://www.pcgamer.com/perfectly-solving-opus-magnums-puzzles-is-impossible-but-thats-ok)). The game never gates progress on efficiency. |
| **TIS-100** (Zachtronics, 2015) | Puzzle | A fake 1980s assembly manual, "designed, printed out, marked up and scanned back in," which players are told to print ([Game Developer](https://gamedeveloper.com/design/-things-we-create-tell-people-who-we-are-designing-zachtronics-i-tis-100-i-)) | The document is the tutorial and the fiction at once. |
| **Bitburner / Hacknet** | Idle / hacking fiction | Real JavaScript (Bitburner) or a pseudo-Unix shell (Hacknet) | A real tool turns learning into the progression ([PC Gamer](https://www.pcgamer.com/bitburner-is-an-idle-game-about-hacking-that-teaches-real-javascript)). |
| **Wordle** (Wardle, 2021) | Mastermind / word puzzle | One puzzle a day, the same for everyone, with a spoiler-free emoji share | "Three minutes a day, and that's it. It doesn't want any more of your time" ([NPR](https://www.npr.org/2022/01/14/1072980440/a-simple-word-game-is-the-newest-social-media-phenomenon)). The grid was invented by players and adopted later ([Game Developer, GDC](https://www.gamedeveloper.com/marketing/josh-wardle-reflects-on-the-the-unconventional-road-to-wordle-s-success)). |
| **The Password Game / Infinite Craft** (Agarwal) | Form validation / alchemy combiner | Escalating absurd rules on a password form. Infinite Craft uses an LLM to make the combination tree endless | The Password Game parodies password policies as they get "weirder" ([Wikipedia](https://en.wikipedia.org/wiki/The_Password_Game)). Infinite Craft's odd LLM results are part of the fun ([Wikipedia](https://en.wikipedia.org/wiki/Infinite_Craft)). |
| **The Evolution of Trust** (Case, 2017) | Explorable / essay | The prisoner's dilemma played, then simulated, then argued | Case uses "place your bets" and a sandbox mode, and withholds the explanation as a "cognitive gate" ([ncase blog](https://blog.ncase.me/explorable-explanations-4-more-design-patterns/); [how I make one](https://blog.ncase.me/how-i-make-an-explorable-explanation/)). |
| **Line Rider / Sandspiel / Nested / Superliminal / Kentucky Route Zero** | Toy / sandbox / generator / FPS puzzle / point-and-click | Line Rider: the player draws the level. Sandspiel: a shareable elemental sandbox. Nested: an infinitely clickable universe from galaxies to quarks. Superliminal: forced perspective changes scale. KRZ: magical-realist theatre where choices set *tone*, not outcome | Each takes one illusion or affordance seriously and drops the usual win state. |

## 2. Moves (toolkit)

Each move has a definition, two examples, and an application to a science or history browser toy.

1. **The Hidden Second Game.** A humble surface hides a larger game that unfolds as you play. *Candy Box!, A Dark Room.* Apply: a "count the sheep" tally that turns out to be Mendel's pea ledger and opens into breeding experiments.
2. **The Phase Shift.** The scale, the UI or the goal changes so much that the game becomes a different genre. *Universal Paperclips, Frog Fractions.* Apply: a single cell divides into an organism, then an ecosystem, then a biosphere, and each stage gets new controls.
3. **Knowledge Is the Only Key.** No unlocks, only understanding. A player who knows enough could win on turn one. *Outer Wilds, The Witness.* Apply: a Rosetta Stone or Linear B decipherment where the "inventory" is your notebook.
4. **Rules as Objects.** The laws of the world are pieces you can see and manipulate. *Baba Is You, Opus Magnum's open instruction set.* Apply: push "GRAVITY IS 9.8" onto a different planet tile, or edit Maxwell's terms and watch light change.
5. **The Odd Verb.** Swap shoot or jump for a verb from real intellectual work: search, deduce, stamp, date, translate or annotate. *Her Story (search), Obra Dinn (deduce), Papers, Please (stamp).* Apply: carbon-date and cross-reference artifacts to rebuild a dig's timeline, or check a 1850s ship manifest against cholera deaths.
6. **The Interface Is the World.** The game lives in a familiar UI such as a form, a terminal, a spreadsheet or a search box. *The Password Game, Her Story, Hacknet.* Apply: a periodic-table "form" that rejects entries until they obey ever-stranger chemical rules.
7. **The Game Is an Argument.** The mechanics make a claim, and the player discovers the thesis by playing. *The Evolution of Trust, Universal Paperclips, Papers, Please.* Apply: an exponential-growth toy that argues why early pandemic action matters.
8. **Constraint Minimalism.** One mechanic and no tutorial, explored to exhaustion. *Stephen's Sausage Roll, Desert Golfing.* Apply: a single slider (the Earth's tilt) with 40 puzzles about seasons.
9. **The Player Authors the Content.** The player makes the level, the creation or the experiment, and it is meant to be shared. *Line Rider, Sandspiel, Townscaper.* Apply: draw a coastline and watch tides and erosion. Export the result as a GIF.
10. **Diegetic Documents.** The manual, the logbook or the rulebook is a fictional artifact and also the tutorial. *TIS-100, Obra Dinn's ledger, Papers, Please's rulebook.* Apply: a facsimile of Darwin's field notebook that the player annotates to classify finches.
11. **Real Tools as the Game.** Real code, real data or a real instrument does the work. *Bitburner, Hacknet.* Apply: write real 10-line JS to steer a probe by orbital mechanics, or query a real historical census.
12. **Simulate Everything Small.** Simple local rules for every particle produce emergent play. *Noita, Sandspiel.* Apply: a falling-sand chemistry set with real reactions, such as thermite or sodium in water.
13. **Goalless Toy.** Remove win states. Satisfaction comes from response and beauty. *Townscaper, Nested.* Apply: click to zoom from a human cell down to quarks and up to galaxy filaments, with captions at every level.
14. **Ritual Scarcity and Shareable Trace.** One attempt a day, the same for everyone, plus a spoiler-free shareable artifact. *Wordle, Opus Magnum's GIFs and histograms.* Apply: a daily "date this artifact" puzzle with an emoji-timeline share.
15. **The Game Remembers.** The game breaks the frame by remembering and reacting to the player's past choices. *Undertale, Inscryption, DDLC.* Apply: a history toy that remembers the "propaganda" you accepted last session and confronts you with the archive later.
16. **Escalating Rule Stack.** Constraints pile up until the stack becomes comedy and puzzle at once. *The Password Game, Papers, Please's daily rule changes.* Apply: build a molecule that must satisfy rules added one by one (valence, then chirality, then "must be found in coffee").
17. **Generative Abundance.** Procedural generation or an LLM makes the content space feel endless, and surprise is the reward. *Infinite Craft, Desert Golfing.* Apply: combine historical figures and inventions to "discover" plausible what-ifs, flagged clearly as fiction.

## 3. Anti-moves (gimmicks that aged fast)

- **The surface-only fourth-wall break.** A fake crash, a deleted save or a character saying "I know you're there" with nothing mechanical behind it. Critics call it "a crutch that uninspired games fall back on" ([AV Club](https://www.avclub.com/the-view-from-the-top-of-the-fourth-wall-isnt-good)), and it "means less when it is overused" ([Kotaku](https://kotaku.com/breaking-the-fourth-wall-clever-gimmick-or-slap-in-the-5668976)). It works in Undertale and Inscryption only because the base game stands on its own.
- **"It's secretly horror."** After DDLC, the cute-game-turns-creepy reveal became a predictable genre of its own.
- **Surprise without a game underneath.** Crawford's own sequel had to solve "surprising players who expect to be surprised." A twist can only be spent once.
- **Grind dressed as a statement.** A "this is boring on purpose" design that never pays off. Papers, Please works because the tedium creates moral pressure.
- **Clicker plus reskin.** Swapping cookies for atoms is not a reinvention unless the growth curve *means* something, as it does in Paperclips.
- **Faked verbs.** A "deduction" game that is really item collection, or "programming" that is really drag-and-drop with one right answer.
- **AI novelty with no curation.** LLM output with no structure, no goal and no taste. Infinite Craft works because it is framed as discovery with a tiny "first discovery" reward.
- **Obscurity as depth.** Hiding content with no signposting. The Witness and Outer Wilds are fair because the clues are always in the world.

## 4. The originality test

1. **What is the verb, and could you describe it without naming the genre?** If the answer is "click to earn, buy upgrades," it is yet another clicker. If it is "cross-examine a manifest" or "rewrite gravity," you have something.
2. **What changes when the player learns?** Does mastery change *what the game is* (a phase shift, a hidden layer, knowledge as the key, rules becoming editable), or only how fast numbers grow? Something should be revealed on the second hour, not just made bigger.
3. **What is the game *about*, and do the mechanics say it?** Remove the theme text. Does the system still make the argument (exponential growth, bureaucratic complicity, the scale of the universe)? If the theme is only a skin, the pitch is a reskin.
