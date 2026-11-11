"use strict";
/*
 * MIDI controllers (area D): a large dialog from the top-bar menu.
 *
 *   openMidi(tab?)   tabs: "devices" · "mappings" · "timing" · "supported".
 *   MIDI learn leaves the dialog for a banner: click any slider or button in the app, press "Pretend the knob moved",
 *   and the mapping appears (the slider sweeps to show it). Done returns to Mappings.
 * Nothing touches real MIDI: the browser prompts, devices and knob moves are all pretend.
 */

const midi = { allowed: false, sysex: false, devs: [], sel: null, tab: "devices", maps: [], learn: null, offset: 0, taps: [], tapT0: 0, plugged: false };

const midiDev = (key) => MIDI_DEVICES[key];
const midiLearnable = 'input[type="range"], button.switch, [data-midiLearnable], .seg button';

/* ---------- html ---------- */

function midiPermHtml() {
  return `<div class="midi-perm">${icon("midi")}
    <h3>Play Synthia from a MIDI keyboard or controller</h3>
    <p>Plug in a keyboard, pad box or knob box. Keys play notes straight away; knobs and pads can control any slider.</p>
    <p>When you continue, Chrome asks whether Synthia may use your MIDI devices. Synthia only listens to them.
      It never changes a controller's settings without asking you first.</p>
    <button class="btn primary" data-midi="allow">Continue</button>
    <small>MIDI works in Chrome.</small></div>`;
}

function midiPromptHtml(sysex) {
  return `<div class="midi-prompt" role="alertdialog"><small>Pretend browser prompt</small>
    <b>${location.host || "This site"} wants to ${sysex ? "use and reprogram your MIDI devices" : "use your MIDI devices"}</b>
    <div><button class="btn small" data-midi="block">Block</button><button class="btn small primary" data-midi="${sysex ? "grant-sysex" : "grant"}">Allow</button></div></div>`;
}

function midiDevListHtml() {
  return midi.devs.map((key) => {
    const d = midiDev(key);
    return `<button class="midi-dev${key === midi.sel ? " on" : ""}" data-dev="${key}"><i class="midi-led"></i><b>${esc(d.name)}</b>
      ${chipHtml(d.kind === "profile" ? "Ready-made profile" : "Generic", d.kind === "profile" ? "song" : "tag", `data-devkind="${d.kind}"`)}</button>`;
  }).join("") + (midi.plugged ? "" : `<button class="btn small subtle midi-plug" data-midi="plug">${icon("plus")}Pretend: plug in a Launchpad Mini</button>`);
}

function midiLightsHtml(d) {
  if (!d.lights) return "";
  if (!midi.sysex)
    return `<div class="midi-ask"><b>Let the pads light up?</b>
      <p>This controller can show your pattern and the moving playhead on its pads. To light them, Synthia needs one more
        permission from Chrome, worded “use and reprogram your MIDI devices”. Synthia only switches the pads to lights mode,
        and switches them back when you close the song.</p>
      <button class="btn small primary" data-midi="sysex">Continue</button><button class="btn small subtle" data-midi="nolights">Not now</button></div>`;
  const cells = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) cells.push(`<i class="${(r * 3 + c * 5) % 7 === 0 ? "lit" : ""}" data-c="${c}"></i>`);
  return `<div class="midi-lights"><div class="midi-grid">${cells.join("")}</div>
    <p><b>Pads show the pattern.</b> Lit pads are notes in the open section; the bright column is the playhead.</p></div>`;
}

function midiDevDetailHtml() {
  const d = midiDev(midi.sel);
  if (!d) return `<p class="lib-hint">Plug in a controller and it appears here.</p>`;
  return `<h3>${esc(d.name)}</h3>
    <p class="midi-port">Listens on <b>${esc(d.port)}</b>${d.ignored.length ? `. Ignores its ${d.ignored.join(", ")} port${d.ignored.length > 1 ? "s" : ""}, which are meant for other apps.` : "."}</p>
    ${d.kind === "generic" ? `<p class="midi-generic">No ready-made profile for this one, so Synthia treats it as a plain keyboard.</p>` : ""}
    <dl class="midi-does">${d.does.map(([what, how]) => `<dt>${what}</dt><dd>${how}</dd>`).join("")}</dl>
    ${midiLightsHtml(d)}
    <div class="lib-actions"><button class="btn primary" data-midi="learn">${icon("knob")}MIDI learn…</button>
      <button class="btn" data-midi="export">${icon("download")}Export my mapping</button></div>`;
}

