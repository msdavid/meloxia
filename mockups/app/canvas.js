"use strict";
// The song canvas: blocks you can drop, move, connect, duplicate and delete, and the connections between them.
// Blocks are sections (state.sections) and the flow blocks of area A (state.blocks: Play together's split and join
// bars, Speed change); notes for yourself are stickies*.js; the flow rules, the questions and the path strip live in flow*.js, and
// how a section block is drawn in canvas.nodes.js.

const canvasEl = $("#canvas");
const worldEl = $("#world");
const nodesEl = $("#nodes");
const edgesEl = $("#edges");
const toolsEl = $("#tools");
// Rule chips and Cue buttons sit on the connections, above the lines and below the tools.
const chipsEl = Object.assign(document.createElement("div"), { className: "edge-chips" });
worldEl.insertBefore(chipsEl, toolsEl);

state.blocks ??= [];
const blk = (id) => (id === "start" ? { id, kind: "start", ...state.start } : sec(id) ? { kind: "section", ...sec(id) } : state.blocks.find((b) => b.id === id));
const rawBlock = (id) => (id === "start" ? state.start : sec(id) ?? state.blocks.find((b) => b.id === id));
const edgeKey = (edge) => edge.id ?? `${edge.from}>${edge.to}`;

/* ---------- view (pan and zoom) ---------- */

function applyView() {
  const { x, y, z } = state.view;
  worldEl.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
  canvasEl.style.backgroundPosition = `${x}px ${y}px`;
  canvasEl.style.backgroundSize = `${24 * z}px ${24 * z}px`;
  $("#zoom-label").textContent = `${Math.round(z * 100)}%`;
}

function toWorld(clientX, clientY) {
  const rect = canvasEl.getBoundingClientRect();
  const { x, y, z } = state.view;
  return { x: (clientX - rect.left - x) / z, y: (clientY - rect.top - y) / z };
}

function zoomAt(factor, clientX, clientY) {
  const rect = canvasEl.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const view = state.view;
  const z = clamp(0.4, view.z * factor, 1.8);
  view.x = px - ((px - view.x) / view.z) * z;
  view.y = py - ((py - view.y) / view.z) * z;
  view.z = z;
  viewTouched = true;
  applyView();
}

const SIDE_COVER = 14 + 380 + 14; // the docked side panel covers this much of the canvas's right edge
const STRIP_COVER = 64; // the path strip along the bottom
let viewTouched = false; // panned or zoomed by hand: stop re-fitting on resize

/** Frames the whole song in the part of the canvas the side panel and the path strip leave visible. */
const FIT_FLOOR = 0.7; // below this, names get hard to read

/** Frames the whole song. Unless `all` (the Fit button), a song too big to read whole starts at FIT_FLOOR from Start. */
function fitView(all = false) {
  const rect = canvasEl.getBoundingClientRect();
  if (!rect.width) return;
  const width = rect.width - (canvasEl.parentElement.classList.contains("side-open") ? SIDE_COVER : 0); // the stage; editor.js may not have loaded yet
  const height = rect.height - STRIP_COVER;
  const boxes = ["start", ...state.sections.map((s) => s.id), ...state.blocks.map((b) => b.id)].map((id) => {
    const b = boxOf(id);
    return [b.x, b.y, b.x + b.w, b.y + b.h + (loopDepth(id) ? 70 : 0)];
  });
  const x0 = Math.min(...boxes.map((b) => b[0]));
  const y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[2]));
  const y1 = Math.max(...boxes.map((b) => b[3]));
  const z = clamp(0.4, Math.min((width - 160) / (x1 - x0), (height - 160) / (y1 - y0)), 1.1);
  state.view = { z, x: (width - (x1 - x0) * z) / 2 - x0 * z, y: (height - (y1 - y0) * z) / 2 - y0 * z };
  if (!all && z < FIT_FLOOR) {
    const s = boxOf("start"), f = FIT_FLOOR, tall = (y1 - y0) * f > height - 160;
    state.view = { z: f, x: 80 - s.x * f, y: tall ? height / 2 - (s.y + s.h / 2) * f : (height - (y1 - y0) * f) / 2 - y0 * f };
  }
  viewTouched = false;
  applyView();
}

