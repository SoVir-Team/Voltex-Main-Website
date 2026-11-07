import { buildNetlist, connected, type Netlist } from "./netlist.ts";
import { pinPositions } from "./parts.ts";
import { runDrc, type DrcIssue } from "./drc.ts";
import { sampleTransient, solveSteady, type SimInputs, type SimSnapshot } from "./solver.ts";
import type { Board, Part, PartType, PinRef, Pt } from "./types.ts";

export interface CheckItem {
  label: string;
  ok: boolean;
}

export interface MissionContext {
  board: Board;
  netlist: Netlist;
  drc: DrcIssue[];
  /** Pins on nets the student has measured with the multimeter. */
  probed: PinRef[];
  fabSent: boolean;
  steady: (inputs?: Partial<SimInputs>) => SimSnapshot | null;
  transient: (seconds: number, sample: (s: SimSnapshot) => number, inputs?: Partial<SimInputs>) => number[];
}

export interface Mission {
  id: string;
  title: string;
  /** One-line skill the student learns. */
  skill: string;
  brief: string;
  hints: string[];
  why: string;
  board: Board;
  /** The schematic: pins that must end up connected, one array per net. */
  nets: PinRef[][];
  /** Parts the student may add from the palette. */
  palette: PartType[];
  checks: (ctx: MissionContext) => CheckItem[];
  /** Line ids the mascot speaks at the start and on success. */
  intro: string;
  success: string;
}

export const part = (id: string, type: PartType, x: number, y: number, props: Part["props"] = {}, rot: Part["rot"] = 0): Part => ({ id, type, x, y, rot, props });

export const glows = (s: SimSnapshot | null, id: string) => Boolean(s && s.parts[id] && s.parts[id].glow > 0.15 && !s.parts[id].burnt);

/** Every schematic connection is routed and no two schematic nets are shorted together. */
export function routingChecks(ctx: MissionContext, nets: PinRef[][]): CheckItem[] {
  const routed = nets.every((n) => connected(ctx.netlist, n));
  const netIds = nets.map((n) => ctx.netlist.netOf.get(n[0]));
  const shorted = netIds.some((id, i) => id !== undefined && netIds.indexOf(id) !== i);
  return [
    { label: "Route every connection (follow the dashed lines)", ok: routed && !shorted },
    { label: "No accidental shorts between nets", ok: !shorted },
  ];
}

export const noErrors = (ctx: MissionContext) => !ctx.drc.some((d) => d.severity === "error");

export function blinkHz(samples: number[], dt: number): number {
  let edges = 0;
  for (let i = 1; i < samples.length; i++) if (samples[i] > 0.5 && samples[i - 1] <= 0.5) edges++;
  return edges / (samples.length * dt);
}

