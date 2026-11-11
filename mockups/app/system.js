"use strict";
// System screens from the top-bar menu (area D), part 1: menu entries, shared bits, Save, Open with the
// consent screen, and Export. Part 2 (Plugins, Credits, Preferences) is system.more.js; demo data in system.data.js.
// Everything is pretend: no file is read or written, progress bars animate on their own.
// Uses the shared dialog (dialog.js), toast and menu hook (app.js), controls (ui.js) and tooltips (tips.js).

// Hooks the rest of the app fills in (flow.path.js: endless, song length, the open section, the last roll).
const systemHooks = {
  songIsEndless: () => false,
  openSection: () => CURRENT_SONG.sections[1],
  lastPlayRolled: () => true,
};

/* ---------- shared bits ---------- */

Object.assign(ICONS, {
  save: '<path d="M3 2.5h8l2.5 2.5v8.5h-11z"/><path d="M5.5 2.5v3h5v-3M5 13.5v-4h6v4"/>',
  plug: '<path d="M6 2v3M10 2v3M4.5 5h7v2.5a3.5 3.5 0 0 1-7 0zM8 11v3"/>',
  heart: '<path d="M8 13.2S2.5 10 2.5 6.2A2.7 2.7 0 0 1 8 4.8a2.7 2.7 0 0 1 5.5 1.4C13.5 10 8 13.2 8 13.2z"/>',
});

const sw = (on, attrs) => switchHtml(on, attrs);
const seg = (name, value, options) =>
  segHtml(name, options.map(([v]) => v), value, undefined, (v) => options.find(([x]) => x === v)[1]).replace('class="seg"', 'class="seg sys-seg"');
const btn = (label, attrs = "", kind = "") => `<button class="btn ${kind}" ${attrs}>${label}</button>`;

// Every system screen is a shared dialog. buttons: [label, action (a key of sysRun), kind?, tooltip sentence].
function sysDialog({ title, body, buttons = [], wide = false, close = null }) {
  const el = openDialog({
    title,
    body,
    className: `sys${wide ? " sys-wide" : ""}`,
    onClose: close,
    buttons: buttons.map(([label, act, kind = "", tip]) => ({ label, tip, primary: kind === "primary", danger: kind === "danger", action: () => sysRun(act) })),
  });
  el.querySelector("[data-focus]")?.focus();
  return el;
}
const sizeRow = (name, sub, size, attrs = "") =>
  `<li ${attrs}><span class="sys-name"><b>${name}</b>${sub ? `<small>${sub}</small>` : ""}</span><span class="sys-size">${size}</span></li>`;

// A pretend streaming job: walks through steps, moving a bar, never blocking the page.
function runProgress(host, steps, ms, done) {
  host.innerHTML = `<div class="sys-progress"><div class="sys-bar"><i></i></div><p class="sys-step"></p></div>`;
  const bar = host.querySelector("i"), label = host.querySelector(".sys-step");
  const start = performance.now();
  (function frame(now) {
    const t = Math.min(1, (now - start) / ms);
    const i = Math.min(steps.length - 1, Math.floor(t * steps.length));
    bar.style.width = `${t * 100}%`;
    label.textContent = `${steps[i]} · ${Math.round(t * 100)}%`;
    if (t < 1) requestAnimationFrame(frame);
    else done();
  })(start);
}

// "What this plugin's author says it does" (libraries.md decision 20: shown, never enforced).
function declHtml(id) {
  const p = PLUGIN_TYPES[id];
  const items = p.perms.map((k) => `<li data-perm="${k}">${PERMISSIONS[k]}${k === "network" && p.hosts ? `: <code>${p.hosts.join(", ")}</code>` : ""}</li>`);
  return `<div class="decl"><h5>What this plugin's author says it does</h5>${
    items.length ? `<ul>${items.join("")}</ul>` : `<p class="decl-none">Declares nothing</p>`
  }<p class="decl-fixed">Meloxia does not check or enforce this. Plugins can access everything in the app.</p></div>`;
}

const pluginHead = (id, extra = "") => {
  const p = PLUGIN_TYPES[id];
  return `<div class="plug-head"><span class="plug-ico">${icon("knob")}</span><span class="sys-name"><b>${p.name}</b><small>${p.adds}</small></span>${extra}</div>
    <p class="plug-meta">Version ${p.version} · by ${p.author} · ${fmtKb(p.kb)}</p>`;
};

