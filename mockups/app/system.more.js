"use strict";
// System screens, part 2: Plugins, Credits, Preferences. (MIDI controllers belong to worker2's midi.* files.)
// Uses the shared bits of system.js (sw, seg, btn, sysDialog, declHtml, pluginHead, showConsent, sysTips).

/* ---------- Plugins ---------- */

let removed = null; // { entry, index } for Undo

function pluginsBody() {
  const rows = INSTALLED.map(
    (e) => `<li class="plug-card${e.on ? "" : " off"}" data-plug="${e.id}">
      ${pluginHead(e.id, sw(e.on, `data-sys="plug-toggle" data-id="${e.id}"`, `Turn ${PLUGIN_TYPES[e.id].name} on or off`))}
      <div class="plug-actions">${btn(e.open ? "Hide description" : "What it says it does", `data-sys="plug-decl" data-id="${e.id}"`, "small")}${btn(`${icon("trash")}Remove`, `data-sys="plug-remove" data-id="${e.id}"`, "small danger")}</div>
      ${e.open ? declHtml(e.id) : ""}</li>`,
  );
  return `<p class="sys-lead">Plugins add things to Synthia: note helpers, looks, new canvas blocks, effects. They can reach everything in the app, so only install plugins you trust.</p>
    <ul class="plug-list">${rows.join("") || `<li class="sys-empty">No plugins installed.</li>`}</ul>
    <div class="drop" data-sys="plug-add">${icon("plus")}<span><b>Add plugin…</b><small>Choose a plugin file from your computer</small></span></div>
    <div class="sys-callout"><b>If a plugin breaks Synthia</b><span>Start with all plugins off: hold Shift while the page loads, or add <code>?plugins=off</code> to the address. Then switch plugins back on one by one.</span>
      ${btn("Restart with all plugins off", 'data-sys="plug-safe"', "small")}</div>`;
}
const DONE = ["Done", "close", "primary", "Closes this window."];
const openPlugins = () => sysDialog({ title: "Plugins", wide: true, body: pluginsBody(), buttons: [DONE] });

function addPlugin() {
  const id = PLUGIN_TO_ADD;
  if (INSTALLED.some((e) => e.id === id)) return toast(`${PLUGIN_TYPES[id].name} is already installed`);
  showConsent({
    title: "Add plugin",
    lead: `tape-warmth.synthiaplugin · ${fmtKb(PLUGIN_TYPES[id].kb)}`,
    instruments: [],
    plugins: [{ id }],
    install: true,
    onAccept: (ids) => {
      if (!ids.length) return openPlugins();
      INSTALLED.push({ id, on: true });
      openPlugins();
      toast(`Installed ${PLUGIN_TYPES[id].name}`);
    },
  });
}

/* ---------- Credits ---------- */

function openCredits() {
  const groups = new Map();
  for (const i of STARTER) {
    const k = `${i.credit}|${i.licence}`;
    groups.set(k, [...(groups.get(k) ?? []), i.name]);
  }
  const sounds = [...groups].map(([k, names]) => {
    const [credit, licence] = k.split("|");
    return `<li><b>${credit}</b><span class="lic">${licence}</span><small>${names.join(", ")}</small></li>`;
  });
  const codes = [...new Set([...STARTER, ...SOFTWARE_CREDITS].map((x) => x.licence))];
  const legend = codes.map((c) => `<li><span class="lic">${c}</span><small>${LICENCE_WHAT[c]}</small></li>`).join("");
  const software = SOFTWARE_CREDITS.map((s) => `<li><b>${s.link ? `<a href="${s.link}" target="_blank" rel="noopener">${s.name}</a>` : s.name}</b><span class="lic">${s.licence}</span><small>${s.what}</small></li>`);
  sysDialog({
    title: "Credits",
    wide: true,
    body: `<p class="sys-lead">The starter instruments are free recordings made and shared by these people and projects.</p>
      <ul class="credits">${sounds.join("")}</ul>
      <h4 class="sys-h">Software</h4><ul class="credits">${software.join("")}</ul>
      <h4 class="sys-h">What the licences ask</h4><ul class="credits lic-legend">${legend}</ul>
      <p class="sys-note">Instruments you import carry their own credit lines, shown in each instrument's panel.</p>`,
    buttons: [DONE],
  });
}

/* ---------- Preferences ---------- */

