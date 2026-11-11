"use strict";
// Per-note settings: how they are drawn in the grid, the length handle, the note inspector and the row strip.

const inspEl = $("#insp");
let insp = null; // { r, s, n, lane } the note open in the inspector

/* ---------- reading the notes of a row ---------- */

/** The notes that start at step `s`: none, the drum hit, or a melodic chord. */
const notesAt = (rowData, s) => {
  const cell = rowData.cells[s];
  return Array.isArray(cell) ? cell : cell ? [cell] : [];
};

const lowest = (notes) => notes.reduce((low, n) => (n.pitch < low.pitch ? n : low), notes[0]);

/** The note of this pitch sounding at step `s`, wherever it starts. */
function covering(rowData, pitch, s) {
  for (let t = s; t >= 0; t--) {
    const n = notesAt(rowData, t).find((other) => other.pitch === pitch);
    if (n) return t + n.len > s ? n : null;
  }
  return null;
}

/** Longest length a note at `s` can have: up to the next note of the same pitch or the section end. */
function maxLen(rowData, pitch, s) {
  for (let t = s + 1; t < rowData.cells.length; t++) {
    if (notesAt(rowData, t).some((n) => n.pitch === pitch)) return t - s;
  }
  return rowData.cells.length - s;
}

/** True if no note of `pitch` other than `self` overlaps steps s .. s+len-1. */
function isFree(rowData, pitch, s, len, self) {
  for (let t = 0; t < s + len; t++) {
    for (const n of notesAt(rowData, t)) if (n !== self && n.pitch === pitch && t + n.len > s) return false;
  }
  return true;
}

const stepLabel = (s) => `${Math.floor(s / STEPS_PER_BAR) + 1}.${(s % STEPS_PER_BAR) + 1}`;

/** Pixel width of `len` steps from `s`, the beat and bar gaps included. */
const spanW = (s, len) => stepX(s + len - 1) + cellW - stepX(s);

/** The step under a horizontal pointer position, inside a row of cells. */
function stepAt(cellsEl, clientX) {
  const x = clientX - cellsEl.getBoundingClientRect().left;
  let t = 0;
  while (t + 1 < edSec.bars * STEPS_PER_BAR && stepX(t + 1) <= x) t++;
  return t;
}

/* ---------- drawing notes in the grid ---------- */

/** Which way a glide mark leans: towards the next note's pitch. */
function glideTurn(rowData, s, n) {
  for (let t = s + n.len; t < rowData.cells.length; t++) {
    const notes = notesAt(rowData, t);
    if (notes.length) return Math.sign(n.pitch - lowest(notes).pitch) * 35;
  }
  return 0;
}

/**
 * One note as a bar over its steps. Loudness is the fill height (opacity in the pitch lanes) with a cap line when
 * louder than the default, chance below 100 is hatching, repeats split the first step into slivers, timing shifts
 * the bar by up to 40 % of a cell, glide adds a mark.
 */
function noteHtml(n, s, { lane = false, label = "", grip = false, turn = null, dot = hasNoteFx(n), sel = picked.has(n) } = {}) {
  const len = n.len ?? 1;
  const dx = (n.nudge / 50) * 0.4 * cellW;
  const loud = lane ? `opacity:${loudOpacity(n.loud).toFixed(2)}` : `height:${loudHeight(n.loud).toFixed(1)}%`;
  const hits = "<b></b>".repeat(n.repeat);
  // Repeats happen inside the first step, so a long note splits only that part.
  const fill = len > 1 && n.repeat > 1 ? `<span class="first" style="width:${cellW - 3}px">${hits}</span><b></b>` : hits;
  const kind = `${n.chance < 100 ? " maybe" : ""}${n.nudge ? " nudged" : ""}${!lane && n.loud > NOTE_DEFAULTS.loud ? " hot" : ""}${sel ? " picked" : ""}`;
  return (
    `<i class="note${kind}" data-s="${s}" data-end="${s + len}" style="left:${(1.5 + dx).toFixed(1)}px; width:${spanW(s, len) - 3}px">` +
    `<span class="fill" style="${loud}">${fill}</span>${label}` +
    (turn === null ? "" : `<u class="glide" style="--rot:${turn}deg"></u>`) +
    (grip ? '<em class="grip"></em>' : "") +
    (dot ? '<s class="fxdot"></s>' : "") +
    "</i>"
  );
}

