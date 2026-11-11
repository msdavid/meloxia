// Checks for flow-logic.js. Run: node mockups/app/flow-logic.check.mjs  (prints PASS / FAIL per case)
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("./flow-logic.js", import.meta.url), "utf8");
const F = vm.runInNewContext(`${src}\n;flowLogic`, {});
let passed = 0, failed = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function test(name, fn) {
  try { const r = fn(); if (r === true) { passed++; console.log(`PASS ${name}`); } else { failed++; console.log(`FAIL ${name}: ${JSON.stringify(r)}`); } }
  catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); }
}
const want = (got, exp) => (eq(got, exp) ? true : { got, expected: exp });
const sec = (id, bars = 1, more = {}) => ({ id, name: id, bars, ...more });
const names = (r) => r.steps.map((s) => (s.kind === "together" ? `[${s.branches.map((b) => b.items.map((i) => i.block).join("+")).join("|")}]` : s.block));
const song = (sections, edges, blocks = [], bpm = 120) => ({ bpm, sections, blocks, edges });

/* always, length */
const chain = song([sec("A", 2), sec("B", 2, { repeats: 2 }), sec("C", 1)], [{ from: "start", to: "A" }, { from: "A", to: "B" }, { from: "B", to: "C" }]);
test("always: a chain plays in order and ends", () => { const r = F.resolve(chain); return want([names(r), r.status], [["A", "B", "C"], "ends"]); });
test("length: bars include repeats, seconds at 120 bpm", () => { const r = F.resolve(chain); return want([r.bars, r.seconds], [7, 14]); });

/* count */
const countFirst = song([sec("A"), sec("B")], [{ from: "start", to: "A" }, { from: "A", to: "A", rule: { type: "count", first: 2 } }, { from: "A", to: "B", rule: { type: "otherwise" } }]);
test("count first 2: A plays 3 times, then otherwise to B", () => { const r = F.resolve(countFirst); return want(names(r), ["A", "A", "A", "B"]); });
test("count: pass numbers and which rule fired", () => { const r = F.resolve(countFirst); return want(r.steps.map((s) => `${s.pass}:${s.leave?.rule ?? "end"}`), ["1:count", "2:count", "3:otherwise", "1:end"]); });
const countPasses = song([sec("A"), sec("B"), sec("C")], [{ from: "start", to: "A" }, { from: "A", to: "B", rule: { type: "count", passes: [2] } }, { from: "A", to: "C", rule: { type: "otherwise" } }, { from: "C", to: "A", rule: { type: "count", first: 1 } }]);
test("count passes [2]: taken only on the second pass", () => want(names(F.resolve(countPasses)), ["A", "C", "A", "B"]));

/* chance */
const chance = (pct) => song([sec("A"), sec("B"), sec("C")], [{ from: "start", to: "A" }, { from: "A", to: "B", rule: { type: "chance", pct } }, { from: "A", to: "C", rule: { type: "otherwise" } }]);
test("chance: same seed, same path", () => { const a = [], b = []; for (let s = 0; s < 40; s++) { a.push(names(F.resolve(chance(50), { seed: s }))[1]); b.push(names(F.resolve(chance(50), { seed: s }))[1]); } return want(a, b); });
test("chance 30%: about 30% over 4000 seeds", () => { let n = 0; for (let s = 0; s < 4000; s++) n += names(F.resolve(chance(30), { seed: s }))[1] === "B"; return Math.abs(n / 4000 - 0.3) < 0.03 || { share: n / 4000 }; });
test("chance 0% never, 100% always", () => { let z = 0, h = 0; for (let s = 0; s < 200; s++) { z += names(F.resolve(chance(0), { seed: s }))[1] === "B"; h += names(F.resolve(chance(100), { seed: s }))[1] === "B"; } return want([z, h], [0, 200]); });
test("chance: the outcome carries a dice mark, even when otherwise wins", () => { const r = F.resolve(chance(0)); return want([r.steps[1].via.dice, r.steps[1].via.rule], [true, "otherwise"]); });
test("seeds: strings work and differ", () => { const a = F.makeRng("night bus"), b = F.makeRng("night bus"), c = F.makeRng("rainy"); const x = a(); return (x === b() && x !== c()) || "rng mismatch"; });

/* take turns */
const turns = song([sec("A"), sec("B"), sec("C")], [{ from: "start", to: "A" }, { from: "A", to: "B", rule: { type: "turns" } }, { from: "A", to: "C", rule: { type: "turns" } }, { from: "B", to: "A" }, { from: "C", to: "A", rule: { type: "count", first: 2 } }]);
test("take turns: A alternates B, C until C's count runs out", () => { const r = F.resolve(turns); return want([names(r).join(""), r.status], ["ABACABACABAC", "ends"]); });

