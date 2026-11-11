"use strict";
// One shared tooltip for every control: a name, one plain sentence, and the shortcut if there is one.
// All the wording lives in TIPS below, matched by selector, so templates carry no title attributes.

const tipEl = Object.assign(document.createElement("div"), { className: "tip", role: "tooltip", hidden: true });
document.body.append(tipEl);

const SHOW_DELAY = 400;
const WARM_FOR = 300; // after a tooltip hides, the next control shows its tooltip at once

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const rowOf = (el) => {
  const holder = el.closest(".lanes, .row, .strip");
  return holder ? edSec?.rows[Number(holder.dataset.r)] : null;
};
const fxOf = (el) => {
  const card = el.closest(".fx-card");
  return card && side ? sideRack()[Number(card.dataset.i)] : null;
};

const PARAM_TIPS = {
  "echo.time": "How long between one repeat and the next, in steps.",
  "echo.repeats": "How many times the sound comes back before it fades out.",
  "echo.amount": "How loud the repeats are next to the original sound.",
  "room.size": "From a small room to a big hall.",
  "room.amount": "How much of the room you hear around the sound.",
  "grit.drive": "How hard the sound is pushed until it turns rough.",
  "grit.amount": "How much of the rough sound is mixed in.",
  "brightness.tone": "Slide left to muffle the sound, right to make it crisper.",
  "wobble.speed": "How fast the sound sways.",
  "wobble.depth": "How far the sound sways.",
  "punch.amount": "How much loud and quiet moments are evened out, so the sound hits harder.",
  "width.width": "Left squeezes the sound towards the middle; right spreads it wider across the speakers.",
};

const TAB_TIPS = {
  general: "Name, colour, length, speed and pitch of this section.",
  feel: "How bouncy the rhythm of this section is.",
  mix: "How loud the section and each of its instruments are.",
  effects: "Effects that change the sound of this whole section.",
  transitions: "How the section starts and how it hands over to the next one.",
};
const STRIP_TIPS = {
  loud: "Shows how hard each note is hit.",
  chance: "Shows how often each note plays.",
  nudge: "Shows how early or late each note is.",
};

