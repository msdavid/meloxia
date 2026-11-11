"use strict";
// Song flow on the canvas (area A), part 1: rules on connections, a second way out (Choose one or Play together),
// refusals, inserting and removing blocks, adding blocks from the palette, and the section panel's Flow tab.
// The rules themselves are worked out by flow-logic.js; Play together and the other blocks are in flow.blocks.js;
// the path strip, playback and cues in flow.path.js.

Object.assign(ICONS, {
  together: '<path d="M3 2.5v11M13 2.5v11M3 5h10M3 11h10"/>',
  dice: '<rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><circle cx="5.7" cy="5.7" r=".9" fill="currentColor"/><circle cx="10.3" cy="10.3" r=".9" fill="currentColor"/><circle cx="8" cy="8" r=".9" fill="currentColor"/>',
  cue: '<path d="M8 2v3M8 11v3M2 8h3M11 8h3"/><circle cx="8" cy="8" r="2.2"/>',
  reroll: '<path d="M13 4.5A5.5 5.5 0 1 0 13.6 9"/><path d="M13.5 1.8v3h-3"/>',
  right: '<path d="M6 3.5L10.5 8 6 12.5"/>',
});

state.flow ??= { surprise: false, seed: 1 };

/* ---------- the song as flow-logic sees it ---------- */

function flowGraph() {
  return {
    bpm: state.bpm,
    sections: state.sections.map((s) => ({
      id: s.id,
      name: s.name,
      hue: s.hue,
      bars: s.bars,
      repeats: s.repeats,
      key: s.shift ? SET.shift.out(s.shift) : "the song's key",
      instruments: s.rows.map((r) => inst(r.inst).name),
    })),
    blocks: state.blocks,
    edges: state.edges,
  };
}

const blockName = (id) => {
  const b = blk(id);
  return b.kind === "section" ? b.name : { start: "Start", split: "Play together", join: "the end of Play together", tempo: "Speed change" }[b.kind];
};
/** The name at the start of a sentence or a list line: "The end of Play together". */
const blockTitle = (id) => blockName(id).replace(/^./, (c) => c.toUpperCase());
const exitsOf = (id) => state.edges.filter((e) => e.from === id);
const inBranch = (id) => flowLogic.membership(flowGraph()).has(id);

let lastEditToast = 0;
/** After any change to the flow: redraw what shows it, and while the song plays, say when the change applies. */
function flowEdited() {
  renderEdges();
  flowPlaybackEdited?.();
  if (transport.playing && !edSec && performance.now() - lastEditToast > 3000) {
    lastEditToast = performance.now();
    toast("Changed while playing: the song picks it up after the current pass");
  }
}

/** A refusal: a tooltip at the pointer saying why that can't be done. */
const refuseEl = Object.assign(document.createElement("div"), { className: "tip refuse", role: "alert", hidden: true });
document.body.append(refuseEl);
function refuse(event, text) {
  refuseEl.innerHTML = `<b>Can't do that here</b>${esc(text)}`;
  refuseEl.hidden = false;
  const x = event?.clientX ?? innerWidth / 2, y = event?.clientY ?? innerHeight / 2;
  refuseEl.style.left = `${clamp(8, x + 12, innerWidth - refuseEl.offsetWidth - 8)}px`;
  refuseEl.style.top = `${clamp(8, y + 14, innerHeight - refuseEl.offsetHeight - 8)}px`;
  clearTimeout(refuse.timer);
  refuse.timer = setTimeout(() => (refuseEl.hidden = true), 3200);
}

/* ---------- rules: the chip on a connection, and the popover that sets it ---------- */

const RULES = [
  ["always", "Always", "Every time the song gets here."],
  ["count", "Count", "Only on the passes you pick, counted each time the song reaches this block."],
  ["chance", "Chance", "Rolls the dice each time and takes this path that often."],
  ["turns", "Take turns", "Paths marked Take turns are taken one after another."],
  ["cue", "On cue", "Waits for you: press its Cue button (keys 1–9) while the song plays."],
  ["otherwise", "Otherwise", "Taken when no path before it is."],
];