/* ---------- Save ---------- */

/** What the song uses: each row's library instrument (instrument.js), once each, and the plugins its blocks need. */
function saveContents() {
  const ids = new Set(state.sections.flatMap((s) => s.rows.map((r) => r.inst)));
  const items = [...new Map([...ids].map((id) => libOf(id)).filter(Boolean).map((it) => [it.id, it])).values()];
  const inst = items.filter((it) => it.mb > 0);
  const synths = items.length - inst.length;
  const plugins = state.blocks.some((b) => b.kind === "tempo") ? [{ id: "tempo-tools", ...PLUGIN_TYPES["tempo-tools"] }] : [];
  const total = CURRENT_SONG.songKb / 1024 + inst.reduce((a, i) => a + i.mb, 0) + plugins.reduce((a, p) => a + p.kb / 1024, 0);
  return { inst, synths, plugins, total };
}

function openSave() {
  const { inst, synths, plugins, total } = saveContents();
  const body = `
    <label class="sys-field"><span>File name</span><input id="save-name" value="${CURRENT_SONG.name}.meloxia" spellcheck="false" data-focus /></label>
    <p class="sys-lead">The file is complete: anyone who opens it hears exactly this song, with every sound it needs.</p>
    <h4 class="sys-h">The file will contain</h4>
    <ul class="sys-list">
      ${sizeRow("The song", `${state.sections.length} sections, notes, settings and effects`, fmtKb(CURRENT_SONG.songKb))}
      ${inst.map((i) => sizeRow(i.name, `${i.bank} · whole instrument, so the song stays editable`, fmtMb(i.mb), 'class="inst"')).join("")}
      ${synths ? sizeRow("Basic synth sound", "settings only", "no sound files") : ""}
      ${state.notes.length ? sizeRow("Notes for yourself", `${state.notes.length} note${state.notes.length === 1 ? "" : "s"}`, "with the song") : ""}
      ${plugins.map((p) => sizeRow(p.name, `Plugin · ${p.adds}`, fmtKb(p.kb), 'class="plug"')).join("")}
    </ul>
    <p class="sys-total"><span>Total</span><b>${fmtMb(total)}</b></p>
    <p class="sys-note">Sounds shared by several instruments are stored once.</p>
    <div id="save-progress"></div>`;
  sysDialog({ title: "Save song", body, buttons: [CANCEL, [`Save ${fmtMb(total)}`, "save-go", "primary", "Writes the file. You can keep working while it saves."]] });
}

function saveGo() {
  const name = document.querySelector("#save-name").value.trim() || `${CURRENT_SONG.name}.meloxia`;
  const { inst, plugins, total } = saveContents();
  const steps = ["Writing the song", ...inst.map((i) => `Writing ${i.name}`), ...plugins.map((p) => `Writing ${p.name}`), "Finishing"];
  sysDialog({ title: "Saving…", body: `<p class="sys-lead">${esc(name)}</p><div id="save-progress"></div><p class="sys-note">You can keep working while it saves.</p>` });
  runProgress(document.querySelector("#save-progress"), steps, 1800, () => {
    closeDialog();
    toast(`Saved “${name}” · ${fmtMb(total)}`);
  });
}

/* ---------- Open and the consent screen ---------- */

function openOpen() {
  const files = DEMO_FILES.map(
    (f, i) => `<li class="file" data-file="${i}" tabindex="0"><span class="file-ico">${icon("section")}</span>
      <span class="sys-name"><b>${f.file}</b><small>${f.instruments.length} instruments · ${f.plugins.length} plugin${f.plugins.length === 1 ? "" : "s"} · saved ${f.saved}</small></span><span class="sys-size">${fmtMb(f.mb)}</span></li>`,
  );
  sysDialog({
    title: "Open song",
    body: `<p class="sys-lead">Pick a song file. Nothing runs until you have seen what it contains.</p>
      <ul class="sys-list files">${files.join("")}</ul>
      <div class="drop" data-sys="pick">${icon("open")}<span><b>Choose a file from your computer…</b><small>or drop a .meloxia file here</small></span></div>`,
    buttons: [CANCEL],
  });
}