const tagHtml = (notes) => `<span class="tag">${noteName(lowest(notes).pitch)}${notes.length > 1 ? `<sup>+${notes.length - 1}</sup>` : ""}</span>`;

const cellHtml = (s, inner) => `<div class="cell${cellClass(s)}${inner ? " on" : ""}" data-s="${s}">${inner}</div>`;

/** The row's own cells: drum hits, or each melodic chord as one bar labelled with its lowest note. */
function rowCells(rowData) {
  const pitched = melodic(inst(rowData.inst));
  return rowData.cells
    .map((_, s) => {
      const notes = notesAt(rowData, s);
      if (!notes.length) return cellHtml(s, "");
      if (!pitched) return cellHtml(s, noteHtml(notes[0], s));
      const n = lowest(notes);
      const shown = { ...n, len: Math.max(...notes.map((other) => other.len)) };
      const turn = n.glide ? glideTurn(rowData, s, shown) : null;
      return cellHtml(s, noteHtml(shown, s, { label: tagHtml(notes), grip: true, turn, dot: notes.some(hasNoteFx), sel: notes.some((other) => picked.has(other)) }));
    })
    .join("");
}

function laneCells(rowData, pitch) {
  return rowData.cells
    .map((cell, s) => {
      const n = cell.find((other) => other.pitch === pitch);
      return cellHtml(s, n ? noteHtml(n, s, { lane: true, grip: true, turn: n.glide ? glideTurn(rowData, s, n) : null }) : "");
    })
    .join("");
}

/** Redraws one row, its pitch lanes and its strip after its notes changed. */
function drawRow(r) {
  const rowData = edSec.rows[r];
  const rowEl = $(`.row[data-r="${r}"]`, editorEl);
  if (!rowEl) return;
  $(".cells", rowEl).innerHTML = rowCells(rowData);
  $$(`.lanes[data-r="${r}"] .lane`, editorEl).forEach((lane) => ($(".cells", lane).innerHTML = laneCells(rowData, Number(lane.dataset.p))));
  const strip = $(`.strip[data-r="${r}"]`, editorEl);
  if (strip) {
    strip.dataset.tab = rowData.tab;
    $(".cells", strip).innerHTML = stripCells(rowData);
  }
}

/* ---------- the length handle ---------- */

editorEl.addEventListener("pointerdown", (event) => {
  const grip = event.target.closest(".grip");
  if (!grip || event.button !== 0) return;
  event.preventDefault();
  const cell = grip.closest(".cell");
  const cellsEl = cell.parentElement; // stays in place when the row redraws
  const { r, p, s } = cellTarget(cell);
  const rowData = edSec.rows[r];
  // The collapsed row resizes the whole chord; a lane resizes its one note.
  const notes = p === null ? [...rowData.cells[s]] : rowData.cells[s].filter((n) => n.pitch === p);
  document.body.classList.add("sizing");
  track(
    (move) => {
      const end = stepAt(cellsEl, move.clientX);
      let changed = false;
      for (const n of notes) {
        const len = clamp(1, end - s + 1, maxLen(rowData, n.pitch, s));
        changed ||= len !== n.len;
        n.len = len;
      }
      if (changed) drawRow(r);
    },
    () => document.body.classList.remove("sizing"),
  );
});

/* ---------- the note inspector ---------- */

editorEl.addEventListener("contextmenu", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell || !edSec) return;
  const target = cellTarget(cell);
  const here = notesAt(edSec.rows[target.r], target.s);
  // Settings belong to a note. An empty step is empty space: the shared menu there offers "Add note here".
  const n = target.p === null ? lowest(here) : here.find((other) => other.pitch === target.p);
  if (!n) return;
  event.preventDefault();
  openInspector(target.r, target.s, n, target.p !== null);
});

