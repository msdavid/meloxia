"use strict";
/*
 * The MIDI controllers dialog's real-device tabs (midi.js draws them):
 *   mpPictureHtml(dev) + mpFlash(msg)   a drawing of the controller; presses light up in it.
 *   monHtml() + monLive(msg)            Monitor: every message, newest first, decoded and in bytes.
 *   msHtml() + msReceive(msg) + msAct() Set up a controller: one step at a time, then a mapping to keep and a report.
 * A step counts as done when messages arrived from the controller while it showed (or, for a button step, when sent).
 */

/* ---------- the controller picture ---------- */

const mrLearned = new Map(); // device key → { pads, padCh, dawPads } learned in set-up, so the picture matches the real layout

function mpPictureHtml(key) {
  const d = midiDev(key);
  const [lo, hi] = d.keys ?? [48, 72];
  const knobs = (d.ccs ?? []).map((cc, i) => `<i class="mp-knob" data-cc="${cc}" title="${d.controls[i]} · control ${cc}"></i>`).join("");
  const pads = (d.pads ?? []).map((n, i) => `<i class="mp-pad" data-n="${n} ${d.dawPads?.[i] ?? ""}" title="Pad ${i + 1} · note ${n}"></i>`).join("");
  const btns = Object.entries(d.buttons ?? {}).map(([cc, name]) => `<b class="mp-btn" data-cc="${cc}">${name}</b>`).join("");
  const keys = [];
  for (let n = lo; n <= hi; n++) keys.push(`<i class="mp-key${BLACK.has(n % 12) ? " black" : ""}" data-n="${n}"></i>`);
  return `<div class="mp" data-pic="${esc(key)}">
    ${knobs || pads ? `<div class="mp-top"><div class="mp-knobs">${knobs}</div><div class="mp-pads">${pads}</div><div class="mp-btns">${btns}</div></div>` : ""}
    <div class="mp-keys">${keys.join("")}</div>
    <p class="mp-last">${d.real ? "Press a key, pad or knob: it lights up here." : "An example: plug in your own controller to see it here."}</p></div>`;
}

function mpFlash(msg) {
  const pic = $(`.mp[data-pic="${CSS.escape(msg.dev)}"]`);
  if (!pic || msg.out) return;
  if (msg.kind === "Key down" || msg.kind === "Key up") {
    const padCh = mrLearned.get(msg.dev)?.padCh ?? 10;
    let el = msg.ch === padCh || msg.role === "daw" ? $(`.mp-pad[data-n~="${msg.num}"]`, pic) : null;
    if (!el) {
      const keys = $$(".mp-key", pic), lo = Number(keys[0].dataset.n), hi = Number(keys.at(-1).dataset.n);
      let n = msg.num;
      while (n < lo) n += 12;
      while (n > hi) n -= 12;
      el = $(`.mp-key[data-n="${n}"]`, pic);
    }
    el?.classList.toggle("hit", msg.kind === "Key down");
  }
  if (msg.kind === "Control") {
    const el = $(`[data-cc="${msg.num}"]`, pic);
    if (el?.matches(".mp-knob")) el.style.setProperty("--v", msg.val / 127);
    else if (el) el.classList.toggle("hit", msg.val > 0);
  }
  $(".mp-last", pic).textContent = msg.text + (msg.ch ? ` · channel ${msg.ch}` : "");
}

/* ---------- Monitor ---------- */

const mon = { port: "all" };
const MON_ROWS = 200;

function monRowHtml(m) {
  const when = new Date(performance.timeOrigin + m.t);
  const time = when.toLocaleTimeString([], { hour12: false }) + "." + String(when.getMilliseconds()).padStart(3, "0");
  return `<tr class="${m.out ? "sent" : ""}"><td class="mon-t">${time}</td><td class="mon-p">${esc(m.port)}</td>
    <td>${esc(m.text)}${m.ch ? ` <small>channel ${m.ch}</small>` : ""}</td><td class="mon-h" title="${esc(m.hex)}">${esc(m.hex.length > 60 ? m.hex.slice(0, 60) + " …" : m.hex)}</td></tr>`;
}

