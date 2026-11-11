"use strict";
/*
 * Popover and menu (shared components). One at a time, in #pop; closed by a press outside, Esc, or closePopover().
 *
 *   openPopover(anchor, html, { onClick(event), onClose(), className, width })
 *       anchor: an element (opens below it, or above when there is no room) or a point { x, y } (say, a right-click).
 *       Clicks inside go to onClick. A press on the anchor itself does not close it, so a toggle button can do
 *       `popoverFor(button) ? closePopover() : openPopover(button, …)`.
 *   openMenu(anchor, items, opts)   a list of commands. items: { label, tip, icon?, key?, checked?, disabled?, action() },
 *       checked and disabled may be functions, read each time the menu opens;
 *       "-" for a divider, { heading } for a small title. Choosing one closes the menu, then runs its action.
 *   popoverFor(anchor) → true while a popover opened from that anchor is showing.
 */

const popEl = $("#pop");
let popOpts = null;

function openPopover(anchor, html, opts = {}) {
  closePopover();
  popOpts = { ...opts, anchor };
  popEl.className = `pop${opts.className ? ` ${opts.className}` : ""}`;
  popEl.style.width = opts.width ? `${opts.width}px` : "";
  popEl.innerHTML = html;
  popEl.hidden = false;
  const a = anchor instanceof Element ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
  const [w, h, m] = [popEl.offsetWidth, popEl.offsetHeight, 12];
  popEl.style.left = `${clamp(m, a.left, innerWidth - w - m)}px`;
  popEl.style.top = `${a.bottom + 8 + h > innerHeight - m ? Math.max(m, a.top - h - 8) : a.bottom + 8}px`;
}

function closePopover() {
  if (popEl.hidden) return;
  popEl.hidden = true;
  const opts = popOpts;
  popOpts = null;
  opts?.onClose?.();
}

const popoverFor = (anchor) => !popEl.hidden && popOpts?.anchor === anchor;

function openMenu(anchor, items, opts = {}) {
  const html = items
    .map((it, i) => {
      if (it === "-") return "<hr />";
      if (it.heading) return `<h4>${it.heading}</h4>`;
      const now = (v) => (typeof v === "function" ? v() : v);
      return `<button class="menu-item${now(it.checked) ? " on" : ""}" data-menu="${i}" ${now(it.disabled) ? "disabled" : ""}>${it.icon ? icon(it.icon) : '<i class="menu-gap"></i>'}<span>${
        it.label
      }</span>${it.key ? `<kbd>${it.key}</kbd>` : ""}</button>`;
    })
    .join("");
  openPopover(anchor, `<div class="menu">${html}</div>`, {
    className: "menu-pop",
    ...opts,
    onClick: (event) => {
      const button = event.target.closest("[data-menu]");
      if (!button || button.disabled) return;
      closePopover();
      items[Number(button.dataset.menu)].action?.();
    },
  });
  popOpts.items = items;
}

popEl.addEventListener("click", (event) => popOpts?.onClick?.(event));

document.addEventListener("pointerdown", (event) => {
  if (popEl.hidden || event.target.closest("#pop")) return;
  if (popOpts.anchor instanceof Element && popOpts.anchor.contains(event.target)) return;
  closePopover();
});
