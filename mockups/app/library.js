"use strict";
/*
 * Library (area B): a large dialog of instruments by family, with search, previews and pretend downloads.
 *
 *   openLibrary({ family?, onPick?(instrument), pickLabel? })
 *       onPick: the editor's "Browse library…" passes one; the card's main button then reads pickLabel ("Add to section")
 *       and a pick closes the dialog. Without it the library is for browsing and downloading.
 *   libAddImports(list)   adds instruments made by "Add instruments" under My imports (library.import.js calls it).
 *   LIBRARY / LIB_FAMILIES (library.data.js) are the demo data.
 *
 * Click a card to see its details, double-click to use or download it, right-click for its menu.
 */

const lib = { fam: "pianos", q: "", sel: "grand", loading: {}, playing: null, onPick: null, pickLabel: "", body: null };

const libItem = (id) => LIBRARY.find((it) => it.id === id);
const libMb = (n) => (n === 0 ? "built in" : n < 1 ? `${Math.round(n * 1000)} KB` : `${n % 1 ? n.toFixed(1) : n} MB`);
const libFamName = (key) => LIB_FAMILIES.find(([k]) => k === key)?.[1] ?? key;
const libHere = () => LIBRARY.filter((it) => it.here);

function libShown() {
  const q = lib.q.trim().toLowerCase();
  if (q) return LIBRARY.filter((it) => `${it.name} ${it.bank} ${libFamName(it.fam)} ${it.note}`.toLowerCase().includes(q));
  return LIBRARY.filter((it) => it.fam === lib.fam);
}

/* ---------- html ---------- */

function libFamsHtml() {
  return LIB_FAMILIES.map(([key, label]) => {
    const n = LIBRARY.filter((it) => it.fam === key).length;
    const on = !lib.q && key === lib.fam;
    return `<button class="lib-fam${on ? " on" : ""}${key === "imports" ? " gap" : ""}" data-fam="${key}"><span>${label}</span><small>${n || ""}</small></button>`;
  }).join("");
}

function libBadgesHtml(it) {
  const out = [];
  if (it.layers > 1) out.push(`<span class="lib-badge" data-badge="layers">${it.layers} layers</span>`);
  if (it.takes > 1) out.push(`<span class="lib-badge" data-badge="takes">${it.takes} takes</span>`);
  if (it.imported) out.push(`<span class="lib-badge own" data-badge="imported">Imported</span>`);
  return out.join("");
}

function libStateHtml(it) {
  const pct = lib.loading[it.id];
  if (pct != null)
    return `<div class="lib-progress" data-progress="${it.id}"><i style="width:${pct}%"></i><span>Downloading… ${Math.round(pct)}%</span></div>`;
  if (lib.onPick) return `<button class="btn small primary" data-lib="pick">${it.here ? lib.pickLabel : `Download and add`}</button>`;
  if (it.here) return `<span class="lib-here">${icon("check")}${it.builtin ? "Built in" : "On this device"}</span>`;
  return `<button class="btn small" data-lib="get">${icon("download")}Download · ${libMb(it.mb)}</button>`;
}

function libCardHtml(it) {
  return `<article class="lib-card${it.id === lib.sel ? " sel" : ""}${it.here ? " here" : ""}" data-id="${it.id}" tabindex="0">
    <header><b>${esc(it.name)}</b><small class="lib-size">${libMb(it.mb)}</small></header>
    <p class="lib-bank">${esc(it.bank)}${lib.q ? ` · ${libFamName(it.fam)}` : ""}</p>
    <div class="lib-badges">${libBadgesHtml(it)}</div>
    <footer>
      <button class="lib-preview${lib.playing === it.id ? " on" : ""}" data-lib="preview" aria-label="Preview ${esc(it.name)}">
        ${icon("play")}<span class="lib-bars"><i></i><i></i><i></i><i></i><i></i></span></button>
      <span class="lib-state">${libStateHtml(it)}</span>
    </footer>
  </article>`;
}

