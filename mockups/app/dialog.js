"use strict";
/*
 * Modal dialog (shared component). One at a time, over everything. Enter runs the primary button (unless a button or a
 * text area has the focus); Esc, its X or a press on the backdrop cancels it. Other shortcuts are off while it shows.
 *
 *   openDialog({ title, body, size, buttons, onClose, className }) → the dialog's body element, for wiring its contents.
 *       size: "small" (a question, about 440px) or "large" (a screen such as the library, most of the window).
 *       buttons: [{ label, tip, primary?, danger?, action(close) }]; without an action a button just closes the dialog.
 *       enter: false leaves Enter to the dialog's own contents (the library search picks with it).
 *       Opening a dialog while one shows replaces it (Open → its consent screen).
 *   closeDialog(), dialogOpen() → true while one shows, setDialogBody(html) to redraw the body in place.
 */

const dialogBack = Object.assign(document.createElement("div"), { className: "dialog-back", hidden: true });
document.body.append(dialogBack);
let dialogOpts = null;

function openDialog({ title, body = "", size = "small", buttons = [], onClose = null, className = "", enter = true }) {
  closePopover();
  dialogOpts = { buttons, onClose, enter };
  const footer = buttons
    .map((b, i) => `<button class="btn${b.primary ? " primary" : ""}${b.danger ? " danger" : ""}" data-dialog-btn="${i}">${b.label}</button>`)
    .join("");
  dialogBack.innerHTML = `<div class="dialog ${size} ${className}" tabindex="-1" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header><b>${title}</b><button class="icon-btn" data-dialog="close">${icon("x")}</button></header>
    <div class="dialog-body">${body}</div>
    ${footer ? `<footer>${footer}</footer>` : ""}
  </div>`;
  dialogBack.hidden = false;
  $(".dialog", dialogBack).focus({ preventScroll: true }); // Tab then reaches its controls; Esc closes it
  return $(".dialog-body", dialogBack);
}

function closeDialog() {
  if (dialogBack.hidden) return;
  dialogBack.hidden = true;
  dialogBack.innerHTML = "";
  const opts = dialogOpts;
  dialogOpts = null;
  opts?.onClose?.();
}

const dialogOpen = () => !dialogBack.hidden;

function setDialogBody(html) {
  const body = $(".dialog-body", dialogBack);
  if (body) body.innerHTML = html;
  return body;
}

dialogBack.addEventListener("pointerdown", (event) => event.target === dialogBack && closeDialog());

dialogBack.addEventListener("click", (event) => {
  if (event.target.closest('[data-dialog="close"]')) return closeDialog();
  const button = event.target.closest("[data-dialog-btn]");
  if (!button) return;
  const spec = dialogOpts.buttons[Number(button.dataset.dialogBtn)];
  spec.action ? spec.action(closeDialog) : closeDialog();
});

window.addEventListener(
  "keydown",
  (event) => {
    if (!dialogOpen()) return;
    const stop = () => (event.preventDefault(), event.stopImmediatePropagation());
    if (event.key === "Escape") {
      stop();
      return popEl.hidden ? closeDialog() : closePopover(); // a menu opened inside the dialog closes first
    }
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || !popEl.hidden) return;
    if (event.target.closest?.("button, textarea, select, [contenteditable='true']")) return; // it does its own thing
    if (dialogOpts?.enter === false) return; // the dialog handles Enter itself
    const primary = $(".dialog > footer .btn.primary", dialogBack);
    if (!primary || primary.disabled) return;
    stop();
    primary.click();
  },
  true,
);
