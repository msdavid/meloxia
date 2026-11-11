"use strict";
// The song canvas, part 2: how a section block is drawn (its thumbnail of notes, its meta line and the block itself).
// canvas.js draws them through renderNodes(); flow.path.js resets the meta line after playing.

function thumbHtml(section) {
  if (!section.rows.length) return '<div class="thumb empty">Empty · double-click to build</div>';
  const steps = section.bars * STEPS_PER_BAR;
  const lanes = Math.max(section.rows.length, 4);
  let marks = "";
  for (let bar = 1; bar < section.bars; bar++) {
    marks += `<line class="bar-line" x1="${bar * STEPS_PER_BAR}" x2="${bar * STEPS_PER_BAR}" y1="0" y2="${lanes}"/>`;
  }
  section.rows.forEach((r, lane) => {
    const fill = `hsl(${inst(r.inst).hue} var(--is) var(--il))`;
    // Thumbnails show each note's length (width) and loudness (opacity), nothing else.
    r.cells.forEach((cell, step) => {
      const notes = Array.isArray(cell) ? cell : cell ? [cell] : [];
      if (!notes.length) return;
      const len = Math.max(...notes.map((n) => n.len ?? 1));
      const loud = Math.max(...notes.map((n) => n.loud));
      marks += `<rect x="${step + 0.12}" y="${lane + 0.2}" width="${len - 0.24}" height="0.6" style="fill:${fill}; opacity:${loudOpacity(loud).toFixed(2)}"/>`;
    });
  });
  return `<div class="thumb"><svg viewBox="0 0 ${steps} ${lanes}" preserveAspectRatio="none">${marks}</svg><i class="thumb-head"></i></div>`;
}

function metaText(section) {
  const count = section.rows.length;
  return count ? `${count} instrument${count === 1 ? "" : "s"}` : "No instruments";
}

function nodeHtml(section) {
  const chips = nodeChips(section) + flowNodeChips(section.id);
  return `<div class="node${chips ? " has-chips" : ""}" data-id="${section.id}" style="--h:${section.hue}; left:${section.x}px; top:${section.y}px">
    <div class="node-head">
      <i class="dot"></i><span class="node-name">${esc(section.name)}</span>
      <span class="node-len">${section.bars} bar${section.bars === 1 ? "" : "s"}</span>${stickyBadge(section.id)}
    </div>
    ${chips}
    ${thumbHtml(section)}
    <div class="node-foot">
      <span class="node-meta">${metaText(section)}</span>
      <div class="rep">
        <button data-rep="-1">${icon("minus")}</button><b>×${section.repeats}</b><button data-rep="1">${icon("plus")}</button>
      </div>
    </div>
    <i class="port in"></i><i class="port out"></i>
    <div class="node-progress"><i></i></div>
  </div>`;
}
