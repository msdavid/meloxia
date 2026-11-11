import * as Tone from "tone";
import { midiToName } from "../music/notes";
import { DEFAULT_PATCH, patchToVoiceOptions, type SynthPatch } from "./patch";

/** Polyphonic subtractive synth: oscillator -> low-pass filter -> amplifier, per voice. */
export class Synth {
  private readonly poly: Tone.PolySynth<Tone.MonoSynth>;

  constructor(output: Tone.InputNode, patch: SynthPatch = DEFAULT_PATCH) {
    this.poly = new Tone.PolySynth(Tone.MonoSynth, patchToVoiceOptions(patch));
    this.poly.maxPolyphony = 16;
    this.poly.volume.value = patch.volume;
    this.poly.connect(output);
  }

  // Notes go to Tone as names: PolySynth reads a bare number as Hz when it
  // plays the voice but as a MIDI number when it tracks it.
  noteOn(midi: number, velocity = 0.8, time?: Tone.Unit.Time): void {
    this.poly.triggerAttack(midiToName(midi), time, velocity);
  }

  noteOff(midi: number, time?: Tone.Unit.Time): void {
    this.poly.triggerRelease(midiToName(midi), time);
  }

  allNotesOff(): void {
    this.poly.releaseAll();
  }

  setPatch(patch: SynthPatch): void {
    this.poly.set(patchToVoiceOptions(patch));
    this.poly.volume.value = patch.volume;
  }

  dispose(): void {
    this.poly.dispose();
  }
}
