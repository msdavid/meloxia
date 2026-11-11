"use strict";
// Song flow on the canvas (area A), part 2: the flow blocks. Play together (a split bar and a join bar with the
// branches between them, and its settings), and Speed change (the demo "From plugins" block).

const splitOf = (id) => (blk(id).kind === "split" ? blk(id) : state.blocks.find((b) => b.kind === "split" && b.join === id));

/** The branches of a Play together group, as names. */
function branchNames(split) {
  return flowLogic.branchesOf(flowGraph(), split.id).map((br, i) => (br.ids.length ? br.ids.map((id) => sec(id)?.name ?? id).join(" + ") : `Branch ${i + 1}`));
}

/** Keys the branches play in, when they differ (the warning chip). Drums-only sections have no key. */
function branchKeys(split) {
  const g = flowGraph();
  const tuned = (id) => sec(id)?.rows.some((r) => melodic(inst(r.inst)));
  const keys = new Set(flowLogic.branchesOf(g, split.id).flatMap((br) => br.ids.filter(tuned).map((id) => g.sections.find((s) => s.id === id)?.key)).filter(Boolean));
  return keys.size > 1 ? [...keys] : [];
}

const ENDS = { longest: "Longest", shortest: "Shortest", leader: "Leader" };
const SHORTER = { loop: "Keep looping", silent: "Fall silent" };
const SAME = { both: "Play both", leader: "Leader only" };

/* ---------- drawing ---------- */

function flowNodeChips() {
  return "";
}

function flowBlockHtml(b, box) {
  const pos = `left:${box.x}px; top:${box.y}px`;
  if (b.kind === "split" || b.kind === "join") {
    const split = splitOf(b.id);
    const warn = b.kind === "split" && branchKeys(b).length ? `<span class="bar-warn">${chipHtml("Different keys", "warn")}</span>` : "";
    const sum = b.kind === "split" ? `<span class="bar-sum">${ENDS[split.ends]} ends it</span>` : "";
    return `<div class="fblock fbar ${b.kind}" data-id="${b.id}" style="${pos}; height:${box.h}px">
      <span class="bar-label">${b.kind === "split" ? "Play together" : "Together end"}</span>${warn}${sum}
      <i class="port in"></i><i class="port out"></i></div>`;
  }
  if (b.kind === "tempo")
    return `<div class="fblock tempo" data-id="${b.id}" style="${pos}"><span class="fb-eyebrow">${icon("tempo")}Speed change</span>
      <b>${b.bpm} bpm</b><small>from here on</small><i class="port in"></i><i class="port out"></i></div>`;
  return "";
}

/* ---------- making Play together ---------- */

/* ---------- layout: nothing overlaps after an insert or a Play together ---------- */

const GAP = 30; // the least space between two blocks
const ceil10 = (v) => Math.ceil(v / 10) * 10;
const overlaps = (a, b) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;
const layoutIds = () => ["start", ...state.sections.map((s) => s.id), ...state.blocks.map((b) => b.id)];

/**
 * Pushes blocks apart until none overlap: downstream blocks move right, another branch of the same Play together
 * moves down. Connections that went forward on a row keep going forward. `pinned` blocks (the one just placed) stay put.
 * The moves animate (FLIP, 180 ms) and the view re-fits if the song no longer fits.
 */
function settleLayout(pinned = []) {
  const from = new Map(layoutIds().map((id) => [id, { x: rawBlock(id).x, y: rawBlock(id).y }]));
  const forward = state.edges.filter((e) => !isLoop(e));
  const fixed = (id) => id === "start" || pinned.includes(id);
  for (let pass = 0, moved = true; moved && pass < 400; pass++) {
    moved = false;
    const m = flowLogic.membership(flowGraph());
    const ids = layoutIds();
    for (let i = 0; i < ids.length && !moved; i++)
      for (let j = i + 1; j < ids.length && !moved; j++) {
        const [a, b] = [ids[i], ids[j]];
        const A = boxOf(a), B = boxOf(b);
        if (!overlaps(A, B) || (fixed(a) && fixed(b))) continue;
        const ma = m.get(a), mb = m.get(b);
        const branches = ma && mb && ma.split === mb.split && ma.branch !== mb.branch;
        let mover = branches ? (A.y > B.y || (A.y === B.y && A.x > B.x) ? a : b) : A.x > B.x || (A.x === B.x && A.y > B.y) ? a : b;
        if (fixed(mover)) mover = mover === a ? b : a;
        const other = boxOf(mover === a ? b : a), item = rawBlock(mover);
        if (branches) item.y = ceil10(other.y + other.h + GAP);
        else item.x = ceil10(other.x + other.w + GAP);
        moved = true;
      }
    for (const e of forward) {
      const f = boxOf(e.from), t = rawBlock(e.to), T = boxOf(e.to);
      // only on the same row: a connection to a block on another row wraps round instead (canvas.js edgeShape)
      if (!moved && !fixed(e.to) && T.y < f.y + f.h && f.y < T.y + T.h && t.x < f.x + f.w + 40) {
        t.x = ceil10(f.x + f.w + 40);
        moved = true;
      }
    }
  }
  renderNodes();
  animateFrom(from);
  if (!songFits()) fitView(true);
}

