"use strict";
/*
 * Suggest notes, the interface (SPEC F). A light-bulb button in a row header (or "Suggest notes…" in the instrument
 * panel) opens a box for that row; after "Working on it…" the suggestion shows as ghost notes with a bar to Keep, Try
 * again, Edit request or Discard. Only the open section's one row is ever written. Pretend: nothing is sent.
 * Never say "AI" in anything shown: tooltips, labels, toasts and aria-labels included.
 *
 *   openSuggestBox(r, anchor, preset?)   the box for row r of the open section
 *   cancelSuggestion(why?)   drops a suggestion in progress; with a reason it says so in a toast (editor.js, record.js)
 *   suggestHit(r, step)      the loop passing: flashes the ghost notes; true when the row's own notes should stay dark
 *   openSuggestSettings()    the "Suggestions" dialog (top-bar menu)
 */

let sg = null; // { row, ask, mode, attempt, phase: "working" | "preview", timer, request, reply, fit }
let sgBoxRow = null; // the row the open box asks for

const sgIndex = () => (sg && edSec ? edSec.rows.indexOf(sg.row) : -1);
const sgName = (row) => inst(row.inst).name;
const hasNotes = (row) => row.cells.some((c) => (Array.isArray(c) ? c.length : c));

/* ---------- the box ---------- */

const SG_CHIPS = {
  drum: ["Steady beat", "Busier", "Simpler", "A fill at the end"],
  tune: ["Follow the kick", "Busier", "Simpler", "Higher"],
  chords: ["Held chords", "Two chords a bar", "Simpler", "Higher"],
};
const chipsFor = (row) => (!melodic(inst(row.inst)) ? SG_CHIPS.drum : /pad|keys/.test(row.inst) ? SG_CHIPS.chords : SG_CHIPS.tune);
const MODE_LABEL = { add: "Add to what's there", replace: "Replace" };

function boxHtml(row, preset) {
  const name = sgName(row);
  const head = `<h4 class="sg-title">${icon("bulb")}Suggest notes · ${esc(name)}</h4>`;
  if (!hasKey())
    return `<div class="sg-box">${head}<p class="sg-where">Suggestions come from a provider you choose, with your own key.</p>
      <footer><button class="btn primary" data-sg="setup">Set up suggestions</button></footer></div>`;
  const mode = hasNotes(row) ? segHtml("sg-mode", ["add", "replace"], preset.mode, undefined, (v) => MODE_LABEL[v]) : "";
  return `<div class="sg-box">${head}
    <input class="sg-ask" type="text" spellcheck="false" placeholder="What should the ${esc(name.toLowerCase())} play?" value="${esc(preset.ask)}" />
    <div class="sg-chips">${chipsFor(row).map((c) => `<button class="chip-tag sg-chip" data-chip="${c}">${c}</button>`).join("")}</div>
    ${mode}
    <p class="sg-where">Sends this section's notes and settings to ${suggestWhere()}. <button class="sg-link" data-sg="settings">Settings</button></p>
    <footer><button class="btn primary" data-sg="send">Send</button></footer></div>`;
}

function openSuggestBox(r, anchor, preset = { ask: "", mode: "add" }) {
  const row = edSec.rows[r];
  if (sg && sg.row !== row) cancelSuggestion();
  sgBoxRow = row;
  openPopover(anchor, boxHtml(row, preset), { className: "sg-pop", width: 340, onClick: (event) => boxClick(event, row) });
  $(".sg-ask", popEl)?.focus();
}

function boxClick(event, row) {
  const t = event.target;
  const chip = t.closest("[data-chip]");
  if (chip) {
    const input = $(".sg-ask", popEl);
    input.value = chip.dataset.chip;
    return input.focus();
  }
  const mode = t.closest('[data-set="sg-mode"]');
  if (mode) return $$('[data-set="sg-mode"]', popEl).forEach((b) => b.classList.toggle("on", b === mode));
  const act = t.closest("[data-sg]")?.dataset.sg;
  if (act === "send") return sendSuggestion(row);
  if (act === "setup" || act === "settings") return closePopover(), openSuggestSettings();
}

popEl.addEventListener("keydown", (event) => {
  if (!event.target.matches(".sg-ask")) return;
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    sendSuggestion(sgBoxRow);
  } else if (event.key === "Escape") {
    event.stopPropagation();
    closePopover();
  }
});

/* ---------- asking, working, preview ---------- */

function sendSuggestion(row, again = false) {
  if (!row || !edSec) return;
  const ask = again ? sg.ask : ($(".sg-ask", popEl)?.value.trim() || chipsFor(row)[0]);
  const mode = again ? sg.mode : ($('[data-set="sg-mode"].on', popEl)?.dataset.v ?? "add");
  const attempt = again ? sg.attempt + 1 : 0;
  closePopover();
  clearTimeout(sg?.timer);
  sg = { row, ask, mode, attempt, phase: "working", request: suggestRequest(row, ask, mode) };
  sg.timer = setTimeout(finishSuggestion, 1000 + Math.random() * 1000);
  drawSuggestion();
}

