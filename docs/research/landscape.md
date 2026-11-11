# Name check and similar apps

Research of 11 Nov 2026 (worker3 with two research agents, for synthia-1d). Facts come from pages and searches made that day, and what could not be confirmed is marked UNVERIFIED in each part.

## A. Is the name "Synthia" taken?

Checked 2026-11-11. Sources are search results or pages fetched today.

### Music collisions
| What | Status | Source |
|---|---|---|
| synthia.app: meta description "A free, online space to create music, sounds, and synthesizers", keywords "online daw"; title "Synthia - Find your sound" | Serves a page today. Analytics tag is old Universal Analytics (UA-), so possibly stale. Owner and activity UNVERIFIED (page text is JS-only) | https://synthia.app (curl + WebFetch) |
| "Synthia the music workstation" iPad app (synth + drum sequencer, free) | Last update 11 Apr 2016, effectively dormant | https://apps.apple.com/app/id1088369145 |
| Synthia AI electronic-music generator (free, track limit) | Listed on German download site; status unclear, primary source UNVERIFIED | https://www.netzwelt.de/download/26803-synthia.html |
| Synthia, Amiga sampled-instrument synth (The Other Guys, late 80s/90s) | Historic | https://www.matrixsynth.com/2015/03/the-other-guys-synthia.html?m=0 |
| SYNTHIA-1 analog synth, UCF student project | Academic | https://ece.ucf.edu/seniordesign/fa2022sp2023/g27 |
| GitHub JoeKenyon/Synthia (NAudio polyphonic synth), kayoscode/Synthia | Hobby repos | https://github.com/JoeKenyon/Synthia |
| Synthia, AI composition platform (founded 2024 per aggregator) | Secondary source only, UNVERIFIED | https://azariangrowthagency.com/ai-tools/synthia |

### Other fields
| What | Source |
|---|---|
| SYNTHIA retrosynthesis software, Merck KGaA / MilliporeSigma, commercial, active | https://www.selectscience.net/product/synthia-tm-retrosynthesis-software |
| Synthia (python synthetic data generation, 71 stars); Synthia (Rust language, 14 stars, pushed 2026-01); misc AI chatbots | GitHub search API, https://github.com/dmey/synthia |

### Similar names
| Name | Closeness | Source |
|---|---|---|
| Synthesia (piano falling-notes game, Synthesia LLC, since 2006) | One letter from Synthia, same music domain, well known. Highest confusion risk | https://en.wikipedia.org/wiki/Synthesia_(video_game) |
| Synthesia (AI video company, Synthesia Limited, Class 42 SaaS filing) | One letter, different field, very well funded | https://trademarks.justia.com/793/80/synthesia-79380917.html |
| Cynthia (MIDI player), Cynthia Micro (Tesselode) | Homophone, small freeware | https://www.majorgeeks.com/mg/get/cynthia,1.html |

### Trademarks
USPTO, EUIPO and WIPO were not queried directly (JS apps; markinton.com and trademarkdir.com did not resolve from this machine). Everything below is from a web-search summary of aggregator pages, so SECONDARY.
| Mark | Owner | Classes | Status | Source |
|---|---|---|---|---|
| SYNTHIA, serial 87825579 | Merck KGaA | 9, 38, 42, 45 | Reg. no. 7575011, 26 Nov 2024 (per search summary) | https://markinton.com/trademark/synthia-87825579 |
| SYNTHIA, serial 87905384 | Splice Software Incorporated | 42 | Conflicting: pending vs live | https://markinton.com/trademark/synthia-87905384 |
No Class 41 or 15 SYNTHIA filing found, but absence is not proven. The Merck Class 9 registration covers software, so a legal conflict with a free music app is possible in principle, though fields differ.

### Domains (resolved with getent/curl; dig not installed)
| Domain | Result |
|---|---|
| synthia.com | Redirects to gritbrokerage.com/inquiry (unrelated, parked/for sale style) |
| synthia.app | Live, free online music/synth space (see above) |
| synthia.io | Resolves; JS redirect to /lander (parking page) |
| synthia.studio, synthia.fm | No DNS / no response |

### GitHub and npm
| Item | Result |
|---|---|
| GitHub user `Synthia` | Exists, 2 repos, created 2015 (gh api users/synthia) |
| Top repos named synthia | dmey/synthia 71 stars; samrahimi/synthia-new 29; dlopezyse/Synthia 25; dalloriam/synthia 8 (Go modular synth toolkit) |
| npm `synthia` | **Taken**: version 0.0.0, description "Web Synthesizer", last modified 2022-05-19 (registry.npmjs.org/synthia, checked by worker3). `tinkerbeat` returns 404 (free) |
| npm `@synthia` scope | Same, UNVERIFIED |