function midiMapsHtml() {
  if (!midi.maps.length) return `<div class="lib-empty"><b>No mappings yet</b><p>Use MIDI learn: click a slider, then move a knob.</p>
    <button class="btn primary" data-midi="learn">${icon("knob")}MIDI learn…</button></div>`;
  return `<table class="midi-maps"><thead><tr><th>Control</th><th>Moves</th><th>Pick up</th><th>Turning</th><th></th></tr></thead><tbody>
    ${midi.maps.map((m, i) => `<tr data-map="${i}"><td><b>${esc(m.control)}</b><small>${esc(midiDev(m.dev).name)} · CC ${m.cc}</small></td>
      <td>${esc(m.target)}${m.profile ? ` ${chipHtml("from profile", "tag")}` : ""}</td>
      <td>${switchHtml(m.pickup, `data-pickup="${i}" aria-label="Pick up"`)}</td>
      <td>${segHtml(`turn-${i}`, ["absolute", "relative"], m.turn, () => false, (v) => (v === "absolute" ? "Knob" : "Endless"))}</td>
      <td><button class="icon-btn" data-unmap="${i}" aria-label="Remove mapping">${icon("x")}</button></td></tr>`).join("")}
    </tbody></table>
    <div class="lib-actions"><button class="btn" data-midi="learn">${icon("knob")}MIDI learn…</button></div>`;
}

function midiTimingHtml() {
  const n = midi.taps.length;
  const result = n >= MIDI_TAPS_NEEDED
    ? `<p class="midi-result">Your setup adds about <b>${midi.offset} ms</b>. Notes you record are moved earlier by that much, so they land where you meant.</p>`
    : `<p class="midi-result dim">${n ? `${n} of ${MIDI_TAPS_NEEDED} taps…` : "Not measured yet. Synthia assumes your controller is on time."}</p>`;
  return `<div class="midi-timing"><div class="midi-pulse${midi.tapT0 ? " run" : ""}" style="--beat:${MIDI_TAP_BEAT_MS}ms"><i></i></div>
    <div><h3>Tap along</h3>
      <p>Press Start, then tap a key or pad on your controller each time the circle pulses: ${MIDI_TAPS_NEEDED} taps. Synthia measures how late
        the taps arrive and corrects your recordings by that much.</p>
      <div class="lib-actions"><button class="btn primary" data-midi="tapstart">${midi.tapT0 ? "Start again" : "Start"}</button>
        <button class="btn" data-midi="tap" ${midi.tapT0 ? "" : "disabled"}>Pretend a tap (T)</button></div>
      ${result}
      ${rangeHtml({ label: "Correction", min: 0, max: 150, out: (v) => `${v} ms`, help: "Fine-tune by hand if recorded notes still land late." },
        midi.offset, 'data-offset')}</div></div>`;
}

function midiSupportedHtml() {
  const list = (title, items, cls) => `<div class="imp-fmt ${cls}"><b>${title}</b><ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul></div>`;
  return `<p class="imp-sub">Any MIDI keyboard plays notes out of the box, and MIDI learn teaches Synthia any knob, fader or pad.
      A ready-made profile adds the rest: pads set up as drum rows, knobs already mapped, lights that follow the song.</p>
    <div class="imp-fmts">${list("Ready-made now", MIDI_PROFILES.now, "now")}${list("Coming next", MIDI_PROFILES.next, "next")}${list("Later", MIDI_PROFILES.later, "convert")}</div>
    <p class="imp-foot">Profiles are small files. Export my mapping turns what you taught Synthia into one, and plugins can add more.</p>`;
}

const MIDI_TABS = { devices: "Devices", mappings: "Mappings", timing: "Timing", supported: "Supported controllers" };

