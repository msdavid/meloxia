"use strict";
// The side panel: one section's settings, or the song's effects. One panel, docked on the right, one at a time.

const sideEl = $("#side");
let side = null; // { kind: "section" | "song", id, tab, adding } while the panel is open

const SIDE_TABS = { general: "General", feel: "Feel", mix: "Mix", effects: "Effects", transitions: "Transitions" };
const FADE_CHOICES = [0, 1, 2, 3, 4];

const bpmText = (v) => `${v} BPM`;
const SET = {
  bpm: { label: "Speed", min: 40, max: 200, out: bpmText },
  bpmTo: { label: "Ends at", min: 40, max: 200, out: bpmText },
  shift: {
    label: "Shift",
    min: -12,
    max: 12,
    def: 0,
    ends: ["Lower", "Higher"],
    out: (v) => (v === 0 ? "No shift" : `${v > 0 ? "+" : "−"}${Math.abs(v)} step${Math.abs(v) === 1 ? "" : "s"}`),
  },
  swing: { label: "Amount", min: 0, max: 100, ends: ["Straight", "Bouncy"], out: (v) => (v === 0 ? "Straight" : pct(v)) },
  volume: { label: "Volume", min: 0, max: 100, out: pct },
};
// The value a setting takes when it stops following the song.
const OWN_START = { bpm: () => state.bpm, shift: () => 0 };

const sideSec = () => (side?.kind === "section" ? sec(side.id) : null);
const sideRack = () => (side.kind === "song" ? state.song.fx : sideSec().fx);

/* ---------- open and close ---------- */

function openPanel(kind, id = null) {
  const wasOpen = !!side;
  side = { kind, id, tab: side?.kind === kind ? side.tab : "general", adding: false };
  sideEl.hidden = false;
  stageEl.classList.add("side-open");
  if (!wasOpen) {
    sideEl.classList.remove("in");
    void sideEl.offsetWidth; // restart the slide-in
    sideEl.classList.add("in");
  }
  renderPanel(true);
  if (edSec) renderEditor(); // the grid shrinks to make room
  else if (kind === "section") keepInView(id);
  $("#song-fx").classList.toggle("on", kind === "song");
}

function closePanel() {
  if (!side) return;
  side = null;
  sideEl.hidden = true;
  stageEl.classList.remove("side-open");
  if (edSec) renderEditor();
  $("#song-fx").classList.remove("on");
}

function togglePanel(kind, id = null) {
  side?.kind === kind && side.id === id ? closePanel() : openPanel(kind, id);
}

/** On the canvas the panel covers the right edge: slide the view so the block being set up stays visible. */
function keepInView(id) {
  const node = $(`.node[data-id="${id}"]`, nodesEl)?.getBoundingClientRect();
  const edge = sideEl.getBoundingClientRect().left - 32;
  if (!node || node.right <= edge) return;
  state.view.x -= node.right - edge;
  applyView();
}

/* ---------- rendering ---------- */

/** "Song" while a setting follows the song; "Own" with a reset arrow once it has been changed. */
const inherit = (key, own) =>
  own
    ? `<button class="own" data-reset="${key}">Own${icon("reset")}</button>`
    : '<span class="inh">Song</span>';

const grp = (title, chip, body) => `<section class="grp"><div class="grp-head"><b>${title}</b>${chip}</div>${body}</section>`;

const choices = (key, options, current) =>
  `<div class="choices">${options
    .map(([v, label]) => `<button data-set="${key}" data-v="${v}" class="${v === current ? "on" : ""}"><i></i>${label}</button>`)
    .join("")}</div>`;

const segHtml = (key, values, current, disabled = () => false) =>
  `<div class="seg">${values
    .map((v) => `<button data-set="${key}" data-v="${v}" class="${v === current ? "on" : ""}" ${disabled(v) ? "disabled" : ""}>${v}</button>`)
    .join("")}</div>`;