const monShows = (m) => mon.port === "all" || m.port === mon.port;

function monHtml() {
  if (mr.state !== "on") return `<div class="lib-empty"><b>Nothing to show yet</b><p>The monitor lists what a real controller sends. Allow MIDI on the Devices tab and plug one in; the examples send nothing.</p></div>`;
  const ports = [...new Set(mrDevices().flatMap((d) => d.ins.map((p) => p.name)))];
  const rows = mr.log.filter(monShows).slice(-MON_ROWS).reverse().map(monRowHtml).join("");
  return `<div class="mon-top">${segHtml("mon-port", ["all", ...ports], mon.port, () => false, (p) => (p === "all" ? "All ports" : p))}
      <button class="btn small" data-mon="identify">Ask devices who they are</button><button class="btn small subtle" data-mon="clear">Clear</button></div>
    <p class="mon-clock">${mrClockLine()}</p>
    <div class="mon-log"><table><thead><tr><th>Time</th><th>Port</th><th>What it means</th><th>Bytes</th></tr></thead>
      <tbody>${rows || `<tr class="none"><td colspan="4">Press a key, pad or knob on your controller.</td></tr>`}</tbody></table></div>`;
}

function monLive(msg) {
  const body = $(".mon-log tbody");
  if (!body || !msg.hex || !monShows(msg)) return;
  body.querySelector("tr.none")?.remove();
  body.insertAdjacentHTML("afterbegin", monRowHtml(msg));
  while (body.rows.length > MON_ROWS) body.lastElementChild.remove();
}

/* ---------- Set up a controller ---------- */

const ms = { dev: null, steps: [], at: -1, outside: { msgs: [], clock: 0 } };

function msSteps(d) {
  const f = d.family;
  const S = (text, help, more = {}) => ({ text, help, ...more, msgs: [], clock: 0, sent: false, lit: null, state: "waiting" });
  const steps = [
    S("Press each pad once, left to right, top row first.", "One at a time, so each shows up on its own. Skip this if your controller has no pads.", { id: "pads" }),
    S("Turn each knob fully left, then fully right.", "One knob at a time, from left to right.", { id: "knobs" }),
    S("Play the lowest key, then the highest.", "Leave the octave buttons where they are.", { id: "keys" }),
    S("Press each of the other buttons once.", "Play, Record, the arrows and the rest, from left to right.", { id: "buttons" }),
    S("Move the bend and wobble wheels or strips.", "Skip this if your controller has none.", { id: "strips" }),
    S("Press the hold pedal a few times.", "Only if a pedal is plugged in.", { id: "pedal", skip: "No pedal" }),
  ];
  if (f?.daw) steps.push(
    S("Switch the controller to DAW mode.", `DAW mode is how music software talks to this controller. The button sends ${mrHex(f.daw.on)} (a key down on channel 16, note 12) to its DAW port; nothing is stored on the controller.`,
      { act: { label: "Switch to DAW mode", bytes: f.daw.on, why: "switch to DAW mode" } }),
    S("In DAW mode, press each pad once, top row first.", "In this mode the pads answer on the DAW port.", { id: "daw-pads" }),
    S("In DAW mode, turn each knob fully left, then fully right.", "One knob at a time, from left to right.", { id: "daw-knobs" }),
    S("In DAW mode, press each of the other buttons once.", "From left to right.", { id: "daw-buttons" }),
    S("Light a pad from Meloxia.", `The button sends ${mrHex(f.light.on)} to the DAW port: the bottom-left pad should turn red. Then say whether it did.`,
      { act: { label: "Light the bottom-left pad", bytes: f.light.on, why: "light the bottom-left pad red" }, ask: true }),
    S("Leave DAW mode.", `The button sends ${mrHex(f.daw.off)} to the DAW port, and the controller goes back to how it was.`,
      { act: { label: "Leave DAW mode", bytes: f.daw.off, why: "leave DAW mode" } }),
  );
  return steps;
}

const msNow = () => (ms.at >= 0 && ms.at < ms.steps.length ? ms.steps[ms.at] : null);
const msDone = (s) => (s.act ? s.sent && (!s.ask || s.lit !== null) : s.msgs.length > 0);

