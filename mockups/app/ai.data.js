"use strict";
/*
 * Suggest notes, the data side (SPEC F). Pretend: nothing is ever sent. The interface never says "AI": the feature is
 * "Suggest notes", its result a "suggestion", its settings "Suggestions".
 *
 *   SUGGEST                 the settings: { provider, model, keys: { provider: true } }, kept in this browser. The mockup
 *                           never stores a key itself, only that one was entered. hasKey(), saveSuggest() after a change.
 *   SUGGEST_PROVIDERS       id → { name, models } (OpenAI and OpenRouter list their models from the account, so none are named)
 *   suggestRequest(row, ask, mode)   the request as it would be sent, built from the open section's real state
 *   suggestReply(row, ask, attempt)  a rule-made reply { notes } for that row only; attempt 0, 1, 2 give the three variants
 *   fitSuggestion(row, reply, mode)  → { cells, count, leftOut }: the notes that would land in the row, as row cells
 *   writeSuggestion(row, cells, mode) writes them into the row
 * Notes in a request or reply use plain-English fields: step (1 is the first), note ("C2") or hit (drums), length
 * (steps, tunes only), loudness (1 to 100), chance (%), timing (−50 early to 50 late), repeat; glide only when on.
 */

const SUGGEST_PROVIDERS = {
  anthropic: { name: "Anthropic", models: ["Claude Opus 5.5", "Claude Sonnet 5.5", "Claude Haiku 5.5"] },
  openai: { name: "OpenAI", models: null },
  openrouter: { name: "OpenRouter", models: null },
};
const SUGGEST_DEFAULT = { provider: "anthropic", model: "Claude Sonnet 5.5", keys: {} };
const SUGGEST_KEY = "meloxia-mockup-suggest";

let SUGGEST = { ...SUGGEST_DEFAULT };
try {
  SUGGEST = { ...SUGGEST_DEFAULT, ...JSON.parse(localStorage.getItem(SUGGEST_KEY) ?? "{}") };
} catch {
  // No storage: start without a key.
}

function saveSuggest() {
  try {
    localStorage.setItem(SUGGEST_KEY, JSON.stringify(SUGGEST));
  } catch {
    // No storage: the settings last until the tab closes.
  }
}

const hasKey = () => !!SUGGEST.keys[SUGGEST.provider];
const modelsOf = (provider) => SUGGEST_PROVIDERS[provider].models ?? ["Default model"];
const suggestWhere = () => `${SUGGEST_PROVIDERS[SUGGEST.provider].name} · ${SUGGEST.model}`;

/* ---------- the request: the section as it is ---------- */

const familyOf = (id) => {
  const it = typeof libOf === "function" ? libOf(id) : null;
  return (it && LIB_FAMILIES.find(([key]) => key === it.fam)?.[1]) ?? inst(id).tag ?? inst(id).group;
};

function noteOut(n, s, pitched) {
  const out = { step: s + 1 };
  if (pitched) Object.assign(out, { note: noteName(n.pitch), length: n.len });
  else out.hit = true;
  Object.assign(out, { loudness: n.loud, chance: n.chance, timing: n.nudge, repeat: n.repeat });
  if (n.glide) out.glide = true;
  return out;
}

const rowNotesOut = (r) => {
  const pitched = melodic(inst(r.inst));
  return r.cells.flatMap((_, s) => notesAt(r, s).map((n) => noteOut(n, s, pitched)));
};

function suggestRequest(target, ask, mode) {
  const steps = edSec.bars * STEPS_PER_BAR;
  return {
    ask,
    row: inst(target.inst).name,
    mode: mode === "replace" ? "replace the row's notes" : "add to the row's notes",
    song: { key: $(".key")?.textContent ?? "C minor", "beats per minute": state.bpm },
    section: {
      name: edSec.name,
      "length in bars": edSec.bars,
      steps,
      "steps per beat": 4,
      "beats per minute": edSec.bpm ?? state.bpm,
      swing: edSec.swing ?? state.song.swing,
    },
    instruments: edSec.rows.map((r) => ({
      name: inst(r.inst).name,
      kind: melodic(inst(r.inst)) ? "tune" : "drum",
      family: familyOf(r.inst),
      notes: rowNotesOut(r),
    })),
  };
}

