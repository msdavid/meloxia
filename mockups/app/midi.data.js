"use strict";
// MIDI controllers demo data, from docs/research/midi-controllers.md: two example devices (one with a ready-made
// profile, one generic), a third to "plug in" that needs the extra permission for its lights, and the profile phases.

const MIDI_DEVICES = {
  lkm3: {
    name: "Novation Launchkey Mini MK3", kind: "profile", port: "Launchkey Mini MK3 MIDI Port", ignored: ["DAW"],
    does: [
      ["Keys", "Play the selected row's instrument. While recording, they drop notes at the playhead."],
      ["Pads", "Play the drum rows. The bottom row plays Kick, Snare, Clap, Closed hat, Open hat, Tom, Rimshot and Shaker; the top row plays them again, for two-handed rolls."],
      ["Knobs 1–8", "Move the selected instrument's sliders. Each picks up where its slider is, so nothing jumps."],
      ["Play and Record", "Start and stop the song, and start recording."],
      ["Bend and wobble strips", "Bend the note, and add wobble."],
    ],
    controls: ["Knob 1", "Knob 2", "Knob 3", "Knob 4", "Knob 5", "Knob 6", "Knob 7", "Knob 8"],
    ccs: [21, 22, 23, 24, 25, 26, 27, 28],
    // From two captures of a real unit: drum pads on channel 10 (top row first), knobs CC 21–28 and Play / Record CC 115 / 117 on channel 1.
    pads: [40, 41, 42, 43, 48, 49, 50, 51, 36, 37, 38, 39, 44, 45, 46, 47], dawPads: [96, 97, 98, 99, 100, 101, 102, 103, 112, 113, 114, 115, 116, 117, 118, 119],
    buttons: { 115: "Play", 117: "Record" }, keys: [48, 72],
  },
  usb: {
    name: "USB MIDI Keyboard", kind: "generic", port: "USB MIDI Keyboard", ignored: [],
    does: [
      ["Keys", "Play the selected row's instrument. While recording, they drop notes at the playhead."],
      ["Knobs, faders, pads", "Do nothing until you teach them. Use MIDI learn: click a slider, then move the control."],
      ["Wheels", "Bend the note and add wobble, as on any keyboard."],
    ],
    controls: [], ccs: [21, 22, 23, 24, 25, 26, 27, 28],
  },
  lpm: {
    name: "Novation Launchpad Mini MK3", kind: "profile", port: "LPMiniMK3 MIDI", ignored: ["DAW"], lights: true,
    does: [
      ["Pad grid", "Is the step grid of the open section: 8 rows by 8 steps. Press a pad to add or remove a note."],
      ["Arrows", "Move the view to the next 8 steps or the next 8 rows."],
      ["Side buttons", "Launch a section, or fire an “on cue” path while the song plays."],
    ],
    controls: [], ccs: [],
  },
};

// Mappings the Launchkey Mini MK3 profile brings, as target labels in the app.
const MIDI_START_MAPS = [
  { dev: "lkm3", control: "Knob 1", cc: 21, target: "Selected instrument · Volume", pickup: true, turn: "absolute", profile: true },
  { dev: "lkm3", control: "Knob 2", cc: 22, target: "Selected instrument · Brightness", pickup: true, turn: "absolute", profile: true },
  { dev: "lkm3", control: "Knob 3", cc: 23, target: "Selected instrument · Soft start", pickup: true, turn: "absolute", profile: true },
  { dev: "lkm3", control: "Knob 4", cc: 24, target: "Selected instrument · Ring out", pickup: true, turn: "absolute", profile: true },
  { dev: "lkm3", control: "Play", cc: 115, target: "Play and stop", button: true, profile: true },
  { dev: "lkm3", control: "Record", cc: 117, target: "Record", button: true, profile: true },
];

const MIDI_PROFILES = {
  now: ["Novation Launchkey Mini MK3", "Akai MPK mini IV, MK3 and Plus", "Akai MPD218", "Akai APC mini mk2", "Arturia MiniLab 3", "Novation Launchkey Mini MK4 and Launchkey MK4",
    "Korg nanoKONTROL2", "M-Audio Oxygen Pro"],
  next: ["Novation Launchpad Mini MK3 and Launchpad X", "Akai APC Key 25 mk2", "Novation Launch Control XL MK3", "DJ TechTools MIDI Fighter Twister",
    "Behringer X-Touch Mini", "Arturia KeyLab Essential mk3 and BeatStep Pro", "Korg nanoKONTROL Studio and nanoPAD2", "Novation FLkey"],
  later: ["Akai APC40 mkII", "Novation Launchpad Pro MK3 and Launch Control 3", "Ableton Push 2 and Push 3", "Mackie Control surfaces"],
};

const MIDI_TAP_BEAT_MS = 500; // 120 beats a minute for the tap-along check
const MIDI_TAPS_NEEDED = 8;
