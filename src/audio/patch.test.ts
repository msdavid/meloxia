import { describe, expect, it } from "vitest";
import { DEFAULT_PATCH, patchToVoiceOptions } from "./patch";

describe("patchToVoiceOptions", () => {
  it("maps patch fields onto the Tone.js voice", () => {
    const options = patchToVoiceOptions({
      ...DEFAULT_PATCH,
      waveform: "square",
      attack: 0.1,
      sustain: 0.7,
      cutoff: 800,
      resonance: 5,
      envAmount: 2,
    });
    expect(options.oscillator).toEqual({ type: "square" });
    expect(options.envelope).toMatchObject({ attack: 0.1, sustain: 0.7 });
    expect(options.filter).toMatchObject({ type: "lowpass", Q: 5 });
    expect(options.filterEnvelope).toMatchObject({ baseFrequency: 800, octaves: 2 });
  });

  it("gives the filter envelope the amplitude envelope's shape", () => {
    const { envelope, filterEnvelope } = patchToVoiceOptions(DEFAULT_PATCH);
    expect(filterEnvelope).toMatchObject(envelope as object);
  });
});
