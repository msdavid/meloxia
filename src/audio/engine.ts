import * as Tone from "tone";

export const BEATS_PER_BAR = 4;

type BeatListener = (beat: number) => void;

/**
 * The shared audio plumbing: a master bus every instrument plays into, the
 * transport (tempo and play/stop) and a metronome.
 */
export class AudioEngine {
  /** Instruments connect here. Signal flow: master -> limiter -> speakers. */
  readonly master: Tone.Gain;
  metronomeOn = false;

  private readonly limiter: Tone.Limiter;
  private readonly meter: Tone.Meter;
  /** Bypasses the master bus so the click never ends up in the mix. */
  private readonly click: Tone.Synth;
  private readonly beatListeners = new Set<BeatListener>();

  /** Browsers only allow audio after a user gesture, so call this from a click or key handler. */
  static async start(): Promise<AudioEngine> {
    await Tone.start();
    return new AudioEngine();
  }

  private constructor() {
    this.limiter = new Tone.Limiter(-1).toDestination();
    this.meter = new Tone.Meter();
    this.master = new Tone.Gain().fan(this.limiter, this.meter);
    this.click = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
      volume: -10,
    }).toDestination();

    const transport = Tone.getTransport();
    transport.scheduleRepeat((time) => {
      const beat = Math.round(transport.getTicksAtTime(time) / transport.PPQ) % BEATS_PER_BAR;
      if (this.metronomeOn) {
        this.click.triggerAttackRelease(beat === 0 ? "C6" : "C5", "32n", time);
      }
      // The callback runs slightly ahead of the audio; Draw waits until the beat
      // is audible, by which time the transport may have been stopped.
      Tone.getDraw().schedule(() => {
        if (this.playing) this.beatListeners.forEach((listen) => listen(beat));
      }, time);
    }, "4n");
  }

  /** Master bus level in dB (-Infinity when silent). */
  levelDb(): number {
    const value = this.meter.getValue();
    return Array.isArray(value) ? Math.max(...value) : value;
  }

  get bpm(): number {
    return Tone.getTransport().bpm.value;
  }

  set bpm(bpm: number) {
    Tone.getTransport().bpm.value = bpm;
  }

  get playing(): boolean {
    return Tone.getTransport().state === "started";
  }

  play(): void {
    Tone.getTransport().start();
  }

  /** Stops and rewinds to the start. */
  stop(): void {
    Tone.getTransport().stop();
  }

  /** Calls `listener` with the beat number (0-based within the bar) as each beat sounds. Returns an unsubscribe function. */
  onBeat(listener: BeatListener): () => void {
    this.beatListeners.add(listener);
    return () => this.beatListeners.delete(listener);
  }
}
