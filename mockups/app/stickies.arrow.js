"use strict";
// Notes for yourself, part 3: a note's arrow. Its tail is joined to the nearest edge of the note (or of its icon when
// minimised) and its tip points at something in the same view: a ref like the note's own (stickies.places.js), so
// a tip on a block, a step or a control follows it. Only the tip's handle can be grabbed.

const arrowKey = new WeakMap(); // a stable key per note for the tip's last drawn point
const tipKey = (n) => (arrowKey.has(n) ? arrowKey.get(n) : (arrowKey.set(n, {}), arrowKey.get(n)));
const drawnTail = new Map(); // note id → where its arrow last left it, as drawn

function arrowsSvg(drawn, P) {
  const parts = drawn
    .filter((d) => d.n.arrow)
    .map(({ n, pos }) => {
      const tip = refPoint(P, n.arrow.tip, tipKey(n));
      const box = noteBox(n, pos);
      const tail = { x: clamp(box.x, tip.x, box.x + box.w), y: clamp(box.y, tip.y, box.y + box.h) };
      drawnTail.set(n.id, tail);
      const len = Math.hypot(tip.x - tail.x, tip.y - tail.y);
      const handle = `<circle class="sticky-tip" data-note="${n.id}" cx="${tip.x}" cy="${tip.y}" r="7"/>`;
      if (len < 12) return `<g class="sticky-arrow" style="--sc:${NOTE_COLOURS[n.color][1]}">${handle}</g>`;
      const a = Math.atan2(tip.y - tail.y, tip.x - tail.x), s = 11;
      const wing = (t) => `${tip.x - s * Math.cos(a + t)},${tip.y - s * Math.sin(a + t)}`;
      return `<g class="sticky-arrow" style="--sc:${NOTE_COLOURS[n.color][1]}">
        <path class="line" d="M${tail.x},${tail.y} L${tip.x},${tip.y}"/><path class="head" d="M${wing(0.45)} L${tip.x},${tip.y} L${wing(-0.45)} Z"/>${handle}</g>`;
    });
  return parts.length ? `<svg class="sticky-arrows">${parts.join("")}</svg>` : "";
}

/** Pulls out a new arrow or moves the tip of the one there; the thing under the tip is outlined while dragging. */
function dragArrow(n, event) {
  const P = PLACES[n.view];
  let lit = null;
  const light = (el) => {
    if (lit === el) return;
    lit?.classList.remove("sticky-target");
    lit = el;
    el?.classList.add("sticky-target");
  };
  const onOwnNote = (e) => document.elementsFromPoint(e.clientX, e.clientY).some((el) => el.closest(`.sticky[data-note="${n.id}"], .sticky-icon[data-note="${n.id}"]`));
  track(
    (e) => {
      light(onOwnNote(e) ? null : P.thingAt(e.clientX, e.clientY).el);
      n.arrow = { tip: refFrom(P, null, P.local(e.clientX, e.clientY)) };
      renderStickies(n.view);
      if (lit && !lit.isConnected) lit = null; // the view redrew under it
    },
    (e) => {
      light(null);
      if (onOwnNote(e)) {
        const had = n.arrow;
        n.arrow = null;
        if (had) toast("Arrow removed");
      } else n.arrow = { tip: refFrom(P, P.thingAt(e.clientX, e.clientY).on, P.local(e.clientX, e.clientY)) };
      renderStickies(n.view);
    },
  );
}
