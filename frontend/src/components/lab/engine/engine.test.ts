import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNetlist, connected } from "./netlist.ts";
import { routeLeg } from "./router.ts";
import { runDrc, ledResistor, requiredTraceWidth, segmentCurrents } from "./drc.ts";
import { solveSteady, sampleTransient } from "./solver.ts";
import { MISSIONS, idealNetlist, makeContext, ratsnest } from "./missions.ts";
import { resistorBands } from "./parts.ts";
import { PROJECTS } from "./projects.ts";
import type { Board, Part, Trace } from "./types.ts";

const part = (id: string, type: Part["type"], x: number, y: number, props: Part["props"] = {}, rot: Part["rot"] = 0): Part => ({ id, type, x, y, rot, props });
const trace = (id: string, points: [number, number][], layer: Trace["layer"] = "top", width = 0.4): Trace => ({ id, layer, width, points: points.map(([x, y]) => ({ x, y })) });
const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b} (±${tol})`);

/** Battery at (8,5): + at (8,5), − at (8,7). Resistor R1 from (12,5) to (16,5). */
function ledBoard(ohms: number, extra: Partial<Board> = {}): Board {
  return {
    w: 30,
    h: 16,
    parts: [part("B1", "battery9v", 8, 5), part("R1", "resistor", 12, 5, { value: ohms }), part("D1", "led", 20, 5, { color: "red" })],
    traces: [trace("t1", [[8, 5], [12, 5]]), trace("t2", [[16, 5], [20, 5]]), trace("t3", [[21, 5], [21, 9], [8, 9], [8, 7]])],
    vias: [],
    ...extra,
  };
}

test("traces join pads into nets", () => {
  const nl = buildNetlist(ledBoard(330));
  assert.ok(connected(nl, ["B1.+", "R1.1"]));
  assert.ok(connected(nl, ["R1.2", "D1.A"]));
  assert.ok(connected(nl, ["D1.K", "B1.-"]));
  assert.ok(!connected(nl, ["B1.+", "B1.-"]));
});

test("Ohm's law: a resistor across 9 V", () => {
  const b: Board = { w: 30, h: 16, vias: [], parts: [part("B1", "battery9v", 8, 5), part("R1", "resistor", 12, 5, { value: 1000 })], traces: [trace("a", [[8, 5], [12, 5]]), trace("b", [[16, 5], [16, 7], [8, 7]])] };
  const s = solveSteady(b)!;
  near(s.parts.R1.current, 9 / (1000 + 1.7), 1e-5);
});

test("LED with 330 Ω runs near 20 mA and glows", () => {
  const s = solveSteady(ledBoard(330))!;
  const i = s.parts.D1.current;
  assert.ok(i > 0.017 && i < 0.023, `LED current ${i}`);
  assert.ok(s.parts.D1.glow > 0.8);
  assert.equal(s.parts.D1.burnt, false);
});

test("LED with 10 Ω burns out and DRC flags it", () => {
  const b = ledBoard(10);
  const s = solveSteady(b)!;
  assert.equal(s.parts.D1.burnt, true);
  const codes = runDrc(b, buildNetlist(b), s).map((d) => d.code);
  assert.ok(codes.includes("overcurrent"));
});

test("LED wired straight to the battery is flagged as having no resistor", () => {
  const b: Board = { w: 30, h: 16, vias: [], parts: [part("B1", "battery9v", 8, 5), part("D1", "led", 12, 5)], traces: [trace("a", [[8, 5], [12, 5]]), trace("b", [[13, 5], [13, 7], [8, 7]])] };
  const nl = buildNetlist(b);
  const codes = runDrc(b, nl, solveSteady(b)).map((d) => d.code);
  assert.ok(codes.includes("no-resistor"), codes.join());
});

test("reversed LED does not light and is flagged", () => {
  const b = ledBoard(330, { parts: [part("B1", "battery9v", 8, 5), part("R1", "resistor", 12, 5, { value: 330 }), part("D1", "led", 21, 5, { color: "red" }, 180)] });
  const s = solveSteady(b)!;
  assert.equal(s.parts.D1.glow, 0);
  assert.equal(s.parts.D1.reversed, true);
});

test("a wire across the battery is a short circuit", () => {
  const b: Board = { w: 30, h: 16, vias: [], parts: [part("B1", "battery9v", 8, 5)], traces: [trace("a", [[8, 5], [10, 5], [10, 7], [8, 7]])] };
  const s = solveSteady(b)!;
  assert.ok(s.parts.B1.current > 5);
  assert.ok(runDrc(b, buildNetlist(b), s).some((d) => d.code === "short"));
});

test("crossing traces on one layer short together; a via to the bottom layer does not", () => {
  const cross: Board = {
    w: 30,
    h: 20,
    vias: [],
    parts: [part("B1", "battery9v", 8, 5), part("R1", "resistor", 12, 12, { value: 1000 }), part("R2", "resistor", 20, 3, { value: 1000 })],
    traces: [trace("h", [[8, 5], [24, 5], [24, 3]]), trace("v", [[16, 12], [16, 2], [20, 2], [20, 3]])],
  };
  assert.ok(connected(buildNetlist(cross), ["B1.+", "R1.2"]), "crossing copper joins the nets");
  const b1: Board = { ...ledBoard(330), traces: [...ledBoard(330).traces, trace("x", [[14, 3], [14, 11]])] };
  assert.ok(!connected(buildNetlist(b1), ["B1.+", "B1.-"]), "an isolated stub joins only what it touches");
  const viaBoard: Board = {
    w: 30,
    h: 16,
    parts: [part("B1", "battery9v", 8, 5), part("R1", "resistor", 12, 5, { value: 1000 })],
    vias: [{ id: "v1", x: 10, y: 3 }, { id: "v2", x: 16, y: 3 }],
    traces: [trace("a", [[8, 5], [10, 3]]), trace("b", [[10, 3], [16, 3]], "bottom"), trace("c", [[16, 3], [16, 5]]), trace("d", [[16, 5], [16, 7], [8, 7]])],
  };
  const nl = buildNetlist(viaBoard);
  assert.ok(connected(nl, ["B1.+", "R1.2"]), "via carries the net to the bottom layer and back");
});

test("voltage divider gives half the supply", () => {
  const b: Board = {
    w: 30,
    h: 16,
    vias: [],
    parts: [part("B1", "battery9v", 8, 5), part("R1", "resistor", 12, 3, { value: 10000 }), part("R2", "resistor", 12, 9, { value: 10000 })],
    traces: [trace("a", [[8, 5], [10, 5], [10, 3], [12, 3]]), trace("b", [[16, 3], [17, 3], [17, 9], [16, 9]]), trace("c", [[12, 9], [8, 9], [8, 7]])],
  };
  const nl = buildNetlist(b);
  const s = solveSteady(b)!;
  near(s.netV[nl.netOf.get("R1.2")!], 4.5, 0.01);
});

test("trace current follows the pin currents", () => {
  const b = ledBoard(330);
  const nl = buildNetlist(b);
  const s = solveSteady(b)!;
  const cur = segmentCurrents(b, nl, s);
  near(Math.abs(cur.get("seg:t1:0")!), s.parts.D1.current, 1e-6);
});

test("IPC-2221 widths and LED resistor maths", () => {
  near(requiredTraceWidth(1), 0.3, 0.03);
  near(ledResistor(9, 1.9), 355, 0.5);
  assert.deepEqual(resistorBands(330).length, 3);
});

test("DRC: clearance, acute angle, edge and overlap", () => {
  const b: Board = {
    w: 20,
    h: 12,
    vias: [],
    parts: [part("R1", "resistor", 1, 5), part("R2", "resistor", 2, 5)],
    traces: [trace("a", [[6, 2], [12, 2]], "top", 1.5), trace("b", [[6, 2.5], [12, 2.5]], "top", 1.5), trace("c", [[14, 8], [18, 8], [14, 9]])],
  };
  const codes = new Set(runDrc(b, buildNetlist(b), null).map((d) => d.code));
  for (const c of ["acute-angle", "overlap", "floating-pin"]) assert.ok(codes.has(c as never), `missing ${c}`);
  const gap: Board = { w: 20, h: 12, vias: [], parts: [], traces: [trace("a", [[6, 2], [12, 2]], "top", 1.0), trace("b", [[6, 2.5], [12, 2.5]], "top", 0.15)] };
  // Gap = 1.27 − 0.5 − 0.075 = 0.695 mm: fine. Make it tight:
  const tight: Board = { ...gap, traces: [trace("a", [[6, 2], [12, 2]], "top", 2.0), trace("b", [[6, 2.5], [12, 2.5]], "top", 0.25)] };
  assert.ok(!runDrc(gap, buildNetlist(gap), null).some((d) => d.code === "clearance"));
  assert.ok(runDrc(tight, buildNetlist(tight), null).some((d) => d.code === "clearance"));
  const edge: Board = { w: 10, h: 10, vias: [], traces: [], parts: [part("R1", "resistor", 8, 5)] };
  assert.ok(runDrc(edge, buildNetlist(edge), null).some((d) => d.code === "edge"));
});

test("every mission and project starter fits the board without overlaps", () => {
  for (const m of [...MISSIONS, ...PROJECTS]) {
    const issues = runDrc(m.board, buildNetlist(m.board), null).filter((d) => d.code === "edge" || d.code === "overlap");
    assert.deepEqual(issues, [], `${m.id}: ${issues.map((i) => i.message).join("; ")}`);
  }
});

test("missions and projects pass when wired as the schematic says", () => {
  for (const m of [...MISSIONS, ...PROJECTS]) {
    if (m.nets.length === 0) continue;
    let board = m.board;
    if (m.id === "first-led") board = { ...board, parts: board.parts.map((p) => (p.id === "R1" ? { ...p, props: { value: 390 } } : p)) };
    const netlist = idealNetlist(board, m.nets);
    const pins = m.id === "divider" ? ["R1.2"] : [];
    const ctx = makeContext(board, { netlist, probed: pins });
    const checks = m.checks(ctx).filter((c) => !c.label.startsWith("Use the bottom") && !c.label.startsWith("No design-rule"));
    const failed = checks.filter((c) => !c.ok).map((c) => c.label);
    assert.deepEqual(failed, [], `${m.id} failed: ${failed.join(", ")}`);
  }
});

test("first mission with the starting 10 Ω resistor does not pass", () => {
  const m = MISSIONS[0];
  const ctx = makeContext(m.board, { netlist: idealNetlist(m.board, m.nets) });
  assert.ok(m.checks(ctx).some((c) => !c.ok));
});

test("a burnt LED keeps the mission open until it is replaced", () => {
  const m = MISSIONS[0];
  const board: Board = { ...m.board, parts: m.board.parts.map((p) => (p.id === "R1" ? { ...p, props: { ...p.props, value: 330 } } : p)) };
  const netlist = idealNetlist(board, m.nets);
  const lights = (burnt?: Set<string>) => m.checks(makeContext(board, { netlist, burnt })).find((c) => c.label === "The LED lights up")!.ok;
  assert.equal(lights(new Set(["D1"])), false);
  assert.equal(lights(), true);
});

test("555 astable blinks at about 1.44 / ((R1 + 2·R2)·C)", () => {
  const m = MISSIONS.find((x) => x.id === "blinker")!;
  const nl = idealNetlist(m.board, m.nets);
  const dt = 0.002;
  const samples = sampleTransient(m.board, 6, dt, (s) => (s.parts.D1.glow > 0.15 ? 1 : 0), {}, nl);
  let edges = 0;
  let first = -1;
  let last = -1;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i] === 1 && samples[i - 1] === 0) {
      edges++;
      if (first < 0) first = i;
      last = i;
    }
  }
  assert.ok(edges >= 3, `edges ${edges}`);
  const hz = (edges - 1) / ((last - first) * dt);
  near(hz, 1.44 / ((1000 + 2 * 68000) * 10e-6), 0.15);
});

test("ratsnest shows only what is not routed", () => {
  const m = MISSIONS[0];
  assert.equal(ratsnest(m.board, buildNetlist(m.board), m.nets).length, 3);
});

test("following the dashed lines pad to pad routes every starter board cleanly", () => {
  const bad: string[] = [];
  for (const m of [...MISSIONS, ...PROJECTS]) {
    const board: Board = structuredClone(m.board);
    for (let guard = 0; guard < 40; guard++) {
      const nl = buildNetlist(board);
      const [line] = ratsnest(board, nl, m.nets);
      if (!line) break;
      const [a, b] = line;
      // Like a student: top layer first, the bottom layer when the top is walled in.
      const layer = routeLeg(a, b, board, nl, "top", 0.4) ? "top" : "bottom";
      const leg = routeLeg(a, b, board, nl, layer, 0.4);
      if (!leg) {
        bad.push(`${m.id}: no path ${JSON.stringify(line)}`);
        break;
      }
      board.traces.push({ id: `auto${guard}`, layer, width: 0.4, points: [a, ...leg] });
    }
    const nl = buildNetlist(board);
    const left = ratsnest(board, nl, m.nets).length;
    const shorted = m.nets.some((n, i) => m.nets.some((o, j) => j > i && connected(nl, [n[0], o[0]])));
    const geometry = runDrc(board, nl, null).filter((d) => ["clearance", "acute-angle", "edge"].includes(d.code));
    if (left || shorted || geometry.length) bad.push(`${m.id}: ${left} unrouted, shorted=${shorted}, drc=${geometry.map((d) => d.code).join(",")}`);
  }
  assert.deepEqual(bad, []);
});
