import { BOARDS, type McuBoard } from "../lab/engine/mcu-boards.ts";
import type { Netlist } from "../lab/engine/netlist.ts";
import type { Board, Part } from "../lab/engine/types.ts";
import type { Src, Wiring } from "./devices/logic.ts";

/**
 * Works out, from the circuit, which digital chips the program drives and through which pins: an LCD whose RS,
 * E and data lines sit on microcontroller pins or on a PCF8574's outputs, a 74HC595 clocked from pins, and
 * OLEDs and expanders on the chip's I²C pins. Unconnected chip inputs read as 0, like a tied-down input.
 */
export function wiringFor(board: Board, nl: Netlist, mcu: Part): Wiring {
  const spec = BOARDS[mcu.type as McuBoard];
  const net = (partId: string, pin: string) => nl.netOf.get(`${partId}.${pin}`);
  const gndNet = net(mcu.id, spec.gnd);
  const railNets = new Set(spec.rails.map((r) => net(mcu.id, r.pin)).filter((n) => n !== undefined));
  /** The GPIO pin sitting on a net, if any. */
  const gpioOn = (n: number | undefined) => (n === undefined ? undefined : spec.gpio.find((g) => net(mcu.id, g.id) === n)?.id);

  // I²C: SDA and SCL of a device must meet a matching SDA/SCL pin pair of the chip.
  const i2cBusOf = (part: Part): number | undefined => {
    const sda = net(part.id, "SDA");
    const scl = net(part.id, "SCL");
    if (sda === undefined || scl === undefined) return undefined;
    if (mcu.type === "uno") return net(mcu.id, "A4") === sda && net(mcu.id, "A5") === scl ? 0 : undefined;
    // RP2040: GP(4k) / GP(4k+1) are I2C0 SDA/SCL, GP(4k+2) / GP(4k+3) are I2C1.
    for (const g of spec.gpio) {
      const n = g.gp!;
      if (n % 2 === 0 && net(mcu.id, g.id) === sda && net(mcu.id, `GP${n + 1}`) === scl) return (n >> 1) & 1;
    }
    return undefined;
  };

  const i2c: Wiring["i2c"] = [];
  const pcfs: Part[] = [];
  for (const p of board.parts) {
    if (p.type !== "oled" && p.type !== "pcf8574") continue;
    const bus = i2cBusOf(p);
    if (bus === undefined) continue;
    if (p.type === "oled") i2c.push({ partId: p.id, kind: "ssd1306", bus, address: 0x3c });
    else {
      // Address pins A0–A2: tied to a supply rail is 1, anything else (GND, open) 0.
      let a = 0;
      ["A0", "A1", "A2"].forEach((pin, i) => {
        const n = net(p.id, pin);
        if (n !== undefined && railNets.has(n)) a |= 1 << i;
      });
      i2c.push({ partId: p.id, kind: "pcf8574", bus, address: 0x20 | a });
      pcfs.push(p);
    }
  }

  /** What drives a chip input: a chip pin, an expander output, or a fixed level. */
  const source = (partId: string, pin: string): Src => {
    const n = net(partId, pin);
    const g = gpioOn(n);
    if (g) return { gpio: g };
    for (const x of pcfs) {
      for (let bit = 0; bit < 8; bit++) if (net(x.id, `P${bit}`) === n) return { pcf: x.id, bit };
    }
    if (n !== undefined && railNets.has(n)) return { level: 1 };
    if (n === gndNet) return { level: 0 };
    return { level: 0 };
  };
  const driven = (s: Src) => !("level" in s);

  const lcds: Wiring["lcds"] = [];
  const shifters: Wiring["shifters"] = [];
  for (const p of board.parts) {
    if (p.type === "lcd1602") {
      const w = { partId: p.id, rs: source(p.id, "RS"), rw: source(p.id, "RW"), e: source(p.id, "E"), d: Array.from({ length: 8 }, (_, i) => source(p.id, `D${i}`)) };
      if (driven(w.e)) lcds.push(w);
    } else if (p.type === "hc595") {
      const w = { partId: p.id, ser: source(p.id, "SER"), srclk: source(p.id, "SRCLK"), rclk: source(p.id, "RCLK"), srclr: source(p.id, "SRCLR") };
      // SRCLR left open floats; on a breadboard it is tied high, so treat open as high.
      if (net(p.id, "SRCLR") === undefined || nl.nets[net(p.id, "SRCLR")!].pins.length < 2) w.srclr = { level: 1 };
      if (driven(w.srclk)) shifters.push(w);
    }
  }
  return { i2c, lcds, shifters };
}
