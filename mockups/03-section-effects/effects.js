"use strict";
// Effects: the catalogue, the demo seed, the effects rack (one component for sections and the song) and the
// "Effects on this note" group of the note inspector.

const pct = (v) => `${v} %`;

// Every slider an effect has. `ends` puts words at either end of the slider, with a centre mark between them.
const FX = {
  echo: {
    name: "Echo",
    desc: "Repeats that fade away",
    params: {
      time: { label: "Time", min: 1, max: 8, def: 3, out: (v) => `${v} step${v === 1 ? "" : "s"}` },
      repeats: { label: "Repeats", min: 1, max: 12, def: 4, out: (v) => `${v}` },
      amount: { label: "Amount", min: 0, max: 100, def: 30, out: pct },
    },
  },
  room: {
    name: "Room",
    desc: "A sense of space around the sound",
    params: {
      size: { label: "Size", min: 0, max: 100, def: 50, out: (v) => (v < 34 ? "Small" : v < 67 ? "Medium" : "Large") },
      amount: { label: "Amount", min: 0, max: 100, def: 25, out: pct },
    },
  },
  grit: {
    name: "Grit",
    desc: "A rough, overdriven edge",
    params: {
      drive: { label: "Drive", min: 0, max: 100, def: 40, out: pct },
      amount: { label: "Amount", min: 0, max: 100, def: 50, out: pct },
    },
  },
  brightness: {
    name: "Brightness",
    desc: "Muffle the sound or open it up",
    params: {
      tone: {
        label: "Brightness",
        min: -50,
        max: 50,
        def: 0,
        ends: ["Muffled", "Bright"],
        out: (v) => (v === 0 ? "As it is" : v < 0 ? `${-v} % muffled` : `${v} % brighter`),
      },
    },
  },
  wobble: {
    name: "Wobble",
    desc: "Gentle movement in the sound",
    params: {
      speed: { label: "Speed", min: 1, max: 80, def: 20, ends: ["Slow", "Fast"], out: (v) => `${(v / 10).toFixed(1)} a second` },
      depth: { label: "Depth", min: 0, max: 100, def: 40, out: pct },
    },
  },
  punch: {
    name: "Punch",
    desc: "Evens out loud and quiet",
    params: { amount: { label: "Amount", min: 0, max: 100, def: 40, out: pct } },
  },
  width: {
    name: "Width",
    desc: "Narrower or wider across the speakers",
    params: {
      width: { label: "Width", min: 0, max: 200, def: 100, ends: ["Narrow", "Wide"], out: (v) => (v === 100 ? "As it is" : pct(v)) },
    },
  },
  limiter: { name: "Safety limiter", desc: "Stops the mix from distorting", fixed: true, params: {} },
};

let fxSeq = 0;

/** One effect in a rack: its type, on or off, and its slider values. */
function fx(type, values = {}) {
  const v = Object.fromEntries(Object.entries(FX[type].params).map(([key, p]) => [key, p.def]));
  return { uid: `fx${++fxSeq}`, type, on: true, v: { ...v, ...values } };
}

/** A new section's settings. `null` means "follow the song". */
const sectionSettings = () => ({ bpm: null, bpmTo: null, shift: null, swing: null, volume: 100, fx: [], fadeIn: 0, fadeOut: 0, tail: "ring" });

/* ---------- demo seed ---------- */

state.sections.forEach((section) => Object.assign(section, sectionSettings()));
Object.assign(sec("intro"), { fx: [fx("brightness", { tone: -35 })], fadeIn: 2 });
Object.assign(sec("chorus"), { fx: [fx("room", { size: 60, amount: 30 })], shift: 2 });
state.song = { swing: 0, fx: [fx("room", { size: 25, amount: 12 }), fx("limiter")] };
// Instrument effects are only seeded here; editing them is a later mockup.
state.instFx = { lead: [fx("echo"), fx("room")], snare: [fx("room", { size: 35, amount: 20 })] };

/* ---------- a labelled slider, shared by the rack and the side panel ---------- */

function rangeHtml(p, value, attrs) {
  const input = `<input type="range" min="${p.min}" max="${p.max}" step="1" value="${value}" ${attrs} aria-label="${p.label}" />`;
  return `<div class="ctl"><div class="ctl-head"><b>${p.label}</b><output>${p.out(value)}</output></div>${p.help ? `<small>${p.help}</small>` : ""}${
    p.ends ? `<div class="ends${p.min + p.max === 2 * p.def ? " mid" : ""}"><span>${p.ends[0]}</span>${input}<span>${p.ends[1]}</span></div>` : input
  }</div>`;
}

/* ---------- the rack ---------- */

function cardHtml(e, i) {
  const def = FX[e.type];
  const lead = def.fixed
    ? `<span class="fx-handle lock">${icon("lock")}</span>`
    : `<span class="fx-handle" data-fx-drag>${icon("grip")}</span>`;
  const tail = def.fixed
    ? '<span class="fx-fixed">Always last</span>'
    : `<button class="switch${e.on ? " on" : ""}" role="switch" aria-checked="${e.on}" data-fx="toggle"><i></i></button>
       <button class="mini" data-fx="remove">${icon("trash")}</button>`;
  const body = Object.entries(def.params)
    .map(([key, p]) => rangeHtml(p, e.v[key], `data-fx-k="${key}"`))
    .join("");
  return `<div class="fx-card${e.on ? "" : " off"}${def.fixed ? " fixed" : ""}" data-i="${i}">
    <div class="fx-top">${lead}<span class="fx-name"><b>${def.name}</b><small>${def.desc}</small></span>${tail}</div>
    ${body && e.on ? `<div class="fx-body">${body}</div>` : ""}
  </div>`;
}

