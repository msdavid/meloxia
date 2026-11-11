"use strict";
/*
 * Side panel (shared component): one panel docked on the right of the stage, showing one thing at a time. Inside the
 * editor the grid shrinks to make room; on the canvas it covers the right edge, and the view re-fits if it would hide
 * the block being set up.
 *
 *   registerPanel(kind, def) with def = {
 *     head(id)          → { eyebrow, name, hue? | icon? }   small line, big name, and a colour swatch or an icon
 *     intro?(id)        → html shown under the name, above the tabs (what this is, where it comes from)
 *     tabs?             { key: { label: text | (id) → html, tip, body(id) → html, click?(event, id), input?(event, id) } }
 *     body?(id)         → html, when there are no tabs
 *     rack?(id)         → the effects list shown in the body: its clicks, sliders and drags are handled here
 *     click?(event, id) → true when something changed; the panel then redraws and def.changed runs
 *     input?(event, id)   a slider or a text field moved (live: do not redraw the panel here)
 *     exists?(id)       → false closes the panel (its section was deleted, say)
 *     changed?(id)        redraw whatever else shows this thing (canvas chips, the editor)
 *     anchor?(id)       → the canvas element the panel must not cover (default: the selected block)
 *     className?          extra class on the panel ("song" uses the accent colour)
 *   }
 *   openPanel(kind, id), togglePanel(kind, id), closePanel(), renderPanel(fresh), panelChanged()
 *   addPanelTab(kind, key, tab, before?)  adds a tab to a registered panel (the section panel's Flow tab).
 *   side → { kind, id, tab, adding } while open, else null. Buttons with data-panel="<kind>" light up while it shows.
 */

const sideEl = $("#side");
const PANELS = {};
let side = null;

const panelDef = () => (side ? PANELS[side.kind] : null);
const sideRack = () => panelDef()?.rack?.(side.id) ?? null;

function registerPanel(kind, def) {
  PANELS[kind] = def;
}

function addPanelTab(kind, key, tab, before = null) {
  const entries = Object.entries(PANELS[kind].tabs);
  const at = before ? entries.findIndex(([k]) => k === before) : -1;
  entries.splice(at < 0 ? entries.length : at, 0, [key, tab]);
  PANELS[kind].tabs = Object.fromEntries(entries);
}

/* ---------- open and close ---------- */

function openPanel(kind, id = null) {
  const wasOpen = !!side;
  const def = PANELS[kind];
  const keepTab = side?.kind === kind && def.tabs?.[side.tab];
  side = { kind, id, tab: keepTab ? side.tab : def.tabs ? Object.keys(def.tabs)[0] : null, adding: false };
  sideEl.hidden = false;
  stageEl.classList.add("side-open");
  if (!wasOpen) {
    sideEl.classList.remove("in");
    void sideEl.offsetWidth; // restart the slide-in
    sideEl.classList.add("in");
  }
  renderPanel(true);
  syncPanelButtons();
  if (edSec) return renderEditor(); // the grid shrinks to make room
  // On the canvas: re-frame the song beside the panel, unless the view was moved by hand and the block in hand shows.
  const held = def.anchor?.(id) ?? (state.selected?.type === "node" ? $(`[data-id="${state.selected.id}"]`, nodesEl) : null);
  const box = held?.getBoundingClientRect();
  if (!viewTouched || (box && box.right > sideEl.getBoundingClientRect().left - 24)) fitView();
}

function closePanel() {
  if (!side) return;
  side = null;
  sideEl.hidden = true;
  stageEl.classList.remove("side-open");
  syncPanelButtons();
  if (edSec) renderEditor();
  else if (!viewTouched) fitView();
}

function togglePanel(kind, id = null) {
  side?.kind === kind && side.id === id ? closePanel() : openPanel(kind, id);
}

function syncPanelButtons() {
  $$("[data-panel]").forEach((button) => button.classList.toggle("on", side?.kind === button.dataset.panel));
}

/* ---------- drawing ---------- */

/** Draws the open panel; `fresh` starts its body scrolled to the top. Closes it if what it shows is gone. */
function renderPanel(fresh = false) {
  if (!side) return;
  const def = panelDef();
  if (def.exists && !def.exists(side.id)) return closePanel();
  const keep = fresh ? 0 : ($(".side-body", sideEl)?.scrollTop ?? 0);
  Object.values(PANELS).forEach((other) => other.className && sideEl.classList.toggle(other.className, other === def));
  const head = def.head(side.id);
  if (head.hue !== undefined) sideEl.style.setProperty("--h", head.hue);
  const mark = head.icon ? `<span class="side-ico">${icon(head.icon)}</span>` : '<i class="swatch"></i>';
  const tabs = def.tabs
    ? `<div class="tabs side-tabs">${Object.entries(def.tabs)
        .map(([key, tab]) => `<button data-tab="${key}" class="${side.tab === key ? "on" : ""}">${typeof tab.label === "function" ? tab.label(side.id) : tab.label}</button>`)
        .join("")}</div>`
    : "";
  const body = def.tabs ? def.tabs[side.tab].body(side.id) : def.body(side.id);
  sideEl.innerHTML = `<header class="side-head">${mark}<span class="side-title"><small>${head.eyebrow}</small><b>${esc(head.name)}</b></span>
    <button class="icon-btn" data-side="close">${icon("x")}</button></header>${def.intro ? `<div class="side-intro">${def.intro(side.id)}</div>` : ""}${tabs}<div class="side-body">${body}</div>`;
  $(".side-body", sideEl).scrollTop = keep;
}

/** After a change made in the panel: redraw it and whatever else shows the same thing. */
function panelChanged() {
  if (!side) return;
  const id = side.id;
  const def = panelDef();
  renderPanel();
  def.changed?.(id);
}

/* ---------- events, handed to the panel that is showing ---------- */

sideEl.addEventListener("click", (event) => {
  const t = event.target;
  if (t.closest('[data-side="close"]')) return closePanel();
  const def = panelDef();
  const tab = t.closest(".side-tabs [data-tab]");
  if (tab) {
    side.tab = tab.dataset.tab;
    side.adding = false;
    return renderPanel(true);
  }
  const rack = sideRack();
  if (rack && rackClick(t, rack, side)) return panelChanged();
  const handler = def.tabs?.[side.tab]?.click ?? def.click;
  if (handler?.(event, side.id)) panelChanged();
});

sideEl.addEventListener("input", (event) => {
  const rack = sideRack();
  if (rack && rackInput(event.target, rack)) return;
  const def = panelDef();
  (def.tabs?.[side.tab]?.input ?? def.input)?.(event, side.id);
});

sideEl.addEventListener("pointerdown", (event) => {
  const rack = sideRack();
  if (rack) rackDrag(event, rack);
});