/** Blocks glide from where they were to where they are now; connections fade back in once they have landed. */
function animateFrom(from) {
  const moved = [];
  for (const [id, p] of from) {
    const now = rawBlock(id);
    const el = now && $(`[data-id="${id}"]`, nodesEl);
    if (el && (p.x !== now.x || p.y !== now.y)) moved.push([el, p.x - now.x, p.y - now.y]);
  }
  if (!moved.length) return;
  worldEl.classList.add("settling");
  for (const [el, dx, dy] of moved) el.style.translate = `${dx}px ${dy}px`;
  void worldEl.offsetWidth;
  for (const [el] of moved) {
    el.style.transition = "translate 0.18s cubic-bezier(0.2, 0.85, 0.25, 1)";
    el.style.translate = "0 0";
  }
  setTimeout(() => {
    worldEl.classList.remove("settling");
    for (const [el] of moved) el.style.transition = el.style.translate = "";
  }, 190);
}

/** True when every block shows in the part of the canvas the side panel and the path strip leave visible. */
function songFits() {
  const rect = canvasEl.getBoundingClientRect();
  const { x, y, z } = state.view;
  const width = rect.width - (canvasEl.parentElement.classList.contains("side-open") ? SIDE_COVER : 0);
  return layoutIds().every((id) => {
    const b = boxOf(id);
    return b.x * z + x >= 0 && b.y * z + y >= 0 && (b.x + b.w) * z + x <= width && (b.y + b.h) * z + y <= rect.height - STRIP_COVER;
  });
}

/** Moves every block at or right of `x` (except those listed) further right by `dx`. */
function shiftRight(x, dx, except = []) {
  if (dx <= 0) return;
  for (const item of [...state.sections, ...state.blocks]) if (item.x >= x && !except.includes(item.id)) item.x += dx;
}

/** Other ways into a section that becomes a branch (a loop back to it, say) now lead to the whole group. */
function intoGroup(id, splitId) {
  for (const e of state.edges) if (e.to === id) { e.to = splitId; delete e.id; }
}

function newTogether(x, y) {
  const join = { id: makeId("b"), kind: "join", x: snap(x + 300), y: snap(y) };
  const split = { id: makeId("b"), kind: "split", join: join.id, ends: "longest", shorter: "loop", same: "both", leader: null, x: snap(x), y: snap(y) };
  state.blocks.push(split, join);
  return [split, join];
}

/** "Play together" chosen for a second way out of `from`: its current next section and `to` become two branches. */
function flowMakeTogether(from, to, event) {
  const exits = exitsOf(from);
  const edge = exits[0];
  const why =
    exits.length !== 1 ? "Play together starts from a block with one way out. This one already chooses between several."
    : !sec(edge.to) || inBranch(edge.to) ? "Play together needs a section after this block to play alongside."
    : !sec(to) || state.edges.some((e) => e.from === to || e.to === to) ? "The section to play alongside must not be connected to anything yet."
    : isLoop(edge) ? "Play together can't start on a loop back."
    : null;
  if (why) return refuse(event, why);
  const a = sec(edge.to), b = sec(to);
  // The new branch goes under the first one, below anything already in that column.
  const column = [...state.sections, ...state.blocks].filter((x) => x.id !== b.id && Math.abs(x.x - a.x) < NODE_W && x.y >= a.y).map((x) => x.y + boxOf(x.id).h);
  Object.assign(b, { x: a.x, y: snap(Math.max(...column) + 40) });
  const fromBox = boxOf(from);
  shiftRight(Math.min(a.x, b.x), 90 - (Math.min(a.x, b.x) - fromBox.x - fromBox.w), [from, "start"]);
  const right = Math.max(a.x, b.x) + NODE_W;
  shiftRight(right, 120, [a.id, b.id]);
  const [split, join] = newTogether((fromBox.x + fromBox.w + Math.min(a.x, b.x)) / 2 - 8, Math.min(a.y, b.y));
  join.x = snap(right + 50);
  for (const e of exitsOf(a.id)) e.from = join.id;
  intoGroup(a.id, split.id);
  edge.to = split.id;
  delete edge.id;
  state.edges.push({ from: split.id, to: a.id }, { from: split.id, to: b.id }, { from: a.id, to: join.id }, { from: b.id, to: join.id });
  state.selected = { type: "node", id: split.id };
  settleLayout([from]);
  flowEdited();
  commitHistory();
  toast(`${a.name} and ${b.name} now play together. Right-click the bar for who ends it`);
}

