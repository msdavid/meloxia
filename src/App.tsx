import { useState } from "react";
import { AudioEngine } from "./audio/engine";
import { SamplePads } from "./audio/sampler";
import { Synth } from "./audio/synth";
import { LevelMeter } from "./components/LevelMeter";
import { PadsPanel } from "./components/PadsPanel";
import { SynthPanel } from "./components/SynthPanel";
import { TransportBar } from "./components/TransportBar";

export const PAD_COUNT = 4;

interface Rig {
  engine: AudioEngine;
  synth: Synth;
  pads: SamplePads;
}

/**
 * Sound check: a throwaway bench that exercises the audio layer (synth,
 * sample pads, transport) until the real workflow UI is designed.
 */
export function App() {
  const [rig, setRig] = useState<Rig | null>(null);

  async function start() {
    const engine = await AudioEngine.start();
    setRig({
      engine,
      synth: new Synth(engine.master),
      pads: new SamplePads(engine.master, PAD_COUNT),
    });
  }

  if (!rig) {
    return (
      <main className="gate">
        <h1>Meloxia</h1>
        <p>Browsers keep audio muted until you ask nicely.</p>
        <button className="primary" onClick={start}>
          Start audio
        </button>
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>Meloxia</h1>
        <span className="tag">sound check</span>
        <LevelMeter engine={rig.engine} />
      </header>
      <TransportBar engine={rig.engine} />
      <SynthPanel synth={rig.synth} />
      <PadsPanel pads={rig.pads} padCount={PAD_COUNT} />
    </main>
  );
}
