# Unified mockup: `mockups/app`

One clickable, silent mockup covering every feature decided so far. `CLAUDE.md` principles apply. The base is `mockups/03-section-effects` (grid, per-note settings, note drag, section panel, effects racks, tooltips). This file specifies what is added on top. Where it is silent, follow the pattern the base already uses; where you disagree, build it as written and list the objection in your report.

## Ground rules

- Vanilla HTML, CSS, JS; no dependencies, no audio. Files stay under about 500 lines; each area lives in its own files (`flow.*`, `instrument.*`, `library.*`, `record.*`, `system.*`) with its own demo data.
- One owner per file. worker1 owns `index.html`, `state.js`, `style.css`, the editor, notes, panel, effects and tooltip files, and areas B and C. worker3 owns `canvas.js` and areas A and D. worker2 owns the Library and "Add instruments" parts of area B (`library.*`) and the MIDI controllers screen of area D (`midi.*`); worker1 keeps the instrument panel, worker3 the other system screens. Need a change in someone else's file? Send them the exact lines.
- Shared components are used, never re-implemented: tooltip, side panel, popover and menu, modal dialog, toast, slider, switch, segmented control, chip. worker1 documents how to call each in a short header comment in the file that defines it.
- Every control has a tooltip. Plain English only. Transitions 200 ms or less. All three looks. 0 console errors.
- Undo and redo (top-bar buttons, Ctrl+Z, Ctrl+Shift+Z) cover note, section and canvas edits; snapshot-based is fine.

## A. Song flow on the canvas

- **Rules on connections.** Right-click a connection: "When does the song take this path?" Always · Count (first N passes, or chosen passes) · Chance (%) · Take turns · On cue · Otherwise. The rule shows as a chip on the connection ("first 2 times", "30%", "on cue", "otherwise"). A block's exits are checked in order; the section panel gains a **Flow** tab listing its exits, reorderable by drag.
- **Second exit.** Dragging another connection out of a block asks: "Choose one" (fork) or "Play together" (parallel).
- **Loops.** A connection back to an earlier block draws as an arc under the chain.
- **Parallel.** "Play together" creates a split bar and a join bar with the branches between them; a branch is a section or a chain. Up to 6 branches. Right-click the split for its required settings: Who ends it (Longest · Shortest · Leader, with a leader picker) · Shorter branches (Keep looping · Fall silent) · Same instrument in two branches (Play both · Leader only), plus the fixed note "One speed and swing for the group, taken from the leader". A warning chip appears when branches differ in key. No forks or loops inside a branch: the attempt is refused with a tooltip saying why.
- **On cue.** While playing, each reachable "on cue" exit shows a pulsing Cue button (keys 1-9); pressing it arms the exit, taken when the current pass ends.
- **Path preview.** A strip along the bottom of the canvas shows what will play, in order: section chips in their colours, parallel branches stacked, a dice mark on chance outcomes, "∞ endless" when a loop has no way out, total length when finite. The end marker and length stay pinned at the right; the chips scroll between, with a fade and arrows when there is more. Right-clicking a chip opens the settings of what it stands for. Controls: "Same every time / Surprise me" and a re-roll button. Playback highlights the current chip.
- **Insert and remove.** Dragging a block over a connection highlights it; dropping inserts the block already wired. Deleting a block with one way in and one way out reconnects its neighbours.
- **Editing while playing.** Allowed; the change applies after the current pass, with a toast saying so.
- **Palette.** Section · Play together · Note (a sticky note, see E) · a "From plugins" group with one demo block type ("Speed change"). The Fork and Repeat ideas go: rules replace them.
- Pretend playback follows the rules with a seeded random source and animates parallel branches together.

## B. Instruments

- **Instrument panel.** Clicking an instrument's name in a row header opens the side panel: name, family, source bank and credit line, "Change instrument", tabs Sound · Effects. Sound for a bank instrument: Volume, Fade in, Fade out, Brightness, Octave, Notes at once. For the basic synth: Wave shape (four pictures) plus the same. Effects is the instrument's rack.
- **Library** (large dialog). Families down the left (Pianos, Keys, Organ, Bass, Guitar, Strings, Brass, Woodwind, Mallets, Voices, Drum kits, Drum machines, Percussion, Synth, My imports, From plugins); instrument cards (name, bank, size, a "layers" badge, a preview button that animates, loaded or a pretend download with progress); search. Demo data: the 26-instrument starter set from `docs/research/instrument-banks.md`.
- **Add instruments.** A drop zone taking a folder, a zip, `.sf2`, `.sf3` or `.sfz`: shows the detected format, the instruments found, a mapping preview for loose files (guessed note names, drum assignment, both editable), progress, then the result under "My imports". A locked format (Kontakt) explains how to convert it first.
- The editor's "Add instrument" popover gains "Browse library…".

## C. Recording

- Editor header: Record (beside Loop), metronome switch, Snap (Full · Partial · Off), "Keep to the song's key" (on by default), mode Live · Step by step.
- Each row has a record dot; "Arm all drums" maps keys to drum rows and shows a key legend. A melodic row shows a keyboard strip along the bottom with the computer-key labels, limited to the song's key while that switch is on.
- Live: count-in (4-3-2-1), then real key presses (A S D F… and the drum keys) drop notes at the playhead: step from the timing, nudge from what Snap leaves over, length from how long the key is held. Passes layer; a toast offers "Undo take".
- Step by step: a cursor step; a key enters a note and advances; arrows move; Backspace removes.

## D. System screens (top-bar menu)

- **Save.** Shows what the file will contain (instruments with sizes, plugins) and the total, then progress. Files are always complete.
- **Open.** Two demo files. Then the consent screen: instruments that will be added to the library; plugins, each under "What this plugin's author says it does", with the fixed line "Synthia does not check or enforce this. Plugins can access everything in the app."; "Declares nothing" where empty. Accept all · choose per plugin · Open without plugins.
- **Export.** WAV or MP3 (with quality); whole song or this section; a length field when the song is endless; "Same as last play / New roll" for chance; progress; done toast.
- **Plugins.** Installed list with on/off, declarations and remove; "Add plugin" leading to the consent screen; a note on starting with all plugins off. Demo plugins: a rhythm generator, a look, the Tempo change block.
- **MIDI controllers.** Devices (two demo devices: one "Ready-made profile", one "Generic"); MIDI learn (click a control, then a "pretend the knob moved" button); the list of mappings; a tap-along delay calibration.
- **Credits.** Bank names and credit lines for the starter set.
- **Preferences.** Look, Show explanations, autosave status, storage used.

## E. Sticky notes (everywhere)

- One shared module. A note can sit on the canvas (free, or attached to a block or connection and moving with it), in a section's grid (anchored to a row and step, scrolling with it), and in side panels and large dialogs (shown whenever that panel or dialog is open).
- Add by dragging Note from the palette, by "Add note here" in any right-click menu on empty space, or with N at the pointer. Free text, a few colours, move, resize, delete. A note never blocks clicks outside its own box.
- Minimise collapses a note to an icon in place; hovering the icon shows the full text; clicking reopens it at the same size. Each view offers "Minimise all notes / Show all notes".
- A note can carry one arrow: pulled out from a handle, its tip dragged anywhere to re-aim or resize it, attaching to whatever it is dropped on and following it; dropped back on the note it is removed. The arrow stays when the note is minimised.
- A section block shows a badge with the count of notes inside it. Notes are song data: saved with the song and covered by undo.

## Report format

At most 30 lines: what was built against each bullet (pass or not, how exercised in a real browser), deviations and objections, line counts, console error count, tooltip coverage count.
