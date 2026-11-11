"use strict";
// Demo data for the system screens (area D): the starter set and its credits, the open song's contents,
// two demo files to open, installed plugins and storage figures. Sizes are in MB.

// The 26-instrument starter set (docs/research/instrument-banks.md, "Starter set"); sizes are the estimated ogg sizes.
const STARTER = [
  { id: "grand", name: "Grand piano", family: "Pianos", bank: "Salamander Grand Piano V3", mb: 46, credit: "Salamander Grand Piano V3 by Alexander Holm", licence: "CC BY 3.0" },
  { id: "upright", name: "Upright piano", family: "Pianos", bank: "FreePats Upright Piano KW", mb: 4, credit: "Upright Piano KW, FreePats project", licence: "CC0" },
  { id: "epianos", name: "Electric pianos", family: "Keys", bank: "Greg Sullivan E-Pianos", mb: 8.2, credit: "Electric pianos by Greg Sullivan (sullivang.net), SFZ mapping by kinwie", licence: "CC BY 4.0" },
  { id: "rhodes", name: "Rhodes", family: "Keys", bank: "jRhodes3c", mb: 2.2, credit: "jRhodes3c by Jeff Learman", licence: "CC BY-NC-SA 4.0" },
  { id: "organ", name: "Pipe organ", family: "Organ", bank: "VSCO 2 Community Edition", mb: 7, credit: "VSCO 2 Community Edition by Versilian Studios", licence: "CC0" },
  { id: "dbass", name: "Double bass", family: "Bass", bank: "D. Smolken double bass", mb: 6.4, credit: "Double bass by D. Smolken", licence: "CC0" },
  { id: "ebass", name: "Electric bass", family: "Bass", bank: "Karoryfer Swagbass", mb: 8.5, credit: "Swagbass by D. Smolken / Karoryfer Samples", licence: "CC0" },
  { id: "aguitar", name: "Acoustic guitar", family: "Guitar", bank: "Karoryfer Shinyguitar", mb: 11, credit: "Shinyguitar by D. Smolken / Karoryfer Samples", licence: "CC0" },
  { id: "eguitar", name: "Electric guitar", family: "Guitar", bank: "Karoryfer Emilyguitar", mb: 8, credit: "Emilyguitar by D. Smolken / Karoryfer Samples", licence: "CC0" },
  { id: "strings", name: "String ensemble", family: "Strings", bank: "VSCO 2 Community Edition", mb: 25, credit: "VSCO 2 Community Edition by Versilian Studios", licence: "CC0" },
  { id: "cello", name: "Solo cello", family: "Strings", bank: "Bigcat Cello", mb: 10, credit: "Bigcat Cello by Karoryfer Samples", licence: "CC0" },
  { id: "trumpet", name: "Trumpet", family: "Brass", bank: "VSCO 2 Community Edition", mb: 5.5, credit: "VSCO 2 Community Edition by Versilian Studios", licence: "CC0" },
  { id: "horn", name: "French horn", family: "Brass", bank: "VSCO 2 Community Edition", mb: 5, credit: "VSCO 2 Community Edition by Versilian Studios", licence: "CC0" },
  { id: "flute", name: "Flute", family: "Woodwind", bank: "VSCO 2 Community Edition", mb: 3.5, credit: "VSCO 2 Community Edition by Versilian Studios", licence: "CC0" },
  { id: "clarinet", name: "Clarinet", family: "Woodwind", bank: "VSCO 2 Community Edition", mb: 6.6, credit: "VSCO 2 Community Edition by Versilian Studios", licence: "CC0" },
  { id: "sax", name: "Alto sax", family: "Woodwind", bank: "Karoryfer Weresax", mb: 10, credit: "Weresax by Karoryfer Samples", licence: "CC0" },
  { id: "marimba", name: "Marimba", family: "Mallets", bank: "Versilian Community Sample Library", mb: 3.2, credit: "Versilian Community Sample Library", licence: "CC0" },
  { id: "vibes", name: "Vibraphone", family: "Mallets", bank: "Versilian Community Sample Library", mb: 4.2, credit: "Versilian Community Sample Library", licence: "CC0" },
  { id: "harp", name: "Harp", family: "Strings", bank: "VSCO 2 Community Edition", mb: 3.5, credit: "VSCO 2 Community Edition by Versilian Studios", licence: "CC0" },
  { id: "choir", name: "Choir", family: "Voices", bank: "Invisible Choir (freesound.org)", mb: 2, credit: "“Melodrone multisample 13 - Invisible Choir” by Jovica (freesound.org)", licence: "CC BY 4.0" },
  { id: "kit-rock", name: "Rock kit", family: "Drum kits", bank: "AVL Drumkits", mb: 3, credit: "AVL Drumkits by Glen MacArthur (bandshed.net)", licence: "CC BY-SA 3.0" },
  { id: "kit-jazz", name: "Jazz kit", family: "Drum kits", bank: "Virtuosity Drums", mb: 16, credit: "Virtuosity Drums by Versilian Studios and Karoryfer Samples", licence: "CC0" },
  { id: "dm-808", name: "808-style machine", family: "Drum machines", bank: "Hydrogen TR808EmulationKit", mb: 0.1, credit: "TR808EmulationKit by ArtemioLabs, from the Hydrogen project", licence: "GPL-3.0-or-later" },
  { id: "dm-80s", name: "80s drum machines", family: "Drum machines", bank: "Free Wave Samples Hydrogen kits", mb: 0.5, credit: "Samples by Jason Champion, freewavesamples.com", licence: "Freeware" },
  { id: "dm-uzu", name: "Electronic kit", family: "Drum machines", bank: "uzu-drumkit", mb: 0.3, credit: "uzu-drumkit by Mot4i, Switch Angel and Ludens", licence: "Unlicense" },
  { id: "perc", name: "Percussion", family: "Percussion", bank: "AVL Percussions", mb: 0.3, credit: "AVL Percussions by Glen MacArthur (bandshed.net)", licence: "CC BY-SA 3.0" },
];

