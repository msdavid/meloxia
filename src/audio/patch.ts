import type { MonoSynth } from "tone";

/** The (deeply partial) options a Tone.js MonoSynth voice accepts. */
export type VoiceOptions = NonNullable<ConstructorParameters<typeof MonoSynth>[0]>;

export const WAVEFORMS = ["sine", "triangle", "sawtooth", "square"] as const;
export type Waveform = (typeof WAVEFORMS)[number];

/** Everything that defines the synth's sound. Plain data, so it can be saved, copied and randomised. */
export interface SynthPatch {
  waveform: Waveform;
  /** Envelope times in seconds; `sustain` is a 0-1 level. */
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  /** Low-pass filter resting frequency, in Hz. */
  cutoff: number;
  /** Filter resonance (Q). */
  resonance: number;
  /** How many octaves above `cutoff` the filter opens on each note. */
  envAmount: number;
  /** Output level in dB. */
  volume: number;
}

export const DEFAULT_PATCH: SynthPatch = {
  waveform: "sawtooth",
  attack: 0.01,
  decay: 0.2,
  sustain: 0.5,
  release: 0.4,
  cutoff: 400,
  resonance: 2,
  envAmount: 3,
  volume: -12,
};

/**
 * Tone.js voice options for a patch. The filter envelope shares the amplitude
 * envelope's shape for now, to keep the patch small.
 */
export function patchToVoiceOptions(patch: SynthPatch): VoiceOptions {
  const { attack, decay, sustain, release } = patch;
  return {
    oscillator: { type: patch.waveform },
    envelope: { attack, decay, sustain, release },
    filter: { type: "lowpass", rolloff: -24, Q: patch.resonance },
    filterEnvelope: {
      attack,
      decay,
      sustain,
      release,
      baseFrequency: patch.cutoff,
      octaves: patch.envAmount,
    },
  };
}