function finishSuggestion() {
  if (!sg || sgIndex() < 0) return cancelSuggestion();
  sg.reply = suggestReply(sg.row, sg.ask, sg.attempt);
  sg.fit = fitSuggestion(sg.row, sg.reply, sg.mode);
  sg.phase = "preview";
  drawSuggestion();
}

function keepSuggestion() {
  if (sg?.phase !== "preview") return;
  const { row, fit, mode } = sg;
  sg = null;
  writeSuggestion(row, fit.cells, mode);
  renderEditor();
  commitHistory();
  toast(`Kept ${plural(fit.count, "suggested note")}`, { action: "Undo", onAction: undo });
}

/** Drops the suggestion. A reason (the section closed, a recording started) is told in a toast. */
function cancelSuggestion(why) {
  if (!sg) return;
  clearTimeout(sg.timer);
  sg = null;
  drawSuggestion();
  if (why) toast(`Suggestion discarded: ${why}`);
}

function tryAgain() {
  sendSuggestion(sg.row, true);
}

function editRequest() {
  const { row, ask, mode } = sg;
  cancelSuggestion();
  const r = edSec.rows.indexOf(row);
  openSuggestBox(r, anchorFor(r), { ask, mode });
}

const anchorFor = (r) => {
  const rowEl = $(`.row[data-r="${r}"]`, editorEl);
  const bulb = $('[data-act="suggest"]', rowEl);
  return bulb?.offsetParent ? bulb : $(".rname", rowEl);
};

/* ---------- drawing: ghost notes over the row, and the bar under it ---------- */

function ghostLayer(cellsHtml, replace) {
  return `<div class="cells sg-ghost${replace ? " replace" : ""}" aria-label="Suggested notes, not kept yet">${cellsHtml}</div>`;
}

function drawSuggestion() {
  $$(".sg-ghost, .sg-bar, .sg-shimmer", editorEl).forEach((el) => el.remove());
  $$(".sg-on", editorEl).forEach((el) => el.classList.remove("sg-on", "sg-busy", "sg-replace"));
  const r = sgIndex();
  if (r < 0) return;
  const rowEl = $(`.row[data-r="${r}"]`, editorEl);
  const lanesEl = $(`.lanes[data-r="${r}"]`, editorEl);
  if (!rowEl) return;
  const holders = [rowEl, ...(lanesEl ? $$(".lane", lanesEl) : [])];
  holders.forEach((el) => el.classList.add("sg-on"));

  if (sg.phase === "working") {
    holders.forEach((el) => el.insertAdjacentHTML("beforeend", '<div class="sg-shimmer"></div>'));
    rowEl.classList.add("sg-busy");
  } else {
    const fake = { inst: sg.row.inst, cells: sg.fit.cells };
    const replace = sg.mode === "replace";
    rowEl.classList.toggle("sg-replace", replace);
    rowEl.insertAdjacentHTML("beforeend", ghostLayer(rowCells(fake), replace));
    if (lanesEl) $$(".lane", lanesEl).forEach((lane) => lane.insertAdjacentHTML("beforeend", ghostLayer(laneCells(fake, Number(lane.dataset.p)), replace)));
  }
  const after = lanesEl ?? $(`.strip[data-r="${r}"]`, editorEl) ?? rowEl;
  after.insertAdjacentHTML("afterend", barHtml());
  const scroll = $(".grid-scroll", editorEl);
  $(".sg-bar", editorEl).style.width = `${scroll.clientWidth - 16}px`;
}

function barHtml() {
  if (sg.phase === "working")
    return `<div class="sg-bar working"><span class="sg-what">${icon("bulb")}Working on it…</span><span class="spacer"></span>
      <button class="btn small subtle" data-sg="cancel">Cancel</button></div>`;
  const { count, leftOut } = sg.fit;
  const missed = leftOut ? `<span class="sg-missed">${plural(leftOut, "note")} did not fit and ${leftOut === 1 ? "was" : "were"} left out</span>` : "";
  const none = count ? "" : '<span class="sg-missed">No suggested note found room in this row</span>';
  return `<div class="sg-bar"><span class="sg-what">${icon("bulb")}Suggestion · ${plural(count, "note")}</span>${missed}${none}
    <button class="sg-link" data-sg="details">Details</button><span class="spacer"></span>
    <button class="btn small primary" data-sg="keep"${count ? "" : " disabled"}>Keep<kbd>Enter</kbd></button>
    <button class="btn small" data-sg="again">Try again</button>
    <button class="btn small" data-sg="edit">Edit request</button>
    <button class="btn small subtle" data-sg="discard">Discard<kbd>Esc</kbd></button></div>`;
}

