import { useState } from "react";
import type { SamplePads } from "../audio/sampler";

export function PadsPanel({ pads, padCount }: { pads: SamplePads; padCount: number }) {
  const [names, setNames] = useState<(string | null)[]>(() => Array(padCount).fill(null));
  const [error, setError] = useState<string | null>(null);

  async function load(pad: number, file: File | undefined) {
    if (!file) return;
    try {
      await pads.loadFile(pad, file);
      setNames((current) => current.map((name, i) => (i === pad ? file.name : name)));
      setError(null);
    } catch {
      setError(`Could not decode "${file.name}" as audio.`);
    }
  }

  return (
    <section className="panel">
      <h2>Sample pads</h2>
      <div className="pads">
        {names.map((name, pad) => (
          <div
            key={pad}
            className="pad"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void load(pad, event.dataTransfer.files[0]);
            }}
          >
            <button className="pad-hit" disabled={!name} onPointerDown={() => pads.trigger(pad)}>
              {name ?? "empty"}
            </button>
            <label className="pad-load">
              Load
              <input
                type="file"
                accept="audio/*"
                hidden
                onChange={(event) => {
                  void load(pad, event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        ))}
      </div>
      <p className="hint">Load or drop an audio file on a pad, then hit it.</p>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
