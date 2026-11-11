"use strict";
// Moving notes: drag a note (or the selection) to another step, pitch or row; Ctrl-drag copies; Shift-click selects.
// Nothing changes until the drop, so a loop that is playing keeps playing the notes where they are until then.

const picked = new Set(); // the selected notes
const SCALE = Array.from({ length: 128 }, (_, p) => p).filter((p) => MINOR.includes(p % 12));
/** A pitch's place in the song's scale, so moved notes stay in key. */
const degree = (p) => SCALE.findLastIndex((x) => x <= p);
const kindOf = (r) => (melodic(inst(edSec.rows[r].inst)) ? "melodic" : "drum");

/* ---------- the selection ---------- */

function clearPicked() {
  if (!picked.size) return;
  picked.clear();
  edSec?.rows.forEach((_, r) => drawRow(r));
}

function togglePick(notes) {
  const on = !notes.every((n) => picked.has(n));
  notes.forEach((n) => (on ? picked.add(n) : picked.delete(n)));
}

/** Where each selected note is: { r, s, n }. */
function pickedItems() {
  const items = [];
  edSec.rows.forEach((rowData, r) => rowData.cells.forEach((_, s) => notesAt(rowData, s).forEach((n) => picked.has(n) && items.push({ r, s, n }))));
  return items;
}

function removeNote(rowData, s, n) {
  const cell = rowData.cells[s];
  if (Array.isArray(cell)) {
    if (cell.includes(n)) cell.splice(cell.indexOf(n), 1);
  } else if (cell === n) {
    rowData.cells[s] = null;
  }
}

function deletePicked() {
  pickedItems().forEach(({ r, s, n }) => removeNote(edSec.rows[r], s, n));
  picked.clear();
  edSec.rows.forEach((_, r) => drawRow(r));
}

/* ---------- dragging ---------- */

/** The row or pitch lane under the pointer, and the step there. */
function hitAt(x, y) {
  const holder = document.elementFromPoint(x, y)?.closest(".lane, .row");
  if (!holder || !editorEl.contains(holder)) return null;
  const cellsEl = $(".cells", holder);
  if (x < cellsEl.getBoundingClientRect().left) return null;
  const lane = holder.classList.contains("lane");
  return { r: Number((lane ? holder.closest(".lanes") : holder).dataset.r), p: lane ? Number(holder.dataset.p) : null, s: stepAt(cellsEl, x) };
}

/**
 * Where each moving note would land, or null if the drop is not allowed: drums only onto drum rows, melodic notes
 * only onto melodic rows, every note inside the section. Dropped on a lane, the grabbed note takes that lane's pitch
 * and the others follow by the same number of scale steps; dropped on another instrument's row, they move by whole
 * octaves into its range.
 */
function planDrop(items, from, grabStep, grabbed, hit) {
  if (!hit) return null;
  const steps = edSec.bars * STEPS_PER_BAR;
  const ds = hit.s - grabStep;
  const dr = hit.r - from.r;
  const anchor = "pitch" in grabbed[0] ? lowest(grabbed).pitch : null;
  let shift = 0;
  let octave = 0;
  if (anchor !== null && kindOf(hit.r) === "melodic") {
    if (hit.p !== null) shift = degree(hit.p) - degree(anchor);
    else if (edSec.rows[hit.r].inst !== edSec.rows[from.r].inst) {
      const lanes = lanesFor(inst(edSec.rows[hit.r].inst));
      while (anchor + octave < lanes.at(-1)) octave += 12;
      while (anchor + octave > lanes[0]) octave -= 12;
    }
  }
  const plan = [];
  for (const it of items) {
    const r = it.r + dr;
    const s = it.s + ds;
    if (!edSec.rows[r] || kindOf(r) !== kindOf(it.r) || s < 0 || s >= steps) return null;
    if (!("pitch" in it.n)) plan.push({ it, r, s, pitch: null, len: 1 });
    else plan.push({ it, r, s, pitch: (SCALE[degree(it.n.pitch) + shift] ?? it.n.pitch) + octave, len: Math.min(it.n.len, steps - s), lane: hit.p !== null });
  }
  return plan;
}

const rowNoteEl = (r, s) => $(`.row[data-r="${r}"] .cell[data-s="${s}"] .note`, editorEl);
const laneCellEl = (r, p, s) => $(`.lanes[data-r="${r}"] .lane[data-p="${p}"] .cell[data-s="${s}"]`, editorEl);

