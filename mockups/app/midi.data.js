"use strict";
// MIDI controllers demo data, from docs/research/midi-controllers.md: two demo devices (one with a ready-made
// profile, one generic), a third to "plug in" that needs the extra permission for its lights, and the profile phases.

const MIDI_DEVICES = {
  mpk: {
    name: "Akai MPK mini IV", kind: "profile", port: "MPK mini IV MIDI", ignored: ["DAW", "Plugin", "Software Control"],
    does: [
      ["Keys", "Play the selected row's instrument. While recording, they drop notes at the playhead."],
      ["Pads 1–8", "Play the drum rows: Kick, Snare, Closed hat, Open hat, Clap, Tom, Rimshot, Shaker."],
      ["Knobs 1–8", "Control the sliders listed under Mappings. Each picks up where its slider is, so nothing jumps."],
      ["Joystick", "Left and right bend the note; up adds wobble."],
      ["Hold pedal", "Holds notes while pressed."],
    ],
    controls: ["Knob 1", "Knob 2", "Knob 3", "Knob 4", "Knob 5", "Knob 6", "Knob 7", "Knob 8"],
    ccs: [70, 71, 72, 73, 74, 75, 76, 77],
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

// Mappings the MPK mini IV profile brings, as target labels in the app.
const MIDI_START_MAPS = [
  { dev: "mpk", control: "Knob 1", cc: 70, target: "Lead · Brightness", pickup: true, turn: "absolute", profile: true },
  { dev: "mpk", control: "Knob 2", cc: 71, target: "Lead · Echo amount", pickup: true, turn: "absolute", profile: true },
  { dev: "mpk", control: "Knob 3", cc: 72, target: "Section · Room amount", pickup: true, turn: "absolute", profile: true },
  { dev: "mpk", control: "Knob 4", cc: 73, target: "Song · Volume", pickup: true, turn: "absolute", profile: true },
];

const MIDI_PROFILES = {
  now: ["Akai MPK mini IV, MK3 and Plus", "Akai MPD218", "Akai APC mini mk2", "Arturia MiniLab 3", "Novation Launchkey Mini MK4 and Launchkey MK4",
    "Korg nanoKONTROL2", "M-Audio Oxygen Pro"],
  next: ["Novation Launchpad Mini MK3 and Launchpad X", "Akai APC Key 25 mk2", "Novation Launch Control XL MK3", "DJ TechTools MIDI Fighter Twister",
    "Behringer X-Touch Mini", "Arturia KeyLab Essential mk3 and BeatStep Pro", "Korg nanoKONTROL Studio and nanoPAD2", "Novation FLkey"],
  later: ["Akai APC40 mkII", "Novation Launchpad Pro MK3 and Launch Control 3", "Ableton Push 2 and Push 3", "Mackie Control surfaces"],
};

// What the standalone test page offers as midiLearnable controls is whatever sliders and buttons are on screen; in the app
// these are the real ones (side panel sliders, transport). Labels come from the control's own label.
const MIDI_TAP_BEAT_MS = 500; // 120 beats a minute for the tap-along check
const MIDI_TAPS_NEEDED = 8;