function flowEdgeClass(edge) {
  const cls = [];
  if (flowDropEdge !== null && state.edges[flowDropEdge] === edge) cls.push("drop");
  if (flowPlaying()?.armed.includes(edgeKey(edge))) cls.push("armed");
  return cls.length ? ` ${cls.join(" ")}` : "";
}

/** The chip on a connection: its rule, or while playing a pulsing Cue button. */
function flowEdgeChip(edge, index, mid) {
  const key = edgeKey(edge);
  const cueN = flowCueNumber(key);
  const pos = `style="left:${mid.x}px; top:${mid.y}px"`;
  if (cueN) {
    const armed = flowPlaying().armed.includes(key);
    return `<button class="cue-btn${armed ? " armed" : ""}" data-edge="${index}" data-cue="${cueN}" ${pos}>${icon("cue")}${armed ? "Armed" : `Cue <kbd>${cueN}</kbd>`}</button>`;
  }
  const label = flowLogic.ruleLabel(edge.rule);
  if (!label) return "";
  return `<button class="rule-chip ${edge.rule.type}" data-edge="${index}" ${pos}>${edge.rule.type === "chance" ? icon("dice") : ""}${label}</button>`;
}

function ruleBody(edge) {
  const r = edge.rule ?? { type: "always" };
  const from = edge.from;
  const exits = exitsOf(from);
  let more = "";
  if (r.type === "count") {
    const passes = r.passes ?? [];
    more = `<div class="rule-more">${segHtml("count-mode", ["first", "passes"], r.passes ? "passes" : "first", undefined, (v) => (v === "first" ? "First times" : "Chosen passes"))}
      ${
        r.passes
          ? `<div class="pass-picks">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<button class="${passes.includes(n) ? "on" : ""}" data-pass="${n}">${n}</button>`).join("")}</div>`
          : `<div class="stepper"><button data-first="-1" ${r.first > 1 ? "" : "disabled"}>${icon("minus")}</button><b>${r.first === 1 ? "first time" : `first ${r.first} times`}</b><button data-first="1" ${r.first < 16 ? "" : "disabled"}>${icon("plus")}</button></div>`
      }</div>`;
  }
  if (r.type === "chance") more = `<div class="rule-more">${rangeHtml({ label: "Chance", min: 0, max: 100, out: (v) => `${v}%` }, r.pct, 'data-rule-pct="1"')}</div>`;
  const order = exits.length > 1 ? `<p class="rule-order">Way out ${exits.indexOf(edge) + 1} of ${exits.length} from ${esc(blockName(from))}: they are tried in order, top first. Reorder them in the section's Flow tab.</p>` : "";
  return `<div class="rule-pop"><h4>When does the song take this path?</h4><p class="rule-to">${esc(blockTitle(from))} → ${esc(blockTitle(edge.to))}</p>
    ${choicesHtml("rule", RULES.map(([v, l]) => [v, l]), r.type)}<small class="rule-help">${RULES.find(([v]) => v === r.type)[2]}</small>${more}${order}</div>`;
}