/* ---------- pretend replies: small rules over the section's real content ---------- */

const wants = (ask, re) => re.test(ask.toLowerCase());
const BUSIER = /busier|more|faster|energ|groov|drive/;
const SIMPLER = /simpl|less|fewer|calm|sparse|thin|quiet/;
const vary = (k, base, spread) => clamp(1, base + (((k * 37) % 11) - 5) * spread, 100);

/** Steps where the section's kick (or its first drum row) plays; the beats when there is none. */
function kickSteps(steps) {
  const drums = edSec.rows.filter((r) => !melodic(inst(r.inst)));
  const kick = drums.find((r) => r.inst === "kick") ?? drums[0];
  const hits = kick ? kick.cells.flatMap((c, s) => (c ? [s] : [])) : [];
  return hits.length ? hits : Array.from({ length: steps / 4 }, (_, k) => k * 4);
}

const DRUM_RULES = {
  // [steady, moving, sparse]; each a function of the step within the bar
  kick: [(b) => b % 4 === 0, (b) => [0, 6, 8, 11, 14].includes(b), (b) => b === 0 || b === 10],
  back: [(b) => b === 4 || b === 12, (b) => b === 4 || b === 12 || b === 15, (b) => b === 12],
  hat: [(b) => b % 2 === 0, () => true, (b) => b % 4 === 2],
  open: [(b) => b % 4 === 2, (b) => b % 8 === 6, (b) => b === 14],
  fill: [(b, bar, bars) => bar === bars - 1 && b >= 12, (b, bar, bars) => bar === bars - 1 && b >= 8 && b % 2 === 0, (b, bar, bars) => bar === bars - 1 && b === 15],
};
const drumFamily = (id) => ({ kick: "kick", snare: "back", clap: "back", rim: "back", hat: "hat", shaker: "hat", ohat: "open", tom: "fill" })[id] ?? "hat";

function drumReply(target, ask, variant, steps) {
  const family = drumFamily(target.inst);
  const rule = DRUM_RULES[family][variant];
  const bars = steps / STEPS_PER_BAR;
  const notes = [];
  for (let s = 0; s < steps; s++) {
    const b = s % STEPS_PER_BAR;
    let on = rule(b, Math.floor(s / STEPS_PER_BAR), bars);
    if (wants(ask, BUSIER) && family !== "fill") on ||= b % 4 === 3 && s % 8 === 7;
    if (wants(ask, SIMPLER)) on &&= b % 4 === 0 || family === "back";
    if (!on) continue;
    const beat = b % 4 === 0;
    const hit = { step: s + 1, hit: true, loudness: beat ? vary(s, 92, 1) : vary(s, 60, 4), chance: 100, timing: 0, repeat: 1 };
    if (family === "hat" && !beat) hit.timing = 8; // a lazy off-beat
    if (family === "back" && b === 15) Object.assign(hit, { loudness: 34, chance: 60 }); // a ghost before the bar
    if (family === "fill" && b === 15) hit.repeat = 2;
    notes.push(hit);
  }
  return notes;
}

// Each bar's chord, as steps up the song's scale: i, VI, III, VII.
const BAR_ROOTS = [0, 5, 2, 6];