// The canvas changes size with the window (and the page may first lay out at another size): keep the song framed,
// or, once the view was moved by hand, keep the same point in the middle.
let lastCanvas = null;
new ResizeObserver(() => {
  const rect = canvasEl.getBoundingClientRect();
  if (!rect.width) return;
  if (!viewTouched || !lastCanvas) fitView();
  else {
    state.view.x += (rect.width - lastCanvas.width) / 2;
    state.view.y += (rect.height - lastCanvas.height) / 2;
    applyView();
  }
  lastCanvas = { width: rect.width, height: rect.height };
}).observe(canvasEl);

/* ---------- geometry: block boxes and ports ---------- */

const FLOW_SIZE = { tempo: [150, 64], split: [16, 0], join: [16, 0] };

/** A block's box in world units. Play together's bars stretch to span their branches. */
function boxOf(id) {
  const b = blk(id);
  if (b.kind === "start") return { x: b.x, y: b.y, w: START_W, h: START_H };
  if (b.kind === "section") return { x: b.x, y: b.y, w: NODE_W, h: NODE_H };
  if (b.kind === "split" || b.kind === "join") {
    const ys = state.edges
      .filter((e) => (b.kind === "split" ? e.from === id : e.to === id))
      .map((e) => (b.kind === "split" ? portY(e.to, "in") : portY(e.from, "out")));
    const top = ys.length ? Math.min(...ys) - 34 : b.y;
    const bottom = ys.length ? Math.max(...ys) + 34 : b.y + 160;
    return { x: b.x, y: top, w: 16, h: Math.max(bottom - top, 90) };
  }
  const [w, h] = FLOW_SIZE[b.kind];
  return { x: b.x, y: b.y, w, h };
}

const portY = (id, side) => {
  const b = blk(id);
  if (b.kind === "split" || b.kind === "join") return b.y + 80; // a bar's own middle, before branches stretch it
  const box = boxOf(id);
  return box.y + (b.kind === "section" ? NODE_H / 2 : box.h / 2);
};

/** Where a connection leaves `id`. A split bar sends each branch out level with the branch it feeds. */
function outPort(id, edge) {
  const box = boxOf(id);
  const b = blk(id);
  if (b.kind === "split" && edge) return { x: box.x + box.w, y: portY(edge.to, "in") };
  return { x: box.x + box.w, y: b.kind === "join" ? box.y + box.h / 2 : portY(id, "out") };
}

/** Where a connection enters `id`. A join bar takes each branch in level with where it comes from. */
function inPort(id, edge) {
  const box = boxOf(id);
  const b = blk(id);
  if (b.kind === "join" && edge) return { x: box.x, y: portY(edge.from, "out") };
  return { x: box.x, y: b.kind === "split" ? box.y + box.h / 2 : portY(id, "in") };
}

/** Loops are connections back to a block already on the way from Start (or to itself), wherever the blocks sit. */
function loopKeys() {
  const keys = new Set(), seen = new Set(), path = new Set();
  const visit = (id) => {
    seen.add(id);
    path.add(id);
    for (const e of state.edges) if (e.from === id) path.has(e.to) ? keys.add(edgeKey(e)) : seen.has(e.to) || visit(e.to);
    path.delete(id);
  };
  visit("start");
  [...state.sections, ...state.blocks].sort((a, b) => a.x - b.x).forEach((b) => seen.has(b.id) || visit(b.id));
  return keys;
}
const isLoop = (edge) => loopKeys().has(edgeKey(edge));
const loopDepth = (id) => state.edges.filter((e) => isLoop(e) && (e.from === id || e.to === id)).length;

/* ---------- rendering ---------- */

function renderNodes() {
  const { x, y } = state.start;
  nodesEl.innerHTML =
    `<div class="start" data-id="start" style="left:${x}px; top:${y}px">${icon("play")}Start<i class="port out"></i></div>` +
    state.sections.map(nodeHtml).join("") +
    state.blocks.map((b) => flowBlockHtml(b, boxOf(b.id))).join("");
  updateSelection();
}

function curve(a, b) {
  const dx = Math.max(48, Math.abs(b.x - a.x) * 0.5);
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
}