### Verdict
Crowded and arguably risky. A free browser "create music, sounds, and synthesizers" site already sits on synthia.app, which is the same category, the same pitch and the obvious domain for you. Add Synthesia one letter away, plus a Merck trademark in Class 9. For a non-commercial hobby app, legal risk is low in practice (different fields, no revenue), but discoverability, confusion and domain availability are poor. I would rename.

### Alternatives (quick checks; "no hit" means the web search found no such music product)
| Name | Music collision | .com | .app | npm | GitHub user |
|---|---|---|---|---|---|
| Tinkerbeat | None found (nearest: TweakyBeat, Tinkerball) | no DNS | no DNS | free | free |
| Beatnook | None found | resolves (taken) | no DNS | free | free |
| Blipwave | None found (nearest: Bliplay, Blip) | resolves (taken) | no DNS | free | taken, 0 repos |
| Loopsy | None found (nearest: Loopy) | taken | taken | taken (unrelated) | taken |
| Patchwork | Common word, many | taken | taken | taken | taken |
"No DNS" does not prove the domain is unregistered; check a registrar. Best candidate: Tinkerbeat.

### UNVERIFIED
- Owner, content and activity of synthia.app (JS-only page).
- All trademark details (secondary, search summaries); no direct USPTO/EUIPO/WIPO query; no Class 41/15 check.
- npm `@synthia` scope availability (the `synthia` package itself is taken, see above).
- Whether the Synthia AI music generator and the 2024 AI platform still operate.
- Domain registration status for the alternatives.

## B. Similar apps, and how similar

Researched 2026-11-11. Scale per feature: S = same, P = partial, A = absent, ? = could not confirm. Features:
F1 graph of sections with rule connections; F2 step grid with per-note chance/timing/repeat/length/loudness; F3 effects at several levels; F4 sample banks incl. SoundFont/SFZ + synth; F5 live recording + quantize + MIDI controllers; F6 plugin API; F7 local-only, no account, in browser; F8 WAV/MP3 export; F9 aimed at non-musicians.

**Headline: nothing found does nearly all of it.** Several products each match one slice (Ableton Live follow actions, game-audio transition graphs, Nodal's node graph, Elektron per-step conditions, BeepBox's pattern grid and URL storage). None combines a rule-carrying section graph with a per-section step grid in a free, local, no-account browser app for beginners. Note: WebFetch returns model-summarised pages, so "not mentioned" means the page text did not say, not that the feature is absent.

