import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { UnoMachine } from "./avr.ts";
import { parseIntelHex } from "./hex.ts";
import { PinMeter } from "./meter.ts";

/** Little-endian words into a flash image. */
function image(words: number[]): Uint8Array {
  const out = new Uint8Array(0x8000);
  words.forEach((w, i) => {
    out[2 * i] = w & 0xff;
    out[2 * i + 1] = w >> 8;
  });
  return out;
}

test("Intel HEX loads data records and rejects bad checksums", () => {
  const img = parseIntelHex(":0400000001020304F2\n:00000001FF\n", 16);
  assert.deepEqual([...img.slice(0, 5)], [1, 2, 3, 4, 0]);
  assert.throws(() => parseIntelHex(":0400000001020304F3\n", 16), /checksum/);
});

test("pin meter measures duty, frequency and pulse width from edge times", () => {
  const m = new PinMeter(1000);
  // 1 kHz clock: high for 250 cycles in every 1000 → 25 % duty at 1 Hz, 0.25 s pulses.
  for (let c = 0; c < 10_000; c += 1000) {
    m.set("P", 1, c);
    m.set("P", 0, c + 250);
  }
  const r = m.report(10_000).P;
  assert.ok(Math.abs(r.duty - 0.25) < 1e-9, `duty ${r.duty}`);
  assert.ok(Math.abs(r.freq - 1) < 1e-9, `freq ${r.freq}`);
  assert.ok(Math.abs(r.pulse - 0.25) < 1e-9, `pulse ${r.pulse}`);
});

test("ATmega328P toggles D13 with exact instruction timing", () => {
  // sbi DDRB,5 ; loop: sbi PINB,5 ; ldi r24,255 ; dec r24 ; brne .-2 ; rjmp loop
  // One pass = 2 + 1 + 255×3 − 1 + 2 = 769 cycles, so D13 toggles at 16 MHz / (2 × 769) = 10 403 Hz.
  const mcu = new UnoMachine(image([0x9a25, 0x9a1d, 0xef8f, 0x958a, 0xf7f1, 0xcffa]));
  mcu.run(16_000);
  mcu.meter.report(mcu.cycles);
  mcu.run(160_000);
  const r = mcu.meter.report(mcu.cycles).D13;
  assert.equal(mcu.modes().D13, "out");
  assert.equal(mcu.modes().D12, "in");
  assert.ok(Math.abs(r.freq - 16e6 / (2 * 769)) < 100, `freq ${r.freq}`);
  assert.ok(Math.abs(r.duty - 0.5) < 0.01, `duty ${r.duty}`);
});

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.hex`, import.meta.url), "utf8");

test("Arduino Blink (compiled by arduino-cli) toggles D13 every 500 ms of emulated time", () => {
  const mcu = new UnoMachine(fixture("blink"));
  mcu.run(16_000_000);
  mcu.meter.report(mcu.cycles);
  mcu.run(32_000_000);
  const r = mcu.meter.report(mcu.cycles).D13;
  assert.ok(Math.abs(r.freq - 1) < 0.01, `freq ${r.freq}`);
  assert.ok(Math.abs(r.duty - 0.5) < 0.002, `duty ${r.duty}`);
});

test("analogRead and Serial: 2.5 V on A0 reads 512, and the line arrives over the UART", () => {
  const mcu = new UnoMachine(fixture("analog"));
  mcu.input("A0", true, 2.5);
  mcu.input("D2", true, 5);
  mcu.run(16_000_000 * 0.35);
  const text = String.fromCharCode(...mcu.drainSerial());
  const first = text.split("\r\n")[0];
  assert.equal(first, "512 1");
  mcu.input("A0", false, 1.0);
  mcu.input("D2", false, 0);
  mcu.run(16_000_000 * 0.2);
  const lines = String.fromCharCode(...mcu.drainSerial()).split("\r\n").filter(Boolean);
  assert.equal(lines.at(-1), "204 0"); // ADC = floor(Vin × 1024 / 5 V)
});

test("analogWrite(9, 77) is 30.2 % duty at 490 Hz on Timer1", () => {
  const mcu = new UnoMachine(fixture("fade"));
  mcu.run(1_600_000);
  mcu.meter.report(mcu.cycles);
  mcu.run(8_000_000);
  const r = mcu.meter.report(mcu.cycles).D9;
  assert.ok(Math.abs(r.duty - 77 / 255) < 0.005, `duty ${r.duty}`);
  assert.ok(Math.abs(r.freq - 16e6 / 64 / 510) < 1, `freq ${r.freq}`);
});

test("input pins reach the program: a button on D2 is copied to D13", () => {
  // sbi DDRB,5 ; loop: sbic PIND,2 ; sbi PORTB,5 ; sbis PIND,2 ; cbi PORTB,5 ; rjmp loop
  const mcu = new UnoMachine(image([0x9a25, 0x994a, 0x9a2d, 0x9b4a, 0x982d, 0xcffb]));
  mcu.input("D2", true, 5);
  mcu.run(1000);
  assert.equal(mcu.meter.level("D13"), 1);
  mcu.input("D2", false, 0);
  mcu.run(1000);
  assert.equal(mcu.meter.level("D13"), 0);
});