export const MISSIONS: Mission[] = [
  {
    id: "first-led",
    title: "Light your first LED",
    skill: "Ohm's law and current limiting",
    brief: "Route the battery, resistor and LED together, then power on. The resistor starts at 10 Ω. See what happens, then pick a value that keeps the LED at about 20 mA.",
    hints: ["Click a pad with the Trace tool, click again to bend, and finish on the other pad.", "R = (9 V − 1.9 V) ÷ 0.02 A ≈ 355 Ω. The nearest standard value is 330 Ω or 390 Ω."],
    why: "Every LED on every product you own has a resistor or a current driver next to it. Without one, the LED takes as much current as the battery can give and burns out in milliseconds.",
    board: { w: 26, h: 14, traces: [], vias: [], parts: [part("B1", "battery9v", 8, 5), part("R1", "resistor", 12, 4, { value: 10 }), part("D1", "led", 20, 8, { color: "red" }, 180)] },
    nets: [
      ["B1.+", "R1.1"],
      ["R1.2", "D1.A"],
      ["D1.K", "B1.-"],
    ],
    palette: ["resistor"],
    checks(ctx) {
      const s = ctx.steady();
      const i = s?.parts.D1?.current ?? 0;
      return [
        ...routingChecks(ctx, this.nets),
        { label: "The LED lights up", ok: glows(s, "D1") },
        { label: "LED current between 10 and 25 mA", ok: i > 0.01 && i < 0.025 },
      ];
    },
    intro: "m1-intro",
    success: "m1-success",
  },
  {
    id: "switch",
    title: "Add a power switch",
    skill: "Series circuits and switches",
    brief: "A switch in series breaks the loop. Route this circuit so the slide switch turns the green LED on and off.",
    hints: ["Current has to pass through the switch to reach the LED.", "During simulation, click the switch on the board to flip it."],
    why: "Breaking one point of a series loop stops current everywhere in it. That is how every power switch works.",
    board: { w: 28, h: 14, traces: [], vias: [], parts: [part("B1", "battery9v", 8, 5), part("SW1", "switch", 11, 3, { closed: true }), part("R1", "resistor", 16, 3, { value: 470 }), part("D1", "led", 22, 9, { color: "green" })] },
    nets: [
      ["B1.+", "SW1.1"],
      ["SW1.2", "R1.1"],
      ["R1.2", "D1.A"],
      ["D1.K", "B1.-"],
    ],
    palette: [],
    checks(ctx) {
      const flip = (closed: boolean): Board => ({ ...ctx.board, parts: ctx.board.parts.map((p) => (p.id === "SW1" ? { ...p, props: { ...p.props, closed } } : p)) });
      const on = solveSteady(flip(true), {}, 2, ctx.netlist);
      const off = solveSteady(flip(false), {}, 2, ctx.netlist);
      return [...routingChecks(ctx, this.nets), { label: "LED on when the switch is on", ok: glows(on, "D1") }, { label: "LED off when the switch is off", ok: !glows(off, "D1") && Boolean(off) }];
    },
    intro: "m2-intro",
    success: "m2-success",
  },
  {
    id: "divider",
    title: "Make 4.5 V from 9 V",
    skill: "Voltage dividers and measuring",
    brief: "Two equal resistors in series split the voltage in half. Route them, power on, and measure the middle with the multimeter probe.",
    hints: ["V out = V in × R2 ÷ (R1 + R2).", "Pick the Probe tool (P) and click the copper between the two resistors."],
    why: "Dividers are how a microcontroller reads a battery level or a sensor: they scale a voltage into a range the chip can measure.",
    board: { w: 24, h: 14, traces: [], vias: [], parts: [part("B1", "battery9v", 8, 5), part("R1", "resistor", 12, 3, { value: 10000 }), part("R2", "resistor", 12, 9, { value: 10000 })] },
    nets: [
      ["B1.+", "R1.1"],
      ["R1.2", "R2.1"],
      ["R2.2", "B1.-"],
    ],
    palette: [],
    checks(ctx) {
      const s = ctx.steady();
      const net = ctx.netlist.netOf.get("R1.2");
      const v = s && net !== undefined ? s.netV[net] : 0;
      const probed = ctx.probed.some((p) => ctx.netlist.netOf.get(p) === net);
      return [...routingChecks(ctx, this.nets), { label: "Middle point sits at 4.5 V (±0.3)", ok: Math.abs(v - 4.5) < 0.3 }, { label: "Measure it with the probe", ok: probed && Math.abs(v - 4.5) < 0.3 }];
    },
    intro: "m3-intro",
    success: "m3-success",
  },
  {
    id: "transistor",
    title: "A transistor switch",
    skill: "Using a small current to control a big one",
    brief: "The push button feeds a tiny current into the transistor's base. The transistor then lets the LED's current flow. Route it and press the button.",
    hints: ["The base resistor (R1) keeps the base current small and safe.", "Emitter goes to −, collector goes to the LED's cathode."],
    why: "Microcontroller pins can only give a few milliamps. Transistors let them switch motors, relays and bright lights.",
    board: {
      w: 30,
      h: 18,
      traces: [],
      vias: [],
      parts: [part("B1", "battery9v", 8, 6), part("R2", "resistor", 12, 3, { value: 470 }), part("D1", "led", 19, 3, { color: "yellow" }), part("SW1", "button", 11, 13), part("R1", "resistor", 17, 13, { value: 10000 }), part("Q1", "npn", 24, 10, {}, 90)],
    },
    nets: [
      ["B1.+", "R2.1", "SW1.1"],
      ["R2.2", "D1.A"],
      ["D1.K", "Q1.C"],
      ["SW1.2", "R1.1"],
      ["R1.2", "Q1.B"],
      ["Q1.E", "B1.-"],
    ],
    palette: [],
    checks(ctx) {
      const off = ctx.steady();
      const on = ctx.steady({ pressed: new Set(["SW1"]) });
      return [...routingChecks(ctx, this.nets), { label: "LED lights while the button is held", ok: glows(on, "D1") }, { label: "LED is dark when released", ok: Boolean(off) && !glows(off, "D1") }];
    },
    intro: "m4-intro",
    success: "m4-success",
  },
  {
    id: "night-light",
    title: "Automatic night light",
    skill: "Sensors and bias networks",
    brief: "The light sensor and R1 form a divider on the transistor's base. In the dark the LDR's resistance soars, the base voltage rises and the LED turns on.",
    hints: ["Drag the room-light slider to test day and night.", "The LDR goes from the base to −. R1 goes from + to the base."],
    why: "Street lights, phone screens and solar garden lamps all use this idea to react to light.",
    board: {
      w: 32,
      h: 18,
      traces: [],
      vias: [],
      parts: [part("B1", "battery9v", 8, 6), part("R1", "resistor", 12, 12, { value: 47000 }), part("R3", "ldr", 19, 15), part("Q1", "npn", 24, 10, {}, 90), part("R2", "resistor", 12, 3, { value: 470 }), part("D1", "led", 19, 3, { color: "white" })],
    },
    nets: [
      ["B1.+", "R1.1", "R2.1"],
      ["R1.2", "Q1.B", "R3.1"],
      ["R2.2", "D1.A"],
      ["D1.K", "Q1.C"],
      ["Q1.E", "R3.2", "B1.-"],
    ],
    palette: [],
    checks(ctx) {
      const night = ctx.steady({ ambient: 0.05 });
      const day = ctx.steady({ ambient: 0.95 });
      return [...routingChecks(ctx, this.nets), { label: "LED on in the dark", ok: glows(night, "D1") }, { label: "LED off in daylight", ok: Boolean(day) && !glows(day, "D1") }];
    },
    intro: "m5-intro",
    success: "m5-success",
  },
  {
    id: "two-layer",
    title: "Cross over with a via",
    skill: "Two-layer routing",
    brief: "Two LED branches share the battery. Some wires have to cross. Copper on the same layer cannot cross without shorting, so drop one wire to the bottom layer through a via.",
    hints: ["While routing, press V to drop a via and continue on the other layer.", "Or switch the layer with L before you start a trace."],
    why: "Nearly every real board has at least two copper layers. Vias are the tiny plated holes that connect them.",
    board: {
      w: 30,
      h: 16,
      traces: [],
      vias: [],
      parts: [part("B1", "battery9v", 8, 6), part("R1", "resistor", 12, 3, { value: 390 }), part("R2", "resistor", 12, 12, { value: 220 }), part("D1", "led", 21, 12, { color: "red" }), part("D2", "led", 21, 3, { color: "blue" })],
    },
    nets: [
      ["B1.+", "R1.1", "R2.1"],
      ["R1.2", "D1.A"],
      ["R2.2", "D2.A"],
      ["D1.K", "D2.K", "B1.-"],
    ],
    palette: [],
    checks(ctx) {
      const s = ctx.steady();
      return [
        ...routingChecks(ctx, this.nets),
        { label: "Both LEDs light", ok: glows(s, "D1") && glows(s, "D2") },
        { label: "Use the bottom layer and at least one via", ok: ctx.board.traces.some((t) => t.layer === "bottom") && ctx.board.vias.length > 0 },
        { label: "No design-rule errors", ok: noErrors(ctx) },
      ];
    },
    intro: "m6-intro",
    success: "m6-success",
  },
  {
    id: "blinker",
    title: "555 LED blinker",
    skill: "Timing with an RC circuit",
    brief: "The 555 charges C1 through R1 and R2, then empties it through R2, flipping its output each time. Route it and watch the LED blink about once a second.",
    hints: ["Blink rate f ≈ 1.44 ÷ ((R1 + 2 × R2) × C).", "Tie pin 4 (RESET) to VCC, or the chip stays off.", "Pins 2 and 6 join together, and to C1's +."],
    why: "The 555 has shipped in billions since 1972. Timing with a resistor and a capacitor is still how many circuits keep rhythm.",
    board: {
      w: 34,
      h: 20,
      traces: [],
      vias: [],
      parts: [
        part("B1", "battery9v", 8, 7),
        part("U1", "timer555", 16, 12),
        part("R1", "resistor", 12, 3, { value: 1000 }),
        part("R2", "resistor", 21, 3, { value: 68000 }),
        part("C1", "electrolytic", 24, 9, { value: 10e-6 }),
        part("R3", "resistor", 20, 16, { value: 470 }),
        part("D1", "led", 28, 16, { color: "red" }),
      ],
    },
    nets: [
      ["B1.+", "U1.8", "U1.4", "R1.1"],
      ["B1.-", "U1.1", "C1.-", "D1.K"],
      ["R1.2", "U1.7", "R2.1"],
      ["R2.2", "U1.6", "U1.2", "C1.+"],
      ["U1.3", "R3.1"],
      ["R3.2", "D1.A"],
    ],
    palette: [],
    checks(ctx) {
      const dt = 0.002;
      const hz = blinkHz(
        ctx.transient(5, (s) => (s.parts.D1?.glow ?? 0) > 0.15 ? 1 : 0),
        dt,
      );
      return [...routingChecks(ctx, this.nets), { label: "The LED blinks (0.5–3 Hz)", ok: hz >= 0.4 && hz <= 3 }];
    },
    intro: "m7-intro",
    success: "m7-success",
  },
  {
    id: "fab",
    title: "Ready for the factory",
    skill: "Design-rule checks and fabrication",
    brief: "Design anything you like that lights an LED or sounds the buzzer. Clear every design-rule error and warning, then send it to fab.",
    hints: ["The DRC panel lists every problem. Click one to jump to it.", "Keep traces at 45° or 90°, and at least 0.2 mm apart."],
    why: "Board houses run the same kind of checks before they make your board. A clean DRC is the difference between a board that works and an expensive coaster.",
    board: { w: 30, h: 20, traces: [], vias: [], parts: [] },
    nets: [],
    palette: ["battery9v", "coincell", "resistor", "led", "button", "switch", "pot", "ldr", "npn", "ceramic", "electrolytic", "diode", "buzzer", "timer555"],
    checks(ctx) {
      const s = ctx.steady({ ambient: 0.6 });
      const alive = Boolean(s && Object.entries(s.parts).some(([id, st]) => (id.startsWith("D") && st.glow > 0.15) || (id.startsWith("BZ") && st.on)));
      return [
        { label: "Something lights up or beeps", ok: alive },
        { label: "No design-rule errors", ok: noErrors(ctx) && ctx.board.parts.length > 0 },
        { label: "No design-rule warnings", ok: ctx.drc.length === 0 && ctx.board.parts.length > 0 },
        { label: "Send it to fab", ok: ctx.fabSent },
      ];
    },
    intro: "m8-intro",
    success: "m8-success",
  },
];

