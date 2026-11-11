"use strict";
/*
 * Real MIDI for the MIDI controllers dialog (midi.js): asks the browser for Web MIDI, groups ports into devices,
 * decodes every message and hands it to the dialog's listeners.
 *
 *   mrConnect(sysex) → "ok" | "blocked" | "unsupported"     mrDevices() → [{ key, name, family, ins, outs }]
 *   mrDecode(bytes) → { kind, ch, num, val, text, hex }      mrSend(dev, role, bytes, why) sends and logs it
 *   mrOn(fn): fn(msg) for every message, msg = decoded + { port, role, dev, t }; also { kind: "Ports" } on plug and unplug.
 * Without Web MIDI, or when the browser says no, the dialog keeps its example devices.
 */

const mr = { access: null, sysex: false, state: "off", log: [], clocks: new Map(), sense: 0, listeners: new Set() };
const MR_LOG_MAX = 400;

const mrHex = (d) => Array.from(d, (b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");

/* ---------- decoding ---------- */

const MR_MODES = { 120: "All sound off", 121: "Reset all controls", 122: "Local keys on or off", 123: "All notes off",
  124: "Omni off", 125: "Omni on", 126: "Mono mode", 127: "Poly mode" };
const MR_CCS = { 0: "Bank select", 1: "Modulation", 2: "Breath", 7: "Volume", 10: "Pan", 11: "Expression", 64: "Hold pedal",
  65: "Glide on or off", 66: "Sostenuto pedal", 67: "Soft pedal", 71: "Resonance", 74: "Brightness" };
const MR_MAKERS = { "41": "Roland", "42": "Korg", "43": "Yamaha", "47": "Akai", "00 20 29": "Novation", "00 20 6B": "Arturia",
  "00 20 32": "Behringer", "00 21 09": "Native Instruments" };

function mrMaker(d, at) {
  const long = d[at] === 0;
  const id = mrHex(d.slice(at, at + (long ? 3 : 1)));
  return { name: MR_MAKERS[id] ?? `maker ${id}`, next: at + (long ? 3 : 1) };
}

function mrDecodeSysex(d, hex) {
  if (d[1] === 0x7e && d[3] === 0x06 && d[4] === 0x02 && d.length >= 15) {
    const m = mrMaker(d, 5), i = m.next;
    const family = mrHex([d[i], d[i + 1]]), model = mrHex([d[i + 2], d[i + 3]]), version = mrHex(d.slice(i + 4, i + 8));
    return { kind: "Identity", maker: m.name, family, model, version, hex,
      text: `Says who it is: ${m.name}, family ${family}, model ${model}, firmware ${version}` };
  }
  if (d[1] === 0x7e || d[1] === 0x7f) return { kind: "Device message", hex, text: `Standard device message, ${d.length} bytes` };
  return { kind: "Device message", hex, text: `Device message from ${mrMaker(d, 1).name}, ${d.length} bytes` };
}

function mrDecode(data) {
  const d = Array.from(data), s = d[0], hex = mrHex(d);
  if (s === undefined || s < 0x80) return { kind: "Stray bytes", hex, text: "Bytes without a message type" };
  if (s < 0xf0) {
    const ch = (s & 15) + 1, a = d[1] ?? 0, b = d[2] ?? 0;
    switch (s & 0xf0) {
      case 0x90:
        if (b) return { kind: "Key down", ch, num: a, val: b, hex, text: `Key down ${noteName(a)} (note ${a}), how hard ${b} of 127` };
        return { kind: "Key up", ch, num: a, val: 0, hex, text: `Key up ${noteName(a)} (note ${a})` };
      case 0x80: return { kind: "Key up", ch, num: a, val: b, hex, text: `Key up ${noteName(a)} (note ${a})` };
      case 0xa0: return { kind: "Key pressure", ch, num: a, val: b, hex, text: `Pressing on ${noteName(a)} (note ${a}): ${b} of 127` };
      case 0xb0:
        if (a >= 120) return { kind: "Channel mode", ch, num: a, val: b, hex, text: `${MR_MODES[a]} (control ${a})` };
        return { kind: "Control", ch, num: a, val: b, hex, text: `Control ${a}${MR_CCS[a] ? ` (${MR_CCS[a]})` : ""} to ${b}` };
      case 0xc0: return { kind: "Sound change", ch, num: a, hex, text: `Sound change to number ${a}` };
      case 0xd0: return { kind: "Pressure", ch, val: a, hex, text: `Pressing on the keys: ${a} of 127` };
      case 0xe0: {
        const v = ((b << 7) | a) - 8192;
        return { kind: "Bend", ch, val: v, hex, text: `Bend ${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)} (centre is 0)` };
      }
    }
  }
  const SYSTEM = { 0xf6: "Tune request", 0xf8: "Clock", 0xfa: "Start", 0xfb: "Continue", 0xfc: "Stop", 0xfe: "Still connected", 0xff: "Reset" };
  if (s === 0xf0) return mrDecodeSysex(d, hex);
  if (s === 0xf2) return { kind: "Song position", val: (d[2] << 7) | d[1], hex, text: `Song position: ${(d[2] << 7) | d[1]} sixteenths in` };
  if (SYSTEM[s]) return { kind: SYSTEM[s], hex, text: { Start: "Start (from the beginning)", Continue: "Continue (from where it stopped)" }[SYSTEM[s]] ?? SYSTEM[s] };
  return { kind: "Other", hex, text: "Other system message" };
}

/* ---------- devices: ports grouped by the name before "MIDI" or "DAW" ---------- */

const MR_FAMILIES = [
  // Launchkey MK3 family: DAW mode by a Note On on the DAW port (Novation's Launchkey MK3 programmer's reference).
  { id: "lk3", test: /launchkey.*mk3/i, profile: "lkm3", daw: { on: [0x9f, 0x0c, 0x7f], off: [0x9f, 0x0c, 0x00] },
    light: { on: [0x90, 0x70, 0x05], off: [0x90, 0x70, 0x00] },
    // The pad mode is reported on the DAW port as control 3 on channel 16 (Novation's Launchkey MK3 programmer's reference).
    padModes: { 0: "Custom", 1: "Drum", 2: "Session", 3: "Scale chords", 4: "User chords", 9: "Device select", 10: "Navigation" } },
];

const mrRole = (name) => (/\b(daw|incontrol)\b/i.test(name) ? "daw" : "midi");
const mrBase = (name) => name.replace(/\s*\b(midi|daw|incontrol)\b(\s*(port|in|out))?(\s*\d+)?\s*$/i, "").trim() || name;
const mrIgnored = (name) => /^midi through/i.test(name);

function mrDevices() {
  if (!mr.access) return [];
  const devs = new Map();
  for (const [dir, map] of [["ins", mr.access.inputs], ["outs", mr.access.outputs]])
    for (const p of map.values()) {
      if (mrIgnored(p.name) || p.state !== "connected") continue;
      const name = mrBase(p.name);
      const d = devs.get(name) ?? { key: `real:${name}`, name, family: MR_FAMILIES.find((f) => f.test.test(name)) ?? null, ins: [], outs: [] };
      d[dir].push({ id: p.id, name: p.name, role: mrRole(p.name), maker: p.manufacturer });
      devs.set(name, d);
    }
  return [...devs.values()];
}

const mrDevice = (key) => mrDevices().find((d) => d.key === key);
const mrDevOfPort = (name) => `real:${mrBase(name)}`;

/* ---------- connecting and listening ---------- */

async function mrConnect(sysex = false) {
  if (!navigator.requestMIDIAccess || !window.isSecureContext) return (mr.state = "unsupported");
  try {
    const access = await navigator.requestMIDIAccess({ sysex });
    if (mr.access) for (const input of mr.access.inputs.values()) input.onmidimessage = null;
    Object.assign(mr, { access, state: "on", sysex: mr.sysex || sysex });
    access.onstatechange = () => { mrListen(); mrEmit({ kind: "Ports" }); };
    mrListen();
    return "ok";
  } catch {
    if (mr.state !== "on") mr.state = "blocked";
    return "blocked";
  }
}

function mrListen() {
  for (const input of mr.access.inputs.values())
    if (!mrIgnored(input.name)) input.onmidimessage = (e) => mrReceive(input.name, e.data, e.timeStamp);
}

const mrOn = (fn) => mr.listeners.add(fn);
const mrEmit = (msg) => mr.listeners.forEach((fn) => fn(msg));

function mrReceive(port, data, t = performance.now()) {
  const msg = { ...mrDecode(data), port, role: mrRole(port), dev: mrDevOfPort(port), t };
  const modes = MR_FAMILIES.find((f) => f.test.test(port))?.padModes;
  if (modes && msg.kind === "Control" && msg.ch === 16 && msg.num === 3 && msg.role === "daw")
    msg.text = `Pads switched to ${modes[msg.val] ?? `mode ${msg.val}`} mode (control 3 to ${msg.val})`;
  if (msg.kind === "Clock") mrTick(port, t);
  else if (msg.kind === "Still connected") mr.sense++;
  else {
    mr.log.push(msg);
    if (mr.log.length > MR_LOG_MAX) mr.log.shift();
  }
  mrEmit(msg);
}

/* Sends to the device's output with that role, and lists what was sent in the monitor. */
function mrSend(devKey, role, bytes, why) {
  const d = mrDevice(devKey);
  const out = d?.outs.find((o) => o.role === role) ?? d?.outs[0];
  if (!out) return false;
  try {
    mr.access.outputs.get(out.id).send(bytes);
  } catch {
    return false;
  }
  const msg = { kind: "Sent", out: true, port: out.name, role: out.role, dev: devKey, t: performance.now(), hex: mrHex(bytes), text: `Meloxia sent: ${why}` };
  mr.log.push(msg);
  mrEmit(msg);
  return true;
}

/* The standard identity question, to every output of every device; needs the detailed permission. */
async function mrIdentify() {
  if (!mr.sysex && (await mrConnect(true)) !== "ok") return 0;
  let n = 0;
  for (const d of mrDevices()) for (const o of d.outs) {
    try { mr.access.outputs.get(o.id).send([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]); n++; } catch { /* a refusing port is skipped */ }
  }
  return n;
}

/* ---------- timing clock: shown as a rate, never as rows ---------- */

function mrTick(port, t) {
  const c = mr.clocks.get(port) ?? { times: [], last: 0 };
  c.times.push(t);
  if (c.times.length > 49) c.times.shift();
  c.last = performance.now();
  mr.clocks.set(port, c);
}

function mrClockLine() {
  const parts = [];
  for (const [port, c] of mr.clocks) {
    if (performance.now() - c.last > 1500 || c.times.length < 3) continue;
    const perSecond = (c.times.length - 1) / ((c.times.at(-1) - c.times[0]) / 1000);
    parts.push(`${port} sends a timing clock at about ${Math.round((perSecond * 60) / 24)} bpm`);
  }
  if (mr.sense) parts.push(`${mr.sense} “still connected” signals, not listed`);
  return parts.join(" · ");
}
