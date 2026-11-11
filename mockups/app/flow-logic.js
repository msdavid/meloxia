"use strict";
// Song flow logic (area A), no DOM. The song graph, its connection rules, a seeded random source, and the
// resolver that walks the graph into a play order. The path preview strip and the pretend playback are thin
// layers over `resolve` and `walker`. Loaded as a plain script (global `flowLogic`); flow-logic.check.mjs
// runs it in Node.
//
// Graph: { bpm, sections: [{ id, name, bars, repeats?, key?, instruments? }], blocks: [{ id, kind, ... }],
//          edges: [{ id?, from, to, rule? }] }. "start" is the implicit Start block.
//   kind "split": { join, ends: "longest" | "shortest" | "leader", leader?: branch index (default: the longest),
//                   shorter: "loop" | "silent", same: "both" | "leader" }. Its exits are the branches, in order.
//   kind "join": the barrier where the branches meet. kind "tempo" (the demo plugin block): { bpm }, takes no time.
//   kind "note": a sticky note, ignored by the flow.
// A block's exits are checked in the order they appear in `edges`. Rules (a missing rule means always):
//   { type: "always" } · { type: "count", first: N } or { type: "count", passes: [2, 4] } · { type: "chance", pct }
//   · { type: "turns" } · { type: "cue" } (taken only when armed) · { type: "otherwise" }.
// A pass is one time through a block, its repeats included. Pass numbers count from 1.

