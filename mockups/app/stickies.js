"use strict";
// Notes for yourself (shared module): floating notes in every view (the canvas, the section editor, the side panel
// and dialogs), each kept with the place it was put, with free text, a colour, minimise to an icon, and one arrow
// pointing at something. The views are in stickies.places.js and the arrow in stickies.arrow.js. Notes are song
// data (state.notes): saved with the song and covered by undo.
//
//   note: { id, view, place, at, w, h, text, color, min, icon?, arrow: { tip } | null }
//     icon   where the minimised icon sits inside the note's box, { dx, dy }: at the top-left corner, or, for a
//            note with an arrow, where the arrow leaves the note, so minimising leaves the arrow exactly as it was
//     view   "canvas" | "editor" | "panel" | "dialog";  place: the open section, panel or dialog ("" on the canvas)
//     at, tip   a ref { on, dx, dy }: an offset from a thing in the view (a block, a grid step, a control), or from
//               the view's own corner when `on` is null. A place turns refs into points (stickies.places.js).
//   renderStickies(view)   redraws one view's notes (canvas.js, the editor, panel and dialog hooks call it)
//   addNoteAt(x, y)        a new note at a screen point, in whatever view is there (palette, right-click, N)

state.notes ??= [];

const NOTE_COLOURS = { yellow: ["Yellow", "#e8c547"], pink: ["Pink", "#ec6fa8"], blue: ["Blue", "#5aa9e6"], green: ["Green", "#5fbf74"], purple: ["Purple", "#a68af0"] };
const NOTE_SIZE = { w: 200, h: 110, minW: 130, minH: 64, icon: 28 };
let noteSeq = 0;
let freshNote = null; // the note just added: only it animates in, not every redraw
const noteById = (id) => state.notes.find((n) => n.id === id);
const notesIn = (view, place) => state.notes.filter((n) => n.view === view && n.place === place);
const iconAt = (n) => (n.min && n.icon) || { dx: 0, dy: 0 };
/** What a note covers at layer point pos (its top-left), and where that box sits from pos (ox, oy: the icon). */
function noteBox(n, pos) {
  if (!n.min) return { x: pos.x, y: pos.y, w: n.w, h: n.h, ox: 0, oy: 0 };
  const { dx, dy } = iconAt(n), I = NOTE_SIZE.icon;
  return { x: pos.x + dx, y: pos.y + dy, w: I, h: I, ox: dx, oy: dy };
}

/** The text of a minimised note, for its tooltip: line breaks kept, cut short when very long. */
function noteTipText(n) {
  const text = n.text.trim() || "An empty note.";
  return esc(text.length > 280 ? `${text.slice(0, 279).trimEnd()}…` : text).replace(/\n/g, "<br>");
}

/* ---------- drawing ---------- */

function stickyHtml(n, pos, animate = true) {
  const style = `left:${pos.x}px; top:${pos.y}px; --sc:${NOTE_COLOURS[n.color][1]}`;
  const fresh = animate && n.id === freshNote ? " fresh" : "";
  if (n.min) {
    const { dx, dy } = iconAt(n);
    return `<button class="sticky-icon${fresh}" data-note="${n.id}" style="${style}; translate:${dx}px ${dy}px">${icon("note")}</button>`;
  }
  const where = stickyWhere(n);
  return `<div class="sticky${fresh}" data-note="${n.id}" style="${style}; width:${n.w}px; height:${n.h}px">
    <div class="sticky-bar"><button class="sticky-btn sticky-colour" data-st="colour"></button>${where ? `<span class="sticky-where">${esc(where)}</span>` : ""}
      <button class="sticky-btn" data-st="min">${icon("minus")}</button><button class="sticky-btn" data-st="del">${icon("x")}</button></div>
    <textarea data-st="text" spellcheck="false" placeholder="Type a note…">${esc(n.text)}</textarea>
    <i class="sticky-size" data-st="size"></i>${n.arrow ? "" : `<i class="sticky-pull" data-st="pull"></i>`}
  </div>`;
}

