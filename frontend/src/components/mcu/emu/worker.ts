/// <reference lib="webworker" />
import { UnoMachine } from "./avr.ts";
import { Logic, NO_WIRING } from "../devices/logic.ts";
import type { Machine } from "./machine.ts";
import type { FromWorker, Program, ToWorker } from "./protocol.ts";

/**
 * Runs one microcontroller off the main thread. It executes in slices of emulated time matched to the wall clock,
 * so a 500 ms delay() in the sketch takes 500 ms on screen. If the computer can't keep up, emulated time slows
 * down but stays exact (the speed is reported), so timings measured in the lab stay true.
 */

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: FromWorker) => scope.postMessage(m);

let machine: Machine | null = null;
let logic: Logic | null = null;
let paused = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastWall = 0;
let lastCycles = 0;
const history: { wall: number; emu: number }[] = [];

/** Never run more than this much emulated time per tick, so a slow machine doesn't spiral. */
const MAX_SLICE = 0.05;
/** Wall-clock budget per tick, in ms. */
const BUDGET = 14;

async function create(program: Program, firmware?: ArrayBuffer): Promise<Machine> {
  if (program.board === "uno") return new UnoMachine(program.data);
  const { PicoMachine } = await import("./rp2040.ts");
  return PicoMachine.create(program, firmware);
}

function tick() {
  timer = null;
  const m = machine;
  if (!m || paused) return;
  const now = performance.now();
  const want = Math.min(MAX_SLICE, (now - lastWall) / 1000);
  lastWall = now;
  const target = m.cycles + Math.max(1, Math.round(want * m.hz));
  // Run in ~1 ms chunks and stop when the wall budget is spent.
  const chunk = Math.round(m.hz / 1000);
  try {
    while (m.cycles < target && performance.now() - now < BUDGET) m.run(Math.min(chunk, target - m.cycles));
  } catch (e) {
    post({ t: "error", message: e instanceof Error ? e.message : String(e) });
    machine = null;
    return;
  }
  const ran = m.cycles - lastCycles;
  lastCycles = m.cycles;
  history.push({ wall: now, emu: m.cycles / m.hz });
  while (history.length > 2 && now - history[0].wall > 1000) history.shift();
  const h0 = history[0];
  const speed = history.length > 1 && now > h0.wall ? (m.cycles / m.hz - h0.emu) / ((now - h0.wall) / 1000) : 1;
  post({ t: "frame", board: m.board, dt: ran / m.hz, time: m.cycles / m.hz, speed, modes: m.modes(), readings: m.meter.report(m.cycles), serial: m.drainSerial(), screens: logic?.screens() ?? {}, latched: logic?.latched() });
  timer = setTimeout(tick, 16);
}

function start() {
  if (timer) clearTimeout(timer);
  lastWall = performance.now();
  lastCycles = machine?.cycles ?? 0;
  history.length = 0;
  timer = setTimeout(tick, 0);
}

scope.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  switch (msg.t) {
    case "load":
      try {
        machine = null;
        machine = await create(msg.program, msg.firmware);
        // What the circuit presents before the first instruction runs.
        for (const [pin, v] of Object.entries(msg.pins ?? {})) machine.input(pin, v.level, v.volts);
        const l = new Logic(msg.wiring ?? NO_WIRING, machine.i2c);
        logic = l;
        if (l.active) machine.onPin = (pin, level) => l.pin(pin, level);
        paused = false;
        post({ t: "ready" });
        start();
      } catch (err) {
        post({ t: "error", message: err instanceof Error ? err.message : String(err) });
      }
      break;
    case "pause":
      paused = msg.paused;
      if (!paused) start();
      break;
    case "pins":
      if (machine) for (const [pin, v] of Object.entries(msg.pins)) machine.input(pin, v.level, v.volts);
      break;
    case "serial":
      machine?.serialIn(msg.bytes);
      break;
    case "stop":
      machine = null;
      if (timer) clearTimeout(timer);
      timer = null;
      break;
  }
};