function flowOpenRule(index, anchor) {
  const edge = state.edges[index];
  if (!edge) return;
  if (inBranch(edge.from) || blk(edge.from).kind === "split") {
    const box = $(`.edge[data-edge="${index}"]`, edgesEl)?.getBoundingClientRect();
    return refuse(box && { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }, "Inside Play together every branch plays straight through, so its connections have no rules.");
  }
  select({ type: "edge", id: index });
  const where = anchor ?? flowRuleAnchor(index);
  const draw = () => openPopover(where, ruleBody(edge), { onClick, className: "rule-popover", width: 300 });
  const onClick = (event) => {
    const t = event.target;
    const choice = t.closest('[data-set="rule"]');
    const mode = t.closest('[data-set="count-mode"]');
    if (choice) edge.rule = { always: { type: "always" }, count: { type: "count", first: 2 }, chance: { type: "chance", pct: 50 }, turns: { type: "turns" }, cue: { type: "cue" }, otherwise: { type: "otherwise" } }[choice.dataset.v];
    else if (mode) edge.rule = mode.dataset.v === "first" ? { type: "count", first: 2 } : { type: "count", passes: [1] };
    else if (t.closest("[data-first]")) edge.rule = { type: "count", first: clamp(1, edge.rule.first + Number(t.closest("[data-first]").dataset.first), 16) };
    else if (t.closest("[data-pass]")) {
      const n = Number(t.closest("[data-pass]").dataset.pass);
      const passes = edge.rule.passes.includes(n) ? edge.rule.passes.filter((p) => p !== n) : [...edge.rule.passes, n].sort((a, b) => a - b);
      edge.rule = { type: "count", passes: passes.length ? passes : [n] };
    } else return;
    if (edge.rule.type === "always") delete edge.rule;
    draw();
    flowEdited();
    commitHistory();
  };
  draw();
}

