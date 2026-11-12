import { GPIOPinState, RP2040, USBCDC } from "rp2040js";
import { PICO, type PinDrive } from "../../lab/engine/mcu-boards.ts";
import { I2cBus } from "../devices/i2c.ts";
import { bootromB1 } from "./bootrom.ts";
import { parseUf2 } from "./hex.ts";
import type { Machine } from "./machine.ts";
import { PinMeter } from "./meter.ts";
import type { Program } from "./protocol.ts";

const FLASH_BASE = 0x10000000;
const FLASH_SIZE = 2 * 1024 * 1024;
/** Time is kept in nanoseconds: "cycles" for this machine are ns, so the worker's arithmetic stays the same. */
const NS = 1e9;
/** Longest run of instructions between clock updates, in ns. */
const BURST = 2000;

/** The simulation clock RP2040 creates by default (not exported by the package). */
interface SimClock {
  readonly nanos: number;
  readonly nanosToNextAlarm: number;
  tick(deltaNanos: number): void;
}

/** Ctrl codes of the MicroPython REPL. */
const CTRL_A = 1;
const CTRL_B = 2;
const CTRL_C = 3;
const CTRL_D = 4;

/**
 * Raspberry Pi Pico: an RP2040 (rp2040js) booting the real boot ROM and a UF2 image, either the program compiled
 * with arduino-pico or the official MicroPython firmware. USB serial is emulated as a CDC device; for MicroPython,
 * the script is sent through the raw REPL once the board has booted, so it runs exactly as on a real Pico.
 */
export class PicoMachine implements Machine {
  readonly board = "pico" as const;
  readonly hz = NS;
  readonly meter = new PinMeter(NS);
  readonly mcu: RP2040;
  readonly clock: SimClock;
  private cdc: USBCDC;
  private tx: number[] = [];
  private pyState: "boot" | "raw" | "sent" | "running" | "done" = "boot";
  private script: string | null;
  readonly i2c = [new I2cBus(), new I2cBus()];
  onPin: (pin: string, level: 0 | 1) => void = () => {};
  private heldRead: { endpoint: number; size: number } | null = null;
  private releaseRead: () => void = () => {};
  private echo = "";
  private eots = 0;

  static async create(program: Program, firmware?: ArrayBuffer): Promise<PicoMachine> {
    if (program.board !== "pico") throw new Error("Not a Pico program");
    if (program.kind === "uf2") return new PicoMachine(Uint8Array.from(atob(program.data), (c) => c.charCodeAt(0)), null);
    if (program.kind === "python") {
      if (!firmware) throw new Error("MicroPython firmware missing");
      return new PicoMachine(new Uint8Array(firmware), program.data);
    }
    throw new Error("Unknown program");
  }

  private constructor(uf2: Uint8Array, script: string | null) {
    this.script = script;
    this.mcu = new RP2040();
    this.clock = this.mcu.clock as unknown as SimClock;
    this.mcu.logger = { debug() {}, info() {}, warn() {}, error() {} } as unknown as RP2040["logger"];
    this.mcu.loadBootrom(bootromB1);
    this.mcu.flash.set(parseUf2(uf2, FLASH_BASE, FLASH_SIZE));
    this.mcu.core.PC = FLASH_BASE;
    this.cdc = new USBCDC(this.mcu.usbCtrl);
    this.cdc.onSerialData = (buf) => this.received(buf);
    // rp2040js's host answers every "ready to receive" at once, with an empty packet when it has nothing to send.
    // A real host only sends when it has data; answering at once keeps the chip in a USB interrupt every ~25 µs
    // and runs MicroPython at a fifth of its speed. Hold the request until there is something to send.
    const usb = this.mcu.usbCtrl;
    const answer = usb.onEndpointRead!;
    usb.onEndpointRead = (endpoint, size) => {
      if (endpoint !== 0 && this.cdc.txFIFO.empty) this.heldRead = { endpoint, size };
      else answer(endpoint, size);
    };
    this.releaseRead = () => {
      const held = this.heldRead;
      if (!held || this.cdc.txFIFO.empty) return;
      this.heldRead = null;
      answer(held.endpoint, held.size);
    };
    this.cdc.onDeviceConnected = () => {
      // The host opened the port. MicroPython prints its banner and waits; interrupt it into the raw REPL.
      if (this.script !== null) this.send([CTRL_C, CTRL_C]);
    };
    this.mcu.i2c.forEach((ctrl, k) => {
      const bus = this.i2c[k];
      ctrl.onStart = () => ctrl.completeStart();
      ctrl.onConnect = (address) => ctrl.completeConnect(bus.connect(address));
      ctrl.onWriteByte = (v) => ctrl.completeWrite(bus.write(v));
      ctrl.onReadByte = () => ctrl.completeRead(bus.read());
      ctrl.onStop = () => {
        bus.stop();
        ctrl.completeStop();
      };
    });
    for (const io of [...PICO.gpio, { id: "GP25", gp: 25 }]) {
      const pin = this.mcu.gpio[io.gp!];
      pin.addListener((state) => {
        // A driven pin's input buffer sees its own output, as on the chip (rp2040js leaves the input alone).
        if (state === GPIOPinState.High) {
          this.meter.set(io.id, 1, this.clock.nanos);
          pin.setInputValue(true);
          this.onPin(io.id, 1);
        } else if (state === GPIOPinState.Low) {
          this.meter.set(io.id, 0, this.clock.nanos);
          pin.setInputValue(false);
          this.onPin(io.id, 0);
        }
      });
    }
  }