// Software Meloxia is built on, credited alongside the sounds (docs/research/libraries.md).
const SOFTWARE_CREDITS = [
  { name: "Tone.js", what: "the sound engine", licence: "MIT" },
  { name: "LAME", what: "MP3 encoding, through Mediabunny", licence: "LGPL", link: "https://lame.sourceforge.io/" },
  { name: "Mediabunny", what: "writing audio files", licence: "MPL-2.0" },
  { name: "React Flow", what: "the song canvas", licence: "MIT" },
];

// What each declared permission means, in plain words (libraries.md §11 Permissions).
const PERMISSIONS = {
  "ui.extend": "Adds to the interface: menus, buttons and panels",
  "ui.replace": "Changes or replaces parts of the interface",
  song: "Reads and changes the open song",
  library: "Reads and changes all your saved songs and instruments",
  blocks: "Adds new kinds of blocks to the song canvas",
  audio: "Processes sound",
  midi: "Uses your MIDI devices",
  microphone: "Uses your microphone",
  files: "Reads and writes files you choose",
  network: "Connects to the internet",
  "suggest-key": "Can read your suggestions key",
};

const PLUGIN_TYPES = {
  "tempo-tools": { name: "Speed tools", author: "Ada Okafor", version: "1.2.0", kb: 14, adds: "A “Speed change” block for the song canvas", perms: ["blocks", "song"] },
  euclid: { name: "Euclid rhythm generator", author: "Lumen Audio", version: "0.9.3", kb: 38, adds: "A note helper that spreads hits evenly across a row", perms: ["ui.extend", "song", "suggest-key"] },
  neon: { name: "Neon look", author: "pixelmoth", version: "2.0.1", kb: 22, adds: "A new look for the whole app", perms: ["ui.replace"] },
  "tape-warmth": { name: "Tape warmth", author: "unknown", version: "0.1.0", kb: 61, adds: "An effect that makes sounds softer and rounder", perms: [] },
  "cloud-share": { name: "Song sharer", author: "Hopscotch Labs", version: "1.0.0", kb: 45, adds: "Uploads a song and gives you a link", perms: ["song", "files", "network"], hosts: ["share.hopscotch.example"] },
};

// The open song: what Save would write.
const CURRENT_SONG = {
  name: "Night Bus",
  songKb: 64,
  sections: [
    { id: "intro", name: "Intro", bars: 4 },
    { id: "verse", name: "Verse", bars: 8 },
    { id: "chorus", name: "Chorus", bars: 8 },
  ],
  lengthSec: 182,
};

// Two files offered by Open. Instruments already in the library match by content hash.
const DEMO_FILES = [
  {
    file: "Rainy Sunday.meloxia",
    mb: 58,
    saved: "2 days ago",
    instruments: [
      { name: "Upright piano", mb: 4, have: true },
      { name: "Solo cello", mb: 10, have: true },
      { name: "Dave Choir", mb: 44, have: false, note: "imported SFZ" },
    ],
    plugins: [{ id: "tempo-tools", uses: "2 blocks" }],
  },
  {
    file: "Club night.meloxia",
    mb: 31,
    saved: "last month",
    instruments: [
      { name: "Electronic kit", mb: 0.3, have: true },
      { name: "TR-909 kit", mb: 5.4, have: false, note: "imported loose files" },
      { name: "Acid bass", mb: 0, have: false, note: "basic synth sound" },
      { name: "Warehouse pads", mb: 25, have: false, note: "imported SoundFont" },
    ],
    plugins: [
      { id: "euclid", uses: "3 rows" },
      { id: "tape-warmth", uses: "1 effect" },
      { id: "cloud-share", uses: "a menu entry" },
    ],
  },
];

// Installed plugins on the Plugins screen; "Add plugin" offers PLUGIN_TO_ADD.
const INSTALLED = [
  { id: "euclid", on: true },
  { id: "neon", on: true },
  { id: "tempo-tools", on: true },
];
const PLUGIN_TO_ADD = "tape-warmth";

// Storage figures for Preferences.
const STORAGE = {
  freeGb: 286,
  songs: { label: "Songs and autosave", mb: 2.4 }, // instruments come from the Library's own list (system.more.js)
  protected: true,
};

// What each licence asks of you, in one plain line (Credits).
const LICENCE_WHAT = {
  CC0: "No conditions: free for any use.",
  Unlicense: "No conditions: free for any use.",
  "CC BY 3.0": "Free for any use, paid work included, as long as the author is credited.",
  "CC BY 4.0": "Free for any use, paid work included, as long as the author is credited.",
  "CC BY-SA 3.0": "Free for any use with credit to the author; changed sounds are shared under the same terms.",
  "CC BY-NC-SA 4.0": "Free for unpaid use only, with credit to the author; changed sounds are shared under the same terms.",
  "GPL-3.0-or-later": "Free to use; a changed version that is shared comes with its source, under the same licence.",
  Freeware: "Free to use in your music; the sounds themselves may not be sold.",
  MIT: "Free for any use, as long as the author's copyright notice is kept.",
  LGPL: "Free to use; changes to the library itself are shared under the same licence.",
  "MPL-2.0": "Free to use; its changed files are shared under the same licence.",
};

const fmtMb = (mb) => (mb === 0 ? "no sound files" : mb < 1 ? `${Math.round(mb * 1024)} KB` : mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`);
const fmtKb = (kb) => (kb >= 1024 ? fmtMb(kb / 1024) : `${kb} KB`);