/** The layer a view's notes are drawn in, made on first use (a view that redraws itself loses it, so it comes back). */
function stickyLayer(view, host) {
  let layer = [...host.children].find((el) => el.classList.contains("sticky-layer"));
  if (!layer) host.append((layer = Object.assign(document.createElement("div"), { className: "sticky-layer" })));
  layer.dataset.view = view; // not a class: .canvas, .editor, .panel and .dialog are the views' own classes
  return layer;
}

const cardShape = new WeakMap(); // what each drawn card shows, apart from its place and its text
const drawnPos = new Map(); // note id → where it was last drawn: minimising works from what is on screen

/** Where a note is drawn. In a panel or dialog it is kept inside the view, in the grid inside the grid, as the open
 *  note would be, minimised or not, so both states share one position; and kept clear of its own arrow tip there, so
 *  a smaller view never hides it. */
function drawnSpot(P, n) {
  let pos = refPoint(P, n.at, n);
  const b = P.fixed ? P.bounds() : P.keep?.();
  if (!b) return pos;
  const open = { ...n, min: false };
  pos = clampNote(P, pos, noteBox(open, pos), b);
  if (!n.arrow) return pos;
  const tip = refPoint(P, n.arrow.tip, tipKey(n)), gap = 16;
  const clear = (p) => Math.hypot(tip.x - clamp(p.x, tip.x, p.x + n.w), tip.y - clamp(p.y, tip.y, p.y + n.h)) >= gap;
  if (clear(pos)) return pos;
  // The nearest place beside the tip, on any side, that still fits the view.
  const tries = [{ x: tip.x + gap, y: pos.y }, { x: tip.x - n.w - gap, y: pos.y }, { x: pos.x, y: tip.y + gap }, { x: pos.x, y: tip.y - n.h - gap }]
    .map((p) => clampNote(P, p, noteBox(open, p), b))
    .filter(clear)
    .sort((a, b) => Math.hypot(a.x - pos.x, a.y - pos.y) - Math.hypot(b.x - pos.x, b.y - pos.y));
  return tries[0] ?? pos;
}

function renderStickies(view) {
  const P = PLACES[view];
  const host = P.host();
  if (!host) return;
  const layer = stickyLayer(view, host);
  const drawn = notesIn(view, P.place()).map((n) => {
    const pos = drawnSpot(P, n);
    drawnPos.set(n.id, pos);
    return { n, pos };
  });
  // Cards that look the same are only moved, never rebuilt: typing goes on undisturbed, and redraws are cheap
  // (the canvas redraws its notes on every frame of a drag).
  const old = new Map([...layer.querySelectorAll(":scope > [data-note]")].map((el) => [el.dataset.note, el]));
  const svg = arrowsSvg(drawn, P);
  layer.querySelector(":scope > .sticky-arrows")?.remove();
  if (svg) layer.insertAdjacentHTML("afterbegin", svg);
  for (const { n, pos } of drawn) {
    const shape = stickyHtml({ ...n, text: "" }, { x: 0, y: 0 }, false); // its entrance animation ending is no change
    let el = old.get(n.id);
    old.delete(n.id);
    if (el && cardShape.get(el) === shape) {
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      const area = $("textarea", el);
      if (area && area.value !== n.text) area.value = n.text; // brought back by undo
      continue;
    }
    const tmp = document.createElement("div");
    tmp.innerHTML = stickyHtml(n, pos);
    const card = tmp.firstElementChild;
    cardShape.set(card, shape);
    const focus = el?.contains(document.activeElement) ? document.activeElement : null;
    el ? el.replaceWith(card) : layer.append(card);
    if (focus?.matches("textarea")) {
      const area = $("textarea", card);
      area?.focus({ preventScroll: true });
      area?.setSelectionRange(focus.selectionStart, focus.selectionEnd);
    }
  }
  old.forEach((el) => el.remove());
}
const renderAllStickies = () => Object.keys(PLACES).forEach(renderStickies);

/* ---------- adding, deleting, minimising ---------- */

function addNote(view, at) {
  const n = { id: makeId("n", noteSeq++), view, place: PLACES[view].place(), at, w: NOTE_SIZE.w, h: NOTE_SIZE.h, text: "", color: "yellow", min: false, arrow: null };
  state.notes.push(n);
  freshNote = n.id;
  renderStickies(view);
  setTimeout(() => freshNote === n.id && (freshNote = null), 200);
  if (view === "editor") renderNodes(); // the section block's note count
  $(`.sticky[data-note="${n.id}"] textarea`)?.focus({ preventScroll: true });
  return n;
}

