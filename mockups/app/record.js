"use strict";
/*
 * Area C: recording from the computer keyboard (the mockup makes no sound; notes land in the grid).
 *   Editor header: Record beside Loop. Under it, the recording bar: Metronome, Snap (Full · Partial · Off), Keep to the
 *   song's key, mode (Live · Step by step), Record all drums and the drum key legend.
 *   Each row has a record dot. Recording drums play from Z X C V B N M , ; one armed melodic row plays from the A row,
 *   shown as a keyboard strip along the bottom of the editor (only the song's notes while Keep to the song's key is on).
 *   Live: a 4-3-2-1 count-in, then the loop plays and key presses drop notes at the playhead. Snap decides how much of
 *   the timing is kept as Timing (nudge); holding a key sets Length. Passes layer; the take is one undo step.
 *   Step by step: a cursor step; a key enters a note and moves on; arrows move; Backspace steps back and removes.
 */

const REC = { metronome: true, snap: "full", keepKey: true, mode: "live", on: false, count: 0, cursor: 0, octave: 0, notes: 0, held: new Map() };
const DRUM_KEYS = ["z", "x", "c", "v", "b", "n", "m", ","];
const SCALE_KEYS = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"];
// Without the key lock: a piano layout, white keys on the A row and black keys above them.
const PIANO_KEYS = [["a", 0], ["w", 1], ["s", 2], ["e", 3], ["d", 4], ["f", 5], ["t", 6], ["g", 7], ["y", 8], ["h", 9], ["u", 10], ["j", 11], ["k", 12], ["o", 13], ["l", 14], ["p", 15], [";", 16], ["'", 17]];
const BLACK = new Set([1, 3, 6, 8, 10]);
const SNAP_KEEP = { full: 0, partial: 0.5, off: 1 }; // how much of the off-the-grid timing a note keeps
const keyLabel = (k) => (k === ";" ? ";" : k === "'" ? "'" : k === "," ? "," : k.toUpperCase());

/* ---------- which rows, which keys ---------- */

const armedRows = () => (edSec ? edSec.rows.map((r, i) => [r, i]).filter(([r]) => r.arm) : []);
const armedDrums = () => armedRows().filter(([r]) => inst(r.inst).kind === "drum");
const armedTune = () => armedRows().find(([r]) => melodic(inst(r.inst))) ?? null;

/** The keys of the armed melodic row: [[key, pitch]], from low to high. */
function tuneKeys() {
  const armed = armedTune();
  if (!armed) return [];
  const base = 12 * (inst(armed[0].inst).octave + 1 + REC.octave);
  if (REC.keepKey) return SCALE_KEYS.map((k, i) => [k, base + 12 * Math.floor(i / 7) + MINOR[i % 7]]);
  return PIANO_KEYS.map(([k, offset]) => [k, base + offset]);
}

/** What a key does now: { r, pitch? } or null. */
function keyTarget(key) {
  const drums = armedDrums();
  const d = DRUM_KEYS.indexOf(key);
  if (d >= 0 && drums[d]) return { r: drums[d][1] };
  const tune = tuneKeys().find(([k]) => k === key);
  return tune ? { r: armedTune()[1], pitch: tune[1] } : null;
}

/* ---------- placing notes ---------- */

const loopSteps = () => edSec.bars * STEPS_PER_BAR;
const livePosition = () => ((((performance.now() - transport.t0) / 1000) * stepsPerSecond()) % loopSteps() + loopSteps()) % loopSteps();

/** Puts a note at step s of row r (replacing the same pitch there); returns it. */
function recordNote({ r, pitch }, s, extra = {}) {
  const rowData = edSec.rows[r];
  let n;
  if (pitch === undefined) n = rowData.cells[s] = note(extra);
  else {
    const notes = rowData.cells[s];
    const at = notes.findIndex((other) => other.pitch === pitch);
    if (at >= 0) notes.splice(at, 1);
    notes.push((n = tone(pitch, 1, extra)));
    rowData.last = pitch;
  }
  drawRow(r);
  REC.notes++;
  return n;
}