  get cycles() {
    return this.clock.nanos;
  }

  run(nanos: number) {
    const { mcu, clock } = this;
    const end = clock.nanos + nanos;
    while (clock.nanos < end) {
      if (mcu.core.waiting) {
        const next = clock.nanosToNextAlarm;
        if (next <= 0 || !Number.isFinite(next)) clock.tick(Math.max(1, end - clock.nanos));
        else clock.tick(Math.min(next, end - clock.nanos + 1));
      } else {
        // Run a short burst before advancing the clock: never past the next timer alarm, and at most 2 µs, so
        // timers fire on time and pin edges are timed to within 2 µs. Ticking per instruction is 2-3× slower.
        const ns = NS / (mcu.clkSys || 125e6);
        const budget = Math.min(clock.nanosToNextAlarm, end - clock.nanos, BURST);
        let spent = 0;
        do spent += mcu.core.executeInstruction() * ns;
        while (spent < budget && !mcu.core.waiting);
        clock.tick(spent);
      }
    }
  }

  modes(): Record<string, PinDrive["mode"]> {
    const out: Record<string, PinDrive["mode"]> = {};
    for (const io of PICO.gpio) {
      const s = this.mcu.gpio[io.gp!].value;
      out[io.id] = s === GPIOPinState.High || s === GPIOPinState.Low ? "out" : s === GPIOPinState.InputPullUp ? "pullup" : s === GPIOPinState.InputPullDown ? "pulldown" : "in";
    }
    return out;
  }

  input(pin: string, level: boolean, volts: number) {
    const io = PICO.gpio.find((g) => g.id === pin);
    if (!io) return;
    this.mcu.gpio[io.gp!].setInputValue(level);
    if (io.adc !== undefined) this.mcu.adc.channelValues[io.adc] = Math.round((Math.max(0, Math.min(PICO.adcRef, volts)) / PICO.adcRef) * 4095);
  }

  serialIn(bytes: number[]) {
    this.send(bytes);
  }

  private send(bytes: number[]) {
    for (const b of bytes) this.cdc.sendSerialByte(b);
    this.releaseRead();
  }

  /** Bytes from the board. For MicroPython, the raw-REPL handshake is hidden and only the program's output shown. */
  private received(buf: Uint8Array) {
    if (this.script === null || this.pyState === "done") {
      this.tx.push(...buf);
      return;
    }
    for (const b of buf) {
      this.echo = (this.echo + String.fromCharCode(b)).slice(-64);
      switch (this.pyState) {
        case "boot":
          if (this.echo.endsWith(">>> ")) {
            this.pyState = "raw";
            this.echo = "";
            this.send([CTRL_A]);
          }
          break;
        case "raw":
          if (this.echo.endsWith("raw REPL; CTRL-B to exit\r\n>")) {
            this.pyState = "sent";
            this.echo = "";
            this.send([...new TextEncoder().encode(this.script.replace(/\r\n/g, "\n")), CTRL_D]);
          }
          break;
        case "sent":
          if (this.echo.endsWith("OK")) {
            this.pyState = "running";
            this.echo = "";
          }
          break;
        case "running":
          // Output, then \x04, then any error text, then \x04>.
          if (b === CTRL_D) {
            if (++this.eots >= 2) {
              this.pyState = "done";
              this.tx.push(...new TextEncoder().encode("\r\n[program finished: type into the REPL below]\r\n"));
              this.send([CTRL_B]);
            }
          } else this.tx.push(b);
          break;
      }
    }
  }

  drainSerial(): number[] {
    const out = this.tx;
    this.tx = [];
    return out;
  }
}
