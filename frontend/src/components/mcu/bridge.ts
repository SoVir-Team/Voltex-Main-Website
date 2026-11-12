import { BOARDS, isMcu, type McuBoard, type PinDrive } from "../lab/engine/mcu-boards.ts";
import type { Netlist } from "../lab/engine/netlist.ts";
import type { PartState, SimInputs, SimSnapshot, Simulator } from "../lab/engine/solver.ts";
import type { Board } from "../lab/engine/types.ts";
import type { PinReading } from "./emu/meter.ts";

/**
 * Couples a running microcontroller to the circuit. Each frame the emulator reports how every pin behaved (mode,
 * level, PWM duty). The circuit is then advanced through each distinct combination of output levels for the share
 * of the frame it lasted, so an LED on a 30 % PWM pin carries its full current 30 % of the time, exactly as on the
 * bench, instead of a misleading current at 30 % of the voltage. Input pins are read back from the solved circuit.
 */

export interface BoardActivity {
  partId: string;
  board: McuBoard;
  modes: Record<string, PinDrive["mode"]>;
  readings: Record<string, PinReading>;
}

/** Duties this close to 0 or 1 are treated as steady levels. */
const EDGE = 0.002;

interface Pwm {
  partId: string;
  pin: string;
  duty: number;
}

/** The drive each board's pins present for one output-level combination. */
function drivesFor(boards: BoardActivity[], high: (partId: string, pin: string) => boolean) {
  const map = new Map<string, Record<string, PinDrive>>();
  for (const b of boards) {
    const rec: Record<string, PinDrive> = {};
    for (const [pin, mode] of Object.entries(b.modes)) rec[pin] = { mode, duty: mode === "out" ? (high(b.partId, pin) ? 1 : 0) : 0 };
    // The on-board LED is not on the header; carry its duty for drawing.
    const led = BOARDS[b.board].led;
    if (!rec[led] && b.readings[led]) rec[led] = { mode: "out", duty: b.readings[led].duty };
    map.set(b.partId, rec);
  }
  return map;
}

function mix(acc: SimSnapshot | null, s: SimSnapshot, w: number): SimSnapshot {
  if (!acc) {
    const parts: Record<string, PartState> = {};
    for (const [id, st] of Object.entries(s.parts)) {
      parts[id] = {
        ...st,
        current: st.current * w,
        power: st.power * w,
        glow: st.glow * w,
        stress: st.stress,
        level: st.level === undefined ? undefined : st.level * w,
        pinCurrents: Object.fromEntries(Object.entries(st.pinCurrents).map(([k, v]) => [k, v * w])),
        segs: st.segs?.map((g) => g * w),
      };
    }
    return { ...s, netV: s.netV.map((v) => v * w), parts };
  }
  acc.netV = acc.netV.map((v, i) => v + (s.netV[i] ?? 0) * w);
  acc.time = s.time;
  for (const [id, st] of Object.entries(s.parts)) {
    const a = acc.parts[id];
    if (!a) continue;
    a.current += st.current * w;
    a.power += st.power * w;
    a.glow += st.glow * w;
    a.stress = Math.max(a.stress, st.stress);
    if (st.level !== undefined) a.level = (a.level ?? 0) + st.level * w;
    for (const [k, v] of Object.entries(st.pinCurrents)) a.pinCurrents[k] = (a.pinCurrents[k] ?? 0) + v * w;
    if (st.segs && a.segs) a.segs = a.segs.map((g, i) => g + (st.segs![i] ?? 0) * w);
    a.on ||= st.on;
    a.burnt ||= st.burnt;
    a.reversed ||= st.reversed;
    a.reading = st.reading;
    a.wave = st.wave;
    a.phase = st.phase;
  }
  return acc;
}

/**
 * Advance the circuit by `dt` seconds of emulated time. Returns the time-averaged snapshot (what the eye and a
 * multimeter see) and the voltage at every input pin, to feed back to the emulator.
 */