function msReceive(msg) {
  if (msg.out || !msg.hex) return;
  const b = msNow() && msg.dev === ms.dev && !msNow().act ? msNow() : ms.outside;
  if (msg.kind === "Clock") return void b.clock++;
  b.msgs.push(msg);
  if (b.msgs.length > 4000) b.msgs.shift();
  const seen = $(".ms-seen");
  if (seen && b === msNow()) seen.textContent = msLines(b).join("\n");
}

/* Per port, per kind and channel: every distinct number with its own value range, in the order they first arrived. */
function msLines(b) {
  const ports = new Map();
  for (const m of b.msgs) {
    const groups = ports.get(m.port) ?? new Map();
    const key = `${m.kind}|${m.ch ?? ""}`;
    const g = groups.get(key) ?? { kind: m.kind, ch: m.ch, n: 0, nums: new Map(), vals: [], hexes: new Set() };
    g.n++;
    if (m.num !== undefined) {
      const r = g.nums.get(m.num) ?? { lo: Infinity, hi: -Infinity, n: 0 };
      r.n++;
      if (m.val !== undefined) Object.assign(r, { lo: Math.min(r.lo, m.val), hi: Math.max(r.hi, m.val) });
      g.nums.set(m.num, r);
    } else if (m.val !== undefined) g.vals.push(m.val);
    if (m.kind === "Device message" || m.kind === "Identity") g.hexes.add(m.hex);
    groups.set(key, g);
    ports.set(m.port, groups);
  }
  const span = (lo, hi) => (lo === hi ? `${lo}` : `${lo}–${hi}`);
  const out = [];
  for (const [port, groups] of ports) {
    out.push(port);
    for (const g of groups.values()) {
      const head = `  ${g.kind}${g.ch ? ` · channel ${g.ch}` : ""}`;
      const rs = [...g.nums.values()];
      if (g.kind === "Key down") out.push(`${head} · notes in order: ${[...g.nums.keys()].join(" ")} · how hard ${span(Math.min(...rs.map((r) => r.lo)), Math.max(...rs.map((r) => r.hi)))}`);
      else if (g.kind === "Key up") out.push(`${head} · ${g.nums.size} note${g.nums.size > 1 ? "s" : ""}`);
      else if (g.nums.size) out.push(`${head} · ${[...g.nums].map(([n, r]) => (r.lo === Infinity ? `${n}` : `${n} (${span(r.lo, r.hi)})`)).join(" · ")}`);
      else if (g.vals.length) out.push(`${head} · ${span(Math.min(...g.vals), Math.max(...g.vals))} · ${g.n} messages`);
      else out.push(`${head} · ${g.n} message${g.n > 1 ? "s" : ""}`);
      for (const h of g.hexes) out.push(`    ${h}`);
    }
  }
  if (b.clock) out.push(`Timing clock · ${b.clock} ticks`);
  return out;
}

/* What the steps taught: pads to drum rows, knobs to the selected instrument's sliders, known buttons to the transport. */
const MS_KNOBS = ["Volume", "Brightness", "Soft start", "Ring out", "Effect 1 amount", "Effect 2 amount", "Effect 3 amount", "Effect 4 amount"];

function msMapping() {
  const step = (id) => ms.steps.find((s) => s.id === id && s.state === "done");
  const fromMidi = (s, kind) => (s ? s.msgs.filter((m) => m.kind === kind && m.role !== "daw") : []);
  const d = midiDev(ms.dev);
  const drums = INSTRUMENTS.filter((i) => i.kind === "drum");
  const pads = [...new Map(fromMidi(step("pads"), "Key down").map((m) => [m.num, m])).values()];
  const knobs = [...new Set(fromMidi(step("knobs"), "Control").map((m) => m.num))].sort((a, b) => a - b);
  const buttons = [...new Set(fromMidi(step("buttons"), "Control").filter((m) => m.val > 0).map((m) => m.num))];
  return [
    ...pads.map((m, i) => ({ dev: ms.dev, control: `Pad ${i + 1}`, note: m.num, ch: m.ch, target: `Drum row · ${drums[i % drums.length].name}`, pad: true })),
    ...knobs.slice(0, 8).map((cc, i) => ({ dev: ms.dev, control: `Knob ${i + 1}`, cc, target: `Selected instrument · ${MS_KNOBS[i]}`, pickup: true, turn: "absolute" })),
    ...buttons.map((cc) => {
      const name = d.buttons?.[cc];
      return { dev: ms.dev, control: name ?? `Button ${cc}`, cc, button: true, target: name === "Play" ? "Play and stop" : name === "Record" ? "Record" : null };
    }),
  ];
}

