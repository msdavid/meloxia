"use strict";
// The section editor: the step grid that opens when a section is double-clicked.

const editorEl = $("#editor");
const stageEl = $(".stage");
const popEl = $("#pop");

const HEADER_W = 272; // room for the row strip button (248 in mockup 01)
const BEAT_GAP = 6;
const BAR_GAP = 14;
const BAR_CHOICES = [1, 2, 4, 8];

let edSec = null; // the section being edited
let cellW = 30;
let paint = null; // { r, p, s, value } while the pointer is held down on the grid

/** Horizontal offset of a (possibly fractional) step, counting the gaps between beats and bars. */
function stepX(step) {
  const whole = Math.floor(step);
  return step * cellW + Math.floor(whole / 4) * BEAT_GAP + Math.floor(whole / STEPS_PER_BAR) * (BAR_GAP - BEAT_GAP);
}

/* ---------- open and close ---------- */

function openEditor(id) {
  const section = sec(id);
  if (!section) return;
  stopPlay();
  edSec = section;
  state.openId = id;
  editorEl.hidden = false;

  // Grow out of the block that was double-clicked.
  const node = $(`.node[data-id="${id}"]`, nodesEl)?.getBoundingClientRect();
  const stage = stageEl.getBoundingClientRect();
  if (node) editorEl.style.transformOrigin = `${node.left + node.width / 2 - stage.left - 14}px ${node.top + node.height / 2 - stage.top - 14}px`;

  renderEditor();
  requestAnimationFrame(() => {
    if (edSec !== section) return; // closed again before the first frame
    editorEl.classList.add("open");
    stageEl.classList.add("editing");
  });
  setMode();
}

function closeEditor() {
  if (!edSec) return;
  stopPlay();
  closePicker();
  closeInspector();
  edSec = null;
  state.openId = null;
  editorEl.classList.remove("open");
  stageEl.classList.remove("editing");
  setTimeout(() => {
    if (!state.openId) editorEl.hidden = true;
  }, 260);
  renderNodes();
  setMode();
}

/* ---------- rendering ---------- */

function cellClass(step) {
  const gap = step === 0 ? "" : step % STEPS_PER_BAR === 0 ? " bar" : step % 4 === 0 ? " beat" : "";
  return gap + (Math.floor(step / 4) % 2 ? " alt" : "");
}

function isSilenced(r) {
  return r.mute || (edSec.rows.some((other) => other.solo) && !r.solo);
}

function rowHtml(r, index) {
  const instrument = inst(r.inst);
  const pitched = melodic(instrument);
  const expand = pitched
    ? `<button class="mini chev${r.open ? " on" : ""}" data-act="expand" title="${r.open ? "Hide" : "Show"} the note grid">${icon("down")}</button>`
    : "";
  let html = `<div class="row${isSilenced(r) ? " dim" : ""}${lightHue(instrument.hue) ? " light" : ""}" data-r="${index}" style="--h:${instrument.hue}">
    <div class="rh">
      <i class="led"></i>
      <span class="glyph">${icon(glyphFor(instrument))}</span>
      <span class="rname">${instrument.name}<small>${pitched ? instrument.tag : "Drum"}</small></span>
      ${expand}
      <button class="mini bars${r.strip ? " on" : ""}" data-act="strip" title="Shape the whole row: loudness, chance, timing">${icon("bars")}</button>
      <button class="mini m${r.mute ? " on" : ""}" data-act="mute" title="Mute">M</button>
      <button class="mini s${r.solo ? " on" : ""}" data-act="solo" title="Solo">S</button>
      <button class="mini x" data-act="remove" title="Remove from this section">${icon("x")}</button>
    </div>
    <div class="cells">${rowCells(r)}</div>
  </div>`;

  if (r.strip) html += stripHtml(r, index);
  if (pitched && r.open) {
    const lanes = lanesFor(instrument)
      .map(
        (pitch) => `<div class="lane${pitch % 12 === 0 ? " root" : ""}" data-p="${pitch}">
          <div class="rh"><span>${noteName(pitch)}</span></div><div class="cells">${laneCells(r, pitch)}</div>
        </div>`,
      )
      .join("");
    html += `<div class="lanes" data-r="${index}" style="--h:${instrument.hue}">${lanes}</div>`;
  }
  return html;
}

