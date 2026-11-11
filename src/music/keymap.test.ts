import { describe, expect, it } from "vitest";
import { codeToMidi, MAX_OCTAVE, MIN_OCTAVE, shiftOctave } from "./keymap";

describe("codeToMidi", () => {
  it("maps the home row to white keys and the row above to black keys", () => {
    expect(codeToMidi("KeyA", 4)).toBe(60);
    expect(codeToMidi("KeyW", 4)).toBe(61);
    expect(codeToMidi("KeyK", 4)).toBe(72);
  });

  it("follows the base octave", () => {
    expect(codeToMidi("KeyA", 3)).toBe(48);
  });

  it("ignores keys that are not piano keys", () => {
    expect(codeToMidi("KeyQ", 4)).toBeNull();
    expect(codeToMidi("Space", 4)).toBeNull();
  });
});

describe("shiftOctave", () => {
  it("moves down with Z and up with X", () => {
    expect(shiftOctave("KeyZ", 4)).toBe(3);
    expect(shiftOctave("KeyX", 4)).toBe(5);
  });

  it("stays within range", () => {
    expect(shiftOctave("KeyZ", MIN_OCTAVE)).toBe(MIN_OCTAVE);
    expect(shiftOctave("KeyX", MAX_OCTAVE)).toBe(MAX_OCTAVE);
  });

  it("ignores other keys", () => {
    expect(shiftOctave("KeyA", 4)).toBeNull();
  });
});