/** The inside of a `.rack`: the cards in signal order, then Add effect and its menu. */
function rackInner(list, adding) {
  const menu = Object.entries(FX)
    .filter(([, def]) => !def.fixed)
    .map(([type, def]) => `<button data-fx-add="${type}"><b>${def.name}</b><small>${def.desc}</small></button>`)
    .join("");
  return `${list.length ? `<p class="rack-flow">${icon("down")}Sound flows from top to bottom</p>` : '<p class="rack-flow">No effects yet</p>'}
    ${list.map(cardHtml).join("")}
    <button class="fx-add${adding ? " on" : ""}" data-fx="add">${icon("plus")}Add effect</button>
    ${adding ? `<div class="fx-menu">${menu}</div>` : ""}`;
}

/** Handles a click inside a rack; `ui.adding` is whether its menu is open. Returns true if the rack changed. */
function rackClick(target, list, ui) {
  const add = target.closest("[data-fx-add]");
  if (add) {
    // New effects go to the end of the chain, before anything fixed there (the song's limiter).
    const end = list.findIndex((e) => FX[e.type].fixed);
    list.splice(end < 0 ? list.length : end, 0, fx(add.dataset.fxAdd));
    ui.adding = false;
    return true;
  }
  const act = target.closest("[data-fx]")?.dataset.fx;
  if (!act) return false;
  if (act === "add") {
    ui.adding = !ui.adding;
    return true;
  }
  const i = Number(target.closest(".fx-card").dataset.i);
  if (act === "toggle") list[i].on = !list[i].on;
  if (act === "remove") list.splice(i, 1);
  return true;
}

/** A slider inside a rack moved. Returns true if it was one. */
function rackInput(input, list) {
  const key = input.dataset.fxK;
  if (!key) return false;
  const e = list[Number(input.closest(".fx-card").dataset.i)];
  e.v[key] = Number(input.value);
  $("output", input.closest(".ctl")).textContent = FX[e.type].params[key].out(e.v[key]);
  return true;
}

/** Dragging a card by its handle: it swaps places as it passes the middle of its neighbours; fixed cards stay put. */
function rackDrag(event, list) {
  const handle = event.target.closest("[data-fx-drag]");
  if (!handle || event.button !== 0) return false;
  event.preventDefault();
  const rack = handle.closest(".rack");
  const movable = list.filter((e) => !FX[e.type].fixed).length;
  let at = Number(handle.closest(".fx-card").dataset.i);
  const redraw = (dragging) => {
    rack.innerHTML = rackInner(list, false);
    if (dragging) $(`.fx-card[data-i="${at}"]`, rack).classList.add("dragging");
  };
  redraw(true);
  document.body.classList.add("fx-dragging");
  track(
    (move) => {
      const others = $$(".fx-card:not(.fixed)", rack).filter((el) => Number(el.dataset.i) !== at);
      const to = Math.min(movable - 1, others.filter((el) => el.getBoundingClientRect().top + el.offsetHeight / 2 < move.clientY).length);
      if (to === at) return;
      list.splice(to, 0, list.splice(at, 1)[0]);
      at = to;
      redraw(true);
    },
    () => {
      document.body.classList.remove("fx-dragging");
      redraw(false);
    },
  );
  return true;
}

/* ---------- the note inspector: effects on this note ---------- */

const hasNoteFx = (n) => !!n.fx && Object.keys(n.fx).length > 0;
/** How much of an instrument effect a note gets when it has no say of its own. */
const instAmount = (e) => e.v.amount ?? 100;
const fxResetHtml = (uid) => `<button class="mini" data-fxn-reset="${uid}">${icon("reset")}</button>`;

function noteFxHtml(n, instrument) {
  const list = state.instFx[instrument.id] ?? [];
  const head = '<div class="ctl-head"><b>Effects on this note</b></div>';
  if (!list.length) return `<div class="ctl fxn">${head}<small class="msg">This instrument has no effects yet</small></div>`;
  const rows = list
    .map((e) => {
      const own = n.fx?.[e.uid] !== undefined;
      const v = own ? n.fx[e.uid] : instAmount(e);
      return `<div class="fxn-row"><span>${FX[e.type].name}</span>
        <input type="range" min="0" max="100" step="1" value="${v}" data-fxn="${e.uid}" aria-label="${FX[e.type].name} on this note" />
        <output>${own ? pct(v) : "Same as instrument"}</output>${own ? fxResetHtml(e.uid) : '<i class="fxn-gap"></i>'}</div>`;
    })
    .join("");
  return `<div class="ctl fxn">${head}<small>How much of each ${instrument.name} effect this note gets</small>${rows}</div>`;
}

inspEl.addEventListener("input", (event) => {
  const uid = event.target.dataset.fxn;
  if (!uid) return;
  const n = insp.n;
  (n.fx ??= {})[uid] = Number(event.target.value);
  const line = event.target.closest(".fxn-row");
  $("output", line).textContent = pct(n.fx[uid]);
  $(".fxn-gap", line)?.replaceWith(Object.assign(document.createElement("i"), { innerHTML: fxResetHtml(uid) }).firstChild);
  drawRow(insp.r);
});

// Capture, so the override is gone before the inspector's own click handler redraws the note and the inspector.
inspEl.addEventListener(
  "click",
  (event) => {
    const uid = event.target.closest("[data-fxn-reset]")?.dataset.fxnReset;
    if (!uid) return;
    delete insp.n.fx[uid];
    if (!hasNoteFx(insp.n)) delete insp.n.fx;
  },
  true,
);
