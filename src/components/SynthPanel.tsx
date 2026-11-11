import { useState } from "react";
import { DEFAULT_PATCH, WAVEFORMS, type SynthPatch, type Waveform } from "../audio/patch";
import type { Synth } from "../audio/synth";
import { useKeyboardPiano } from "../hooks/useKeyboardPiano";
import { isBlackKey, midiToName, octaveToMidi } from "../music/notes";

type NumericKey = Exclude<keyof SynthPatch, "waveform">;

interface Control {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const CONTROLS: Control[] = [
  { key: "attack", label: "Attack", min: 0.001, max: 2, step: 0.001, unit: "s" },
  { key: "decay", label: "Decay", min: 0.01, max: 2, step: 0.01, unit: "s" },
  { key: "sustain", label: "Sustain", min: 0, max: 1, step: 0.01, unit: "" },
  { key: "release", label: "Release", min: 0.01, max: 4, step: 0.01, unit: "s" },
  { key: "cutoff", label: "Cutoff", min: 40, max: 8000, step: 1, unit: "Hz" },
  { key: "resonance", label: "Resonance", min: 0.1, max: 20, step: 0.1, unit: "" },
  { key: "envAmount", label: "Filter env", min: 0, max: 7, step: 0.1, unit: "oct" },
  { key: "volume", label: "Volume", min: -40, max: 0, step: 0.5, unit: "dB" },
];

const KEY_COUNT = 15;

export function SynthPanel({ synth }: { synth: Synth }) {
  const [patch, setPatch] = useState<SynthPatch>(DEFAULT_PATCH);
  const [sounding, setSounding] = useState<ReadonlySet<number>>(new Set());

  function noteOn(midi: number) {
    synth.noteOn(midi);
    setSounding((notes) => new Set(notes).add(midi));
  }

  function noteOff(midi: number) {
    synth.noteOff(midi);
    setSounding((notes) => {
      const next = new Set(notes);
      next.delete(midi);
      return next;
    });
  }

  const octave = useKeyboardPiano({ noteOn, noteOff });

  function update(change: Partial<SynthPatch>) {
    const next = { ...patch, ...change };
    setPatch(next);
    synth.setPatch(next);
  }

  const lowest = octaveToMidi(octave);

  return (
    <section className="panel">
      <h2>Synth</h2>
      <div className="controls">
        <label>
          Waveform
          <select value={patch.waveform} onChange={(event) => update({ waveform: event.target.value as Waveform })}>
            {WAVEFORMS.map((waveform) => (
              <option key={waveform}>{waveform}</option>
            ))}
          </select>
        </label>
        {CONTROLS.map(({ key, label, unit, ...range }) => (
          <label key={key}>
            {label}
            <input
              type="range"
              {...range}
              value={patch[key]}
              onChange={(event) => update({ [key]: event.target.valueAsNumber })}
            />
            <output>
              {patch[key]} {unit}
            </output>
          </label>
        ))}
      </div>
      <div className="keys">
        {Array.from({ length: KEY_COUNT }, (_, i) => lowest + i).map((midi) => (
          <button
            key={midi}
            className={["key", isBlackKey(midi) ? "black" : "", sounding.has(midi) ? "on" : ""].join(" ")}
            onPointerDown={() => noteOn(midi)}
            onPointerUp={() => noteOff(midi)}
            onPointerLeave={() => sounding.has(midi) && noteOff(midi)}
          >
            {midiToName(midi)}
          </button>
        ))}
      </div>
      <p className="hint">
        Play with the keyboard: A S D F G H J K are white keys, W E T Y U black keys. Z and X shift the octave
        (now {octave}).
      </p>
    </section>
  );
}
