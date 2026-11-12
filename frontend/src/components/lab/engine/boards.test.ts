import { test } from "node:test";
import assert from "node:assert/strict";
import { BOARDS, isMcu, type BoardType } from "./mcu-boards.ts";
import { buildNetlist, connected } from "./netlist.ts";
import { runDrc } from "./drc.ts";
import { PALETTE, PALETTE_GROUPS, PART_DEFS, partBox } from "./parts.ts";
import { SANDBOX_BOARD } from "../state/store.ts";
import { solveSteady } from "./solver.ts";
import type { Board, Part, Trace } from "./types.ts";

const part = (id: string, type: Part["type"], x: number, y: number, props: Part["props"] = {}): Part => ({ id, type, x, y, rot: 0, props });
const trace = (id: string, points: [number, number][]): Trace => ({ id, layer: "top", width: 0.4, points: points.map(([x, y]) => ({ x, y })) });

test("every part but the emulator-only Pico is in the PCB Lab's Parts list, once", () => {
  const missing = Object.keys(PART_DEFS).filter((t) => !PALETTE.includes(t as Part["type"]));
  assert.deepEqual(missing, ["pico"]);
  assert.equal(PALETTE.length, new Set(PALETTE).size);
  assert.deepEqual(
    PALETTE_GROUPS.map((g) => g.title),
    ["Sources & reference", "Passives", "Switches", "Diodes & LED", "Transistors & ICs", "Meters", "Outputs & sensors", "Connectors", "Boards"],
  );
});

test("each board's pins, rails and joined pins name real header pins", () => {
  for (const [type, spec] of Object.entries(BOARDS) as [BoardType, (typeof BOARDS)[BoardType]][]) {
    assert.ok(isMcu(type), type);
    const ids = spec.pins.map((p) => p.id);
    assert.equal(ids.length, new Set(ids).size, `${type}: duplicate pin ids`);
    const has = (id: string) => assert.ok(ids.includes(id), `${type}: ${id} is not a pin`);
    spec.gpio.forEach((g) => has(g.id));
    spec.rails.forEach((r) => has(r.pin));
    spec.tied.flat().forEach(has);
    spec.inert.forEach(has);
    has(spec.usbPin);
    has(spec.gnd);
    // The Pico's LED is on GP25, which has no header pin.
    if (type !== "pico") has(spec.led);
    assert.equal(PART_DEFS[type].pins, spec.pins, `${type}: part pins`);
  }
  assert.equal(isMcu("toString"), false);
});

test("header pin counts match the real boards (the unconnected NC pin left out)", () => {
  const count: Record<BoardType, number> = { uno: 31, pico: 40, nano: 30, mega: 85, esp32dev30: 30, esp32dev38: 38, nodemcu: 30, esp32cam: 16, esp32s3: 44, esp32c3: 30 };
  for (const t of Object.keys(count) as BoardType[]) assert.equal(BOARDS[t].pins.length, count[t], t);
  assert.equal(BOARDS.mega.gpio.filter((g) => g.adc !== undefined).length, 16);
  assert.equal(BOARDS.mega.gpio.filter((g) => g.pwm).length, 15);
});

test("every board fits the free-build PCB inside its edge clearance", () => {
  for (const t of Object.keys(BOARDS) as BoardType[]) {
    const b = partBox(part("U1", t, 0, 0));
    const board: Board = { ...SANDBOX_BOARD, parts: [part("U1", t, Math.round(1 - b.x), Math.round(1 - b.y))] };
    assert.deepEqual(runDrc(board, buildNetlist(board), null).filter((d) => d.code === "edge"), [], t);
  }
});

test("repeated pins are joined on the board", () => {
  const b: Board = { w: 50, h: 30, vias: [], traces: [], parts: [part("U1", "mega", 8, 4), part("U2", "esp32s3", 44, 2)] };
  const nl = buildNetlist(b);
  assert.ok(connected(nl, ["U1.D20", "U1.SDA"]));
  assert.ok(connected(nl, ["U1.GND", "U1.GND.4"]));
  assert.ok(connected(nl, ["U2.GND", "U2.GND.3"]));
  assert.ok(connected(nl, ["U2.3V3", "U2.3V3.1"]));
  // The NodeMCU's two RSV pins are not connected to anything.
  const n: Board = { w: 30, h: 30, vias: [], traces: [], parts: [part("U1", "nodemcu", 5, 5)] };
  assert.ok(!connected(buildNetlist(n), ["U1.RSV", "U1.RSV.1"]));
});

test("an ESP32 DevKit's 3.3 V pin lights an LED through 220 Ω", () => {
  // Board at (5,5): right row x = 14, D15 at y 17, GND at y 18, 3V3 at y 19.
  const b: Board = {
    w: 40,
    h: 30,
    vias: [],
    parts: [part("U1", "esp32dev30", 5, 5), part("R1", "resistor", 18, 19, { value: 220 }), part("D1", "led", 24, 19, { color: "red" })],
    traces: [
      trace("a", [[14, 19], [18, 19]]),
      trace("b", [[22, 19], [24, 19]]),
      trace("c", [[25, 19], [25, 16.5], [15.5, 16.5], [15.5, 18], [14, 18]]),
    ],
  };
  const s = solveSteady(b)!;
  const i = s.parts.D1.current;
  assert.ok(i > 0.004 && i < 0.008, `LED current ${i}`);
  assert.ok(s.parts.D1.glow > 0.2);
  assert.equal(s.parts.U1.stress < 1, true);
});

test("5 V on an ESP8266 pin is a Check error", () => {
  // NodeMCU at (5,5): VIN (about 4.7 V from USB) at (5,19), D0 at (14,5). VIN through 1 kΩ into D0.
  const b: Board = {
    w: 40,
    h: 30,
    vias: [],
    parts: [part("U1", "nodemcu", 5, 5), part("R1", "resistor", 16, 5, { value: 1000 })],
    traces: [trace("a", [[14, 5], [16, 5]]), trace("b", [[20, 5], [20, 23], [3, 23], [3, 19], [5, 19]])],
  };
  const nl = buildNetlist(b);
  const issues = runDrc(b, nl, solveSteady(b)!);
  const pin = issues.find((d) => d.code === "pin-voltage");
  assert.ok(pin, JSON.stringify(issues.map((d) => d.code)));
  assert.match(pin.message, /ESP8266 NodeMCU's pins take 3.3 V at most/);
});
