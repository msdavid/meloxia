"use strict";
// Notes for yourself, part 2: the views notes live in, and what they and their arrows attach to.
// Each place answers, for its view:
//   host()           the element the note layer goes in, or null while the view is not showing
//   place()          which one is showing: the open section, panel or dialog ("" on the canvas)
//   scale()          screen pixels per unit (the canvas zoom; 1 elsewhere)
//   local(x, y)      a screen point in the layer's units
//   thingAt(x, y)    { on, el }: what is under a screen point (on: null for empty space), and the element to outline
//   origin(on)       the layer point a thing's offsets count from, or null once it is gone
//   noteOn(x, y)     what a note put at that screen point is kept with
//   settle(n, pt, e) where a moved note is kept once let go
//   bounds()         the part of the layer the view shows: { x0, y0, x1, y1 }; a note never goes outside it
//   fixed            true where the view itself has a fixed frame (panels, dialogs): notes are kept inside on
//                    every redraw, so a smaller window never cuts one off

/** The topmost element at a screen point that is not part of a note. */
const underNotes = (x, y) => document.elementsFromPoint(x, y).find((el) => !el.closest(".sticky-layer"));
// Views may be mid-animation (the editor grows open, scaled): screen distances are divided by the host's scale.
const hostScale = (host) => host.getBoundingClientRect().width / host.offsetWidth || 1;
const rectIn = (el, host) => {
  const a = el.getBoundingClientRect(), b = host.getBoundingClientRect(), s = hostScale(host);
  return { x: (a.left - b.left) / s, y: (a.top - b.top) / s, w: a.width / s, h: a.height / s };
};

/** Keeps a note's box inside its view, with room on the right for the arrow handle. */
function clampNote(P, pt, box, b = P.bounds()) {
  const room = 10 / P.scale(), ox = box.ox ?? 0, oy = box.oy ?? 0; // a minimised note: its icon
  return { x: clamp(b.x0 - ox, pt.x, b.x1 - box.w - room - ox), y: clamp(b.y0 - oy, pt.y, b.y1 - box.h - oy) };
}

const lastPoints = new Map(); // where each ref was last drawn, for when its thing goes away

function refPoint(P, ref, key) {
  const o = ref.on ? P.origin(ref.on) : { x: 0, y: 0 };
  if (!o) {
    // What it was on has gone (deleted, or a step cut off): it stays where it was, unattached.
    const last = lastPoints.get(key ?? ref) ?? { x: 0, y: 0 };
    Object.assign(ref, { on: null, dx: last.x, dy: last.y });
    return last;
  }
  const pt = { x: o.x + ref.dx, y: o.y + ref.dy };
  lastPoints.set(key ?? ref, pt);
  return pt;
}

function refFrom(P, on, pt) {
  const o = (on && P.origin(on)) || { x: 0, y: 0 };
  return { on: on && P.origin(on) ? on : null, dx: Math.round(pt.x - o.x), dy: Math.round(pt.y - o.y) };
}

/** Which view a screen point is in. */
function viewAt(x, y) {
  const el = underNotes(x, y);
  if (!el) return null;
  if (el.closest(".dialog")) return "dialog";
  if (dialogOpen()) return null;
  if (el.closest("#side")) return "panel";
  if (el.closest("#editor")) return el.closest(".grid-scroll") && $(".grid", editorEl) ? "editor" : null;
  if (el.closest("#canvas") && !el.closest(".path-strip, .corner, .hints, #tools")) return "canvas";
  return null;
}

/* ---------- panels and dialogs: notes sit anywhere; arrows point at controls ---------- */

const CONTROL_SEL = "button, input, select, label, .seg, .ctl, .fx-card, .lib-card, .chip, h4, li";

/** A selector that finds this control again after the panel or dialog redraws, and which match it is. */
function selectorFor(el, host) {
  // data-auto-label is added later by the tooltip check, so a fresh redraw would not match it.
  const attrs = [...el.attributes].filter((a) => (a.name.startsWith("data-") && a.name !== "data-auto-label") || a.name === "id");
  let sel = el.tagName.toLowerCase() + attrs.map((a) => (a.name === "id" ? `#${CSS.escape(a.value)}` : `[${a.name}="${CSS.escape(a.value)}"]`)).join("");
  if (!attrs.length && el.classList.length) sel += `.${[...el.classList].map((c) => CSS.escape(c)).join(".")}`;
  return { sel, i: [...host.querySelectorAll(sel)].indexOf(el) };
}