function rulerHtml(steps) {
  let ticks = "";
  for (let s = 0; s < steps; s++) {
    const bar = Math.floor(s / STEPS_PER_BAR) + 1;
    const beat = Math.floor((s % STEPS_PER_BAR) / 4) + 1;
    const label = s % STEPS_PER_BAR === 0 ? `<span class="b1">${bar}</span>` : s % 4 === 0 ? `<span>${bar}.${beat}</span>` : "";
    ticks += `<div class="tick${cellClass(s)}">${label}</div>`;
  }
  const count = edSec.rows.length;
  return `<div class="ruler"><div class="rh"><span class="lbl">${count} instrument${count === 1 ? "" : "s"}</span></div><div class="cells">${ticks}</div></div>`;
}

function fitCells() {
  const scroll = $(".grid-scroll", editorEl);
  const width = (scroll?.clientWidth ?? editorEl.clientWidth) - HEADER_W - 28;
  const steps = edSec.bars * STEPS_PER_BAR;
  const gaps = (edSec.bars * 4 - edSec.bars) * BEAT_GAP + (edSec.bars - 1) * BAR_GAP;
  cellW = clamp(20, Math.floor((width - gaps) / steps), 56);
}

const loopButtonInner = () => (transport.playing ? `${icon("stop")}<span>Stop</span>` : `${icon("play")}<span>Loop</span>`);

/** Keeps the Loop button and the lit notes in step with the transport. */
function syncLoopButton() {
  const button = $(".loop-btn", editorEl);
  if (button) button.innerHTML = loopButtonInner();
  if (!transport.playing) $$(".note.live", editorEl).forEach((el) => el.classList.remove("live"));
}

function headHtml() {
  const bars = BAR_CHOICES.map((b) => `<button data-bars="${b}" class="${b === edSec.bars ? "on" : ""}">${b}</button>`).join("");
  return `<div class="ed-head">
    <button class="crumb" data-act="close" title="Back to the song (Esc)">${icon("left")}Song</button>
    <i class="sep">/</i>
    <button class="swatch" data-act="hue" title="Change colour"></button>
    <span class="ed-name" contenteditable="true" spellcheck="false">${esc(edSec.name)}</span>
    <span class="spacer"></span>
    <span class="lbl">Length</span>
    <div class="seg">${bars}</div>
    <span class="lbl">bars</span>
    <button class="loop-btn${lightHue(edSec.hue) ? " light" : ""}" data-act="play" title="Loop this section (Space)">${loopButtonInner()}</button>
    <button class="icon-btn" data-act="close" title="Close (Esc)">${icon("x")}</button>
  </div>`;
}

function gridHtml() {
  if (!edSec.rows.length) {
    const quick = ["kick", "snare", "hat", "bass"]
      .map((id) => `<button class="quick" data-pick="${id}" style="--h:${inst(id).hue}">${icon("plus")}${inst(id).name}</button>`)
      .join("");
    return `<div class="grid-scroll"><div class="empty">
      <span class="empty-art">${icon("section")}</span>
      <h2>This section is empty</h2>
      <p>Add an instrument, then click the grid to place its notes.</p>
      <div class="quick-row">${quick}</div>
      <button class="add-btn" data-act="add">${icon("plus")}Browse all instruments</button>
    </div></div>`;
  }
  const steps = edSec.bars * STEPS_PER_BAR;
  return `<div class="grid-scroll"><div class="grid" style="--cw:${cellW}px; --hw:${HEADER_W}px">
    ${rulerHtml(steps)}
    ${edSec.rows.map(rowHtml).join("")}
    <div class="add-row"><div class="rh"><button class="add-btn" data-act="add">${icon("plus")}Add instrument</button></div></div>
    <div class="playhead"></div>
  </div></div>`;
}

const FOOT_HTML = `<div class="ed-foot">
  <span><kbd>Click</kbd> place or remove a note</span>
  <span><kbd>Drag</kbd> paint along a row</span>
  <span><kbd>Right-click</kbd> a note for its settings</span>
  <span><kbd>Space</kbd> loop</span>
  <span><kbd>Esc</kbd> back to the song</span>
</div>`;