function openInspector(r, s, n, lane) {
  insp = { r, s, n, lane };
  inspEl.hidden = false;
  renderInspector();
  placeInspector();
}

function closeInspector() {
  insp = null;
  inspEl.hidden = true;
}

const nudgeText = (v) => (v === 0 ? "On the beat" : `${Math.abs(v)} % ${v < 0 ? "early" : "late"}`);
const OUT = {
  loud: (v) => `${v}`,
  chance: (v) => `${v} %`,
  nudge: nudgeText,
  len: (v) => `${v} step${v === 1 ? "" : "s"}`,
  pitch: noteName,
};

const ctlHead = (label, help, out) => `<div class="ctl-head"><b>${label}</b>${out}</div><small>${help}</small>`;

/** A labelled slider; `ends` puts words at either end, with a centre mark between them. */
function sliderHtml(n, key, label, help, min, max, ends = null) {
  const input = `<input type="range" min="${min}" max="${max}" step="1" value="${n[key]}" data-k="${key}" aria-label="${label}" />`;
  return `<div class="ctl">${ctlHead(label, help, `<output data-out="${key}">${OUT[key](n[key])}</output>`)}${
    ends ? `<div class="ends"><span>${ends[0]}</span>${input}<span>${ends[1]}</span></div>` : input
  }</div>`;
}

function stepperHtml(n, key, label, help, canDown, canUp) {
  const down = key === "pitch" ? icon("down") : icon("minus");
  const up = key === "pitch" ? icon("up") : icon("plus");
  return `<div class="ctl">${ctlHead(label, help, "")}<div class="stepper">
    <button data-step="${key}" data-d="-1" ${canDown ? "" : "disabled"}>${down}</button>
    <output>${OUT[key](n[key])}</output>
    <button data-step="${key}" data-d="1" ${canUp ? "" : "disabled"}>${up}</button>
  </div></div>`;
}

/** The next scale pitch up (+1) or down (-1) that has room for this note, if any. */
function freePitch(d) {
  const { r, s, n } = insp;
  const rowData = edSec.rows[r];
  const pitches = lanesFor(inst(rowData.inst)).reverse(); // lowest first
  for (let i = pitches.indexOf(n.pitch) + d; i >= 0 && i < pitches.length; i += d) {
    if (isFree(rowData, pitches[i], s, n.len, n)) return pitches[i];
  }
  return null;
}

function renderInspector() {
  const { r, s, n } = insp;
  const rowData = edSec.rows[r];
  const instrument = inst(rowData.inst);
  const pitched = melodic(instrument);
  const title = [instrument.name, pitched && noteName(n.pitch), `step ${stepLabel(s)}`].filter(Boolean).join(" · ");
  const reps = [1, 2, 3, 4].map((v) => `<button data-rep="${v}" class="${v === n.repeat ? "on" : ""}">${v}</button>`).join("");
  const glide = `<button class="switch${n.glide ? " on" : ""}" role="switch" aria-checked="${n.glide}" data-insp="glide"><i></i></button>`;
  inspEl.style.setProperty("--h", instrument.hue);
  inspEl.innerHTML = `<i class="insp-arrow"></i><div class="insp-body">
    <header><i class="chip"></i><b>${title}</b><button class="mini" data-insp="close">${icon("x")}</button></header>
    ${sliderHtml(n, "loud", "Loudness", "How hard the note is hit", 1, 100)}
    ${pitched ? `<div class="pair">${stepperHtml(n, "len", "Length", "How long the note is held", n.len > 1, n.len < maxLen(rowData, n.pitch, s))}${stepperHtml(n, "pitch", "Note", "Which note it plays", freePitch(-1) !== null, freePitch(1) !== null)}</div>` : ""}
    ${sliderHtml(n, "chance", "Chance", "How often it plays. 50 % is about every other time round", 0, 100)}
    ${sliderHtml(n, "nudge", "Timing", "Slightly ahead of or behind the beat", -50, 50, ["Early", "Late"])}
    <div class="pair">
      <div class="ctl">${ctlHead("Repeat", "Quick hits inside the step", "")}<div class="seg">${reps}</div></div>
      ${instrument.kind === "synth" ? `<div class="ctl">${ctlHead("Glide", "Slides into the next note", glide)}</div>` : ""}
    </div>
    ${noteFxHtml(n, instrument)}
    <footer><button data-insp="reset">Reset to defaults</button><button class="danger" data-insp="delete">${icon("trash")}Delete note</button></footer>
  </div>`;
}