function tuneReply(target, ask, variant, steps) {
  const instrument = inst(target.inst);
  const scale = lanesFor(instrument).reverse(); // two octaves of the key, low to high
  const up = wants(ask, /higher|brighter|up/) ? 7 : 0;
  const pick = (degree) => scale[clamp(0, degree + up, scale.length - 1)];
  const rootAt = (s) => BAR_ROOTS[Math.floor(s / STEPS_PER_BAR) % BAR_ROOTS.length];
  const chords = /pad|keys/.test(instrument.id) || wants(ask, /chord/);
  const at = (s, degree, length, loudness, extra = {}) => ({ step: s + 1, note: noteName(pick(degree)), length, loudness, chance: 100, timing: 0, repeat: 1, ...extra });
  const notes = [];

  if (chords && variant !== 2) {
    // held chords, one or two a bar
    const every = variant === 0 || wants(ask, SIMPLER) ? STEPS_PER_BAR : STEPS_PER_BAR / 2;
    for (let s = 0; s < steps; s += every) {
      const root = rootAt(s);
      for (const d of [0, 2, 4]) notes.push(at(s, root + d, every, vary(s + d, 72, 2)));
    }
    return notes;
  }
  if (variant === 0) {
    // follows the kick, each note held to the next kick
    const hits = kickSteps(steps).filter((s, k, all) => !wants(ask, SIMPLER) || s % 8 === 0 || k === all.length - 1);
    hits.forEach((s, k) => {
      const next = hits[k + 1] ?? steps;
      notes.push(at(s, rootAt(s), clamp(1, next - s, 4), vary(s, 86, 2)));
    });
    if (wants(ask, BUSIER)) for (let s = 2; s < steps; s += 4) if (!hits.includes(s)) notes.push(at(s, rootAt(s) + 7, 1, vary(s, 58, 3)));
    return notes;
  }
  if (variant === 1) {
    // off-beat pulses between root and fifth
    for (let s = 0; s < steps; s += wants(ask, SIMPLER) ? 4 : 2) notes.push(at(s, rootAt(s) + (s % 4 === 2 ? 4 : 0), 1, s % 4 === 0 ? vary(s, 88, 1) : vary(s, 62, 3)));
    return notes;
  }
  // a short line up the chord, and two notes that run past the section's end (the reply is not trusted to fit)
  const shape = [0, 2, 4, 7, 4, 2];
  for (let s = 0, k = 0; s < steps; s += 3, k++) notes.push(at(s, rootAt(s) + shape[k % shape.length], k % 3 === 2 ? 3 : 2, vary(k, 78, 3), k % 4 === 3 && instrument.kind === "synth" ? { glide: true } : {}));
  notes.push(at(steps, 0, 2, 80), at(steps + 2, 4, 2, 70));
  return notes;
}

function suggestReply(target, ask, attempt) {
  const steps = edSec.bars * STEPS_PER_BAR;
  const variant = attempt % 3;
  const notes = melodic(inst(target.inst)) ? tuneReply(target, ask, variant, steps) : drumReply(target, ask, variant, steps);
  if (!melodic(inst(target.inst)) && variant === 2) notes.push({ step: steps + 1, hit: true, loudness: 80, chance: 100, timing: 0, repeat: 1 }, { step: steps + 3, hit: true, loudness: 70, chance: 100, timing: 0, repeat: 1 });
  return { notes };
}

/* ---------- from a reply to the row ---------- */

const pitchOf = (name) => {
  const m = name.match(/^(.+?)(-?\d+)$/);
  return NOTE_NAMES.indexOf(m[1]) + 12 * (Number(m[2]) + 1);
};

const noteIn = (o, pitched) => {
  const extra = { loud: o.loudness, chance: o.chance, nudge: o.timing, repeat: o.repeat };
  return pitched ? tone(pitchOf(o.note), o.length, { ...extra, glide: !!o.glide }) : note(extra);
};

/** The notes that would land: inside the section, and under Add only where the row has room. */
function fitSuggestion(target, reply, mode) {
  const steps = target.cells.length;
  const pitched = melodic(inst(target.inst));
  const cells = Array.from({ length: steps }, () => (pitched ? [] : null));
  let count = 0;
  let leftOut = 0;
  for (const o of reply.notes) {
    const s = o.step - 1;
    if (s < 0 || s >= steps) {
      leftOut++;
      continue;
    }
    const n = noteIn(o, pitched);
    if (pitched) {
      n.len = Math.min(n.len, steps - s);
      // under Add, a note never overlaps one of the same pitch already in the row
      if (mode !== "replace" && !isFree(target, n.pitch, s, n.len, null)) continue;
      if (!isFree({ cells }, n.pitch, s, n.len, null)) continue;
      cells[s].push(n);
    } else {
      if (mode !== "replace" && target.cells[s]) continue;
      cells[s] = n;
    }
    count++;
  }
  return { cells, count, leftOut };
}

function writeSuggestion(target, cells, mode) {
  const pitched = melodic(inst(target.inst));
  if (mode === "replace") target.cells = cells.map((c) => (pitched ? [...c] : c));
  else cells.forEach((c, s) => (pitched ? target.cells[s].push(...c) : c && (target.cells[s] = c)));
}