/** Where a note put at a screen point would go: its view and its ref (null when no view is there). */
function noteSpot(x, y) {
  const view = viewAt(x, y);
  if (!view) return null;
  const P = PLACES[view];
  const pt = clampNote(P, P.local(x, y), { w: NOTE_SIZE.w, h: NOTE_SIZE.h }); // a new note fits inside its view
  return { view, at: refFrom(P, P.noteOn(x, y), pt) };
}

const addNoteAt = (x, y) => {
  const spot = noteSpot(x, y);
  return spot && addNote(spot.view, spot.at);
};

function deleteNote(n) {
  state.notes = state.notes.filter((x) => x !== n);
  renderStickies(n.view);
  if (n.view === "editor") renderNodes();
  toast("Note deleted", { action: "Undo", onAction: undo });
}

const minTip = (n) => (n?.arrow ? "Shrinks the note to a small icon where its arrow starts." : "Shrinks the note to a small icon at its top-left corner.");

/** For a note with an arrow: the icon inside the note's box, its edge on the point the arrow leaves from. Taken
 *  from the note and arrow as drawn at this instant, and kept until the note is next minimised. */
function iconSpot(n) {
  const pos = drawnPos.get(n.id), tail = drawnTail.get(n.id), I = NOTE_SIZE.icon;
  if (!n.arrow || !pos || !tail || !$(`.sticky[data-note="${n.id}"]`)) return null;
  return { dx: Math.round(clamp(0, tail.x - pos.x - I / 2, n.w - I)), dy: Math.round(clamp(0, tail.y - pos.y - I / 2, n.h - I)) };
}

/** Minimises or opens notes. The card shrinks into its icon, or grows back out of it, animated here (stickies.css
 *  only keeps the shrinking copy from taking clicks). */
function setMinimised(notes, min) {
  const going = notes.filter((n) => n.min !== min);
  const cards = new Map(going.map((n) => [n, $(`.sticky[data-note="${n.id}"]`)]));
  going.forEach((n) => {
    if (min) n.icon = iconSpot(n) ?? undefined;
    n.min = min;
  });
  new Set(notes.map((n) => n.view)).forEach(renderStickies);
  going.forEach((n) => {
    const I = NOTE_SIZE.icon, { dx, dy } = n.icon ?? { dx: 0, dy: 0 };
    const sx = I / n.w, sy = I / n.h; // scaling about this origin maps the card's box onto the icon's
    const origin = `${dx / (1 - sx)}px ${dy / (1 - sy)}px`;
    const small = { transform: `scale(${sx}, ${sy})`, opacity: 0.4 }, full = { transform: "none", opacity: 1 };
    if (min) {
      const ghost = cards.get(n), layer = $(`.sticky-icon[data-note="${n.id}"]`)?.parentElement;
      if (!ghost || !layer) return;
      ghost.removeAttribute("data-note");
      ghost.inert = true;
      ghost.classList.add("sticky-ghost");
      ghost.style.transformOrigin = origin;
      layer.append(ghost);
      ghost.animate([full, { ...small, opacity: 0 }], { duration: 150, easing: "ease-in" }).finished.then(() => ghost.remove(), () => ghost.remove());
    } else {
      const card = $(`.sticky[data-note="${n.id}"]`);
      if (!card) return;
      card.style.transformOrigin = origin;
      card.animate([small, full], { duration: 150, easing: "ease-out" });
    }
  });
}

function pickColour(n, anchor) {
  const dots = Object.entries(NOTE_COLOURS).map(([k, [, c]]) => `<button class="sticky-swatch${k === n.color ? " on" : ""}" data-st-colour="${k}" style="--sc:${c}"></button>`);
  openPopover(anchor, `<div class="sticky-swatches">${dots.join("")}</div>`, {
    className: "sticky-pop",
    onClick: (event) => {
      const dot = event.target.closest("[data-st-colour]");
      if (!dot) return;
      n.color = dot.dataset.stColour;
      closePopover();
      renderStickies(n.view);
    },
  });
}

/* ---------- moving and resizing ---------- */

