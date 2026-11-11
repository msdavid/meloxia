import * as Tone from "tone";

/** A row of one-shot sample pads, each holding one audio file. */
export class SamplePads {
  private readonly players: (Tone.Player | null)[];

  constructor(
    private readonly output: Tone.InputNode,
    padCount: number,
  ) {
    this.players = Array.from({ length: padCount }, () => null);
  }

  /** Decode an audio file (anything the browser can play) into a pad. */
  async loadFile(pad: number, file: File): Promise<void> {
    const buffer = await Tone.getContext().decodeAudioData(await file.arrayBuffer());
    this.loadBuffer(pad, buffer);
  }

  loadBuffer(pad: number, buffer: AudioBuffer): void {
    this.players[pad]?.dispose();
    this.players[pad] = new Tone.Player(buffer).connect(this.output);
  }

  isLoaded(pad: number): boolean {
    return this.players[pad] != null;
  }

  /** Play the pad's sample from the start; retriggering overlaps rather than cuts. */
  trigger(pad: number, time?: Tone.Unit.Time): void {
    this.players[pad]?.start(time);
  }

  dispose(): void {
    this.players.forEach((player) => player?.dispose());
  }
}
