"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildNetlist, type Netlist } from "../engine/netlist.ts";
import { Simulator, hasSupply, type SimEvent, type SimSnapshot } from "../engine/solver.ts";
import type { Board } from "../engine/types.ts";

/**
 * Runs the circuit in real time while the board is powered. The simulator is rebuilt on every edit; burnt parts,
 * capacitor charge and 555 state carry over, except for parts whose properties changed (a new value is a new part).
 */
export function useSimulation(board: Board, powered: boolean, ambient: number, pressed: ReadonlySet<string>, onEvents: (e: SimEvent[]) => void) {
  const netlist: Netlist = useMemo(() => buildNetlist(board), [board]);
  const simRef = useRef<Simulator | null>(null);
  const prevBoard = useRef<Board | null>(null);
  const [frameSnapshot, setSnapshot] = useState<{ board: Board; snapshot: SimSnapshot } | null>(null);
  const inputs = useRef({ ambient, pressed });
  const onEventsRef = useRef(onEvents);

  useEffect(() => {
    inputs.current = { ambient, pressed };
    onEventsRef.current = onEvents;
  });

  useEffect(() => {
    const old = simRef.current;
    const sim = new Simulator(board, old?.carry(), netlist);
    const before = prevBoard.current;
    if (before) {
      for (const p of board.parts) {
        const was = before.parts.find((q) => q.id === p.id);
        if (!was || was.type !== p.type || JSON.stringify({ ...was.props, closed: 0, pos: 0 }) !== JSON.stringify({ ...p.props, closed: 0, pos: 0 })) sim.repair(p.id);
      }
    }
    prevBoard.current = board;
    simRef.current = sim;
  }, [board, netlist]);

  useEffect(() => {
    if (!powered) {
      // Power off: capacitors drain and the 555 resets, but burnt parts stay burnt.
      const sim = simRef.current;
      if (sim) simRef.current = new Simulator(sim.board, { burnt: new Set([...sim.board.parts.filter((p) => sim.isBurnt(p.id)).map((p) => p.id)]) }, sim.netlist);
      return;
    }
    let raf = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const sim = simRef.current;
      const real = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (sim) {
        if (sim.dynamic) {
          const steps = Math.max(1, Math.round(real / 0.001));
          for (let i = 0; i < steps; i++) sim.step(real / steps, inputs.current);
        } else sim.step(Math.max(real, 0.016), inputs.current);
        const events = sim.drainEvents();
        if (events.length) onEventsRef.current(events);
        if (frame++ % 2 === 0) setSnapshot({ board: sim.board, snapshot: sim.snapshot(inputs.current) });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [powered]);

  const repair = (id: string) => simRef.current?.repair(id);
  const burntIds = useCallback(() => simRef.current?.burntIds() ?? [], []);
  const hasPower = hasSupply(board);
  return { snap: powered && frameSnapshot?.board === board ? frameSnapshot.snapshot : null, netlist, repair, hasPower, burntIds };
}