/* on cue */
const cue = song([sec("A"), sec("B")], [{ from: "start", to: "A" }, { id: "cueB", from: "A", to: "B", rule: { type: "cue" } }, { from: "A", to: "A" }]);
test("on cue, not armed: not taken, song is endless", () => { const r = F.resolve(cue); return want([names(r), r.status, r.loopsBackTo], [["A"], "endless", 0]); });
test("on cue: the step lists the cue that can be armed", () => want(F.resolve(cue).steps[0].cues, ["cueB"]));
test("on cue, armed: taken once, then the arming is used up", () => { const w = F.walker(cue); const s = [w.next().block, w.next().block]; w.arm("cueB"); s.push(w.next().block, w.next()?.block ?? "end"); return want(s, ["A", "A", "B", "end"]); });
test("on cue after an always exit: unreachable, no Cue button", () => { const g = song([sec("A"), sec("B"), sec("C")], [{ from: "start", to: "A" }, { from: "A", to: "C" }, { id: "late", from: "A", to: "B", rule: { type: "cue" } }]); return want(F.resolve(g).steps[0].cues, []); });

/* otherwise, check */
test("otherwise: taken when nothing before it fires", () => want(names(F.resolve(chance(0))), ["A", "C"]));
test("check: an exit after 'always' is flagged as never taken", () => { const g = song([sec("A"), sec("B"), sec("C")], [{ from: "start", to: "A" }, { from: "A", to: "B" }, { from: "A", to: "C", rule: { type: "otherwise" } }]); return want(F.check(g).map((p) => p.type), ["unreachable"]); });

/* endless */
test("endless: A -> B -> A, no way out", () => { const r = F.resolve(song([sec("A"), sec("B")], [{ from: "start", to: "A" }, { from: "A", to: "B" }, { from: "B", to: "A" }])); return want([names(r), r.status, r.loopsBackTo, r.seconds], [["A", "B"], "endless", 0, null]); });
test("endless after a count runs out: stops where it repeats", () => { const g = song([sec("A"), sec("B")], [{ from: "start", to: "A" }, { from: "A", to: "A", rule: { type: "count", first: 2 } }, { from: "A", to: "B", rule: { type: "otherwise" } }, { from: "B", to: "A" }]); const r = F.resolve(g); return want([names(r), r.status, r.loopsBackTo], [["A", "A", "A", "B", "A"], "endless", 3]); });
test("endless with chance inside the loop (both ways loop back)", () => { const g = song([sec("A"), sec("B"), sec("C")], [{ from: "start", to: "A" }, { from: "A", to: "B", rule: { type: "chance", pct: 50 } }, { from: "A", to: "C", rule: { type: "otherwise" } }, { from: "B", to: "A" }, { from: "C", to: "A" }]); return want(F.resolve(g, { seed: 7 }).status, "endless"); });
test("not endless: a chance way out always ends within the limit", () => { const g = song([sec("A"), sec("B")], [{ from: "start", to: "A" }, { from: "A", to: "A", rule: { type: "chance", pct: 50 } }, { from: "A", to: "B", rule: { type: "otherwise" } }]); for (let s = 0; s < 100; s++) if (F.resolve(g, { seed: s, limit: 200 }).status !== "ends") return `seed ${s}`; return true; });
test("limit: a long chance loop stops at the step limit", () => { const g = song([sec("A"), sec("B")], [{ from: "start", to: "A" }, { from: "A", to: "A", rule: { type: "chance", pct: 99 } }, { from: "A", to: "B", rule: { type: "otherwise" } }]); const r = F.resolve(g, { seed: 3, limit: 10 }); return want([r.status, r.steps.length], ["limit", 10]); });