let consent = null; // { title, instruments, plugins: [{ id, uses, on }], choosing, onAccept }

function showConsent(c) {
  consent = { choosing: false, ...c, plugins: c.plugins.map((p) => ({ ...p, on: true })) };
  renderConsent();
}

function renderConsent() {
  const c = consent;
  const add = c.instruments.filter((i) => !i.have), have = c.instruments.filter((i) => i.have);
  const instHtml = c.instruments.length
    ? `<h4 class="sys-h">Instruments</h4><ul class="sys-list">
      ${add.map((i) => sizeRow(i.name, `Will be added to your library${i.note ? ` · ${i.note}` : ""}`, fmtMb(i.mb), 'class="inst new"')).join("")}
      ${have.map((i) => sizeRow(i.name, "Already in your library", fmtMb(i.mb), 'class="inst have"')).join("")}</ul>`
    : "";
  const plugHtml = c.plugins
    .map(
      (p) => `<li class="plug-card${c.choosing && !p.on ? " off" : ""}" data-plug="${p.id}">
        ${pluginHead(p.id, c.choosing ? sw(p.on, `data-sys="consent-one" data-id="${p.id}"`, `Use ${PLUGIN_TYPES[p.id].name}`) : "")}
        ${p.uses ? `<p class="plug-uses">Used in this song by ${p.uses}</p>` : ""}${declHtml(p.id)}</li>`,
    )
    .join("");
  const chosen = c.plugins.filter((p) => p.on).length;
  const none = ["Open without plugins", "consent-none", "", "Opens the song with no plugins. What they add stays in the song, shown as inactive."];
  const buttons = c.install
    ? [["Cancel", "consent-none", "", "Leaves this plugin uninstalled."], ["Install plugin", "consent-all", "primary", "Installs the plugin and switches it on."]]
    : c.plugins.length
    ? c.choosing
      ? [none, [`Open with ${chosen} of ${c.plugins.length} plugins`, "consent-chosen", "primary", "Opens the song with only the plugins switched on above."]]
      : [none, ["Choose per plugin", "consent-choose", "", "Picks which of these plugins to turn on."], ["Accept all and open", "consent-all", "primary", "Opens the song and turns on every plugin it uses."]]
    : [CANCEL, ["Open", "consent-all", "primary", "Opens the song."]];
  sysDialog({
    title: c.title,
    wide: true,
    body: `${c.lead ? `<p class="sys-lead">${c.lead}</p>` : ""}${instHtml}${
      c.plugins.length ? `<h4 class="sys-h">Plugins${c.verb ? ` ${c.verb}` : " this song uses"}</h4><ul class="plug-list">${plugHtml}</ul>` : ""
    }`,
    buttons,
  });
}

function consentDone(which) {
  const c = consent;
  const used = which === "all" ? c.plugins : which === "none" ? [] : c.plugins.filter((p) => p.on);
  const left = c.plugins.filter((p) => !used.includes(p));
  closeDialog();
  consent = null;
  c.onAccept(used.map((p) => p.id), left);
}

function openFile(i) {
  const f = DEMO_FILES[i];
  const added = f.instruments.filter((x) => !x.have).length;
  showConsent({
    title: `Open “${f.file.replace(".meloxia", "")}”`,
    lead: `${fmtMb(f.mb)} · ${f.instruments.length} instruments · ${f.plugins.length} plugin${f.plugins.length === 1 ? "" : "s"}`,
    instruments: f.instruments,
    plugins: f.plugins,
    onAccept: (ids, left) => {
      const parts = [added ? `${added} instrument${added === 1 ? "" : "s"} added to your library` : "nothing new for your library"];
      if (left.length) parts.push(`${left.map((p) => p.uses).join(", ")} inactive (plugin${left.length === 1 ? "" : "s"} not used)`);
      toast(`Opened “${f.file.replace(".meloxia", "")}” · ${parts.join(" · ")}`);
    },
  });
}

/* ---------- Export ---------- */

const exp = { fmt: "mp3", wav: "16", mp3: "320", scope: "song", minutes: 3, fade: true, roll: "same" };
const MB_PER_MIN = { "wav.16": 10.1, "wav.24": 15.1, "mp3.192": 1.44, "mp3.320": 2.4 };