function generalHtml(s) {
  const hues = SECTION_HUES.map((h) => `<button class="hue${h === s.hue ? " on" : ""}" data-set="hue" data-v="${h}" style="--h:${h}"></button>`).join("");
  const own = s.bpm !== null;
  const ramp = s.bpmTo !== null;
  const speed =
    choices("bpm", [["song", `Follow the song · ${state.bpm} BPM`], ["own", "Its own speed"]], own ? "own" : "song") +
    (own
      ? rangeHtml(SET.bpm, s.bpm, 'data-set="bpm"') +
        `<div class="ctl"><div class="ctl-head"><b>Change gradually</b><button class="switch${ramp ? " on" : ""}" role="switch" aria-checked="${ramp}" data-set="bpmTo" data-v="toggle"><i></i></button></div>
          <small>Speed up or slow down across the section</small></div>` +
        (ramp ? rangeHtml({ ...SET.bpmTo, help: `From <span data-from>${s.bpm}</span> BPM at the start to this at the end` }, s.bpmTo, 'data-set="bpmTo"') : "")
      : "");
  const pitch =
    choices("shift", [["song", "Follow the song · C minor"], ["own", "Shift everything up or down"]], s.shift === null ? "song" : "own") +
    (s.shift === null ? "" : rangeHtml(SET.shift, s.shift, 'data-set="shift"'));
  return (
    grp("Name", "", `<input class="txt" data-set="name" value="${esc(s.name)}" maxlength="24" spellcheck="false" aria-label="Section name" />`) +
    grp("Colour", "", `<div class="hues">${hues}</div>`) +
    `<div class="grp-pair">${grp("Length", "", `<div class="seg-row">${segHtml("bars", BAR_CHOICES, s.bars)}<span class="lbl">bars</span></div>`)}${grp(
      "Plays",
      "",
      `<div class="stepper"><button data-set="repeats" data-v="${s.repeats - 1}" ${s.repeats > 1 ? "" : "disabled"}>${icon("minus")}</button>
        <output>${s.repeats} time${s.repeats === 1 ? "" : "s"}</output>
        <button data-set="repeats" data-v="${s.repeats + 1}" ${s.repeats < 16 ? "" : "disabled"}>${icon("plus")}</button></div>`,
    )}</div>` +
    grp("Speed", inherit("bpm", own), speed) +
    grp("Pitch", inherit("shift", s.shift !== null), pitch)
  );
}

const swingPic = (v) =>
  `<div class="swing-pic" style="--sw:${v / 100}" aria-hidden="true">${Array.from({ length: 8 }, (_, k) => `<i class="${k % 2 ? "off" : ""}" style="--k:${k}"></i>`).join("")}</div>`;

function feelHtml(s) {
  const v = s.swing ?? state.song.swing;
  return grp("Swing", inherit("swing", s.swing !== null), `<small class="grp-help">Plays every second step a little late, for a bouncier feel</small>${rangeHtml(SET.swing, v, 'data-set="swing"')}${swingPic(v)}`);
}

function mixHtml(s) {
  const lines = s.rows
    .map((r, i) => {
      const instrument = inst(r.inst);
      return `<div class="mix-row${r.mute ? " muted" : ""}${lightHue(instrument.hue) ? " light" : ""}" style="--h:${instrument.hue}">
        <span class="glyph">${icon(glyphFor(instrument))}</span><span class="mix-name">${instrument.name}</span>
        <input type="range" min="0" max="100" step="1" value="${r.level}" data-level="${i}" aria-label="${instrument.name} level" />
        <output>${pct(r.level)}</output>
        <button class="mini m${r.mute ? " on" : ""}" data-mute="${i}">M</button>
      </div>`;
    })
    .join("");
  return (
    `<section class="grp">${rangeHtml({ ...SET.volume, label: "Section volume", help: "How loud the whole section is" }, s.volume, 'data-set="volume"')}</section>` +
    grp("Instruments", '<span class="scope">in this section only</span>', lines || '<small class="grp-help">No instruments yet. Open the section to add some.</small>')
  );
}