/** A path through right-angled points with rounded corners. */
function rounded(pts, r = 10) {
  const toward = (p, q, k) => ({ x: p.x + Math.sign(q.x - p.x) * k, y: p.y + Math.sign(q.y - p.y) * k });
  return pts.map((p, i) => {
    if (!i || i === pts.length - 1) return `${i ? "L" : "M"}${p.x},${p.y}`;
    const [q, n] = [pts[i - 1], pts[i + 1]];
    const b = toward(p, q, Math.min(r, Math.hypot(p.x - q.x, p.y - q.y) / 2)), c = toward(p, n, Math.min(r, Math.hypot(n.x - p.x, n.y - p.y) / 2));
    return `L${b.x},${b.y} Q${p.x},${p.y} ${c.x},${c.y}`;
  }).join(" ");
}

/** The path of a connection, and the point its chip sits on. Loops run as an arc under the blocks. */
function edgeShape(edge) {
  const from = outPort(edge.from, edge);
  const to = inPort(edge.to, edge);
  const a = { x: from.x + 7, y: from.y };
  const tip = { x: to.x - 8, y: to.y };
  const end = { x: tip.x - 7, y: tip.y };
  if (isLoop(edge)) {
    const fb = boxOf(edge.from), tb = boxOf(edge.to);
    const loops = state.edges.filter(isLoop);
    const yb = Math.max(fb.y + fb.h, tb.y + tb.h) + 34 + 18 * loops.indexOf(edge);
    const d = `M${a.x},${a.y} C${a.x + 30},${a.y} ${a.x + 30},${yb} ${a.x},${yb} L${end.x},${yb} C${end.x - 30},${yb} ${end.x - 30},${end.y} ${end.x},${end.y}`;
    return { d, tip, end, mid: { x: (a.x + end.x) / 2, y: yb } };
  }
  const fb = boxOf(edge.from), tb = boxOf(edge.to), down = tb.y >= fb.y + fb.h;
  if (end.x < a.x + 40 && (down || fb.y >= tb.y + tb.h)) {
    // Forward to a block on another row: through the gap just outside the target's row, then in from the left.
    // Several from one block stack 8 apart, the one going furthest left outermost, so they never cross.
    const i = state.edges.filter((e) => e.from === edge.from && boxOf(e.to).x > tb.x).length;
    const yg = down ? tb.y - 24 - 8 * i : tb.y + tb.h + 24 + 8 * i;
    const xr = a.x + 20, xl = end.x - 24;
    const d = rounded([a, { x: xr, y: a.y }, { x: xr, y: yg }, { x: xl, y: yg }, { x: xl, y: end.y }, end]);
    return { d, tip, end, mid: { x: (xr + xl) / 2, y: yg } };
  }
  const dx = Math.max(48, Math.abs(end.x - a.x) * 0.5);
  // Midpoint of the cubic: (P0 + 3·P1 + 3·P2 + P3) / 8.
  const mid = { x: (a.x + 3 * (a.x + dx) + 3 * (end.x - dx) + end.x) / 8, y: (a.y + end.y) / 2 };
  return { d: curve(a, end), tip, end, mid };
}

function edgeHtml(shape, cls, index) {
  const { d, tip, end } = shape;
  return `<g class="${cls}" data-edge="${index}">
    <path class="hit" d="${d}"/><path class="line" d="${d}"/>
    <path class="arrow" d="M${end.x - 1},${end.y - 5} L${tip.x},${tip.y} L${end.x - 1},${end.y + 5} Z"/>
  </g>`;
}

/** Draws every connection with its rule chip, plus the one being dragged out of a port if there is one. */
function renderEdges(dragging) {
  let html = "", chips = "";
  state.edges.forEach((edge, index) => {
    const shape = edgeShape(edge);
    const selected = state.selected?.type === "edge" && state.selected.id === index;
    const cls = `edge${selected ? " sel" : ""}${state.liveEdge === edgeKey(edge) ? " live" : ""}${isLoop(edge) ? " loop" : ""}${flowEdgeClass(edge)}`;
    html += edgeHtml(shape, cls, index);
    chips += flowEdgeChip(edge, index, shape.mid);
  });
  if (dragging) html += `<path class="edge-temp" d="${curve({ x: dragging.a.x + 7, y: dragging.a.y }, dragging.b)}"/>`;
  edgesEl.innerHTML = html;
  chipsEl.innerHTML = chips;
  renderStickies("canvas"); // notes on blocks and connections follow them (stickies.js)
}

