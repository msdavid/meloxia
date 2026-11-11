"use strict";
// Top bar, pretend transport (it moves playheads, it makes no sound), looks and keyboard.

const transport = { playing: false, t0: 0, lastStep: -1, song: null };

const stepsPerSecond = () => (state.bpm / 60) * 4;

function setMode() {
  $("#mode").textContent = edSec ? `Loop · ${edSec.name}` : "Song";
  if (!transport.playing) $("#pos").textContent = "1.1";
}

function setPosition(step) {
  $("#pos").textContent = `${Math.floor(step / STEPS_PER_BAR) + 1}.${Math.floor((step % STEPS_PER_BAR) / 4) + 1}`;
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
}

function startPlay() {
  if (edSec && !edSec.rows.length) return toast("Add an instrument first");
  if (!edSec) {
    const first = state.edges.find((edge) => edge.from === "start");
    if (!first) return toast("Connect Start to a section to play the song");
    transport.song = { id: first.to, t0: performance.now(), stepsBefore: 0 };
    state.liveEdge = "start";
    renderEdges();
  }
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
  edSec ? loopFrame(now) : songFrame(now);
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

/** On the canvas: follow the connections from Start, playing each section its number of times. */
function songFrame(now) {
  const current = transport.song;
  const section = sec(current.id);
  if (!section) return stopPlay();
  const steps = section.bars * STEPS_PER_BAR;
  const elapsed = ((now - current.t0) / 1000) * stepsPerSecond();
  const repeat = Math.floor(elapsed / steps);

  if (repeat >= section.repeats) {
    const next = state.edges.find((edge) => edge.from === current.id);
    clearNodePlaying();
    if (!next) {
      stopPlay();
      return toast("End of the song");
    }
    const length = section.repeats * steps;
    transport.song = { id: next.to, t0: current.t0 + (length / stepsPerSecond()) * 1000, stepsBefore: current.stepsBefore + length };
    state.liveEdge = current.id;
    return renderEdges();
  }

  showNodePlaying(current.id, (elapsed - repeat * steps) / steps, repeat, section);
  setPosition(current.stepsBefore + Math.floor(elapsed));
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

function setLook(look) {
  document.documentElement.dataset.look = look;
  $$(".looks button").forEach((button) => button.classList.toggle("on", button.dataset.look === look));
  try {
    localStorage.setItem("synthia-mockup-look", look);
  } catch {
    // Private windows may refuse storage; the look just won't be remembered.
  }
}

$(".looks").addEventListener("click", (event) => {
  const look = event.target.closest("[data-look]")?.dataset.look;
  if (look) setLook(look);
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
  if (event.code === "Space") {
    event.preventDefault();
    return togglePlay();
  }
  if (event.key === "Escape") {
    if (insp) return closeInspector();
    if (!popEl.hidden) return closePicker();
    if (edSec) return closeEditor();
    return select(null);
  }
  if (edSec) return;
  if (event.key === "Delete" || event.key === "Backspace") return deleteSelected();
  if (event.key === "Enter" && state.selected?.type === "node" && state.selected.id !== "start") openEditor(state.selected.id);
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
