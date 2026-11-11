"use strict";
/*
 * Add instruments (area B): bring in packs found online, kept in this browser only and stored as the original files.
 *
 *   openAddInstruments()   a large dialog: drop zone → what was found (or a mapping preview for loose files, or how to
 *                          convert a locked format) → progress → the result under "My imports" in the library.
 * Real drops and file pickers are read by name only (nothing is decoded in the mockup); the "pretend" buttons use
 * IMP_DEMO_DROPS from library.data.js. Imports carry on in the background if the dialog is closed.
 */

const imp = { step: "drop", pack: null, picks: [], rows: [], kind: "notes", name: "", jobs: [] };
const IMP_LOCKED_EXT = /\.(nki|nkx|nkm|ncw|gig|sfark|adg|adv|exs)$/i;
const IMP_AUDIO_EXT = /\.(wav|flac|aif|aiff|ogg|mp3|m4a)$/i;
const IMP_FORMAT_NAMES = { sf2: "SoundFont", sfz: "SFZ instrument", loose: "Separate sound files", drums: "Separate sound files" };

/* ---------- detect what was dropped ---------- */

function impPackFromNames(names, zipName = null) {
  const locked = names.find((n) => IMP_LOCKED_EXT.test(n));
  if (locked) return { key: "nki", file: locked, locked: true };
  const font = names.find((n) => /\.(sf2|sf3|dls)$/i.test(n));
  if (font) return { ...IMP_DEMO_DROPS.find((d) => d.key === "sf2"), file: font, pretendFound: true };
  const sfz = names.find((n) => /\.sfz$/i.test(n));
  if (sfz) return { ...IMP_DEMO_DROPS.find((d) => d.key === "sfz"), file: sfz, pretendFound: true };
  if (zipName) return { ...IMP_DEMO_DROPS.find((d) => d.key === "drums"), zip: zipName, name: zipName.replace(/\.zip$/i, ""), pretendFound: true };
  const audio = names.filter((n) => IMP_AUDIO_EXT.test(n));
  if (audio.length) return { key: "loose", name: "My instrument", files: audio.slice(0, 40) };
  return { key: "none", file: names[0] ?? "these files" };
}

function impStartPack(pack) {
  imp.pack = pack;
  if (pack.locked) return impStep("locked");
  if (pack.key === "none") return impStep("none");
  if (pack.files) {
    const guesses = pack.files.map((f) => impGuessFile(f.split("/").pop()));
    imp.kind = impLooksLikeDrums(guesses) ? "drums" : "notes";
    imp.rows = guesses.map((g) => ({ ...g, drum: g.drum ?? "skip" }));
    imp.name = pack.name;
    return impStep("map");
  }
  imp.picks = pack.found.map(() => true);
  impStep("found");
}

/* ---------- html per step ---------- */

const impFmtList = (title, list, cls) => `<div class="imp-fmt ${cls}"><b>${title}</b><ul>${list.map((f) => `<li>${f}</li>`).join("")}</ul></div>`;

function impDropHtml() {
  return `<div class="imp-drop" tabindex="0">
      ${icon("folder")}<b>Drop a folder, a zip, or a .sf2, .sf3 or .sfz file here</b>
      <p>Synthia reads what's inside, shows you what it found, and keeps it in this browser. Nothing is uploaded.</p>
      <div class="imp-pick">
        <label class="btn">${icon("file")}Choose files…<input type="file" multiple hidden data-imp="files" accept=".sf2,.sf3,.dls,.sfz,.zip,audio/*" /></label>
        <label class="btn">${icon("folder")}Choose a folder…<input type="file" hidden data-imp="folder" webkitdirectory /></label>
      </div>
    </div>
    <div class="imp-demo"><span>No pack at hand? Pretend to drop:</span>
      ${IMP_DEMO_DROPS.map((d) => `<button class="btn small subtle" data-demo="${d.key}">${d.label}</button>`).join("")}</div>
    <div class="imp-fmts">
      ${impFmtList("Works now", IMP_IMPORT_FORMATS.now, "now")}
      ${impFmtList("Coming next", IMP_IMPORT_FORMATS.next, "next")}
      ${impFmtList("Convert first", IMP_IMPORT_FORMATS.convert, "convert")}
    </div>
    <p class="imp-foot">Imported instruments are kept exactly as you dropped them, untouched, in this browser's storage.
      Your browser lets Synthia use up to about 60% of free disk space.</p>`;
}

