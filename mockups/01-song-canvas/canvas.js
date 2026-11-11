"use strict";
// The song canvas: section blocks you can drop, move, connect, duplicate and delete.

const canvasEl = $("#canvas");
const worldEl = $("#world");
const nodesEl = $("#nodes");
const edgesEl = $("#edges");
const toolsEl = $("#tools");

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
  applyView();
}

function fitView() {
  const rect = canvasEl.getBoundingClientRect();
  const boxes = state.sections.map((s) => [s.x, s.y, s.x + NODE_W, s.y + NODE_H]);
  boxes.push([state.start.x, state.start.y, state.start.x + START_W, state.start.y + START_H]);
  const x0 = Math.min(...boxes.map((b) => b[0]));
  const y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[2]));
  const y1 = Math.max(...boxes.map((b) => b[3]));
  const z = clamp(0.4, Math.min((rect.width - 160) / (x1 - x0), (rect.height - 200) / (y1 - y0)), 1.1);
  state.view = { z, x: (rect.width - (x1 - x0) * z) / 2 - x0 * z, y: (rect.height - (y1 - y0) * z) / 2 - y0 * z };
  applyView();
}

/* ---------- rendering ---------- */

function thumbHtml(section) {
  if (!section.rows.length) return '<div class="thumb empty">Empty · double-click to build</div>';
  const steps = section.bars * STEPS_PER_BAR;
  const lanes = Math.max(section.rows.length, 4);
  let marks = "";
  for (let bar = 1; bar < section.bars; bar++) {
    marks += `<line class="bar-line" x1="${bar * STEPS_PER_BAR}" x2="${bar * STEPS_PER_BAR}" y1="0" y2="${lanes}"/>`;
  }
  section.rows.forEach((r, lane) => {
    const fill = `hsl(${inst(r.inst).hue} var(--is) var(--il))`;
    r.cells.forEach((cell, step) => {
      if (isOn(cell)) marks += `<rect x="${step + 0.12}" y="${lane + 0.2}" width="0.76" height="0.6" style="fill:${fill}"/>`;
    });
  });
  return `<div class="thumb"><svg viewBox="0 0 ${steps} ${lanes}" preserveAspectRatio="none">${marks}</svg><i class="thumb-head"></i></div>`;
}

function metaText(section) {
  const count = section.rows.length;
  return count ? `${count} instrument${count === 1 ? "" : "s"}` : "No instruments";
}

function nodeHtml(section) {
  return `<div class="node" data-id="${section.id}" style="--h:${section.hue}; left:${section.x}px; top:${section.y}px">
    <div class="node-head">
      <i class="dot"></i><span class="node-name">${esc(section.name)}</span>
      <span class="node-len">${section.bars} bar${section.bars === 1 ? "" : "s"}</span>
    </div>
    ${thumbHtml(section)}
    <div class="node-foot">
      <span class="node-meta">${metaText(section)}</span>
      <div class="rep" title="How many times this section plays">
        <button data-rep="-1">${icon("minus")}</button><b>×${section.repeats}</b><button data-rep="1">${icon("plus")}</button>
      </div>
    </div>
    <i class="port in"></i><i class="port out" title="Drag to the next section"></i>
    <div class="node-progress"><i></i></div>
  </div>`;
}

function renderNodes() {
  const { x, y } = state.start;
  nodesEl.innerHTML =
    `<div class="start" data-id="start" style="left:${x}px; top:${y}px">${icon("play")}Start<i class="port out" title="Drag to the first section"></i></div>` +
    state.sections.map(nodeHtml).join("");
  updateSelection();
}

function outPort(id) {
  if (id === "start") return { x: state.start.x + START_W, y: state.start.y + START_H / 2 };
  const s = sec(id);
  return { x: s.x + NODE_W, y: s.y + NODE_H / 2 };
}

function inPort(id) {
  const s = sec(id);
  return { x: s.x, y: s.y + NODE_H / 2 };
}

function curve(a, b) {
  const dx = Math.max(48, Math.abs(b.x - a.x) * 0.5);
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
}

function edgeHtml(from, to, cls, index) {
  const a = { x: from.x + 7, y: from.y };
  const tip = { x: to.x - 8, y: to.y };
  const end = { x: tip.x - 7, y: tip.y };
  const d = curve(a, end);
  return `<g class="${cls}" data-edge="${index}">
    <path class="hit" d="${d}"/><path class="line" d="${d}"/>
    <path class="arrow" d="M${end.x - 1},${end.y - 5} L${tip.x},${tip.y} L${end.x - 1},${end.y + 5} Z"/>
  </g>`;
}

