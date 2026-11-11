"use strict";
// Mockup data: one demo song, the instrument list and small shared helpers.

const STEPS_PER_BAR = 16;
const NODE_W = 224;
const NODE_H = 140;
const START_W = 84;
const START_H = 36;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (min, value, max) => Math.max(min, Math.min(max, value));
const esc = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* ---------- icons (16px, stroked) ---------- */

const ICONS = {
  play: '<path d="M5 3.2v9.6l8-4.8z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" stroke="none"/>',
  plus: '<path d="M8 3.5v9M3.5 8h9"/>',
  minus: '<path d="M3.5 8h9"/>',
  x: '<path d="M4 4l8 8M12 4l-8 8"/>',
  down: '<path d="M4 6l4 4 4-4"/>',
  left: '<path d="M10 3.5L5.5 8l4.5 4.5"/>',
  copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.8"/><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"/>',
  trash: '<path d="M2.8 4.5h10.4M6.3 4.5V2.8h3.4v1.7M4.3 4.5l.6 8.7h6.2l.6-8.7"/>',
  open: '<path d="M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9"/>',
  drum: '<ellipse cx="8" cy="5.3" rx="5.5" ry="2.5"/><path d="M2.5 5.3v5.2c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V5.3"/>',
  wave: '<path d="M1.5 8c1.1-5 2.2-5 3.25 0s2.2 5 3.25 0 2.2-5 3.25 0 2.2 5 3.25 0"/>',
  section: '<rect x="2" y="3" width="12" height="10" rx="2.2"/><path d="M2 6.8h12M6 6.8V13M10 6.8V13"/>',
  fork: '<path d="M2.5 8h3.5c2.5 0 2.5-4 5.5-4h2M6 8c2.5 0 2.5 4 5.5 4h2"/>',
  repeat: '<path d="M3 7.2A3.2 3.2 0 0 1 6.2 4H12M10.2 2.2L12 4l-1.8 1.8M13 8.8A3.2 3.2 0 0 1 9.8 12H4M5.8 13.8L4 12l1.8-1.8"/>',
  note: '<path d="M3 3h10v6.5L9.5 13H3zM13 9.5H9.5V13"/>',
  bars: '<path d="M3 13.5V8.5M6.3 13.5V4M9.7 13.5V6.5M13 13.5V2.5"/>',
  up: '<path d="M4 10l4-4 4 4"/>',
  keys: '<rect x="2" y="3" width="12" height="10" rx="1.8"/><path d="M6 3v6.2M10 3v6.2M4.6 9.2h2.8M8.6 9.2h2.8"/>',
  fit: '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>',
  sliders: '<path d="M2.5 4.5h11M2.5 11.5h11"/><circle cx="6" cy="4.5" r="1.8" fill="currentColor"/><circle cx="10.5" cy="11.5" r="1.8" fill="currentColor"/>',
  knob: '<circle cx="8" cy="8" r="5.5"/><path d="M8 8l2.9-2.9"/>',
  grip: '<path d="M6 3.5h.01M10 3.5h.01M6 8h.01M10 8h.01M6 12.5h.01M10 12.5h.01" stroke-width="2.4"/>',
  lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
  reset: '<path d="M3.2 8.5A4.8 4.8 0 1 0 4.6 4.6M4.4 2v2.8h2.8"/>',
};

const icon = (name) => `<svg class="i" viewBox="0 0 16 16" aria-hidden="true">${ICONS[name]}</svg>`;

/* ---------- music ---------- */

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const NOTE_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const noteName = (midi) => NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);