/** Where the rule popover opens: just below the connection's chip, or its middle. */
function flowRuleAnchor(index) {
  const chip = $(`[data-edge="${index}"]`, chipsEl);
  if (chip) return chip;
  const r = $(`.edge[data-edge="${index}"] .line`, edgesEl).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

popEl.addEventListener("input", (event) => {
  if (!event.target.matches("[data-rule-pct]")) return;
  const edge = state.edges[state.selected?.id];
  if (!edge) return;
  edge.rule = { type: "chance", pct: Number(event.target.value) };
  $("output", event.target.closest(".ctl")).textContent = `${edge.rule.pct}%`;
  flowEdited();
});

chipsEl.addEventListener("click", (event) => {
  const chip = event.target.closest(".rule-chip");
  if (chip) flowOpenRule(Number(chip.dataset.edge), chip);
});
edgesEl.parentElement.addEventListener("contextmenu", (event) => {
  const edge = event.target.closest(".edge, .rule-chip");
  if (!edge) return;
  event.preventDefault();
  flowOpenRule(Number(edge.dataset.edge), { x: event.clientX, y: event.clientY });
});

/* ---------- connecting: a first way out, or a second one (Choose one or Play together) ---------- */

function flowConnect(from, to, event) {
  const reason = flowLogic.canConnect(flowGraph(), from, to);
  if (reason) return refuse(event, reason);
  const exits = exitsOf(from);
  if (!exits.length || blk(from).kind === "split" || inBranch(from)) {
    state.edges.push({ from, to });
    return flowEdited();
  }
  openMenu({ x: event.clientX, y: event.clientY }, [
    { heading: `Another way out of ${blockName(from)}` },
    { label: "Choose one", icon: "fork", tip: "The song takes one of the ways out each time. You set when, on each connection.", action: () => addFork(from, to) },
    { label: "Play together", icon: "together", tip: "Both play at the same time, then the song goes on together.", action: () => flowMakeTogether(from, to, event) },
  ]);
}

function addFork(from, to) {
  const exits = exitsOf(from);
  const plain = exits.filter((e) => !e.rule || e.rule.type === "always");
  let rule;
  if (exits.length === 1 && plain.length === 1) {
    exits[0].rule = { type: "turns" };
    rule = { type: "turns" };
  } else rule = exits.some((e) => e.rule?.type === "otherwise") ? { type: "chance", pct: 50 } : { type: "otherwise" };
  const at = exits.find((e) => e.rule?.type === "otherwise");
  const edge = { from, to, rule };
  at ? state.edges.splice(state.edges.indexOf(at), 0, edge) : state.edges.push(edge);
  flowEdited();
  commitHistory();
  toast(`${blockTitle(from)} now has ${exits.length + 1} ways out. Right-click a connection to change when it's taken`);
}

/* ---------- removing ---------- */

function flowDeleteEdge(index) {
  state.edges.splice(index, 1);
  flowEdited();
}

/** Removes a block. One way in and one way out: its neighbours are joined up, keeping the rule on the way in.
 *  A block's loop back to itself is neither. */
function flowDeleteBlock(id) {
  const b = blk(id);
  if (b.kind === "split" || b.kind === "join") return flowRemoveTogether(id);
  const ins = state.edges.filter((e) => e.to === id && e.from !== id), outs = exitsOf(id).filter((e) => e.to !== id);
  const bridge = ins.length === 1 && outs.length === 1 ? { ...ins[0], to: outs[0].to } : null;
  const name = blockName(id);
  const at = bridge ? state.edges.indexOf(ins[0]) : -1;
  state.edges = state.edges.filter((e) => e.from !== id && e.to !== id);
  if (bridge && !state.edges.some((e) => e.from === bridge.from && e.to === bridge.to)) {
    delete bridge.id;
    state.edges.splice(Math.min(at, state.edges.length), 0, bridge);
    toast(`Removed ${name} · ${blockName(bridge.from)} now leads to ${blockName(bridge.to)}`);
  } else {
    const stuck = ins.map((e) => e.from).find((from) => !exitsOf(from).length);
    toast(`Removed ${name}${stuck ? ` · ${blockTitle(stuck)} has no way out now, so the song ends there` : ""}`);
  }
  if (b.kind === "section") state.sections = state.sections.filter((s) => s.id !== id);
  else state.blocks = state.blocks.filter((x) => x.id !== id);
  flowEdited();
}

/* ---------- inserting: drop a block on a connection ---------- */

let flowDropEdge = null;

/** While dragging a block (or a palette tool, id null): light up the connection it would be dropped into. */
function flowDragOver(id, event) {
  const free = id === null || (["section", "tempo"].includes(blk(id).kind) && !state.edges.some((e) => e.from === id || e.to === id));
  const over = event && free ? edgeUnder(event) : null;
  if (over === flowDropEdge) return;
  flowDropEdge = over;
  renderEdges();
}

/** A block let go: if it was over a connection, wire it in between. */
function flowDrop(id, event) {
  const index = flowDropEdge;
  flowDropEdge = null;
  if (index === null || !state.edges[index]) return renderEdges();
  const edge = state.edges[index];
  if (blk(id).kind === "tempo" && (inBranch(edge.from) || blk(edge.from).kind === "split")) {
    renderEdges();
    return refuse(event, "One speed for the whole group, taken from the leader. Put Speed change before Play together.");
  }
  state.edges.splice(index, 1, { ...edge, to: id }, { from: id, to: edge.to });
  delete state.edges[index].id;
  const before = boxOf(edge.from), item = rawBlock(id);
  if (item.x < before.x + before.w + 40) item.x = snap(before.x + before.w + 50); // keep it after the block it follows
  settleLayout([id]);
  flowEdited();
  // Into a section's own repeat it plays on each repeat; that needs no announcement.
  if (edge.from !== edge.to) toast(`${blockTitle(id)} now plays between ${blockName(edge.from)} and ${blockName(edge.to)}`);
}

/* ---------- adding from the palette ---------- */

function flowAddBlock(kind, x, y, event) {
  const into = event ? flowDropEdge : null;
  flowDropEdge = null;
  if (kind === "together") return flowAddTogether(x, y, into, event);
  if (kind === "note") return addCanvasNote(x, y, event); // a note for yourself (stickies.js), not a block
  let id;
  if (kind === "section") id = addSection(x, y).id;
  else {
    const [w, h] = FLOW_SIZE[kind];
    id = makeId("b");
    state.blocks.push({ id, kind, x: snap(x - w / 2), y: snap(y - h / 2), bpm: 90 });
    state.selected = { type: "node", id };
    renderNodes();
  }
  if (into !== null) {
    flowDropEdge = into;
    return flowDrop(id, event);
  }
  settleLayout([id]);
  flowEdited();
}

/* ---------- dragging a block out of the palette (canvas.js has the canvas's own drags) ---------- */

const TOOL_GHOST = { section: ["section", "New section"], together: ["together", "Play together"], note: ["note", "Note"], tempo: ["tempo", "Speed change"] };

$$(".tool[data-tool]").forEach((tool) =>
  tool.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const kind = tool.dataset.tool;
    const ghost = document.createElement("div");
    ghost.className = "ghost";
    ghost.innerHTML = `${icon(TOOL_GHOST[kind][0])} ${TOOL_GHOST[kind][1]}`;
    let moved = false;
    const onCanvas = (e) => !!document.elementFromPoint(e.clientX, e.clientY)?.closest("#canvas");
    track(
      (move) => {
        if (!moved) {
          if (Math.hypot(move.clientX - event.clientX, move.clientY - event.clientY) < 4) return; // still a click
          moved = true;
          document.body.append(ghost);
        }
        ghost.style.left = `${move.clientX}px`;
        ghost.style.top = `${move.clientY}px`;
        ghost.classList.toggle("ok", onCanvas(move));
        if (onCanvas(move)) flowDragOver(null, move);
      },
      (up) => {
        ghost.remove();
        if (!moved) {
          // A plain click drops the block in the middle of the view.
          const rect = canvasEl.getBoundingClientRect();
          const centre = toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
          const offset = (state.sections.length % 5) * 24;
          flowAddBlock(kind, centre.x + offset, centre.y + offset, null);
        } else if (onCanvas(up)) {
          const point = toWorld(up.clientX, up.clientY);
          flowAddBlock(kind, point.x, point.y, up);
        } else flowDragOver(null, null);
      },
    );
  }),
);