function updateSelection() {
  const selected = state.selected;
  $$("[data-id]", nodesEl).forEach((el) => {
    el.classList.toggle("sel", selected?.type === "node" && selected.id === el.dataset.id);
  });
  renderEdges();

  toolsEl.hidden = true;
  toolsEl.classList.toggle("round", selected?.type === "edge");
  if (selected?.type === "node" && selected.id !== "start") {
    const b = blk(selected.id);
    const box = boxOf(selected.id);
    toolsEl.innerHTML =
      b.kind === "section"
        ? `<button data-tool-act="open">${icon("open")}Open</button>` +
          `<button data-tool-act="settings">${icon("sliders")}Settings</button>` +
          `<button data-tool-act="duplicate">${icon("copy")}</button>` +
          `<button data-tool-act="delete">${icon("trash")}</button>`
        : `<button data-tool-act="settings">${icon("sliders")}Settings</button><button data-tool-act="delete">${icon("trash")}</button>`;
    toolsEl.style.left = `${box.x}px`;
    toolsEl.style.top = `${box.y - 42}px`;
    toolsEl.hidden = false;
  } else if (selected?.type === "edge") {
    const edge = state.edges[selected.id];
    const { mid } = edgeShape(edge);
    toolsEl.innerHTML = `<button data-tool-act="rule">${icon("sliders")}</button><button data-tool-act="delete">${icon("trash")}</button>`;
    toolsEl.style.left = `${mid.x}px`;
    toolsEl.style.top = `${mid.y + 30}px`;
    toolsEl.hidden = false;
  }
}

function select(selection) {
  state.selected = selection;
  updateSelection();
}

/* ---------- editing the song ---------- */

const snap = (v) => Math.round(v / 10) * 10;

function addSection(worldX, worldY) {
  const n = state.seq++;
  const section = {
    id: makeId("s", n),
    name: SECTION_NAMES[n] ?? `Section ${state.sections.length + 1}`,
    hue: SECTION_HUES[(state.sections.length + n) % SECTION_HUES.length],
    x: snap(worldX - NODE_W / 2),
    y: snap(worldY - NODE_H / 2),
    bars: 2,
    repeats: 1,
    rows: [],
    ...sectionSettings(),
  };
  state.sections.push(section);
  state.selected = { type: "node", id: section.id };
  renderNodes();
  $(`.node[data-id="${section.id}"]`, nodesEl).classList.add("pop-in");
  return section;
}

function duplicateSection(id) {
  const source = sec(id);
  const copy = structuredClone(source);
  copy.id = makeId("s");
  copy.name = `${source.name} copy`;
  copy.x += 40;
  copy.y += NODE_H + 30;
  state.sections.push(copy);
  state.selected = { type: "node", id: copy.id };
  renderNodes();
}

/** Delete or Backspace on the canvas. Flow rules (reconnecting neighbours, Play together pairs) live in flow.js. */
function deleteSelected() {
  const selected = state.selected;
  if (!selected || (selected.type === "node" && selected.id === "start")) return;
  if (selected.type === "edge") flowDeleteEdge(selected.id);
  else flowDeleteBlock(selected.id);
  state.selected = null;
  renderNodes();
  renderPanel(); // closes it if its section went
}

/** Double-click or Enter on a block: a section opens in the editor, a flow block opens its settings. */
function openBlock(id) {
  if (sec(id)) return openEditor(id);
  flowOpenSettings(id);
}

/* ---------- pointer interactions ---------- */

/** Runs `onMove` until the pointer is released, then `onUp`. */
function track(onMove, onUp) {
  const up = (event) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", up);
    onUp?.(event);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", up);
}

const BLOCK_SEL = ".node, .start, .fblock";
function nodeUnder(event) {
  return document.elementFromPoint(event.clientX, event.clientY)?.closest(BLOCK_SEL)?.dataset.id ?? null;
}

/** The connection under the pointer, ignoring the block being dragged. */
function edgeUnder(event) {
  const hit = document.elementsFromPoint(event.clientX, event.clientY).find((el) => el.matches?.(".edge .hit"));
  return hit ? Number(hit.parentElement.dataset.edge) : null;
}