function suggestHit(r, step) {
  if (sg?.phase !== "preview" || sgIndex() !== r) return false;
  const n = notesAt({ cells: sg.fit.cells }, step);
  if (n.length) {
    flash($(`.row[data-r="${r}"] > .sg-ghost .cell[data-s="${step}"] .note`, editorEl), n[0]);
    n.forEach((one) => flash($(`.lanes[data-r="${r}"] .lane[data-p="${one.pitch}"] > .sg-ghost .cell[data-s="${step}"] .note`, editorEl), one));
  }
  return sg.mode === "replace";
}

/* ---------- wiring ---------- */

editorEl.addEventListener("click", (event) => {
  const bulb = event.target.closest('.row [data-act="suggest"]');
  if (bulb) {
    const r = Number(bulb.closest(".row").dataset.r);
    return popoverFor(bulb) ? closePopover() : openSuggestBox(r, bulb, sg?.row === edSec.rows[r] ? { ask: sg.ask, mode: sg.mode } : undefined);
  }
  const act = event.target.closest(".sg-bar [data-sg]")?.dataset.sg;
  const acts = { cancel: () => cancelSuggestion(), keep: keepSuggestion, again: tryAgain, edit: editRequest, discard: () => cancelSuggestion(), details: openSuggestDetails };
  acts[act]?.();
});