const screenPlace = (host, place) => ({
  host,
  place,
  scale: () => 1,
  local(x, y) {
    const host = this.host(), r = host.getBoundingClientRect(), s = hostScale(host);
    return { x: (x - r.left) / s, y: (y - r.top) / s };
  },
  thingAt(x, y) {
    const host = this.host(), el = underNotes(x, y)?.closest(CONTROL_SEL);
    return el && host.contains(el) ? { on: selectorFor(el, host), el } : { on: null, el: null };
  },
  origin(on) {
    const el = this.host().querySelectorAll(on.sel)[on.i];
    return el ? rectIn(el, this.host()) : null;
  },
  noteOn: () => null,
  settle: (n, pt) => ({ on: null, dx: Math.round(pt.x), dy: Math.round(pt.y) }),
  bounds() {
    const host = this.host();
    return { x0: 0, y0: 0, x1: host.clientWidth, y1: host.clientHeight };
  },
  fixed: true,
});

/* ---------- the section editor: notes are kept with a step of a row, so they scroll with the grid ---------- */

const rowIndex = (inst) => edSec?.rows.findIndex((r) => r.inst === inst) ?? -1;

function editorThing(on) {
  const r = rowIndex(on.row);
  if (r < 0) return null;
  if (on.head) return $(`.row[data-r="${r}"] > .rh`, editorEl);
  const lane = on.pitch != null && $(`.lanes[data-r="${r}"] .lane[data-p="${on.pitch}"] .cell[data-s="${on.step}"]`, editorEl);
  return lane || $(`.row[data-r="${r}"] > .cells > .cell[data-s="${on.step}"]`, editorEl);
}

/** The step of a row nearest a screen point. */
function nearestStep(x, y) {
  const rows = $$(".grid .row", editorEl);
  if (!rows.length) return null;
  const mid = (el) => el.getBoundingClientRect();
  const row = rows.reduce((a, b) => (Math.abs(mid(b).top + mid(b).height / 2 - y) < Math.abs(mid(a).top + mid(a).height / 2 - y) ? b : a));
  const cells = $$(":scope > .cells > .cell", row);
  const cell = cells.reduce((a, b) => (Math.abs(mid(b).left - x) < Math.abs(mid(a).left - x) ? b : a));
  return { row: edSec.rows[Number(row.dataset.r)].inst, step: Number(cell.dataset.s) };
}

const editorPlace = {
  host: () => (edSec && !editorEl.hidden ? $(".grid", editorEl) : null),
  place: () => edSec?.id ?? "",
  scale: () => 1,
  local: screenPlace().local,
  thingAt(x, y) {
    const el = underNotes(x, y);
    const cell = el?.closest(".grid .cell");
    if (cell) {
      const t = cellTarget(cell);
      return { on: { row: edSec.rows[t.r].inst, step: t.s, ...(t.p !== null && { pitch: t.p }) }, el: cell };
    }
    const head = el?.closest(".grid .row > .rh");
    if (head) return { on: { row: edSec.rows[Number(head.closest(".row").dataset.r)].inst, head: true }, el: head };
    return { on: null, el: null };
  },
  origin(on) {
    const el = editorThing(on);
    return el && rectIn(el, this.host());
  },
  noteOn: (x, y) => nearestStep(x, y),
  settle(n, pt) {
    const r = this.host().getBoundingClientRect();
    return refFrom(this, nearestStep(pt.x + r.left, pt.y + r.top) ?? n.at.on, pt);
  },
  // The part of the grid scrolled into view.
  bounds() {
    const host = this.host(), view = host.closest(".grid-scroll"), v = rectIn(view, host), g = this.keep();
    return { x0: Math.max(0, v.x), y0: Math.max(0, v.y), x1: Math.min(g.x1, v.x + view.clientWidth), y1: Math.min(g.y1, v.y + view.clientHeight) };
  },
  // The grid itself: notes are drawn inside it, so they never add to what the grid scrolls (a narrower window
  // shrinks the grid, and a note left sticking out would widen it, then scroll it back when minimised).
  keep() {
    const host = this.host();
    return { x0: 0, y0: 0, x1: host.clientWidth, y1: host.clientHeight };
  },
};

/* ---------- the canvas: notes pan and zoom with the song; on a block or a connection they move with it ---------- */

function canvasThing(x, y) {
  const el = underNotes(x, y);
  const block = el?.closest(BLOCK_SEL);
  if (block) return { on: { block: block.dataset.id }, el: block };
  const hit = document.elementsFromPoint(x, y).find((h) => h.matches?.(".edge .hit"));
  if (hit) return { on: { edge: edgeKey(state.edges[Number(hit.parentElement.dataset.edge)]) }, el: hit.parentElement };
  return { on: null, el: null };
}

