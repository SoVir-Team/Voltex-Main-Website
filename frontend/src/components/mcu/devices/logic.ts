import type { Screen } from "../../lab/engine/solver.ts";
import { Hd44780 } from "./hd44780.ts";
import { I2cBus, Pcf8574 } from "./i2c.ts";
import { Ssd1306 } from "./ssd1306.ts";

/**
 * The digital chips wired to a running microcontroller, simulated inside the emulator at the chip's own speed:
 * an LCD strobed in microseconds or a shift register clocked at 100 kHz changes far faster than the circuit
 * solver's time step. Which pin feeds which input is worked out from the circuit (see wiring in the UI) and
 * stays fixed while the program runs.
 */

/** Where a chip input comes from: a microcontroller pin, an expander output, or a fixed level. */
export type Src = { gpio: string } | { pcf: string; bit: number } | { level: 0 | 1 };

export interface Wiring {
  i2c: { partId: string; kind: "ssd1306" | "pcf8574"; bus: number; address: number }[];
  /** RS, RW, E and D0..D7 of each LCD. */
  lcds: { partId: string; rs: Src; rw: Src; e: Src; d: Src[] }[];
  shifters: { partId: string; ser: Src; srclk: Src; rclk: Src; srclr: Src }[];
}

export const NO_WIRING: Wiring = { i2c: [], lcds: [], shifters: [] };

export class Logic {
  private gpio = new Map<string, number>();
  private pcfs = new Map<string, Pcf8574>();
  private oleds = new Map<string, Ssd1306>();
  private lcds: { partId: string; chip: Hd44780; w: Wiring["lcds"][number] }[] = [];
  private shifters: { w: Wiring["shifters"][number]; reg: number; out: number; clk: number; rclk: number }[] = [];
  private changedLatches = true;

  constructor(wiring: Wiring, buses: I2cBus[]) {
    for (const d of wiring.i2c) {
      const bus = buses[d.bus];
      if (!bus) continue;
      if (d.kind === "ssd1306") {
        const oled = new Ssd1306(d.address);
        this.oleds.set(d.partId, oled);
        bus.devices.push(oled);
      } else {
        const pcf = new Pcf8574(d.address);
        pcf.onChange = () => {
          this.changedLatches = true;
          this.update();
        };
        this.pcfs.set(d.partId, pcf);
        bus.devices.push(pcf);
      }
    }
    this.lcds = wiring.lcds.map((w) => ({ partId: w.partId, chip: new Hd44780(), w }));
    this.shifters = wiring.shifters.map((w) => ({ w, reg: 0, out: 0, clk: 0, rclk: 0 }));
  }

  get active() {
    return this.lcds.length > 0 || this.shifters.length > 0 || this.oleds.size > 0 || this.pcfs.size > 0;
  }

  private level(s: Src): number {
    if ("level" in s) return s.level;
    if ("gpio" in s) return this.gpio.get(s.gpio) ?? 0;
    return ((this.pcfs.get(s.pcf)?.value ?? 0xff) >> s.bit) & 1;
  }

  /** A microcontroller output pin changed level. */
  pin(id: string, level: number) {
    if (this.gpio.get(id) === level) return;
    this.gpio.set(id, level);
    this.update();
  }

  private update() {
    for (const l of this.lcds) {
      const L = (s: Src) => this.level(s);
      let d = 0;
      for (let i = 0; i < 8; i++) d |= L(l.w.d[i]) << i;
      l.chip.bus(L(l.w.rs), L(l.w.rw), L(l.w.e), d);
    }
    for (const s of this.shifters) {
      const clk = this.level(s.w.srclk);
      const rclk = this.level(s.w.rclk);
      if (!this.level(s.w.srclr)) s.reg = 0;
      else if (clk && !s.clk) s.reg = ((s.reg << 1) | this.level(s.w.ser)) & 0xff;
      if (rclk && !s.rclk && s.out !== s.reg) {
        s.out = s.reg;
        this.changedLatches = true;
      }
      s.clk = clk;
      s.rclk = rclk;
    }
  }

  /** Display contents that changed since the last call. */
  screens(): Record<string, Screen> {
    const out: Record<string, Screen> = {};
    for (const [id, o] of this.oleds) {
      if (!o.dirty) continue;
      o.dirty = false;
      out[id] = o.screen();
    }
    for (const l of this.lcds) {
      if (!l.chip.dirty) continue;
      l.chip.dirty = false;
      out[l.partId] = l.chip.screen();
    }
    return out;
  }

  /** Output bytes of the shift registers and expanders, when any changed. */
  latched(): Record<string, number> | undefined {
    if (!this.changedLatches) return undefined;
    this.changedLatches = false;
    const out: Record<string, number> = {};
    for (const s of this.shifters) out[s.w.partId] = s.out;
    for (const [id, p] of this.pcfs) out[id] = p.value;
    return out;
  }
}