// Ghost notes are not real yet: nothing edits, drags or opens them.
["pointerdown", "click", "dblclick", "contextmenu"].forEach((type) =>
  editorEl.addEventListener(
    type,
    (event) => {
      if (!event.target.closest(".sg-ghost, .sg-shimmer")) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  ),
);

// Enter keeps, Esc discards (or cancels the working state), unless typing, a dialog or a popover has the keyboard.
window.addEventListener(
  "keydown",
  (event) => {
    if (!sg || dialogOpen() || !popEl.hidden || event.target.isContentEditable || event.target.matches?.("input, textarea, select")) return;
    if (event.key === "Escape") cancelSuggestion();
    else if (event.key === "Enter" && sg.phase === "preview" && !event.target.closest?.("button")) keepSuggestion();
    else return;
    event.preventDefault();
    event.stopImmediatePropagation();
  },
  true,
);

EDITOR_HOOKS.push(() => (sg && sgIndex() < 0 ? cancelSuggestion() : drawSuggestion()));
HISTORY_HOOKS.push(() => sg && sgIndex() < 0 && cancelSuggestion("the row changed"));

/** From the instrument panel: the way in when the row's button is folded away. */
function suggestFromPanel(id) {
  const r = edSec ? edSec.rows.findIndex((row) => row.inst === id) : -1;
  if (r < 0) return toast("Open a section that uses this instrument first");
  openSuggestBox(r, anchorFor(r));
}

/* ---------- Details: what was sent and what came back ---------- */

function openSuggestDetails() {
  const json = (o) => `<pre class="sg-json">${esc(JSON.stringify(o, null, 2))}</pre>`;
  openDialog({
    title: "Details",
    size: "large",
    className: "sg-details",
    body: `<p class="sg-lead">Pretend: nothing was sent. In the app, this is what goes to ${suggestWhere()} and what comes back.</p>
      <div class="sg-cols"><section><h4>Sent</h4>${json(sg.request)}</section><section><h4>Came back</h4>${json(sg.reply)}</section></div>`,
    buttons: [{ label: "Close", primary: true, tip: "Closes the details. The suggestion stays in the row." }],
  });
}

/* ---------- Settings: "Suggestions" ---------- */

let sgTest = "";

function settingsHtml() {
  const p = SUGGEST.provider;
  const key = hasKey()
    ? `<div class="sg-keyset"><span>A ${SUGGEST_PROVIDERS[p].name} key is set in this browser.</span><button class="btn small" data-sgs="test">Test</button><button class="btn small subtle" data-sgs="remove">Remove key</button></div>`
    : `<div class="sg-keyset"><input class="sg-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your ${SUGGEST_PROVIDERS[p].name} key" aria-label="Key" /><button class="btn small" data-sgs="test">Test</button></div>`;
  const models = modelsOf(p).map((m) => `<option${m === SUGGEST.model ? " selected" : ""}>${m}</option>`).join("");
  const listed = SUGGEST_PROVIDERS[p].models ? "" : '<small class="sg-hint">Listed from your account once the key is set</small>';
  return `<div class="sg-settings">
    <label class="sg-label">Provider</label>${segHtml("sg-provider", Object.keys(SUGGEST_PROVIDERS), p, undefined, (v) => SUGGEST_PROVIDERS[v].name)}
    <label class="sg-label">Key <small>stored only in this browser</small></label>${key}
    <p class="sg-test" aria-live="polite">${sgTest}</p>
    <label class="sg-label">Model</label><select class="sg-model" aria-label="Model">${models}</select>${listed}
    <ul class="sg-facts">
      <li>Suggestions are written by a model run by the provider you choose. This section's notes and settings are sent to it.</li>
      <li>Each request is charged to your account there.</li>
      <li>Installed plugins can read the key.</li>
    </ul></div>`;
}

function takeKey() {
  const input = $(".dialog .sg-key");
  if (!input?.value.trim()) return false;
  SUGGEST.keys[SUGGEST.provider] = true;
  saveSuggest();
  return true;
}

function openSuggestSettings() {
  sgTest = "";
  const body = openDialog({
    title: "Suggestions",
    body: settingsHtml(),
    className: "sg-dialog",
    buttons: [{ label: "Done", primary: true, tip: "Keeps these settings and closes.", action: (close) => (takeKey(), close()) }],
  });
  const redraw = () => setDialogBody(settingsHtml());
  body.addEventListener("click", (event) => {
    const t = event.target;
    const provider = t.closest('[data-set="sg-provider"]');
    if (provider && provider.dataset.v !== SUGGEST.provider) {
      SUGGEST.provider = provider.dataset.v;
      SUGGEST.model = SUGGEST_PROVIDERS[SUGGEST.provider].models?.[1] ?? "Default model";
      sgTest = "";
      return saveSuggest(), redraw();
    }
    const act = t.closest("[data-sgs]")?.dataset.sgs;
    if (act === "test") {
      sgTest = hasKey() || takeKey() ? `The key works: ${SUGGEST_PROVIDERS[SUGGEST.provider].name} answered. (Pretend: nothing was sent.)` : "Paste a key first.";
      return redraw();
    }
    if (act === "remove") {
      delete SUGGEST.keys[SUGGEST.provider];
      sgTest = "Key removed from this browser.";
      return saveSuggest(), redraw();
    }
  });
  body.addEventListener("change", (event) => {
    if (!event.target.matches(".sg-model")) return;
    SUGGEST.model = event.target.value;
    saveSuggest();
  });
}

// app.js (the menu) loads after this file: register once every script has run.
document.addEventListener("DOMContentLoaded", () =>
  addMenuItem({ group: "sounds", label: "Suggestions…", icon: "bulb", action: openSuggestSettings, tip: "Chooses the provider that suggests notes for a row, and sets your key." }),
);

addTips([
  ['.rh [data-act="suggest"]', "Suggest notes", "Asks for notes for this row; you see them before anything changes."],
  ['[data-inst="suggest"]', "Suggest notes", "Asks for notes for this instrument's row in the open section; you see them before anything changes."],
  [".sg-ask", "What to play", "Describe the part in your own words. Example chips fill it in.", "Enter"],
  [".sg-chip", (el) => el.textContent, "Puts this request in the box, ready to send."],
  ['[data-set="sg-mode"][data-v="add"]', "Add to what's there", "Keeps the row's notes and adds the suggested ones where there is room."],
  ['[data-set="sg-mode"][data-v="replace"]', "Replace", "The suggestion takes the place of the row's notes once you keep it."],
  ['[data-sg="send"]', "Send", "Asks for a suggestion. Nothing in the row changes until you keep it.", "Enter"],
  ['[data-sg="setup"]', "Set up suggestions", "Opens the settings to choose a provider and paste your key."],
  ['[data-sg="settings"]', "Settings", "Opens the Suggestions settings: provider, key and model."],
  ['[data-sg="cancel"]', "Cancel", "Stops waiting for the suggestion.", "Esc"],
  ['[data-sg="keep"]', "Keep", "Turns the suggested notes into real ones. One undo takes them back.", "Enter"],
  ['[data-sg="again"]', "Try again", "Asks once more with the same words, for a different suggestion."],
  ['[data-sg="edit"]', "Edit request", "Reopens the box with your words, to change them and send again."],
  ['[data-sg="discard"]', "Discard", "Drops the suggestion. The row stays as it was.", "Esc"],
  ['[data-sg="details"]', "Details", "Shows what was sent and what came back."],
  [".sg-ghost", "Suggested notes", "Not part of the row yet: keep or discard them in the bar below."],
  [".sg-shimmer", "Working on it", "The suggestion is on its way. Cancel in the bar below stops it."],
  ['[data-set="sg-provider"]', (el) => el.textContent, "Uses this provider for suggestions. Each one needs its own key."],
  [".sg-key", "Key", "Paste the key from your account with this provider. It stays in this browser."],
  ['[data-sgs="test"]', "Test", "Checks that the key works."],
  ['[data-sgs="remove"]', "Remove key", "Deletes the key from this browser."],
  [".sg-model", "Model", "Which of the provider's models writes the suggestions."],
]);
