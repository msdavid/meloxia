"use strict";
// Top bar, pretend transport (it moves playheads, it makes no sound), looks and keyboard.

const transport = { playing: false, t0: 0, lastStep: -1, song: null };

// A section loop plays at the section's own speed when it has one.
const stepsPerSecond = () => ((edSec?.bpm ?? state.bpm) / 60) * 4;

function setMode() {
  $("#mode").textContent = edSec ? `Loop · ${edSec.name}` : "Song";
  if (!transport.playing) $("#pos").textContent = "1.1";
}

function setPosition(step) {
  $("#pos").textContent = `${Math.floor(step / STEPS_PER_BAR) + 1}.${Math.floor((step % STEPS_PER_BAR) / 4) + 1}`;
}

/*
 * Toast (shared component): a short message at the bottom, gone after a few seconds.
 *   toast(message, { action, onAction, ms }) with an optional button, say { action: "Undo take", onAction: undoTake }.
 *   While a dialog is open it shows at the top of the window, clear of the dialog's buttons.
 */
function toast(message, { action = null, onAction = null, ms = action ? 5000 : 2400 } = {}) {
  const el = $("#toast");
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button class="toast-act">${esc(action)}</button>` : ""}`;
  el.classList.add("show");
  el.classList.toggle("has-act", !!action);
  el.classList.toggle("top", dialogOpen()); // never over a dialog's buttons
  toast.onAction = onAction;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show", "has-act"), ms);
}

$("#toast").addEventListener("click", (event) => {
  if (!event.target.closest(".toast-act")) return;
  $("#toast").classList.remove("show", "has-act");
  toast.onAction?.();
});

/*
 * The top-bar menu (≡): areas add their screens and commands here.
 *   addMenuItem({ label, tip, icon?, key?, group?, action }) — items with the same group sit together, groups in the
 *   order they were first used, a divider between groups. `tip` is the tooltip sentence.
 */
const APP_MENU = [];

function addMenuItem(item) {
  APP_MENU.push({ group: "general", ...item });
}

function appMenuItems() {
  const groups = [...new Set(APP_MENU.map((item) => item.group))];
  const items = groups.flatMap((group, i) => [...(i ? ["-"] : []), ...APP_MENU.filter((item) => item.group === group)]);
  return items.length ? items : [{ label: "Nothing here yet", tip: "Song, settings and help screens will appear here.", disabled: true }];
}

$("#menu-btn").addEventListener("click", (event) => {
  const button = event.currentTarget;
  if (popoverFor(button)) return closePopover();
  openMenu(button, appMenuItems(), { onClose: () => button.classList.remove("on") });
  button.classList.add("on");
});

function startPlay() {
  if (edSec && !edSec.rows.length) return toast("Add an instrument first");
  if (!edSec && !flowStart()) return; // flow.path.js follows the rules from Start
  transport.playing = true;
  transport.t0 = performance.now();
  transport.lastStep = -1;
  document.body.classList.add("playing");
  $("#play").innerHTML = icon("stop");
  syncLoopButton();
  requestAnimationFrame(frame);
}

function stopPlay() {
  if (!transport.playing) return;
  transport.playing = false;
  transport.song = null;
  state.liveEdge = null;
  flowStop();
  document.body.classList.remove("playing");
  $("#play").innerHTML = icon("play");
  syncLoopButton();
  clearNodePlaying();
  renderEdges();
  setMode();
}

function togglePlay() {
  transport.playing ? stopPlay() : startPlay();
}

function frame(now) {
  if (!transport.playing) return;
  edSec ? loopFrame(now) : flowFrame(now);
  if (transport.playing) requestAnimationFrame(frame);
}

/** A section is open: sweep its playhead round and round. */
function loopFrame(now) {
  const steps = edSec.bars * STEPS_PER_BAR;
  const position = (((now - transport.t0) / 1000) * stepsPerSecond()) % steps;
  const step = Math.floor(position);
  editorPlayhead(position);
  if (step === transport.lastStep) return;
  // A slow frame can jump over steps: hit each one, so no note start is missed.
  for (let s = transport.lastStep; s !== step; ) editorHit((s = (s + 1) % steps));
  transport.lastStep = step;
  setPosition(step);
}

/* ---------- top bar ---------- */

$("#play").addEventListener("click", togglePlay);
$("#stop").addEventListener("click", stopPlay);

$$("[data-bpm]").forEach((button) =>
  button.addEventListener("click", () => {
    state.bpm = clamp(40, state.bpm + Number(button.dataset.bpm), 240);
    $("#bpm").textContent = state.bpm;
  }),
);

/** The look: "graphite", "midnight" or "paper" (Preferences). */
function setLook(look) {
  document.documentElement.dataset.look = look;
  try {
    localStorage.setItem("synthia-mockup-look", look);
  } catch {
    // Private windows may refuse storage; the look just won't be remembered.
  }
}

const currentLook = () => document.documentElement.dataset.look;

// Right-click opens settings where something has them (blocks, notes, rows, effect cards, library cards), and
// stickies.js offers "Add note here" on empty space; this last handler keeps the browser's own menu to text fields.
document.addEventListener("contextmenu", (event) => {
  if (!event.target.closest?.('input:not([type=range]), textarea, [contenteditable="true"]')) event.preventDefault();
});

/* ---------- keyboard ---------- */

window.addEventListener("keydown", (event) => {
  const typing = event.target.isContentEditable || event.target.matches?.("input:not([type=range]), textarea");
  if (typing) {
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      event.target.blur();
    }
    return;
  }
  if (event.key === "Escape" && dialogOpen()) return closeDialog();
  if (dialogOpen()) return; // a dialog takes the keyboard: no shortcuts behind it
  if (event.code === "Space") {
    event.preventDefault();
    return togglePlay();
  }
  if (event.key === "Escape") {
    if (!popEl.hidden) return closePopover();
    if (insp) return closeInspector();
    if (edSec && picked.size) return clearPicked();
    if (side) return closePanel();
    if (edSec) return closeEditor();
    return select(null);
  }
  if (edSec) {
    if ((event.key === "Delete" || event.key === "Backspace") && picked.size) deletePicked();
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") return deleteSelected();
  if (event.key === "Enter" && state.selected?.type === "node" && state.selected.id !== "start") openBlock(state.selected.id);
});

/* ---------- start ---------- */

$$("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
let savedLook = null;
try {
  savedLook = localStorage.getItem("synthia-mockup-look");
} catch {
  // No storage: start with the default look.
}
setLook(savedLook ?? "graphite");
renderNodes();
fitView();
setMode();