/** The faint ghost left at the origin while a note is dragged. */
function ghost(items, on) {
  for (const { r, s, n } of items) {
    rowNoteEl(r, s)?.classList.toggle("ghost", on);
    const lane = "pitch" in n && laneCellEl(r, n.pitch, s);
    if (lane) $(".note", lane)?.classList.toggle("ghost", on);
  }
}

/** Outlines where the notes would land; long notes keep their length, clipped at the section end. */
function markDrop(plan) {
  $$(".drop-mark", editorEl).forEach((el) => el.remove());
  const done = new Set();
  for (const t of plan ?? []) {
    const cell = (t.lane && laneCellEl(t.r, t.pitch, t.s)) || $(`.row[data-r="${t.r}"] .cell[data-s="${t.s}"]`, editorEl);
    if (!cell || done.has(cell)) continue;
    done.add(cell);
    cell.insertAdjacentHTML("beforeend", `<i class="drop-mark" style="width:${spanW(t.s, t.len) - 3}px"></i>`);
  }
}

function dropNotes(items, plan, copy) {
  if (!copy) items.forEach(({ r, s, n }) => removeNote(edSec.rows[r], s, n));
  // What is already there goes: the hit on a drum step, the same pitch in a lane, the whole chord in a collapsed row.
  for (const t of plan) {
    const rowData = edSec.rows[t.r];
    if (t.pitch === null) rowData.cells[t.s] = null;
    else rowData.cells[t.s] = t.lane ? rowData.cells[t.s].filter((n) => n.pitch !== t.pitch) : [];
  }
  const placed = plan.map((t) => {
    const n = copy ? structuredClone(t.it.n) : t.it.n;
    const rowData = edSec.rows[t.r];
    if (t.pitch === null) return (rowData.cells[t.s] = n);
    n.pitch = t.pitch;
    if (inst(rowData.inst).kind !== "synth") n.glide = false; // only the synth can glide
    // A note of the same pitch still sounding here is cut short where this one starts.
    for (let u = t.s - 1; u >= 0; u--) {
      const before = notesAt(rowData, u).find((other) => other.pitch === n.pitch);
      if (!before) continue;
      before.len = Math.min(before.len, t.s - u);
      break;
    }
    rowData.cells[t.s].push(n);
    n.len = Math.min(t.len, maxLen(rowData, n.pitch, t.s));
    return n;
  });
  // Copies of a selection become the selection.
  if (copy && items.some(({ n }) => picked.has(n))) {
    picked.clear();
    placed.forEach((n) => picked.add(n));
  }
  new Set([...items.map((it) => it.r), ...plan.map((t) => t.r)]).forEach(drawRow);
}

/** A press on a note: moving 4px starts a drag; a plain click removes it, a Shift-click selects it. */
function pressNote(event, cell) {
  event.preventDefault();
  const from = cellTarget(cell);
  const here = notesAt(edSec.rows[from.r], from.s);
  const grabbed = from.p === null ? [...here] : here.filter((n) => n.pitch === from.p);
  const grabStep = stepAt(cell.parentElement, event.clientX);
  const [x0, y0] = [event.clientX, event.clientY];
  let items = null; // the notes on the move, once the pointer has moved
  let plan = null;
  track(
    (move) => {
      if (!items) {
        if (Math.hypot(move.clientX - x0, move.clientY - y0) <= 4) return;
        items = grabbed.some((n) => picked.has(n)) ? pickedItems() : grabbed.map((n) => ({ r: from.r, s: from.s, n }));
        document.body.classList.add("note-drag");
        ghost(items, true);
      }
      plan = planDrop(items, from, grabStep, grabbed, hitAt(move.clientX, move.clientY));
      document.body.classList.toggle("copying", move.ctrlKey || move.metaKey);
      document.body.classList.toggle("denied", !plan);
      markDrop(plan);
    },
    (up) => {
      if (!items) {
        if (up.shiftKey) {
          togglePick(grabbed);
          return drawRow(from.r);
        }
        grabbed.forEach((n) => picked.delete(n));
        return applyCell(from, false);
      }
      document.body.classList.remove("note-drag", "copying", "denied");
      markDrop(null);
      ghost(items, false); // a refused drop returns the notes where they were
      if (plan) dropNotes(items, plan, up.ctrlKey || up.metaKey);
    },
  );
}