const canvasPlace = {
  host: () => worldEl,
  place: () => "",
  scale: () => state.view.z,
  local: (x, y) => toWorld(x, y),
  thingAt: canvasThing,
  origin(on) {
    if (on.block) return blk(on.block) ? boxOf(on.block) : null;
    const edge = state.edges.find((e) => edgeKey(e) === on.edge);
    return edge ? edgeShape(edge).mid : null;
  },
  noteOn: (x, y) => canvasThing(x, y).on,
  // Dropped on a block or a connection it sticks to that; nudged near what it is on it stays; elsewhere it is free.
  settle(n, pt, e) {
    const over = canvasThing(e.clientX, e.clientY).on;
    if (over) return refFrom(this, over, pt);
    const o = n.at.on && this.origin(n.at.on);
    const near = o && Math.hypot(pt.x - o.x, pt.y - o.y) < 320;
    return refFrom(this, near ? n.at.on : null, pt);
  },
  // The canvas the window shows: not under an open panel or the path strip along the bottom.
  bounds() {
    const c = canvasEl.getBoundingClientRect();
    const right = sideEl.hidden ? c.right : Math.min(c.right, sideEl.getBoundingClientRect().left);
    const a = toWorld(c.left + 6, c.top + 6), b = toWorld(right - 6, stripEl.getBoundingClientRect().top - 6);
    return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
  },
};

const PLACES = {
  canvas: canvasPlace,
  editor: editorPlace,
  panel: screenPlace(() => (sideEl.hidden ? null : sideEl), () => (side ? `${side.kind}:${side.id}` : "")),
  dialog: screenPlace(() => (dialogOpen() ? $(".dialog", dialogBack) : null), () => $(".dialog", dialogBack)?.getAttribute("aria-label") ?? ""),
};

/** "On Chorus": what a canvas note is attached to, for its top bar. */
function stickyWhere(n) {
  const on = n.view === "canvas" && n.at.on;
  if (!on) return "";
  return on.block ? `On ${blockName(on.block)}` : "On a connection";
}

/** A note from the palette, dropped at world point (x, y): on what is under the pointer, if anything. */
function addCanvasNote(x, y, event) {
  const on = event ? canvasThing(event.clientX, event.clientY).on : null;
  const pt = clampNote(canvasPlace, { x: x - 16, y: y - 16 }, { w: NOTE_SIZE.w, h: NOTE_SIZE.h });
  const n = addNote("canvas", refFrom(canvasPlace, on, pt));
  renderEdges(); // the connection lit while dragging goes back to normal
  return n;
}

/* ---------- the note count on a section block ---------- */

function stickyBadge(id) {
  const count = state.notes.filter((n) => n.view === "editor" && n.place === id).length;
  return count ? `<span class="note-badge" data-notes="${id}">${icon("note")}${count}</span>` : "";
}

const badgeLines = (id) =>
  state.notes
    .filter((n) => n.view === "editor" && n.place === id)
    .map((n) => esc(n.text.trim().split("\n")[0].slice(0, 60) || "An empty note."))
    .join("<br>");

/* ---------- keeping each view's notes drawn ---------- */

document.addEventListener("DOMContentLoaded", () => {
  EDITOR_HOOKS.push(() => renderStickies("editor"));
  new MutationObserver((records) => {
    if (records.some((r) => [...r.addedNodes].some((el) => !el.classList?.contains("sticky-layer")))) renderStickies("panel");
  }).observe(sideEl, { childList: true });
  new MutationObserver(() => renderStickies("dialog")).observe(dialogBack, { childList: true });
  // A panel, dialog or grid that changes size keeps its notes inside.
  const refit = () => (renderStickies("panel"), renderStickies("dialog"), renderStickies("editor"));
  new ResizeObserver(refit).observe(sideEl);
  window.addEventListener("resize", refit);
  // Arrows follow controls that scroll inside a panel or dialog.
  document.addEventListener(
    "scroll",
    (event) => {
      if (event.target.closest?.("#side")) renderStickies("panel");
      else if (event.target.closest?.(".dialog")) renderStickies("dialog");
    },
    true,
  );
  addTips([
    [".note-badge", (el) => `${el.textContent} note${el.textContent === "1" ? "" : "s"} inside`, (el) => badgeLines(el.dataset.notes)],
  ]);
});
