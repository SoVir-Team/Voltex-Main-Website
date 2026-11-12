import type { McuBoard, PinDrive } from "../../lab/engine/mcu-boards.ts";
import type { I2cBus } from "../devices/i2c.ts";
import type { PinMeter } from "./meter.ts";

/** One emulated microcontroller, stepped in CPU cycles. */
export interface Machine {
  readonly board: McuBoard;
  /** CPU clock in hertz. */
  readonly hz: number;
  readonly meter: PinMeter;
  /** The chip's I²C buses (one on the Uno, two on the Pico). */
  readonly i2c: I2cBus[];
  /** Called when an output pin changes level, at the moment it changes. */
  onPin: (pin: string, level: 0 | 1) => void;
  readonly cycles: number;
  /** Execute at least `cycles` more CPU cycles. */
  run(cycles: number): void;
  /** How the program has configured each GPIO right now. */
  modes(): Record<string, PinDrive["mode"]>;
  /** What the circuit presents at an input pin: its logic level and, for analog pins, its voltage. */
  input(pin: string, level: boolean, volts: number): void;
  /** Bytes typed into the serial monitor. */
  serialIn(bytes: number[]): void;
  /** Bytes the program printed since the last call. */
  drainSerial(): number[];
}