function startConnect(fromId) {
  const a = outPort(fromId);
  const mark = (id) => $$(BLOCK_SEL, nodesEl).forEach((el) => el.classList.toggle("drop", el.dataset.id === id));
  canvasEl.classList.add("connecting");
  track(
    (event) => {
      const over = nodeUnder(event);
      const target = over && over !== "start" ? over : null;
      mark(target);
      const b = target ? inPort(target, { from: fromId, to: target }) : toWorld(event.clientX, event.clientY);
      renderEdges({ a, b: target ? { x: b.x - 8, y: b.y } : b });
    },
    (event) => {
      const over = nodeUnder(event);
      mark(null);
      canvasEl.classList.remove("connecting");
      if (over) flowConnect(fromId, over, event);
      updateSelection();
    },
  );
}

function startMove(event, el) {
  const id = el.dataset.id;
  const item = rawBlock(id);
  const origin = { x: item.x, y: item.y, px: event.clientX, py: event.clientY };
  let moved = false;
  track(
    (move) => {
      const dx = (move.clientX - origin.px) / state.view.z;
      const dy = (move.clientY - origin.py) / state.view.z;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      el.classList.add("dragging");
      item.x = snap(origin.x + dx);
      item.y = snap(origin.y + dy);
      el.style.left = `${item.x}px`;
      el.style.top = `${item.y}px`;
      if (blk(id).kind === "split" || blk(id).kind === "join") return renderNodes();
      updateSelection();
      flowDragOver(id, move);
    },
    (up) => {
      el.classList.remove("dragging");
      if (moved) flowDrop(id, up);
    },
  );
}

function startPan(event) {
  const origin = { x: state.view.x, y: state.view.y, px: event.clientX, py: event.clientY };
  canvasEl.classList.add("panning");
  track(
    (move) => {
      state.view.x = origin.x + move.clientX - origin.px;
      state.view.y = origin.y + move.clientY - origin.py;
      viewTouched = true;
      applyView();
    },
    () => canvasEl.classList.remove("panning"),
  );
}

canvasEl.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const target = event.target;
  if (target.closest(".zoom, .hints, .node-tools, .rep, .edge-chips button, .path-strip, .fblock textarea")) return;

  const port = target.closest(".port.out");
  if (port) {
    event.preventDefault();
    return startConnect(port.closest(BLOCK_SEL).dataset.id);
  }

  const node = target.closest(BLOCK_SEL);
  if (node) {
    select({ type: "node", id: node.dataset.id });
    return startMove(event, node);
  }

  const edge = target.closest(".edge");
  if (edge) return select({ type: "edge", id: Number(edge.dataset.edge) });

  select(null);
  startPan(event);
});

nodesEl.addEventListener("dblclick", (event) => {
  const node = event.target.closest(".node, .fblock");
  if (node && !event.target.closest("button, .port, textarea")) openBlock(node.dataset.id);
});

nodesEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-rep]");
  if (!button) return;
  const node = button.closest(".node");
  const section = sec(node.dataset.id);
  section.repeats = clamp(1, section.repeats + Number(button.dataset.rep), 16);
  $(".rep b", node).textContent = `×${section.repeats}`;
  flowEdited();
});

toolsEl.addEventListener("click", (event) => {
  const act = event.target.closest("[data-tool-act]")?.dataset.toolAct;
  const selected = state.selected;
  if (act === "open") openEditor(selected.id);
  if (act === "settings") sec(selected.id) ? openPanel("section", selected.id) : flowOpenSettings(selected.id);
  if (act === "duplicate") duplicateSection(selected.id);
  if (act === "rule") flowOpenRule(selected.id);
  if (act === "delete") deleteSelected();
});

canvasEl.addEventListener(
  "wheel",
  (event) => {
    if (event.target.closest(".path-strip")) return;
    event.preventDefault();
    // A mouse wheel notch (deltaY ~100) zooms like the buttons; small trackpad pinch deltas stay smooth.
    if (event.ctrlKey || event.metaKey) return zoomAt(Math.exp(-clamp(-18, event.deltaY, 18) * 0.01), event.clientX, event.clientY);
    state.view.x -= event.deltaX;
    state.view.y -= event.deltaY;
    viewTouched = true;
    applyView();
  },
  { passive: false },
);

$(".zoom").addEventListener("click", (event) => {
  const act = event.target.closest("[data-zoom]")?.dataset.zoom;
  const rect = canvasEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  if (act === "in") zoomAt(1.2, cx, cy);
  if (act === "out") zoomAt(1 / 1.2, cx, cy);
  if (act === "reset") zoomAt(1 / state.view.z, cx, cy);
  if (act === "fit") fitView(true);
});
