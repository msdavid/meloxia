#!/usr/bin/env node
// Renders a folder of markdown reports into self-contained HTML pages plus an index of cards.
// Usage: node scripts/render-docs.mjs <source-dir> <destination-dir>
// The source folder may hold reports.json: [{ "file", "summary", "verdict" }] in display order;
// a listed file that does not exist yet becomes an "in progress" card.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error("usage: node scripts/render-docs.mjs <source-dir> <destination-dir>");
  process.exit(1);
}

/* ---------- markdown subset: headings, paragraphs, nested lists, GFM tables, fences, quotes ---------- */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const mdHref = (href) => href.replace(/^([^:#/][^:#]*)\.md(#|$)/, "$1.html$2");

function inline(text) {
  const tokens = [];
  const keep = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  let s = text.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, __, code) => keep(`<code>${esc(code.trim())}</code>`));
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|<>])/g, (_, ch) => keep(esc(ch)));
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => keep(`<a href="${mdHref(href)}">${label}</a>`));
  s = s.replace(/https?:\/\/[^\s<>"\u0000]+[^\s<>"\u0000.,;:!?)\]]/g, (url) => keep(`<a href="${url}">${url}</a>`));
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^\w*])\*([^*\s][^*]*)\*(?!\w)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^\w])_([^_\s][^_]*)_(?!\w)/g, "$1<em>$2</em>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[+i]);
}

const plain = (text) => text.replace(/`([^`]*)`/g, "$1").replace(/\*\*|__|[*_]/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

function splitRow(line) {
  const cells = [];
  let cur = "", tick = false;
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\" && body[i + 1] === "|") { cur += "\\|"; i++; continue; }
    if (ch === "`") tick = !tick;
    if (ch === "|" && !tick) { cells.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const isTableSep = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line ?? "");
const indentOf = (line) => line.match(/^\s*/)[0].length;

