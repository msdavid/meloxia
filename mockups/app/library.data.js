"use strict";
// Library demo data: the 26-instrument starter set from docs/research/instrument-banks.md ("Starter set"), with the
// families the library shows on the left. Sizes are the research's estimates after conversion; layers and takes come
// from the sample file names. "here" marks instruments already on this device (the ones the demo song uses).

const LIB_FAMILIES = [
  ["pianos", "Pianos"],
  ["keys", "Keys"],
  ["organ", "Organ"],
  ["bass", "Bass"],
  ["guitar", "Guitar"],
  ["strings", "Strings"],
  ["brass", "Brass"],
  ["woodwind", "Woodwind"],
  ["mallets", "Mallets"],
  ["voices", "Voices"],
  ["kits", "Drum kits"],
  ["machines", "Drum machines"],
  ["perc", "Percussion"],
  ["synth", "Synth"],
  ["imports", "My imports"],
  ["plugins", "From plugins"],
];

const LIB_CC0 = "Free for any use (CC0)";
const LIB_VSCO = "VSCO 2 Community Edition by Versilian Studios (CC0)";
const LIB_VCSL = "Versilian Community Sample Library (CC0)";
const LIB_KARO = (name) => `${name} by D. Smolken / Karoryfer Samples (CC0)`;

