import { test } from "node:test";
import assert from "node:assert/strict";
import { runDrc } from "../../lab/engine/drc.ts";
import { buildNetlist } from "../../lab/engine/netlist.ts";
import { solveSteady } from "../../lab/engine/solver.ts";
import { EXAMPLES } from "./examples.ts";
import { wiringFor } from "../wiring.ts";

/** Every starter circuit must pass Check (no errors) and wire each part to the pins its comments name. */
const nets: Record<string, [string, string][]> = {
  blink: [["U1.D13", "R1.1"], ["R1.2", "D1.A"], ["D1.K", "U1.GND"]],
  fade: [["U1.D9", "R1.1"], ["R1.2", "D1.A"], ["D1.K", "U1.GND"]],
  button: [["U1.D2", "SW1.1"], ["SW1.2", "U1.GND"]],
  pot: [["RV1.W", "U1.A0"], ["RV1.3", "U1.GND.1"], ["RV1.1", "U1.5V"]],
  servo: [["M1.SIG", "U1.D9"], ["M1.GND", "U1.GND"], ["M1.V+", "U1.5V"]],
  tone: [["BZ1.+", "U1.D8"], ["BZ1.-", "U1.GND"]],
  oled: [["OLED1.SDA", "U1.A4"], ["OLED1.SCL", "U1.A5"], ["OLED1.VCC", "U1.5V"], ["OLED1.GND", "U1.GND.1"]],
  lcd: [["LCD1.RS", "U1.D12"], ["LCD1.E", "U1.D11"], ["LCD1.D4", "U1.D5"], ["LCD1.D5", "U1.D4"], ["LCD1.D6", "U1.D3"], ["LCD1.D7", "U1.D2"], ["LCD1.VSS", "U1.GND"], ["LCD1.V0", "U1.GND"], ["LCD1.RW", "U1.GND"], ["LCD1.VDD", "U1.5V"]],
  "py-blink": [["U1.GP15", "R1.2"], ["R1.1", "D1.A"], ["D1.K", "U1.GND.3"]],
  "py-pot": [["RV1.W", "U1.GP26"], ["RV1.1", "U1.AGND"], ["RV1.3", "U1.3V3"]],
};

for (const ex of EXAMPLES) {
  test(`example "${ex.title}" is wired as described and passes Check`, () => {
    const nl = buildNetlist(ex.circuit);
    for (const [a, b] of nets[ex.id] ?? []) {
      const na = nl.netOf.get(a);
      assert.ok(na !== undefined && na === nl.netOf.get(b), `${a} ↔ ${b}`);
    }
    const errors = runDrc(ex.circuit, nl, solveSteady(ex.circuit, {}, 0.1, nl)).filter((d) => d.severity === "error");
    assert.deepEqual(errors, []);
  });
}

test("the display examples are recognised as driven by the Uno", () => {
  const oled = EXAMPLES.find((e) => e.id === "oled")!;
  const w1 = wiringFor(oled.circuit, buildNetlist(oled.circuit), oled.circuit.parts[0]);
  assert.deepEqual(w1.i2c, [{ partId: "OLED1", kind: "ssd1306", bus: 0, address: 0x3c }]);
  const lcd = EXAMPLES.find((e) => e.id === "lcd")!;
  const w2 = wiringFor(lcd.circuit, buildNetlist(lcd.circuit), lcd.circuit.parts[0]);
  assert.deepEqual(w2.lcds[0].rs, { gpio: "D12" });
  assert.deepEqual(w2.lcds[0].e, { gpio: "D11" });
  assert.deepEqual(w2.lcds[0].rw, { level: 0 });
  assert.deepEqual(w2.lcds[0].d.slice(4), [{ gpio: "D5" }, { gpio: "D4" }, { gpio: "D3" }, { gpio: "D2" }]);
});
