"use strict";
// Song flow on the canvas (area A), part 3: the path preview strip (its end pinned at the right, a long path scrolling
// between; right-clicking a chip opens that block's settings), pretend playback that follows the rules with a
// seeded random source (parallel branches animate together), and the Cue buttons (keys 1–9).
// app.js calls flowStart(), flowFrame(now) and flowStop() for song playback on the canvas.

const stripEl = Object.assign(document.createElement("div"), { className: "path-strip" });
canvasEl.append(stripEl);

const newSeed = () => Math.floor(Math.random() * 2 ** 31);
let nextSurprise = null; // "Surprise me": the roll the next Play will use, so the preview shows what will play
const previewSeed = () => (state.flow.surprise ? (nextSurprise ??= newSeed()) : state.flow.seed);

/* ---------- a block playing, as seen on the canvas (app.js calls clearNodePlaying too) ---------- */

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
    node.classList.remove("playing", "silent");
    $(".node-progress i", node).style.width = "0";
    $(".node-meta", node).textContent = metaText(sec(node.dataset.id));
  });
}

/* ---------- playback ---------- */

const playback = { w: null, step: null, t0: 0, played: [], before: 0, bpm: null };
const playBpm = () => playback.bpm ?? state.bpm;
const flowPlaying = () => (playback.w ? { armed: playback.w.armed } : null);
const flowCueNumber = (key) => {
  const i = playback.step?.cues.indexOf(key) ?? -1;
  return i >= 0 && i < 9 ? i + 1 : 0;
};

/** Play pressed on the canvas. False if there is nothing to play. */
function flowStart() {
  if (!state.edges.some((e) => e.from === "start")) {
    toast("Connect Start to a section to play the song");
    return false;
  }
  const seed = previewSeed();
  state.flow.lastSeed = seed;
  nextSurprise = null;
  Object.assign(playback, { w: flowLogic.walker(flowGraph(), { seed }), step: null, played: [], before: 0, bpm: null });
  return advance(performance.now());
}

/** Moves to the next step with some length; Speed change and other zero-length blocks pass straight through. */
function advance(t0) {
  for (let guard = 0; guard < 64; guard++) {
    const step = playback.w.next();
    if (!step) {
      stopPlay();
      toast("End of the song");
      return false;
    }
    playback.played.push(step);
    if (step.kind === "tempo") {
      playback.bpm = step.bpm;
      toast(`Speed change: ${step.bpm} bpm from here`);
    }
    if (step.bars > 0) {
      Object.assign(playback, { step, t0 });
      state.liveEdge = step.via?.edge ?? null;
      renderEdges();
      renderPathStrip();
      return true;
    }
  }
  stopPlay();
  toast("This loop has nothing in it that plays");
  return false;
}

function showSection(id, steps, silent = false) {
  const s = sec(id);
  if (!s) return;
  const per = s.bars * STEPS_PER_BAR;
  showNodePlaying(id, (steps % per) / per, Math.min(Math.floor(steps / per), s.repeats - 1), s);
  if (silent) {
    const node = $(`.node[data-id="${id}"]`, nodesEl);
    node?.classList.add("silent");
    if (node) $(".node-meta", node).textContent = "Silent until the group ends";
  }
}

function flowFrame(now) {
  const step = playback.step;
  if (!step) return;
  const sps = (playBpm() / 60) * 4;
  const elapsed = ((now - playback.t0) / 1000) * sps;
  const total = step.bars * STEPS_PER_BAR;
  if (elapsed >= total) {
    clearNodePlaying();
    playback.before += total;
    advance(playback.t0 + (total / sps) * 1000);
    return;
  }
  if (step.kind === "section") showSection(step.block, elapsed);
  else if (step.kind === "together")
    for (const br of step.branches) {
      const len = br.bars * STEPS_PER_BAR;
      if (!len) continue;
      let e = br.fill === "loop" ? elapsed % len : elapsed;
      if (e >= len) {
        br.items.forEach((item) => showSection(item.block, 0, true));
        continue;
      }
      for (const item of br.items) {
        const il = item.bars * STEPS_PER_BAR;
        if (e < il) {
          showSection(item.block, e);
          break;
        }
        e -= il;
      }
    }
  setPosition(playback.before + Math.floor(elapsed));
}

function flowStop() {
  Object.assign(playback, { w: null, step: null, played: [] });
  clearNodePlaying();
  renderEdges();
  renderPathStrip();
}

/** The song was edited while playing: the next decision follows the new connections and rules. */
function flowPlaybackEdited() {
  playback.w?.update(flowGraph());
  renderPathStrip();
}

/* ---------- cues ---------- */

function toggleCue(n) {
  const key = playback.step?.cues[n - 1];
  if (!key) return;
  const edge = state.edges.find((e) => edgeKey(e) === key);
  const armed = playback.w.armed.includes(key);
  armed ? playback.w.disarm(key) : playback.w.arm(key);
  renderEdges();
  renderPathStrip();
  toast(armed ? `Cue ${n} taken back` : `Cue ${n} armed: when this pass ends, the song goes to ${blockName(edge.to)}`);
}

