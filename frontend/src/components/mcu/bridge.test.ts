import { test } from "node:test";
import assert from "node:assert/strict";
import { runDrc } from "../lab/engine/drc.ts";
import { buildNetlist } from "../lab/engine/netlist.ts";
import { Simulator, solveSteady, type SimInputs } from "../lab/engine/solver.ts";
import type { Board, Part, PartProps, PartType, Pt, Trace } from "../lab/engine/types.ts";
import { readPins, stepCircuit, type BoardActivity } from "./bridge.ts";

const part = (id: string, type: PartType, x: number, y: number, props: PartProps = {}): Part => ({ id, type, x, y, rot: 0, props });
let n = 0;
const wire = (...pts: [number, number][]): Trace => ({ id: `t${n++}`, layer: "top", width: 0.4, points: pts.map(([x, y]): Pt => ({ x, y })) });
const inputs: SimInputs = { ambient: 0.6, pressed: new Set() };

/** Uno at (10,8): top header on y=8, D9 at x=18, GND at x=13, D2 at x=26. A resistor and LED hang off D9. */
function ledOnD9(ohms: number): Board {
  return {
    w: 40,
    h: 32,
    vias: [],
    parts: [part("U1", "uno", 10, 8), part("R1", "resistor", 18, 4, { value: ohms }), part("D1", "led", 24, 4, { color: "red" })],
    traces: [wire([18, 8], [18, 4]), wire([22, 4], [24, 4]), wire([25, 4], [25, 2], [13, 2], [13, 8])],
  };
}

const activity = (duty: number): BoardActivity => ({
  partId: "U1",
  board: "uno",
  modes: { D9: "out" },
  readings: { D9: { level: duty > 0.5 ? 1 : 0, duty, freq: 490, pulse: duty / 490 } },
});

test("a GPIO high through 220 Ω lights a red LED at about 13 mA", () => {
  const sim = new Simulator(ledOnD9(220));
  let snap = stepCircuit(sim, 0.02, inputs, [activity(1)]);
  snap = stepCircuit(sim, 0.02, inputs, [activity(1)]);
  const I = snap.parts.D1.current;
  assert.ok(I > 0.0115 && I < 0.0135, `LED current ${I}`);
  assert.ok(Math.abs(snap.parts.U1.pinCurrents.D9 - I) < 1e-4, "the pin supplies the LED current");
});

test("PWM: at 30 % duty the LED carries full current 30 % of the time", () => {
  const full = stepCircuit(new Simulator(ledOnD9(220)), 0.02, inputs, [activity(1)]).parts.D1.current;
  const sim = new Simulator(ledOnD9(220));
  stepCircuit(sim, 0.02, inputs, [activity(0.3)]);
  const avg = stepCircuit(sim, 0.02, inputs, [activity(0.3)]).parts.D1.current;
  assert.ok(Math.abs(avg - 0.3 * full) < 0.0003, `average ${avg} vs ${0.3 * full}`);
});

test("10 Ω on a GPIO pulls over 40 mA: the board reports overcurrent", () => {
  const sim = new Simulator(ledOnD9(10));
  const snap = stepCircuit(sim, 0.02, inputs, [activity(1)]);
  assert.ok(snap.parts.U1.pinCurrents.D9 > 0.04, `pin current ${snap.parts.U1.pinCurrents.D9}`);
  assert.ok(sim.drainEvents().some((e) => e.type === "overcurrent" && e.partId === "U1"));
  assert.ok(!sim.isBurnt("U1"));
});

test("INPUT_PULLUP with a button to GND reads high until pressed", () => {
  // D2 at (26,8): button from D2 up to (26,4)–(29,4), back to GND along y=2.
  const board: Board = {
    w: 40,
    h: 32,
    vias: [],
    parts: [part("U1", "uno", 10, 8), part("SW1", "button", 26, 4)],
    traces: [wire([26, 8], [26, 4]), wire([29, 4], [29, 2], [13, 2], [13, 8])],
  };
  const nl = buildNetlist(board);
  const act: BoardActivity = { partId: "U1", board: "uno", modes: { D2: "pullup" }, readings: {} };
  const sim = new Simulator(board, undefined, nl);
  const up = readPins(board, nl, stepCircuit(sim, 0.02, inputs, [act]), act, {});
  assert.equal(up.D2.level, true);
  assert.ok(Math.abs(up.D2.volts - 5) < 0.01);
  const down = readPins(board, nl, stepCircuit(sim, 0.02, { ...inputs, pressed: new Set(["SW1"]) }, [act]), act, up.D2 ? { D2: true } : {});
  assert.equal(down.D2.level, false);
});

test("Check: 5 V on a Pico GPIO is an error; a GPIO tied to GND is a warning", () => {
  // Pico at (10,8): GP0 at (10,8), VBUS at (17,8), GND at (10,10).
  const board: Board = {
    w: 40,
    h: 40,
    vias: [],
    parts: [part("U1", "pico", 10, 8)],
    traces: [wire([10, 8], [10, 6], [17, 6], [17, 8]), wire([10, 11], [8, 11], [8, 10], [10, 10])],
  };
  const nl = buildNetlist(board);
  const issues = runDrc(board, nl, solveSteady(board, {}, 0.1, nl));
  assert.ok(issues.some((d) => d.code === "pin-voltage" && d.severity === "error" && d.message.includes("GP0")), JSON.stringify(issues));
  assert.ok(issues.some((d) => d.code === "pin-rail" && d.message.includes("GP2")));
  assert.ok(!issues.some((d) => d.code === "floating-pin"), "spare header pins are not warnings");
});
