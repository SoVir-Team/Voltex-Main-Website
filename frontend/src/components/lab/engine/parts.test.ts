import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNetlist } from "./netlist.ts";
import { idealNetlist } from "./missions.ts";
import { PALETTE, PART_DEFS, formatValue, parseSI } from "./parts.ts";
import { Simulator, sampleTransient, solveSteady } from "./solver.ts";
import type { Board, Part, PinRef, Trace } from "./types.ts";

const part = (id: string, type: Part["type"], x: number, y: number, props: Part["props"] = {}): Part => ({ id, type, x, y, rot: 0, props });
const trace = (id: string, points: [number, number][]): Trace => ({ id, layer: "top", width: 0.4, points: points.map(([x, y]) => ({ x, y })) });
const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b} (±${tol})`);
/** A board whose parts are joined by the listed nets, with no copper to draw. */
function wired(parts: Part[], nets: PinRef[][]) {
  const board: Board = { w: 60, h: 40, parts, traces: [], vias: [] };
  return { board, nl: idealNetlist(board, nets) };
}
const volts = (s: ReturnType<typeof solveSteady>, nl: ReturnType<typeof idealNetlist>, pin: string) => s!.netV[nl.netOf.get(pin)!];

test("every palette part has a definition and its defaults", () => {
  for (const t of PALETTE) assert.ok(PART_DEFS[t], t);
  assert.equal(PALETTE.length, new Set(PALETTE).size);
});

test("values parse with SI suffixes and print back", () => {
  near(parseSI("4.7k"), 4700, 1e-9);
  near(parseSI("100n"), 100e-9, 1e-18);
  near(parseSI("16 V"), 16, 0);
  near(parseSI("10 µF"), 10e-6, 1e-15);
  near(parseSI("2.2 MΩ"), 2.2e6, 1e-6);
  assert.ok(Number.isNaN(parseSI("abc")));
  assert.equal(formatValue(4700, "Ω"), "4.7 kΩ");
  assert.equal(formatValue(100e-9, "F"), "100 nF");
  assert.equal(formatValue(16, "V"), "16 V");
});

test("changing the battery voltage changes the circuit", () => {
  const { board, nl } = wired([part("B1", "battery9v", 8, 5, { value: 16 }), part("R1", "resistor", 12, 5, { value: 1000 })], [["B1.+", "R1.1"], ["R1.2", "B1.-"]]);
  near(solveSteady(board, {}, 2, nl)!.parts.R1.current, 16 / 1001.7, 1e-5);
});

test("ground symbols are one node without wires between them", () => {
  const board: Board = {
    w: 30,
    h: 16,
    vias: [],
    parts: [part("B1", "battery9v", 8, 5), part("R1", "resistor", 12, 5, { value: 1000 }), part("GND1", "gnd", 16, 8), part("GND2", "gnd", 8, 9)],
    traces: [trace("a", [[8, 5], [12, 5]]), trace("b", [[16, 5], [16, 8]]), trace("c", [[8, 7], [8, 9]])],
  };
  near(solveSteady(board)!.parts.R1.current, 9 / 1001.7, 1e-5);
});

test("a VCC symbol powers a load to ground", () => {
  const { board, nl } = wired([part("PWR1", "vcc", 0, 0, { value: 5 }), part("R1", "resistor", 4, 0, { value: 1000 }), part("GND1", "gnd", 10, 0)], [["PWR1.1", "R1.1"], ["R1.2", "GND1.1"]]);
  near(solveSteady(board, {}, 2, nl)!.parts.R1.current, 0.005, 1e-4);
});

test("a Zener diode clamps to its voltage", () => {
  const { board, nl } = wired(
    [part("B1", "battery9v", 0, 0), part("R1", "resistor", 4, 0, { value: 1000 }), part("D1", "zener", 10, 0, { value: 5.1 })],
    [["B1.+", "R1.1"], ["R1.2", "D1.K"], ["D1.A", "B1.-"]],
  );
  near(volts(solveSteady(board, {}, 2, nl), nl, "D1.K"), 5.1, 0.15);
});

test("a Schottky diode drops less than an ordinary one", () => {
  const drop = (t: "diode" | "schottky") => {
    const { board, nl } = wired([part("B1", "battery9v", 0, 0), part("D1", t, 4, 0), part("R1", "resistor", 10, 0, { value: 470 })], [["B1.+", "D1.A"], ["D1.K", "R1.1"], ["R1.2", "B1.-"]]);
    const s = solveSteady(board, {}, 2, nl);
    return volts(s, nl, "D1.A") - volts(s, nl, "D1.K");
  };
  assert.ok(drop("schottky") < 0.45 && drop("diode") > 0.55, `${drop("schottky")} ${drop("diode")}`);
});

test("inductor current rises with time constant L/R", () => {
  const { board, nl } = wired(
    [part("V1", "dcsource", 0, 0, { value: 5 }), part("R1", "resistor", 4, 0, { value: 10 }), part("L1", "inductor", 10, 0, { value: 1 })],
    [["V1.+", "R1.1"], ["R1.2", "L1.1"], ["L1.2", "V1.-"]],
  );
  const i = sampleTransient(board, 0.1, 0.001, (s) => s.parts.L1.current, {}, nl);
  near(i[i.length - 1], 0.5 * (1 - Math.exp(-1)), 0.02);
});

test("an N-MOSFET switches its load with the gate voltage", () => {
  const run = (gateTo: string) => {
    const { board, nl } = wired(
      [part("V1", "dcsource", 0, 0, { value: 12 }), part("R1", "resistor", 4, 0, { value: 1000 }), part("Q1", "nmos", 10, 0), part("R2", "resistor", 14, 0, { value: 10000 })],
      [["V1.+", "R1.1", ...(gateTo === "+" ? ["R2.1"] : [])], ["R1.2", "Q1.D"], ["R2.2", "Q1.G"], ["Q1.S", "V1.-", ...(gateTo === "-" ? ["R2.1"] : [])]],
    );
    return solveSteady(board, {}, 2, nl)!.parts.R1.current;
  };
  assert.ok(run("+") > 0.0115, `on ${run("+")}`);
  assert.ok(run("-") < 1e-3, `off ${run("-")}`);
});

test("a PNP transistor switches the high side", () => {
  const { board, nl } = wired(
    [part("B1", "battery9v", 0, 0), part("Q1", "pnp", 4, 0), part("R1", "resistor", 8, 0, { value: 1000 }), part("R2", "resistor", 14, 0, { value: 10000 })],
    [["B1.+", "Q1.E"], ["Q1.C", "R1.1"], ["Q1.B", "R2.1"], ["R1.2", "R2.2", "B1.-"]],
  );
  near(solveSteady(board, {}, 2, nl)!.parts.R1.current, 0.009, 0.001);
});

test("an op-amp follower copies its input", () => {
  const { board, nl } = wired(
    [part("V1", "dcsource", 0, 0, { value: 9 }), part("R1", "resistor", 4, 0, { value: 10000 }), part("R2", "resistor", 4, 4, { value: 10000 }), part("U1", "opamp", 10, 0), part("R3", "resistor", 20, 0, { value: 10000 })],
    [["V1.+", "R1.1", "U1.V+"], ["R1.2", "R2.1", "U1.+"], ["U1.OUT", "U1.-", "R3.1"], ["R2.2", "R3.2", "U1.V-", "V1.-"]],
  );
  near(volts(solveSteady(board, {}, 2, nl), nl, "U1.OUT"), 4.5, 0.02);
});

test("regulators hold their output voltage", () => {
  for (const [type, props, vout] of [["lm7805", {}, 5], ["ams1117", { variant: "3.3" }, 3.3]] as const) {
    const { board, nl } = wired([part("B1", "battery9v", 0, 0), part("U1", type, 4, 0, props), part("R1", "resistor", 10, 0, { value: 100 })], [["B1.+", "U1.IN"], ["U1.OUT", "R1.1"], ["U1.GND", "R1.2", "B1.-"]]);
    near(volts(solveSteady(board, {}, 2, nl), nl, "U1.OUT"), vout, 0.05);
  }
});

test("a fuse blows on overload and opens the circuit", () => {
  const { board, nl } = wired([part("V1", "dcsource", 0, 0, { value: 5 }), part("F1", "fuse", 4, 0, { value: 0.5 }), part("R1", "resistor", 10, 0, { value: 2 })], [["V1.+", "F1.1"], ["F1.2", "R1.1"], ["R1.2", "V1.-"]]);
  const s = solveSteady(board, {}, 2, nl)!;
  assert.equal(s.parts.F1.burnt, true);
  assert.ok(Math.abs(s.parts.R1.current) < 1e-3);
});

test("a relay coil pulls in and switches its contacts", () => {
  const { board, nl } = wired(
    [part("B1", "battery9v", 0, 0), part("K1", "relay", 4, 0, { value: 9 }), part("R1", "resistor", 10, 0, { value: 470 }), part("D1", "led", 16, 0)],
    [["B1.+", "K1.1", "K1.COM"], ["K1.NO", "R1.1"], ["R1.2", "D1.A"], ["D1.K", "K1.2", "B1.-"]],
  );
  const sim = new Simulator(board, undefined, nl);
  const inp = { ambient: 0.6, pressed: new Set<string>() };
  for (let i = 0; i < 5; i++) sim.step(0.02, inp);
  assert.ok(sim.snapshot(inp).parts.D1.glow > 0.5);
});

test("SPDT switch sends COM to A or B", () => {
  const glowA = (closed: boolean) => {
    const { board, nl } = wired(
      [part("B1", "battery9v", 0, 0), part("SW1", "spdt", 4, 0, { closed }), part("R1", "resistor", 10, 0, { value: 470 }), part("D1", "led", 16, 0), part("R2", "resistor", 10, 4, { value: 470 }), part("D2", "led", 16, 4)],
      [["B1.+", "SW1.COM"], ["SW1.A", "R1.1"], ["SW1.B", "R2.1"], ["R1.2", "D1.A"], ["R2.2", "D2.A"], ["D1.K", "D2.K", "B1.-"]],
    );
    const s = solveSteady(board, {}, 2, nl)!;
    return [s.parts.D1.glow > 0.5, s.parts.D2.glow > 0.5];
  };
  assert.deepEqual(glowA(true), [true, false]);
  assert.deepEqual(glowA(false), [false, true]);
});

test("new LED colours light, infrared stays dark to the eye", () => {
  for (const [color, visible] of [["orange", true], ["pink", true], ["ir", false]] as const) {
    const { board, nl } = wired([part("B1", "battery9v", 0, 0), part("R1", "resistor", 4, 0, { value: 330 }), part("D1", "led", 10, 0, { color })], [["B1.+", "R1.1"], ["R1.2", "D1.A"], ["D1.K", "B1.-"]]);
    const s = solveSteady(board, {}, 2, nl)!;
    assert.equal(s.parts.D1.glow > 0.3, visible, color);
    assert.ok(s.parts.D1.current > 0.015, color);
  }
});

test("74HC595 shifts on SRCLK and shows the bits on RCLK", () => {
  const { board, nl } = wired(
    [
      part("V1", "dcsource", 0, 0, { value: 5 }),
      part("U1", "hc595", 4, 0),
      part("SW1", "button", 12, 0),
      part("SW2", "button", 12, 4),
      part("R1", "resistor", 18, 0, { value: 10000 }),
      part("R2", "resistor", 18, 4, { value: 10000 }),
      part("R3", "resistor", 24, 0, { value: 1000 }),
      part("R4", "resistor", 24, 4, { value: 1000 }),
    ],
    [
      ["V1.+", "U1.VCC", "U1.SER", "U1.SRCLR", "SW1.1", "SW2.1"],
      ["SW1.2", "U1.SRCLK", "R1.1"],
      ["SW2.2", "U1.RCLK", "R2.1"],
      ["U1.Q0", "R3.1"],
      ["U1.Q2", "R4.1"],
      ["V1.-", "U1.GND", "U1.OE", "R1.2", "R2.2", "R3.2", "R4.2"],
    ],
  );
  const sim = new Simulator(board, undefined, nl);
  const step = (held: string[]) => sim.step(0.01, { ambient: 0.6, pressed: new Set(held) });
  const pulse = (id: string) => {
    step([id]);
    step([]);
  };
  pulse("SW1");
  pulse("SW1");
  const before = sim.snapshot({ ambient: 0.6, pressed: new Set() });
  near(before.netV[nl.netOf.get("U1.Q0")!], 0, 0.01);
  pulse("SW2");
  const s = sim.snapshot({ ambient: 0.6, pressed: new Set() });
  assert.ok(s.netV[nl.netOf.get("U1.Q0")!] > 4.5);
  near(s.netV[nl.netOf.get("U1.Q2")!], 0, 0.01);
  assert.deepEqual(s.parts.U1.segs?.slice(0, 3), [1, 1, 0]);
});

test("AC through a transformer scales by the turns ratio and the scope sees it", () => {
  const { board, nl } = wired(
    [part("V1", "acsource", 0, 0, { value: 10, freq: 50 }), part("T1", "transformer", 4, 0, { value: 0.5 }), part("R1", "resistor", 10, 0, { value: 1000 }), part("OSC1", "scope", 16, 0)],
    [["V1.+", "T1.P1"], ["V1.-", "T1.P2"], ["T1.S1", "R1.1", "OSC1.A"], ["T1.S2", "R1.2", "OSC1.GND"]],
  );
  const sim = new Simulator(board, undefined, nl);
  const inp = { ambient: 0.6, pressed: new Set<string>() };
  let peak = 0;
  for (let i = 0; i < 300; i++) {
    sim.step(0.0005, inp);
    if (i > 100) peak = Math.max(peak, Math.abs(sim.snapshot(inp).netV[nl.netOf.get("T1.S1")!] - sim.snapshot(inp).netV[nl.netOf.get("T1.S2")!]));
  }
  near(peak, 5, 0.6);
  assert.ok((sim.snapshot(inp).parts.OSC1.wave?.[0].length ?? 0) > 50);
});

test("DC does not pass a transformer", () => {
  const { board, nl } = wired(
    [part("V1", "dcsource", 0, 0, { value: 5 }), part("R0", "resistor", 2, 0, { value: 100 }), part("T1", "transformer", 4, 0, { value: 1 }), part("R1", "resistor", 10, 0, { value: 1000 })],
    [["V1.+", "R0.1"], ["R0.2", "T1.P1"], ["V1.-", "T1.P2"], ["T1.S1", "R1.1"], ["T1.S2", "R1.2"]],
  );
  near(solveSteady(board, {}, 2, nl)!.parts.R1.current, 0, 1e-3);
});

test("optocoupler LED switches its output transistor", () => {
  const { board, nl } = wired(
    [part("B1", "battery9v", 0, 0), part("R1", "resistor", 4, 0, { value: 1000 }), part("U1", "opto", 10, 0), part("R2", "resistor", 16, 0, { value: 4700 })],
    [["B1.+", "R1.1", "R2.1"], ["R1.2", "U1.A"], ["R2.2", "U1.C"], ["U1.K", "U1.E", "B1.-"]],
  );
  const s = solveSteady(board, {}, 2, nl)!;
  assert.ok(volts(s, nl, "U1.C") < 1, `Vce ${volts(s, nl, "U1.C")}`);
});

test("meters read volts and amps", () => {
  const { board, nl } = wired(
    [part("V1", "dcsource", 0, 0, { value: 10 }), part("AM1", "ammeter", 4, 0), part("R1", "resistor", 10, 0, { value: 1000 }), part("VM1", "voltmeter", 16, 0), part("MM1", "multimeter", 22, 0, { mode: "V" })],
    [["V1.+", "AM1.+"], ["AM1.-", "R1.1", "VM1.+", "MM1.+"], ["R1.2", "VM1.-", "MM1.COM", "V1.-"]],
  );
  const s = solveSteady(board, {}, 2, nl)!;
  near(s.parts.AM1.reading!, 0.01, 1e-4);
  near(s.parts.VM1.reading!, 10, 0.01);
  near(s.parts.MM1.reading!, 10, 0.01);
});

test("ohmmeter measures an unpowered resistor", () => {
  const board: Board = { w: 30, h: 10, vias: [], traces: [], parts: [part("MM1", "multimeter", 0, 0, { mode: "R" }), part("R1", "resistor", 4, 0, { value: 470 }), part("GND1", "gnd", 8, 0)] };
  const nl = idealNetlist(board, [["MM1.+", "R1.1"], ["MM1.COM", "R1.2", "GND1.1"]]);
  // A multimeter alone is not a supply; give the board one somewhere else so it simulates.
  const powered: Board = { ...board, parts: [...board.parts, part("V1", "dcsource", 20, 0)] };
  const nl2 = idealNetlist(powered, [["MM1.+", "R1.1"], ["MM1.COM", "R1.2", "GND1.1", "V1.-"]]);
  assert.ok(nl);
  near(solveSteady(powered, {}, 2, nl2)!.parts.MM1.reading!, 470, 1);
});

test("7-segment display lights the driven segments", () => {
  const { board, nl } = wired(
    [part("B1", "battery9v", 0, 0), part("R1", "resistor", 4, 0, { value: 470 }), part("R2", "resistor", 4, 4, { value: 470 }), part("DS1", "sevenseg", 10, 0)],
    [["B1.+", "R1.1", "R2.1"], ["R1.2", "DS1.b"], ["R2.2", "DS1.c"], ["DS1.COM", "B1.-"]],
  );
  const segs = solveSteady(board, {}, 2, nl)!.parts.DS1.segs!;
  assert.deepEqual(segs.map((g) => g > 0.3), [false, true, true, false, false, false, false, false]);
});

test("pulse generator drives a servo to the angle of its pulse width", () => {
  const { board, nl } = wired(
    [part("V1", "dcsource", 0, 0, { value: 5 }), part("V2", "pulsegen", 4, 0, { value: 5, freq: 50, duty: 10 }), part("M1", "servo", 10, 0)],
    [["V1.+", "M1.V+"], ["V2.+", "M1.SIG"], ["V1.-", "V2.-", "M1.GND"]],
  );
  const s = sampleTransient(board, 0.2, 0.0002, (x) => x.parts.M1.level ?? 0, {}, nl);
  near(s[s.length - 1], 1, 0.05);
});

test("USB VBUS and DC sources power a circuit; a short is flagged", () => {
  const { board, nl } = wired([part("J1", "usb", 0, 0), part("R1", "resistor", 4, 0, { value: 100 })], [["J1.VBUS", "R1.1"], ["R1.2", "J1.GND"]]);
  near(solveSteady(board, {}, 2, nl)!.parts.R1.current, 0.05, 1e-3);
  const short = { ...board, parts: [part("V1", "dcsource", 0, 0)] };
  const s = solveSteady(short, {}, 2, idealNetlist(short, [["V1.+", "V1.-"]]))!;
  assert.ok(s.parts.V1.stress > 1);
  assert.ok(buildNetlist(short));
});