function impFoundHtml() {
  const p = imp.pack;
  return `<div class="imp-head">${icon("file")}<div><b>${esc(p.file)}</b><small>${IMP_FORMAT_NAMES[p.key]} · ${p.mb} MB${
    p.pretendFound ? " · contents pretended for this mockup" : ""}</small></div>${chipHtml(IMP_FORMAT_NAMES[p.key], "tag")}</div>
    <h3>Found ${p.found.length} instrument${p.found.length > 1 ? "s" : ""}. Which ones do you want?</h3>
    <div class="imp-found">${p.found.map(([name, sounds, layers], i) => `<label class="imp-inst">
      <input type="checkbox" data-pick="${i}" ${imp.picks[i] ? "checked" : ""} /><b>${esc(name)}</b>
      <small>${sounds} sounds · ${layers} loudness layers</small></label>`).join("")}</div>
    <p class="imp-lost"><b>What carries over:</b> ${p.lost}</p>`;
}

function impNoteOptions(current) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const all = [];
  for (let o = 1; o <= 6; o++) for (const n of names) all.push(`${n}${o}`);
  return `<option value="">Pick a note</option>${all.map((n) => `<option ${n === current ? "selected" : ""}>${n}</option>`).join("")}`;
}

function impMapRowHtml(row, i) {
  const unsure = imp.kind === "notes" ? !row.note : row.drum === "skip";
  const cell = imp.kind === "notes"
    ? `<select data-map="note" data-i="${i}">${impNoteOptions(row.note)}</select>
       <select data-map="level" data-i="${i}">${["Any", "Soft", "Medium", "Hard"].map((l, k) =>
         `<option value="${k}" ${k === row.level ? "selected" : ""}>${l}</option>`).join("")}</select>`
    : `<select data-map="drum" data-i="${i}">${IMP_DRUM_ROWS.map(([k, l]) => `<option value="${k}" ${k === row.drum ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  return `<tr class="${unsure ? "unsure" : ""}"><td class="imp-file">${esc(row.name)}</td><td>${cell}</td>
    <td class="imp-guess">${unsure ? "Couldn't tell: pick one" : "Guessed from the name"}</td></tr>`;
}

function impMapHtml() {
  const p = imp.pack;
  const unsure = imp.rows.filter((r) => (imp.kind === "notes" ? !r.note : r.drum === "skip")).length;
  return `<div class="imp-head">${icon(p.zip ? "file" : "folder")}<div><b>${esc(p.zip ?? p.name)}</b>
      <small>${imp.rows.length} sound files, with nothing saying which note each one plays</small></div>${chipHtml("Separate sound files", "tag")}</div>
    <div class="imp-map-top">
      <label class="imp-name">Name <input type="text" value="${esc(imp.name)}" data-imp="name" aria-label="Instrument name" /></label>
      <div class="imp-kind"><span>These sounds are</span>${segHtml("imp-kind", ["notes", "drums"], imp.kind, () => false,
        (v) => (v === "notes" ? "One instrument, by note" : "A drum kit, one sound each"))}</div>
    </div>
    <p class="imp-sub">${imp.kind === "notes"
      ? "Synthia guessed each file's note and loudness from its name. Fix any guess; notes in between are filled by stretching the nearest sound."
      : "Synthia guessed which drum each file is from its name. Each one becomes a drum row; pick “Leave out” to skip a file."}
      ${unsure ? `<b class="imp-warn">${unsure} to check</b>` : ""}</p>
    <div class="imp-table"><table><thead><tr><th>File</th><th>${imp.kind === "notes" ? "Note · Loudness" : "Drum row"}</th><th></th></tr></thead>
      <tbody>${imp.rows.map(impMapRowHtml).join("")}</tbody></table></div>`;
}

function impLockedHtml() {
  return `<div class="imp-locked">${icon("lock")}
    <h3>${esc(imp.pack.file)} can't be opened in a browser</h3>
    <p>Kontakt, GigaStudio and sfArk keep their sounds in closed formats, often encrypted, so no browser app can read them.
      Converting them first usually works:</p>
    <ol><li>Install the free <b>ConvertWithMoss</b> on your computer (it reads about 60 formats).</li>
      <li>Convert the library to <b>SFZ</b> or <b>SoundFont</b>. Encrypted libraries can't be converted at all.</li>
      <li>Drop the converted folder here.</li></ol></div>`;
}

const impNoneHtml = () => `<div class="imp-locked">${icon("file")}<h3>No instruments found in ${esc(imp.pack.file)}</h3>
  <p>Synthia looks for sound files, SoundFont files (.sf2, .sf3, .dls) and SFZ files. Try a folder or zip holding one of those.</p></div>`;

function impJobsHtml() {
  return `<div class="imp-jobs">${imp.jobs.map((j) => `<div class="imp-job" data-job="${j.id}"><b>${esc(j.name)}</b>
    <div class="lib-progress${j.pct >= 100 ? " done" : ""}"><i style="width:${j.pct}%"></i><span>${j.pct >= 100 ? "Ready" : `Storing… ${Math.round(j.pct)}%`}</span></div></div>`).join("")}</div>
    <p class="imp-foot">You can close this window: the import carries on in the background, and the library shows the result.</p>`;
}

/* ---------- step machine ---------- */

const IMP_STEP = {
  drop: { body: impDropHtml, buttons: () => [{ label: "Back to library", tip: "Returns to the library.", action: () => openLibrary() }] },
  found: { body: impFoundHtml, buttons: () => [{ label: "Start over", tip: "Forgets this pack and goes back to the drop zone.", action: () => impStep("drop") },
    { label: "Import", tip: "Stores the instruments in this browser and adds them to My imports. It runs in the background.", primary: true, action: () => impRun(imp.pack.found.filter((_, i) => imp.picks[i]).map(([name, sounds, layers]) => ({ name, sounds, layers, drums: /drum|kit|percussion/i.test(name) }))) }] },
  map: { body: impMapHtml, buttons: () => [{ label: "Start over", tip: "Forgets this pack and goes back to the drop zone.", action: () => impStep("drop") },
    { label: "Import", tip: "Stores the instruments in this browser and adds them to My imports. It runs in the background.", primary: true, action: () => impRun([{ name: imp.name || "My instrument", sounds: imp.rows.length, layers: imp.kind === "notes" ? new Set(imp.rows.map((r) => r.level)).size : 1, drums: imp.kind === "drums" }]) }] },
  locked: { body: impLockedHtml, buttons: () => [{ label: "Try another file", tip: "Goes back to the drop zone.", primary: true, action: () => impStep("drop") }] },
  none: { body: impNoneHtml, buttons: () => [{ label: "Try another file", tip: "Goes back to the drop zone.", primary: true, action: () => impStep("drop") }] },
  importing: { body: impJobsHtml, buttons: () => [{ label: "Show in library", tip: "Opens the library at My imports, where finished instruments appear.", primary: true, action: () => openLibrary({ family: "imports" }) }] },
};

function impStep(step) {
  imp.step = step;
  const body = openDialog({ title: "Add instruments", body: IMP_STEP[step].body(), size: "large", className: "imp-dialog", buttons: IMP_STEP[step].buttons() });
  impWire(body);
}

function openAddInstruments() {
  impStep(imp.jobs.some((j) => j.pct < 100) ? "importing" : "drop");
}

/** Pretend storing: about 60 sound files a second, never blocking; finished instruments go to My imports. */
function impRun(items) {
  if (!items.length) return toast("Tick at least one instrument to import");
  const stamp = Date.now();
  imp.jobs = items.map((it, i) => ({ ...it, id: `imp-${stamp}-${i}`, pct: 0, t0: performance.now() + i * 250 }));
  impStep("importing");
  const tick = () => {
    let busy = false;
    for (const j of imp.jobs) {
      if (j.pct >= 100) continue;
      j.pct = clamp(0, ((performance.now() - j.t0) / Math.max(800, (j.sounds / 60) * 1000)) * 100, 100);
      const bar = $(`[data-job="${j.id}"] .lib-progress`);
      if (bar) {
        $("i", bar).style.width = `${j.pct}%`;
        $("span", bar).textContent = j.pct >= 100 ? "Ready" : `Storing… ${Math.round(j.pct)}%`;
        bar.classList.toggle("done", j.pct >= 100);
      }
      busy ||= j.pct < 100;
    }
    if (busy) return requestAnimationFrame(tick);
    libAddImports(imp.jobs.map((j) => ({ id: j.id, name: j.name, bank: imp.pack.file ?? imp.pack.zip ?? "Your sound files",
      mb: imp.pack.mb ? Math.round((imp.pack.mb / imp.pack.found.length) * 10) / 10 : Math.round(j.sounds * 0.4 * 10) / 10,
      layers: j.layers, licence: "Yours to check: Synthia doesn't look inside", credit: "", kind: j.drums ? "drum" : "sampled", note: j.drums ? "Your drum kit" : "Your instrument" })));
    toast(items.length > 1 ? `${items.length} instruments are in My imports` : `${items[0].name} is in My imports`);
  };
  requestAnimationFrame(tick);
}

/* ---------- wiring ---------- */

function impWire(body) {
  const drop = $(".imp-drop", body);
  if (drop) {
    drop.addEventListener("dragover", (event) => (event.preventDefault(), drop.classList.add("over")));
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (event) => {
      event.preventDefault();
      drop.classList.remove("over");
      const names = [...event.dataTransfer.files].map((f) => f.name);
      const zip = names.find((n) => /\.zip$/i.test(n));
      impStartPack(impPackFromNames(names, zip && names.length === 1 ? zip : null));
    });
  }
  body.addEventListener("change", (event) => {
    const t = event.target;
    if (t.dataset.imp === "files" || t.dataset.imp === "folder") {
      const names = [...t.files].map((f) => f.webkitRelativePath || f.name);
      const zip = names.find((n) => /\.zip$/i.test(n));
      return names.length && impStartPack(impPackFromNames(names, zip && names.length === 1 ? zip : null));
    }
    if (t.dataset.pick != null) imp.picks[Number(t.dataset.pick)] = t.checked;
    if (t.dataset.map) {
      const row = imp.rows[Number(t.dataset.i)];
      row[t.dataset.map] = t.dataset.map === "level" ? Number(t.value) : t.value || null;
      setDialogBody(impMapHtml());
    }
  });
  body.addEventListener("input", (event) => event.target.dataset.imp === "name" && (imp.name = event.target.value));
  body.addEventListener("click", (event) => {
    const demo = event.target.closest("[data-demo]");
    if (demo) return impStartPack(IMP_DEMO_DROPS.find((d) => d.key === demo.dataset.demo));
    const kind = event.target.closest('[data-set="imp-kind"]');
    if (kind && kind.dataset.v !== imp.kind) {
      imp.kind = kind.dataset.v;
      setDialogBody(impMapHtml());
    }
  });
}