chipsEl.addEventListener("click", (event) => {
  const cue = event.target.closest(".cue-btn");
  if (cue) toggleCue(Number(cue.dataset.cue));
});

window.addEventListener("keydown", (event) => {
  if (!playback.step || edSec || dialogOpen() || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.isContentEditable || event.target.matches?.("input, textarea")) return;
  if (/^[1-9]$/.test(event.key) && playback.step.cues.length >= Number(event.key)) {
    event.preventDefault();
    toggleCue(Number(event.key));
  }
});

/* ---------- the path strip ---------- */

const fmtPlays = (n) => (Number.isInteger(n) ? `×${n}` : `×${n.toFixed(1)}`);

/** Back-to-back passes of one section become one chip: "Verse ×3". */
function squash(steps) {
  const out = [];
  for (const step of steps) {
    const last = out.at(-1);
    if (step.kind === "section" && last?.kind === "section" && last.block === step.block && !step.via?.dice && step.via?.rule !== "cue") last.times = (last.times ?? 1) + 1;
    else out.push({ ...step });
  }
  return out;
}

function stepChip(step, cls = "") {
  const dice = step.via?.dice ? `<i class="pdice">${icon("dice")}</i>` : "";
  const cued = step.via?.rule === "cue" ? `<i class="pcued">cue</i>` : "";
  if (step.kind === "section")
    return `<button class="pchip ${cls}" data-block="${step.block}" style="--h:${sec(step.block)?.hue ?? 0}">${dice}${cued}${esc(step.name)}${step.times ? `<em>×${step.times}</em>` : ""}</button>`;
  if (step.kind === "tempo") return `<span class="pchip tempo ${cls}" data-block="${step.block}">${dice}${icon("tempo")}${step.bpm} bpm</span>`;
  if (step.kind !== "together") return "";
  const rows = step.branches.map((br) => {
    const chips = br.items.map((i) => `<button class="pchip small" data-block="${i.block}" style="--h:${sec(i.block)?.hue ?? 0}">${esc(i.name)}</button>`).join("");
    const how = br.fill === "loop" && br.plays > 1 ? fmtPlays(br.plays) : br.fill === "silent" ? "then silent" : br.cut ? "cut short" : "";
    return `<span class="prow">${chips}${how ? `<em>${how}</em>` : ""}</span>`;
  });
  return `<span class="pstack ${cls}" data-block="${step.block}">${dice}${rows.join("")}</span>`;
}

// The strip's frame is built once and only its label, path and end change, so nothing around them ever moves.
// The end stays pinned at the right; a long path scrolls between, with arrows on the side that has more.
stripEl.innerHTML = `<span class="plabel"></span><div class="pwrap"><button class="pscroll back">${icon("left")}</button><div class="ppath"></div><button class="pscroll fwd">${icon("right")}</button></div><span class="pend"></span>${stripControls()}`;
const [stripLabel, stripWrap, stripEnd] = stripEl.children;
const stripPath = $(".ppath", stripWrap);

/** Shows the fade and the arrow on each side that has more path to scroll to. */
function stripMore() {
  const { scrollLeft: at, scrollWidth: all, clientWidth: shown } = stripPath;
  stripWrap.classList.toggle("more-back", at > 1);
  stripWrap.classList.toggle("more-fwd", at + shown < all - 1);
}
stripPath.addEventListener("scroll", stripMore, { passive: true });

function renderPathStrip() {
  for (const b of stripEl.querySelectorAll('[data-set="flow-mode"]')) b.classList.toggle("on", (b.dataset.v === "surprise") === state.flow.surprise);
  if (!state.edges.some((e) => e.from === "start")) {
    stripLabel.textContent = "What will play";
    stripPath.innerHTML = `<span class="pempty">Connect Start to a section to see what will play</span>`;
    stripEnd.hidden = true;
    return stripMore();
  }
  let chips, ending;
  if (playback.w) {
    const played = playback.played.slice(-4);
    const next = flowLogic.collect(playback.w.fork(), playBpm(), 24);
    chips = [...played.map((s, i) => stepChip(s, i === played.length - 1 ? "now" : "past")), ...squash(next.steps).map((s) => stepChip(s, "next"))];
    ending = endText(next, true);
  } else {
    const r = flowLogic.resolve(flowGraph(), { seed: previewSeed(), limit: 32 });
    chips = squash(r.steps).map((s) => stepChip(s));
    ending = endText(r);
  }
  stripLabel.textContent = playback.w ? "Playing" : "What will play";
  stripPath.innerHTML = chips.join('<i class="parr"></i>');
  stripEnd.hidden = false;
  stripEnd.className = `pend ${ending.endless ? "endless" : ""}`;
  stripEnd.textContent = ending.text;
  // Centre what plays now by scrolling the path itself: scrollIntoView would scroll the canvas as well.
  const now = $(".pchip.now, .pstack.now", stripPath);
  if (now) {
    const a = now.getBoundingClientRect(), p = stripPath.getBoundingClientRect();
    stripPath.scrollLeft += a.left - p.left - (p.width - a.width) / 2;
  }
  stripMore();
}