function renderEditor() {
  const scroll = $(".grid-scroll", editorEl);
  const keep = scroll ? [scroll.scrollLeft, scroll.scrollTop] : [0, 0];
  editorEl.style.setProperty("--h", edSec.hue);
  fitCells();
  closeInspector();
  editorEl.innerHTML = headHtml() + gridHtml() + FOOT_HTML;
  const fresh = $(".grid-scroll", editorEl);
  [fresh.scrollLeft, fresh.scrollTop] = keep;
  editorEl.classList.toggle("tight", cellW < 27);
}

/* ---------- editing notes ---------- */

function cellTarget(cell) {
  const lane = cell.closest(".lane");
  const holder = lane ? lane.closest(".lanes") : cell.closest(".row");
  return { r: Number(holder.dataset.r), p: lane ? Number(lane.dataset.p) : null, s: Number(cell.dataset.s) };
}

/** Places (value true) or removes a note; returns the note placed, if any. */
function applyCell({ r, p, s }, value) {
  const rowData = edSec.rows[r];
  const instrument = inst(rowData.inst);
  let placed = null;
  if (instrument.kind === "drum") {
    if (!value) rowData.cells[s] = null;
    else placed = rowData.cells[s] ??= note();
  } else {
    const notes = rowData.cells[s];
    if (p === null) {
      // The collapsed row places the last pitch used, or clears the whole step.
      const pitch = rowData.last ?? defaultPitch(instrument);
      if (!value) notes.length = 0;
      else if (!notes.length && !covering(rowData, pitch, s)) notes.push((placed = tone(pitch)));
    } else {
      const at = notes.findIndex((n) => n.pitch === p);
      // A step already covered by a longer note of the same pitch stays as it is.
      if (value && at < 0 && !covering(rowData, p, s)) notes.push((placed = tone(p)));
      if (!value && at >= 0) notes.splice(at, 1);
      if (value) rowData.last = p;
    }
  }
  drawRow(r);
  return placed;
}

editorEl.addEventListener("pointerdown", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell || event.button !== 0 || event.target.closest(".grip")) return;
  event.preventDefault();
  const target = cellTarget(cell);
  paint = { ...target, value: !cell.classList.contains("on") };
  applyCell(target, paint.value);
});

editorEl.addEventListener("pointerover", (event) => {
  if (!paint) return;
  const cell = event.target.closest(".cell");
  if (!cell) return;
  const target = cellTarget(cell);
  if (target.r !== paint.r || target.p !== paint.p) return;
  // A fast drag skips cells between pointer events: fill every step since the last one.
  const dir = Math.sign(target.s - paint.s);
  for (let s = paint.s + dir; s !== target.s + dir; s += dir) applyCell({ ...target, s }, paint.value);
  paint.s = target.s;
});

window.addEventListener("pointerup", () => (paint = null));

/* ---------- header, rows and the instrument picker ---------- */

function setBars(bars) {
  const steps = bars * STEPS_PER_BAR;
  edSec.rows.forEach((r) => {
    // Growing a section repeats what is already there, so the loop keeps going.
    const old = r.cells;
    r.cells = Array.from({ length: steps }, (_, s) => {
      const cell = structuredClone(old[s % old.length]);
      // A shorter section cuts long notes at its end.
      if (Array.isArray(cell)) cell.forEach((n) => (n.len = Math.min(n.len, steps - s)));
      return cell;
    });
  });
  edSec.bars = bars;
  renderEditor();
}

function addInstrument(id) {
  const steps = edSec.bars * STEPS_PER_BAR;
  const cells = inst(id).kind === "drum" ? Array(steps).fill(null) : Array.from({ length: steps }, () => []);
  edSec.rows.push(row(id, cells));
  closePicker();
  renderEditor();
}