/** { id, name, fam, bank, mb, layers, takes, here, licence, credit, note } — layers: loudness levels; takes: recordings per note. */
const LIBRARY = [
  { id: "grand", name: "Grand piano", fam: "pianos", bank: "Salamander Grand Piano", mb: 46, layers: 8, here: true,
    licence: "Free with credit (CC BY 3.0)", credit: "Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0", note: "A Yamaha C5 concert grand" },
  { id: "upright", name: "Upright piano", fam: "pianos", bank: "FreePats Upright Piano KW", mb: 4, layers: 2,
    licence: LIB_CC0, credit: "Upright Piano KW, FreePats project (CC0)", note: "A homely Kawai upright" },
  { id: "epiano", name: "Electric pianos", fam: "keys", bank: "Greg Sullivan E-Pianos", mb: 8.2, layers: 4,
    licence: "Free with credit (CC BY 4.0)", credit: "Electric pianos by Greg Sullivan (sullivang.net), SFZ mapping by kinwie, CC BY 4.0",
    note: "Wurlitzer, Yamaha CP80 and Hohner Pianet in one" },
  { id: "rhodes", name: "Rhodes", fam: "keys", bank: "jRhodes3c", mb: 2.2, layers: 5,
    licence: "Free with credit, not for sale (CC BY-NC-SA 4.0)", credit: "jRhodes3c by Jeff Learman, CC BY-NC-SA 4.0", note: "A 1977 Rhodes Mark I" },
  { id: "organ", name: "Pipe organ", fam: "organ", bank: "VSCO 2 Community Edition", mb: 7, layers: 1,
    licence: LIB_CC0, credit: LIB_VSCO, note: "A church organ, full registration" },
  { id: "dbass", name: "Double bass", fam: "bass", bank: "D. Smolken Double Bass", mb: 6.4,
    licence: LIB_CC0, credit: "Double bass by D. Smolken (CC0)", note: "Plucked upright bass" },
  { id: "ebass", name: "Electric bass", fam: "bass", bank: "Karoryfer Swagbass", mb: 8.5, layers: 3, takes: 2, here: true,
    licence: LIB_CC0, credit: LIB_KARO("Swagbass"), note: "A bass guitar with flatwound strings" },
  { id: "aguitar", name: "Acoustic guitar", fam: "guitar", bank: "Karoryfer Shinyguitar", mb: 11, layers: 4, takes: 2,
    licence: LIB_CC0, credit: LIB_KARO("Shinyguitar"), note: "An archtop guitar, recorded with a microphone" },
  { id: "eguitar", name: "Electric guitar", fam: "guitar", bank: "Karoryfer Emilyguitar", mb: 8, layers: 4, takes: 2,
    licence: LIB_CC0, credit: LIB_KARO("Emilyguitar"), note: "Clean, straight from the pickups: add Grit for crunch" },
  { id: "strings", name: "String ensemble", fam: "strings", bank: "VSCO 2 Community Edition", mb: 25, here: true,
    licence: LIB_CC0, credit: LIB_VSCO, note: "Violins, violas and cellos, held or plucked" },
  { id: "cello", name: "Cello", fam: "strings", bank: "Karoryfer Bigcat Cello", mb: 10,
    licence: LIB_CC0, credit: "Bigcat Cello by Karoryfer Samples (CC0)", note: "A solo cello, bowed or plucked" },
  { id: "harp", name: "Harp", fam: "strings", bank: "VSCO 2 Community Edition", mb: 3.5, layers: 1, here: true,
    licence: LIB_CC0, credit: LIB_VSCO, note: "A concert harp" },
  { id: "trumpet", name: "Trumpet", fam: "brass", bank: "VSCO 2 Community Edition", mb: 5.5,
    licence: LIB_CC0, credit: LIB_VSCO, note: "Long and short notes" },
  { id: "horn", name: "French horn", fam: "brass", bank: "VSCO 2 Community Edition", mb: 5,
    licence: LIB_CC0, credit: LIB_VSCO, note: "Warm, held notes" },
  { id: "flute", name: "Flute", fam: "woodwind", bank: "VSCO 2 Community Edition", mb: 3.5,
    licence: LIB_CC0, credit: LIB_VSCO, note: "Long and short notes" },
  { id: "clarinet", name: "Clarinet", fam: "woodwind", bank: "VSCO 2 Community Edition", mb: 6.6,
    licence: LIB_CC0, credit: LIB_VSCO, note: "Long and short notes" },
  { id: "sax", name: "Alto sax", fam: "woodwind", bank: "Karoryfer Weresax", mb: 10, layers: 2, takes: 2,
    licence: LIB_CC0, credit: "Weresax by Karoryfer Samples (CC0)", note: "Soft and loud playing" },
  { id: "marimba", name: "Marimba", fam: "mallets", bank: "Versilian Community Sample Library", mb: 3.2, layers: 3,
    licence: LIB_CC0, credit: LIB_VCSL, note: "Wooden bars, soft to loud" },
  { id: "vibes", name: "Vibraphone", fam: "mallets", bank: "Versilian Community Sample Library", mb: 4.2, layers: 2,
    licence: LIB_CC0, credit: LIB_VCSL, note: "Metal bars, hard mallets" },
  { id: "choir", name: "Invisible choir", fam: "voices", bank: "Jovica on Freesound", mb: 2,
    licence: "Free with credit (CC BY 4.0)", credit: '"Melodrone multisample 13 - Invisible Choir" by Jovica (freesound.org), CC BY 4.0',
    note: "A dreamy, choir-like drone. Not real singers: add a real choir with Add instruments" },
  { id: "rock", name: "Rock kit", fam: "kits", bank: "AVL Drumkits", mb: 3, layers: 5, here: true,
    licence: "Free with credit, share alike (CC BY-SA 3.0)", credit: "AVL Drumkits by Glen MacArthur (bandshed.net), CC BY-SA 3.0",
    note: "Two kits: Black Pearl and Red Zeppelin" },
  { id: "jazz", name: "Jazz kit", fam: "kits", bank: "Virtuosity Drums", mb: 16, layers: 4, takes: 2,
    licence: LIB_CC0, credit: "Virtuosity Drums by Versilian Studios and Karoryfer Samples (CC0)", note: "Played with sticks, heard from the room" },
  { id: "tr808", name: "808-style machine", fam: "machines", bank: "Hydrogen TR808EmulationKit", mb: 0.1,
    licence: "Free, share alike (GPL)", credit: "TR808EmulationKit by ArtemioLabs, from the Hydrogen project (GPL)",
    note: "Made from scratch to sound like a Roland TR-808" },
  { id: "rom80s", name: "80s drum machines", fam: "machines", bank: "Free Wave Samples", mb: 0.5,
    licence: "Free to use and host", credit: "Sounds by Jason Champion, freewavesamples.com", note: "A Yamaha RX-15 and a Kawai XD-5" },
  { id: "uzu", name: "Electronic kit", fam: "machines", bank: "uzu-drumkit", mb: 0.3,
    licence: "Public domain (Unlicense)", credit: "uzu-drumkit by Mot4i, Switch Angel and Ludens (Unlicense)", note: "Punchy electronic hits" },
  { id: "handperc", name: "Hand percussion", fam: "perc", bank: "AVL Percussions", mb: 0.3, layers: 4,
    licence: "Free with credit, share alike (CC BY-SA 3.0)", credit: "AVL Percussions by Glen MacArthur (bandshed.net), CC BY-SA 3.0",
    note: "Cajon, bongos, shakers, tambourine, cowbell, claves" },
  { id: "synth", name: "Basic synth", fam: "synth", bank: "Built into Meloxia", mb: 0, here: true, builtin: true,
    licence: "Part of Meloxia", credit: "", note: "Shapes its sound from four wave pictures" },
];

// The kind the editor and instrument panel use, as in state.js INSTRUMENTS: drum (one row per sound), sampled or synth.
for (const it of LIBRARY) it.kind ??= ["kits", "machines", "perc"].includes(it.fam) ? "drum" : it.builtin ? "synth" : "sampled";

/* ---------- Add instruments: demo packs (what "pretend to drop" offers) ---------- */

// Format support follows the import phases in instrument-banks.md: phase 1 works now, phase 2 is next,
// Kontakt, GigaStudio and sfArk are "convert first with ConvertWithMoss".
const IMP_IMPORT_FORMATS = {
  now: ["Folders and zips of sound files (WAV, FLAC, AIFF, OGG, MP3)", "SoundFont (.sf2, .sf3, .dls)", "SFZ (.sfz with its sound files)"],
  next: ["Decent Sampler (.dspreset)", "Hydrogen drum kits (.h2drumkit)", "Bitwig (.multisample)", "Renoise (.xrni)"],
  convert: ["Kontakt (.nki, .nkx, .ncw)", "GigaStudio (.gig)", "sfArk (.sfark)", "Ableton packs"],
};

