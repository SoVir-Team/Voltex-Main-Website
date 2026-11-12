import type { Screen } from "../../lab/engine/solver.ts";

/**
 * HD44780 character LCD controller (16×2), driven through its 4-bit or 8-bit parallel bus. Data is latched on
 * the falling edge of E, exactly as the chip does, so it works the same whether the pins come from the
 * microcontroller (LiquidCrystal) or from a PCF8574 I²C backpack (LiquidCrystal_I2C).
 */
export class Hd44780 {
  private ddram = new Uint8Array(0x80).fill(0x20);
  private cgram = new Uint8Array(64);
  private ac = 0;
  private toCg = false;
  private increment = true;
  private shiftOnWrite = false;
  private shift = 0;
  private displayOn = false;
  private cursorOn = false;
  private blinkOn = false;
  private eightBit = true;
  private twoLines = false;
  /** In 4-bit mode, the high nibble waiting for its low half. */
  private high: number | null = null;
  private lastE = 0;
  dirty = true;

  /**
   * Present the bus pins. `d` holds D7..D0 as a byte; in 4-bit mode only D7..D4 (bits 7..4) are wired.
   * Called on every change of any of them; acts when E falls.
   */
  bus(rs: number, rw: number, e: number, d: number) {
    const fell = this.lastE === 1 && e === 0;
    this.lastE = e;
    if (!fell || rw) return;
    if (this.eightBit) {
      this.exec(rs, d & 0xff);
      return;
    }
    const nibble = (d >> 4) & 0xf;
    if (this.high === null) this.high = nibble;
    else {
      const v = (this.high << 4) | nibble;
      this.high = null;
      this.exec(rs, v);
    }
  }

  private exec(rs: number, v: number) {
    this.dirty = true;
    if (rs) return this.write(v);
    if (v & 0x80) {
      this.ac = v & 0x7f;
      this.toCg = false;
    } else if (v & 0x40) {
      this.ac = v & 0x3f;
      this.toCg = true;
    } else if (v & 0x20) {
      this.eightBit = Boolean(v & 0x10);
      this.twoLines = Boolean(v & 0x08);
      this.high = null;
    } else if (v & 0x10) {
      const display = Boolean(v & 0x08);
      const right = Boolean(v & 0x04);
      if (display) this.shift = (this.shift + (right ? -1 : 1) + 40) % 40;
      else this.ac = this.step(this.ac, right);
    } else if (v & 0x08) {
      this.displayOn = Boolean(v & 0x04);
      this.cursorOn = Boolean(v & 0x02);
      this.blinkOn = Boolean(v & 0x01);
    } else if (v & 0x04) {
      this.increment = Boolean(v & 0x02);
      this.shiftOnWrite = Boolean(v & 0x01);
    } else if (v & 0x02) {
      this.ac = 0;
      this.shift = 0;
      this.toCg = false;
    } else if (v & 0x01) {
      this.ddram.fill(0x20);
      this.ac = 0;
      this.shift = 0;
      this.increment = true;
      this.toCg = false;
    }
  }

  /** DDRAM addresses run 0x00–0x27 (line 1) and 0x40–0x67 (line 2), and wrap from one to the other. */
  private step(ac: number, up: boolean): number {
    if (this.toCg) return (ac + (up ? 1 : -1)) & 0x3f;
    if (!this.twoLines) return (ac + (up ? 1 : 79)) % 80;
    if (up) return ac === 0x27 ? 0x40 : ac === 0x67 ? 0x00 : ac + 1;
    return ac === 0x40 ? 0x27 : ac === 0x00 ? 0x67 : ac - 1;
  }

  private write(v: number) {
    if (this.toCg) this.cgram[this.ac & 0x3f] = v & 0x1f;
    else this.ddram[this.ac] = v;
    this.ac = this.step(this.ac, this.increment);
    if (this.shiftOnWrite && !this.toCg) this.shift = (this.shift + (this.increment ? 1 : -1) + 40) % 40;
  }

  screen(): Screen {
    const rows = [0, 1].map((r) => Array.from({ length: 16 }, (_, c) => this.ddram[(this.twoLines ? r * 0x40 : r * 0x28) + ((c + this.shift) % 40)]));
    let cursor: Extract<Screen, { kind: "lcd" }>["cursor"] = null;
    if (!this.toCg && (this.cursorOn || this.blinkOn)) {
      const row = this.twoLines && this.ac >= 0x40 ? 1 : 0;
      const col = ((this.ac - row * 0x40 - this.shift) % 40 + 40) % 40;
      if (col < 16) cursor = { row, col, show: this.cursorOn, blink: this.blinkOn };
    }
    return { kind: "lcd", on: this.displayOn, rows: this.twoLines ? rows : [rows[0], Array(16).fill(0x20)], cursor, cgram: [...this.cgram] };
  }
}

/** HD44780 character ROM (A00) as text: ASCII, with the ROM's own symbols and katakana above 0x7F. */
export function lcdChar(code: number): string {
  if (code === 0x5c) return "¥";
  if (code === 0x7e) return "→";
  if (code === 0x7f) return "←";
  if (code === 0xdf) return "°";
  if (code === 0xe4) return "µ";
  if (code === 0xf4) return "Ω";
  if (code === 0xff) return "█";
  if (code >= 0x20 && code < 0x7e) return String.fromCharCode(code);
  if (code >= 0xa1 && code <= 0xdf) return String.fromCharCode(0xff61 + code - 0xa1);
  return " ";
}
