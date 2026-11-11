# Meloxia

## Design principles

These outrank feature richness. Apply them to every mockup, screen and API.

- **Friendly to non-musicians.** Labels are plain English with a one-line explanation where a term could puzzle: Loudness, Length, Chance, Timing, Repeat, Echo, Room, Speed, Note; never velocity, gate, probability, ratchet, delay, reverb, tempo, pitch. "bpm" is fine as a small unit after a number, never as a label. The interface never says "AI": the feature is "Suggest notes", its result a "suggestion". Tooltips describe ("Closes the panel."), they do not give orders. Defaults keep people out of trouble (notes stay in the song's key unless that is switched off).
- **Intuitive.** One habit everywhere: click acts, double-click opens, right-click opens settings. Whatever is set shows where it is set, without opening a panel. Everything can be undone.
- **Explained.** Every control has a tooltip: its name, one plain sentence on what it does, and its shortcut if it has one.
- **Snappy.** Every interaction answers within a frame. Slow work (loading samples, importing packs, exporting audio) never blocks the interface.
- **Rich underneath.** Advanced settings exist, behind defaults that already sound right.

## Working rules

- The interface is designed as clickable mockups in `mockups/` before any app code: plain HTML, CSS and JS, silent, each mockup a copy of the previous one with one feature area added.
- App code is TypeScript.
- Audio sample files never go in git; `samples/` is ignored and filled from a manifest.
- Nothing is stored on a server: user data stays in the browser or in files the user saves.
- The app never restricts or inspects what users import, save or share (instruments, plugins, songs); that responsibility is theirs. Saved files are complete: everything needed to play travels inside them.
- Research and its decisions live in `docs/research/`.
