"use strict";
/*
 * Area B: the instrument panel. A click on an instrument's name in a row header opens it in the side panel: what the
 * instrument is and where its sound comes from (bank and credit), "Change instrument", and two tabs: Sound, Effects.
 * Settings belong to the instrument, so they apply in every section that uses it. The library itself is worker2's
 * (library.js): this file calls openLibrary({ family, onPick, pickLabel }) and nothing else of it.
 */

const DRUM_FAMS = ["kits", "machines", "perc"];
const SOUND_DEFAULTS = { volume: 80, fadeIn: 0, fadeOut: 15, bright: 50, octave: 0, voices: 0, wave: "saw" };
// Where the demo song's instruments come from (ids in LIBRARY, the starter set).
const DEMO_LIB = { bass: "ebass", lead: "synth", pad: "strings", pluck: "harp", keys: "grand" };

/** state.sound[id]: one instrument's sound settings and its library source, kept with the song (and its undo). */
state.sound = {};
const soundOf = (id) => (state.sound[id] ??= { ...SOUND_DEFAULTS, lib: DEMO_LIB[id] ?? (inst(id).kind === "drum" ? "rock" : "synth") });
const libOf = (id) => (typeof LIBRARY === "undefined" ? null : LIBRARY.find((it) => it.id === soundOf(id).lib));
const isSynth = (id) => inst(id).kind === "synth";

/** The instrument list follows what each one plays: a melodic instrument becomes the synth, or sampled, with its source. */
function applySound(id) {
  const instrument = inst(id);
  const it = libOf(id);
  if (!instrument || !it || instrument.kind === "drum") return;
  instrument.kind = it.fam === "synth" ? "synth" : "sampled";
  instrument.tag = it.name;
}

/* ---------- settings ---------- */

const msText = (v) => {
  const ms = Math.round(((v / 100) ** 2 * 2000) / 10) * 10;
  return ms === 0 ? "Instant" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
};
const signed = (v, unit = "") => (v === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(v)}${unit}`);

const SOUND = {
  volume: { label: "Volume", min: 0, max: 100, out: pct, help: "How loud this instrument is, in every section" },
  fadeIn: { label: "Soft start", min: 0, max: 100, out: msText, ends: ["Instant", "Slow"], help: "How slowly each note swells up when it starts" },
  fadeOut: { label: "Ring out", min: 0, max: 100, out: msText, ends: ["Short", "Long"], help: "How long each note takes to die away after it ends" },
  bright: { label: "Brightness", min: 0, max: 100, def: 50, ends: ["Muffled", "Bright"], out: (v) => (v === 50 ? "Natural" : signed((v - 50) * 2, "%")), help: "Muffles the sound or makes it crisper" },
};

const WAVES = [
  ["sine", "Smooth", "M2 12c3-9 6-9 9 0s6 9 9 0 6-9 9 0", "Round and pure, like a whistle"],
  ["triangle", "Soft", "M2 12l4.5-8 9 16 9-16 4.5 8", "Gentle, a little like a flute"],
  ["saw", "Bright", "M2 18L11 5v13l9-13v13l9-13", "Rich and buzzy: the classic synth sound"],
  ["square", "Hollow", "M2 18V5h7v13h7V5h7v13h6", "Woody and hollow, like an old video game"],
];

const changedChip = (key, value) => (value === SOUND_DEFAULTS[key] ? "" : chipHtml("Changed", "own", `data-reset="${key}"`));

function soundHtml(id) {
  const s = soundOf(id);
  const pitched = melodic(inst(id));
  const wave = isSynth(id)
    ? grp(
        "Wave shape",
        changedChip("wave", s.wave),
        `<div class="waves">${WAVES.map(
          ([v, label, path]) =>
            `<button data-set="wave" data-v="${v}" class="${s.wave === v ? "on" : ""}"><svg viewBox="0 0 31 23" aria-hidden="true"><path d="${path}"/></svg><span>${label}</span></button>`,
        ).join("")}</div>`,
      )
    : "";
  // The slider's own head carries the "Changed" chip, so its label stays its accessible name.
  const slider = (key) => `<section class="grp">${rangeHtml(SOUND[key], s[key], `data-set="${key}"`).replace("</output></div>", `</output>${changedChip(key, s[key])}</div>`)}</section>`;
  const octave = grp(
    "Range",
    changedChip("octave", s.octave),
    `<small class="grp-help">Moves every note to a lower or higher range, keeping the tune</small><div class="seg-row"><span class="lbl">Lower</span>${segHtml("octave", [-2, -1, 0, 1, 2], s.octave, () => false, (v) => signed(v))}<span class="lbl">Higher</span></div>`,
  );
  const voices = grp(
    "Notes at once",
    changedChip("voices", s.voices),
    `<small class="grp-help">With 1, a new note cuts off the last one: good for basses and leads</small>${segHtml("voices", [1, 2, 4, 8, 0], s.voices, () => false, (v) => (v === 0 ? "Any" : v))}`,
  );
  return wave + slider("volume") + slider("fadeIn") + slider("fadeOut") + slider("bright") + (pitched ? octave + voices : "");
}

function instEffectsHtml(id) {
  const list = (state.instFx[id] ??= []);
  return `<p class="side-note">Effects on ${esc(inst(id).name)} in every section, before the section's own effects</p><div class="rack">${rackInner(list, side.adding)}</div>`;
}

