"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BOARDS, isMcu, type McuBoard } from "../../lab/engine/mcu-boards.ts";
import type { Netlist } from "../../lab/engine/netlist.ts";
import { Simulator, type Screen, type SimEvent, type SimSnapshot } from "../../lab/engine/solver.ts";
import type { Board } from "../../lab/engine/types.ts";
import { drivenBy, readPins, servoLevel, stepCircuit, type BoardActivity } from "../bridge.ts";
import type { Frame, FromWorker, Program, ToWorker } from "../emu/protocol.ts";
import { wiringFor } from "../wiring.ts";

export type RunStatus = "idle" | "loading" | "running" | "paused" | "error";

/** Longest piece of emulated time solved in one go, so capacitors and filters stay accurate. */
const MAX_STEP = 0.004;
const SERIAL_MAX = 60_000;

/**
 * Runs the program on the first microcontroller on the board. The chip runs in a worker; every frame its pin
 * activity drives the circuit solver here, and what the circuit puts on the input pins goes back to the chip.
 */
export function useMcuRun(board: Board, netlist: Netlist, ambient: number, pressed: ReadonlySet<string>, onEvents: (e: SimEvent[]) => void) {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const [serial, setSerial] = useState("");
  const [clock, setClock] = useState({ time: 0, speed: 1 });
  const [activity, setActivity] = useState<BoardActivity | null>(null);

  const worker = useRef<Worker | null>(null);
  const sim = useRef<Simulator | null>(null);
  const live = useRef({ board, netlist, ambient, pressed, onEvents });
  const lastPins = useRef<Record<string, { level: boolean; volts: number }>>({});
  const audio = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null);
  /** The last second of frames, so the pin table can show duty and frequency of slow signals too. */
  const screens = useRef(new Map<string, Screen>());
  const latched = useRef(new Map<string, number>());
  const recent = useRef<{ dt: number; readings: Frame["readings"] }[]>([]);

  useEffect(() => {
    live.current = { board, netlist, ambient, pressed, onEvents };
  });

  // A new circuit is a new simulator; what has burnt stays burnt.
  useEffect(() => {
    sim.current = new Simulator(board, sim.current?.carry(), netlist);
  }, [board, netlist]);

  const mcuPart = board.parts.find((p) => isMcu(p.type));

  const tone = useCallback((hz: number) => {
    const a = audio.current;
    if (!a) return;
    const now = a.ctx.currentTime;
    if (hz > 20 && hz < 20000) {
      a.osc.frequency.setTargetAtTime(hz, now, 0.005);
      a.gain.gain.setTargetAtTime(0.04, now, 0.01);
    } else a.gain.gain.setTargetAtTime(0, now, 0.01);
  }, []);

  const onFrame = useCallback(
    (f: Frame) => {
      const s = sim.current;
      const { board: b, netlist: nl, ambient: amb, pressed: pr } = live.current;
      const part = b.parts.find((p) => p.type === f.board);
      if (!s || !part) return;
      const act: BoardActivity = { partId: part.id, board: f.board, modes: f.modes, readings: f.readings };
      for (const [id, sc] of Object.entries(f.screens)) screens.current.set(id, sc);
      if (f.latched) latched.current = new Map(Object.entries(f.latched));
      const inputs = { ambient: amb, pressed: pr, latched: latched.current };
      let shot: SimSnapshot | null = null;
      let left = f.dt;
      while (left > 1e-9) {
        const dt = Math.min(MAX_STEP, left);
        shot = stepCircuit(s, dt, inputs, [act]);
        left -= dt;
      }
      if (!shot) return;
      // Displays show what the program drew, while they have power.
      for (const [id, sc] of screens.current) if (shot.parts[id]?.on) shot.parts[id].screen = sc;
      // Servos read the pulse width, buzzers sound at the pin's frequency.
      let hz = 0;
      for (const [id, src] of drivenBy(b, nl)) {
        if (src.partId !== part.id) continue;
        const r = f.readings[src.pin];
        const st = shot.parts[id];
        const target = b.parts.find((p) => p.id === id);
        if (!r || !st || !target) continue;
        if (target.type === "servo" && r.freq > 20 && r.freq < 400) st.level = servoLevel(r.pulse);
        if (target.type === "buzzer" && r.duty > 0.05 && r.duty < 0.95 && st.on) hz = r.freq;
      }
      tone(hz);
      const events = s.drainEvents();
      if (events.length) live.current.onEvents(events);
      // Feed the input pins back, only what changed.
      const pins = readPins(b, nl, shot, act, Object.fromEntries(Object.entries(lastPins.current).map(([k, v]) => [k, v.level])));
      const changed: typeof pins = {};
      for (const [k, v] of Object.entries(pins)) {
        const was = lastPins.current[k];
        if (!was || was.level !== v.level || Math.abs(was.volts - v.volts) > 0.002) changed[k] = v;
      }
      if (Object.keys(changed).length) {
        lastPins.current = { ...lastPins.current, ...changed };
        worker.current?.postMessage({ t: "pins", pins: changed } satisfies ToWorker);
      }
      if (f.serial.length) {
        const text = new TextDecoder().decode(new Uint8Array(f.serial));
        setSerial((old) => (old + text).slice(-SERIAL_MAX));
      }
      setSnap(shot);
      const ring = recent.current;
      ring.push({ dt: f.dt, readings: f.readings });
      let span = ring.reduce((n, r) => n + r.dt, 0);
      while (ring.length > 1 && span - ring[0].dt >= 1) span -= ring.shift()!.dt;
      const avg: BoardActivity["readings"] = {};
      for (const pin of Object.keys(f.readings)) {
        let duty = 0;
        let rises = 0;
        for (const r of ring) {
          const x = r.readings[pin];
          if (!x) continue;
          duty += x.duty * r.dt;
          rises += x.freq * r.dt;
        }
        const now = f.readings[pin];
        avg[pin] = { ...now, duty: span > 0 ? duty / span : now.duty, freq: span > 0 ? Math.round((rises / span) * 100) / 100 : now.freq };
      }
      setActivity({ ...act, readings: avg });
      setClock({ time: f.time, speed: f.speed });
    },
    [tone],
  );

  const kill = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    tone(0);
  }, [tone]);

  useEffect(() => () => {
    kill();
    void audio.current?.ctx.close();
  }, [kill]);

  const run = useCallback(
    async (program: Program) => {
      kill();
      setError(null);
      setStatus("loading");
      setSnap(null);
      lastPins.current = {};
      // Start from a cold circuit: capacitors empty, nothing latched.
      const { board: b, netlist: nl } = live.current;
      sim.current = new Simulator(b, { burnt: new Set(b.parts.filter((p) => sim.current?.isBurnt(p.id)).map((p) => p.id)) }, nl);
      recent.current = [];
      screens.current = new Map();
      latched.current = new Map();
      if (!audio.current) {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          gain.gain.value = 0;
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          audio.current = { ctx, osc, gain };
        } catch {
          /* no audio: the lab still runs */
        }
      }
      void audio.current?.ctx.resume();
      let firmware: ArrayBuffer | undefined;
      if (program.kind === "python") {
        const res = await fetch("/mcu/micropython-pico.uf2");
        if (!res.ok) {
          setStatus("error");
          setError("Couldn't load the MicroPython firmware.");
          return;
        }
        firmware = await res.arrayBuffer();
      }
      // The circuit as the chip sees it at power-up (every pin an input), so the first reading is right.
      let pins: Record<string, { level: boolean; volts: number }> | undefined;
      const mcuPart0 = b.parts.find((p) => p.type === program.board);
      const wiring = mcuPart0 ? wiringFor(b, nl, mcuPart0) : undefined;
      const part = b.parts.find((p) => p.type === program.board);
      if (part && sim.current) {
        const act0: BoardActivity = { partId: part.id, board: program.board, modes: {}, readings: {} };
        pins = readPins(b, nl, stepCircuit(sim.current, 0.001, { ambient: live.current.ambient, pressed: live.current.pressed }, [act0]), act0, {});
        lastPins.current = pins;
      }
      const w = new Worker(new URL("../emu/worker.ts", import.meta.url), { type: "module" });
      worker.current = w;
      w.onmessage = (e: MessageEvent<FromWorker>) => {
        if (worker.current !== w) return;
        const m = e.data;
        if (m.t === "frame") onFrame(m);
        else if (m.t === "ready") setStatus("running");
        else if (m.t === "error") {
          setStatus("error");
          setError(m.message);
          kill();
        }
      };
      w.onerror = (e) => {
        setStatus("error");
        setError(e.message || "The emulator stopped.");
        kill();
      };
      w.postMessage({ t: "load", program, firmware, pins, wiring } satisfies ToWorker, firmware ? [firmware] : []);
    },
    [kill, onFrame],
  );

  const stop = useCallback(() => {
    kill();
    setStatus("idle");
    setSnap(null);
    setActivity(null);
  }, [kill]);

  const pause = useCallback((paused: boolean) => {
    if (!worker.current) return;
    worker.current.postMessage({ t: "pause", paused } satisfies ToWorker);
    setStatus(paused ? "paused" : "running");
    if (paused) tone(0);
  }, [tone]);

  const send = useCallback((text: string) => {
    worker.current?.postMessage({ t: "serial", bytes: [...new TextEncoder().encode(text)] } satisfies ToWorker);
  }, []);

  const clearSerial = useCallback(() => setSerial(""), []);
  const repair = (id: string) => sim.current?.repair(id);
  const burntIds = useCallback(() => sim.current?.burntIds() ?? [], []);

  return {
    status,
    error,
    snap: status === "running" || status === "paused" ? snap : null,
    serial,
    clock,
    activity,
    board: (mcuPart?.type as McuBoard | undefined) ?? null,
    spec: mcuPart ? BOARDS[mcuPart.type as McuBoard] : null,
    run,
    stop,
    pause,
    send,
    clearSerial,
    repair,
    burntIds,
  };
}