/** `burnt` lists parts burnt on the live board: checks see them burnt until the student replaces them. */
export function makeContext(board: Board, opts: { netlist?: Netlist; probed?: PinRef[]; fabSent?: boolean; burnt?: ReadonlySet<string> } = {}): MissionContext {
  const netlist = opts.netlist ?? buildNetlist(board);
  const steadyCache = new Map<string, SimSnapshot | null>();
  const steady = (inputs: Partial<SimInputs> = {}) => {
    const key = JSON.stringify([inputs.ambient ?? 0.6, [...(inputs.pressed ?? [])]]);
    if (!steadyCache.has(key)) steadyCache.set(key, solveSteady(board, inputs, 2, netlist, opts.burnt));
    return steadyCache.get(key)!;
  };
  return {
    board,
    netlist,
    drc: runDrc(board, netlist, steady()),
    probed: opts.probed ?? [],
    fabSent: opts.fabSent ?? false,
    steady,
    transient: (seconds, sample, inputs) => sampleTransient(board, seconds, 0.002, sample, inputs, netlist, opts.burnt),
  };
}

/** A netlist where the schematic is wired perfectly, for testing missions without routing them. */
export function idealNetlist(board: Board, nets: PinRef[][]): Netlist {
  const netOf = new Map<PinRef, number>();
  const all = board.parts.flatMap((p) => pinPositions(p).map((pin) => `${p.id}.${pin.id}`));
  const groups: PinRef[][] = nets.map((n) => [...n]);
  for (const p of all) if (!nets.some((n) => n.includes(p))) groups.push([p]);
  groups.forEach((g, i) => g.forEach((p) => netOf.set(p, i)));
  return { nets: groups.map((pins, index) => ({ index, pins, items: [] })), netOf, copper: [], itemNet: new Map() };
}

/** Dashed guide lines for schematic connections that are not routed yet, in grid units. */
export function ratsnest(board: Board, nl: Netlist, nets: PinRef[][]): [Pt, Pt][] {
  const pos = new Map<PinRef, Pt>();
  for (const p of board.parts) for (const pin of pinPositions(p)) pos.set(`${p.id}.${pin.id}`, pin);
  const lines: [Pt, Pt][] = [];
  for (const net of nets) {
    for (let i = 1; i < net.length; i++) {
      const pi = net[i];
      const prev = net.slice(0, i);
      if (prev.some((q) => connected(nl, [q, pi]))) continue;
      const a = pos.get(pi);
      if (!a) continue;
      let best: Pt | null = null;
      let bestD = Infinity;
      for (const q of prev) {
        const b = pos.get(q);
        if (!b) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
      if (best) lines.push([a, best]);
    }
  }
  return lines;
}
