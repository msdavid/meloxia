"use strict";
/*
 * Undo and redo (shared). Snapshots of the song, taken after every gesture: a press released, a click, a key let go,
 * a slider or field settled. Nothing needs to call it for ordinary edits; it notices them.
 *
 *   commitHistory()          take a snapshot now, if anything changed (after a change made outside a gesture, say a timer)
 *   pauseHistory(true|false) hold snapshots while a long action runs (a recording take), so it becomes one step;
 *                            a held mouse button or finger does the same by itself
 *   addHistoryField(key)     include state[key] in snapshots (an area keeping its own data on `state`)
 *   HISTORY_HOOKS.push(fn)   fn() runs after an undo or redo has restored the song, before the canvas, editor and panel redraw
 *   undo(), redo()           top-bar buttons, Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y
 * Changes only to how things are shown (a row opened, a strip shown) are not steps of their own.
 */

const HISTORY_FIELDS = ["bpm", "start", "sections", "edges", "seq", "song", "instFx"];
const HISTORY_HOOKS = [];
const HISTORY_LIMIT = 200;
const VIEW_ONLY = new Set(["open", "strip", "tab", "arm"]); // row display state, and armed for recording

const past = [];
const future = [];
let current = null; // { full, key } of the song as it is now

function addHistoryField(key) {
  if (!HISTORY_FIELDS.includes(key)) HISTORY_FIELDS.push(key);
  current = takeSnapshot();
}

function takeSnapshot() {
  const data = Object.fromEntries(HISTORY_FIELDS.map((k) => [k, state[k]]));
  return { full: JSON.stringify(data), key: JSON.stringify(data, (k, v) => (VIEW_ONLY.has(k) ? undefined : v)) };
}

let historyPaused = false;

function pauseHistory(on) {
  historyPaused = on;
}

// While a button is held nothing commits: a drag is one step, however many redraws, focus changes or timers it meets.
let pressing = false;

function commitHistory() {
  if (historyPaused || pressing) return;
  const now = takeSnapshot();
  if (now.key !== current.key) {
    past.push(current);
    if (past.length > HISTORY_LIMIT) past.shift();
    future.length = 0;
  }
  current = now;
  syncHistory();
}

function restoreSnapshot(snapshot) {
  Object.assign(state, JSON.parse(snapshot.full));
  current = snapshot;
  if (insp) closeInspector();
  picked.clear();
  closePopover();
  if (state.selected?.type === "node" && !blk(state.selected.id)) state.selected = null; // any canvas block: section, Play together, note
  if (state.selected?.type === "edge" && !state.edges[state.selected.id]) state.selected = null;
  if (state.openId && !sec(state.openId)) closeEditor();
  edSec = state.openId ? sec(state.openId) : null;
  HISTORY_HOOKS.forEach((hook) => hook()); // areas bring their own data in line before anything redraws
  renderNodes();
  if (edSec) renderEditor();
  renderPanel();
  $("#bpm").textContent = state.bpm;
  setMode();
  syncHistory();
}

function undo() {
  commitHistory();
  if (!past.length) return;
  future.push(current);
  restoreSnapshot(past.pop());
}

function redo() {
  commitHistory();
  if (!future.length) return;
  past.push(current);
  restoreSnapshot(future.pop());
}

function syncHistory() {
  $("#undo").disabled = !past.length;
  $("#redo").disabled = !future.length;
}

// A gesture has finished once its own handlers have run: commit just after them. Typing is one gesture: a text
// field's keystrokes commit together when it loses focus.
// A press first commits what came before it (text typed in a field), so that stays its own step.
window.addEventListener("pointerdown", () => (commitHistory(), (pressing = true)), true);
["pointerup", "pointercancel"].forEach((type) => window.addEventListener(type, () => (pressing = false), true));
const commitSoon = (event) => {
  if (event.type === "keyup" && event.target.matches?.('input:not([type=range]), textarea, [contenteditable="true"]')) return;
  setTimeout(commitHistory);
};
["pointerup", "click", "keyup", "change", "focusout"].forEach((type) => window.addEventListener(type, commitSoon, true));

$("#undo").addEventListener("click", undo);
$("#redo").addEventListener("click", redo);

window.addEventListener(
  "keydown",
  (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || dialogOpen()) return;
    const key = event.key.toLowerCase();
    if (key !== "z" && key !== "y") return;
    if (event.target.matches?.('input:not([type=range]), textarea, [contenteditable="true"]')) return; // the field's own undo
    event.preventDefault();
    event.stopPropagation();
    key === "y" || event.shiftKey ? redo() : undo();
  },
  true,
);

document.addEventListener("DOMContentLoaded", () => {
  current = takeSnapshot();
  syncHistory();
});