function exportSeconds() {
  if (exp.scope === "section") {
    const s = systemHooks.openSection();
    return (s.bars * 4 * 60) / (state.bpm ?? 118);
  }
  return systemHooks.songIsEndless() ? exp.minutes * 60 : systemHooks.songSeconds?.() ?? CURRENT_SONG.lengthSec;
}

function exportBody() {
  const endless = systemHooks.songIsEndless() && exp.scope === "song";
  const sec = systemHooks.openSection();
  const size = (MB_PER_MIN[`${exp.fmt}.${exp[exp.fmt]}`] * exportSeconds()) / 60;
  const quality =
    exp.fmt === "wav"
      ? seg("wav", exp.wav, [["16", "CD quality"], ["24", "Studio"]])
      : seg("mp3", exp.mp3, [["192", "Smaller file<small>192 kbps</small>"], ["320", "Better sound<small>320 kbps</small>"]]);
  return `
    <div class="sys-ctl"><span class="sys-label">Format</span>${seg("fmt", exp.fmt, [["wav", "WAV"], ["mp3", "MP3"]])}
      <small>${exp.fmt === "wav" ? "Full quality, large files. Best for further editing." : "Small files that play everywhere."}</small></div>
    <div class="sys-ctl"><span class="sys-label">Quality</span>${quality}</div>
    <div class="sys-ctl"><span class="sys-label">What to export</span>${seg("scope", exp.scope, [["song", "Whole song"], ["section", `This section · ${sec.name}`]])}</div>
    ${
      endless
        ? `<div class="sys-ctl endless"><span class="sys-label">Length</span>
        <span class="sys-inline"><input type="number" id="exp-min" min="1" max="60" value="${exp.minutes}" aria-label="Length in minutes" /> minutes
        <span class="sys-sw">${sw(exp.fade, 'data-sys="exp-fade"', "Fade out at the end")} Fade out at the end</span></span>
        <small>This song has a loop with no way out, so it would play forever. Choose how long the file should be.</small></div>`
        : ""
    }
    <div class="sys-ctl"><span class="sys-label">Chance</span>${seg("roll", exp.roll, [["same", "Same as last play"], ["new", "New roll"]])}
      <small>${exp.roll === "same" ? "Paths and notes left to chance come out as they did when you last pressed Play." : "Chance is rolled again, so this file may differ from what you heard."}</small></div>
    <p class="sys-total"><span>Length ${clockTime(exportSeconds())}</span><b>about ${fmtMb(size)}</b></p>
    <div id="exp-progress"></div>`;
}

const openExport = () =>
  sysDialog({ title: "Export audio", body: exportBody(), buttons: [CANCEL, ["Export", "exp-go", "primary", "Makes the audio file. It runs faster than real time."]] });
const refreshExport = () => setDialogBody(exportBody());

function exportGo() {
  const name = `${exp.scope === "section" ? `${CURRENT_SONG.name} - ${systemHooks.openSection().name}` : CURRENT_SONG.name}.${exp.fmt}`;
  const size = (MB_PER_MIN[`${exp.fmt}.${exp[exp.fmt]}`] * exportSeconds()) / 60;
  sysDialog({ title: "Exporting…", body: `<p class="sys-lead">${esc(name)}</p><div id="exp-progress"></div><p class="sys-note">Rendering runs faster than real time; you can keep working.</p>` });
  runProgress(document.querySelector("#exp-progress"), ["Playing the song into the file", "Playing the song into the file", exp.fmt === "mp3" ? "Encoding MP3" : "Writing WAV"], 2000, () => {
    closeDialog();
    toast(`Exported “${name}” · ${fmtMb(size)}`);
  });
}

/* ---------- wiring ---------- */

const CANCEL = ["Cancel", "close", "", "Closes without doing anything."];

function sysRun(act, t) {
  const acts = {
    close: closeDialog,
    "save-go": saveGo,
    pick: () => openFile(1),
    "consent-all": () => consentDone("all"),
    "consent-none": () => consentDone("none"),
    "consent-chosen": () => consentDone("chosen"),
    "consent-choose": () => { consent.choosing = true; renderConsent(); },
    "consent-one": () => { const p = consent.plugins.find((x) => x.id === t.dataset.id); p.on = !p.on; renderConsent(); },
    "exp-go": exportGo,
    "exp-fade": () => { exp.fade = !exp.fade; refreshExport(); },
  };
  (acts[act] ?? (() => systemAct(act, t)))();
}