function liveDown(key, target) {
  const pos = livePosition();
  const s = Math.round(pos) % loopSteps();
  const off = pos - Math.round(pos); // −0.5 … 0.5 of a step
  const nudge = clamp(-50, Math.round(off * 100 * SNAP_KEEP[REC.snap]), 50);
  REC.held.set(key, { ...target, s, from: pos, n: recordNote(target, s, nudge ? { nudge } : {}) });
}

function liveUp(key) {
  const held = REC.held.get(key);
  REC.held.delete(key);
  if (!held || held.pitch === undefined) return;
  const steps = (livePosition() - held.from + loopSteps()) % loopSteps();
  held.n.len = clamp(1, Math.round(steps), loopSteps() - held.s);
  drawRow(held.r);
}

function stepDown(target) {
  recordNote(target, REC.cursor);
  moveCursor(1);
}

function moveCursor(by) {
  REC.cursor = (REC.cursor + by + loopSteps()) % loopSteps();
  drawCursor();
}

function stepBack() {
  moveCursor(-1);
  armedRows().forEach(([r, i]) => {
    if (inst(r.inst).kind === "drum") r.cells[REC.cursor] = null;
    else r.cells[REC.cursor].length = 0;
    drawRow(i);
  });
}

/* ---------- starting and stopping ---------- */

function startRecording() {
  if (!edSec) return;
  if (!armedRows().length) return toast("No row records yet: the dot beside a row's name lets it record");
  REC.notes = 0;
  if (REC.mode === "step") {
    REC.on = true;
    stopPlay();
    return renderEditor();
  }
  commitHistory();
  pauseHistory(true);
  stopPlay();
  REC.count = 4;
  renderEditor();
  const beat = 60000 / (edSec.bpm ?? state.bpm);
  const tick = () => {
    if (!REC.count) return;
    REC.count--;
    if (REC.count) return drawCount(), (REC.countTimer = setTimeout(tick, beat));
    REC.on = true;
    startPlay();
    renderEditor();
    requestAnimationFrame(watch);
  };
  drawCount();
  REC.countTimer = setTimeout(tick, beat);
}

function stopRecording() {
  clearTimeout(REC.countTimer);
  const wasLive = REC.mode === "live" && (REC.on || REC.count);
  const counting = REC.count > 0;
  REC.on = false;
  REC.count = 0;
  REC.held.clear();
  if (wasLive) {
    if (transport.playing) stopPlay();
    pauseHistory(false);
    commitHistory();
    if (!counting) REC.notes ? toast(`Take recorded · ${plural(REC.notes, "note")}`, { action: "Undo take", onAction: undo }) : toast("Nothing was recorded");
  }
  if (edSec) renderEditor();
}

const toggleRecording = () => (REC.on || REC.count ? stopRecording() : startRecording());

// A live take ends when the loop stops (Space, Stop, closing the editor).
function watch() {
  if (!REC.on || REC.mode !== "live") return;
  if (!transport.playing || !edSec) return stopRecording();
  drawBeat();
  requestAnimationFrame(watch);
}

/* ---------- drawing, after every editor redraw ---------- */

function recBarHtml() {
  const drums = armedDrums();
  const legend = drums.length
    ? `<span class="rec-legend">${drums.slice(0, DRUM_KEYS.length).map(([r], i) => `<span><kbd>${keyLabel(DRUM_KEYS[i])}</kbd>${esc(inst(r.inst).name)}</span>`).join("")}</span>`
    : "";
  const allArmed = edSec.rows.some((r) => inst(r.inst).kind === "drum") && edSec.rows.every((r) => inst(r.inst).kind !== "drum" || r.arm);
  return `<div class="rec-bar">
    <label class="rec-opt">${switchHtml(REC.metronome, 'data-rec="metronome"')}<span>Metronome</span></label>
    <span class="rec-beats${REC.metronome ? "" : " off"}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <span class="lbl">Snap</span>${segHtml("snap", ["full", "partial", "off"], REC.snap, () => false, (v) => ({ full: "Full", partial: "Partial", off: "Off" })[v])}
    <label class="rec-opt">${switchHtml(REC.keepKey, 'data-rec="keepKey"')}<span>Keep to the song's key</span></label>
    ${segHtml("recmode", ["live", "step"], REC.mode, () => REC.on || REC.count > 0, (v) => (v === "live" ? "Live" : "Step by step"))}
    <span class="spacer"></span>
    ${legend}
    <button class="btn small${allArmed ? " on" : ""}" data-rec="drums">${icon("drum")}Record all drums</button>
  </div>`;
}

