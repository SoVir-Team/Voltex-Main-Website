import type { Screen } from "../../lab/engine/solver.ts";
import type { I2cDevice } from "./i2c.ts";

/** Parameter bytes that follow each SSD1306 command. */
const PARAMS: Record<number, number> = {
  0x20: 1, 0x21: 2, 0x22: 2, 0x26: 6, 0x27: 6, 0x29: 5, 0x2a: 5, 0x81: 1, 0x8d: 1, 0xa3: 2, 0xa8: 1, 0xd3: 1, 0xd5: 1, 0xd9: 1, 0xda: 1, 0xdb: 1,
};

/**
 * SSD1306 128×64 OLED controller on I²C: the command set the Adafruit and U8g2 libraries use (addressing modes,
 * column and page windows, segment and COM remap, invert, on/off) and its 1 KB display RAM.
 */
export class Ssd1306 implements I2cDevice {
  readonly address: number;
  private ram = new Uint8Array(1024);
  private mode = 2;
  private col = 0;
  private page = 0;
  private colStart = 0;
  private colEnd = 127;
  private pageStart = 0;
  private pageEnd = 7;
  private segRemap = false;
  private comFlip = false;
  private invert = false;
  private on = false;
  private mux = 63;
  /** Inside a transaction: waiting for a control byte, or streaming commands or data. */
  private stream: "control" | "cmd" | "data" | "cmd1" | "data1" = "control";
  private cmd: number[] = [];
  dirty = true;

  constructor(address = 0x3c) {
    this.address = address;
  }

  start() {
    this.stream = "control";
  }

  write(b: number): boolean {
    switch (this.stream) {
      case "control":
        // Co (bit 7): one byte follows, then another control byte. D/C (bit 6): data or command.
        this.stream = b & 0x40 ? (b & 0x80 ? "data1" : "data") : b & 0x80 ? "cmd1" : "cmd";
        return true;
      case "cmd":
      case "cmd1":
        this.command(b);
        if (this.stream === "cmd1") this.stream = "control";
        return true;
      case "data":
      case "data1":
        this.data(b);
        if (this.stream === "data1") this.stream = "control";
        return true;
    }
  }

  read() {
    return this.on ? 0x03 : 0x43;
  }

  private command(b: number) {
    this.cmd.push(b);
    const need = PARAMS[this.cmd[0]] ?? 0;
    if (this.cmd.length <= need) return;
    const [c, p1, p2] = this.cmd;
    this.cmd = [];
    this.dirty = true;
    if (c === 0x20) this.mode = p1 & 3;
    else if (c === 0x21) {
      this.colStart = this.col = p1 & 127;
      this.colEnd = p2 & 127;
    } else if (c === 0x22) {
      this.pageStart = this.page = p1 & 7;
      this.pageEnd = p2 & 7;
    } else if (c >= 0xb0 && c <= 0xb7) this.page = c & 7;
    else if (c <= 0x0f) this.col = (this.col & 0xf0) | c;
    else if (c >= 0x10 && c <= 0x1f) this.col = ((c & 0x0f) << 4) | (this.col & 0x0f);
    else if (c === 0xa0 || c === 0xa1) this.segRemap = c === 0xa1;
    else if (c === 0xc0 || c === 0xc8) this.comFlip = c === 0xc8;
    else if (c === 0xa6 || c === 0xa7) this.invert = c === 0xa7;
    else if (c === 0xae || c === 0xaf) this.on = c === 0xaf;
    else if (c === 0xa8) this.mux = p1 & 63;
  }

  private data(b: number) {
    this.dirty = true;
    this.ram[this.page * 128 + this.col] = b;
    if (this.mode === 2) {
      this.col = (this.col + 1) & 127;
      return;
    }
    if (this.mode === 0) {
      if (this.col >= this.colEnd) {
        this.col = this.colStart;
        this.page = this.page >= this.pageEnd ? this.pageStart : this.page + 1;
      } else this.col++;
    } else if (this.page >= this.pageEnd) {
      this.page = this.pageStart;
      this.col = this.col >= this.colEnd ? this.colStart : this.col + 1;
    } else this.page++;
  }

  /** The picture as the glass shows it: remap and scan direction applied, so (0,0) is the top-left pixel. */
  screen(): Screen {
    const h = this.mux + 1 >= 64 ? 64 : 32;
    const fb = new Uint8Array(128 * (h / 8));
    for (let y = 0; y < h; y++) {
      // With COM scan reversed (C8), row y comes from RAM row y; otherwise the panel is upside down.
      const ry = this.comFlip ? y : h - 1 - y;
      for (let x = 0; x < 128; x++) {
        const rx = this.segRemap ? x : 127 - x;
        if ((this.ram[(ry >> 3) * 128 + rx] >> (ry & 7)) & 1) fb[(y >> 3) * 128 + x] |= 1 << (y & 7);
      }
    }
    return { kind: "oled", on: this.on, invert: this.invert, w: 128, h, fb };
  }
}
