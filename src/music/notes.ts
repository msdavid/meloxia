const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/** Scientific pitch name for a MIDI note number: 60 -> "C4". */
export function midiToName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** MIDI note number of C in the given octave: 4 -> 60. */
export function octaveToMidi(octave: number): number {
  return 12 * (octave + 1);
}

export function isBlackKey(midi: number): boolean {
  return NAMES[((midi % 12) + 12) % 12].endsWith("#");
}
