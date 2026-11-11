import { useEffect, useRef, useState } from "react";
import { codeToMidi, shiftOctave } from "../music/keymap";

interface NoteHandlers {
  noteOn: (midi: number) => void;
  noteOff: (midi: number) => void;
}

/**
 * Plays notes from the computer keyboard (see `music/keymap`) and returns the
 * current base octave. Typing in a form field is left alone.
 */
export function useKeyboardPiano(handlers: NoteHandlers, initialOctave = 4): number {
  const [octave, setOctave] = useState(initialOctave);
  const latest = useRef({ handlers, octave });
  latest.current = { handlers, octave };

  useEffect(() => {
    // Remembers which note each held key started, so releasing it stops that
    // note even if the octave changed in between.
    const held = new Map<string, number>();

    const down = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.matches("input, select, textarea")) return;
      const { handlers, octave } = latest.current;
      const shifted = shiftOctave(event.code, octave);
      if (shifted !== null) return setOctave(shifted);
      const midi = codeToMidi(event.code, octave);
      if (midi === null || held.has(event.code)) return;
      held.set(event.code, midi);
      handlers.noteOn(midi);
    };

    const up = (event: KeyboardEvent) => {
      const midi = held.get(event.code);
      if (midi === undefined) return;
      held.delete(event.code);
      latest.current.handlers.noteOff(midi);
    };

    const releaseAll = () => {
      held.forEach((midi) => latest.current.handlers.noteOff(midi));
      held.clear();
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", releaseAll);
    return () => {
      releaseAll();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", releaseAll);
    };
  }, []);

  return octave;
}
