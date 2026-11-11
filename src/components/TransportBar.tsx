import { useEffect, useState } from "react";
import { BEATS_PER_BAR, type AudioEngine } from "../audio/engine";

export function TransportBar({ engine }: { engine: AudioEngine }) {
  const [playing, setPlaying] = useState(engine.playing);
  const [bpm, setBpm] = useState(Math.round(engine.bpm));
  const [metronome, setMetronome] = useState(engine.metronomeOn);
  const [beat, setBeat] = useState(-1);

  useEffect(() => engine.onBeat(setBeat), [engine]);

  function toggle() {
    if (playing) {
      engine.stop();
      setBeat(-1);
    } else {
      engine.play();
    }
    setPlaying(!playing);
  }

  function changeBpm(value: number) {
    setBpm(value);
    if (value >= 30 && value <= 300) engine.bpm = value;
  }

  function toggleMetronome() {
    engine.metronomeOn = !metronome;
    setMetronome(!metronome);
  }

  return (
    <section className="panel transport">
      <button className="primary" onClick={toggle}>
        {playing ? "Stop" : "Play"}
      </button>
      <label>
        BPM
        <input
          type="number"
          min={30}
          max={300}
          value={bpm}
          onChange={(event) => changeBpm(event.target.valueAsNumber)}
        />
      </label>
      <label>
        <input type="checkbox" checked={metronome} onChange={toggleMetronome} />
        Metronome
      </label>
      <div className="beats" aria-label="Beat">
        {Array.from({ length: BEATS_PER_BAR }, (_, i) => (
          <span key={i} className={i === beat ? "beat on" : "beat"} />
        ))}
      </div>
    </section>
  );
}