/** Draws every connection, plus the one being dragged out of a port if there is one. */
function renderEdges(dragging) {
  let html = "";
  state.edges.forEach((edge, index) => {
    const selected = state.selected?.type === "edge" && state.selected.id === index;
    const cls = `edge${selected ? " sel" : ""}${state.liveEdge === edge.from ? " live" : ""}`;
    html += edgeHtml(outPort(edge.from), inPort(edge.to), cls, index);
  });
  if (dragging) html += `<path class="edge-temp" d="${curve({ x: dragging.a.x + 7, y: dragging.a.y }, dragging.b)}"/>`;
  edgesEl.innerHTML = html;
}

function updateSelection() {
  const selected = state.selected;
  $$(".node, .start", nodesEl).forEach((el) => {
    el.classList.toggle("sel", selected?.type === "node" && selected.id === el.dataset.id);
  });
  renderEdges();

  toolsEl.hidden = true;
  toolsEl.classList.toggle("round", selected?.type === "edge");
  if (selected?.type === "node" && selected.id !== "start") {
    const s = sec(selected.id);
    toolsEl.innerHTML =
      `<button data-tool-act="open">${icon("open")}Open</button>` +
      `<button data-tool-act="duplicate" title="Duplicate">${icon("copy")}</button>` +
      `<button data-tool-act="delete" title="Delete (Del)">${icon("trash")}</button>`;
    toolsEl.style.left = `${s.x}px`;
    toolsEl.style.top = `${s.y - 42}px`;
    toolsEl.hidden = false;
  } else if (selected?.type === "edge") {
    const edge = state.edges[selected.id];
    const a = outPort(edge.from);
    const b = inPort(edge.to);
    toolsEl.innerHTML = `<button data-tool-act="delete" title="Disconnect (Del)">${icon("trash")}</button>`;
    // The drawn curve runs from 7px past the out port to 15px before the in port; its midpoint is the mean of those ends.
    toolsEl.style.left = `${(a.x + 7 + b.x - 15) / 2}px`;
    toolsEl.style.top = `${(a.y + b.y) / 2}px`;
    toolsEl.hidden = false;
  }
}

function select(selection) {
  state.selected = selection;
  updateSelection();
}

/* ---------- editing the song ---------- */

function addSection(worldX, worldY) {
  const n = state.seq++;
  const section = {
    id: `s${Date.now().toString(36)}${n}`,
    name: SECTION_NAMES[n] ?? `Section ${state.sections.length + 1}`,
    hue: SECTION_HUES[(state.sections.length + n) % SECTION_HUES.length],
    x: Math.round((worldX - NODE_W / 2) / 10) * 10,
    y: Math.round((worldY - NODE_H / 2) / 10) * 10,
    bars: 2,
    repeats: 1,
    rows: [],
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
  copy.id = `s${Date.now().toString(36)}${state.seq++}`;
  copy.name = `${source.name} copy`;
  copy.x += 40;
  copy.y += NODE_H + 30;
  state.sections.push(copy);
  state.selected = { type: "node", id: copy.id };
  renderNodes();
}

function deleteSelected() {
  const selected = state.selected;
  if (!selected) return;
  if (selected.type === "edge") {
    state.edges.splice(selected.id, 1);
  } else if (selected.id !== "start") {
    state.sections = state.sections.filter((s) => s.id !== selected.id);
    state.edges = state.edges.filter((edge) => edge.from !== selected.id && edge.to !== selected.id);
  } else {
    return;
  }
  state.selected = null;
  renderNodes();
}

function connect(from, to) {
  state.edges = state.edges.filter((edge) => edge.from !== from);
  state.edges.push({ from, to });
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

function nodeUnder(event) {
  return document.elementFromPoint(event.clientX, event.clientY)?.closest(".node")?.dataset.id ?? null;
}

function startConnect(fromId) {
  const a = outPort(fromId);
  const mark = (id) => $$(".node", nodesEl).forEach((el) => el.classList.toggle("drop", el.dataset.id === id));
  canvasEl.classList.add("connecting");
  track(
    (event) => {
      const over = nodeUnder(event);
      const target = over && over !== fromId ? over : null;
      mark(target);
      renderEdges({ a, b: target ? { x: inPort(target).x - 8, y: inPort(target).y } : toWorld(event.clientX, event.clientY) });
    },
    (event) => {
      const over = nodeUnder(event);
      if (over && over !== fromId) connect(fromId, over);
      mark(null);
      canvasEl.classList.remove("connecting");
      updateSelection();
    },
  );
}

function startMove(event, el) {
  const id = el.dataset.id;
  const item = id === "start" ? state.start : sec(id);
  const origin = { x: item.x, y: item.y, px: event.clientX, py: event.clientY };
  let moved = false;
  track(
    (move) => {
      const dx = (move.clientX - origin.px) / state.view.z;
      const dy = (move.clientY - origin.py) / state.view.z;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      el.classList.add("dragging");
      item.x = Math.round((origin.x + dx) / 10) * 10;
      item.y = Math.round((origin.y + dy) / 10) * 10;
      el.style.left = `${item.x}px`;
      el.style.top = `${item.y}px`;
      updateSelection();
    },
    () => el.classList.remove("dragging"),
  );
}

function startPan(event) {
  const origin = { x: state.view.x, y: state.view.y, px: event.clientX, py: event.clientY };
  canvasEl.classList.add("panning");
  track(
    (move) => {
      state.view.x = origin.x + move.clientX - origin.px;
      state.view.y = origin.y + move.clientY - origin.py;
      applyView();
    },
    () => canvasEl.classList.remove("panning"),
  );
}

canvasEl.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const target = event.target;
  if (target.closest(".zoom, .hints, .node-tools, .rep")) return;

  const port = target.closest(".port.out");
  if (port) {
    event.preventDefault();
    return startConnect(port.parentElement.dataset.id);
  }

  const node = target.closest(".node, .start");
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
  const node = event.target.closest(".node");
  if (node && !event.target.closest("button, .port")) openEditor(node.dataset.id);
});

nodesEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-rep]");
  if (!button) return;
  const node = button.closest(".node");
  const section = sec(node.dataset.id);
  section.repeats = clamp(1, section.repeats + Number(button.dataset.rep), 16);
  $(".rep b", node).textContent = `×${section.repeats}`;
});

toolsEl.addEventListener("click", (event) => {
  const act = event.target.closest("[data-tool-act]")?.dataset.toolAct;
  if (act === "open") openEditor(state.selected.id);
  if (act === "duplicate") duplicateSection(state.selected.id);
  if (act === "delete") deleteSelected();
});

canvasEl.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    // A mouse wheel notch (deltaY ~100) zooms like the buttons; small trackpad pinch deltas stay smooth.
    if (event.ctrlKey || event.metaKey) return zoomAt(Math.exp(-clamp(-18, event.deltaY, 18) * 0.01), event.clientX, event.clientY);
    state.view.x -= event.deltaX;
    state.view.y -= event.deltaY;
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
  if (act === "fit") fitView();
});

/* ---------- dragging a Section out of the palette ---------- */

$('.tool[data-tool="section"]').addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  const ghost = document.createElement("div");
  ghost.className = "ghost";
  ghost.innerHTML = `${icon("section")} New section`;
  let moved = false;
  const place = (e) => {
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
    ghost.classList.toggle("ok", !!document.elementFromPoint(e.clientX, e.clientY)?.closest("#canvas"));
  };
  track(
    (move) => {
      if (!moved) {
        if (Math.hypot(move.clientX - event.clientX, move.clientY - event.clientY) < 4) return; // still a click
        moved = true;
        document.body.append(ghost);
      }
      place(move);
    },
    (up) => {
      ghost.remove();
      if (!moved) {
        // A plain click drops the section in the middle of the view.
        const rect = canvasEl.getBoundingClientRect();
        const centre = toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const offset = (state.sections.length % 5) * 24;
        addSection(centre.x + offset, centre.y + offset);
      } else if (document.elementFromPoint(up.clientX, up.clientY)?.closest("#canvas")) {
        const point = toWorld(up.clientX, up.clientY);
        addSection(point.x, point.y);
      }
    },
  );
});

/* ---------- song playback, as seen on the canvas ---------- */

function showNodePlaying(id, loopFraction, repeat, section) {
  const node = $(`.node[data-id="${id}"]`, nodesEl);
  if (!node) return;
  node.classList.add("playing");
  const head = $(".thumb-head", node);
  if (head) head.style.left = `${loopFraction * 100}%`;
  $(".node-progress i", node).style.width = `${((repeat + loopFraction) / section.repeats) * 100}%`;
  $(".node-meta", node).textContent = section.repeats > 1 ? `Playing ${repeat + 1} of ${section.repeats}` : "Playing";
}

function clearNodePlaying() {
  $$(".node.playing", nodesEl).forEach((node) => {
    node.classList.remove("playing");
    $(".node-progress i", node).style.width = "0";
    $(".node-meta", node).textContent = metaText(sec(node.dataset.id));
  });
}