| Name + URL | What it is | Price | Licence | F1 | F2 | F3 | F4 | F5 | F6 | F7 | F8 | F9 | Overall |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| [Ableton Live](https://www.ableton.com/en/live-manual/12/launching-clips/) (also [shop](https://www.ableton.com/en/shop/live/)) | Desktop DAW; Session View clips/scenes with Follow Actions | Intro $79 / Standard $279 / Suite $599 (sale prices on page) | Proprietary | P: follow actions Next/Any/Other/Jump with Chance A/B %, on clips and scenes; linear lists, no canvas/forks | P: clip MIDI editor; per-note chance UNVERIFIED | P: track/return/master devices | P: Simpler/Sampler; SFZ/SoundFont ? | S | P: Max for Live (Suite); VST ? | A: desktop, licence auth | ? | A | **Medium** (closest on F1 idea + F5) |
| [Wwise](https://www.audiokinetic.com/pricing/for-games) (page 403 to fetch; facts from search results incl. [this Q&A](https://www.audiokinetic.com/qa/713/automatically-loop-a-music-segment)) | Game-audio middleware; Music Switch/Playlist Containers with transition rules between segments | Indie tier free under $250k budget (search snippet of official pricing page, UNVERIFIED on page) | Proprietary | P: segments + state/switch-driven transition rules with entry/exit cues; no chance/count rules confirmed | A | ? | P: samples only | A | P: SDK/plug-ins | A: desktop | ? | A: sound designers | **Medium** (F1 only) |
| [FMOD Studio](https://fmod.com/studio) | Game-audio middleware; adaptive music with transitions, conditions, parameters, logic tracks | Indie free (under $600k budget per search snippet of fmod.com/studio; page body did not render, UNVERIFIED) | Proprietary (FMOD EULA) | P: timeline regions + parameter conditions + quantised transitions; not a free canvas | A | P: mixer buses | P: samples | A | ? | A: desktop | ? | A | **Medium** (F1 only) |
| [Elias](https://elias.audio/) | Adaptive game music middleware; segments, transitions, loops, stingers, visual-scripting graphs | Tiers by studio size; no price shown; free trial | Proprietary | P: segment/transition model + sample-accurate logic graphs; rule types not confirmed | A | ? | ? | A | ? | A | ? | A | **Low** |
| [Nodal](https://nodalmusic.com/) | Desktop generative sequencer: nodes + edges, virtual players walk the graph | Paid, price not on page; 30-day trial, saving disabled in trial | Proprietary | P: node/edge graph with probabilistic sequencing; nodes are events, not sections with rules like count/turns | P: probabilistic + relative note sequencing; no step grid | P: edge CC curves | P: built-in synth + MIDI out | P: MIDI in/sync | ? | A: Mac/Windows desktop | ? | A | **Medium** (graph idea) |
| [Smol Sequencer](https://stretta.com/labs/smol/) ([news](https://www.synthtopia.com/content/2026/06/26/smol-sequencer-turns-your-browser-into-a-generative-music-environment/)) | Free browser modular sequencing environment: small sequencer modules wired together (RNBO-based) | Free | ? | P: modules connected for evolving patterns; not sections/rules | P: randomisation, pitch-class rotation; grid ? | ? | P: SoftPiano etc. | ? | ? | P: link-based project share; storage ? | ? (patch Export button exists) | A | **Medium** (closest free browser graph; mostly unverified) |
| [Musical Automata Editor](https://aarnituli.itch.io/music-editor) | Browser node graph: oscillators/filters/sequencers + logic-gate grid decides which nodes fire per step | Free (donations) | ? | P: node graph + AND/OR/XOR/NOT rules | P | ? | P: oscillators | ? | A | P: browser; storage ? | ? | A | **Low** |
| [NoiseCraft](https://pointersgonewild.com/2021/12/05/noisecraft-a-browser-based-visual-programming-language-for-sound-music) | Browser Max/PD-like node language with sequencer node (multi-pattern) | Free | GPL-2.0 ([repo](https://github.com/maximecb/noisecraft)) | A | P: sequencer node | P | P: synth nodes | P: MIDI devices | A | P: local JSON or cloud share | ? (not described) | A | **Low** |
| [cables.gl](https://cables.gl/) | Browser visual programming mostly for visuals; MIDI ops | "Always free"; Patreon support | "open source" per page; licence name UNVERIFIED | A | A | A | A | P: MIDI | P: custom ops | P: browser, offline version | A: exports code zip | A | **Low** |
| [plugdata](https://plugdata.org/) | Pure Data front-end, plugin and standalone; patch graphs | Free, no account | GPL-3.0 | A | A | P | A | P | P: builds plugins | A: desktop/iOS, no browser | P: code export | A | **Low** |
| [Bespoke Synth](https://bespokesynth.com/) | Desktop modular "software modular" with 190+ modules, Python live coding | Free (optional $20/$40 donations) | GPLv3 | P: patch-cable modular, no section/rule model | P | P | P | S: MIDI controllers | P: VST hosting | A: desktop | ? | A | **Low** |
| [Audulus](https://audulus.com/) | Node-based modular synth, iOS/macOS | Free (Pro modules in-app) | Proprietary | A | A | P | P: synth | ? | A | A | ? | A | **Low** |
| [Chrome Music Lab Song Maker](https://musiclab.chromeexperiments.com/Song-Maker/) (page rendered only a Chrome notice; rest from [search results](https://blog.google/outreach-initiatives/education/simple-music-making-everyone)) | Beginner browser grid for melody + beat | Free | Chrome Music Lab repo Apache-2.0 ([repo](https://github.com/googlecreativelab/chrome-music-lab)); Song Maker inclusion UNVERIFIED | A | P: simple grid; no per-note chance | A | A: fixed sounds | P: MIDI in ? | A | S: share-by-link, no login (per Google blog) | P: WAV/MIDI download per teacher guides, conflicting | S | **Low** (same audience, tiny scope) |
| [Ableton Learning Music](https://learningmusic.ableton.com/) | Browser lessons: click boxes to toggle patterns; song-structure chapter | Price not on page (UNVERIFIED) | Proprietary | A | P | A | A | A | A | ? | ? | S | **Low** |
| [BeepBox](https://beepbox.co/) ([repo](https://github.com/johnnesky/beepbox)) | Browser chiptune sketchpad: patterns per channel in a linear song, loop bar | Free (tips) | MIT | A: linear pattern order | P: note grid, volume/bend drag; no chance/ratchet | P: per-instrument reverb/echo/etc (per v4.0 release notes) | P: built-in synths only | A | A | S: song stored in the URL | P: .mp3 | P | **Low** (closest on browser feel) |
| [JummBox](https://github.com/jummbus/jummbox) (patch notes [jummb.us](https://jummb.us/patch_notes/2.5)) | BeepBox mod with more synths, modulators | Free | MIT | A | P: modulators | P | P: synths | A | A | S | ? | P | **Low** |
| [Strudel](https://strudel.cc/) ([repo](https://codeberg.org/uzu/strudel)) | Browser live coding of patterns (TidalCycles port) | Free | AGPL-3.0 | A: patterns in code | P: probability/timing via code (degradeBy etc. UNVERIFIED on page) | S: per-event + per-orbit effects ([effects page](https://strudel.cc/learn/effects/)) | P: sound banks; SoundFont/SFZ ? | P: MIDI/OSC | P: code extensions | S | P: export tab renders audio per [FAQ](https://strudel.cc/learn/faq/) (format ?) | A: code | **Low** |
| [Sonic Pi](https://sonic-pi.net/) | Live coding; desktop app plus web version | Free | MIT app; AGPL-3.0+ web part ([LICENSE](https://github.com/sonic-pi-net/sonic-pi/blob/dev/LICENSE.md)) | A | P | S: FX | P: samples, synths | ? | ? | S (web) | ? | P: learners, code-based | **Low** |
| [BandLab](https://www.bandlab.com/) ([formats](https://help.bandlab.com/hc/en-us/articles/360036010533-Supported-Audio-Formats-)) | Free browser/mobile DAW, cloud projects | Studio free; paid tiers not priced on page | Proprietary | A | P: piano roll/drum patterns | P | P: loops/samples; SoundFont ? | S: MIDI | A | A: account, cloud | S: MIDI, MP3, 16-bit WAV (search of help centre) | P | **Low** |
| [Soundtrap](https://www.soundtrap.com/) | Browser DAW with Patterns beatmaker, loops; education focus | Free tier; paid plans, prices UNVERIFIED (sources conflict) | Proprietary | A | P: beat patterns | P | P: loops/instruments; SoundFont ? | P: MIDI editor | A | A: account | ? | P | **Low** |
| [Audiotool](https://www.audiotool.com/) | Free browser studio, modular device routing, multiplayer | Free, no ads | Proprietary | A | P: piano roll, clips | S: insert chains, FX sends, group | P: synths, sample lib; SF2/SFZ ? | S: MIDI learn | P: VST3 and developer program | A: sign-up links | ? (FAQ lists download of mixdown) | P | **Low** |
| [Amped Studio](https://www.ampedstudio.com/) ([pricing](https://www.ampedstudio.com/pricing/)) | Browser DAW, drum machine, AI tools | Free Starter (ads, 16 tracks); Premium $6.99/mo; Pro $12.99/mo | Proprietary | A | P | P: 10 effects free, 21 paid | P: Drumpler one-shots; SoundFont not mentioned | S: external MIDI | P: VST3 on paid | A: account required | P: MP3 only on free (page also says no project export); WAV paid | P | **Low** |
| [Online Sequencer](https://onlinesequencer.net/) (site 403 to fetch; from [search results](https://onlinesequencer.net/help.html)) | Browser piano-roll sequencer | Free per reviews; premium UNVERIFIED | Proprietary (UNVERIFIED) | A | P | P | P | ? | A | ? | P: MIDI per help page; WAV/MP3 conflicting | P | **Low** |
| [Elektron Digitakt II](https://www.elektron.se/en/digitakt-ii-explorer) | Hardware sampler/sequencer with trig conditions + chance, song mode | $1149 listed | Proprietary hardware | P: song mode = pattern playlist; "Last" condition reacts to the cued pattern (search) | S: per-trig conditions and chance, per-trig p-locks | P: per-track + master FX | P: sample-based, 400 MB | S: MIDI | A | A: hardware | ? | A | **Medium** (closest on F2 rules) |
| [Polyend Tracker+](https://polyend.com/tracker-plus/) ([Tracker](https://polyend.com/tracker/)) | Hardware tracker with song mode, per-step FX | Not on page (UNVERIFIED) | Proprietary hardware | P: patterns arranged into a song, no rules | P: step FX; chance listed on Tracker page only | P: send FX, master chain | P: samples from SD/USB | ? | A | A | ? | P | **Low** |
| [Teenage Engineering OP-Z](https://teenage.engineering/products/op-z) | Hardware sequencer, 14 step components, 160 chained patterns | Not on page (UNVERIFIED) | Proprietary hardware | P: pattern chaining | P: step components (probability etc. UNVERIFIED) | ? | P | ? | A | A | ? | P | **Low** |
| [Renoise](https://www.renoise.com/) | Tracker-style DAW with phrase scripting; Redux sampler plugin | EUR 76 (USD 88) | Proprietary | A | P | P | P: samples; SoundFont/SFZ ? | P | P: tools/phrase scripting | A: desktop | S (render) | A | **Low** |

Dropped: Melodrive (only search results; one aggregator lists the company as closed). Not opened at all, so not listed: Bitwig, Signal, Soundation.

### What the closest ones do well that we should learn from

- **Ableton follow actions** make a branching song from two numbers: an action plus a chance, with a timing control ("after 1 bar") and Jump to a named target. Few, readable choices beat a rule language.
- **Wwise/FMOD/Elias** transition on musical boundaries (entry/exit cues, quantised points), never mid-phrase. Our connections should wait for a bar/phrase end by default, or switching will sound like a glitch. Their Q&A threads are also a list of what confuses users (post-exit not playing, pre-entry replaying on loop), so expose a "what plays next" preview.
- **Elektron trig conditions** show per-step rules can be compact (1:2, 4:4, fill, last) and that conditions AND chance stack, so define stacking order of chance, count and cue and show it.
- **BeepBox** keeps the whole song in the URL: no account, instantly shareable, reproducible bug reports. Worth copying as an optional share link, on top of local storage.
- **Chrome Music Lab Song Maker** shows the beginner bar: no login, makes sound within seconds, and shares by link.
- **Nodal** makes graph traversal visible (players travelling along edges), so users see what the song is doing. A moving playhead on the canvas does the same job.
- **Strudel** keeps effects at two scopes (per event, per shared bus/orbit) and warns about conflicts when patterns share a bus. Our four-level effects need the same clear precedence.
- **Audiotool and Bespoke** show a modular/patch approach can be friendly in the browser when devices are few and visible. Both are also reminders that plugin ecosystems live or die on a small, stable API.

### What no one else combines the way this app does

- A **song-level canvas of sections** whose connections carry **count, chance, take-turns and on-cue rules**, with forks and parallel branches. Closest are Live follow actions (a list, not a graph) and game middleware (conditions, but tuned to game state, for sound designers).
- The **same canvas opening into a per-instrument step grid** with chance/nudge/ratchet per note. Elektron has the step rules but no graph; Nodal has the graph but no grid.
- **Free, no account, local-only, in the browser** together with the above. The browser DAWs (BandLab, Soundtrap, Audiotool, Amped) all want accounts; the generative browser tools (Smol, Automata, NoiseCraft) are modular patchers for people who know what an oscillator is.
- **User-imported SoundFont/SFZ/loose-file packs** inside a beginner tool. I could not confirm SoundFont/SFZ import for any browser product above, though several may do it (UNVERIFIED).
- Honest caveat: each single feature (chance, loops, effects, MIDI, WAV/MP3 export, plugins) exists elsewhere, and Live with follow actions plus a MIDI clip grid gets surprisingly close in function. The distinct claim is the combination at a beginner's price and friction level, not any one feature.

### UNVERIFIED

- Wwise: official pages returned 403; price, music-container behaviour and F-ratings come from search snippets only. Onlinesequencer.net and BandLab help also 403 to fetch; facts from search results.
- FMOD: fmod.com is a script-rendered page; free-Indie $600k figure is from a search snippet, not read on the page.
- Chrome Music Lab Song Maker: page rendered only a "use Chrome" notice; WAV/MIDI download and no-login claims come from search results and Google's blog snippet; whether the Apache-2.0 repo contains Song Maker not checked.
- cables.gl licence name (GitHub API returned none, page says "open source").
- Licences not stated: Smol Sequencer, Musical Automata Editor, Online Sequencer, Audiotool, Amped (proprietary assumed).
- Prices not on page: Polyend Tracker/Tracker+, OP-Z, Nodal, Elias, Learning Music, Soundtrap paid plans, BandLab paid plans.
- SoundFont/SFZ import: not confirmed for any browser product. Per-note chance in Live 12, Strudel probability functions (degradeBy etc.), OP-Z probability: not confirmed on the pages read.
- Smol Sequencer: only module names and buttons seen; the graph and rules model is unverified.
- Soundtrap export, Audiotool export formats, JummBox export formats, Sonic Pi WAV recording: not confirmed.