// Instruments belong to the song; each section picks which of them play.
const INSTRUMENTS = [
  { id: "kick", name: "Kick", kind: "drum", group: "Drums", hue: 14 },
  { id: "snare", name: "Snare", kind: "drum", group: "Drums", hue: 344 },
  { id: "clap", name: "Clap", kind: "drum", group: "Drums", hue: 318 },
  { id: "hat", name: "Closed hat", kind: "drum", group: "Drums", hue: 46 },
  { id: "ohat", name: "Open hat", kind: "drum", group: "Drums", hue: 64 },
  { id: "tom", name: "Tom", kind: "drum", group: "Drums", hue: 28 },
  { id: "rim", name: "Rimshot", kind: "drum", group: "Drums", hue: 296 },
  { id: "shaker", name: "Shaker", kind: "drum", group: "Drums", hue: 86 },
  { id: "bass", name: "Bass", kind: "sampled", group: "Instruments", hue: 262, octave: 1, tag: "Electric bass" },
  { id: "lead", name: "Lead", kind: "synth", group: "Instruments", hue: 188, octave: 3, tag: "Basic synth" },
  { id: "pad", name: "Pad", kind: "sampled", group: "Instruments", hue: 212, octave: 2, tag: "String ensemble" },
  { id: "pluck", name: "Pluck", kind: "sampled", group: "Instruments", hue: 158, octave: 3, tag: "Harp" },
  { id: "keys", name: "Keys", kind: "sampled", group: "Instruments", hue: 132, octave: 2, tag: "Grand piano" },
];

/** Yellows through cyans are too light for white note labels on the paper look. */
const lightHue = (hue) => hue >= 20 && hue <= 208;

// Instruments are drums and sampled instruments from downloadable banks, plus one basic synth. Sampled and synth are
// both melodic: they play pitches, so they get pitch lanes, Length and Pitch; only the synth can glide.
const melodic = (instrument) => instrument.kind !== "drum";
const glyphFor = (instrument) => ({ drum: "drum", sampled: "keys", synth: "wave" })[instrument.kind];

const inst = (id) => INSTRUMENTS.find((instrument) => instrument.id === id);

/** Pitches a melodic row can use, highest first: two octaves of the song's scale. */
function lanesFor(instrument) {
  const base = 12 * (instrument.octave + 1);
  const pitches = [];
  for (const octave of [0, 1]) for (const interval of MINOR) pitches.push(base + 12 * octave + interval);
  pitches.push(base + 24);
  return pitches.reverse();
}

const defaultPitch = (instrument) => 12 * (instrument.octave + 2);

/* ---------- notes ---------- */

// Every note carries its own settings. A drum cell is null or one note; a melodic cell is a list of notes.
const NOTE_DEFAULTS = { loud: 80, chance: 100, nudge: 0, repeat: 1 };
const TONE_DEFAULTS = { len: 1, glide: false };
const note = (extra = {}) => ({ ...NOTE_DEFAULTS, ...extra });
const tone = (pitch, len = 1, extra = {}) => note({ pitch, ...TONE_DEFAULTS, len, ...extra });

/** Loudness drawn as fill height: full at the default and above (louder adds a cap line), down to 30 % at 1. */
const loudHeight = (loud) => (loud >= NOTE_DEFAULTS.loud ? 100 : 30 + (70 * (loud - 1)) / (NOTE_DEFAULTS.loud - 1));
/** In the pitch lanes and the canvas thumbnails, loudness is opacity instead. */
const loudOpacity = (loud) => 0.45 + (0.55 * (loud - 1)) / 99;

/* ---------- demo song ---------- */

// Drum patterns, one character per step: . rest, x normal, X loud, o soft, g ghost (quiet, plays half the time),
// 2 a double hit, > a little late, < a little early.
const DRUM_CODES = {
  x: {},
  X: { loud: 100 },
  o: { loud: 38 },
  g: { loud: 28, chance: 50 },
  2: { loud: 90, repeat: 2 },
  ">": { nudge: 30 },
  "<": { nudge: -25 },
};
const drum = (pattern) => [...pattern.replace(/\s/g, "")].map((c) => (c === "." ? null : note(DRUM_CODES[c])));
/** A melodic row from { step: [tone, ...] }. */
const mel = (steps, notes) => Array.from({ length: steps }, (_, s) => notes[s] ?? []);
const chord = (pitches, len) => pitches.map((pitch) => tone(pitch, len));
const row = (id, cells) => ({ inst: id, mute: false, solo: false, open: false, strip: false, tab: "loud", level: 100, cells });

