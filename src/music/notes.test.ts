import { describe, expect, it } from "vitest";
import { isBlackKey, midiToName, octaveToMidi } from "./notes";

describe("midiToName", () => {
  it("names notes in scientific pitch notation", () => {
    expect(midiToName(60)).toBe("C4");
    expect(midiToName(69)).toBe("A4");
    expect(midiToName(61)).toBe("C#4");
    expect(midiToName(59)).toBe("B3");
    expect(midiToName(0)).toBe("C-1");
    expect(midiToName(127)).toBe("G9");
  });
});

describe("octaveToMidi", () => {
  it("returns the C of the octave", () => {
    expect(octaveToMidi(4)).toBe(60);
    expect(octaveToMidi(-1)).toBe(0);
  });
});

describe("isBlackKey", () => {
  it("picks out the sharps", () => {
    const blacks = Array.from({ length: 12 }, (_, i) => 60 + i).filter(isBlackKey);
    expect(blacks).toEqual([61, 63, 66, 68, 70]);
  });
});