const IMP_DEMO_DROPS = [
  { key: "loose", label: "A folder of sound files", tip: "Acts as if you dropped a folder of sound files, each named after the note it plays.",
    name: "Kalimba (my recordings)", files: ["kalimba_C4_soft.wav", "kalimba_C4_hard.wav", "kalimba_E4_soft.wav", "kalimba_E4_hard.wav",
      "kalimba_G4_soft.wav", "kalimba_G4_hard.wav", "kalimba_B4_soft.wav", "kalimba_B4_hard.wav", "kalimba_D5_soft.wav", "kalimba_D5_hard.wav"] },
  { key: "drums", label: "A zip of drum hits", tip: "Acts as if you dropped a zip of single drum hits.",
    name: "Tape drums", zip: "tape-drums.zip", files: ["Kick 01.wav", "Kick 02.wav", "Snare Tight.wav", "Snare Roomy.wav", "HiHat Closed.wav",
      "HiHat Open.wav", "Clap.wav", "Tom Low.wav", "Rim.wav", "Shaker Loop.wav"] },
  { key: "sf2", label: "A SoundFont (.sf2)", tip: "Acts as if you dropped a SoundFont: one file holding a whole set of instruments.",
    file: "GeneralUser GS v2.0.3.sf2", mb: 32.3,
    found: [["Acoustic Grand Piano", 12, 6], ["Nylon Guitar", 18, 4], ["Fretless Bass", 9, 3], ["Strings", 22, 4], ["Standard Drum Kit", 47, 3]],
    lost: "Filters and wobble settings stored inside the file are not kept. The sounds, notes and loudness layers are." },
  { key: "sfz", label: "An SFZ instrument", tip: "Acts as if you dropped a folder with an .sfz file and the sound files it uses.",
    file: "Dave Choir.sfz", mb: 141, found: [["Dave Choir", 352, 2]],
    lost: "Crossfades between loudness layers and the pack's own effects are not kept." },
  { key: "nki", label: "A Kontakt library", tip: "Acts as if you dropped a Kontakt (.nki) instrument, a format Meloxia cannot read.", file: "Studio Strings.nki", locked: true },
];

// Guess a note name, a loudness level and a drum from a file name (the research's ~150-line guesser, in miniature).
const IMP_NOTE_RE = /(?:^|[^a-z])([a-g](?:#|b)?)(-?\d)(?![a-z0-9])/i;
const IMP_SOFT_HARD = [[/soft|pp|_p\b|quiet/i, 1], [/med|mf|mp/i, 2], [/hard|ff|loud|_f\b/i, 3]];
const IMP_DRUM_WORDS = [[/kick|bd|bass ?drum/i, "kick"], [/snare|sd/i, "snare"], [/clap|cp/i, "clap"], [/open/i, "ohat"],
  [/hat|hh/i, "hat"], [/tom/i, "tom"], [/rim/i, "rim"], [/shak/i, "shaker"]];
const IMP_DRUM_ROWS = [["kick", "Kick"], ["snare", "Snare"], ["clap", "Clap"], ["hat", "Closed hat"], ["ohat", "Open hat"], ["tom", "Tom"],
  ["rim", "Rimshot"], ["shaker", "Shaker"], ["skip", "Leave out"]];

function impGuessFile(name) {
  const base = name.replace(/\.[a-z0-9]+$/i, "");
  const note = base.match(IMP_NOTE_RE);
  const level = IMP_SOFT_HARD.find(([re]) => re.test(base))?.[1] ?? 0;
  const drum = IMP_DRUM_WORDS.find(([re]) => re.test(base))?.[1] ?? null;
  const pitch = note ? note[1][0].toUpperCase() + note[1].slice(1).toLowerCase() + note[2] : null;
  return { name, note: pitch, level, drum };
}

const impLooksLikeDrums = (guesses) => guesses.filter((g) => g.drum).length > guesses.length / 2;

/* ---------- extra icons for the library and MIDI screens (added to the shared set, not replacing any) ---------- */

Object.assign(ICONS, {
  check: '<path d="M3.5 8.5l3 3 6-7"/>',
  download: '<path d="M8 2.5v8M4.8 7.5L8 10.7l3.2-3.2M3 13.5h10"/>',
  search: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2l3.3 3.3"/>',
  folder: '<path d="M2.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"/>',
  file: '<path d="M4 2.5h5l3 3v8H4zM9 2.5v3h3"/>',
  midi: '<circle cx="8" cy="8" r="5.5"/><path d="M5.2 8h.01M10.8 8h.01M8 5.2h.01M6 6h.01M10 6h.01" stroke-width="2"/>',
  link: '<path d="M6.5 9.5l3-3M5.5 7.5L4 9a2.1 2.1 0 0 0 3 3l1.5-1.5M10.5 8.5L12 7a2.1 2.1 0 0 0-3-3L7.5 5.5"/>',
});