function msResultHtml() {
  const maps = msMapping();
  const lit = ms.steps.find((s) => s.ask);
  const rows = maps.map((m) => `<tr><td><b>${esc(m.control)}</b></td><td>${m.pad ? `note ${m.note}, channel ${m.ch}` : `control ${m.cc}`}</td>
    <td>${m.target ? esc(m.target) : `<span class="dim">Not linked: use MIDI learn</span>`}</td></tr>`).join("");
  return `<div class="ms-step"><small>Finished</small><h3>Here is what Meloxia learned</h3>
    <p>Keep it to use these controls straight away. You can change any of them later on the Mappings tab.</p>
    ${lit ? `<p>Lighting a pad from Meloxia: <b>${{ yes: "worked", no: "didn't work" }[lit.lit] ?? "not tried"}</b>.</p>` : ""}
    ${rows ? `<table class="midi-maps"><thead><tr><th>Control</th><th>Sends</th><th>Moves</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<p class="dim">No steps were done, so there is nothing to keep yet.</p>`}
    <div class="lib-actions"><button class="btn primary" data-ms="keep" ${rows ? "" : "disabled"}>Keep this mapping</button>
      <button class="btn" data-midi="export">${icon("download")}Export my mapping</button>
      <button class="btn" data-ms="copy">Copy report</button><button class="btn subtle" data-ms="start">Start again</button></div></div>`;
}

function msHtml() {
  const devs = mrDevices();
  if (!devs.length) return `<div class="lib-empty"><b>No controller connected</b><p>Set-up records what a real controller sends, so it needs one plugged in${mr.state === "on" ? "" : " and MIDI allowed on the Devices tab"}.</p></div>`;
  if (!devs.some((d) => d.key === ms.dev)) Object.assign(ms, { dev: midi.sel?.startsWith("real:") ? midi.sel : devs[0].key, steps: [], at: -1 });
  const list = ms.steps.map((s, i) => `<li class="${i === ms.at ? "now" : s.state}" title="${esc(s.text)}">${s.state === "done" ? "✓" : i + 1}</li>`).join("");
  let main;
  if (ms.at < 0) {
    main = `<div class="ms-step"><small>${esc(midiDev(ms.dev).name)}</small><h3>Teach Meloxia your controller, one thing at a time</h3>
      <p>Each step asks you to press or turn one kind of control. Meloxia records what arrives, then shows it as a mapping you can keep.</p>
      ${devs.length > 1 ? segHtml("ms-dev", devs.map((d) => d.key), ms.dev, () => false, (k) => mrDevice(k).name) : ""}
      <div class="lib-actions"><button class="btn primary ms-go" data-ms="start">Start set-up</button></div></div>`;
  } else if (ms.at >= ms.steps.length) main = msResultHtml();
  else {
    const s = ms.steps[ms.at];
    main = `<div class="ms-step"><small>Step ${ms.at + 1} of ${ms.steps.length}</small><h3>${esc(s.text)}</h3><p>${esc(s.help)}</p>
      ${s.act ? `<div class="lib-actions"><button class="btn primary" data-ms="act">${s.act.label}</button>
        ${s.ask && s.sent ? `<span>Did it light up?</span><button class="btn small${s.lit === "yes" ? " primary" : ""}" data-ms="lit-yes">Yes</button><button class="btn small${s.lit === "no" ? " primary" : ""}" data-ms="lit-no">No</button>` : ""}</div>`
        : `<pre class="ms-seen">${esc(msLines(s).join("\n")) || "Waiting for your controller…"}</pre>`}
      <div class="ms-nav"><button class="btn" data-ms="back" ${ms.at ? "" : "disabled"}>Back</button><button class="btn subtle" data-ms="skip">${s.skip ?? "Skip"}</button>
        <button class="btn primary" data-ms="next">${ms.at === ms.steps.length - 1 ? "Finish" : "Next"}</button></div></div>`;
  }
  return `<div class="ms">${main}${list ? `<ol class="ms-list">${list}</ol>` : ""}${mpPictureHtml(ms.dev)}</div>`;
}