/** Play together from the palette: on a connection it wraps the section after it; elsewhere it starts empty. */
function flowAddTogether(x, y, into, event) {
  const edge = into === null ? null : state.edges[into];
  if (edge) {
    if (inBranch(edge.from) || blk(edge.from).kind === "split") return refuse(event, "Play together can't go inside another Play together.");
    if (!sec(edge.to) || isLoop(edge)) return refuse(event, "Drop Play together on a connection that leads forward into a section.");
    const a = sec(edge.to);
    const ax = a.x;
    shiftRight(ax, 60, []);
    shiftRight(a.x + NODE_W, 100, [a.id]);
    const [split, join] = newTogether(ax + 12, a.y);
    join.x = snap(a.x + NODE_W + 40);
    for (const e of exitsOf(a.id)) e.from = join.id;
    intoGroup(a.id, split.id);
    edge.to = split.id;
    delete edge.id;
    state.edges.push({ from: split.id, to: a.id }, { from: a.id, to: join.id });
    settleLayout([edge.from]);
    flowEdited();
    return toast(`${a.name} is now inside Play together. Connect another section from the left bar to play alongside it`);
  }
  const [split] = newTogether(x - 150, y - 80);
  settleLayout([split.id]);
  flowEdited();
  toast("Play together added: connect sections from its left bar, and from each of them into its right bar");
}

/** Deleting either bar removes the pair. The first branch stays in the song; the others are left unconnected. */
function flowRemoveTogether(id) {
  const split = splitOf(id);
  const joinId = split.join;
  const first = flowLogic.branchesOf(flowGraph(), split.id)[0]?.ids ?? [];
  const into = state.edges.filter((e) => e.to === split.id);
  const outs = exitsOf(joinId);
  state.edges = state.edges.filter((e) => ![split.id, joinId].includes(e.from) && ![split.id, joinId].includes(e.to));
  if (first.length) {
    for (const e of into) state.edges.push({ ...e, to: first[0] });
    for (const e of outs) state.edges.push({ ...e, from: first.at(-1) });
  } else for (const e of into) for (const o of outs) state.edges.push({ ...e, to: o.to });
  state.edges.forEach((e) => delete e.id);
  state.blocks = state.blocks.filter((b) => b.id !== split.id && b.id !== joinId);
  toast(first.length ? `Play together removed · ${first.map((s) => sec(s).name).join(" + ")} stays in the song` : "Play together removed");
  flowEdited();
}

/* ---------- settings: Play together, Speed change ---------- */

function togetherBody(split) {
  const names = branchNames(split);
  const leader = clamp(0, split.leader ?? longestBranch(split), names.length - 1);
  const keys = branchKeys(split);
  return `<div class="tog-pop"><h4>Play together</h4><p class="rule-to">${names.length} branch${names.length === 1 ? "" : "es"}${names.length ? `: ${names.map(esc).join(" · ")}` : ""}</p>
    <div class="tog-row"><b>Who ends it</b>${segHtml("ends", Object.keys(ENDS), split.ends, undefined, (v) => ENDS[v])}
      <small>${{ longest: "The group lasts as long as its longest branch.", shortest: "The group stops when its shortest branch ends.", leader: "The group lasts as long as the leader branch." }[split.ends]}</small></div>
    ${names.length > 1 ? `<div class="tog-row"><b>Leader</b>${choicesHtml("leader", names.map((n, i) => [String(i), esc(n)]), String(leader))}</div>` : ""}
    <div class="tog-row"><b>Shorter branches</b>${segHtml("shorter", Object.keys(SHORTER), split.shorter, undefined, (v) => SHORTER[v])}</div>
    <div class="tog-row"><b>Same instrument in two branches</b>${segHtml("same", Object.keys(SAME), split.same, undefined, (v) => SAME[v])}</div>
    <p class="tog-fixed">One speed and swing for the group, taken from the leader${names.length ? ` (${esc(names[leader])})` : ""}.</p>
    ${keys.length ? `<p class="tog-warn">${chipHtml("Different keys", "warn")} The branches play in ${keys.map(esc).join(" and ")}: they may clash.</p>` : ""}</div>`;
}