function inspectedNoteEl() {
  const { r, s, n, lane } = insp;
  return (
    (lane && $(`.lanes[data-r="${r}"] .lane[data-p="${n.pitch}"] .cell[data-s="${s}"] .note`, editorEl)) ||
    $(`.row[data-r="${r}"] .cell[data-s="${s}"] .note`, editorEl)
  );
}

/**
 * Inside the editor panel, never over the top bar, leaving the note's own row in view: below the note by
 * preference, above it when there is no room, beside it as a last resort. The arrow points at the note's first step.
 */
function placeInspector() {
  const el = inspectedNoteEl();
  if (!el) return closeInspector();
  const a = el.getBoundingClientRect();
  const ed = editorEl.getBoundingClientRect();
  const [w, h, gap, m] = [inspEl.offsetWidth, inspEl.offsetHeight, 12, 8];
  const x = a.left + Math.min(a.width, cellW) / 2;
  let side = a.bottom + gap + h <= ed.bottom - m ? "below" : a.top - gap - h >= ed.top + m ? "above" : null;
  let left;
  let top;
  if (side) {
    left = clamp(ed.left + m, x - w / 2, ed.right - w - m);
    top = side === "below" ? a.bottom + gap : a.top - gap - h;
  } else {
    side = a.right + gap + w <= ed.right - m ? "right" : "left";
    left = clamp(ed.left + m, side === "right" ? a.right + gap : a.left - gap - w, ed.right - w - m);
    top = clamp(ed.top + m, a.top + a.height / 2 - h / 2, ed.bottom - h - m);
  }
  inspEl.dataset.side = side;
  inspEl.style.left = `${left}px`;
  inspEl.style.top = `${top}px`;
  aimInspector();
}

/** After a change the inspector stays put, so its buttons stay under the pointer; only the arrow follows the note. */
function aimInspector() {
  const el = inspectedNoteEl();
  if (!el) return closeInspector();
  const a = el.getBoundingClientRect();
  const box = inspEl.getBoundingClientRect();
  const ed = editorEl.getBoundingClientRect();
  const top = clamp(ed.top + 8, box.top, ed.bottom - box.height - 8); // the box may have grown or shrunk
  inspEl.style.top = `${top}px`;
  inspEl.style.setProperty("--ay", `${clamp(14, a.top + a.height / 2 - top, box.height - 14)}px`);
  inspEl.style.setProperty("--ax", `${clamp(14, a.left + Math.min(a.width, cellW) / 2 - box.left, box.width - 14)}px`);
}

inspEl.addEventListener("input", (event) => {
  const key = event.target.dataset.k;
  if (!key) return;
  let value = Number(event.target.value);
  if (key === "nudge" && Math.abs(value) <= 4) value = Number((event.target.value = 0)); // centre detent
  insp.n[key] = value;
  $(`[data-out="${key}"]`, inspEl).textContent = OUT[key](value);
  drawRow(insp.r);
});