/** [selector, name, sentence, shortcut]; name, sentence and shortcut may be functions of the element. */
const TIPS = [
  // top bar
  [".song-title", "Song name", "Click to rename the song."],
  ["#stop", "Stop", "Stops playing and goes back to the start."],
  ["#play", () => (transport.playing ? "Stop" : "Play"), () => (edSec ? "Plays this section over and over." : "Plays the song from Start, one section after another."), "Space"],
  [".readout", "Position", "What Play plays, and where it is now: bar and beat."],
  ['[data-bpm="-1"]', "Slower", "Lowers the song's speed by one beat per minute."],
  ['[data-bpm="1"]', "Faster", "Raises the song's speed by one beat per minute."],
  [".key", "Key", "The set of notes the song uses, so every note sounds right together. Changing it comes later."],
  ["#song-fx", "Song effects", "Effects on the whole song, such as Room and the safety limiter."],
  ["#explain", "Show explanations", "Shows or hides the short help lines under settings. These tooltips stay either way."],
  [".meter", "Level", "How loud everything is right now."],
  ['.looks [data-look="graphite"]', "Look A · Graphite", "Switches to the dark grey look."],
  ['.looks [data-look="midnight"]', "Look B · Midnight", "Switches to the deep blue look."],
  ['.looks [data-look="paper"]', "Look C · Paper", "Switches to the light, paper-like look."],
  // palette
  ['.tool[data-tool="section"]', "Section", "Drag onto the canvas to add a part of the song that loops. A click drops one in the middle."],
  [".tool.idea", (el) => $("b", el).textContent, "An idea for later. It does nothing in this mockup."],
  // canvas
  [".start", "Start", "The song begins here. Drag from its dot to the first section."],
  [".port.out", "Connect", "Drag to the section that should play next."],
  [".port.in", "Way in", "The previous section connects here."],
  [".rep [data-rep='-1']", "Fewer times", "How many times this section plays before the song moves on."],
  [".rep [data-rep='1']", "More times", "How many times this section plays before the song moves on."],
  [".node-chips span", (el) => el.textContent, (el) => chipTip(el.textContent)],
  [".node", (el) => sec(el.dataset.id)?.name ?? "Section", "A part of the song. Drag to move it, double-click to open it, right-click for its settings.", "Enter"],
  [".edge", "Connection", "The song moves on along this line. Click it to select it.", "Del"],
  ['[data-tool-act="open"]', "Open", "Opens the section to place its notes.", "Enter"],
  ['[data-tool-act="settings"]', "Settings", "This section's speed, feel, mix, effects and fades. Right-clicking the block does the same."],
  ['[data-tool-act="duplicate"]', "Duplicate", "Makes a copy of this section just below it."],
  ['[data-tool-act="delete"]', () => (toolsEl.classList.contains("round") ? "Disconnect" : "Delete"), () => (toolsEl.classList.contains("round") ? "Removes this connection." : "Removes this section from the song."), "Del"],
  ['[data-zoom="out"]', "Zoom out", "Shows more of the canvas, smaller.", "Ctrl + scroll"],
  ['[data-zoom="in"]', "Zoom in", "Shows the canvas bigger.", "Ctrl + scroll"],
  ['[data-zoom="reset"]', "Actual size", "Shows the canvas at 100 %."],
  ['[data-zoom="fit"]', "Fit the song", "Zooms so every section is in view."],
  // editor header
  [".crumb", "Back to the song", "Closes this section and returns to the canvas.", "Esc"],
  ["button.swatch", "Colour", "Gives the section the next colour."],
  [".ed-name", "Section name", "Click to rename this section."],
  [".ed-head [data-bars]", (el) => plural(Number(el.dataset.bars), "bar"), "How long the section is. Making it longer repeats what is already there."],
  [".ed-btn", "Settings", "Opens this section's speed, feel, mix, effects and fades beside the grid."],
  [".loop-btn", () => (transport.playing ? "Stop" : "Loop"), "Plays this section over and over while you build it.", "Space"],
  ['.ed-head [data-act="close"]', "Close", "Returns to the song.", "Esc"],
  // rows
  [".row .rname", (el) => el.firstChild.textContent, (el) => (melodic(inst(rowOf(el).inst)) ? "Plays notes of different pitch. Open its note grid to place tunes and chords." : "A drum: each note is one hit.")],
  ['[data-act="expand"]', "Note grid", (el) => (rowOf(el).open ? "Hides the lanes of pitches." : "Shows a lane for every pitch, to place tunes and chords.")],
  ['[data-act="strip"]', "Shape the row", "Draw the loudness, chance or timing of every note in this row at once."],
  ['.row [data-act="mute"]', "Mute", "Silences this instrument in this section."],
  ['[data-act="solo"]', "Solo", "Plays only this instrument, and any others set to solo."],
  ['[data-act="remove"]', "Remove", "Takes this instrument out of this section. Other sections keep it."],
  ['[data-act="add"]', "Add instrument", "Pick a drum or an instrument to add to this section."],
  [".quick", (el) => `Add ${el.textContent}`, "Adds this instrument with an empty row, ready for notes."],
  [".pick.wide", "More instruments", "Download sample banks with more sounds. Comes in a later mockup."],
  [".pick", (el) => $("span", el).firstChild.textContent, (el) => (el.disabled ? "Already in this section." : "Adds it to this section.")],
  // the grid
  [".grip", "Length", "Drag to make the note longer or shorter."],
  [".strip [data-tab]", (el) => el.textContent, (el) => STRIP_TIPS[el.dataset.tab]],
  [".strip .cells", "Draw", "Drag up and down across the steps to set each note."],
  [".cell", (el) => cellName(el), (el) => (el.classList.contains("on") ? "Click to remove it, drag to move it, Ctrl-drag to copy it, Shift-click to select it. Right-click for its settings." : "Click to place a note, or drag along the row to place several. Right-click to place one and set it up.")],
  // note inspector
  ['[data-insp="close"]', "Close", "Closes the note settings.", "Esc"],
  ['#insp [data-k="loud"]', "Loudness", "How hard the note is hit. Above 80 it gets a bright line on top."],
  ['#insp [data-k="chance"]', "Chance", "How often the note plays. Below 100 % it sometimes stays silent, which keeps a loop from sounding stiff."],
  ['#insp [data-k="nudge"]', "Timing", "Moves the note a little before or after the beat."],
  ['[data-step="len"][data-d="-1"]', "Shorter", "Holds the note for one step less."],
  ['[data-step="len"][data-d="1"]', "Longer", "Holds the note for one step more."],
  ['[data-step="pitch"][data-d="-1"]', "Lower", "Moves the note down to the next note of the song's key."],
  ['[data-step="pitch"][data-d="1"]', "Higher", "Moves the note up to the next note of the song's key."],
  ["#insp [data-rep]", (el) => plural(Number(el.dataset.rep), "hit"), "Plays the note this many times, quickly, inside its first step."],
  ['[data-insp="glide"]', "Glide", "Slides smoothly from this note into the next one."],
  ['[data-insp="reset"]', "Reset to defaults", "Puts every setting of this note back to how a new note starts."],
  ['[data-insp="delete"]', "Delete note", "Removes this note."],
  ["[data-fxn]", (el) => `${el.getAttribute("aria-label")}`, "How much of the instrument's effect this note gets. Leave it alone to match the instrument."],
  ["[data-fxn-reset]", "Same as instrument", "Gives this note the instrument's own amount again."],
  // side panel
  ['[data-side="close"]', "Close", "Closes the panel.", "Esc"],
  [".side-tabs [data-tab]", (el) => SIDE_TABS[el.dataset.tab], (el) => TAB_TIPS[el.dataset.tab]],
  ['[data-set="name"]', "Section name", "Type a new name for this section."],
  [".hue", "Colour", "Gives the section this colour on the canvas and in the editor."],
  ['.side [data-set="bars"]', (el) => plural(Number(el.dataset.v), "bar"), "How long the section is. Making it longer repeats what is already there."],
  ['[data-set="repeats"]', (el) => (Number(el.dataset.v) < cellSecRepeats() ? "Fewer times" : "More times"), "How many times this section plays before the song moves on."],
  ['[data-set="bpm"][data-v="song"]', "Follow the song", "Plays at the song's speed, set in the top bar."],
  ['[data-set="bpm"][data-v="own"]', "Its own speed", "Lets this section play faster or slower than the rest of the song."],
  ['input[data-set="bpm"]', "Speed", "Beats per minute: higher is faster."],
  ['[data-set="bpmTo"][data-v="toggle"]', "Change gradually", "Speeds up or slows down smoothly from the start of the section to its end."],
  ['input[data-set="bpmTo"]', "Ends at", "The speed the section reaches by its last step."],
  ['[data-set="shift"][data-v="song"]', "Follow the song", "Keeps every note where it is written."],
  ['[data-set="shift"][data-v="own"]', "Shift everything up or down", "Plays every note in this section higher or lower, keeping the tune."],
  ['input[data-set="shift"]', "Shift", "How many steps higher or lower every note plays. 12 steps up is the same tune, one level higher."],
  ['input[data-set="swing"]', "Swing", "Pushes every second step a little late, so the rhythm bounces instead of marching."],
  ['input[data-set="volume"]', "Section volume", "How loud this whole section plays."],
  [".own", "Own setting", "This section has its own value. Click to follow the song again."],
  [".inh", "Follows the song", "This setting comes from the song. Change it here to give the section its own."],
  [".scope", "In this section only", "These levels change this section only. Other sections keep their own."],
  ["[data-level]", (el) => el.getAttribute("aria-label"), "How loud this instrument is in this section."],
  ["[data-mute]", "Mute", "Silences this instrument in this section only."],
  ['[data-set="fadeIn"]', (el) => (el.dataset.v === "0" ? "No fade in" : `Fade in over ${plural(Number(el.dataset.v), "bar")}`), "How long the section takes to rise from silence. Greyed out when longer than the section."],
  ['[data-set="fadeOut"]', (el) => (el.dataset.v === "0" ? "No fade out" : `Fade out over ${plural(Number(el.dataset.v), "bar")}`), "How long the section takes to sink to silence. Greyed out when longer than the section."],
  ['[data-set="tail"][data-v="ring"]', "Ring into the next section", "Echoes and room keep sounding over the start of the next section."],
  ['[data-set="tail"][data-v="cut"]', "Cut off", "Echoes and room stop the moment the section ends."],
  // effects rack
  ["[data-fx-drag]", "Move", "Drag up or down to change the order. The sound goes through the cards from top to bottom."],
  [".fx-handle.lock", "Always last", "The safety limiter stays at the end, so the mix never distorts."],
  ['[data-fx="toggle"]', (el) => (fxOf(el)?.on ? "Switch off" : "Switch on"), "Turns this effect off or on without losing its settings."],
  ['[data-fx="remove"]', "Remove", "Takes this effect out."],
  ["[data-fx-k]", (el) => FX[fxOf(el).type].params[el.dataset.fxK].label, (el) => PARAM_TIPS[`${fxOf(el).type}.${el.dataset.fxK}`]],
  [".fx-name", (el) => $("b", el).textContent, (el) => FX[fxOf(el).type].desc + "."],
  ['[data-fx="add"]', "Add effect", "Choose an effect to add to this chain."],
  ["[data-fx-add]", (el) => FX[el.dataset.fxAdd].name, (el) => FX[el.dataset.fxAdd].desc + "."],
];