const SECTION_HUES = [205, 150, 28, 280, 338, 95, 248];
const SECTION_NAMES = ["Bridge", "Break", "Drop", "Build", "Outro"];

const state = {
  bpm: 118,
  view: { x: 0, y: 0, z: 1 },
  start: { x: 44, y: 142 },
  sections: [
    {
      id: "intro",
      name: "Intro",
      hue: 205,
      x: 190,
      y: 90,
      bars: 2,
      repeats: 1,
      rows: [
        row("kick", drum("x... .... .... .... x... .... .... ..x.")),
        row("hat", drum("..X. ..o. ..X. ..o. ..X. ..o. ..X. ..oo")),
        row("pad", mel(32, { 0: chord([48, 51, 55], 8), 8: chord([48, 51, 55], 8), 16: chord([44, 48, 51], 8), 24: chord([46, 50, 53], 8) })),
      ],
    },
    {
      id: "verse",
      name: "Verse",
      hue: 150,
      x: 500,
      y: 90,
      bars: 2,
      repeats: 2,
      rows: [
        row("kick", drum("x... ..x. x... ...2 x... ..x. x..x ...2")),
        row("snare", drum(".... X... ...g X... .... X... .g.. X..o")),
        row("hat", drum("XoXo XoXo Xo>o XoXo XoXo XoXo Xo>o XoXX")),
        row(
          "bass",
          mel(32, {
            0: [tone(36, 3)],
            3: [tone(36, 2, { loud: 60 })],
            6: [tone(36, 2)],
            8: [tone(39, 3)],
            11: [tone(36, 3)],
            14: [tone(34, 2)],
            16: [tone(32, 3)],
            19: [tone(32, 2, { loud: 60 })],
            22: [tone(32, 2)],
            24: [tone(31, 3)],
            27: [tone(31, 2, { nudge: -20 })],
            30: [tone(34, 2)],
          }),
        ),
      ],
    },
    {
      id: "chorus",
      name: "Chorus",
      hue: 28,
      x: 810,
      y: 230,
      bars: 2,
      repeats: 2,
      rows: [
        row("kick", drum("X... x... x... x... X... x... x... x.x2")),
        row("clap", drum(".... x... .... x... .... x... .... x...")),
        row("hat", drum("..X. ..o. ..X. ..o. ..X. ..o. ..X. ..o.")),
        row("bass", mel(32, { 0: [tone(36, 2)], 2: [tone(36)], 6: [tone(36, 2)], 8: [tone(36, 2)], 10: [tone(36)], 14: [tone(39, 2, { repeat: 2 })], 16: [tone(32, 2)], 18: [tone(32)], 22: [tone(32, 2)], 24: [tone(34, 2)], 26: [tone(34)], 30: [tone(31, 2)] })),
        row(
          "lead",
          mel(32, {
            0: [tone(67, 2)],
            2: [tone(70)],
            4: [tone(72, 4, { glide: true })],
            8: [tone(70, 2)],
            10: [tone(67, 2, { chance: 60 })],
            12: [tone(63, 4)],
            16: [tone(65, 2)],
            18: [tone(67, 2, { nudge: 25 })],
            20: [tone(63, 4)],
            24: [tone(62, 4)],
            28: [tone(60, 4, { loud: 55 })],
          }),
        ),
      ],
    },
  ],
  // One connection out of each block: the song is a chain that starts at "start".
  edges: [
    { from: "start", to: "intro" },
    { from: "intro", to: "verse" },
    { from: "verse", to: "chorus" },
  ],
  selected: null, // { type: "node" | "edge", id }
  openId: null, // section shown in the editor
  liveEdge: null, // source of the connection the song just followed
  seq: 0,
};

const sec = (id) => state.sections.find((section) => section.id === id);
const isOn = (cell) => (Array.isArray(cell) ? cell.length > 0 : !!cell);
