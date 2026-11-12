import type { McuBoard, PinDrive } from "../../lab/engine/mcu-boards.ts";
import type { Screen } from "../../lab/engine/solver.ts";
import type { Wiring } from "../devices/logic.ts";
import type { PinReading } from "./meter.ts";

/** Messages between the lab page and the emulator worker. */

export type Program =
  /** Intel HEX from the compiler (Uno). */
  | { board: "uno"; kind: "hex"; data: string }
  /** UF2 from the compiler, base64 (Pico, Arduino C++). */
  | { board: "pico"; kind: "uf2"; data: string }
  /** A MicroPython script, run on the MicroPython firmware (Pico). */
  | { board: "pico"; kind: "python"; data: string };

export type ToWorker =
  | { t: "load"; program: Program; firmware?: ArrayBuffer; pins?: Record<string, { level: boolean; volts: number }>; wiring?: Wiring }
  | { t: "pause"; paused: boolean }
  | { t: "pins"; pins: Record<string, { level: boolean; volts: number }> }
  | { t: "serial"; bytes: number[] }
  | { t: "stop" };

export interface Frame {
  t: "frame";
  board: McuBoard;
  /** Emulated seconds this frame covers. */
  dt: number;
  /** Emulated seconds since reset. */
  time: number;
  /** Emulated time / wall time over the last second. */
  speed: number;
  modes: Record<string, PinDrive["mode"]>;
  readings: Record<string, PinReading>;
  serial: number[];
  /** Displays whose contents changed this frame. */
  screens: Record<string, Screen>;
  /** Shift-register and expander output bytes, when any changed. */
  latched?: Record<string, number>;
}

export type FromWorker = Frame | { t: "ready" } | { t: "error"; message: string };