const effectsHtml = (s) => `<p class="side-note">Effects on everything in this section, before the song's effects</p><div class="rack">${rackInner(s.fx, side.adding)}</div>`;

function transitionsHtml(s) {
  const tooLong = (b) => b > s.bars * s.repeats;
  const fade = (key) => `<div class="seg-row">${segHtml(key, FADE_CHOICES, s[key], tooLong)}<span class="lbl">bars</span></div>`;
  return (
    grp("Fade in", "", `<small class="grp-help">Rise from silence at the start</small>${fade("fadeIn")}`) +
    grp("Fade out", "", `<small class="grp-help">Sink to silence at the end</small>${fade("fadeOut")}`) +
    grp("When the section ends, echoes and room", "", choices("tail", [["ring", "Ring into the next section"], ["cut", "Cut off"]], s.tail))
  );
}

const TAB_HTML = { general: generalHtml, feel: feelHtml, mix: mixHtml, effects: effectsHtml, transitions: transitionsHtml };

/** Draws the open panel; `fresh` starts its body scrolled to the top. Closes it if its section is gone. */
function renderPanel(fresh = false) {
  if (!side) return;
  const s = sideSec();
  if (side.kind === "section" && !s) return closePanel();
  const keep = fresh ? 0 : ($(".side-body", sideEl)?.scrollTop ?? 0);
  sideEl.classList.toggle("song", !s);
  if (s) sideEl.style.setProperty("--h", s.hue);
  const head = s
    ? `<i class="swatch"></i><span class="side-title"><small>Section settings</small><b>${esc(s.name)}</b></span>`
    : `<span class="side-ico">${icon("knob")}</span><span class="side-title"><small>Effects on the whole mix</small><b>Song</b></span>`;
  const tabs = s
    ? `<div class="tabs side-tabs">${Object.entries(SIDE_TABS)
        .map(([key, label]) => `<button data-tab="${key}" class="${side.tab === key ? "on" : ""}">${label}${key === "effects" && s.fx.length ? ` <em>${s.fx.length}</em>` : ""}</button>`)
        .join("")}</div>`
    : "";
  const body = s
    ? TAB_HTML[side.tab](s)
    : `<p class="side-note">Effects on the whole song, after every section's own effects</p><div class="rack">${rackInner(state.song.fx, side.adding)}</div>`;
  sideEl.innerHTML = `<header class="side-head">${head}<button class="icon-btn" data-side="close">${icon("x")}</button></header>${tabs}<div class="side-body">${body}</div>`;
  $(".side-body", sideEl).scrollTop = keep;
}

/** After a section setting changed: redraw the panel, the canvas chips, and the editor if it shows this section. */
function sectionChanged(s) {
  renderPanel();
  if (!s) return;
  renderNodes();
  if (edSec === s) renderEditor();
}

/* ---------- editing ---------- */

function applySet(s, key, raw) {
  if (key === "bars") return resizeSection(s, Number(raw));
  if (key === "bpmTo" && raw === "toggle") {
    s.bpmTo = s.bpmTo === null ? clamp(40, s.bpm + 12, 200) : null;
    return;
  }
  const value = raw === "song" ? null : raw === "own" ? (s[key] ?? OWN_START[key]()) : Number.isNaN(Number(raw)) ? raw : Number(raw);
  s[key] = key === "repeats" ? clamp(1, value, 16) : value;
  if (key === "bpm" && value === null) s.bpmTo = null;
}