function moveNote(n, event, wasIcon) {
  const P = PLACES[n.view];
  const z = P.scale(), start = refPoint(P, n.at, n), px = event.clientX, py = event.clientY;
  let moved = false;
  track(
    (e) => {
      if (!moved && Math.hypot(e.clientX - px, e.clientY - py) < 4) return;
      moved = true;
      const box = noteBox(P.fixed ? { ...n, min: false } : n, start); // as it is kept when drawn
      const pt = clampNote(P, { x: start.x + (e.clientX - px) / z, y: start.y + (e.clientY - py) / z }, box);
      n.at = refFrom(P, n.at.on, pt); // keeps its anchor while it moves
      renderStickies(n.view);
    },
    (e) => {
      if (!moved) {
        if (wasIcon) (openedAt = { id: n.id, t: performance.now() }), setMinimised([n], false);
        return;
      }
      n.at = P.settle(n, refPoint(P, n.at, n), e);
      renderStickies(n.view);
    },
  );
}

function resizeNote(n, event) {
  const P = PLACES[n.view];
  const z = P.scale(), w = n.w, h = n.h, px = event.clientX, py = event.clientY;
  const pos = refPoint(P, n.at, n), b = P.bounds(), room = 10 / z; // it grows no further than the view's edge
  track((e) => {
    n.w = Math.round(clamp(NOTE_SIZE.minW, w + (e.clientX - px) / z, Math.max(NOTE_SIZE.minW, b.x1 - pos.x - room)));
    n.h = Math.round(clamp(NOTE_SIZE.minH, h + (e.clientY - py) / z, Math.max(NOTE_SIZE.minH, b.y1 - pos.y)));
    renderStickies(n.view);
  });
}

/* ---------- input ---------- */

let lastPointer = { x: -1, y: -1 };
document.addEventListener("pointermove", (event) => (lastPointer = { x: event.clientX, y: event.clientY }), { passive: true });

// Capture: a note's own gestures never reach the canvas, grid or panel underneath.
document.addEventListener(
  "pointerdown",
  (event) => {
    const el = event.target.closest?.(".sticky, .sticky-icon, .sticky-tip");
    if (!el || event.button !== 0) return;
    event.stopPropagation();
    const n = noteById(el.dataset.note);
    const part = event.target.closest("[data-st]")?.dataset.st;
    if (part === "text" || (part && event.target.closest("button"))) return; // typing, or a button's own click
    event.preventDefault();
    if (el.matches(".sticky-tip") || part === "pull") return dragArrow(n, event);
    if (part === "size") return resizeNote(n, event);
    moveNote(n, event, el.matches(".sticky-icon"));
  },
  true,
);

// Double-clicking the top bar minimises, as its button does. Not right after an icon's click opened the note: the
// second click of that double-click lands on the card, and the note stays open.
let openedAt = { id: null, t: 0 };
document.addEventListener(
  "dblclick",
  (event) => {
    const bar = event.target.closest?.(".sticky-bar");
    if (!bar) return;
    event.stopPropagation(); // never the canvas's own double-click underneath
    if (event.target.closest("button")) return;
    const n = noteById(bar.closest(".sticky").dataset.note);
    if (openedAt.id === n.id && performance.now() - openedAt.t < 600) return;
    setMinimised([n], true);
  },
  true,
);

document.addEventListener("click", (event) => {
  const b = event.target.closest(".sticky button[data-st]");
  if (!b) return;
  const n = noteById(b.closest(".sticky").dataset.note);
  if (b.dataset.st === "min") setMinimised([n], true);
  else if (b.dataset.st === "del") deleteNote(n);
  else if (b.dataset.st === "colour") pickColour(n, b);
});

document.addEventListener("input", (event) => {
  const area = event.target.closest?.(".sticky textarea");
  if (!area) return;
  noteById(area.closest(".sticky").dataset.note).text = area.value;
  // One undo step per spell of typing: it ends when the note loses focus (history.js) or after a second's pause.
  clearTimeout(typingPause);
  typingPause = setTimeout(commitHistory, 1000);
});
let typingPause = 0;
// A press ends the spell instead (its focusout or pointerup commits), so the pause never lands inside a drag.
window.addEventListener("pointerdown", () => clearTimeout(typingPause), true);