function blocks(lines, ctx) {
  const out = [];
  let i = 0;
  const startsBlock = (l, next) => /^\s*(#{1,6}\s|```|>|---\s*$)/.test(l) || LIST.test(l) || (/^\s*\|/.test(l) && isTableSep(next));
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^\s*```\s*(\S*)/))) {
      const code = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
      i++;
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
    } else if ((m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
      const level = m[1].length, text = m[2];
      let id = plain(text).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s/g, "-");
      for (let n = 1; ctx.ids.has(id); n++) id = `${id.replace(/-\d+$/, "")}-${n}`;
      ctx.ids.add(id);
      if (level === 1 && !ctx.title) ctx.title = plain(text);
      if (level === 2 || level === 3) ctx.toc.push({ level, id, text: inline(text) });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
    } else if (/^\s*---\s*$/.test(line)) {
      out.push("<hr>");
      i++;
    } else if (/^\s*>/.test(line)) {
      const quote = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]); i++) quote.push(lines[i].replace(/^\s*>\s?/, ""));
      out.push(`<blockquote>${blocks(quote, ctx)}</blockquote>`);
    } else if (/^\s*\|/.test(line) && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      const rows = [];
      for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(splitRow(lines[i]));
      const th = head.map((c) => `<th>${inline(c)}</th>`).join("");
      const tb = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("\n");
      out.push(`<div class="table-wrap" tabindex="0"><table><thead><tr>${th}</tr></thead><tbody>\n${tb}\n</tbody></table></div>`);
    } else if (LIST.test(line)) {
      const base = indentOf(line), ordered = /\d/.test(line.match(LIST)[2]);
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const lm = l.match(LIST);
        if (lm && indentOf(l) === base) { items.push([lm[3]]); i++; continue; }
        if (!l.trim()) {
          const next = lines.slice(i).find((x) => x.trim());
          if (next && (indentOf(next) > base || (LIST.test(next) && indentOf(next) === base))) { items.at(-1).push(""); i++; continue; }
          break;
        }
        if (indentOf(l) > base) { items.at(-1).push(l.slice(Math.min(indentOf(l), base + 2))); i++; continue; }
        if (!startsBlock(l, lines[i + 1])) { items.at(-1).push(l.trim()); i++; continue; } // lazy continuation
        break;
      }
      const lis = items.map((body) => {
        const inner = body.length === 1 ? inline(body[0]) : blocks(body, ctx).replace(/^<p>([\s\S]*?)<\/p>/, "$1");
        return `<li>${inner}</li>`;
      });
      out.push(`<${ordered ? "ol" : "ul"}>${lis.join("\n")}</${ordered ? "ol" : "ul"}>`);
    } else {
      const para = [];
      for (; i < lines.length && lines[i].trim() && !(para.length && startsBlock(lines[i], lines[i + 1])); i++) para.push(lines[i].trim());
      out.push(`<p>${inline(para.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}

function render(markdown) {
  const ctx = { ids: new Set(), toc: [], title: "" };
  const html = blocks(markdown.replace(/\r\n?/g, "\n").split("\n"), ctx);
  return { ...ctx, html };
}

/* ---------- page chrome: the three looks of mockups/01-song-canvas, remembered per browser ---------- */

const LOOKS = readFileSync(new URL("../mockups/01-song-canvas/style.css", import.meta.url), "utf8")
  .match(/:root,\s*\[data-look="graphite"\][\s\S]*?\n\[data-look="paper"\] \{[\s\S]*?\n\}/)[0];

const CSS = `${LOOKS}
* { box-sizing: border-box; }
html { background: var(--bg); color: var(--text); font: 16px/1.6 var(--font); }
body { margin: 0; }
a { color: var(--accent); text-underline-offset: 0.2em; }
code { font: 0.86em var(--mono); background: var(--surface-2); border: 1px solid var(--line-soft); border-radius: 4px; padding: 0.05em 0.35em; overflow-wrap: anywhere; }
pre { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); padding: 14px 16px; overflow-x: auto; }
pre code { background: none; border: 0; padding: 0; font-size: 0.85em; overflow-wrap: normal; }
.top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 16px; padding: 10px 24px; background: var(--surface); border-bottom: 1px solid var(--line); }
.top .home { color: var(--text); font-weight: 700; text-decoration: none; letter-spacing: 0.01em; }
.top .home span { color: var(--accent); }
.top .crumb { color: var(--dim); font-size: 14px; }
.top .spacer { flex: 1; }
.looks { display: flex; gap: 4px; padding: 3px; border-radius: 99px; background: var(--bg); border: 1px solid var(--line); }
.looks button { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; background-clip: padding-box; cursor: pointer; padding: 0; }
.looks button.on { border-color: var(--text); }
.looks [data-look="graphite"] { background-image: linear-gradient(135deg, #2b2f36 50%, #ffb020 50%); }
.looks [data-look="midnight"] { background-image: linear-gradient(135deg, #171a31 50%, #8f73ff 50%); }
.looks [data-look="paper"] { background-image: linear-gradient(135deg, #fffdf8 50%, #e2502a 50%); }
.layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 32px; max-width: 1500px; margin: 0 auto; padding: 24px; }
@media (min-width: 1100px) { .layout { grid-template-columns: 260px minmax(0, 1fr); } .layout.no-toc { grid-template-columns: minmax(0, 1fr); } }
.toc { font-size: 14px; }
@media (min-width: 1100px) { .toc { position: sticky; top: 72px; align-self: start; max-height: calc(100vh - 96px); overflow-y: auto; } .toc summary { pointer-events: none; list-style: none; } }
.toc details { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 12px 14px; }
.toc summary { font-weight: 700; color: var(--dim); text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; cursor: pointer; }
.toc ol { list-style: none; margin: 8px 0 0; padding: 0; }
.toc li a { display: block; padding: 3px 0; color: var(--dim); text-decoration: none; line-height: 1.35; }
.toc li a:hover { color: var(--text); }
.toc li.l3 a { padding-left: 14px; font-size: 13px; }
main { min-width: 0; }
main > :is(p, ul, ol, blockquote, h1, h2, h3, h4, pre) { max-width: 76ch; }
h1 { font-size: 2rem; line-height: 1.2; margin: 0.2em 0 0.6em; }
h2 { font-size: 1.45rem; margin: 2em 0 0.6em; padding-top: 0.6em; border-top: 1px solid var(--line-soft); }
h3 { font-size: 1.15rem; margin: 1.6em 0 0.5em; }
:is(h2, h3, h4) { scroll-margin-top: 72px; }
li { margin: 0.25em 0; }
li > :is(ul, ol) { margin: 0.2em 0; }
blockquote { margin: 1em 0; padding: 4px 16px; border-left: 3px solid var(--accent); color: var(--dim); }
hr { border: 0; border-top: 1px solid var(--line); margin: 2em 0; }
.table-wrap { overflow-x: auto; margin: 1.2em 0; border: 1px solid var(--line); border-radius: var(--r); background: var(--surface); }
.table-wrap:focus-visible { outline: 2px solid var(--accent); }
table { border-collapse: collapse; font-size: 14px; line-height: 1.45; }
th, td { text-align: left; vertical-align: top; padding: 8px 12px; border-bottom: 1px solid var(--line-soft); min-width: 9ch; max-width: 46ch; }
th { position: sticky; top: 0; background: var(--surface-2); font-weight: 650; color: var(--text); }
tr:last-child td { border-bottom: 0; }
tbody tr:nth-child(even) td { background: color-mix(in oklab, var(--surface-2) 45%, transparent); }
.cards { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); max-width: 1200px; }
.card { display: flex; flex-direction: column; gap: 8px; padding: 18px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow); color: var(--text); text-decoration: none; }
a.card:hover { border-color: var(--accent); }
.card h2 { margin: 0; padding: 0; border: 0; font-size: 1.15rem; }
.card .meta { color: var(--faint); font-size: 13px; font-family: var(--mono); }
.card p { margin: 0; color: var(--dim); }
.card .verdict { color: var(--text); border-left: 3px solid var(--accent); padding-left: 10px; }
.card.pending { opacity: 0.65; box-shadow: none; border-style: dashed; }
.badge { align-self: flex-start; font-size: 12px; padding: 2px 8px; border-radius: 99px; background: var(--surface-3); color: var(--dim); }
`;

const HEAD_JS = `try{var l=localStorage.getItem("synthia-look");if(l)document.documentElement.dataset.look=l}catch(e){}`;
const LOOK_JS = `(function(){var b=document.querySelectorAll(".looks button");function set(l){document.documentElement.dataset.look=l;b.forEach(function(x){x.classList.toggle("on",x.dataset.look===l)});try{localStorage.setItem("synthia-look",l)}catch(e){}}
b.forEach(function(x){x.addEventListener("click",function(){set(x.dataset.look)})});set(document.documentElement.dataset.look||"graphite")})();`;

function page({ title, crumb, body, toc }) {
  const tocHtml = toc?.length
    ? `<nav class="toc" aria-label="Contents"><details open><summary>Contents</summary><ol>${toc
        .map((t) => `<li class="l${t.level}"><a href="#${t.id}">${t.text}</a></li>`)
        .join("")}</ol></details></nav>`
    : "";
  return `<!doctype html>
<html lang="en" data-look="graphite">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,">
<title>${esc(title)}</title><script>${HEAD_JS}</script><style>${CSS}</style></head>
<body>
<header class="top"><a class="home" href="index.html">Synthia <span>research</span></a>${crumb ? `<span class="crumb">/ ${esc(crumb)}</span>` : ""}<span class="spacer"></span>
<div class="looks" title="Look"><button data-look="graphite" title="Graphite" aria-label="Graphite look"></button><button data-look="midnight" title="Midnight" aria-label="Midnight look"></button><button data-look="paper" title="Paper" aria-label="Paper look"></button></div></header>
<div class="layout${tocHtml ? "" : " no-toc"}">${tocHtml}<main>${body}</main></div>
<script>${LOOK_JS}</script>
</body></html>
`;
}

/* ---------- build ---------- */

mkdirSync(dest, { recursive: true });
const manifestPath = join(src, "reports.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : [];
const listed = new Set(manifest.map((r) => r.file));
const extra = readdirSync(src).filter((f) => f.endsWith(".md") && !listed.has(f)).sort().map((file) => ({ file }));

const cards = [];
for (const report of [...manifest, ...extra]) {
  const path = join(src, report.file), name = basename(report.file, ".md");
  if (!existsSync(path)) {
    cards.push(`<div class="card pending"><span class="badge">in progress</span><h2>${esc(report.title ?? name)}</h2>${report.summary ? `<p>${inline(report.summary)}</p>` : ""}</div>`);
    continue;
  }
  const doc = render(readFileSync(path, "utf8"));
  const date = statSync(path).mtime.toISOString().slice(0, 10);
  writeFileSync(join(dest, `${name}.html`), page({ title: doc.title || name, crumb: doc.title || name, body: doc.html, toc: doc.toc }));
  cards.push(`<a class="card" href="${name}.html"><span class="meta">${date} · ${esc(report.file)}</span><h2>${esc(doc.title || name)}</h2>${
    report.summary ? `<p>${inline(report.summary)}</p>` : ""}${report.verdict ? `<p class="verdict">${inline(report.verdict)}</p>` : ""}</a>`);
  console.log(`rendered ${report.file} -> ${name}.html`);
}
writeFileSync(join(dest, "index.html"), page({ title: "Synthia research", body: `<h1>Research reports</h1><div class="cards">${cards.join("\n")}</div>` }));
console.log(`wrote ${join(dest, "index.html")} (${cards.length} cards)`);