function keyboardHtml() {
  const armed = armedTune();
  if (!armed) return "";
  const instrument = inst(armed[0].inst);
  const keys = tuneKeys()
    .map(([k, p]) => `<button class="kb-key${!REC.keepKey && BLACK.has(p % 12) ? " black" : ""}${p % 12 === 0 ? " root" : ""}" data-kb="${k}"><b>${noteName(p)}</b><kbd>${keyLabel(k)}</kbd></button>`)
    .join("");
  return `<div class="kb-strip" style="--h:${instrument.hue}">
    <span class="kb-name">${esc(instrument.name)}<small>${REC.keepKey ? "Only the song's notes" : "Every note"}</small></span>
    <button class="icon-btn" data-rec="down">${icon("down")}</button><button class="icon-btn" data-rec="up">${icon("up")}</button>
    <div class="kb-keys${REC.keepKey ? " scale" : ""}">${keys}</div>
  </div>`;
}

function drawRecording() {
  const head = $(".ed-head", editorEl);
  if (!head) return;
  const live = REC.on || REC.count > 0;
  $(".loop-btn", head)?.insertAdjacentHTML(
    "afterend",
    `<button class="rec-btn${live ? " on" : ""}" data-rec="toggle"><i></i><span>${live ? "Stop recording" : "Record"}</span></button>`,
  );
  editorEl.classList.toggle("recording", live);
  const loop = $(".loop-btn", head);
  if (loop) loop.disabled = live; // the take owns the loop: Stop recording ends both
  if (!edSec.rows.length) return;
  head.insertAdjacentHTML("afterend", recBarHtml());
  $(".ed-foot", editorEl)?.insertAdjacentHTML("beforebegin", keyboardHtml());
  $(".playhead", editorEl)?.insertAdjacentHTML("afterend", '<div class="rec-cursor"></div>');
  drawCursor();
  drawCount();
}

function drawCursor() {
  const cursor = $(".rec-cursor", editorEl);
  if (!cursor) return;
  cursor.hidden = !(REC.on && REC.mode === "step");
  cursor.style.transform = `translateX(${stepX(REC.cursor)}px)`;
}

function drawCount() {
  $(".rec-count", editorEl)?.remove();
  if (REC.count) editorEl.insertAdjacentHTML("beforeend", `<div class="rec-count" aria-live="assertive">${REC.count}</div>`);
  if (REC.count && REC.metronome) flashBeat(4 - REC.count);
}

let lastBeat = -1;
function drawBeat() {
  const beat = Math.floor(livePosition() / 4) % 4;
  if (beat !== lastBeat) flashBeat(beat);
  lastBeat = beat;
}

function flashBeat(beat) {
  $$(".rec-beats i", editorEl).forEach((dot, i) => dot.classList.toggle("on", i === beat));
}

EDITOR_HOOKS.push(drawRecording);

/* ---------- the controls ---------- */

editorEl.addEventListener("click", (event) => {
  const t = event.target;
  const arm = t.closest('[data-act="arm"]');
  if (arm) {
    const r = edSec.rows[Number(arm.closest(".row").dataset.r)];
    r.arm = !r.arm;
    // One keyboard: arming a melodic row disarms the others.
    if (r.arm && melodic(inst(r.inst))) edSec.rows.forEach((other) => other !== r && melodic(inst(other.inst)) && (other.arm = false));
    return renderEditor();
  }
  const set = t.closest(".rec-bar [data-set][data-v]");
  if (set && !set.disabled) {
    REC[set.dataset.set === "recmode" ? "mode" : set.dataset.set] = set.dataset.v;
    return renderEditor();
  }
  const kb = t.closest("[data-kb]");
  if (kb && !REC.on) return toast("Press Record first, then play the keys");
  const act = t.closest("[data-rec]")?.dataset.rec;
  if (!act) return;
  if (act === "toggle") return toggleRecording();
  if (act === "metronome" || act === "keepKey") REC[act] = !REC[act];
  if (act === "drums") {
    const drums = edSec.rows.filter((r) => inst(r.inst).kind === "drum");
    const all = drums.every((r) => r.arm);
    drums.forEach((r) => (r.arm = !all));
  }
  if (act === "up" || act === "down") REC.octave = clamp(-2, REC.octave + (act === "up" ? 1 : -1), 2);
  renderEditor();
});