function libEmptyHtml() {
  if (lib.q) return `<div class="lib-empty"><b>Nothing called “${esc(lib.q)}”</b><p>Try a family on the left, or add your own sounds.</p>
    <button class="btn" data-lib="add">${icon("plus")}Add instruments…</button></div>`;
  if (lib.fam === "imports")
    return `<div class="lib-empty"><b>Nothing imported yet</b><p>Add sounds you found online: a folder or zip of sound files, a SoundFont or an SFZ instrument.
      They stay in this browser only.</p><button class="btn primary" data-lib="add">${icon("plus")}Add instruments…</button></div>`;
  if (lib.fam === "plugins")
    return `<div class="lib-empty"><b>No plugin instruments</b><p>Plugins can add instruments here. None of your plugins does yet.</p></div>`;
  return `<div class="lib-empty"><b>Empty</b></div>`;
}

function libDetailHtml() {
  const it = libItem(lib.sel);
  if (!it) return `<p class="lib-hint">Click an instrument to see where it comes from.</p>`;
  const layers = it.layers > 1 ? `<li><b>${it.layers} loudness layers</b>: recorded soft to hard, so a gentle note sounds gentle, not just quieter.</li>` : "";
  const takes = it.takes > 1 ? `<li><b>${it.takes} takes</b>: each note recorded ${it.takes} times, so repeated notes don't sound robotic.</li>` : "";
  return `<h3>${esc(it.name)}</h3><p class="lib-note">${esc(it.note)}</p>
    <dl>
      <dt>Family</dt><dd>${libFamName(it.fam)}</dd>
      <dt>Comes from</dt><dd>${esc(it.bank)}</dd>
      <dt>Size</dt><dd>${it.builtin ? "Built in, nothing to download" : libMb(it.mb)}</dd>
      <dt>Licence</dt><dd>${esc(it.licence)}</dd>
      ${it.credit ? `<dt>Credit</dt><dd class="lib-credit">${esc(it.credit)}</dd>` : ""}
    </dl>
    ${layers || takes ? `<ul class="lib-facts">${layers}${takes}</ul>` : ""}
    <div class="lib-actions">${libStateHtml(it)}
      ${it.here && !it.builtin && !lib.onPick ? `<button class="btn small subtle" data-lib="remove">${icon("trash")}Remove from this device</button>` : ""}</div>`;
}

function libFootHtml() {
  const used = libHere().reduce((sum, it) => sum + it.mb, 0); // imports are here too
  return `<span data-lib-foot>On this device: ${libHere().length} instruments, ${libMb(Math.round(used * 10) / 10)}</span>
    <span>Downloads happen in the background. You can keep working.</span>`;
}

function libBodyHtml() {
  return `<div class="lib">
    <nav class="lib-fams" aria-label="Families">${libFamsHtml()}</nav>
    <section class="lib-main">
      <div class="lib-top">
        <label class="lib-search">${icon("search")}<input type="search" placeholder="Search instruments" value="${esc(lib.q)}" aria-label="Search instruments" /></label>
        <button class="btn" data-lib="add">${icon("plus")}Add instruments…</button>
      </div>
      <h2 class="lib-title">${lib.q ? `Search results` : libFamName(lib.fam)}</h2>
      <div class="lib-grid">${libShown().map(libCardHtml).join("") || libEmptyHtml()}</div>
      <footer class="lib-foot">${libFootHtml()}</footer>
    </section>
    <aside class="lib-detail">${libDetailHtml()}</aside>
  </div>`;
}

/* ---------- partial redraws (the search field keeps its focus) ---------- */

function libDraw(parts = "fams grid detail foot") {
  const b = lib.body;
  if (!b?.isConnected) return;
  if (parts.includes("fams")) $(".lib-fams", b).innerHTML = libFamsHtml();
  if (parts.includes("grid")) {
    $(".lib-grid", b).innerHTML = libShown().map(libCardHtml).join("") || libEmptyHtml();
    $(".lib-title", b).textContent = lib.q ? "Search results" : libFamName(lib.fam);
  }
  if (parts.includes("detail")) $(".lib-detail", b).innerHTML = libDetailHtml();
  if (parts.includes("foot")) $(".lib-foot", b).innerHTML = libFootHtml();
}

/* ---------- actions ---------- */

function libPreview(id) {
  lib.playing = lib.playing === id ? null : id;
  libDraw("grid");
  clearTimeout(libPreview.timer);
  if (lib.playing) libPreview.timer = setTimeout(() => ((lib.playing = null), libDraw("grid")), 2600);
}