addTips([
  [".imp-drop", "Drop zone", "Takes a folder, a zip, a SoundFont (.sf2, .sf3) or an SFZ file dropped here. Nothing leaves your computer."],
  ['[data-imp="files"]', "Choose files", "Picks sound files, a zip, a SoundFont or an SFZ file from your computer."],
  ['.imp-pick label:first-child', "Choose files", "Picks sound files, a zip, a SoundFont or an SFZ file from your computer."],
  ['.imp-pick label:last-child', "Choose a folder", "Picks a whole folder, for packs that come as a folder of sound files."],
  ["[data-demo]", (el) => `Pretend: ${el.textContent.trim()}`, (el) => IMP_DEMO_DROPS.find((d) => d.key === el.dataset.demo).tip],
  ['[data-set="imp-kind"][data-v="notes"]', "One instrument, by note", "Each file is a note of one instrument; Synthia fills the notes in between."],
  ['[data-set="imp-kind"][data-v="drums"]', "A drum kit", "Each file is a different drum and gets its own row in the grid."],
  ['[data-map="note"]', "Note", "Which note this file plays. Guessed from the file name; change it if the guess is wrong."],
  ['[data-map="level"]', "Loudness", "How hard this file was played, so soft and hard notes use the right recording."],
  ['[data-map="drum"]', "Drum row", "Which drum row this file becomes. “Leave out” skips it."],
  ["[data-pick]", "Import this instrument", "Ticked instruments are added to My imports."],
  ['[data-imp="name"]', "Name", "What the instrument is called in the library and in row headers."],
  [".imp-fmt.now", "Works now", "Formats Synthia reads today."],
  [".imp-fmt.next", "Coming next", "Formats planned for the next version. Until then, convert them to SFZ."],
  [".imp-fmt.convert", "Convert first", "Closed formats no browser can read. Convert them with ConvertWithMoss, then drop the result."],
]);
