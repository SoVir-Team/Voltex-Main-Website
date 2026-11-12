import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Screen } from "../../lab/engine/solver.ts";
import { UnoMachine } from "../emu/avr.ts";
import { lcdChar } from "./hd44780.ts";
import { Logic, type Src, type Wiring } from "./logic.ts";

/** Each sketch was compiled with arduino-cli against the real libraries; the device models decode what they send. */
const hex = (name: string) => readFileSync(new URL(`../emu/fixtures/${name}.hex`, import.meta.url), "utf8");

function run(name: string, wiring: Wiring, seconds = 1) {
  const m = new UnoMachine(hex(name));
  const logic = new Logic(wiring, m.i2c);
  m.onPin = (pin, level) => logic.pin(pin, level);
  m.run(16e6 * seconds);
  return { screens: logic.screens(), latched: logic.latched() };
}

const text = (s: Screen | undefined) => {
  assert.ok(s && s.kind === "lcd", "an LCD screen");
  return s.rows.map((r) => r.map(lcdChar).join(""));
};

test("Adafruit SSD1306: text and a filled rectangle land on the right pixels", () => {
  const { screens } = run("oled", { i2c: [{ partId: "OLED1", kind: "ssd1306", bus: 0, address: 0x3c }], lcds: [], shifters: [] });
  const s = screens.OLED1;
  assert.ok(s && s.kind === "oled" && s.on);
  const px = (x: number, y: number) => (s.fb[(y >> 3) * 128 + x] >> (y & 7)) & 1;
  for (let y = 50; y < 60; y++) for (let x = 100; x < 110; x++) assert.equal(px(x, y), 1, `rect pixel ${x},${y}`);
  assert.equal(px(99, 55), 0);
  assert.equal(px(110, 55), 0);
  // "Hi" in the 5×7 font at the top left: some pixels lit there, none in the empty middle.
  let lit = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) lit += px(x, y);
  assert.ok(lit > 10, `text pixels ${lit}`);
  for (let y = 20; y < 40; y++) for (let x = 20; x < 90; x++) assert.equal(px(x, y), 0);
});

test("LiquidCrystal (4-bit parallel): text, cursor moves and a custom character", () => {
  const g = (pin: string): Src => ({ gpio: pin });
  const d: Src[] = [{ level: 0 }, { level: 0 }, { level: 0 }, { level: 0 }, g("D5"), g("D4"), g("D3"), g("D2")];
  const { screens } = run("lcdpar", { i2c: [], lcds: [{ partId: "LCD1", rs: g("D12"), rw: { level: 0 }, e: g("D11"), d }], shifters: [] });
  const [r0, r1] = text(screens.LCD1);
  assert.equal(r0, "Hello, Voltex!  ");
  assert.equal(r1.slice(1), " line 2        ");
  const s = screens.LCD1 as Extract<Screen, { kind: "lcd" }>;
  assert.equal(s.rows[1][0], 0, "custom character 0");
  assert.deepEqual(s.cgram.slice(0, 8), [0, 10, 31, 31, 14, 4, 0, 0]);
});

test("LiquidCrystal_I2C: the PCF8574 backpack drives the LCD over I²C", () => {
  const p = (bit: number): Src => ({ pcf: "U2", bit });
  const { screens, latched } = run("lcdi2c", {
    i2c: [{ partId: "U2", kind: "pcf8574", bus: 0, address: 0x27 }],
    lcds: [{ partId: "LCD1", rs: p(0), rw: p(1), e: p(2), d: [{ level: 0 }, { level: 0 }, { level: 0 }, { level: 0 }, p(4), p(5), p(6), p(7)] }],
    shifters: [],
  }, 2.5); // init() waits a second before it starts
  assert.deepEqual(text(screens.LCD1), ["I2C backpack    ", "   works        "]);
  assert.equal((latched!.U2 >> 3) & 1, 1, "backlight bit on");
});

test("shiftOut into a 74HC595: the latched byte is what was sent", () => {
  const { latched } = run("shift", { i2c: [], lcds: [], shifters: [{ partId: "U2", ser: { gpio: "D11" }, srclk: { gpio: "D12" }, rclk: { gpio: "D8" }, srclr: { level: 1 } }] }, 0.05);
  assert.equal(latched!.U2, 0xb2);
});