function midiBodyHtml() {
  if (!midi.allowed) return midiPermHtml() + (midi.asking ? midiPromptHtml(false) : "");
  const tabs = `<div class="midi-tabs">${segHtml("midi-tab", Object.keys(MIDI_TABS), midi.tab, () => false, (k) => MIDI_TABS[k])}</div>`;
  let main = "";
  if (midi.tab === "devices") main = `<div class="midi-devs"><nav>${midiDevListHtml()}</nav><section class="lib-detail">${midiDevDetailHtml()}</section></div>`;
  if (midi.tab === "mappings") main = midiMapsHtml();
  if (midi.tab === "timing") main = midiTimingHtml();
  if (midi.tab === "supported") main = midiSupportedHtml();
  return `<div class="midi">${tabs}${main}</div>${midi.asking ? midiPromptHtml(true) : ""}`;
}

/* ---------- actions ---------- */

const midiDraw = () => setDialogBody(midiBodyHtml());

function midiGrant() {
  Object.assign(midi, { allowed: true, asking: false, devs: ["mpk", "usb"], sel: "mpk" });
  if (!midi.maps.length) midi.maps = MIDI_START_MAPS.map((m) => ({ ...m }));
  midiDraw();
  toast("2 controllers found");
}

function midiPlug() {
  midi.plugged = true;
  midi.devs.push("lpm");
  midi.sel = "lpm";
  midiDraw();
  toast("Novation Launchpad Mini MK3 connected · ready-made profile");
}

function midiExport() {
  const d = midiDev(midi.sel);
  const json = JSON.stringify({ synthiaProfile: 1, device: d.name, port: d.port,
    controls: midi.maps.filter((m) => m.dev === midi.sel).map(({ control, cc, target, pickup, turn }) => ({ control, cc, target, pickup, turn })) }, null, 1);
  openPopover($('[data-midi="export"]'), `<div class="midi-json"><b>${esc(d.name)}.synthia-profile.json</b><pre>${esc(json)}</pre></div>`, { width: 360 });
  toast(`Saved ${d.name}.synthia-profile.json`);
}

/* tap-along: beats every MIDI_TAP_BEAT_MS from tapT0; each tap's lateness is its distance past the nearest beat */
function midiTap() {
  if (!midi.tapT0 || midi.taps.length >= MIDI_TAPS_NEEDED) return;
  const since = performance.now() - midi.tapT0;
  const phase = since % MIDI_TAP_BEAT_MS;
  midi.taps.push(phase > MIDI_TAP_BEAT_MS / 2 ? phase - MIDI_TAP_BEAT_MS : phase);
  if (midi.taps.length >= MIDI_TAPS_NEEDED) {
    const sorted = [...midi.taps].sort((a, b) => a - b);
    midi.offset = clamp(0, Math.round(sorted[MIDI_TAPS_NEEDED / 2]), 150);
    midi.tapT0 = 0;
  }
  midiDraw();
}

/* ---------- MIDI learn ---------- */

const midiLearnBar = Object.assign(document.createElement("div"), { className: "midi-learnbar", hidden: true });
document.body.append(midiLearnBar);

function midiLearnBarHtml() {
  const t = midi.learn.target;
  return `${icon("knob")}<b>MIDI learn</b><span>${t ? `Now move a control on your controller to link it to <b>${esc(t.label)}</b>.`
    : "Click any slider or button in Synthia, then move a control on your controller."}</span>
    <button class="btn small primary" data-learn="moved" ${t ? "" : "disabled"}>Pretend the knob moved</button>
    <button class="btn small" data-learn="done">Done</button>`;
}

function midiStartLearn() {
  midi.learn = { target: null };
  closeDialog();
  document.body.classList.add("midi-learning");
  midiLearnBar.innerHTML = midiLearnBarHtml();
  midiLearnBar.hidden = false;
}

function midiStopLearn() {
  document.body.classList.remove("midi-learning");
  $$(".midi-target").forEach((el) => el.classList.remove("midi-target"));
  midiLearnBar.hidden = true;
  midi.learn = null;
  openMidi("mappings");
}

function midiLabelOf(el) {
  const ctl = el.closest(".ctl");
  const own = ctl ? $(".ctl-head b", ctl)?.textContent : el.getAttribute("aria-label") || el.textContent.trim();
  const where = el.closest("[data-learn-scope]")?.dataset.learnScope;
  return `${where ? `${where} · ` : ""}${own || "Control"}`;
}

