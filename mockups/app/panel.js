"use strict";
// The section panel (a section's settings) and the song panel (effects on the whole mix), both shown in the side panel (side.js).

const FADE_CHOICES = [0, 1, 2, 3, 4];

const bpmText = (v) => `${v} bpm`;
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

/* ---------- rendering ---------- */

/** "Song" while a setting follows the song; "Own" with a reset arrow once it has been changed. */
const inherit = (key, own) => (own ? chipHtml("Own", "own", `data-reset="${key}"`) : chipHtml("Song", "song"));

const grp = (title, chip, body) => `<section class="grp"><div class="grp-head"><b>${title}</b>${chip}</div>${body}</section>`;

function generalHtml(s) {
  const hues = SECTION_HUES.map((h) => `<button class="hue${h === s.hue ? " on" : ""}" data-set="hue" data-v="${h}" style="--h:${h}"></button>`).join("");
  const own = s.bpm !== null;
  const ramp = s.bpmTo !== null;
  const speed =
    choicesHtml("bpm", [["song", `Follow the song · ${state.bpm} bpm`], ["own", "Its own speed"]], own ? "own" : "song") +
    (own
      ? rangeHtml(SET.bpm, s.bpm, 'data-set="bpm"') +
        `<div class="ctl"><div class="ctl-head"><b>Change gradually</b><button class="switch${ramp ? " on" : ""}" role="switch" aria-checked="${ramp}" data-set="bpmTo" data-v="toggle"><i></i></button></div>
          <small>Speed up or slow down across the section</small></div>` +
        (ramp ? rangeHtml({ ...SET.bpmTo, help: `From <span data-from>${s.bpm}</span> bpm at the start to this at the end` }, s.bpmTo, 'data-set="bpmTo"') : "")
      : "");
  const pitch =
    choicesHtml("shift", [["song", "Follow the song · C minor"], ["own", "Shift everything up or down"]], s.shift === null ? "song" : "own") +
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
    grp("Higher or lower", inherit("shift", s.shift !== null), pitch)
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
    grp("Instruments", chipHtml("in this section only", "scope"), lines || '<small class="grp-help">No instruments yet. Open the section to add some.</small>')
  );
}

const effectsHtml = (s) => `<p class="side-note">Effects on everything in this section, before the song's effects</p><div class="rack">${rackInner(s.fx, side.adding)}</div>`;

function transitionsHtml(s) {
  const tooLong = (b) => b > s.bars * s.repeats;
  const fade = (key) => `<div class="seg-row">${segHtml(key, FADE_CHOICES, s[key], tooLong)}<span class="lbl">bars</span></div>`;
  return (
    grp("Fade in", "", `<small class="grp-help">Rise from silence at the start</small>${fade("fadeIn")}`) +
    grp("Fade out", "", `<small class="grp-help">Sink to silence at the end</small>${fade("fadeOut")}`) +
    grp("When the section ends, echoes and room", "", choicesHtml("tail", [["ring", "Ring into the next section"], ["cut", "Cut off"]], s.tail))
  );
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

/** A click in any section tab: a choice, a reset chip or a mute button. True when something changed. */
function sectionClick(event, id) {
  const s = sec(id);
  const t = event.target;
  const set = t.closest("[data-set][data-v]");
  if (set && !set.disabled) return applySet(s, set.dataset.set, set.dataset.v), true;
  const reset = t.closest("[data-reset]")?.dataset.reset;
  if (reset) {
    s[reset] = null;
    if (reset === "bpm") s.bpmTo = null;
    return true;
  }
  const mute = t.closest("[data-mute]");
  if (mute) {
    const r = s.rows[Number(mute.dataset.mute)];
    r.mute = !r.mute;
    return true;
  }
  return false;
}

function sectionInput(event, id) {
  const s = sec(id);
  const t = event.target;
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
}

const sectionTab = (label, tip, body) => ({ label, tip, body: (id) => body(sec(id)) });

registerPanel("section", {
  head: (id) => ({ eyebrow: "Section settings", name: sec(id).name, hue: sec(id).hue }),
  tabs: {
    general: sectionTab("General", "Name, colour, length, speed, and how high or low this section plays.", generalHtml),
    feel: sectionTab("Feel", "How bouncy the rhythm of this section is.", feelHtml),
    mix: sectionTab("Mix", "How loud the section and each of its instruments are.", mixHtml),
    effects: sectionTab((id) => `Effects${sec(id).fx.length ? ` <em>${sec(id).fx.length}</em>` : ""}`, "Effects that change the sound of this whole section.", effectsHtml),
    transitions: sectionTab("Transitions", "How the section starts and how it hands over to the next one.", transitionsHtml),
  },
  rack: (id) => sec(id).fx,
  click: sectionClick,
  input: sectionInput,
  exists: (id) => !!sec(id),
  changed: () => {
    renderNodes();
    if (edSec === sideSec()) renderEditor();
  },
  anchor: (id) => $(`.node[data-id="${id}"]`, nodesEl),
});

registerPanel("song", {
  head: () => ({ eyebrow: "Effects on the whole mix", name: "Song", icon: "knob" }),
  body: () => `<p class="side-note">Effects on the whole song, after every section's own effects</p><div class="rack">${rackInner(state.song.fx, side.adding)}</div>`,
  rack: () => state.song.fx,
  changed: () => renderNodes(),
  className: "song",
});

/* ---------- the three ways in, and keeping in step with the rest ---------- */

nodesEl.addEventListener("contextmenu", (event) => {
  const node = event.target.closest(".node");
  if (!node) return;
  event.preventDefault();
  select({ type: "node", id: node.dataset.id });
  openPanel("section", node.dataset.id);
});

$("#song-fx").addEventListener("click", () => togglePanel("song"));

// The song's speed shows in "Follow the song", and decides whether a section's own speed differs.
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
