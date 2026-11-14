import { test } from "node:test";
import assert from "node:assert/strict";
import { PALETTE, PART_DEFS } from "./parts.ts";
import { PROPERTY_DEFS, defaultProperties, propertyValue, validateProperties } from "./properties.ts";
import { Simulator, batteryOf, ldrOhms, sampleTransient, solveSteady } from "./solver.ts";
import { idealNetlist, MISSIONS } from "./missions.ts";
import { PROJECTS } from "./projects.ts";
import type { Board, Part, PartProps, PartType } from "./types.ts";

const part = (type: PartType, id: string, props: PartProps = {}): Part => ({ type, id, props, x: 10, y: 10, rot: 0 });
function loop(type: PartType, props: PartProps = {}, voltage = 9) {
  const load = part(type, "X1", props);
  const board: Board = { w: 40, h: 30, parts: [part("battery9v", "B1", { voltage }), load], traces: [], vias: [] };
  const pins = type === "buzzer" || type === "electrolytic" ? ["+", "-"] : type === "led" || type === "diode" ? ["A", "K"] : ["1", "2"];
  const nl = idealNetlist(board, [["B1.+", `X1.${pins[0]}`], ["B1.-", `X1.${pins[1]}`]]);
  return { board, nl, solve: (seconds = 0.01) => solveSteady(board, {}, seconds, nl)!.parts.X1 };
}

test("every palette component has property metadata and legacy props resolve to valid defaults", () => {
  for (const type of PALETTE) {
    const legacy = part(type, "X1");
    // Fixed-spec components and reference symbols may have no numeric parameters.
    assert.ok(Array.isArray(PROPERTY_DEFS[type]));
    assert.equal(validateProperties(legacy, defaultProperties(type)), null);
    for (const def of PROPERTY_DEFS[type]) assert.ok(Number.isFinite(propertyValue(legacy, def.key)));
  }
  assert.equal(propertyValue(part("led", "D1", { color: "blue" }), "forwardVoltage"), 3);
  assert.equal(batteryOf("battery9v")?.v, 9);
  assert.equal(batteryOf("coincell")?.rint, 30);
});

test("ordered limits and invalid numeric values are rejected", () => {
  assert.match(validateProperties(part("buzzer", "BZ1"), { minVoltage: 15 })!, /Minimum/);
  assert.match(validateProperties(part("ldr", "R1"), { brightResistance: 2e6 })!, /Bright/);
  assert.match(validateProperties(part("timer555", "U1"), { triggerRatio: 0.9 })!, /Trigger/);
  for (const type of PALETTE) for (const def of PROPERTY_DEFS[type]) {
    assert.ok(validateProperties(part(type, "X1"), { [def.key]: NaN }));
    assert.ok(validateProperties(part(type, "X1"), { [def.key]: Infinity }));
  }
});

test("battery voltage, internal resistance, resistance, and power ratings affect the simulation", () => {
  assert.deepEqual(batteryOf("battery9v", { voltage: 5, internalResistance: 20 }), { v: 5, rint: 20 });
  assert.ok(loop("resistor", { value: 1000 }, 5).solve().current < loop("resistor", { value: 1000 }).solve().current);
  assert.ok(loop("resistor", { value: 2000 }).solve().current < loop("resistor", { value: 1000 }).solve().current);
  assert.ok(loop("resistor", { powerRating: 1 }).solve().stress < loop("resistor").solve().stress);
});

test("LDR endpoints and switch/button contact properties affect current", () => {
  const sensor = part("ldr", "R1", { brightResistance: 200, darkResistance: 20000 });
  assert.equal(ldrOhms(0, sensor), 20000);
  assert.equal(ldrOhms(1, sensor), 200);
  assert.ok(loop("switch", { closed: true, contactResistance: 100 }).solve().current > loop("switch", { closed: false }).solve().current);
  assert.ok(loop("button", { normallyClosed: true, contactResistance: 100 }).solve().current > loop("button").solve().current);
});