document.addEventListener("click", (e) => {
  const t = e.target.closest(".dialog.sys :is([data-sys], [data-file], [data-set][data-v])");
  if (!t) return;
  if (t.dataset.set) {
    if (t.dataset.set in exp) {
      exp[t.dataset.set] = t.dataset.v;
      refreshExport();
    } else systemSeg(t.dataset.set, t.dataset.v);
    return;
  }
  if (t.dataset.file) return openFile(Number(t.dataset.file));
  sysRun(t.dataset.sys, t);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches?.(".dialog.sys [data-file]")) openFile(Number(e.target.dataset.file));
});
document.addEventListener("change", (e) => {
  if (e.target.id === "exp-min") { exp.minutes = clamp(1, Number(e.target.value) || 1, 60); refreshExport(); }
});
document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || dialogOpen()) return;
  const run = { s: openSave, o: openOpen, e: openExport }[e.key.toLowerCase()];
  if (run) { e.preventDefault(); run(); }
});

// Old-style tip entries ({ name, text, key } or a function of the element returning one) in tips.js's format.
const sysTips = (list) =>
  addTips(list.map(([sel, t]) => (typeof t === "function" ? [sel, (el) => t(el)?.name, (el) => t(el)?.text, (el) => t(el)?.key] : [sel, t.name, t.text, t.key])));

// tips.js and app.js load after this file: register once every script has run.
document.addEventListener("DOMContentLoaded", () => {
  addMenuItem({ group: "song", label: "Save…", icon: "save", key: "Ctrl+S", action: openSave, tip: "Saves the song as one file with every sound and plugin it needs." });
  addMenuItem({ group: "song", label: "Open…", icon: "open", key: "Ctrl+O", action: openOpen, tip: "Opens a song file. You see what it contains before anything runs." });
  addMenuItem({ group: "song", label: "Export audio…", icon: "wave", key: "Ctrl+E", action: openExport, tip: "Turns the song or this section into a WAV or MP3 file." });
  sysTips([
    ["#save-name", { name: "File name", text: "What the saved file is called on your computer." }],
    ["[data-file]", (el) => ({ name: DEMO_FILES[el.dataset.file].file, text: "Opens this song. You see what it contains first." })],
    ["[data-sys='pick']", { name: "Choose a file", text: "Picks a .meloxia file from your computer. You can also drop one here." }],
    ["[data-sys='consent-one']", { name: "Use this plugin", text: "Lets this plugin run with the song." }],
    [".decl", { name: "Author's description", text: "What the plugin's author says it does. Meloxia cannot check this." }],
    [".decl [data-perm='suggest-key']", { name: "Suggestions key", text: "This plugin can use the key you set for note suggestions, which is charged to your account with that provider." }],
    ["[data-set='fmt']", (el) => ({ name: el.textContent, text: el.dataset.v === "wav" ? "Uncompressed audio: full quality, about 10 MB a minute." : "Compressed audio: small files that play everywhere." })],
    ["[data-set='wav']", (el) => ({ name: el.textContent, text: el.dataset.v === "16" ? "16-bit, the quality of a CD." : "24-bit, extra headroom for editing elsewhere." })],
    ["[data-set='mp3']", (el) => ({ name: el.firstChild.textContent, text: el.dataset.v === "192" ? "192 kbps: a smaller file that still sounds good." : "320 kbps: the best MP3 sound, in a larger file." })],
    ["[data-set='scope']", (el) => ({ name: el.textContent, text: el.dataset.v === "song" ? "The song from Start, following its paths." : "Only the section open in the editor, once through." })],
    ["#exp-min", { name: "Length", text: "How many minutes of the endless song to put in the file." }],
    ["[data-sys='exp-fade']", { name: "Fade out at the end", text: "Fades the sound away over the last few seconds instead of stopping." }],
    ["[data-set='roll']", (el) => ({ name: el.textContent, text: el.dataset.v === "same" ? "Chance comes out exactly as in your last play." : "Rolls chance again for a fresh version." })],
  ]);
});