function openPicker(anchor) {
  const used = new Set(edSec.rows.map((r) => r.inst));
  const group = (name) =>
    `<h4>${name}</h4><div class="pick-grid">` +
    INSTRUMENTS.filter((instrument) => instrument.group === name)
      .map(
        (instrument) =>
          `<button class="pick" data-pick="${instrument.id}" style="--h:${instrument.hue}" ${used.has(instrument.id) ? "disabled" : ""}>
            <i class="chip">${icon(glyphFor(instrument))}</i>
            <span>${instrument.name}${used.has(instrument.id) ? "<small>in this section</small>" : ""}</span>
          </button>`,
      )
      .join("") +
    "</div>";
  popEl.innerHTML =
    group("Drums") + group("Instruments") + `<h4>Sample banks</h4><button class="pick wide" disabled><i class="chip">${icon("plus")}</i><span>Download more instruments…<small>later mockup</small></span></button>`;
  popEl.hidden = false;
  const a = anchor.getBoundingClientRect();
  const height = popEl.offsetHeight;
  popEl.style.left = `${clamp(12, a.left, window.innerWidth - popEl.offsetWidth - 12)}px`;
  popEl.style.top = `${a.bottom + 8 + height > window.innerHeight ? Math.max(12, a.top - height - 8) : a.bottom + 8}px`;
}

function closePicker() {
  popEl.hidden = true;
}

editorEl.addEventListener("click", (event) => {
  const pick = event.target.closest("[data-pick]");
  if (pick) return addInstrument(pick.dataset.pick);

  const bars = event.target.closest("[data-bars]");
  if (bars) return setBars(Number(bars.dataset.bars));

  const button = event.target.closest("[data-act]");
  if (!button) return;
  const act = button.dataset.act;
  const rowEl = button.closest(".row");
  const r = rowEl ? edSec.rows[Number(rowEl.dataset.r)] : null;

  if (act === "close") return closeEditor();
  if (act === "play") return togglePlay();
  if (act === "add") return popEl.hidden ? openPicker(button) : closePicker();
  if (act === "hue") {
    edSec.hue = SECTION_HUES[(SECTION_HUES.indexOf(edSec.hue) + 1) % SECTION_HUES.length];
    $(".loop-btn", editorEl).classList.toggle("light", lightHue(edSec.hue));
    return editorEl.style.setProperty("--h", edSec.hue);
  }
  if (act === "expand") r.open = !r.open;
  if (act === "strip") r.strip = !r.strip;
  if (act === "mute") r.mute = !r.mute;
  if (act === "solo") r.solo = !r.solo;
  if (act === "remove") edSec.rows.splice(Number(rowEl.dataset.r), 1);
  renderEditor();
});

popEl.addEventListener("click", (event) => {
  const pick = event.target.closest("[data-pick]");
  if (pick && !pick.disabled) addInstrument(pick.dataset.pick);
});

document.addEventListener("pointerdown", (event) => {
  if (!popEl.hidden && !event.target.closest("#pop, [data-act='add']")) closePicker();
});

editorEl.addEventListener("input", (event) => {
  if (!event.target.classList.contains("ed-name")) return;
  edSec.name = event.target.textContent.trim() || "Untitled";
  setMode();
});

window.addEventListener("resize", () => {
  if (edSec) renderEditor();
});

/* ---------- loop playback, as seen in the grid ---------- */

function retrigger(el) {
  if (!el) return;
  el.classList.remove("hit");
  void el.offsetWidth; // restart the CSS animation
  el.classList.add("hit");
}

function editorPlayhead(position) {
  const head = $(".playhead", editorEl);
  if (head) head.style.transform = `translateX(${stepX(position)}px)`;
}

/** Lights the notes the playhead has just reached: each one rolls its chance, long ones stay lit to their end. */
function editorHit(step) {
  $$(".note.live", editorEl).forEach((el) => {
    if (step < Number(el.dataset.s) || step >= Number(el.dataset.end)) el.classList.remove("live");
  });
  edSec.rows.forEach((r, index) => {
    if (isSilenced(r)) return;
    const playing = notesAt(r, step).filter((n) => Math.random() * 100 < n.chance);
    if (!playing.length) return;
    flash($(`.row[data-r="${index}"] .cell[data-s="${step}"] .note`, editorEl), playing[0]);
    retrigger($(`.row[data-r="${index}"] .led`, editorEl));
    playing.forEach((n) => flash($(`.lanes[data-r="${index}"] .lane[data-p="${n.pitch}"] .cell[data-s="${step}"] .note`, editorEl), n));
  });
}

/** One flash per repeat inside the step, then the note stays lit while it lasts. */
function flash(el, n) {
  if (!el) return;
  el.style.setProperty("--hit-n", n.repeat);
  el.style.setProperty("--hit-d", `${1 / stepsPerSecond() / n.repeat}s`);
  el.classList.add("live");
  retrigger(el);
}