/** The pinned end of the strip: { text, endless }. */
function endText(r, live = false) {
  if (r.status === "endless") {
    // The steps from loopsBackTo on repeat forever. The loop is named after the one of them that came earliest in
    // the song, where the listener hears it go back to; a section or a group, never a Speed change.
    const first = (step) => r.steps.findIndex((s) => s.block === step.block);
    const back = r.steps
      .slice(r.loopsBackTo)
      .filter((s) => s.kind === "section" || s.kind === "together")
      .reduce((a, b) => (a && first(a) <= first(b) ? a : b), null);
    const name = back?.kind === "together" ? back.branches[0]?.items[0]?.name : back?.name;
    return { text: `∞ endless${name ? ` · loops back to ${name}` : ""}`, endless: true };
  }
  if (r.status === "limit") return { text: "… and on, while chance allows" };
  return { text: `End${live || r.seconds == null ? "" : ` · ${clockTime(r.seconds)}`}` };
}

function stripControls() {
  return `<div class="pctl">${segHtml("flow-mode", ["same", "surprise"], state.flow.surprise ? "surprise" : "same", undefined, (v) => (v === "same" ? `Same<span class="pwide"> every time</span>` : `Surprise<span class="pwide"> me</span>`))}
    <button class="icon-btn reroll">${icon("reroll")}</button></div>`;
}

stripEl.addEventListener("click", (event) => {
  const mode = event.target.closest('[data-set="flow-mode"]');
  if (mode) {
    state.flow.surprise = mode.dataset.v === "surprise";
    nextSurprise = null;
    return renderPathStrip();
  }
  if (event.target.closest(".reroll")) {
    if (state.flow.surprise) nextSurprise = newSeed();
    else state.flow.seed = newSeed();
    renderPathStrip();
    return toast(playback.w ? "New roll: it applies from the next Play" : "New roll: the preview shows the new path");
  }
  const more = event.target.closest(".pscroll");
  if (more) return stripPath.scrollBy({ left: (more.classList.contains("back") ? -0.7 : 0.7) * stripPath.clientWidth, behavior: "smooth" });
  const chip = event.target.closest("[data-block]");
  if (chip) select({ type: "node", id: chip.dataset.block });
});

// Right-click a chip: the settings of what it stands for, as on the canvas.
stripEl.addEventListener("contextmenu", (event) => {
  const chip = event.target.closest("[data-block]");
  if (!chip || !blk(chip.dataset.block)) return;
  event.preventDefault();
  select({ type: "node", id: chip.dataset.block });
  flowOpenSettings(chip.dataset.block, chip);
});

/* ---------- wiring ---------- */

document.addEventListener("DOMContentLoaded", () => {
  renderPathStrip();
  HISTORY_HOOKS.push(() => {
    flowDropEdge = null;
    flowPlaybackEdited();
  });
  // Song length and endlessness for Export (system.js).
  const exportPath = () => flowLogic.resolve(flowGraph(), { seed: state.flow.lastSeed ?? previewSeed() });
  systemHooks.songIsEndless = () => exportPath().status === "endless";
  systemHooks.songSeconds = () => exportPath().seconds ?? 0;
  systemHooks.openSection = () => edSec ?? sec(state.selected?.id) ?? state.sections[0];
  systemHooks.lastPlayRolled = () => state.flow.lastSeed != null;
  addTips([
    [".cue-btn", (el) => (el.classList.contains("armed") ? "Cue armed" : `Cue ${el.dataset.cue}`), (el) => (el.classList.contains("armed") ? "The song takes this path when the current pass ends. Press again to take it back." : "Takes this path when the current pass ends."), (el) => el.dataset.cue],
    [".path-strip .pchip, .path-strip .pstack", (el) => (el.classList.contains("pstack") ? "Playing together" : el.classList.contains("tempo") ? `Speed change · ${el.textContent.trim()}` : el.textContent.trim()), (el) => (el.classList.contains("tempo") ? "From here the song plays at this speed, in bpm (beats per minute: how fast the song goes). Right-clicking it changes the speed." : `${el.querySelector(":scope > .pdice") ? "Chance picked this one." : "What plays here, in order."} Clicking it selects it on the canvas; right-clicking opens its settings.`)],
    [".path-strip .pend", (el) => el.textContent.trim(), (el) => (el.classList.contains("endless") ? "A loop with no way out: the song plays until you stop it. Export asks how long the file should be." : "Where the song stops, and how long it lasts.")],
    ['[data-set="flow-mode"]', (el) => el.textContent.trim(), (el) => (el.dataset.v === "same" ? "Chance comes out the same on every Play, so the preview is what you hear." : "Chance is rolled again on every Play. The preview shows one possible path.")],
    [".path-strip .reroll", "Roll again", "Rolls the dice again to show another path."],
    [".path-strip .pscroll", (el) => (el.classList.contains("back") ? "Earlier" : "Later"), (el) => (el.classList.contains("back") ? "Scrolls the path back to what plays before." : "Scrolls the path on to what plays next.")],
    [".path-strip .plabel", "Path", "What will play, in order, following the rules on the connections."],
  ]);
});
