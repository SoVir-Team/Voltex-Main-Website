import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PicoMachine } from "./rp2040.ts";

const firmware = readFileSync(new URL("../../../../public/mcu/micropython-pico.uf2", import.meta.url));

async function python(script: string) {
  const ab = firmware.buffer.slice(firmware.byteOffset, firmware.byteOffset + firmware.byteLength);
  return PicoMachine.create({ board: "pico", kind: "python", data: script }, ab);
}

test("MicroPython boots on the emulated RP2040 and runs a script sent over USB serial", async () => {
  const m = await python("print(1 + 1)\nprint('hello from the pico')\n");
  let text = "";
  for (let i = 0; i < 40 && !text.includes("finished"); i++) {
    m.run(0.1e9);
    text += String.fromCharCode(...m.drainSerial());
  }
  assert.match(text, /^2\r\nhello from the pico\r\n/);
});

test("MicroPython Pin(15).toggle() makes edges on GP15, and Pin(14) reads the circuit", async () => {
  const m = await python("from machine import Pin\nimport time\np = Pin(15, Pin.OUT)\nb = Pin(14, Pin.IN, Pin.PULL_UP)\nfor i in range(10):\n    p.toggle()\n    time.sleep_ms(10)\nprint('btn', b.value())\n");
  m.input("GP14", false, 0);
  let text = "";
  for (let i = 0; i < 40 && !text.includes("finished"); i++) {
    m.run(0.1e9);
    text += String.fromCharCode(...m.drainSerial());
  }
  assert.match(text, /btn 0/);
  assert.equal(m.modes().GP14, "pullup");
  assert.equal(m.modes().GP15, "out");
});

test("Arduino C++ (arduino-pico) runs from its UF2: USB Serial, the LED, analogWrite and analogRead", async () => {
  const uf2 = readFileSync(new URL("./fixtures/pico-blink.uf2", import.meta.url)).toString("base64");
  const m = await PicoMachine.create({ board: "pico", kind: "uf2", data: uf2 });
  m.input("GP26", false, 1.65);
  m.run(1.5e9);
  m.meter.report(m.cycles);
  m.run(1e9);
  const r = m.meter.report(m.cycles);
  assert.ok(Math.abs(r.GP15.duty - 77 / 255) < 0.01, `GP15 duty ${r.GP15.duty}`);
  assert.ok(Math.abs(r.GP15.freq - 1000) < 5, `GP15 freq ${r.GP15.freq}`);
  assert.ok(Math.abs(r.GP25.freq - 5) < 0.6, `LED freq ${r.GP25.freq}`);
  const lines = String.fromCharCode(...m.drainSerial()).split("\r\n").filter((l) => l.startsWith("tick"));
  assert.ok(lines.length > 5, lines.join("|"));
  // 1.65 V on a 3.3 V, 10-bit analogRead (arduino-pico default) is 511 or 512.
  assert.match(lines.at(-1)!, /^tick 51[12]$/);
});

test("reading an output pin returns what it drives", async () => {
  const m = await python("from machine import Pin\nled = Pin('LED', Pin.OUT)\nled.on()\nprint('v', led.value())\nled.off()\nprint('v', led.value())\n");
  let text = "";
  for (let i = 0; i < 40 && !text.includes("finished"); i++) {
    m.run(0.1e9);
    text += String.fromCharCode(...m.drainSerial());
  }
  assert.match(text, /v 1\r\nv 0/);
});