const cellSecRepeats = () => sideSec()?.repeats ?? 1;

function chipTip(text) {
  if (text.startsWith("fx")) return `This section has ${plural(Number(text.slice(3)), "effect")} of its own.`;
  if (text.endsWith("bpm")) return "This section plays at its own speed.";
  if (text === "swing") return "This section has its own swing.";
  return "This section plays every note shifted up or down.";
}

function cellName(el) {
  const s = Number(el.dataset.s);
  const lane = el.closest(".lane");
  const where = `step ${stepLabel(s)}${lane ? ` · ${noteName(Number(lane.dataset.p))}` : ""}`;
  return `${el.classList.contains("on") ? "Note" : "Empty"} · ${where}`;
}

/** The tooltip entry for this element itself, if it has one. */
const ownTip = (el) => TIPS.find(([selector]) => el.matches?.(selector));

/** The nearest element, from `el` outwards, that has a tooltip. */
function tipTarget(el) {
  for (let at = el; at && at !== document.body; at = at.parentElement) if (ownTip(at)) return at;
  return null;
}

/* ---------- showing and hiding ---------- */

let tipFor = null; // the element whose tooltip is showing or about to show
let tipTimer = 0;
let warmUntil = 0;
let pressed = null; // a press hides the tooltip until the pointer leaves that control