/** Pretend download at about 25 MB a second; never blocks: each tick only touches its own progress bar. */
function libDownload(id, then = null) {
  const it = libItem(id);
  if (!it || it.here || lib.loading[id] != null) return;
  lib.loading[id] = 0;
  libDraw("grid detail");
  const total = Math.max(900, (it.mb / 25) * 1000);
  const t0 = performance.now();
  const tick = () => {
    const pct = Math.min(100, ((performance.now() - t0) / total) * 100);
    lib.loading[id] = pct;
    for (const bar of $$(`[data-progress="${id}"]`)) {
      $("i", bar).style.width = `${pct}%`;
      $("span", bar).textContent = `Downloading… ${Math.round(pct)}%`;
    }
    if (pct < 100) return requestAnimationFrame(tick);
    delete lib.loading[id];
    it.here = true;
    libDraw("grid detail foot");
    toast(`${it.name} is ready`);
    then?.(it);
  };
  requestAnimationFrame(tick);
}

function libPick(id) {
  const it = libItem(id);
  const done = (picked) => {
    const pick = lib.onPick;
    if (!pick) return;
    closeDialog();
    pick(picked);
  };
  it.here ? done(it) : libDownload(id, done);
}

function libRemove(id) {
  const it = libItem(id);
  it.here = false;
  libDraw("grid detail foot");
  toast(`${it.name} removed from this device. It stays in the library to download again.`);
}

function libMenu(event, id) {
  const it = libItem(id);
  lib.sel = id;
  libDraw("grid detail");
  openMenu({ x: event.clientX, y: event.clientY }, [
    { heading: it.name },
    { label: "Preview", icon: "play", tip: "Plays a short demo of this instrument.", action: () => libPreview(id) },
    lib.onPick && { label: lib.pickLabel, icon: "plus", tip: "Adds this instrument to the section.", action: () => libPick(id) },
    !it.here && { label: `Download · ${libMb(it.mb)}`, icon: "download", tip: "Keeps it on this device so it works offline.", action: () => libDownload(id) },
    it.here && !it.builtin && { label: "Remove from this device", icon: "trash", tip: "Frees the space. It stays in the library.", action: () => libRemove(id) },
  ].filter(Boolean));
}

function libAddImports(list) {
  for (const item of list) LIBRARY.push({ fam: "imports", here: true, imported: true, ...item });
  lib.fam = "imports";
  lib.q = "";
  lib.sel = list[0]?.id ?? lib.sel;
  const search = lib.body && $(".lib-search input", lib.body);
  if (search) search.value = "";
  libDraw();
}

/* ---------- open and wire ---------- */