test("LED and diode configured junction characteristics affect current", () => {
  for (const type of ["led", "diode"] as const) {
    const a = loop(type, { forwardVoltage: 2, ratedCurrent: 0.02 }, 1);
    const b = loop(type, { forwardVoltage: 1.5, ratedCurrent: 0.02 }, 1);
    assert.ok(b.solve().current > a.solve().current);
  }
});

test("capacitor voltage ratings affect stress and reverse electrolytics remain flagged", () => {
  for (const type of ["ceramic", "electrolytic"] as const) {
    assert.ok(loop(type, { voltageRating: 5 }).solve().stress > loop(type, { voltageRating: 25 }).solve().stress);
  }
});

test("buzzer sounds only in its operating range, stops on reverse polarity, and burns under prolonged overload", () => {
  assert.equal(loop("buzzer").solve().on, true);
  assert.equal(loop("buzzer", {}, 2).solve().on, false);
  assert.equal(loop("buzzer", { minVoltage: 10 }).solve().on, false);
  assert.equal(loop("buzzer", { maxVoltage: 5 }).solve().on, false);
  assert.ok(loop("buzzer", { loadResistance: 720 }).solve().current < loop("buzzer").solve().current);
  const { board } = loop("buzzer");
  const reverse = idealNetlist(board, [["B1.+", "X1.-"], ["B1.-", "X1.+"]]);
  const reversed = solveSteady(board, {}, 0.01, reverse)!.parts.X1;
  assert.equal(reversed.on, false);
  assert.equal(reversed.reversed, true);
  const overloaded = loop("buzzer", { maxVoltage: 5 });
  const sim = new Simulator(overloaded.board, undefined, overloaded.nl);
  const inputs = { ambient: 0.6, pressed: new Set<string>() };
  for (let i = 0; i < 100; i++) sim.step(0.01, inputs);
  assert.equal(sim.snapshot(inputs).parts.X1.burnt, true);
  assert.equal(sim.snapshot(inputs).parts.X1.on, false);
});

test("doorbell buzzer follows the button including normally closed operation", () => {
  const m = PROJECTS.find((m) => m.id === "doorbell")!;
  const board = structuredClone(m.board);
  const nl = idealNetlist(board, m.nets);
  assert.equal(solveSteady(board, {}, 0.01, nl)!.parts.BZ1.on, false);
  assert.equal(solveSteady(board, { pressed: new Set(["SW1"]) }, 0.01, nl)!.parts.BZ1.on, true);
  board.parts.find((p) => p.id === "SW1")!.props.normallyClosed = true;
  assert.equal(solveSteady(board, {}, 0.01, nl)!.parts.BZ1.on, true);
  assert.equal(solveSteady(board, { pressed: new Set(["SW1"]) }, 0.01, nl)!.parts.BZ1.on, false);
});

test("555 threshold configuration changes the oscillation period", () => {
  const m = MISSIONS.find((m) => m.id === "blinker")!;
  const countEdges = (board: Board) => {
    const samples = sampleTransient(board, 4, 0.002, (s) => Number(s.parts.U1.on), {}, idealNetlist(board, m.nets));
    return samples.filter((v, i) => i > 0 && v && !samples[i - 1]).length;
  };
  const changed = structuredClone(m.board);
  changed.parts.find((p) => p.type === "timer555")!.props.thresholdRatio = 0.5;
  assert.ok(countEdges(changed) > countEdges(m.board));
});

test("pot resistance, wiper position, and rating affect divider voltage and stress", () => {
  const measure = (props: PartProps) => {
    const board: Board = { w: 40, h: 30, parts: [part("battery9v", "B1"), part("pot", "RV1", props)], traces: [], vias: [] };
    const nl = idealNetlist(board, [["B1.+", "RV1.1"], ["B1.-", "RV1.3"]]);
    const snap = solveSteady(board, {}, 0.01, nl)!;
    return { current: snap.parts.RV1.current, stress: snap.parts.RV1.stress, wiper: snap.netV[nl.netOf.get("RV1.W")!] };
  };
  assert.ok(measure({ value: 20000 }).current < measure({ value: 10000 }).current);
  assert.ok(measure({ pos: 0.2 }).wiper > measure({ pos: 0.8 }).wiper);
  assert.ok(measure({ powerRating: 0.01 }).stress > measure({ powerRating: 1 }).stress);
});