function instIntroHtml(id) {
  const it = libOf(id);
  const fam = it ? (LIB_FAMILIES.find(([key]) => key === it.fam)?.[1] ?? it.fam) : "";
  const source = it
    ? `<div class="inst-src"><b>${esc(it.name)}</b><span>${fam} · ${esc(it.bank)}</span><small>${esc(it.credit)}</small></div>`
    : '<div class="inst-src"><b>Unknown sound</b></div>';
  return `${source}<div class="inst-acts"><button class="btn inst-change" data-inst="change">${icon("open")}Change instrument</button><button class="btn inst-change" data-inst="suggest">${icon("bulb")}Suggest notes…</button></div>`;
}

/* ---------- editing ---------- */

function soundClick(event, id) {
  const s = soundOf(id);
  const t = event.target;
  if (t.closest('[data-inst="change"]')) return changeInstrument(id), false;
  if (t.closest('[data-inst="suggest"]')) return suggestFromPanel(id), false;
  const set = t.closest("[data-set][data-v]");
  if (set && !set.disabled) {
    const raw = set.dataset.v;
    s[set.dataset.set] = Number.isNaN(Number(raw)) ? raw : Number(raw);
    return true;
  }
  const reset = t.closest("[data-reset]")?.dataset.reset;
  if (reset) return (s[reset] = SOUND_DEFAULTS[reset]), true;
  return false;
}

function soundInput(event, id) {
  const t = event.target;
  const key = t.dataset.set;
  if (!SOUND[key]) return;
  const s = soundOf(id);
  const was = s[key];
  s[key] = Number(t.value);
  $("output", t.closest(".ctl")).textContent = SOUND[key].out(s[key]);
  // The "Changed" chip appears or goes as the value leaves or meets its default.
  if ((was === SOUND_DEFAULTS[key]) !== (s[key] === SOUND_DEFAULTS[key])) {
    const head = $(".ctl-head", t.closest(".ctl"));
    $(".own", head)?.remove();
    head.insertAdjacentHTML("beforeend", changedChip(key, s[key]));
  }
}

function changeInstrument(id) {
  if (typeof openLibrary !== "function") return toast("The library is not wired into this mockup yet");
  const drum = inst(id).kind === "drum";
  openLibrary({
    family: libOf(id)?.fam ?? (drum ? "kits" : "synth"),
    pickLabel: `Use for ${inst(id).name}`,
    onPick: (it) => {
      if (DRUM_FAMS.includes(it.fam) !== drum) {
        return toast(drum ? `${inst(id).name} plays drum hits: choose a drum kit, drum machine or percussion` : `${inst(id).name} plays tunes: choose an instrument, not a drum kit`);
      }
      soundOf(id).lib = it.id;
      applySound(id);
      panelChanged();
      commitHistory();
      toast(`${inst(id).name} now plays ${it.name}`);
    },
  });
}

const instTab = (label, tip, body) => ({ label, tip, body, click: soundClick, input: soundInput });

registerPanel("instrument", {
  head: (id) => ({ eyebrow: "Instrument", name: inst(id).name, hue: inst(id).hue }),
  intro: instIntroHtml,
  tabs: {
    sound: instTab("Sound", "How this instrument sounds: volume, fades, brightness and more.", soundHtml),
    effects: instTab((id) => `Effects${state.instFx[id]?.length ? ` <em>${state.instFx[id].length}</em>` : ""}`, "Effects that change the sound of this instrument everywhere.", instEffectsHtml),
  },
  rack: (id) => (side.tab === "effects" ? (state.instFx[id] ??= []) : null),
  exists: (id) => !!inst(id),
  changed: () => edSec && renderEditor(),
  className: "inst-panel",
});

/* ---------- adding from the library ---------- */