/* play together */
const par = (split, extra = {}) => song(
  [sec("A", 2, { key: "C minor", instruments: ["kick", "bass"] }), sec("B", 2, { instruments: ["kick", "lead"], ...extra.B }), sec("C", 2), sec("D", 1)],
  [{ from: "start", to: "S" }, { from: "S", to: "A" }, { from: "S", to: "B" }, { from: "A", to: "J" }, { from: "B", to: "C" }, { from: "C", to: "J" }, ...(extra.edges ?? [{ from: "J", to: "D" }])],
  [{ id: "S", kind: "split", join: "J", ...split }, { id: "J", kind: "join" }],
);
const group = (g) => F.resolve(g).steps[0];
test("together: branches are grouped in one step, then the song goes on", () => { const r = F.resolve(par({})); return want([names(r), r.bars], [["[A|B+C]", "D"], 5]); });
test("who ends it, Longest: 4 bars; the shorter branch keeps looping (2 plays)", () => { const s = group(par({ ends: "longest" })); return want([s.bars, s.branches[0].fill, s.branches[0].plays, s.tempoFrom], [4, "loop", 2, 1]); });
test("who ends it, Shortest: 2 bars; the longer branch is cut", () => { const s = group(par({ ends: "shortest" })); return want([s.bars, s.branches[1].cut, s.branches[1].plays], [2, true, 0.5]); });
test("who ends it, Leader: the leader's length decides", () => { const s = group(par({ ends: "leader", leader: 0 })); return want([s.bars, s.leader, s.tempoFrom], [2, 0, 0]); });
test("shorter branches, Fall silent: plays once, then 2 silent bars", () => { const s = group(par({ shorter: "silent" })); return want([s.branches[0].plays, s.branches[0].silentBars], [1, 2]); });
test("same instrument, Leader only: shared instruments muted outside the leader", () => want(group(par({ same: "leader" })).branches[0].muted, ["kick"]));
test("keys differ: a warning chip", () => want(group(par({}, { B: { key: "D minor" } })).warnings.map((w) => w.type), ["keys"]));
test("together: pass numbers inside branches count loop plays", () => { const g = par({}, { edges: [{ from: "J", to: "S", rule: { type: "count", first: 1 } }, { from: "J", to: "D", rule: { type: "otherwise" } }] }); const r = F.resolve(g); return want([names(r), r.steps[1].branches[0].items[0].pass, r.steps[1].pass], [["[A|B+C]", "[A|B+C]", "D"], 3, 2]); });

/* refusals */
const open = song([sec("A"), sec("B"), sec("C"), sec("D"), sec("E")], [{ from: "start", to: "D" }, { from: "D", to: "S" }, { from: "S", to: "A" }, { from: "A", to: "J" }, { from: "S", to: "B" }, { from: "B", to: "C" }], [{ id: "S", kind: "split", join: "J" }, { id: "J", kind: "join" }, { id: "T", kind: "tempo", bpm: 90 }]);
const refused = (from, to, word) => () => { const r = F.canConnect(open, from, to); return (r && r.includes(word)) || { got: r }; };
test("refused: a second exit inside a branch (a fork)", refused("A", "E", "can't fork"));
test("refused: a loop back inside a branch", refused("C", "B", "loop back"));
test("refused: jumping out of the group to an earlier block", refused("C", "D", "loop back"));
test("refused: Play together inside a branch", refused("C", "S", "inside another"));
test("refused: Tempo change inside a branch", refused("C", "T", "One speed"));
test("refused: entering a branch from outside", refused("D", "B", "Play together bar"));
test("refused: into the join from outside", refused("E", "J", "own branches"));
test("refused: back to Start", refused("A", "start", "Start"));
test("refused: a 7th branch", () => { const g = song("ABCDEFG".split("").map((x) => sec(x)), [{ from: "start", to: "S" }, ..."ABCDEF".split("").flatMap((x) => [{ from: "S", to: x }, { from: x, to: "J" }])], [{ id: "S", kind: "split", join: "J" }, { id: "J", kind: "join" }]); return (F.canConnect(g, "S", "G") ?? "").includes("up to 6") || "allowed"; });
test("allowed: finishing a branch at its join, a new branch, a fork outside", () => want([F.canConnect(open, "C", "J"), F.canConnect(open, "S", "E"), F.canConnect(open, "D", "E")], [null, null, null]));
test("check: a fork inside a branch is reported", () => { const g = structuredClone(open); g.edges.push({ from: "C", to: "J" }, { from: "A", to: "E" }); return F.check(g).some((p) => p.type === "fork") || F.check(g); });

/* playback helpers: fork for the preview, update for edits while playing */
test("fork: a copy predicts exactly what the walker plays next", () => { const w = F.walker(chance(50), { seed: 11 }); w.next(); const preview = F.collect(w.fork(), 120).steps.map((s) => s.block); const real = []; for (let s; (s = w.next()); ) real.push(s.block); return want(preview, real); });
test("update: an edit while playing applies at the next decision, counters carry on", () => { const w = F.walker(countFirst); w.next(); const g = structuredClone(countFirst); g.edges[1].rule = { type: "count", first: 0 }; w.update(g); return want([w.next().block, w.next()], ["B", null]); });

/* labels, tempo block */
test("chip labels", () => want(["always", "count", "count", "chance", "turns", "cue", "otherwise"].map((type, i) => F.ruleLabel([{ type }, { type, first: 2 }, { type, passes: [2, 4] }, { type, pct: 30 }, { type }, { type }, { type }][i])), ["", "first 2 times", "passes 2, 4", "30%", "take turns", "on cue", "otherwise"]));
test("tempo change block: later sections use its speed", () => { const g = song([sec("A")], [{ from: "start", to: "T" }, { from: "T", to: "A" }], [{ id: "T", kind: "tempo", bpm: 60 }]); const r = F.resolve(g); return want([names(r), r.seconds], [["T", "A"], 4]); });

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