function midiLearnMoved() {
  const { el, label } = midi.learn.target;
  const dev = midiDev(midi.sel) ?? midiDev("mpk");
  const key = midi.sel && midiDev(midi.sel).ccs.length ? midi.sel : "mpk";
  const used = new Set(midi.maps.filter((m) => m.dev === key).map((m) => m.cc));
  const i = midiDev(key).ccs.findIndex((cc) => !used.has(cc));
  const cc = midiDev(key).ccs[i < 0 ? 0 : i];
  const control = midiDev(key).controls[i] ?? `Control ${cc}`;
  midi.maps = midi.maps.filter((m) => m.target !== label);
  midi.maps.push({ dev: key, control, cc, target: label, pickup: true, turn: "absolute" });
  if (el.matches('input[type="range"]')) {
    const [min, max] = [Number(el.min), Number(el.max)];
    const t0 = performance.now();
    const sweep = () => {
      const k = Math.min(1, (performance.now() - t0) / 700);
      el.value = Math.round(min + (max - min) * (0.5 - 0.5 * Math.cos(k * Math.PI * 2)) * 0.8 + (max - min) * 0.1);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      if (k < 1) requestAnimationFrame(sweep);
    };
    requestAnimationFrame(sweep);
  }
  toast(`${control} on ${dev.name} now moves ${label}`);
  el.classList.remove("midi-target");
  midi.learn.target = null;
  midiLearnBar.innerHTML = midiLearnBarHtml();
}

// While learning, a click on a midiLearnable control picks it instead of using it.
document.addEventListener("pointerdown", (event) => {
  if (!midi.learn || event.target.closest(".midi-learnbar")) return;
  const el = event.target.closest(midiLearnable);
  if (!el) return;
  event.preventDefault();
  event.stopPropagation();
  $$(".midi-target").forEach((x) => x.classList.remove("midi-target"));
  el.classList.add("midi-target");
  midi.learn.target = { el, label: midiLabelOf(el) };
  midiLearnBar.innerHTML = midiLearnBarHtml();
}, true);
document.addEventListener("click", (event) => midi.learn && !event.target.closest(".midi-learnbar") && event.target.closest(midiLearnable) && (event.preventDefault(), event.stopPropagation()), true);

midiLearnBar.addEventListener("click", (event) => {
  const act = event.target.closest("[data-learn]")?.dataset.learn;
  if (act === "moved") midiLearnMoved();
  if (act === "done") midiStopLearn();
});

/* ---------- open and wire ---------- */

let midiPulse = 0;

function openMidi(tab = null) {
  if (tab) midi.tab = tab;
  const body = openDialog({ title: "MIDI controllers", body: midiBodyHtml(), size: "large", className: "midi-dialog",
    buttons: [{ label: "Done", primary: true, tip: "Closes this window. Controllers keep working." }], onClose: () => cancelAnimationFrame(midiPulse) });
  body.addEventListener("click", (event) => {
    const t = event.target;
    const act = t.closest("[data-midi]")?.dataset.midi;
    if (act === "allow") return ((midi.asking = true), midiDraw());
    if (act === "grant") return midiGrant();
    if (act === "block") return ((midi.asking = false), midiDraw(), toast("Blocked. You can allow MIDI later from Chrome's site settings."));
    if (act === "sysex") return ((midi.asking = true), midiDraw());
    if (act === "grant-sysex") return ((midi.sysex = true), (midi.asking = false), midiDraw(), toast("Pads now show the pattern"));
    if (act === "nolights") return toast("The pads still play. You can light them later here.");
    if (act === "plug") return midiPlug();
    if (act === "learn") return midiStartLearn();
    if (act === "export") return midiExport();
    if (act === "tapstart") return Object.assign(midi, { taps: [], tapT0: performance.now() }), midiDraw();
    if (act === "tap") return midiTap();
    const dev = t.closest("[data-dev]");
    if (dev) return ((midi.sel = dev.dataset.dev), midiDraw());
    const tabBtn = t.closest('[data-set="midi-tab"]');
    if (tabBtn) return ((midi.tab = tabBtn.dataset.v), midiDraw());
    const turn = t.closest('[data-set^="turn-"]');
    if (turn) return ((midi.maps[Number(turn.dataset.set.slice(5))].turn = turn.dataset.v), midiDraw());
    const pick = t.closest("[data-pickup]");
    if (pick) return ((midi.maps[Number(pick.dataset.pickup)].pickup ^= 1), midiDraw());
    const un = t.closest("[data-unmap]");
    if (un) {
      const [gone] = midi.maps.splice(Number(un.dataset.unmap), 1);
      midiDraw();
      toast(`${gone.control} no longer moves ${gone.target}`);
    }
  });
  body.addEventListener("input", (event) => {
    if (!event.target.matches("[data-offset]")) return;
    midi.offset = Number(event.target.value);
    $("output", event.target.closest(".ctl")).textContent = `${midi.offset} ms`;
  });
  // the Launchpad preview: the playhead column walks across the pads
  const walk = () => {
    const grid = $(".midi-grid", body);
    if (grid) {
      const col = Math.floor(performance.now() / 250) % 8;
      for (const cell of grid.children) cell.classList.toggle("head", Number(cell.dataset.c) === col);
    }
    midiPulse = requestAnimationFrame(walk);
  };
  midiPulse = requestAnimationFrame(walk);
}