sideEl.addEventListener("click", (event) => {
  const t = event.target;
  if (t.closest('[data-side="close"]')) return closePanel();
  const s = sideSec();
  if (rackClick(t, sideRack(), side)) return sectionChanged(s);
  const tab = t.closest(".side-tabs [data-tab]");
  if (tab) {
    side.tab = tab.dataset.tab;
    side.adding = false;
    return renderPanel(true);
  }
  const set = t.closest("[data-set][data-v]");
  if (set && !set.disabled) {
    applySet(s, set.dataset.set, set.dataset.v);
    return sectionChanged(s);
  }
  const reset = t.closest("[data-reset]")?.dataset.reset;
  if (reset) {
    s[reset] = null;
    if (reset === "bpm") s.bpmTo = null;
    return sectionChanged(s);
  }
  const mute = t.closest("[data-mute]");
  if (mute) {
    const r = s.rows[Number(mute.dataset.mute)];
    r.mute = !r.mute;
    return sectionChanged(s);
  }
});

sideEl.addEventListener("input", (event) => {
  const t = event.target;
  if (rackInput(t, sideRack())) return;
  const s = sideSec();
  if (t.dataset.level !== undefined) {
    const r = s.rows[Number(t.dataset.level)];
    r.level = Number(t.value);
    t.nextElementSibling.textContent = pct(r.level);
    return;
  }
  const key = t.dataset.set;
  if (key === "name") {
    s.name = t.value.trim() || "Untitled";
    $(".side-title b", sideEl).textContent = s.name;
    if (edSec === s) {
      $(".ed-name", editorEl).textContent = s.name;
      setMode();
    }
    return renderNodes();
  }
  if (!SET[key]) return;
  const wasOwn = s[key] !== null;
  s[key] = Number(t.value);
  $("output", t.closest(".ctl")).textContent = SET[key].out(s[key]);
  if (key === "swing") $(".swing-pic", sideEl).style.setProperty("--sw", s.swing / 100);
  if (key === "bpm") $$("[data-from]", sideEl).forEach((el) => (el.textContent = s.bpm));
  if (!wasOwn) $(".inh", t.closest(".grp"))?.replaceWith(Object.assign(document.createElement("i"), { innerHTML: inherit(key, true) }).firstChild);
  renderNodes();
});

sideEl.addEventListener("pointerdown", (event) => side && rackDrag(event, sideRack()));

/* ---------- the three ways in, and keeping in step with the rest ---------- */

nodesEl.addEventListener("contextmenu", (event) => {
  const node = event.target.closest(".node");
  if (!node) return;
  event.preventDefault();
  select({ type: "node", id: node.dataset.id });
  openPanel("section", node.dataset.id);
});

$("#song-fx").addEventListener("click", () => togglePanel("song"));

// The song's BPM shows in "Follow the song", and decides whether a section's own speed differs.
$$("[data-bpm]").forEach((button) =>
  button.addEventListener("click", () => {
    renderNodes();
    renderPanel();
  }),
);

// Changes made in the editor header, rows or on the canvas (colour, length, mute, repeats) show in the panel.
editorEl.addEventListener("click", () => sideSec() && sideSec() === edSec && renderPanel());
nodesEl.addEventListener("click", (event) => event.target.closest("[data-rep]") && renderPanel());
editorEl.addEventListener("input", (event) => {
  if (!event.target.classList.contains("ed-name") || sideSec() !== edSec) return;
  $(".side-title b", sideEl).textContent = edSec.name;
  const field = $('[data-set="name"]', sideEl);
  if (field) field.value = edSec.name;
});

/* ---------- chips on a canvas block: whatever differs from the song ---------- */

function nodeChips(s) {
  const chips = [];
  if (s.fx.length) chips.push(`fx ${s.fx.length}`);
  if (s.bpm !== null && (s.bpm !== state.bpm || s.bpmTo !== null)) chips.push(s.bpmTo === null ? `${s.bpm} bpm` : `${s.bpm}→${s.bpmTo} bpm`);
  if (s.shift) chips.push(SET.shift.out(s.shift).split(" ")[0]);
  if (s.swing !== null && s.swing !== state.song.swing) chips.push("swing");
  return chips.length ? `<div class="node-chips">${chips.map((text) => `<span>${text}</span>`).join("")}</div>` : "";
}