// Clicking or pressing a key of the strip plays it, like its computer key.
editorEl.addEventListener("pointerdown", (event) => {
  const kb = event.target.closest("[data-kb]");
  if (!kb || !REC.on) return;
  event.preventDefault();
  press(kb.dataset.kb);
  window.addEventListener("pointerup", () => release(kb.dataset.kb), { once: true });
});

/* ---------- the keyboard ---------- */

function press(key) {
  const target = keyTarget(key);
  if (!target) return false;
  REC.mode === "live" ? liveDown(key, target) : stepDown(target);
  $(`[data-kb="${CSS.escape(key)}"]`, editorEl)?.classList.add("down");
  return true;
}

function release(key) {
  if (REC.mode === "live") liveUp(key);
  $(`[data-kb="${CSS.escape(key)}"]`, editorEl)?.classList.remove("down");
}

window.addEventListener(
  "keydown",
  (event) => {
    if (!edSec || !(REC.on || REC.count) || dialogOpen() || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.matches?.('input:not([type=range]), textarea, [contenteditable="true"]')) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const take = () => (event.preventDefault(), event.stopImmediatePropagation());
    if (key === "Escape") return take(), stopRecording();
    if (key === "ArrowUp" || key === "ArrowDown") {
      take();
      REC.octave = clamp(-2, REC.octave + (key === "ArrowUp" ? 1 : -1), 2);
      return renderEditor();
    }
    if (REC.mode === "step" && (key === "ArrowLeft" || key === "ArrowRight")) return take(), moveCursor(key === "ArrowLeft" ? -1 : 1);
    if (REC.mode === "step" && key === "Backspace") return take(), stepBack();
    if (!REC.on || (!keyTarget(key) && key !== " ")) return;
    if (key === " ") return; // Space still stops the loop
    take();
    if (!event.repeat) press(key);
  },
  true,
);

window.addEventListener(
  "keyup",
  (event) => {
    if (!REC.on) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (REC.held.has(key) || $(`[data-kb="${CSS.escape(key)}"].down`, editorEl)) release(key);
  },
  true,
);

/* ---------- tooltips ---------- */

addTips([
  ['[data-rec="toggle"]', () => (REC.on || REC.count ? "Stop recording" : "Record"), () =>
    REC.on || REC.count ? "Stops recording. What you played stays; Undo take removes it." : REC.mode === "live" ? "Counts in 4-3-2-1, then plays the loop: the keys you press land as notes. Press again to stop." : "Shows a cursor step: each key you press enters a note there and moves on."],
  ['[data-act="arm"]', (el) => (el.classList.contains("on") ? "Records into this row" : "Record into this row"), "Lets the keyboard record into this row. Only one tune row at a time; any number of drums."],
  ['[data-rec="metronome"]', "Metronome", "Shows the beat while you record, and during the count-in."],
  ['.rec-bar [data-set="snap"]', (el) => `Snap · ${el.textContent}`, (el) =>
    ({ full: "Puts every note exactly on its step.", partial: "Pulls notes towards the step, keeping half of your timing.", off: "Keeps your timing as you played it." })[el.dataset.v]],
  ['[data-rec="keepKey"]', "Keep to the song's key", "The keyboard only offers the song's notes, so nothing sounds wrong. Off, it offers every note."],
  ['.rec-bar [data-set="recmode"]', (el) => el.textContent, (el) =>
    el.dataset.v === "live" ? "Records as you play along while the loop runs; notes land where you play them." : "Enter one note at a time at a cursor, without the loop running."],
  ['[data-rec="drums"]', "Record all drums", "Lets every drum row record, on the keys Z, X, C, V and on."],
  ["[data-kb]", (el) => `${$("b", el).textContent}`, (el) => `Plays this note. Its key is ${$("kbd", el).textContent}.`, (el) => $("kbd", el).textContent],
  ['[data-rec="up"]', "Higher keys", "Moves the keyboard to the same notes, one level higher.", "↑"],
  ['[data-rec="down"]', "Lower keys", "Moves the keyboard to the same notes, one level lower.", "↓"],
]);