export function stepCircuit(sim: Simulator, dt: number, inputs: SimInputs, boards: BoardActivity[]): SimSnapshot {
  // Pins switching during the frame, sorted by duty: during [d(k-1), d(k)) every pin with duty ≥ d(k) is high.
  const pwm: Pwm[] = [];
  for (const b of boards) {
    for (const [pin, mode] of Object.entries(b.modes)) {
      const d = b.readings[pin]?.duty ?? 0;
      if (mode === "out" && d > EDGE && d < 1 - EDGE) pwm.push({ partId: b.partId, pin, duty: d });
    }
  }
  // Keep the number of solves small: duties within 1 % share a slice.
  const cuts = [...new Set(pwm.map((p) => Math.round(p.duty * 100) / 100))].sort((a, b) => a - b);
  const bounds = [0, ...cuts, 1];
  const steady = (b: BoardActivity, pin: string) => (b.readings[pin]?.duty ?? 0) >= 0.5;
  let acc: SimSnapshot | null = null;
  for (let k = 1; k < bounds.length; k++) {
    const w = bounds[k] - bounds[k - 1];
    if (w <= 0) continue;
    const mid = (bounds[k] + bounds[k - 1]) / 2;
    const drives = drivesFor(boards, (partId, pin) => {
      const p = pwm.find((q) => q.partId === partId && q.pin === pin);
      if (p) return p.duty > mid;
      const b = boards.find((q) => q.partId === partId)!;
      return steady(b, pin);
    });
    const inp: SimInputs = { ...inputs, mcu: drives };
    sim.step(w * dt, inp);
    acc = mix(acc, sim.snapshot(inp), w);
  }
  return acc ?? sim.snapshot({ ...inputs, mcu: drivesFor(boards, (id, pin) => steady(boards.find((b) => b.partId === id)!, pin)) });
}

/** Logic level and voltage at each of a board's pins, read from the circuit, with the chip's input hysteresis. */
export function readPins(board: Board, nl: Netlist, snap: SimSnapshot, b: BoardActivity, prev: Record<string, boolean>): Record<string, { level: boolean; volts: number }> {
  const spec = BOARDS[b.board];
  const v = (pin: string) => snap.netV[nl.netOf.get(`${b.partId}.${pin}`) ?? -1] ?? 0;
  const g = v(spec.gnd);
  const out: Record<string, { level: boolean; volts: number }> = {};
  for (const io of spec.gpio) {
    const net = nl.netOf.get(`${b.partId}.${io.id}`);
    const connected = net !== undefined && nl.nets[net].pins.length > 1;
    const mode = b.modes[io.id] ?? "in";
    // A pin left floating reads whatever its pull resistor (or last value) gives it.
    const volts = connected ? v(io.id) - g : mode === "pullup" ? spec.vcc : 0;
    const was = prev[io.id] ?? false;
    const level = volts >= spec.vih ? true : volts <= spec.vil ? false : was;
    out[io.id] = { level, volts };
  }
  return out;
}

/** Servo angle (0..1 of 180°) from the pulse width the program sends, using the Arduino Servo library's range. */
export function servoLevel(pulse: number): number {
  return Math.max(0, Math.min(1, (pulse - 544e-6) / (2400e-6 - 544e-6)));
}

/** For each servo and buzzer, the MCU pin that drives its signal directly, if any. */
export function drivenBy(board: Board, nl: Netlist): Map<string, { partId: string; pin: string }> {
  const out = new Map<string, { partId: string; pin: string }>();
  const boards = board.parts.filter((p) => isMcu(p.type));
  for (const part of board.parts) {
    const sig = part.type === "servo" ? "SIG" : part.type === "buzzer" ? "+" : null;
    if (!sig) continue;
    const net = nl.netOf.get(`${part.id}.${sig}`);
    if (net === undefined) continue;
    for (const b of boards) {
      const io = BOARDS[b.type as McuBoard].gpio.find((g) => nl.netOf.get(`${b.id}.${g.id}`) === net);
      if (io) out.set(part.id, { partId: b.id, pin: io.id });
    }
  }
  return out;
}