const prefs = { savedAt: performance.now() - 8000 };
/** The same figures as the Library's footer: downloaded instruments, then imports, then songs. */
const storageParts = () => [
  { label: "Downloaded instruments", mb: LIBRARY.filter((it) => it.here && !it.imported).reduce((a, it) => a + it.mb, 0) },
  { label: "My imports", mb: LIBRARY.filter((it) => it.imported).reduce((a, it) => a + it.mb, 0) },
  STORAGE.songs,
];
let prefsTimer = 0;
function prefsBody() {
  const look = currentLook();
  const quiet = !explainOn();
  const parts = storageParts();
  const used = parts.reduce((a, p) => a + p.mb, 0);
  const ago = Math.round((performance.now() - prefs.savedAt) / 1000);
  const bars = parts.map((p, i) => `<i class="p${i}" style="flex:${p.mb}"></i>`).join("");
  return `
    <div class="sys-ctl"><span class="sys-label">Look</span>${seg("look", look, [["graphite", "Graphite"], ["midnight", "Midnight"], ["paper", "Paper"]])}</div>
    <div class="sys-ctl row"><span class="sys-label">Show explanations</span>${sw(!quiet, 'data-sys="pref-explain"')}
      <small>The one-line help under settings. Tooltips stay either way.</small></div>
    <h4 class="sys-h">Autosave</h4>
    <p class="sys-note"><i class="sys-dot"></i><b id="pref-ago">Saved in this browser ${ago < 60 ? `${ago} seconds` : `${Math.round(ago / 60)} minutes`} ago</b>. Autosave keeps your work if the tab closes. It is not a backup: use Save to keep a copy as a file.</p>
    <h4 class="sys-h">Storage</h4>
    <div class="store"><div class="store-bar">${bars}</div>
      <ul>${parts.map((p, i) => `<li><i class="p${i}"></i>${p.label}<span>${p.mb ? fmtMb(p.mb) : "nothing yet"}</span></li>`).join("")}</ul>
      <p class="sys-note">${fmtMb(used)} used · ${STORAGE.freeGb} GB still available on this computer.</p>
      <p class="sys-note">${STORAGE.protected ? `<b>Protected from clearing.</b> The browser agreed to keep Synthia's data even when space runs low.` : `<b>Not protected.</b> The browser may clear Synthia's data when space runs low. Save your songs as files.`}</p></div>`;
}
function openPrefs() {
  sysDialog({ title: "Preferences", body: prefsBody(), buttons: [DONE], close: () => clearInterval(prefsTimer) });
  clearInterval(prefsTimer);
  prefsTimer = setInterval(() => {
    const el = document.querySelector("#pref-ago");
    if (!el) return clearInterval(prefsTimer);
    const ago = Math.round((performance.now() - prefs.savedAt) / 1000);
    el.textContent = `Saved in this browser ${ago < 60 ? `${ago} seconds` : `${Math.round(ago / 60)} minutes`} ago`;
  }, 1000);
}
const reopenPrefs = () => setDialogBody(prefsBody());

/* ---------- wiring (called from system.js's click handler) ---------- */

function systemSeg(name, value) {
  if (name === "look") { setLook(value); reopenPrefs(); }
}

function systemAct(act, t) {
  const id = t.dataset.id, entry = INSTALLED.find((e) => e.id === id);
  const acts = {
    "plug-toggle": () => {
      entry.on = !entry.on;
      openPlugins();
      toast(entry.on ? `${PLUGIN_TYPES[id].name} is on` : `${PLUGIN_TYPES[id].name} is off · what it added stays in your songs, shown as inactive`);
    },
    "plug-decl": () => { entry.open = !entry.open; openPlugins(); },
    "plug-remove": () => {
      const index = INSTALLED.indexOf(entry);
      removed = { entry, index };
      INSTALLED.splice(index, 1);
      openPlugins();
      toast(`Removed ${PLUGIN_TYPES[id].name}`, { action: "Undo", onAction: () => { INSTALLED.splice(removed.index, 0, removed.entry); openPlugins(); } });
    },
    "plug-add": addPlugin,
    "plug-safe": () => toast("In the app, Synthia reloads now with every plugin switched off"),
    "pref-explain": () => { setExplain(!explainOn()); reopenPrefs(); },
  };
  acts[act]?.();
}

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "," && !dialogOpen()) { e.preventDefault(); openPrefs(); }
});

document.addEventListener("DOMContentLoaded", () => {
  addMenuItem({ group: "app", label: "Plugins…", icon: "plug", action: openPlugins, tip: "Shows your plugins to switch off, remove or add." });
  addMenuItem({ group: "app", label: "Preferences…", icon: "sliders", key: "Ctrl+,", action: openPrefs, tip: "Sets the look and explanations, and shows autosave and storage." });
  addMenuItem({ group: "app", label: "Credits", icon: "heart", action: openCredits, tip: "Shows who made the sounds and the software Synthia uses." });
  sysTips([
    ["[data-sys='plug-toggle']", { name: "On or off", text: "Switches this plugin off without removing it. What it added stays in your songs." }],
    ["[data-sys='plug-decl']", { name: "What it says it does", text: "The plugin author's own description of what it uses." }],
    ["[data-sys='plug-remove']", { name: "Remove", text: "Removes this plugin. You can undo right after." }],
    ["[data-sys='plug-add']", { name: "Add plugin", text: "Installs a plugin from a file. You see what it says it does first." }],
    ["[data-sys='plug-safe']", { name: "Restart with all plugins off", text: "Reloads Synthia with every plugin switched off, to recover from a broken one." }],
    ["[data-set='look']", (el) => ({ name: el.textContent, text: "Changes how Synthia looks. Your choice is remembered." })],
    ["[data-sys='pref-explain']", { name: "Show explanations", text: "Shows or hides the one-line help under settings." }],
    [".store-bar", { name: "Storage used", text: "Space Synthia uses in this browser, by kind." }],
    [".credits .lic", (el) => ({ name: el.textContent, text: LICENCE_WHAT[el.textContent] ?? "The terms are in the author's licence." })],
  ]);
});