function msAct(act, value) {
  const s = msNow();
  if (act === "start") Object.assign(ms, { steps: msSteps(mrDevice(ms.dev)), at: 0, outside: { msgs: [], clock: 0 } });
  if (act === "dev") Object.assign(ms, { dev: value, steps: [], at: -1 });
  if (act === "act" && s) {
    s.sent = mrSend(ms.dev, "daw", s.act.bytes, s.act.why) || s.sent;
    if (!s.sent) toast("Couldn't send: the controller's DAW port isn't there.");
  }
  if (act === "lit-yes" || act === "lit-no") s.lit = act.slice(4);
  if (act === "next" || act === "skip") {
    s.state = act === "skip" ? "skipped" : msDone(s) ? "done" : "skipped";
    if (s.state === "done" && (s.id === "pads" || s.id === "daw-pads")) msLearnPads(s);
    const off = mrDevice(ms.dev)?.family?.light.off; // the controller may have been unplugged meanwhile
    if (s.ask && s.sent && off) mrSend(ms.dev, "daw", off, "turn the pad's light off");
    ms.at++;
  }
  if (act === "back") ms.at = Math.max(0, ms.at - 1);
  if (act === "keep") {
    midi.maps = midi.maps.filter((m) => m.dev !== ms.dev).concat(msMapping().filter((m) => m.target));
    toast(`Kept: ${midiDev(ms.dev).name} is set up`);
  }
  if (act === "copy") navigator.clipboard.writeText(msReport()).then(() => toast("Report copied"), () => toast("Couldn't copy the report"));
  midiDraw();
}

/* The pads' notes in the order pressed (top row first), so the picture and the mapping follow the real pad mode. */
function msLearnPads(s) {
  const downs = s.msgs.filter((m) => m.kind === "Key down");
  const notes = [...new Set(downs.map((m) => m.num))];
  const was = mrLearned.get(ms.dev) ?? {};
  if (s.id === "pads") mrLearned.set(ms.dev, { ...was, pads: notes, padCh: downs[0]?.ch });
  else mrLearned.set(ms.dev, { ...was, dawPads: notes });
}

function msReport() {
  const out = ["Meloxia controller report", `Made ${new Date().toLocaleString()} · detailed permission (SysEx) ${mr.sysex ? "allowed" : "not asked"}`,
    "Note numbers: 60 is middle C, written C4.", "", "Devices"];
  for (const d of mrDevices()) {
    out.push(`  ${d.name}${d.family ? " (ready-made profile)" : ""}`);
    for (const p of [...d.ins.map((p) => ["in ", p]), ...d.outs.map((p) => ["out", p])]) out.push(`    ${p[0]} ${p[1].name} · ${p[1].role} port · maker ${p[1].maker || "-"}`);
  }
  const ids = mr.log.filter((m) => m.kind === "Identity");
  out.push("", "Says who it is", ...(ids.length ? ids.map((m) => `  ${m.port}: ${m.text.replace("Says who it is: ", "")} [${m.hex}]`) : ["  not asked"]));
  ms.steps.forEach((s, i) => {
    out.push("", `Step ${i + 1}: ${s.text} · ${s.state === "waiting" ? "not reached" : s.state}`);
    if (s.act) out.push(`  sent ${mrHex(s.act.bytes)}: ${s.sent ? "yes" : "no"}${s.ask ? ` · pad lit: ${s.lit ?? "not answered"}` : ""}`);
    else out.push(...msLines(s).map((l) => `  ${l}`));
  });
  const free = msLines(ms.outside);
  if (free.length) out.push("", "Outside the steps", ...free.map((l) => `  ${l}`));
  return out.join("\n");
}