const longestBranch = (split) => {
  const g = flowGraph();
  const len = flowLogic.branchesOf(g, split.id).map((br) => br.ids.reduce((a, id) => a + (sec(id).bars * sec(id).repeats), 0));
  return len.indexOf(Math.max(...len, 0));
};

function flowOpenSettings(id, anchor) {
  const b = blk(id);
  const own = $(`[data-id="${id}"]`, nodesEl);
  const el = anchor ?? own;
  if (b.kind === "section") return openPanel("section", id);
  if (b.kind === "tempo") {
    return openPopover(el, `<div class="tog-pop"><h4>Speed change</h4>${rangeHtml({ label: "Speed", min: 40, max: 200, out: (v) => `${v} bpm` }, b.bpm, 'data-tempo="1"')}
      <small class="rule-help">From the plugin Speed tools. From here on the song plays at this speed. Inside Play together the group follows its leader instead.</small></div>`, { width: 280, className: "rule-popover" });
  }
  const split = splitOf(id);
  const draw = () =>
    openPopover(el, togetherBody(split), {
      width: 340,
      className: "rule-popover",
      onClick: (event) => {
        const t = event.target.closest("[data-set][data-v]");
        if (!t) return;
        const key = t.dataset.set;
        split[key] = key === "leader" ? Number(t.dataset.v) : t.dataset.v;
        draw();
        renderNodes();
        flowEdited();
        commitHistory();
      },
    });
  draw();
}

popEl.addEventListener("input", (event) => {
  if (!event.target.matches("[data-tempo]")) return;
  const b = blk(state.selected?.id);
  if (b?.kind !== "tempo") return;
  rawBlock(b.id).bpm = Number(event.target.value);
  $("output", event.target.closest(".ctl")).textContent = `${event.target.value} bpm`;
  $(`[data-id="${b.id}"] b`, nodesEl).textContent = `${event.target.value} bpm`;
  flowEdited();
});

nodesEl.addEventListener("contextmenu", (event) => {
  const el = event.target.closest(".fblock");
  if (!el) return;
  event.preventDefault();
  select({ type: "node", id: el.dataset.id });
  flowOpenSettings(el.dataset.id, { x: event.clientX, y: event.clientY });
});



document.addEventListener("DOMContentLoaded", () =>
  addTips([
    [".fblock.split", "Play together", "Everything connected out of this bar plays at the same time. Right-clicking it sets who ends the group."],
    [".fblock.join", "End of Play together", "The branches meet here and the song goes on. Right-clicking it opens the group's settings."],
    [".fblock.split .port.out", "Add a branch", "Dragging it to a section plays that section alongside the others (up to 6)."],
    [".fblock.join .port.in", "Branch end", "The last section of each branch connects here."],
    [".fblock.tempo", (el) => `Speed change · ${blk(el.dataset.id).bpm} bpm`, "From here on the song plays at this speed, in bpm (beats per minute: how fast the song goes). Double-clicking it changes the speed."],
    [".bar-warn .chip-warn, .tog-warn .chip-warn", "Different keys", "The branches play in different keys, so they may clash. Each section's Shift is in its General tab."],
    ['[data-set="ends"]', (el) => el.textContent.trim(), "Which branch decides when the group ends and the song moves on."],
    ['[data-set="leader"]', (el) => el.textContent.trim(), "The leader sets the group's speed and swing, and its length when the leader ends it."],
    ['[data-set="shorter"]', (el) => el.textContent.trim(), (el) => (el.dataset.v === "loop" ? "A branch that ends early starts again until the group ends." : "A branch that ends early stays quiet until the group ends.")],
    ['[data-set="same"]', (el) => el.textContent.trim(), (el) => (el.dataset.v === "both" ? "An instrument used in two branches plays in both." : "An instrument used in two branches plays only in the leader's branch.")],
    ["[data-tempo]", "Speed", "How fast the song plays from this block on, in bpm (beats per minute: how fast the song goes)."],
  ]),
);