test("NPN gain and collector rating affect current and stress", () => {
  const measure = (props: PartProps) => {
    const board: Board = { w: 40, h: 30, parts: [part("battery9v", "B1"), part("resistor", "R1", { value: 1e6 }), part("resistor", "R2", { value: 1000 }), part("npn", "Q1", props)], traces: [], vias: [] };
    const nl = idealNetlist(board, [["B1.+", "R1.1", "R2.1"], ["R1.2", "Q1.B"], ["R2.2", "Q1.C"], ["Q1.E", "B1.-"]]);
    return solveSteady(board, {}, 0.01, nl)!.parts.Q1;
  };
  assert.ok(measure({ gain: 200 }).current > measure({ gain: 20 }).current * 2);
  assert.ok(measure({ ratedCurrent: 0.001 }).stress > measure({ ratedCurrent: 0.6 }).stress);
});

test("custom capacitance changes charge time and reverse electrolytics are flagged", () => {
  for (const type of ["ceramic", "electrolytic"] as const) {
    const measure = (value: number) => {
      const board: Board = { w: 40, h: 30, parts: [part("battery9v", "B1"), part("resistor", "R1", { value: 10000 }), part(type, "C1", { value })], traces: [], vias: [] };
      const pins = type === "ceramic" ? ["1", "2"] : ["+", "-"];
      const nl = idealNetlist(board, [["B1.+", "R1.1"], ["R1.2", `C1.${pins[0]}`], [`C1.${pins[1]}`, "B1.-"]]);
      return solveSteady(board, {}, 0.02, nl)!.netV[nl.netOf.get(`C1.${pins[0]}`)!];
    };
    assert.ok(measure(1e-6) > measure(10e-6));
  }
  const { board } = loop("electrolytic");
  const nl = idealNetlist(board, [["B1.+", "X1.-"], ["B1.-", "X1.+"]]);
  assert.equal(solveSteady(board, {}, 0.01, nl)!.parts.X1.reversed, true);
});

test("555 output drop and resistance change its loaded output voltage", () => {
  const measure = (props: PartProps) => {
    const board: Board = { w: 40, h: 30, parts: [part("battery9v", "B1"), part("timer555", "U1", props), part("resistor", "R1", { value: 1000 })], traces: [], vias: [] };
    const nl = idealNetlist(board, [["B1.+", "U1.8", "U1.4"], ["B1.-", "U1.1", "U1.2", "U1.6", "R1.2"], ["U1.3", "R1.1"]]);
    return solveSteady(board, {}, 0.02, nl)!.netV[nl.netOf.get("U1.3")!];
  };
  assert.ok(measure({ outputDrop: 3 }) < measure({ outputDrop: 1 }));
  assert.ok(measure({ outputResistance: 1000 }) < measure({ outputResistance: 15 }));
});

test("editing any numeric property changes what the board shows for that part", () => {
  // Properties that only affect the simulation and are not part of the printed label or spec line.
  const silent = new Set(["powerRating", "voltageRating", "contactResistance", "internalResistance", "ratedCurrent", "gain", "pos"]);
  const stale: string[] = [];
  for (const type of PALETTE) {
    const def = PART_DEFS[type];
    for (const p of PROPERTY_DEFS[type]) {
      if (silent.has(p.key)) continue;
      const base = part(type, "X1");
      const edited = part(type, "X1", { [p.key]: p.key === "value" || p.key === "voltage" ? 16 : Math.min(p.max, Math.max(p.min, propertyValue(base, p.key) * 1.37 + p.min)) });
      const show = (x: Part) => `${def.label?.(x.props) ?? ""} | ${def.spec(x.props)}`;
      if (show(base) === show(edited)) stale.push(`${type}.${p.key}`);
    }
  }
  assert.deepEqual(stale, []);
});