/* ---------- the section panel's Flow tab: ways out in order, reorderable by drag ---------- */

function flowTabBody(id) {
  const exits = exitsOf(id), ins = state.edges.filter((e) => e.to === id);
  const row = (e, i) => {
    const label = flowLogic.ruleLabel(e.rule) || "always";
    return `<li class="flow-exit" data-edge="${state.edges.indexOf(e)}"><span class="flow-grip">${icon("grip")}</span><b>${i + 1}</b>
      <span class="flow-to" style="--h:${sec(e.to)?.hue ?? 0}"><i></i>${esc(blockTitle(e.to))}</span><span class="flow-rule ${e.rule?.type ?? "always"}">${label}</span></li>`;
  };
  if (inBranch(id))
    return `<p class="side-note">This section is a branch of Play together. It plays straight through to the end of the group, so it has no choices of its own.</p>`;
  return `<p class="side-note">When ${esc(sec(id).name)} ends, the song tries these from the top and takes the first that fits.</p>
    ${exits.length ? `<ol class="flow-exits">${exits.map(row).join("")}</ol>` : `<p class="side-empty">No way out yet: the song ends here. Drag from the block's right dot to connect it.</p>`}
    ${exits.length > 1 ? `<small class="grp-help">Drag a row by its handle to change the order. Click a row to change its rule.</small>` : exits.length ? `<small class="grp-help">Click the row to change when it's taken.</small>` : ""}
    <h4 class="flow-h">Ways in</h4>
    ${ins.length ? `<ul class="flow-ins">${ins.map((e) => `<li>${esc(blockTitle(e.from))}<span class="flow-rule ${e.rule?.type ?? "always"}">${flowLogic.ruleLabel(e.rule) || "always"}</span></li>`).join("")}</ul>` : `<p class="side-empty">Nothing leads here yet.</p>`}`;
}

/** Puts the section's ways out in a new order (they keep their place among the other connections). */
function reorderExits(id, order) {
  const exits = exitsOf(id);
  const slots = exits.map((e) => state.edges.indexOf(e));
  order.forEach((e, i) => (state.edges[slots[i]] = e));
}

document.addEventListener("pointerdown", (event) => {
  const grip = event.target.closest(".flow-exit .flow-grip");
  if (!grip || !side) return;
  event.preventDefault();
  const list = grip.closest(".flow-exits");
  const row = grip.closest(".flow-exit");
  const id = side.id;
  row.classList.add("dragging");
  track(
    (move) => {
      const rows = $$(".flow-exit", list);
      const after = rows.find((r) => r !== row && move.clientY < r.getBoundingClientRect().top + r.offsetHeight / 2);
      list.insertBefore(row, after ?? null);
    },
    () => {
      row.classList.remove("dragging");
      const order = $$(".flow-exit", list).map((r) => state.edges[Number(r.dataset.edge)]);
      reorderExits(id, order);
      renderPanel();
      flowEdited();
      commitHistory();
    },
  );
});

/* ---------- registration (tips.js, side.js tabs and app.js load around this file) ---------- */

document.addEventListener("DOMContentLoaded", () => {
  addPanelTab("section", "flow", {
    label: (id) => `Flow${exitsOf(id).length > 1 ? ` <em>${exitsOf(id).length}</em>` : ""}`,
    tip: "Where the song goes after this section, and when it takes each way.",
    body: flowTabBody,
    click: (event) => {
      const row = event.target.closest(".flow-exit");
      if (row && !event.target.closest(".flow-grip")) flowOpenRule(Number(row.dataset.edge), row);
      return false;
    },
  });
  addHistoryField("blocks");
  addHistoryField("flow");
  addTips([
    [".rule-chip", (el) => `When: ${el.textContent.trim()}`, "When the song takes this path. Clicking it, or right-clicking the line, changes it."],
    ['[data-tool-act="rule"]', "When is it taken?", "Sets when the song takes this path: always, a number of times, by chance, in turns or on cue."],
    ['[data-set="rule"]', (el) => el.textContent.trim(), (el) => RULES.find(([v]) => v === el.dataset.v)[2]],
    ['[data-set="count-mode"]', (el) => el.textContent.trim(), (el) => (el.dataset.v === "first" ? "The song takes this path the first few times it gets here." : "The song takes this path only on the passes you tick.")],
    ["[data-first='-1']", "Fewer times", "Takes this path on fewer of the first passes."],
    ["[data-first='1']", "More times", "Takes this path on more of the first passes."],
    ["[data-pass]", (el) => `Pass ${el.dataset.pass}`, "When ticked, the song takes this path on that pass through the block."],
    ["[data-rule-pct]", "Chance", "How often the dice send the song this way."],
    [".flow-exit .flow-grip", "Move", "Dragging it up or down reorders the ways out, which are tried from the top."],
    [".flow-exit", (el) => `To ${el.querySelector(".flow-to").textContent}`, "One way out of this section. Clicking it changes when it's taken."],
    ['.tool[data-tool="together"]', "Play together", "Plays several sections at the same time. Drops onto the canvas or onto a connection."],
    ['.tool[data-tool="note"]', "Note", "A note for yourself. Dropped on a block or a connection, it stays with it. It doesn't play."],
    ['.tool[data-tool="tempo"]', "Speed change", "From the plugin Speed tools: from here on the song plays at another speed. Drops onto a connection."],
    [".port.out", "Connect", "Connects to the block you drag it to, which plays next. A second connection asks: choose one, or play together?"],
    ['[data-tool-act="settings"]', "Settings", (el) => (sec(state.selected?.id) ? "This section's speed, feel, mix, effects and fades. Right-clicking the block does the same." : "This block's settings. Right-clicking the block does the same.")],
    ['[data-tool-act="delete"]', () => (toolsEl.classList.contains("round") ? "Disconnect" : "Delete"), () => (toolsEl.classList.contains("round") ? "Removes this connection." : "Removes this block. With one way in and one way out, its neighbours are joined up."), "Del"],
  ]);
});