function showTip(el) {
  const [, name, text, key] = ownTip(el);
  const value = (part) => (typeof part === "function" ? part(el) : part);
  const shortcut = value(key);
  tipEl.innerHTML = `<b>${value(name)}</b><span>${value(text)}</span>${shortcut ? `<kbd>${shortcut}</kbd>` : ""}`;
  tipEl.hidden = false;
  // Above the control, else below, else beside it: never over it, always inside the window.
  const r = el.getBoundingClientRect();
  const [w, h, gap, m] = [tipEl.offsetWidth, tipEl.offsetHeight, 8, 6];
  let top = r.top - gap - h >= m ? r.top - gap - h : r.bottom + gap + h <= innerHeight - m ? r.bottom + gap : null;
  let left;
  if (top === null) {
    top = clamp(m, r.top + r.height / 2 - h / 2, innerHeight - h - m);
    left = r.right + gap + w <= innerWidth - m ? r.right + gap : Math.max(m, r.left - gap - w);
  } else {
    left = clamp(m, r.left + r.width / 2 - w / 2, innerWidth - w - m);
  }
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${top}px`;
}

function hideTip() {
  clearTimeout(tipTimer);
  if (!tipEl.hidden) warmUntil = performance.now() + WARM_FOR;
  tipEl.hidden = true;
  tipFor = null;
}

function aimTip(el, now = false) {
  if (el === tipFor) return;
  hideTip();
  if (!el) return;
  tipFor = el;
  if (now || performance.now() < warmUntil) return showTip(el);
  tipTimer = setTimeout(() => tipFor === el && el.isConnected && showTip(el), SHOW_DELAY);
}

document.addEventListener("pointerover", (event) => {
  if (event.buttons) return; // nothing new while dragging or painting
  const el = tipTarget(event.target);
  if (el !== pressed) pressed = null;
  if (!pressed) aimTip(el);
});

document.addEventListener("pointerout", (event) => {
  if (!event.relatedTarget) hideTip(); // left the window
});

document.addEventListener(
  "pointerdown",
  (event) => {
    hideTip();
    pressed = tipTarget(event.target);
  },
  true,
);

document.addEventListener("focusin", (event) => {
  if (event.target.matches(":focus-visible")) aimTip(tipTarget(event.target), true);
});
document.addEventListener("focusout", hideTip);
document.addEventListener("scroll", hideTip, true);
window.addEventListener("wheel", hideTip, { passive: true });
window.addEventListener("keydown", (event) => event.key !== "Tab" && hideTip());
window.addEventListener("blur", hideTip);

/* ---------- show explanations ---------- */

function setExplain(on) {
  document.body.classList.toggle("quiet", !on);
  const button = $("#explain");
  button.classList.toggle("on", on);
  button.setAttribute("aria-checked", on);
  try {
    localStorage.setItem("synthia-mockup-explain", on ? "1" : "0");
  } catch {
    // No storage: the choice lasts until the page reloads.
  }
}

$("#explain").addEventListener("click", () => setExplain(document.body.classList.contains("quiet")));
let savedExplain = null;
try {
  savedExplain = localStorage.getItem("synthia-mockup-explain");
} catch {
  // No storage: explanations start on.
}
setExplain(savedExplain !== "0");

/* ---------- check: every interactive element has a tooltip ---------- */

const INTERACTIVE = 'button, input, [contenteditable="true"], .node, .start, .edge, .port, .cell, .grip, .tool, .fx-handle, .strip .cells, .readout, .meter';

/** Elements on screen that can be used but have no tooltip of their own. */
function untipped() {
  return $$(INTERACTIVE).filter((el) => el.getClientRects().length && !ownTip(el));
}