const flowLogic = (() => {
  const MAX_BRANCHES = 6;
  const BEATS_PER_BAR = 4;

  /* ---------- seeded random source: mulberry32, seeded from a number or a string ---------- */

  function makeRng(seed = 1) {
    let a = typeof seed === "number" ? seed >>> 0 : [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.fork = () => { const r = makeRng(0); r.load(a); return r; }; // same sequence from here, independently
    next.load = (v) => (a = v);
    return next;
  }

  /* ---------- the graph, normalised once per call ---------- */

  function normalize(input) {
    if (input?.isFlowGraph) return input;
    const blocks = new Map([["start", { id: "start", kind: "start" }]]);
    for (const s of input.sections ?? []) blocks.set(s.id, { kind: "section", ...s });
    for (const b of input.blocks ?? []) blocks.set(b.id, b);
    const edges = (input.edges ?? []).map((e) => ({ ...e, id: e.id ?? `${e.from}>${e.to}`, rule: e.rule ?? { type: "always" } }));
    const outs = new Map();
    for (const e of edges) outs.set(e.from, [...(outs.get(e.from) ?? []), e]);
    const out = (id) => outs.get(id) ?? [];
    // Count rules only care about passes up to their largest number; take-turns rotates through its exits.
    const caps = new Map(), turns = new Map();
    for (const [id, list] of outs) {
      const cap = Math.max(0, ...list.filter((e) => e.rule.type === "count").map((e) => Math.max(e.rule.first ?? 0, ...(e.rule.passes ?? []))));
      if (cap) caps.set(id, cap);
      const m = list.filter((e) => e.rule.type === "turns").length;
      if (m) turns.set(id, m);
    }
    return { isFlowGraph: true, bpm: input.bpm ?? 120, blocks, edges, out, caps, turns };
  }

  const lengthOf = (b) => (b?.kind === "section" ? (b.bars ?? 1) * (b.repeats ?? 1) : 0);

  function ruleLabel(rule) {
    const r = rule ?? { type: "always" };
    if (r.type === "count") {
      if (r.first != null) return r.first === 1 ? "first time" : `first ${r.first} times`;
      const p = r.passes ?? [];
      return p.length === 1 ? `pass ${p[0]}` : `passes ${p.join(", ")}`;
    }
    return { always: "", chance: `${r.pct}%`, turns: "take turns", cue: "on cue", otherwise: "otherwise" }[r.type] ?? "";
  }

  const countFires = (r, pass) => (r.first != null ? pass <= r.first : (r.passes ?? []).includes(pass));
  // An exit that, once reached, is certainly taken: nothing after it is ever checked.
  const certain = (r, pass) => r.type === "always" || r.type === "otherwise" || r.type === "turns" || (r.type === "chance" && r.pct >= 100) || (r.type === "count" && countFires(r, pass));

  /* ---------- deciding an exit ---------- */

  // The walker's decision: rolls chance, rotates turns, takes an armed cue. edge null = the song ends here.
  function decide(exits, pass, turn, rng, armed) {
    const rolls = [];
    const turnExits = exits.filter((e) => e.rule.type === "turns");
    for (const e of exits) {
      const r = e.rule;
      if (r.type === "chance") {
        const roll = rng() * 100;
        rolls.push(Math.floor(roll));
        if (roll < r.pct) return { edge: e, rolls };
      } else if (r.type === "turns") return { edge: turnExits[turn % turnExits.length], rolls, turned: true };
      else if (r.type === "cue") { if (armed.has(e.id)) return { edge: e, rolls, cued: true }; }
      else if (certain(r, pass)) return { edge: e, rolls };
    }
    return { edge: null, rolls };
  }

  // Every exit the song could take from here without anyone pressing a cue (null = it can end here).
  function outcomes(exits, pass, turn) {
    const found = [];
    const turnExits = exits.filter((e) => e.rule.type === "turns");
    for (const e of exits) {
      const r = e.rule;
      if (r.type === "turns") return [...found, { edge: turnExits[turn % turnExits.length], turned: true }];
      if (r.type === "chance" && r.pct > 0 && r.pct < 100) found.push({ edge: e });
      else if (r.type !== "cue" && certain(r, pass)) return [...found, { edge: e }];
    }
    return [...found, { edge: null }];
  }

  // Exits with an "on cue" rule that are still checked on this pass: the ones a Cue button can arm.
  function cuesOf(exits, pass) {
    const cues = [];
    for (const e of exits) {
      if (e.rule.type === "cue") cues.push(e.id);
      else if (certain(e.rule, pass)) break;
    }
    return cues;
  }

  /* ---------- Play together: branches, membership, the group's shape ---------- */

  // Each exit of a split is a branch: a straight chain of sections that ends at the split's join.
  function branchesOf(input, splitId) {
    const G = normalize(input);
    const split = G.blocks.get(splitId);
    return G.out(splitId).map((e) => {
      const ids = [], seen = new Set();
      let at = e.to, problem = null;
      while (at !== split.join) {
        const b = G.blocks.get(at);
        if (!b) { problem = "dead end"; break; }
        if (seen.has(at)) { problem = "loop"; break; }
        if (b.kind !== "section") { problem = b.kind === "split" ? "nested" : "not a section"; break; }
        seen.add(at);
        ids.push(at);
        const outs = G.out(at);
        if (outs.length !== 1) { problem = outs.length ? "fork" : "dead end"; break; }
        at = outs[0].to;
      }
      return { edge: e.id, ids, problem };
    });
  }

  // blockId -> { split, branch } for every block that sits inside a branch.
  function membership(input) {
    const G = normalize(input);
    const m = new Map();
    for (const b of G.blocks.values())
      if (b.kind === "split") branchesOf(G, b.id).forEach((br, branch) => br.ids.forEach((id) => m.has(id) || m.set(id, { split: b.id, branch })));
    return m;
  }

  function groupOf(G, split, passOf) {
    const brs = branchesOf(G, split.id).map((br) => {
      const items = br.ids.map((id) => ({ block: id, name: G.blocks.get(id).name ?? id, bars: lengthOf(G.blocks.get(id)) }));
      return { edge: br.edge, items, bars: items.reduce((a, i) => a + i.bars, 0), problem: br.problem };
    });
    const longest = brs.reduce((best, b, i) => (b.bars > brs[best].bars ? i : best), 0);
    const leader = Math.min(Math.max(split.leader ?? longest, 0), brs.length - 1);
    const ends = split.ends ?? "longest", shorter = split.shorter ?? "loop";
    const bars = !brs.length ? 0 : ends === "shortest" ? Math.min(...brs.map((b) => b.bars)) : ends === "leader" ? brs[leader].bars : Math.max(...brs.map((b) => b.bars));
    const instOf = (b) => new Set(b.items.flatMap((i) => G.blocks.get(i.block).instruments ?? []));
    const leaderInst = brs.length ? instOf(brs[leader]) : new Set();
    for (const [i, b] of brs.entries()) {
      b.fill = null; b.plays = 1; b.silentBars = 0; b.cut = false;
      if (b.bars && b.bars < bars) {
        b.fill = shorter;
        if (shorter === "loop") b.plays = bars / b.bars;
        else b.silentBars = bars - b.bars;
      } else if (b.bars > bars) { b.cut = true; b.plays = bars / b.bars; }
      b.muted = split.same === "leader" && i !== leader ? [...instOf(b)].filter((x) => leaderInst.has(x)) : [];
      // Pass numbers inside a branch count every play-through, loops included.
      const times = b.fill === "loop" ? Math.ceil(b.plays - 1e-9) : 1;
      for (const item of b.items) { item.pass = passOf(item.block) + 1; passOf(item.block, times); }
    }
    const keys = new Set(brs.flatMap((b) => b.items.map((i) => G.blocks.get(i.block).key).filter(Boolean)));
    const warnings = [];
    if (keys.size > 1) warnings.push({ type: "keys", text: `The branches are in different keys: ${[...keys].join(", ")}` });
    if (brs.some((b) => b.problem)) warnings.push({ type: "shape", text: "A branch does not reach the join in a straight line" });
    return { branches: brs, bars, ends, shorter, same: split.same ?? "both", leader, tempoFrom: leader, warnings };
  }

  /* ---------- can the song still end? ---------- */

  // What entering `at` does: which blocks gain a pass and which block's exits decide where to go next.
  function entering(G, at) {
    const b = G.blocks.get(at);
    if (b?.kind !== "split") return { entered: [at], decider: at };
    const inside = branchesOf(G, at).flatMap((br) => br.ids);
    return { entered: [at, ...inside, b.join], decider: b.join };
  }

  // Counters capped where rules stop telling passes apart, so the states form a finite set.
  function keyOf(G, at, pass, turn) {
    const p = [...G.caps].map(([id, cap]) => Math.min(pass[id] ?? 0, cap + 1));
    const t = [...G.turns].map(([id, m]) => (turn[id] ?? 0) % m);
    return `${at}|${p}|${t}`;
  }

  // Search every way the song could go from here (each chance either way, no cue pressed). True if any ends.
  function canEnd(G, at, pass, turn) {
    const seen = new Set(), stack = [[at, pass, turn]];
    while (stack.length) {
      const [a, p0, t0] = stack.pop();
      if (a == null || !G.blocks.has(a)) return true;
      const k = keyOf(G, a, p0, t0);
      if (seen.has(k)) continue;
      seen.add(k);
      if (seen.size > 20000) return true; // too big to prove endless: say it can end
      const { entered, decider } = entering(G, a);
      const p = { ...p0 };
      for (const id of entered) if (G.caps.has(id)) p[id] = Math.min((p[id] ?? 0) + 1, G.caps.get(id) + 1);
      for (const o of outcomes(G.out(decider), p[decider] ?? 1, t0[decider] ?? 0)) {
        const t = o.turned ? { ...t0, [decider]: ((t0[decider] ?? 0) + 1) % G.turns.get(decider) } : t0;
        stack.push([o.edge ? o.edge.to : null, p, t]);
      }
    }
    return false;
  }

  /* ---------- the walker: one step at a time, for playback; resolve() runs it to the end ---------- */

  function walker(input, { seed = 1, armed = [] } = {}, from = null) {
    let G = normalize(input);
    const st = from ?? { at: null, via: null, pass: {}, turn: {}, armed: new Set(armed), rng: makeRng(seed), prev: null, bar: 0, done: false, endless: false, key: "" };
    const passOf = (id, add = 0) => (st.pass[id] = (st.pass[id] ?? 0) + add);

    // Leave a block: decide its exit now, at the end of its pass, so a cue armed during the pass counts.
    function leave(decider, step) {
      const d = decide(G.out(decider), st.pass[decider] ?? 1, st.turn[decider] ?? 0, st.rng, st.armed);
      if (d.turned) st.turn[decider] = (st.turn[decider] ?? 0) + 1;
      if (d.cued) st.armed.delete(d.edge.id);
      const info = d.edge ? { edge: d.edge.id, from: decider, to: d.edge.to, rule: d.edge.rule.type, label: ruleLabel(d.edge.rule), dice: d.rolls.length > 0, rolls: d.rolls } : null;
      if (step) step.leave = info;
      st.via = info;
      st.at = info ? info.to : null;
      st.key = keyOf(G, st.at, st.pass, st.turn);
      if (!st.endless && st.at != null) st.endless = !canEnd(G, st.at, st.pass, st.turn);
    }
    if (!from) leave("start", null);

    function enter(at) {
      const b = G.blocks.get(at);
      const base = { block: at, start: st.bar, via: st.via };
      if (b.kind === "split") {
        passOf(at, 1);
        const group = groupOf(G, b, passOf);
        return { ...base, kind: "together", join: b.join, pass: passOf(b.join, 1), ...group, decider: b.join };
      }
      const pass = passOf(at, 1);
      if (b.kind === "tempo") return { ...base, kind: "tempo", pass, bpm: b.bpm, bars: 0, decider: at };
      if (b.kind === "section") return { ...base, kind: "section", name: b.name ?? at, pass, bars: lengthOf(b), decider: at };
      return { ...base, kind: b.kind, pass, bars: 0, decider: at };
    }

    return {
      get endless() { return st.endless; },
      get key() { return st.key; },
      get done() { return st.done; },
      get armed() { return [...st.armed]; },
      arm(edgeId) { st.armed.add(edgeId); },
      disarm(edgeId) { st.armed.delete(edgeId); },
      // The song was edited while playing: the next decision uses the new graph, counters carry on.
      update(next) {
        G = normalize(next);
        if (st.prev) st.prev.cues = cuesOf(G.out(st.prev.decider), st.pass[st.prev.decider]);
      },
      // An independent copy from this point (same counters, same dice to come), for previewing what plays next.
      fork() {
        const copy = { ...st, pass: { ...st.pass }, turn: { ...st.turn }, armed: new Set(st.armed), rng: st.rng.fork(), prev: st.prev && { ...st.prev } };
        return walker(G, {}, copy);
      },
      // The next step to play, or null when the song has ended. Call it when the current step's pass ends.
      next() {
        if (st.done) return null;
        if (st.prev) leave(st.prev.decider, st.prev);
        if (st.at == null || !G.blocks.has(st.at)) { st.done = true; return null; }
        const step = enter(st.at);
        step.cues = cuesOf(G.out(step.decider), st.pass[step.decider]);
        st.bar += step.bars;
        st.prev = step;
        return step;
      },
    };
  }

  // The play order: { status: "ends" | "endless" | "limit", steps, loopsBackTo, bars, seconds }.
  // "endless": no way out without a cue; steps stop where the song starts repeating, at loopsBackTo.
  function resolve(input, { seed = 1, limit = 64, armed = [] } = {}) {
    const G = normalize(input);
    return collect(walker(G, { seed, armed }), G.bpm, limit);
  }

  // Runs a walker until the song ends, repeats endlessly, or reaches `limit` steps.
  function collect(w, bpm, limit = 64) {
    const steps = [], seen = new Map();
    let status = "ends", loopsBackTo = null;
    for (;;) {
      if (steps.length >= limit) { status = "limit"; break; }
      const step = w.next(); // w.key is now the state just before this step was entered
      if (!step) break;
      if (w.endless) {
        if (seen.has(w.key)) { status = "endless"; loopsBackTo = seen.get(w.key); break; }
        seen.set(w.key, steps.length);
      }
      step.i = steps.length;
      steps.push(step);
    }
    const finite = status === "ends";
    return { status, steps, loopsBackTo, bars: finite ? steps.reduce((a, s) => a + s.bars, 0) : null, seconds: finite ? secondsOf(steps, bpm) : null };
  }

  function secondsOf(steps, bpm) {
    let t = 0;
    for (const s of steps) {
      if (s.kind === "tempo") bpm = s.bpm;
      t += (s.bars * BEATS_PER_BAR * 60) / bpm;
    }
    return Math.round(t * 1000) / 1000;
  }

  /* ---------- what the canvas may connect, and what it should warn about ---------- */

  // null if from -> to is allowed, else the plain-English reason shown in the refusal tooltip.
  function canConnect(input, from, to) {
    const G = normalize(input);
    const a = G.blocks.get(from), b = G.blocks.get(to);
    if (to === "start") return "Nothing leads back to Start: it is where the song begins.";
    if (!a || !b) return "Connect one block to another.";
    if (a.kind === "note" || b.kind === "note") return "Notes are for writing on. They don't play, so they can't be connected.";
    if (G.edges.some((e) => e.from === from && e.to === to)) return "These blocks are already connected.";
    const m = membership(G), mf = m.get(from), mt = m.get(to);
    if (a.kind === "split") {
      if (G.out(from).length >= MAX_BRANCHES) return `Play together holds up to ${MAX_BRANCHES} branches.`;
      if (to === a.join) return "A branch needs at least one section.";
      if (mt || b.kind !== "section") return "A branch is a section or a chain of sections that no other path uses.";
      return null;
    }
    if (mf) {
      const split = G.blocks.get(mf.split);
      if (G.out(from).length) return "Each branch of Play together plays straight through, so it can't fork into choices. Put the choice before or after the group.";
      if (to === split.join) return null;
      if (b.kind === "split") return "Play together can't go inside another Play together.";
      if (b.kind === "tempo") return "One speed for the whole group, taken from the leader. Put a Speed change before Play together.";
      const used = G.edges.some((e) => e.to === to) || (G.out(to).length && !reaches(G, to, split.join));
      if (mt || used || reaches(G, to, mf.split)) return "A branch can't loop back or jump out of Play together. To repeat, loop the whole group from its join.";
      return null;
    }
    if (mt) return "A branch starts at its Play together bar. Connect to the bar instead.";
    if (b.kind === "join") return "Only the group's own branches lead into its join.";
    return null;
  }

  function reaches(G, from, target) {
    const seen = new Set(), stack = [from];
    while (stack.length) {
      const at = stack.pop();
      if (at === target) return true;
      if (seen.has(at)) continue;
      seen.add(at);
      for (const e of G.out(at)) stack.push(e.to);
    }
    return false;
  }

  // Problems to show on the canvas: [{ at, edge?, type, text }].
  function check(input) {
    const G = normalize(input);
    const problems = [];
    if (!G.out("start").length) problems.push({ at: "start", type: "start", text: "Start isn't connected to anything yet" });
    for (const [id] of G.blocks) {
      const exits = G.out(id);
      const stop = exits.findIndex((e) => certain(e.rule, 1) && !(e.rule.type === "count"));
      for (const e of exits.slice(stop < 0 ? exits.length : stop + 1))
        if (!(exits[stop].rule.type === "turns" && e.rule.type === "turns"))
          problems.push({ at: id, edge: e.id, type: "unreachable", text: `Never taken: "${ruleLabel(exits[stop].rule) || "always"}" comes first` });
    }
    const m = membership(G);
    for (const b of G.blocks.values()) {
      if (b.kind !== "split") continue;
      if (!G.blocks.has(b.join)) problems.push({ at: b.id, type: "join", text: "Play together has no join bar" });
      if (G.out(b.id).length > MAX_BRANCHES) problems.push({ at: b.id, type: "branches", text: `More than ${MAX_BRANCHES} branches` });
      for (const br of branchesOf(G, b.id)) if (br.problem) problems.push({ at: b.id, edge: br.edge, type: br.problem, text: `A branch has a ${br.problem}: branches play straight through to the join` });
    }
    for (const id of m.keys())
      for (const e of G.out(id)) if (e.rule.type !== "always") problems.push({ at: id, edge: e.id, type: "rule-in-branch", text: "Rules don't apply inside Play together" });
    return problems;
  }

  return { MAX_BRANCHES, makeRng, normalize, ruleLabel, branchesOf, membership, walker, resolve, collect, secondsOf, canConnect, check };
})();