inspEl.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  const { r, s, n } = insp;
  const rowData = edSec.rows[r];
  const act = button.dataset.insp;
  if (act === "close") return closeInspector();
  if (act === "delete") {
    if (Array.isArray(rowData.cells[s])) rowData.cells[s].splice(rowData.cells[s].indexOf(n), 1);
    else rowData.cells[s] = null;
    drawRow(r);
    return closeInspector();
  }
  if (act === "reset") {
    Object.assign(n, NOTE_DEFAULTS, "pitch" in n ? TONE_DEFAULTS : {});
    delete n.fx;
  }
  if (act === "glide") n.glide = !n.glide;
  if (button.dataset.rep) n.repeat = Number(button.dataset.rep);
  if (button.dataset.step === "len") n.len = clamp(1, n.len + Number(button.dataset.d), maxLen(rowData, n.pitch, s));
  if (button.dataset.step === "pitch") n.pitch = rowData.last = freePitch(Number(button.dataset.d)) ?? n.pitch;
  drawRow(r);
  renderInspector();
  aimInspector();
});

document.addEventListener("pointerdown", (event) => {
  if (insp && !event.target.closest("#insp")) closeInspector();
});

// Scrolling the grid would leave the inspector pointing at nothing.
editorEl.addEventListener("scroll", () => insp && closeInspector(), true);

/* ---------- the row strip: loudness, chance or timing for a whole row ---------- */

const STRIP_TABS = { loud: "Loudness", chance: "Chance", nudge: "Timing" };
const STRIP_RANGE = { loud: [1, 100], chance: [0, 100], nudge: [-50, 50] };

function stripHtml(rowData, index) {
  const tabs = Object.entries(STRIP_TABS)
    .map(([key, label]) => `<button data-tab="${key}" class="${rowData.tab === key ? "on" : ""}">${label}</button>`)
    .join("");
  return `<div class="strip" data-r="${index}" data-tab="${rowData.tab}" style="--h:${inst(rowData.inst).hue}">
    <div class="rh"><div class="tabs">${tabs}</div></div><div class="cells">${stripCells(rowData)}</div>
  </div>`;
}

/** One bar per step that has a note; timing bars grow up (late) or down (early) from the middle. */
function stripCells(rowData) {
  return rowData.cells
    .map((_, s) => {
      const notes = notesAt(rowData, s);
      let bar = "";
      if (notes.length) {
        const v = lowest(notes)[rowData.tab];
        if (rowData.tab === "nudge") bar = `<i style="${v < 0 ? "top" : "bottom"}:50%; height:${Math.abs(v)}%"></i>`;
        else bar = `<i style="bottom:0; height:${v}%"></i>`;
      }
      return `<div class="scell${cellClass(s)}" data-s="${s}">${bar}</div>`;
    })
    .join("");
}

editorEl.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");
  if (!tab || !tab.closest(".strip")) return;
  const r = Number(tab.closest(".strip").dataset.r);
  edSec.rows[r].tab = tab.dataset.tab;
  $$("[data-tab]", tab.parentElement).forEach((button) => button.classList.toggle("on", button === tab));
  drawRow(r);
});

editorEl.addEventListener("pointerdown", (event) => {
  const cellsEl = event.target.closest(".strip .cells");
  if (!cellsEl || event.button !== 0) return;
  event.preventDefault();
  const r = Number(cellsEl.closest(".strip").dataset.r);
  const rowData = edSec.rows[r];
  const [min, max] = STRIP_RANGE[rowData.tab];
  let last = null;
  const draw = (e) => {
    const box = cellsEl.getBoundingClientRect();
    let v = Math.round(min + (max - min) * clamp(0, 1 - (e.clientY - box.top) / box.height, 1));
    if (rowData.tab === "nudge" && Math.abs(v) <= 3) v = 0;
    const s = stepAt(cellsEl, e.clientX);
    // Fill the steps a fast drag jumped over with a straight line between the two values.
    const from = last ?? { s, v };
    for (let t = from.s; ; t += Math.sign(s - from.s)) {
      const value = t === s ? v : Math.round(from.v + ((v - from.v) * (t - from.s)) / (s - from.s));
      notesAt(rowData, t).forEach((n) => (n[rowData.tab] = value));
      if (t === s) break;
    }
    last = { s, v };
    drawRow(r);
  };
  draw(event);
  track(draw);
});
