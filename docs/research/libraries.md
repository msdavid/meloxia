# Libraries and engines for Meloxia

Research of 11 Nov 2026 (worker3, for the project lead). Sources:

- versions, publish dates, licences, `types` fields and peer dependencies: the npm registry (`registry.npmjs.org/<pkg>`);
- last push, open issues + PRs and stars: the GitHub API;
- capability claims: the README or source file named in the row, read from `raw.githubusercontent.com`;
- browser support: MDN browser-compat-data.

"Size" is npm's unpacked size, a rough upper bound and not the bundle size. The benchmarks in §1 and §5 were run in Chrome on this machine (Ryzen 9 9950X, RTX 5070 Ti through Vulkan, 1920×1080 at DPR 2). Every other runtime claim is reasoning and is marked that way.

Scope:

- Most instruments come from sample banks: multi-sampled, with velocity layers.
- One basic polyphonic synth (one or two oscillators, a filter, an envelope) runs on the same engine.
- Sections can play in parallel: up to about 6 branches between a split and a join, sharing one tempo.
- Live recording from the computer keyboard and MIDI into a looping section.
- A public, no-server app: everything stays on the user's machine.
- **Chrome is the only target** (see [Decisions](#decisions)).
- Bank formats and players: see [instrument-banks.md](instrument-banks.md). It recommends a thin velocity-layer wrapper on Tone, and this document agrees.

## Decisions

| # | Decision | By |
|---|---|---|
| 1 | Tone pre-releases are allowed: pin an exact `tone@15.5.66` (`next`, 2026-10-31) and upgrade deliberately. This replaces "stay on `latest` 15.1.22". | The owner, 11 Nov |
| 2 | Chrome is the only supported browser. Safari and Firefox gaps (Web MIDI, File System Access) are not worked around. | The owner, 11 Nov |
| 3 | Export: **WAV and MP3 required**; Opus/AAC optional. | The owner, via the project lead |
| 4 | UI primitives: Base UI. | The project lead; the owner left it to worker3, who keeps it |
| 5 | Step grid: DOM grid with one Canvas overlay for the playhead and hit flashes, and per-cell updates (measured, §5). | The project lead, from the benchmark |
| 6 | Join rule is a setting on each split, with three choices: **wait for the longest branch** (default), stop with the shortest, or a named leader branch decides. A second setting says what shorter branches do meanwhile: **keep looping** (default) or fall silent. The conductor supports all of these. | The project lead |
| 7 | Tempo and swing inside a split: one value for the group, taken from the leader branch (default: the longest). Per-section tempo is ignored inside a split, and the interface says so. | The project lead |
| 8 | Voice cap, voice stealing, choke groups and lean voice chains are requirements of the first engine code, not optimisations. | The project lead |
| 9 | Export uses chunked `OfflineAudioContext` rendering. The `suspend()` spike is the first engine task after the conductor. | The project lead |
| 10 | A shared song-level room (reverb) send is an implementation choice that the effects design allows; it is not a requirement. | The project lead |
| 11 | ~~Extension contracts are plain-data and async.~~ Superseded by 16: contracts are versioned TypeScript interfaces, synchronous hooks allowed; built-ins implement them in-process. | The project lead |
| 12 | ~~Three channels only, no synchronous interception, no plugin DOM.~~ Superseded by 16. | The project lead |
| 13 | Stable ids everywhere, and a versioned project schema with a namespace per plugin. Rack slots must be re-creatable in an offline context. Kept, as conventions (16). | The project lead |
| 14 | ~~Plugin play-time rules async with a deadline.~~ Superseded by 16: plugin rules and hooks run in-process and synchronously, like built-ins. | The project lead |
| 15 | ~~Tiered rollout with sandboxed iframes and a trust prompt for audio.~~ Superseded by 16. | The project lead |
| 16 | **Plugins run with full trust in the main realm** (Obsidian model); vetting is the user's responsibility. Audio plugins allowed from the start. Supported surface: versioned registries, events, commands, synchronous before/after hooks (actions and play-time events) and UI in our DOM; internals reachable but unsupported. Conventions: commands for edits, stable ids, namespaced schema, offline-re-creatable rack slots. Safeguards: one install warning, a per-plugin off switch, start with all plugins disabled. No sandbox host, CSP or RPC proxy. | The owner, via the project lead |
| 17 | Plugins can alter the interface: add, reorder, hide or replace in named slots; override whole views; add menus and menu items (every right-click menu) and buttons; restyle through looks. Our own interface is built through the same slot, view and menu registries, and every plugin view has an error boundary with the built-in one as its fallback. | The owner, via the project lead |
| 18 | Canvas block types come from one registry (appearance, palette, ports, flow behaviour, length, editor, settings, saved form, export behaviour). Start, Section, Split and Join are defined through it. | The owner, via the project lead |
| 19 | A saved `.meloxia` file is always complete: the song, every used instrument whole, with samples deduplicated by hash, effect settings, and the plugins it depends on. No "song only" variant. Size shown before saving; streaming write and read. On open, missing instruments join the library; embedded plugins trigger the install warning, with the option to open without them (shown inactive). Autosave references the local store. | The owner, via the project lead |
| 20 | Plugin manifests declare Android-style permissions (§11 list), and a `.meloxia` file carries a root `manifest.json` of its instruments, plugins and their permissions. Opening a file shows one consent screen: accept all, accept per plugin, or open without plugins. Declarations are **shown, never enforced** (option a): headed "What this plugin's author says it does", with the fixed line "Meloxia does not check or enforce this. Plugins can access everything in the app."; "Declares nothing" when empty. The sandbox hybrid was considered and rejected. | The owner, via the project lead |

## 1. Audio engine

| Candidate | Latest (npm date) | Licence | TS | Maintenance | Size | Fit |
|---|---|---|---|---|---|---|
| **Tone.js** `tone` ([repo](https://github.com/Tonejs/Tone.js)) | `latest` 15.1.22 (2025-04-27); `next` 15.5.66 (2026-10-31) | MIT | written in TS; `next` adds "typescript strict" (#1446) | push 2026-11-01, 51 open, 14.9k stars | 5.3 MB | Covers playback (`Player`, `ToneBufferSource`, `Sampler`), the basic synth (`PolySynth`, the current `synth.ts`), about 25 effects, `Offline`, and a worker clock. Gaps: `Sampler` has no velocity layers or round robin (`Sampler.ts`: nearest sample, `playbackRate`, velocity = gain only); `Transport` is one global timeline. |
| Plain Web Audio + AudioWorklet | browser API | — | `lib.dom` | — | 0 | Everything is possible, but you rebuild the effects, smoothing and offline plumbing that Tone has. |
| Elementary `@elemaudio/core` + `web-renderer` | 4.0.1 (2024-12-10) / 4.0.3 (2024-12-21) | MIT | TS | last commit on main 2024-12-21; dormant | 0.1 + 1 MB | WASM DSP graph with sample playback; would replace Tone wholesale. |
| Faust `@grame/faustwasm` | 0.20.1 (2026-11-07) | LGPL-2.1 | TS | push 2026-11-07, 14 open | 29 MB | DSP language compiled to worklet nodes, mono or poly, offline-capable (README). Suits individual effects. |
| Csound `@csound/browser` | 7.0.0 (2026-10-22) | Apache-2.0 | TS | push 2026-11-10, 47 open | 10.9 MB | A second language and runtime. Too much. |
| Web Audio Modules `@webaudiomodules/api`/`sdk` | 2.0.0-alpha.6 (2023-03-06) / 0.0.12 (2024-07-26) | MIT | TS | untouched since 2023 and 2024 | — | Plugin standard, inactive. |

**Recommendation: Tone.js pinned at 15.5.66, used as a toolkit rather than as the conductor.** The hybrid:

- Tone provides the context, nodes, effects, the basic synth, and an in-house `LayeredSampler` (velocity layer → round robin → nearest root → `ToneBufferSource` with `playbackRate`, gain, envelope).
- Our own pure-TS conductor (§2) decides what plays and when.
- Custom DSP, if needed, goes into an AudioWorklet in Tone's context.

Nothing here blocks richer synthesis later.

### Bus routing with parallel branches

```
voice ─► instrument rack ─► section rack ─► branch strip (volume) ─► song rack ─► master
                (one per instrument   (one per *playing*                 ▲
                 per branch)           section instance)                 │
                                         └── send ─► shared song reverb ─┘
```

- Racks are instantiated per **playing instance**, not per section definition: the same section in two branches needs two section racks.
- Build them at least a bar ahead from a pool. Node creation and impulse-response loading are not instant (reasoning).
- Keep a branch's racks alive after the join until their delay and reverb tails decay, then return them to the pool.
- Sample `AudioBuffer`s are shared across branches; only the node chains are per branch.
- Reverb: prefer one song-level send over a convolver per branch. Six per-branch convolvers cost about 10% more render time in the stress test (0.33× vs 0.36×).

### Voice budget (measured)

Method: Chrome `OfflineAudioContext`, 48 kHz, 20 s, 140 BPM 16ths. Samples last 0.3–1.8 s, pitched ±12 semitones. Each branch has a section rack (3-band EQ, compressor, feedback delay), and there is a shared convolver send and a master compressor. "Full" voice = source → gain envelope → biquad → stereo panner. "Lean" voice = source → gain, with filter and pan at row level. Voices are scheduled in 0.25 s chunks with `suspend()`, as the live lookahead would, and disconnected on `ended`. Realtime factor = audio seconds rendered per wall second (1.0 = just keeps up, single audio thread).

| Load | Voices/s | Peak live voices | Full voice | Lean voice |
|---|---|---|---|---|
| 1 branch × 30 hits/step | 280 | 494 | 4.47× | — |
| 6 branches × 5 hits/step | 280 | 494 | 3.69× | — |
| 6 × 15 | 840 | 1,473 | 1.17× | 2.85× |
| 6 × 30 (worst case) | 1,680 | 2,925 | 0.36× (0.33× with a convolver per branch) | 1.22× |
| 1 × 30, all 20 s scheduled up front | 280 | — | **0.37×** (5 s up front: 5.03×) | — |

Reading the numbers:

- Main-thread cost is about 34 µs per full voice to create and schedule: about 6% of the main thread at 1,680 voices/s. The audio thread is the limit.
- With about 3× headroom on this desktop, the budget is **about 500 live full voices, or about 1,500 lean ones**. A laptop has less (not measured).
- The design therefore needs:
  - a global voice cap (default around 384, user-adjustable);
  - per-instrument polyphony and choke groups, and stealing by age and level;
  - lean voice chains: add the per-voice filter and panner only when the note-level rack uses them;
  - releases capped per instrument.
- A graph holding nodes for the whole song is about 12× slower. Scheduling must stay incremental, offline too (§9).

## 2. Scheduling and clock

| Candidate | Source | Fit |
|---|---|---|
| Tone `Transport` + `Part`/`Sequence` | `Transport.ts`: `bpm` is a `TickParam`, global `swing`, `scheduleOnce` | One linear timeline. Run-time graph decisions, per-section tempo and parallel branches all fight it. |
| **Own conductor on Tone's clock** | `Context.ts`: `clockSource: "worker"`, `lookAhead: 0.1`, `updateInterval: 0.05`; `Ticker.ts` worker with an `"offline"` mode; the context emits `"tick"` | Pure functions over a tempo map; sample-accurate absolute times; testable in Node. |
| Own worker clock (`worker-timers` 8.0.34, 2026-07-21, MIT) | [repo](https://github.com/chrisguttandin/worker-timers) | Only if we leave Tone. |
| Clock in an AudioWorklet | pattern | Pays only if the voices live in the worklet too. |

**Recommendation: own conductor on Tone's `"tick"`, scheduling at absolute context times, with seeded RNG.**

### Parallel branches

- **Cursors.** The conductor keeps a set of *cursors*, one per active branch. Each cursor walks its own chain, and all of them read **one shared tempo map** in beats.
- **Split and join.** A split spawns cursors on the same beat. A join is a barrier. Its rule needs a decision: wait for the longest branch, cut the others when the first finishes, or join on the next bar after the last finishes.
- **Tempo.** Per-section tempo conflicts with the shared tempo. Proposed rule: inside a split, the split's tempo applies and a section's own tempo is ignored, with a UI hint.
- **Determinism.** Every cursor is scheduled in the same tick, in a fixed order. Each gets its own RNG stream derived from the song seed and its branch path, so adding a branch does not reshuffle the others' chance rolls.
- **Lookahead.** Six cursors only multiply the voice count (§1), not the scheduling latency.

### Live recording into a looping section

- **Timestamps.** `KeyboardEvent.timeStamp` and `MIDIMessageEvent.timeStamp` are `DOMHighResTimeStamp`s on the `performance.now()` timeline. The Web MIDI spec sets the latter to "the time the message was received by the system".
- **Mapping to the audio clock.** Take `ts = ctx.getOutputTimestamp()` (Chrome 57). Then `heard = ts.contextTime + (event.timeStamp − ts.performanceTime) / 1000` is the context time of the sample the speaker was playing when the key went down (MDN: `contextTime` is the "output audio stream position"). That is exactly what the player was playing along to, so output latency and Tone's lookahead are already accounted for.
- **Input latency.** Subtract a per-device input offset found by a tap-along calibration: the user taps 16 beats to the click, and the median error is stored per input.
- **Into the grid.** Map `heard` through the conductor's tempo map to the loop position, modulo the loop length. The nearest step becomes the step; the remainder becomes the nudge, clamped to ±½ step. A note that rounds past the loop end wraps to step 0. Key-up or note-off gives the length, MIDI velocity (0–127, through a curve) gives the loudness, and `KeyboardEvent.repeat` is ignored.
- **Output latency for monitoring.** Live monitoring costs `ctx.baseLatency + ctx.outputLatency` (`outputLatency`: Chrome 102). Create the context with `latencyHint: "interactive"`. Show that latency in settings, and offer an optional loopback test (mic hears the click) to verify it.
- **Native Web MIDI or a wrapper.** Native: `navigator.requestMIDIAccess()` needs a secure context and "may prompt the user" (MDN). Note-on, note-off and velocity are three bytes, and the spec delivers one complete message per event. A wrapper (`webmidi` 3.3.1, Apache-2.0) adds parsing comfort but no timing accuracy, so it does not earn its place.

## 3. Effects

| Source | Version / licence | Contents (verified) | Caveats |
|---|---|---|---|
| **Tone built-in** | as §1 | `Tone/effect/`: AutoFilter, AutoPanner, AutoWah, BitCrusher, Chebyshev, Chorus, Distortion, FeedbackDelay, Freeverb, FrequencyShifter, JCReverb, Phaser, PingPongDelay, PitchShift, Reverb, ReverseDelay, StereoWidener, Tremolo, Vibrato. `component/dynamics/`: Compressor, Gate, Limiter, MidSideCompressor, MultibandCompressor. Plus EQ3, Filter, Convolver | Algorithmic reverbs are basic; use `Convolver` with impulse-response files. |
| Tuna.js `tunajs` | 1.1.3 (2026-01-04), MIT | Bitcrusher, Cabinet, Chorus, Compressor, Convolver, Delay, Filter, MoogFilter, Overdrive, Panner, Phaser, PingPongDelay, Tremolo, WahWah | 4 uses of the deprecated `createScriptProcessor`; duplicates Tone. |
| Faust libraries via faustwasm | LGPL-2.1 compiler; [faustlibraries](https://github.com/grame-cncm/faustlibraries) has no repo-level licence | Studio-grade DSP compiled to worklets | Build step; licence per function UNVERIFIED. |

**Recommendation: Tone effects plus `Convolver` with impulse responses.** Racks exist at four levels: note amount (lean unless used), instrument, section and song. Parallel branches get their own instrument and section racks (§1). Reverb is a song-level send.

## 4. Node canvas

| Candidate | Latest | Licence | Maintenance | React 19 | Fit |
|---|---|---|---|---|---|
| **React Flow `@xyflow/react`** | 12.12.1 (2026-11-02) | MIT | push 2026-11-10, 140 open, 39k stars | peer `>=17` | Custom nodes and edges in React; `EdgeLabelRenderer` for HTML edge labels ([docs](https://reactflow.dev/api-reference/components/edge-label-renderer)); pan, zoom, selection and minimap built in. |
| Rete.js + `rete-react-plugin` | 2.0.6 (2025-06-30) / 2.1.2 (2026-07-10) | MIT | push 2026-10-25 | `^19`, needs `styled-components` | Its graph engine adds nothing, because our conductor walks the graph. |
| litegraph (`@comfyorg/litegraph` 0.17.2) | 2025-08-06 | MIT | fork pushed 2026-01-14 | not React | Canvas-drawn, foreign to React. |
| reaflow 5.4.1 | 2025-04-08 | Apache-2.0 | push 2025-06-04 | `>=16` | Auto-layout diagrams, not free placement. |
| Hand-rolled SVG + DOM | — | — | — | — | Weeks of work to reach what React Flow already has. |

**Recommendation: React Flow**, with its node and edge arrays derived from our store. A split and a join are node types with several outputs or inputs.

## 5. Step grid / piano-roll rendering (measured)

Method: a throwaway page with the worst case:

- 8 bars × 16 steps × 12 rows, two of them expanded into 15 pitch lanes (42 lanes, 5,376 cells);
- notes as bars spanning 1–4 steps;
- a playhead moving every frame;
- 30 cells flashing per step at 140 BPM.

The DOM styling copies `mockups/01-song-canvas` (cells with `::before`, glow `box-shadow`, `hit` scale-and-brightness flash). The page ran in Chrome with a real GPU, at normal CPU speed and at 4× CPU throttle (standing in for a laptop), with 20 s of playback per run. "Toggle" is click-to-next-painted-frame, so it includes waiting for the next frame (16.7 ms at 60 Hz).

| Variant | CPU | Initial render | Toggle p50 / max | Frame avg / p95 / max | Frames > 20 ms |
|---|---|---|---|---|---|
| DOM, mockup flash (WAAPI on `::before`) | 1× | 40 ms | 22 / 27 ms | 18.5 / 33 / 67 ms | 109 / 1080 |
| DOM, mockup flash (class + forced reflow, as the mockup does) | 1× | 42 ms | 24 / 35 ms | 18.6 / 33 / 67 ms | 109 / 1076 |
| DOM, opacity-only flash | 1× | — | — | 16.7 / 16.8 / 16.8 ms | 0 / 1200 |
| DOM, no flashes | 1× | — | — | 16.7 / 16.7 / 16.8 ms | 0 / 1200 |
| Canvas 2D (static layer + overlay) | 1× | 26 ms | 17 / 37 ms | 16.7 / 16.7 / 16.8 ms | 0 / 1200 |
| **DOM grid + Canvas overlay** (playhead and flashes on canvas) | 1× | 58 ms | 22 / 28 ms | 16.7 / 16.7 / 16.8 ms | 0 / 1200 |
| DOM, mockup flash | 4× | 174 ms | 45 / 67 ms | 80.7 / 133 / 167 ms | 236 / 249 |
| DOM, opacity-only flash | 4× | — | — | 41.6 / 67 / 100 ms | 307 / 482 |
| DOM, no flashes | 4× | — | — | 16.7 / 16.7 / 16.8 ms | 0 / 1201 |
| Canvas 2D | 4× | 48 ms | 16 / 19 ms | 16.7 / 16.8 / 16.8 ms | 0 / 1200 |
| **DOM grid + Canvas overlay** | 4× | 157 ms | 36 / 54 ms | 16.7 / 16.7 / 16.8 ms | 0 / 1200 |

Re-rendering the whole grid on each toggle (what the mockup's `renderEditor()` does) took a p50 of 38 ms at 1×, and 157 ms at 4×.

**Recommendation: DOM grid with a Canvas overlay.**

- The DOM grid keeps the CSS theming, hit-testing and accessibility. A transform-moved DOM playhead is free.
- The cost is in the 30 flashes per step: style recalculation and repaint on a 5,900-node tree. The mockup's flash drops 10% of frames even on this desktop, and at 4× even opacity-only flashes fail.
- Moving the playhead and the flashes onto one transparent canvas over the grid holds 60 fps at 4×.
- Toggles must update only the cell that changed, never re-render the grid. Pure canvas is the fallback if the grid ever grows beyond this worst case.

## 6. State, undo/redo and persistence

| Candidate | Latest | Licence | Notes |
|---|---|---|---|
| **zustand** | 5.1.0 (2026-11-06) | MIT | 2 open issues; also used by React Flow. |
| **immer** (patches) | 11.2.10 (2026-11-10) | MIT | `produceWithPatches` → an inverse-patch command history with gesture grouping. |
| zundo | 2.3.0 (2024-11-17) | MIT | Snapshot undo middleware; last release a year ago. |
| mobx-keystone / Yjs | 2.4.3 / 13.6.33 | MIT | Bigger paradigms; Yjs only if sync ever matters. |
| **idb** | 8.0.4 (2026-10-06) | ISC | Thin IndexedDB wrapper. |
| Dexie | 4.4.7 (2026-10-19) | Apache-2.0 | Queries and migrations; 587 open issues. |
| **OPFS** (native) | Chrome 86 | — | Large binaries. `opfs-tools` 0.8.1 is optional sugar. |
| **`@zip.js/zip.js`** | 2.24.0 (2026-10-16) | BSD-3-Clause | README: Zip64 (archives over 4 GB), streams, incremental writing, workers. 8.5 MB unpacked. |
| fflate | 0.8.3 (2026-05-16) | MIT | Small and fast (778 KB unpacked); Zip64 support not confirmed in its README. |
| JSZip | 3.10.2 (2026-09-08) | MIT or GPL-3.0 | 391 open issues; whole archive in memory (reasoning). |

**Recommendation: zustand + immer patch history; `idb` for documents; OPFS for binaries; `@zip.js/zip.js` for the project file.**

For a public app with no server, everything lives on the user's machine:

1. **Autosave and eviction.**
   - Write the project document to IndexedDB on every committed history entry (debounced) and on `pagehide`.
   - Store samples in OPFS, named by SHA-256 content hash (`crypto.subtle`), so duplicates are stored once.
   - Call `navigator.storage.persist()` (Chrome 55) after the first save or import. MDN: non-persistent origins are evicted least-recently-used first, and persistent ones are skipped.
   - Chrome allows an origin up to 60% of the disk (MDN). Show usage from `storage.estimate()`.
   - Chrome grants `persist()` heuristically (UNVERIFIED criteria), so the app should keep nudging the user to save a real file. That file is the only true backup.
2. **Real files on disk.**
   - `showSaveFilePicker` / `showOpenFilePicker` (Chrome 86; Firefox none).
   - Keep the `FileSystemFileHandle` in IndexedDB so "Save" rewrites the same file. Whether a permission re-prompt appears each session is UNVERIFIED.
   - Fallback: `<a download>` and `<input type=file>`. It is cheap, even with Chrome as the only target.
3. **Single-file project, `.meloxia` = zip, always complete and portable** (decision 19).
   - Contents:
     - `project.json`: a versioned schema with a `format` number and migrations;
     - `instruments/<id>/`: every instrument the song uses, **whole** (all zones and layers, not just the notes played, so the song stays editable), with its map;
     - `samples/<sha256>.<ext>`: the original bytes, one copy per content hash, shared across instruments;
     - effect settings, inside `project.json`;
     - `plugins/<id>@<version>/`: the bundles of every plugin the song depends on, each with its SHA-256.
   - There is no "song only" variant. Sample licences are the user's responsibility.
   - Audio barely compresses, so samples use STORE (reasoning).
   - Show the computed size before saving; a layered piano alone can run to hundreds of MB (instrument-banks.md).
   - **Streaming both ways.** zip.js writes straight into a `FileSystemWritableFileStream` and reads entries lazily from the `File` (Zip64 for files over 4 GB). Hashing and zip work run in a worker, so the interface never freezes on a large file (reasoning; zip.js advertises workers).
   - `manifest.json` at the root lists instruments, plugins with their declared permissions, and the total size. It feeds the consent screen (decision 20).
   - **Opening a file:**
     - Instruments whose sample hashes are not already in the local store are added to the user's library (same hash means already present, so nothing is copied).
     - Embedded plugins are never run silently. The user sees the install warning listing them (decision 16) and can choose to open the song without them, in which case their blocks and effects show as inactive placeholders (§11, block types).
   - **Browser autosave** keeps referencing the local sample store by hash. It never duplicates samples into IndexedDB.
4. **Imported instrument packs in OPFS.**
   - One importer per format converts a bank into `/packs/<id>/`: converted samples plus a JSON map. The pack index lives in IndexedDB. Deleting a pack frees its quota.
   - Decode zones lazily with `decodeAudioData` and evict decoded buffers under memory pressure. Decoded 32-bit float PCM is several times the size of the compressed file (reasoning).

## 7. UI building blocks

| Need | Candidates (latest, licence) | Pick |
|---|---|---|
| Accessible primitives | **Base UI `@base-ui/react`** 1.9.0 (2026-10-09, MIT; Slider, Menu, Context Menu, Menubar, Toolbar, Toast per base-ui.com/llms.txt; `date-fns` peers optional) · Radix `radix-ui` 1.8.1 · React Aria Components 1.22.1 (Apache-2.0, 6.8 MB) · Ark UI 5.40.0 | **Base UI** (decided) |
| Knobs and faders | `react-knob-headless` 0.4.0 peers React ≤18 only; `webaudio-controls` not on npm | Hand-roll on pointer events with `role="slider"`, or wrap the Base UI Slider |
| Drag and drop | `@dnd-kit/react` 0.5.3 (pre-1.0) · `@dnd-kit/core` 6.3.1 (2024-12-05) · `@atlaskit/pragmatic-drag-and-drop` 4.0.0 (Apache-2.0) | pragmatic-drag-and-drop between panels; own drag in the grid and canvas |
| Panels | `react-resizable-panels` 4.21.0 · `dockview` 8.9.0 (both MIT) | react-resizable-panels |

## 8. Music helpers and MIDI

| Need | Candidates | Pick |
|---|---|---|
| Scales and chords | **`tonal`** 6.5.1 (2026-10-14, MIT, TS) | tonal |
| Euclidean and other generators | `euclidean-rhythms` 3.1.1 (2022, no types) | Our own Bjorklund with unit tests |
| MIDI input (**required**, for live recording) | Native Web MIDI (Chrome 43; secure context; may prompt) · `webmidi` 3.3.1 (Apache-2.0) | Native (reasons in §2, live recording) |
| MIDI files | `@tonejs/midi` 2.0.28 (2022-02-04, MIT, on top of `midi-file`) · `midi-file` 1.2.4 · `midi-writer-js` 3.2.1 | `@tonejs/midi`, with `midi-file` as the escape hatch |

## 9. Audio export

| Piece | Candidates | Pick |
|---|---|---|
| Rendering | `Tone.Offline` · a raw `OfflineAudioContext` with `suspend()` | Chunked rendering with our conductor. `OfflineContext.ts` runs every `"tick"` up front (`_renderClock` loop) before `startRendering()`, so the whole song's nodes exist at once, and that measured 12× slower (§1). Instead, render with `suspend(t)` → schedule the next chunk → `resume()`, and disconnect ended voices. Whether Tone's `OfflineContext` / `standardized-audio-context` exposes `suspend` cleanly needs a short spike (UNVERIFIED). The path through the song is fixed first by the seeded conductor, so the length is known. |
| WAV (required) | own writer (44-byte header + PCM) · Mediabunny WAVE | Own writer |
| **MP3 (required)** | **`@mediabunny/mp3-encoder`** 1.65.2 (2026-11-04) with `mediabunny` 1.65.2 · `@breezystack/lamejs` 1.2.7 (2023, LGPL-3.0) · `wasm-media-encoders` 0.7.0 (2024, no types) | `@mediabunny/mp3-encoder`. Licence MPL-2.0 (npm). It bundles a SIMD WASM build of **LAME 3.100 (LGPL)**, whose licence page asks for a credit and link, so put it on a credits page. It runs in a worker the package spawns. Its README gives about 130 kB gzipped and about 55× realtime; npm gives 2.3 MB unpacked. |
| Opus/AAC (optional) | Mediabunny + WebCodecs `AudioEncoder` (Chrome 94) | Same library, no extra code |

## 10. Testing audio code

| Layer | Candidates | Pick |
|---|---|---|
| Pure logic (conductor, cursors, swing, chance, recording quantisation, undo) | Vitest 5.1 in Node | Most timing tests live here: assert event times. |
| Real Web Audio in a browser | **`@vitest/browser` + `@vitest/browser-playwright`** 5.1.0 (2026-11-02) | Short `OfflineAudioContext` renders, asserting on samples. The benchmark driver (headless Chrome with `--use-angle=vulkan --enable-features=Vulkan --enable-gpu`) shows headless Chrome renders on the real GPU. |
| Web Audio in Node | `node-web-audio-api` 2.2.0 (BSD-3-Clause, Rust; has AudioWorklet) | Optional; Tone compatibility UNVERIFIED |
| Mocks | `standardized-audio-context-mock` 10.0.1 | Wiring tests only |

## 11. Plugin API

Working design under review (the project lead):

- Internal registries from day one, and built-ins register through the same extension points as plugins. The points: instruments, effects, pack importers, note helpers and generators, connection rule types, exporters, commands and shortcuts, panel and toolbar contributions, themes.
- An event bus for transport, edits, song-flow decisions and MIDI.
- Plugins are installed from local files, with no server and no marketplace.

### How comparable apps run third-party code

| App | Where plugin code runs | What it isolates / exposes | Cost or lesson (source) |
|---|---|---|---|
| Figma | Plugin logic in a minimal JS sandbox on the main thread: "does not expose browser APIs" (no DOM, `fetch` or `setTimeout`). UI and network in an `<iframe>` via `figma.showUI()`, linked by message passing. Network limits are enforced with CSP when the manifest restricts domains. | The sandbox sees the document ("scene") but no browser APIs; the iframe sees browser APIs but not the scene. | They first used the Realms shim (same-realm isolation). Escapes were disclosed, and they switched to "QuickJS, a JavaScript VM written in C and cross-compiled to WebAssembly", quickly, "thanks to a swappable architecture" (Figma blog, 2019; developers.figma.com "How plugins run"). |
| VS Code (web) | Extension host in a Web Worker: "restricted by the browser worker sandbox"; full VS Code API through a `require('vscode')` shim; no Node | API surface only; can spawn more workers | Manifest `engines.vscode` semver range is required and "cannot be `*`" (vscode-docs). |
| Obsidian | Unsandboxed, in the app | "Obsidian cannot reliably restrict plugins to specific permissions"; "plugins can access files on your computer". Restricted Mode is on by default | All-or-nothing trust. Manifest needs `minAppVersion` (obsidian docs). |
| tldraw | In-process SDK: the host developer adds custom shapes (`ShapeUtil`) with schema **migrations** | No sandbox; extensions are the embedding app's own code | Useful pattern: extension-owned data carries its own versioned migrations (tldraw.dev/docs/shapes). |
| Excalidraw | No plugin system ("Add Plugin System…" issue #383 closed); libraries are data | — | Data-only extension goes a long way. |
| Web Audio Modules 2 | Host `import()`s the plugin's ESM, then `createInstance(…, audioContext)`; DSP in the host's AudioWorklet | No isolation: plugin main-thread code runs in the host realm with the host's `AudioContext` | Hosting WAMs means full trust (api v2 README). |

Strudel and other web music tools were not checked.

### Sandboxing options in a browser, 2026

| Option | Hosts UI | Reaches our audio graph | Storage and network | Notes |
|---|---|---|---|---|
| **`<iframe sandbox="allow-scripts">`** (no `allow-same-origin`) | yes | no, only messages | Opaque origin that "always fails the same-origin policy", preventing storage access (MDN). Network blockable with CSP in the frame document | MDN: never combine `allow-scripts` with `allow-same-origin` for same-origin content, because the frame can then remove its own sandbox. |
| Same-origin Web Worker | no | no | **Has** `fetch` and IndexedDB (MDN worker API list), so it is not a sandbox on its own | Fine inside a sandboxed iframe, where it inherits the opaque origin (UNVERIFIED). |
| QuickJS in WASM: `quickjs-emscripten` 0.32.0 (2026-02-16, MIT, TS, 2.4 MB) | no | no | Only what the host injects | Synchronous, deterministic, can be interrupted. What Figma runs. Slower than native JS (UNVERIFIED by how much). |
| SES / Hardened JS: `ses` 2.3.0 (2026-08-13, Apache-2.0) | — | — | Same realm | Same class as the Realms shim Figma left after escapes. |
| ShadowRealm | — | — | — | TC39 Stage 2.7 (tc39/proposals): not shippable. |
| **AudioWorklet module in our context** | no | **yes**: the only real-time path into the graph | MDN lists only `currentFrame`, `currentTime`, `sampleRate`, `port` and `registerProcessor` on the scope; absence of storage and network APIs UNVERIFIED beyond that listing | One `AudioWorkletGlobalScope` per context, **shared by all modules**: a plugin can tamper with other processors and starve the 128-frame render quantum (2.67 ms at 48 kHz) for everyone. |

### Architecture (decided: full trust)

The owner's decision, 11 Nov: plugins get access to the entire application, and vetting a plugin is the user's responsibility. This is the Obsidian model. The sandbox tiers drafted earlier the same day are dropped, and the precedents and sandboxing tables above remain as the record of what was given up.

- **Where plugins run.** In the main realm, as ES modules imported by the app, with the same powers as our own code. Audio plugins (effects, synths) are allowed from the start: their DSP is an `AudioWorkletProcessor` module loaded into our context, and the host or the plugin creates the `AudioWorkletNode` and connects it into a rack slot.
- **Supported surface.** It is versioned and is the only part we keep stable:
  - **Registries**, on which built-ins and plugins use the same extension points: instruments, effects, pack importers, note helpers and generators, connection rule types, exporters, commands and shortcuts, panel and toolbar contributions, themes.
  - **Events**, after the fact: transport, edits, song-flow decisions, MIDI.
  - **Commands**, the way to edit.
  - **Synchronous before / after hooks** that can intercept and alter actions and play-time events: a note about to play, a section about to start, a connection about to be chosen. Play-time hooks run inside the conductor's tick, so they must return quickly. The conductor should time them, and report a hook that eats into the lookahead (about 100 ms).
  - **UI contributions rendered in our own DOM**, as React components in host slots.
- **Unsupported.** Reaching past the public API into internals is possible but documented as unsupported and liable to break.
- **Conventions, not enforcement:**
  - edits go through commands, so undo keeps working;
  - stable ids, and the namespaced, versioned project schema;
  - rack slots re-creatable in an offline context, because export renders in a fresh `OfflineAudioContext` and must load each plugin's worklet module and state again.
- **The one safeguard:**
  - a single install warning: "This plugin can read and change everything in Meloxia, including your songs and sounds. Only install plugins you trust.";
  - a per-plugin off switch;
  - starting the app with all plugins disabled (a safe-mode launch, e.g. a URL flag or a key held at start) when one breaks it.

### Altering the interface: slots, view overrides, menus, looks

Plugins can **add, reorder, hide or replace** what the interface shows (the owner's requirement). This works cleanly in React 19 only if our own interface is assembled through the same machinery from day one.

- **Slot registry.** Named slots throughout the app: `topbar`, `palette`, `canvas.block.<type>`, `canvas.connection`, `editor.toolbar`, `editor.row-header`, `note-inspector`, `side-panel`, `effect-card`, and so on.
  - Each slot renders `<Slot name context>`, which resolves a list of contributions `{ id, slot, order, when?(context), component }`.
  - Built-in parts are contributions with stable ids in the same slots.
  - Plugins apply operations: `add`, `move` (order, or before/after an id), `hide(id)`, `replace(id, component)`.
  - Resolution is deterministic: built-ins first, then plugins in load order, then by priority. Two plugins replacing the same id → the last wins, with a conflict listed in the plugin settings. The result is memoised per slot and context.
- **View overrides** for whole views, e.g. a different note editor in place of the step grid. `<View name="section.editor" props>` picks the highest-priority registered component and falls back to the built-in one. A view's props are its public contract: for the section editor, the section, the selection and the command API, never store internals.
- **Fault containment.**
  - Every plugin component renders inside an error boundary whose fallback is the built-in component, plus a notice with "turn this plugin off". React still has no function-component error boundary; react.dev points to a class component or `react-error-boundary` (6.1.6, MIT, peer React ^19).
  - `createRoot` options `onCaughtError` / `onUncaughtError` (react.dev) feed one plugin-error log.
  - Plugin views load with `React.lazy` + `<Suspense>`, with the built-in view as the fallback while loading.
  - Callbacks the host invokes (commands, hooks, menu actions) run inside a try/catch that reports the error and can disable the plugin.
- **Menus and buttons.**
  - A menu registry with ids for every menu, right-click menus included: `context.canvas`, `context.block`, `context.connection`, `context.cell`, `context.row`, `menubar.*`.
  - Items are `{ id, menu, group, order, when?, command }`, rendered with Base UI `Menu` / `ContextMenu` from the resolved list.
  - Buttons are slot contributions bound to command ids, so shortcuts, menus and buttons share one command registry.
- **Looks.** A look is a set of CSS custom properties, as the three mockup looks already are, plus optional CSS (full trust allows it). Our components style only through variables and documented `data-part="…"` attributes, which together are the restyling surface.
- **What this demands of our components from day one:**
  - every visible part has a stable id and lives in a named slot or view, and our own app assembles itself from the registries (no hard-wired JSX for a part a plugin may replace);
  - views take typed props only;
  - no logic depends on DOM structure;
  - siblings tolerate being hidden or replaced;
  - all actions are commands.
  - Hot paths get **no per-element slots**: the 5,376-cell grid and the canvas overlay are replaced as whole views, or extended through a view-level renderer hook, never per cell. Otherwise slot resolution would undo the §5 frame budget (reasoning).

### Block types on the song canvas

Built-in Start, Section, Split and Join are defined through the same **block-type registry** that plugins use. A block type is:

```ts
interface BlockType<S> {
  id: string;                    // "core.section", "acme.random-router"
  version: number;               // settings schema version
  migrate(old: unknown, from: number): S;
  defaults(): S;                 // plain JSON, validated
  palette: { label: string; icon: string; group: string; order: number };
  ports(s: S): { inputs: Port[]; outputs: Port[] };   // Port: id, label, min/max connections, allowed rule types
  views: { Node: Component; Editor?: Component; Settings?: Component };   // canvas, double-click, panel
  flow: {
    enter(ctx: FlowContext, s: S): BlockRun;   // called by the conductor ahead of time
  };
}
interface BlockRun {
  length: Beats | "until-cue" | "until-join";
  events?(window: TimeWindow): VoiceEvent[];   // "play something" (Section)
  exits?(ctx: FlowContext): PortId[];          // "decide a route": one = choose, several = fork
  tempo?: TempoChange; key?: KeyChange;        // applied to the shared tempo map at entry
}
```

- **What flow does.**
  - Play: Section schedules its grid.
  - Route: chance or take-turns choose among exits.
  - Control: tempo or key change at a beat.
  - Wait: `until-cue` ends on the next quantised cue.
  - Code: `enter` runs arbitrary logic.
  - Split = 1 input, N outputs that all fire (spawns cursors). Join = N inputs, 1 output, a barrier with the join-rule settings (decisions 6 and 7). Start = no inputs, 1 output.
- **Determinism.** `enter`, `events` and `exits` read time only from `FlowContext` (beats on the conductor clock) and randomness only from `ctx.random` (seeded per block run). The same code then drives live playback and offline export: the conductor runs in the render loop with no DOM. A block that uses wall-clock time or `Math.random` breaks export parity; document this as the block contract.
- **Canvas.** The registry feeds React Flow's `nodeTypes`. Ports become `Handle`s, and `isValidConnection` enforces each port's min/max and rule types. `Node` and `Editor` render inside the error boundaries above.
- **Saved form.** `blocks[]: { id, type, typeVersion, position, settings }` and `connections[]: { from: [blockId, portId], to: [blockId, portId], rule }`.
  - Settings are plain JSON, migrated with `migrate` on load.
  - A block whose plugin is missing stays in the file untouched. It is drawn as a placeholder and played as a zero-length pass-through to its first output, with a warning, so songs survive a plugin being switched off.

### Versioning and the SDK

- **Manifest:**
  - `id` and `version` (semver);
  - `engines.meloxia`: a semver range, required and never `*` (VS Code); refuse to load outside it (Obsidian's `minAppVersion` is the weaker form);
  - `contributes`: declarative where possible, so the app can list what a plugin adds before running it.
- **SDK:** `@meloxia/plugin-sdk`, typed from the same TypeScript interfaces as the registries, hooks and commands, under a versioned namespace (`meloxia.v1`). Changes within a major version are additive only; removals wait for a full major version of overlap.
- **Hooks are the expensive promise.** A before-hook that sees an action's shape freezes that shape. Keep hook payloads small, documented types rather than internal objects.
- **Plugin data in projects:**
  - It is namespaced by plugin id and carries its own schema version and migrations (tldraw pattern).
  - If a plugin is missing, the project keeps its data opaque. A missing effect becomes a pass-through, and the render warns.

### What full access means for users' data

A plugin can:

- read, change, encrypt or delete every project and sample in IndexedDB and OPFS;
- reuse stored `FileSystemFileHandle`s;
- send anything over the network;
- rewrite other plugins or itself;
- alter audio for every song.

With no marketplace there is no review and no revocation. The install warning puts this in plain words, and the user decides.

### Permissions (Android-style declarations)

Every plugin manifest declares what it uses, under `permissions`:

| Permission | Meaning |
|---|---|
| `ui.extend` | add menus, menu items, buttons, slot contributions, looks |
| `ui.replace` | hide, replace or override built-in parts and whole views |
| `song.read` / `song.write` | the open song |
| `library.read` / `library.write` | all saved songs and the instrument library |
| `blocks` | define canvas block types |
| `audio` | process audio (worklet DSP, instruments, effects) |
| `midi` | use MIDI devices |
| `microphone` | use the microphone |
| `files` | read and write files through pickers |
| `network: [hosts]` | reach the internet, listing hosts |
| `full-access` | everything, in the main realm |

A `.meloxia` file carries a root `manifest.json` listing everything it contains and needs: instruments (name, sample count, size), plugins (id, version, SHA-256, declared permissions, and which blocks and effects use them), and the total size. **Opening a file shows one consent screen** with that list: accept all, accept per plugin, or open without plugins (their blocks and effects stay inactive).

**Decided (the owner, option a): declarations are shown, never enforced.** Every plugin runs with full trust in the main realm (decision 16). The consent screen is worded so it does not over-promise:

- Each plugin's list is headed **"What this plugin's author says it does"**.
- It carries the fixed line **"Meloxia does not check or enforce this. Plugins can access everything in the app."**
- A plugin with no declarations shows **"Declares nothing"**.
- The choices are accept all, accept per plugin, or open without plugins.

**Considered and rejected: a hybrid where `full-access` is itself a permission.** Plugins requesting only limited permissions would have run in a sandboxed opaque-origin iframe behind a permission broker. That enforces songs, library, files, MIDI and microphone, mostly enforces network (a frame can still navigate itself to leak data), and only partly handles view replacement and block logic; audio would be gated but not contained. The cost was an iframe host, a schema-checked RPC, relays for devices and files, and an async-capable public API from day one. Rejected by the owner's decision: inform, do not enforce.

### Decide before the first line of app code, versus later

| Now | Can wait |
|---|---|
| The registry, event, command and hook interfaces as versioned public types; built-ins use them too | Publishing the SDK package and its docs |
| Every document change is a command or patch (needed for undo, and the convention plugins follow) | The install flow, the consent screen and the warning dialog |
| Stable ids for sections, rows, notes, instruments and racks; a versioned project schema with per-plugin namespaces | A WAM compatibility shim (WAM 2 already assumes full trust) |
| A rack-slot contract for every effect and instrument (node in/out, parameter descriptors, serialisable state, re-creatable offline) | Hook timing reports in the conductor |
| Where the conductor calls play-time hooks, and their time budget | Safe-mode launch and per-plugin off switch (needed before the first third-party plugin) |
| Slot, view and menu registries, with our own interface assembled through them; error boundaries with built-in fallbacks | Conflict reporting between plugins |
| The block-type registry, with Start, Section, Split and Join defined through it; `FlowContext` time and `ctx.random` as the only clock and randomness | Placeholder drawing for blocks of missing plugins |

## Recommended stack

| Area | Pick |
|---|---|
| Audio engine | Tone.js pinned at 15.5.66 + in-house `LayeredSampler`; lean voice chains; global voice cap |
| Clock | Own conductor (one cursor per branch, shared tempo map, seeded RNG per cursor) on Tone's worker tick |
| Effects | Tone effects + `Convolver`; racks per playing instance; reverb as a song send |
| Node canvas | `@xyflow/react` 12 |
| Step grid | DOM grid + Canvas overlay for the playhead and flashes |
| State / undo | zustand 5 + immer patches |
| Persistence | `idb` + OPFS (hash-named samples, packs) + `storage.persist()`; always-complete `.meloxia` zip (instruments, samples, plugins) streamed with `@zip.js/zip.js` through File System Access |
| UI | `@base-ui/react`, hand-rolled knobs, `react-resizable-panels`, pragmatic-drag-and-drop |
| Music / MIDI | `tonal`, own Euclid, native Web MIDI with `getOutputTimestamp` mapping, `@tonejs/midi` |
| Export | Chunked `suspend()` rendering → own WAV writer; MP3 via `@mediabunny/mp3-encoder`; optional Opus/AAC via Mediabunny |
| Testing | Vitest (Node) + Vitest browser mode with Playwright |
| Plugins | Full-trust ES modules in the main realm (decision 16): versioned registries, events, commands, sync hooks, UI in our DOM through slot, view and menu registries with error boundaries (`react-error-boundary`); block-type registry; AudioWorklet modules for DSP; install warning and safe mode |

## Risks

1. **Voice budget with parallel branches (measured).** The worst case (6 branches × 30 hits per step) is about 3× over budget on a fast desktop with full voice chains, and still marginal with lean ones. Voice caps, stealing, choke groups, lean chains and capped releases are part of the design from day one.
2. **Graph decisions about 100 ms ahead.** Joins, "on cue" transitions and edits to queued sections need quantised waits and a cancel-and-reschedule path. Main-thread stalls longer than the lookahead cause dropouts.
3. **Offline export at scale.** Tone's offline path schedules everything up front, measured 12× slower. Chunked `suspend()` rendering through Tone's context needs a spike before building export.
4. **Join semantics and tails.** Unequal branch lengths need a rule (decision), and section racks must outlive the join until their tails decay.
5. **Local-only data.** Eviction is possible without `persist()`, and Chrome's grant is heuristic. A saved `.meloxia` file is the only real backup, and the UI must make that plain.
6. **Input latency calibration.** Computer-keyboard latency is higher and less stable than MIDI (UNVERIFIED magnitude). Without calibration, recorded nudges would be systematically late.
7. **Tone pre-release pin.** `next` can change between pins; upgrades need the browser render tests.
8. **Plugin protection given up (decision 16).** There is no isolation between a plugin and the user's songs, samples, files and network, so one malicious or careless plugin can destroy or leak all local work. The only defences are the install warning, the off switch and safe mode.
9. **Shared audio thread.** Plugin DSP shares the one `AudioWorkletGlobalScope` and the 2.67 ms render quantum, so a slow effect glitches the whole song, and plugins can tamper with each other's processors.
10. **Hook surface lock-in.** Synchronous hooks on actions and play-time events turn internal shapes into public promises, and a slow play-time hook can starve the lookahead. Keep payloads small and typed, and time the hooks.

## Unverified

- Laptop performance: the grid was tested at 4× CPU throttling, and the voice test ran unthrottled on this desktop.
- Whether `persist()` is granted, and its criteria; whether File System Access re-prompts each session.
- `suspend()` through Tone's `OfflineContext`; `node-web-audio-api` with Tone.
- faustlibraries licensing per function; computer-keyboard event latency.
- Tone's GitHub release date for 15.1.22 (2026-07-12) disagrees with npm (2025-04-27); the npm date is used.