function openLibrary({ family = null, onPick = null, pickLabel = "Add to section" } = {}) {
  Object.assign(lib, { onPick, pickLabel, q: "", playing: null });
  if (family) lib.fam = family;
  if (libItem(lib.sel)?.fam !== lib.fam) lib.sel = LIBRARY.find((it) => it.fam === lib.fam)?.id ?? null;
  // enter: false, because Enter in the search picks the highlighted card instead of pressing Done.
  lib.body = openDialog({ title: onPick ? "Choose an instrument" : "Library", body: libBodyHtml(), size: "large", className: "lib-dialog",
    buttons: [{ label: "Done", primary: true, tip: onPick ? "Closes the library without choosing an instrument." : "Closes the library. Downloads carry on." }],
    enter: false, onClose: () => (lib.body = null) });
  const b = lib.body;
  b.addEventListener("click", (event) => {
    const fam = event.target.closest("[data-fam]");
    if (fam) {
      Object.assign(lib, { fam: fam.dataset.fam, q: "" });
      $(".lib-search input", b).value = "";
      lib.sel = LIBRARY.find((it) => it.fam === lib.fam)?.id ?? null;
      return libDraw();
    }
    const act = event.target.closest("[data-lib]")?.dataset.lib;
    const id = event.target.closest("[data-id]")?.dataset.id ?? lib.sel;
    if (act === "add") return openAddInstruments();
    if (act === "preview") return libPreview(id);
    if (act === "get") return libDownload(id);
    if (act === "pick") return libPick(id);
    if (act === "remove") return libRemove(id);
    const card = event.target.closest(".lib-card");
    if (card && card.dataset.id !== lib.sel) ((lib.sel = card.dataset.id), libDraw("grid detail"));
  });
  b.addEventListener("dblclick", (event) => {
    const card = event.target.closest(".lib-card");
    if (!card || event.target.closest("button")) return;
    lib.onPick ? libPick(card.dataset.id) : libDownload(card.dataset.id);
  });
  b.addEventListener("contextmenu", (event) => {
    const card = event.target.closest(".lib-card");
    if (!card) return;
    event.preventDefault();
    libMenu(event, card.dataset.id);
  });
  b.addEventListener("keydown", (event) => {
    const card = event.target.closest(".lib-card");
    if (card && event.key === "Enter") lib.onPick ? libPick(card.dataset.id) : libDownload(card.dataset.id);
  });
  $(".lib-search input", b).addEventListener("input", (event) => {
    lib.q = event.target.value;
    const shown = libShown();
    if (shown.length && !shown.some((it) => it.id === lib.sel)) lib.sel = shown[0].id; // the highlight follows the results
    libDraw("fams grid detail");
  });
  // In the search: arrows move the highlight, Enter picks it (pick mode only). Enter never closes the library.
  $(".lib-search input", b).addEventListener("keydown", (event) => {
    const shown = libShown();
    const at = shown.findIndex((it) => it.id === lib.sel);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = shown[clamp(0, at + (event.key === "ArrowDown" ? 1 : -1), shown.length - 1)];
      if (!next) return;
      lib.sel = next.id;
      libDraw("grid detail");
      $(`.lib-card[data-id="${next.id}"]`, b)?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (lib.onPick && at >= 0) libPick(lib.sel);
    }
  });
  $(".lib-search input", b).focus({ preventScroll: true });
}

/* ---------- tooltips ---------- */

addTips([
  [".lib-fam", (el) => $("span", el).textContent, (el) =>
    el.dataset.fam === "imports" ? "Instruments you added yourself. They stay in this browser only."
    : el.dataset.fam === "plugins" ? "Instruments that your plugins add." : "Shows the instruments of this family."],
  [".lib-search input", "Search", () => `Finds instruments by name, family or where they come from, in every family at once. Up and Down move the highlight${lib.onPick ? "; Enter picks it" : ""}.`, () => (lib.onPick ? "Enter" : "")],
  ['[data-lib="add"]', "Add instruments", "Brings in sounds you found online: a folder or zip of sound files, a SoundFont or an SFZ instrument."],
  [".lib-card", (el) => libItem(el.dataset.id)?.name ?? "Instrument", "Click shows where it comes from, double-click uses it, right-click shows more."],
  [".lib-preview", "Preview", "Plays a short demo of this instrument, without downloading all of it."],
  ['[data-lib="get"]', "Download", "Keeps this instrument on this device, so it loads at once and works offline. It downloads in the background."],
  ['[data-lib="pick"]', (el) => el.textContent.trim(), "Puts this instrument in a new row of the section. Downloads it first if needed."],
  ['[data-lib="remove"]', "Remove from this device", "Frees the space. The instrument stays in the library, ready to download again."],
  ['[data-badge="layers"]', "Loudness layers", "Recorded at several strengths, so soft notes sound soft and hard notes sound hard, not just quieter or louder."],
  ['[data-badge="takes"]', "Takes", "Each note was recorded more than once; Meloxia takes turns between them so repeated notes sound natural."],
  ['[data-badge="imported"]', "Imported", "You added this instrument. It lives in this browser only."],
  [".lib-size", "Size", "How much space the instrument takes once downloaded."],
]);

// app.js (the menu) loads after this file: register once every script has run.
document.addEventListener("DOMContentLoaded", () => {
  addMenuItem({ group: "sounds", label: "Library…", icon: "keys", action: () => openLibrary(), tip: "Shows every instrument to preview and download for your songs." });
  addMenuItem({ group: "sounds", label: "Add instruments…", icon: "plus", action: openAddInstruments, tip: "Brings in sounds you found online: sound files, a zip, a SoundFont or an SFZ instrument." });
});
