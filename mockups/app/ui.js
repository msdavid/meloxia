"use strict";
/*
 * Small controls (shared components). Each returns an HTML string; wire them by event delegation on their container.
 * Tooltips come from tips.js: register yours there with addTips().
 *
 *   rangeHtml(p, value, attrs)   slider with label and readout. p = { label, min, max, out(v) → text, help?, ends?, def? }
 *       `ends: ["Muffled", "Bright"]` puts words at both ends; a centre mark shows when `def` is the middle of the range.
 *       On input: $("output", input.closest(".ctl")).textContent = p.out(value).
 *   switchHtml(on, attrs)        on/off switch (role="switch"). Redraw it, or toggle its .on class and aria-checked yourself.
 *   segHtml(key, values, current, disabled?, label?)   segmented control: buttons carrying data-set=key data-v=value.
 *   choicesHtml(key, [[value, label], ...], current)    stacked choices with a round mark, same data-set / data-v buttons.
 *   chipHtml(text, kind, attrs)  small rounded label. kind: "song" (follows the song), "own" (a button with a reset arrow),
 *       "scope" (outlined note), "warn" (needs attention), "tag" (neutral fact).
 *   clockTime(seconds)           "0:44": minutes and seconds.
 */

function rangeHtml(p, value, attrs) {
  const input = `<input type="range" min="${p.min}" max="${p.max}" step="1" value="${value}" ${attrs} aria-label="${p.label}" />`;
  return `<div class="ctl"><div class="ctl-head"><b>${p.label}</b><output>${p.out(value)}</output></div>${p.help ? `<small>${p.help}</small>` : ""}${
    p.ends ? `<div class="ends${p.min + p.max === 2 * p.def ? " mid" : ""}"><span>${p.ends[0]}</span>${input}<span>${p.ends[1]}</span></div>` : input
  }</div>`;
}

const switchHtml = (on, attrs) => `<button class="switch${on ? " on" : ""}" role="switch" aria-checked="${on}" ${attrs}><i></i></button>`;

const segHtml = (key, values, current, disabled = () => false, label = (v) => v) =>
  `<div class="seg">${values
    .map((v) => `<button data-set="${key}" data-v="${v}" class="${v === current ? "on" : ""}" ${disabled(v) ? "disabled" : ""}>${label(v)}</button>`)
    .join("")}</div>`;

const choicesHtml = (key, options, current) =>
  `<div class="choices">${options
    .map(([v, label]) => `<button data-set="${key}" data-v="${v}" class="${v === current ? "on" : ""}"><i></i>${label}</button>`)
    .join("")}</div>`;

const CHIP_TAGS = { song: "span", own: "button", scope: "span", warn: "span", tag: "span" };
const CHIP_CLASS = { song: "inh", own: "own", scope: "scope", warn: "chip-warn", tag: "chip-tag" };

function chipHtml(text, kind = "tag", attrs = "") {
  const tag = CHIP_TAGS[kind];
  return `<${tag} class="${CHIP_CLASS[kind]}" ${attrs}>${text}${kind === "own" ? icon("reset") : ""}</${tag}>`;
}

/** "0:44": minutes and seconds. Rounded first, so 59.6 s reads 1:00, never 0:60. */
const clockTime = (seconds) => {
  const t = Math.round(seconds);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
