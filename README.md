# Synthia

A music production app that runs entirely in the browser: a synthesizer and a
sequencer in one place, with algorithmic helpers for the composing.

## Status

Design phase. The interface is being designed first, as clickable HTML mockups
in `mockups/` (no sound, no engine behind them). The app code is a small
foundation: the audio layer works and a throwaway **sound check** page
exercises it.

Decided so far:

- Workflow: a song is a canvas of **sections** connected into a flow; opening a
  section shows a step grid with one row per instrument
  (`mockups/01-song-canvas`).
- Sound engine: [Tone.js](https://tonejs.github.io/) on the Web Audio API.
- Sound sources: instruments from freely downloadable sample banks, plus one
  basic synth.
- You write the notes; the app will offer helpers (Euclidean rhythms,
  scale-locked randomisers, arpeggiators and the like).
- TypeScript throughout.

## Run

```sh
pnpm install
pnpm dev        # sound check at http://localhost:5173
pnpm test       # unit tests (pure logic only; Node has no Web Audio)
pnpm build      # type-check and bundle to dist/
```

On the sound check page: `A S D F G H J K` play white keys, `W E T Y U` black
keys, `Z`/`X` shift the octave. Load or drop an audio file on a pad to play it.

## Layout

| Path | What lives there |
|---|---|
| `src/audio/engine.ts` | Master bus (limiter, meter), transport, metronome |
| `src/audio/synth.ts` | Polyphonic subtractive synth |
| `src/audio/patch.ts` | The synth patch as plain data, and its mapping to Tone.js |
| `src/audio/sampler.ts` | One-shot sample pads |
| `src/music/` | Note and keyboard maths, no audio dependencies |
| `src/components/`, `src/hooks/`, `src/App.tsx` | The sound check UI (temporary) |
| `mockups/` | Interface mockups: plain HTML, CSS and JS, one folder per mockup, opened directly in a browser |

Audio code that needs a running `AudioContext` is checked in a browser; logic
worth unit-testing is kept in modules that import Tone.js for types only.