// In a note, Enter starts a new line (elsewhere in the app it means "done").
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches?.(".sticky textarea")) event.stopPropagation();
});

// N drops a note where the pointer is; never during a recording take or its count-in, where keys play drums.
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "n" || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if (typeof REC !== "undefined" && (REC.on || REC.count)) return;
  if (event.target.isContentEditable || event.target.matches?.("input:not([type=range]), textarea, select")) return;
  if (addNoteAt(lastPointer.x, lastPointer.y)) event.preventDefault();
});

// Right-click: a note's own menu, or "Add note here" on empty space in any view. Registered before app.js's
// handler, after every view's own handlers: whatever they took (a block, a step with a note) is not empty space.
document.addEventListener("contextmenu", (event) => {
  if (event.defaultPrevented || event.target.closest?.('input:not([type=range]), textarea, [contenteditable="true"]')) return;
  const own = event.target.closest(".sticky, .sticky-icon");
  if (own) {
    event.preventDefault();
    return noteMenu(noteById(own.dataset.note), event);
  }
  const { clientX: x, clientY: y } = event;
  const view = viewAt(x, y);
  if (!view || event.target.closest("button, a, select, input, .tool")) return;
  event.preventDefault();
  const mine = notesIn(view, PLACES[view].place());
  const spot = noteSpot(x, y); // worked out now: the menu itself covers the spot once it is open
  const items = [{ label: "Add note here", icon: "note", key: "N", tip: "Puts a note for yourself at this spot.", action: () => addNote(spot.view, spot.at) }];
  if (mine.length)
    items.push(
      "-",
      { label: "Minimise all notes", tip: "Shrinks every note here to a small icon.", disabled: () => mine.every((n) => n.min), action: () => setMinimised(mine, true) },
      { label: "Show all notes", tip: "Opens every minimised note here again.", disabled: () => mine.every((n) => !n.min), action: () => setMinimised(mine, false) },
    );
  openMenu({ x, y }, items);
});

function noteMenu(n, event) {
  openMenu({ x: event.clientX, y: event.clientY }, [
    n.min
      ? { label: "Show note", tip: "Opens the note again at its size.", action: () => setMinimised([n], false) }
      : { label: "Minimise", tip: minTip(n), action: () => setMinimised([n], true) },
    { label: "Colour…", tip: "Picks this note's colour.", action: () => pickColour(n, { x: event.clientX, y: event.clientY }) },
    ...(n.arrow ? [{ label: "Remove arrow", tip: "Takes this note's arrow away.", action: () => ((n.arrow = null), renderStickies(n.view)) }] : []),
    "-",
    { label: "Delete note", icon: "trash", tip: "Removes this note. You can undo right after.", action: () => deleteNote(n) },
  ]);
}

/* ---------- wiring ---------- */

document.addEventListener("DOMContentLoaded", () => {
  addHistoryField("notes");
  HISTORY_HOOKS.push(() => requestAnimationFrame(renderAllStickies)); // after the views have redrawn
  addTips([
    [".sticky", "Note", "A note for yourself. Dragging its top bar moves it. It doesn't play."],
    [".sticky-bar", "Note", "Dragging it moves the note. Double-clicking it minimises the note."],
    [".sticky textarea", "Note text", "What you type here is saved with the song."],
    ['.sticky [data-st="colour"]', "Colour", "Picks this note's colour."],
    ['.sticky [data-st="min"]', "Minimise", (el) => minTip(noteById(el.closest(".sticky").dataset.note))],
    ['.sticky [data-st="del"]', "Delete note", "Removes this note. You can undo right after."],
    ['.sticky [data-st="size"]', "Resize", "Dragging this corner makes the note bigger or smaller."],
    ['.sticky [data-st="pull"]', "Arrow", "Dragging from here pulls out an arrow to point at something."],
    [".sticky-where", (el) => el.textContent, "The note is attached: it moves with what it is on."],
    [".sticky-icon", "Note", (el) => noteTipText(noteById(el.dataset.note))],
    [".sticky-tip", "Arrow tip", "Dragging it moves the tip. Dropped back on its note, the arrow goes."],
    ["[data-st-colour]", (el) => NOTE_COLOURS[el.dataset.stColour][0], "Gives the note this colour."],
  ]);
});
