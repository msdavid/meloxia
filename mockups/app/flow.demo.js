"use strict";
// Song flow on the canvas (area A), part 4: the demo song's flow, so the canvas shows every block and rule at a
// glance, in three rows that fit a 1300 x 800 window at about 75%: the main line and Chorus along the top, Drum break
// under Chorus, and Bridge and Outro back at the left on the bottom row. Verse plays again twice, a Speed change,
// Chorus played together with a Drum break, then a dice roll between Bridge and Outro; Bridge can go back to the
// chorus on cue. Loads after state.js and before effects.js, which gives every section its effect settings.

state.sections.push(
  {
    id: "drumbreak",
    name: "Drum break",
    hue: 280,
    x: 986,
    y: 260,
    bars: 2,
    repeats: 1,
    rows: [
      row("kick", drum("X..x ..x. X... x.2. X..x ..x. X.x. x..2")),
      row("snare", drum(".... X..g .g.. X... .... X..g .g.. X.XX")),
      row("tom", drum(".... .... .... .... .... .... ..x. x.x.")),
      row("ohat", drum("..x. ..x. ..x. ..x. ..x. ..x. ..x. ....")),
      row("shaker", drum("oxox oxox oxox oxox oxox oxox oxox oxox")),
    ],
  },
  {
    id: "bridge",
    name: "Bridge",
    hue: 338,
    x: 150,
    y: 450,
    bars: 2,
    repeats: 1,
    rows: [
      row("kick", drum("x... .... x... .... x... .... x... ..x.")),
      row("rim", drum("..x. ...x ..x. .x.. ..x. ...x ..x. .xx.")),
      row("pad", mel(32, { 0: chord([44, 48, 51], 16), 16: chord([46, 50, 53], 16) })),
      row("keys", mel(32, { 0: [tone(48, 2)], 2: [tone(51, 2)], 4: [tone(55, 2)], 6: [tone(51, 2)], 8: [tone(48, 2)], 10: [tone(51, 2)], 12: [tone(56, 4, { loud: 60 })], 16: [tone(50, 2)], 18: [tone(53, 2)], 20: [tone(58, 2)], 22: [tone(53, 2)], 24: [tone(50, 2)], 26: [tone(53, 2)], 28: [tone(58, 4, { loud: 60 })] })),
    ],
  },
  {
    id: "outro",
    name: "Outro",
    hue: 95,
    x: 470,
    y: 450,
    bars: 2,
    repeats: 1,
    rows: [
      row("kick", drum("x... .... .... .... x... .... .... ....")),
      row("hat", drum("..o. ..o. ..o. ..o. ..o. ..o. .... ....")),
      row("pad", mel(32, { 0: chord([48, 51, 55], 16), 16: chord([44, 48, 51], 16) })),
      row("pluck", mel(32, { 0: [tone(67, 4)], 4: [tone(63, 2)], 6: [tone(60, 2)], 8: [tone(62, 4)], 12: [tone(58, 4, { loud: 60 })], 16: [tone(60, 8)], 24: [tone(55, 8, { loud: 45 })] })),
    ],
  },
);

state.blocks.push(
  { id: "tempo1", kind: "tempo", bpm: 124, x: 734, y: 128 },
  { id: "split1", kind: "split", join: "join1", ends: "longest", shorter: "loop", same: "both", leader: null, x: 930, y: 90 },
  { id: "join1", kind: "join", x: 1250, y: 90 },
);

sec("intro").x = 150;
sec("verse").x = 420;
sec("chorus").x = 986;
sec("chorus").y = 90;

// Order matters: a block's exits are checked top to bottom, so "otherwise" comes last.
state.edges = [
  { from: "start", to: "intro" },
  { from: "intro", to: "verse" },
  { from: "verse", to: "verse", rule: { type: "count", first: 2 } },
  { from: "verse", to: "tempo1", rule: { type: "otherwise" } },
  { from: "tempo1", to: "split1" },
  { from: "split1", to: "chorus" },
  { from: "split1", to: "drumbreak" },
  { from: "chorus", to: "join1" },
  { from: "drumbreak", to: "join1" },
  { from: "join1", to: "bridge", rule: { type: "chance", pct: 30 } },
  { from: "join1", to: "outro", rule: { type: "otherwise" } },
  { from: "bridge", to: "split1", rule: { type: "cue" } },
  { from: "bridge", to: "outro", rule: { type: "otherwise" } },
];

// A roll that lands on Bridge, so the first preview shows the dice choosing it.
state.flow.seed = 7;

// Notes for yourself (stickies.js): one on the canvas pointing at Verse's loop, one minimised on Chorus, and one in
// Verse's grid pointing at a bass note.
state.notes = [
  {
    id: "n-loop",
    view: "canvas",
    place: "",
    at: { on: null, dx: 150, dy: 286 },
    w: 230,
    h: 112,
    text: "Verse plays 3 times: once, then twice more round this loop (“first 2 times”). Then the song moves on.",
    color: "yellow",
    min: false,
    arrow: { tip: { on: { edge: "verse>verse" }, dx: -40, dy: 2 } },
  },
  {
    id: "n-chorus",
    view: "canvas",
    place: "",
    at: { on: { block: "chorus" }, dx: 190, dy: -36 },
    w: 210,
    h: 96,
    text: "Chorus and Drum break play at the same time.\nThe longer one decides when they end.",
    color: "pink",
    min: true,
    arrow: null,
  },
  {
    id: "n-bass",
    view: "editor",
    place: "verse",
    at: { on: { row: "bass", step: 20 }, dx: 0, dy: 46 },
    w: 236,
    h: 104,
    text: "The bass steps down here for the second bar: a darker feel before the chorus.",
    color: "blue",
    min: false,
    arrow: { tip: { on: { row: "bass", step: 16 }, dx: 12, dy: 30 } },
  },
];