document.addEventListener("keydown", (event) => {
  if ((event.key === "t" || event.key === "T") && dialogOpen() && midi.tab === "timing" && midi.tapT0 && !event.target.matches("input")) midiTap();
});

addTips([
  ['[data-midi="allow"]', "Continue", "Asks Chrome for permission to use your MIDI devices. Synthia only listens to them."],
  ['[data-midi="grant"]', "Allow", "Pretend answer to the browser's question: lets Synthia use your MIDI devices."],
  ['[data-midi="grant-sysex"]', "Allow", "Pretend answer: lets Synthia switch the pads to lights mode."],
  ['[data-midi="block"]', "Block", "Pretend answer: Synthia gets no MIDI. Keys on your computer still work."],
  [".midi-dev", (el) => midiDev(el.dataset.dev).name, "Shows what this controller does in Synthia."],
  ['[data-devkind="profile"]', "Ready-made profile", "Synthia knows this controller: its pads, knobs and lights are set up for you."],
  ['[data-devkind="generic"]', "Generic", "Synthia doesn't know this model: keys play notes, and MIDI learn teaches it the rest."],
  ['[data-midi="plug"]', "Pretend to plug in", "Shows what happens when a controller with lights is plugged in while Synthia is open."],
  ['[data-midi="sysex"]', "Light the pads", "Asks Chrome for the extra permission that lets Synthia switch the pads to lights mode."],
  ['[data-midi="nolights"]', "Not now", "Keeps the pads playing without lights. You can switch lights on later here."],
  ['[data-midi="learn"]', "MIDI learn", "Teaches Synthia a knob, fader or pad: you click a slider or button, then move the control."],
  ['[data-midi="export"]', "Export my mapping", "Saves what you taught Synthia as a profile file, to keep or share."],
  ['[data-set="midi-tab"]', (el) => el.textContent, (el) => ({ devices: "Controllers plugged in now, and what each does.",
    mappings: "Which knob, fader or pad moves which slider.", timing: "Measures and corrects how late your controller's notes arrive.",
    supported: "Controllers Synthia knows ready-made, and which come next." })[el.dataset.v]],
  ["[data-pickup]", "Pick up", "Waits until the knob reaches the slider's value before moving it, so nothing jumps."],
  ['[data-set^="turn-"][data-v="absolute"]', "Knob", "For knobs with a start and an end: the knob's position is the value."],
  ['[data-set^="turn-"][data-v="relative"]', "Endless", "For knobs that turn forever: each click nudges the value up or down."],
  ["[data-unmap]", "Remove mapping", "The control stops moving this slider."],
  ['[data-midi="tapstart"]', "Start", "Starts the pulse. Tap along with it on your controller."],
  ['[data-midi="tap"]', "Pretend a tap", "Counts as a tap on your controller, for trying this out without one.", "T"],
  ["[data-offset]", "Correction", "How much earlier recorded notes are moved. Set by Tap along, or by hand."],
  ['[data-learn="moved"]', "Pretend the knob moved", "Acts as if you moved a control on your controller: it gets linked to the chosen slider."],
  ['[data-learn="done"]', "Done", "Leaves MIDI learn and shows the list of mappings."],
]);

document.addEventListener("DOMContentLoaded", () =>
  addMenuItem({ group: "sounds", label: "MIDI controllers…", icon: "knob", action: () => openMidi(), tip: "Plays and controls Synthia from a MIDI keyboard, pad box or knob box." }));
