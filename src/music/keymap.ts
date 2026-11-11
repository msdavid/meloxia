import { octaveToMidi } from "./notes";

/**
 * Computer-keyboard piano, keyed by physical position (`KeyboardEvent.code`)
 * so it survives non-QWERTY layouts: the home row plays white keys, the row
 * above plays black keys.
 */
const SEMITONES: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
};

export const MIN_OCTAVE = 0;
export const MAX_OCTAVE = 7;

/** MIDI note for a key code at the given base octave, or null if the key is not a piano key. */
export function codeToMidi(code: string, octave: number): number | null {
  const semitone = SEMITONES[code];
  return semitone === undefined ? null : octaveToMidi(octave) + semitone;
}

/** New base octave after an octave-shift key (Z down, X up), or null for any other key. */
export function shiftOctave(code: string, octave: number): number | null {
  if (code === "KeyZ") return Math.max(MIN_OCTAVE, octave - 1);
  if (code === "KeyX") return Math.min(MAX_OCTAVE, octave + 1);
  return null;
}
