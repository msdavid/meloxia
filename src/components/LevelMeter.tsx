import { useEffect, useRef } from "react";
import type { AudioEngine } from "../audio/engine";

const FLOOR_DB = -60;

/** Master level bar, redrawn every animation frame without re-rendering React. */
export function LevelMeter({ engine }: { engine: AudioEngine }) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const db = Math.max(FLOOR_DB, Math.min(0, engine.levelDb()));
      if (bar.current) {
        bar.current.style.width = `${(1 - db / FLOOR_DB) * 100}%`;
        bar.current.dataset.db = db.toFixed(1);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [engine]);

  return (
    <div className="meter" title="Master level">
      <div className="meter-bar" ref={bar} />
    </div>
  );
}