const FAM_HUE = { pianos: 132, keys: 150, organ: 40, bass: 262, guitar: 24, strings: 212, brass: 48, woodwind: 104, mallets: 300, voices: 330, synth: 188, imports: 236, plugins: 280 };
const KIT_PIECES = [["kick", "Kick", 14], ["snare", "Snare", 344], ["hat", "Hat", 46]];

/** An instrument for a library pick: one row for a melodic sound or percussion, three (kick, snare, hat) for a kit. */
function instrumentsFor(it) {
  const make = (id, name, kind, hue, octave) => {
    if (!inst(id)) {
      INSTRUMENTS.push({ id, name, kind, group: "Instruments", hue, octave, tag: it.name });
      state.sound[id] = { ...SOUND_DEFAULTS, lib: it.id };
      applySound(id);
    }
    return id;
  };
  if (it.fam === "kits" || it.fam === "machines") return KIT_PIECES.map(([piece, name, hue]) => make(`${piece}-${it.id}`, name, "drum", hue));
  if (it.fam === "perc") return [make(`perc-${it.id}`, it.name, "drum", 86)];
  return [make(`lib-${it.id}`, it.name, it.fam === "synth" ? "synth" : "sampled", FAM_HUE[it.fam] ?? 200, it.fam === "bass" ? 1 : 3)];
}

function addFromLibrary(it) {
  const ids = instrumentsFor(it).filter((id) => !edSec.rows.some((r) => r.inst === id));
  if (!ids.length) return toast(`${it.name} is already in this section`);
  const steps = edSec.bars * STEPS_PER_BAR;
  ids.forEach((id) => edSec.rows.push(row(id, inst(id).kind === "drum" ? Array(steps).fill(null) : Array.from({ length: steps }, () => []))));
  renderEditor();
  commitHistory();
  toast(`${it.name} added to ${edSec.name}`);
}

function browseLibrary() {
  closePopover();
  if (typeof openLibrary !== "function") return toast("The library is not wired into this mockup yet");
  openLibrary({ onPick: addFromLibrary, pickLabel: `Add to ${edSec.name}` });
}

/* ---------- ways in, and keeping in step ---------- */

editorEl.addEventListener("click", (event) => {
  const name = event.target.closest('.row [data-act="inst"]');
  if (!name) return;
  event.stopPropagation();
  togglePanel("instrument", edSec.rows[Number(name.closest(".row").dataset.r)].inst);
});

// Right-click anywhere on a row header (its name, glyph, record dot or buttons) opens the instrument's settings.
editorEl.addEventListener("contextmenu", (event) => {
  const header = event.target.closest(".row > .rh");
  if (!header || !edSec) return;
  event.preventDefault();
  openPanel("instrument", edSec.rows[Number(header.closest(".row").dataset.r)].inst);
});

/** The small line under an instrument's name in its row: its sound, and whatever differs from the defaults. */
function instLine(instrument) {
  if (instrument.kind === "drum") return libOf(instrument.id)?.name ?? "Drum";
  const s = soundOf(instrument.id);
  return [instrument.tag, s.octave ? `range ${signed(s.octave)}` : "", s.voices === 1 ? "1 at a time" : ""].filter(Boolean).join(" · ");
}

addHistoryField("sound");
HISTORY_HOOKS.push(() => INSTRUMENTS.forEach((instrument) => applySound(instrument.id)));
INSTRUMENTS.forEach((instrument) => soundOf(instrument.id));

addTips([
  [".inst-panel input[data-set]", (el) => SOUND[el.dataset.set].label, (el) => `${SOUND[el.dataset.set].help}.`],
  ['.row [data-act="inst"]', (el) => el.firstChild.textContent, "Opens this instrument's sound, effects and where it comes from.", ""],
  ['[data-inst="change"]', "Change instrument", "Swaps in another sound from the library. The notes stay as they are."],
  ['.side [data-set="wave"]', (el) => el.textContent.trim(), (el) => WAVES.find(([v]) => v === el.dataset.v)[3] + "."],
  ['.side [data-set="octave"]', (el) => (el.dataset.v === "0" ? "Normal range" : `${Math.abs(Number(el.dataset.v))} ${Number(el.dataset.v) > 0 ? "higher" : "lower"}`), "Moves every note of this instrument to a lower or higher range, keeping the tune."],
  ['.side [data-set="voices"]', (el) => (el.dataset.v === "0" ? "Any number" : `${el.dataset.v} at once`), "How many notes can sound together. With 1, each new note cuts off the last."],
  [".side-intro .inst-src", (el) => $("b", el).textContent, "The sound this instrument plays, the collection it comes from, and who made it."],
]);
