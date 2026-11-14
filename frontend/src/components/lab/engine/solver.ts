import { LED_BURN_A } from "./parts.ts";
import { buildNetlist, type Netlist } from "./netlist.ts";
import { propertyValue as parameter } from "./properties.ts";
import type { Board, Part } from "./types.ts";
import { BOARDS, isMcu, usbRail, type McuDrives } from "./mcu-boards.ts";

/**
 * Circuit simulation by modified nodal analysis. Every element stamps conductances and current sources into
 * G·v = i. Diodes, LEDs, transistors and MOSFETs are nonlinear and solved by Newton–Raphson with SPICE-style
 * junction limiting. Capacitors and inductors use backward-Euler companion models; the 555, relay and shift
 * register are behavioural latches. Voltage sources are Norton sources (voltage behind a small internal
 * resistance), so no extra branch rows are needed.
 */

const VT = 0.02585;
const GMIN = 1e-9;
const OPEN = 1e-9;
const CLOSED = 1 / 0.05;
/** Oscilloscope sample spacing and window length. */
const SCOPE_DT = 0.002;
const SCOPE_N = 250;

export interface SimInputs {
  /** Room light for LDRs, 0 dark .. 1 bright. */
  ambient: number;
  /** Buttons currently held down. */
  pressed: ReadonlySet<string>;
  /** How each running microcontroller has set its pins. */
  mcu?: McuDrives;
  /**
   * Output bytes of shift registers and I/O expanders driven by a running program, measured at the chip's own
   * clock edges (too fast for the circuit's time step to see).
   */
  latched?: ReadonlyMap<string, number>;
}

export interface PartState {
  /** Main current through the part in amps (positive in its normal direction). */
  current: number;
  power: number;
  /** Current flowing into the part at each pin, amps. */
  pinCurrents: Record<string, number>;
  /** 0..1 light output for LEDs. */
  glow: number;
  on: boolean;
  burnt: boolean;
  reversed: boolean;
  /** 0..1 how close to its limit; above 1 it is being damaged. */
  stress: number;
  /** What a meter shows: volts, amps or ohms. */
  reading?: number;
  /** Oscilloscope channels A and B, oldest sample first. */
  wave?: [number[], number[]];
  /** Per-segment glow for a 7-segment display, or output bits for a shift register. */
  segs?: number[];
  /** 0..1: motor speed, servo angle (0..180°) or LCD backlight. */
  level?: number;
  /** 0..1 rotation of a motor shaft, for drawing. */
  phase?: number;
  /** What a display driven by a running program shows. */
  screen?: Screen;
}

/** Contents of a display, as decoded from the bytes the program sent it. */
export type Screen =
  | { kind: "oled"; on: boolean; invert: boolean; w: number; h: number; /** Page-ordered framebuffer, as in SSD1306 GDDRAM. */ fb: Uint8Array }
  | { kind: "lcd"; on: boolean; /** Character codes, 16 per row. */ rows: number[][]; cursor: { row: number; col: number; show: boolean; blink: boolean } | null; /** Custom characters 0–7, 8 rows of 5 bits each. */ cgram: number[] };

export type SimEvent =
  | { type: "burnt"; partId: string; partType: Part["type"] }
  | { type: "short"; partId: string }
  | { type: "reversed"; partId: string; partType: Part["type"] }
  | { type: "overcurrent"; partId: string; partType: Part["type"] }
  | { type: "reset-floating"; partId: string };

export interface SimSnapshot {
  time: number;
  groundNet: number;
  /** Voltage of each net relative to ground (a ground symbol, or the first supply's negative terminal). */
  netV: number[];
  parts: Record<string, PartState>;
}

interface DiodeModel {
  is: number;
  n: number;
}

const LED_N = 2;
function ledModel(input: Part | Part["props"]["color"]): DiodeModel {
  const part: Part = typeof input === "object" ? input : { id: "", type: "led", x: 0, y: 0, rot: 0, props: { color: input } };
  return { n: LED_N, is: parameter(part, "ratedCurrent") / Math.expm1(parameter(part, "forwardVoltage") / (LED_N * VT)) };
}
const DIODE: DiodeModel = { is: 2.5e-9, n: 1.75 };
/** About 0.3 V at 20 mA. */
const SCHOTTKY: DiodeModel = { n: 1.05, is: 0.02 / Math.expm1(0.3 / (1.05 * VT)) };
/** Reverse breakdown junction of a Zener: sharp, so the voltage barely moves with current. */
const ZENER: DiodeModel = { is: 1e-12, n: 1 };
const zenerOffset = (vz: number) => vz - ZENER.n * VT * Math.log(5e-3 / ZENER.is);
const OPTO_LED: DiodeModel = { n: LED_N, is: 0.02 / Math.expm1(1.2 / (LED_N * VT)) };
const OPTO_CTR = 1;

const BJT: Record<string, { is: number; bf: number; br: number; imax: number; pmax: number }> = {
  "2N2222": { is: 1e-14, bf: 150, br: 2, imax: 0.8, pmax: 0.625 },
  BC547: { is: 1e-14, bf: 300, br: 2, imax: 0.1, pmax: 0.5 },
  BC557: { is: 1e-14, bf: 250, br: 2, imax: 0.1, pmax: 0.5 },
  "2N2907": { is: 1e-14, bf: 150, br: 2, imax: 0.6, pmax: 0.625 },
};
function transistorModel(part: Part) {
  const base = BJT[part.props.variant ?? (part.type === "npn" ? "2N2222" : "BC557")] ?? BJT["2N2222"];
  return { ...base, bf: part.props.gain ?? base.bf, imax: part.props.ratedCurrent !== undefined ? part.props.ratedCurrent * 4 / 3 : base.imax };
}
const MOS: Record<string, { vth: number; k: number; imax: number; pmax: number }> = {
  IRF540: { vth: 3, k: 2, imax: 28, pmax: 2 },
  AO3400: { vth: 1, k: 4, imax: 5.7, pmax: 1.4 },
  IRF9540: { vth: 3, k: 1, imax: 19, pmax: 2 },
  AO3401: { vth: 1, k: 3, imax: 4, pmax: 1.4 },
};

/** A voltage source between pins `p` (+) and `n` (−): voltage behind an internal resistance. */
export interface Source {
  p: string;
  n: string;
  rint: number;
  /** Above this current the source is treated as shorted. */
  imax: number;
  v: (t: number) => number;
}

export function sourceOf(part: Part): Source | null {
  const V = part.props.value;
  if (isMcu(part.type)) {
    // A board is powered from the computer's USB port, which a polyfuse limits to 500 mA.
    const spec = BOARDS[part.type];
    const usb = usbRail(spec);
    return { p: spec.usbPin, n: spec.gnd, rint: usb.rint, imax: 0.5, v: () => usb.v };
  }
  switch (part.type) {
    case "battery9v": {
      const { v, rint } = batteryOf(part.type, part.props)!;
      return { p: "+", n: "-", rint, imax: (0.6 * v) / rint, v: () => v };
    }
    case "coincell": {
      const { v, rint } = batteryOf(part.type, part.props)!;
      return { p: "+", n: "-", rint, imax: (0.6 * v) / rint, v: () => v };
    }
    case "dcsource": {
      const v = V ?? 5;
      return { p: "+", n: "-", rint: 0.01, imax: 10, v: () => v };
    }
    case "usb":
      return { p: "VBUS", n: "GND", rint: 0.05, imax: 2, v: () => 5 };
    case "acsource": {
      const a = V ?? 5;
      const f = part.props.freq ?? 50;
      return { p: "+", n: "-", rint: 0.01, imax: 10, v: (t) => a * Math.sin(2 * Math.PI * f * t) };
    }
    case "pulsegen": {
      const a = V ?? 5;
      const f = part.props.freq ?? 1;
      const d = (part.props.duty ?? 50) / 100;
      return { p: "+", n: "-", rint: 0.01, imax: 10, v: (t) => ((((t * f) % 1) + 1) % 1 < d ? a : 0) };
    }
  }
  return null;
}

/** Parts that can power a circuit. */
export const isSupply = (p: Part) => sourceOf(p) !== null || p.type === "vcc" || p.type === "isource";

/** The pin that defines 0 V: a ground symbol, else the first voltage source's negative terminal. */
function referencePin(board: Board): string | null {
  const gnd = board.parts.find((p) => p.type === "gnd");
  if (gnd) return `${gnd.id}.1`;
  const src = [...board.parts].filter((p) => sourceOf(p)).sort((a, b) => a.id.localeCompare(b.id))[0];
  return src ? `${src.id}.${sourceOf(src)!.n}` : null;
}

/** True when the board has something to power it and a 0 V reference to measure from. */
export function hasSupply(board: Board): boolean {
  return board.parts.some(isSupply) && referencePin(board) !== null;
}

function diodeModel(part: Part): DiodeModel {
  return { n: 1.75, is: parameter(part, "ratedCurrent") / Math.expm1(parameter(part, "forwardVoltage") / (1.75 * VT)) };
}
function contactConductance(part: Part, pressed: ReadonlySet<string>): number {
  const closed = part.type === "button" ? Boolean(part.props.normallyClosed) !== pressed.has(part.id) : Boolean(part.props.closed);
  return closed ? 1 / parameter(part, "contactResistance") : OPEN;
}

export function batteryOf(type: Part["type"], props: Part["props"] = {}): { v: number; rint: number } | null {
  if (type === "battery9v" || type === "coincell") return { v: parameter({ type, props }, "voltage"), rint: parameter({ type, props }, "internalResistance") };
  return null;
}

export function ldrOhms(ambient: number, part?: Part): number {
  const bright = part ? parameter(part, "brightResistance") : 1000;
  const dark = part ? parameter(part, "darkResistance") : 1e6;
  return dark * (bright / dark) ** Math.max(0, Math.min(1, ambient));
}

function pnjlim(vnew: number, vold: number, vt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      return arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    }
    return vt * Math.log(vnew / vt);
  }
  return vnew;
}

/** Square-law MOSFET drain current (n-channel sense) with its two small-signal conductances. */
function mosI(vgs: number, vds: number, m: { vth: number; k: number }) {
  const vov = vgs - m.vth;
  if (vov <= 0) return { id: 0, gm: 0, gds: 0 };
  if (vds < vov) return { id: m.k * (2 * vov * vds - vds * vds), gm: 2 * m.k * vds, gds: 2 * m.k * (vov - vds) };
  const lam = 0.01;
  return { id: m.k * vov * vov * (1 + lam * vds), gm: 2 * m.k * vov * (1 + lam * vds), gds: m.k * vov * vov * lam };
}

/** Solve A·x = b in place by Gaussian elimination with partial pivoting. */
function solveLinear(A: Float64Array[], b: Float64Array): Float64Array {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (p !== c) {
      [A[p], A[c]] = [A[c], A[p]];
      [b[p], b[c]] = [b[c], b[p]];
    }
    const piv = A[c][c] || 1e-18;
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / piv;
      if (f === 0) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / (A[r][r] || 1e-18);
  }
  return x;
}

type Term = { p: number; n: number; g: number; v0: number };
const neg = (ts: Term[]) => ts.map((t) => ({ ...t, g: -t.g }));

class Stamper {
  G: Float64Array[];
  i: Float64Array;
  constructor(n: number) {
    this.G = Array.from({ length: n }, () => new Float64Array(n));
    this.i = new Float64Array(n);
  }
  /** Conductance g between nodes a and b (-1 is ground). */
  g(a: number, b: number, g: number) {
    if (a >= 0) this.G[a][a] += g;
    if (b >= 0) this.G[b][b] += g;
    if (a >= 0 && b >= 0) {
      this.G[a][b] -= g;
      this.G[b][a] -= g;
    }
  }
  /** Current source pushing current I out of node a and into node b. */
  src(a: number, b: number, I: number) {
    if (a >= 0) this.i[a] -= I;
    if (b >= 0) this.i[b] += I;
  }
  /** Voltage-controlled current gm·(v(c) − v(d)) flowing from node a to node b through the element. */
  vccs(a: number, b: number, c: number, d: number, gm: number) {
    const add = (r: number, col: number, v: number) => {
      if (r >= 0 && col >= 0) this.G[r][col] += v;
    };
    add(a, c, gm);
    add(a, d, -gm);
    add(b, c, -gm);
    add(b, d, gm);
  }
  /**
   * Linearised nonlinear terminal current: I(v) ≈ I0 + Σ g·(vj − vj0), flowing from node `row` into the device,
   * where vj = v(p) − v(n) for each controlling junction.
   */
  nl(row: number, I0: number, terms: Term[]) {
    if (row < 0) return;
    let rhs = -I0;
    for (const t of terms) {
      if (t.p >= 0) this.G[row][t.p] += t.g;
      if (t.n >= 0) this.G[row][t.n] -= t.g;
      rhs += t.g * t.v0;
    }
    this.i[row] += rhs;
  }
}

interface Damage {
  over: number;
}

const SEGMENTS = ["a", "b", "c", "d", "e", "f", "g", "dp"];

export class Simulator {
  readonly board: Board;
  readonly netlist: Netlist;
  readonly ground: number;
  private readonly supplied: boolean;
  /** Net index to matrix row, -1 for ground. */
  private row: number[];
  private n: number;
  private v: Float64Array;
  readonly dynamic: boolean;
  time = 0;
  private capV = new Map<string, number>();
  private latch = new Map<string, boolean>();
  /** Other state carried between steps: inductor currents, shift registers, servo pulses, scope buffers. */
  private mem = new Map<string, number[]>();
  private junction = new Map<string, number>();
  private damage = new Map<string, Damage>();
  private burnt: Set<string>;
  private shorted = new Set<string>();
  private reversedSeen = new Set<string>();
  private resetWarned = new Set<string>();
  events: SimEvent[] = [];

  constructor(board: Board, carry?: { burnt?: Set<string>; capV?: Map<string, number>; latch?: Map<string, boolean>; mem?: Map<string, number[]> }, netlist?: Netlist) {
    this.board = board;
    this.netlist = netlist ?? buildNetlist(board);
    this.burnt = new Set(carry?.burnt ?? []);
    if (carry?.capV) this.capV = new Map(carry.capV);
    if (carry?.latch) this.latch = new Map(carry.latch);
    if (carry?.mem) this.mem = new Map([...carry.mem].map(([k, v]) => [k, [...v]]));
    const ref = referencePin(board);
    this.ground = ref ? (this.netlist.netOf.get(ref) ?? -1) : -1;
    this.supplied = board.parts.some(isSupply);
    this.row = [];
    let k = 0;
    for (let i = 0; i < this.netlist.nets.length; i++) this.row.push(i === this.ground ? -1 : k++);
    this.n = k;
    this.v = new Float64Array(k);
    this.dynamic = board.parts.some((p) => ["ceramic", "electrolytic", "timer555", "inductor", "transformer", "acsource", "pulsegen"].includes(p.type));
  }

  get powered(): boolean {
    return this.ground >= 0 && this.supplied;
  }

  /** State that should survive rebuilding the simulator after an edit. */
  carry() {
    return { burnt: this.burnt, capV: this.capV, latch: this.latch, mem: this.mem };
  }

  private node(part: Part, pin: string): number {
    const net = this.netlist.netOf.get(`${part.id}.${pin}`);
    return net === undefined ? -1 : this.row[net];
  }

  private V(v: Float64Array, node: number): number {
    return node < 0 ? 0 : v[node];
  }

  private diode(s: Stamper, v: Float64Array, key: string, a: number, k: number, m: DiodeModel, offset = 0) {
    const nvt = m.n * VT;
    const vcrit = nvt * Math.log(nvt / (Math.SQRT2 * m.is));
    const raw = this.V(v, a) - this.V(v, k) - offset;
    const old = this.junction.get(key) ?? 0;
    const vd = pnjlim(raw, old, nvt, vcrit);
    this.junction.set(key, vd);
    const e = Math.exp(Math.min(vd / nvt, 80));
    const I = m.is * (e - 1);
    const g = (m.is / nvt) * e + GMIN;
    s.nl(a, I, [{ p: a, n: k, g, v0: vd + offset }]);
    s.nl(k, -I, [{ p: a, n: k, g: -g, v0: vd + offset }]);
    return Math.abs(vd - raw) < 1e-9;
  }

  /** Ebers–Moll transistor. `sg` is +1 for NPN and −1 for PNP (every junction and current mirrored). */
  private bjt(s: Stamper, v: Float64Array, key: string, c: number, b: number, e: number, sg: 1 | -1, m: (typeof BJT)[string]) {
    const vcrit = VT * Math.log(VT / (Math.SQRT2 * m.is));
    const rbe = sg * (this.V(v, b) - this.V(v, e));
    const rbc = sg * (this.V(v, b) - this.V(v, c));
    const vbe = pnjlim(rbe, this.junction.get(key + ":be") ?? 0, VT, vcrit);
    const vbc = pnjlim(rbc, this.junction.get(key + ":bc") ?? 0, VT, vcrit);
    this.junction.set(key + ":be", vbe);
    this.junction.set(key + ":bc", vbc);
    const ef = Math.exp(Math.min(vbe / VT, 80));
    const er = Math.exp(Math.min(vbc / VT, 80));
    const iF = m.is * (ef - 1);
    const iR = m.is * (er - 1);
    const gF = (m.is / VT) * ef + GMIN;
    const gR = (m.is / VT) * er + GMIN;
    const Ic = iF - iR - iR / m.br;
    const Ib = iF / m.bf + iR / m.br;
    const be = sg === 1 ? { p: b, n: e, v0: vbe } : { p: e, n: b, v0: vbe };
    const bc = sg === 1 ? { p: b, n: c, v0: vbc } : { p: c, n: b, v0: vbc };
    const dIc = [{ ...be, g: sg * gF }, { ...bc, g: -sg * gR * (1 + 1 / m.br) }];
    const dIb = [{ ...be, g: (sg * gF) / m.bf }, { ...bc, g: (sg * gR) / m.br }];
    s.nl(c, sg * Ic, dIc);
    s.nl(b, sg * Ib, dIb);
    s.nl(e, -sg * (Ic + Ib), neg([...dIc, ...dIb]));
    return Math.abs(vbe - rbe) < 1e-9 && Math.abs(vbc - rbc) < 1e-9;
  }

  /** Square-law MOSFET, symmetric in drain and source. `pol` is +1 for N-channel and −1 for P-channel. */
  private mos(s: Stamper, v: Float64Array, key: string, D: number, G: number, S: number, pol: 1 | -1, m: (typeof MOS)[string]) {
    const swapped = pol * (this.V(v, D) - this.V(v, S)) < 0;
    const d = swapped ? S : D;
    const src = swapped ? D : S;
    const vgsRaw = pol * (this.V(v, G) - this.V(v, src));
    const vds = pol * (this.V(v, d) - this.V(v, src));
    const old = this.junction.get(key) ?? 0;
    const vgs = Math.abs(vgsRaw - old) > 1 ? old + Math.sign(vgsRaw - old) : vgsRaw;
    this.junction.set(key, vgs);
    const { id, gm, gds } = mosI(vgs, vds, m);
    const terms: Term[] = [
      pol === 1 ? { p: G, n: src, g: gm, v0: vgs } : { p: src, n: G, g: -gm, v0: vgs },
      pol === 1 ? { p: d, n: src, g: gds + GMIN, v0: vds } : { p: src, n: d, g: -(gds + GMIN), v0: vds },
    ];
    s.nl(d, pol * id, terms);
    s.nl(src, -pol * id, neg(terms));
    return vgs === vgsRaw;
  }

  private stamp(s: Stamper, v: Float64Array, dt: number, inputs: SimInputs): boolean {
    let settled = true;
    const t = this.time + dt;
    for (let i = 0; i < this.n; i++) s.G[i][i] += GMIN;
    for (const part of this.board.parts) {
      const P = (pin: string) => this.node(part, pin);
      const U = (pin: string) => this.V(v, P(pin));
      const dead = this.burnt.has(part.id);
      if (isMcu(part.type)) {
        this.stampMcu(s, part, inputs);
        continue;
      }
      const bat = sourceOf(part);
      if (bat) {
        const g = 1 / bat.rint;
        s.g(P(bat.p), P(bat.n), g);
        s.src(P(bat.n), P(bat.p), bat.v(t) * g);
        continue;
      }
      if (part.type === "vcc") {
        const g = 1 / 0.01;
        s.g(P("1"), -1, g);
        s.src(-1, P("1"), (part.props.value ?? 5) * g);
        continue;
      }
      if (dead) continue;
      switch (part.type) {
        case "resistor":
          s.g(P("1"), P("2"), 1 / Math.max(0.1, parameter(part, "value")));
          break;
        case "fuse":
          s.g(P("1"), P("2"), 1 / 0.05);
          break;
        case "ldr":
          s.g(P("1"), P("2"), 1 / ldrOhms(inputs.ambient, part));
          break;
        case "pot": {
          const R = parameter(part, "value");
          const pos = parameter(part, "pos");
          s.g(P("1"), P("W"), 1 / Math.max(1, R * pos));
          s.g(P("W"), P("3"), 1 / Math.max(1, R * (1 - pos)));
          break;
        }
        case "button":
          s.g(P("1"), P("2"), contactConductance(part, inputs.pressed));
          break;
        case "switch":
          s.g(P("1"), P("2"), contactConductance(part, inputs.pressed));
          break;
        case "spdt":
          s.g(P("COM"), P("A"), part.props.closed ? CLOSED : OPEN);
          s.g(P("COM"), P("B"), part.props.closed ? OPEN : CLOSED);
          break;
        case "buzzer":
          s.g(P("+"), P("-"), 1 / parameter(part, "loadResistance"));
          break;
        case "led":
          settled = this.diode(s, v, part.id, P("A"), P("K"), ledModel(part)) && settled;
          break;
        case "diode":
          settled = this.diode(s, v, part.id, P("A"), P("K"), diodeModel(part)) && settled;
          break;
        case "schottky":
          settled = this.diode(s, v, part.id, P("A"), P("K"), SCHOTTKY) && settled;
          break;
        case "zener":
          settled = this.diode(s, v, part.id, P("A"), P("K"), DIODE) && settled;
          settled = this.diode(s, v, part.id + ":z", P("K"), P("A"), ZENER, zenerOffset(part.props.value ?? 5.1)) && settled;
          break;
        case "npn":
          settled = this.bjt(s, v, part.id, P("C"), P("B"), P("E"), 1, transistorModel(part)) && settled;
          break;
        case "pnp":
          settled = this.bjt(s, v, part.id, P("C"), P("B"), P("E"), -1, BJT[part.props.variant ?? "BC557"] ?? BJT.BC557) && settled;
          break;
        case "nmos":
          settled = this.mos(s, v, part.id, P("D"), P("G"), P("S"), 1, MOS[part.props.variant ?? "IRF540"] ?? MOS.IRF540) && settled;
          break;
        case "pmos":
          settled = this.mos(s, v, part.id, P("D"), P("G"), P("S"), -1, MOS[part.props.variant ?? "IRF9540"] ?? MOS.IRF9540) && settled;
          break;
        case "ceramic":
        case "electrolytic": {
          const a = part.type === "ceramic" ? P("1") : P("+");
          const b = part.type === "ceramic" ? P("2") : P("-");
          const g = parameter(part, "value") / dt;
          s.g(a, b, g);
          s.src(b, a, g * (this.capV.get(part.id) ?? 0));
          break;
        }
        case "inductor": {
          const g = dt / Math.max(1e-9, part.props.value ?? 10e-3);
          s.g(P("1"), P("2"), g);
          s.src(P("1"), P("2"), this.mem.get(`L:${part.id}`)?.[0] ?? 0);
          break;
        }
        case "transformer": {
          const x = this.xfmr(part, dt);
          const [p1, p2, s1, s2] = [P("P1"), P("P2"), P("S1"), P("S2")];
          s.g(p1, p2, x.g11);
          s.g(s1, s2, x.g22);
          s.vccs(p1, p2, s1, s2, x.g12);
          s.vccs(s1, s2, p1, p2, x.g12);
          const [i1, i2] = this.mem.get(`T:${part.id}`) ?? [0, 0];
          s.src(p1, p2, i1);
          s.src(s1, s2, i2);
          break;
        }
        case "isource": {
          s.g(P("+"), P("-"), 1e-6);
          s.src(P("-"), P("+"), part.props.value ?? 0.01);
          break;
        }
        case "voltmeter":
          s.g(P("+"), P("-"), 1e-7);
          break;
        case "ammeter":
          s.g(P("+"), P("-"), 100);
          break;
        case "multimeter": {
          const mode = part.props.mode ?? "V";
          if (mode === "A") s.g(P("+"), P("COM"), 100);
          else if (mode === "R") {
            s.g(P("+"), P("COM"), 1e-3);
            s.src(P("COM"), P("+"), 1e-3);
          } else s.g(P("+"), P("COM"), 1e-7);
          break;
        }
        case "scope":
          s.g(P("A"), P("GND"), 1e-7);
          s.g(P("B"), P("GND"), 1e-7);
          break;
        case "opamp": {
          const [ip, im, o, vp, vn] = [P("+"), P("-"), P("OUT"), P("V+"), P("V-")];
          s.g(vp, vn, 1 / 7000);
          const A = 1e4;
          const gout = 1 / 50;
          const vd = U("+") - U("-");
          const hi = U("V+") - 1.5;
          const lo = U("V-");
          const raw = A * vd;
          const prev = this.junction.get(part.id);
          let region = hi <= lo || raw <= lo ? -1 : raw >= hi ? 1 : 0;
          // Never jump straight from one rail to the other: pass through the linear region so feedback can settle.
          if (hi > lo && (prev === undefined || (prev !== 0 && region === -prev))) region = 0;
          const T = region === -1 ? lo : region === 1 ? hi : raw;
          const VO = U("OUT");
          const terms: Term[] = [{ p: o, n: -1, g: gout, v0: VO }];
          if (region === 0) terms.push({ p: ip, n: im, g: -gout * A, v0: vd });
          else if (region === 1) terms.push({ p: vp, n: -1, g: -gout, v0: U("V+") });
          else terms.push({ p: vn, n: -1, g: -gout, v0: U("V-") });
          s.nl(o, gout * (VO - T), terms);
          this.junction.set(part.id, region);
          if (prev !== region) settled = false;
          break;
        }
        case "lm7805":
        case "ams1117": {
          const r = this.regulator(part);
          const [vin, g, o] = [P("IN"), P("GND"), P("OUT")];
          s.g(vin, g, 1 / 2000);
          const VIN = U("IN");
          const VG = U("GND");
          const VO = U("OUT");
          const reg = VG + r.vout <= VIN - r.drop;
          const T = reg ? VG + r.vout : VIN - r.drop;
          const gout = 20;
          const pass = T - VO > 0;
          if (pass) {
            const terms: Term[] = [{ p: o, n: -1, g: gout, v0: VO }, reg ? { p: g, n: -1, g: -gout, v0: VG } : { p: vin, n: -1, g: -gout, v0: VIN }];
            s.nl(o, gout * (VO - T), terms);
            s.nl(vin, gout * (T - VO), neg(terms));
          }
          const state = (reg ? 1 : 0) + (pass ? 2 : 0);
          if (this.junction.get(part.id) !== state) settled = false;
          this.junction.set(part.id, state);
          break;
        }
        case "relay": {
          const on = this.latch.get(part.id) ?? false;
          s.g(P("1"), P("2"), 0.07 / (part.props.value ?? 5));
          s.g(P("COM"), P("NO"), on ? CLOSED : OPEN);
          s.g(P("COM"), P("NC"), on ? OPEN : CLOSED);
          break;
        }
        case "opto": {
          const [a, k, c, e] = [P("A"), P("K"), P("C"), P("E")];
          settled = this.diode(s, v, part.id, a, k, OPTO_LED) && settled;
          const vd = this.junction.get(part.id) ?? 0;
          const nvt = OPTO_LED.n * VT;
          const ex = Math.exp(Math.min(vd / nvt, 80));
          const If = Math.max(0, OPTO_LED.is * (ex - 1));
          const gd = If > 0 ? (OPTO_LED.is / nvt) * ex : 0;
          const vce = U("C") - U("E");
          // Saturation curve, continued as a straight line below 0 V so Newton can climb back from an overshoot.
          const f = vce > 0 ? 1 - Math.exp(-vce / 0.15) : vce / 0.15;
          const fp = vce > 0 ? Math.exp(-vce / 0.15) / 0.15 : 1 / 0.15;
          const terms: Term[] = [
            { p: a, n: k, g: OPTO_CTR * gd * f, v0: vd },
            { p: c, n: e, g: OPTO_CTR * If * fp + GMIN, v0: vce },
          ];
          s.nl(c, OPTO_CTR * If * f, terms);
          s.nl(e, -OPTO_CTR * If * f, neg(terms));
          break;
        }
        case "sevenseg": {
          const model = ledModel("red");
          const ca = part.props.mode === "ca";
          for (const seg of SEGMENTS) {
            settled = (ca ? this.diode(s, v, `${part.id}:${seg}`, P("COM"), P(seg), model) : this.diode(s, v, `${part.id}:${seg}`, P(seg), P("COM"), model)) && settled;
          }
          break;
        }
        case "dcmotor":
          s.g(P("+"), P("-"), 0.25 / (part.props.value ?? 6));
          break;
        case "servo":
          s.g(P("V+"), P("GND"), 1 / 500);
          s.g(P("SIG"), P("GND"), 1e-5);
          break;
        case "hc595": {
          const g = P("GND");
          const vs = U("VCC") - U("GND");
          s.g(P("VCC"), g, 1 / 100000);
          const [reg, memOut] = this.mem.get(`S:${part.id}`) ?? [0, 0];
          const out = inputs.latched?.get(part.id) ?? memOut;
          const oe = U("OE") - U("GND") < vs / 2;
          const drive = (pin: string, bit: number) => {
            const q = P(pin);
            s.g(q, g, 1 / 50);
            s.src(g, q, (bit ? Math.max(0, vs) : 0) / 50);
          };
          if (vs > 2) {
            if (oe) for (let i = 0; i < 8; i++) drive(`Q${i}`, (out >> i) & 1);
            drive("Q7S", (reg >> 7) & 1);
          }
          break;
        }
        case "pcf8574": {
          s.g(P("VCC"), P("GND"), 1 / 50000);
          // Quasi-bidirectional ports: a 1 is a weak pull-up (about 100 µA), a 0 sinks hard (25 mA at 0.6 V).
          const bits = inputs.latched?.get(part.id) ?? 0xff;
          for (let i = 0; i < 8; i++) {
            if ((bits >> i) & 1) s.g(P(`P${i}`), P("VCC"), 1 / 40000);
            else s.g(P(`P${i}`), P("GND"), 1 / 25);
          }
          break;
        }
        case "oled":
          s.g(P("VCC"), P("GND"), 1 / 400);
          break;
        case "lcd1602":
          s.g(P("VDD"), P("VSS"), 1 / 3300);
          settled = this.diode(s, v, part.id, P("A"), P("K"), ledModel("white")) && settled;
          break;
        case "timer555": {
          const gnd = P("1");
          const vs = this.V(v, P("8")) - this.V(v, gnd);
          s.g(P("8"), gnd, 1 / 20000);
          const q = this.latch.get(part.id) ?? false;
          const target = q ? Math.max(0, vs - parameter(part, "outputDrop")) : 0;
          const gOut = 1 / parameter(part, "outputResistance");
          s.g(P("3"), gnd, gOut);
          s.src(gnd, P("3"), target * gOut);
          s.g(P("7"), gnd, q ? OPEN : 1 / 10);
          break;
        }
      }
    }
    return settled;
  }

  /**
   * A microcontroller board: USB feeds the 5 V and 3.3 V rails; each GPIO is an output driver (a voltage behind
   * the datasheet output resistance), an internal pull-up or pull-down, or a high-impedance input.
   */
  private stampMcu(s: Stamper, part: Part, inputs: SimInputs) {
    const spec = BOARDS[part.type as keyof typeof BOARDS];
    const P = (pin: string) => this.node(part, pin);
    const G = P(spec.gnd);
    for (const r of spec.rails) {
      const g = 1 / r.rint;
      s.g(P(r.pin), G, g);
      s.src(G, P(r.pin), r.v * g);
    }
    const drives = inputs.mcu?.get(part.id);
    if (!drives) return;
    for (const io of spec.gpio) {
      const d = drives[io.id];
      const n = P(io.id);
      if (!d || d.mode === "in" || n === G) continue;
      if (d.mode === "out") {
        const g = 1 / spec.rOut;
        s.g(n, G, g);
        s.src(G, n, d.duty * spec.vcc * g);
      } else {
        const g = 1 / spec.rPull;
        s.g(n, G, g);
        if (d.mode === "pullup") s.src(G, n, spec.vcc * g);
      }
    }
  }

  /** Current flowing out of each GPIO into the circuit, by pin id. */
  private mcuPinCurrents(part: Part, inputs: SimInputs): Record<string, number> {
    const spec = BOARDS[part.type as keyof typeof BOARDS];
    const V = (pin: string) => this.V(this.v, this.node(part, pin));
    const out: Record<string, number> = {};
    const drives = inputs.mcu?.get(part.id);
    for (const io of spec.gpio) {
      const d = drives?.[io.id];
      if (!d || d.mode === "in") continue;
      const vn = V(io.id) - V(spec.gnd);
      if (d.mode === "out") out[io.id] = (d.duty * spec.vcc - vn) / spec.rOut;
      else if (d.mode === "pullup") out[io.id] = (spec.vcc - vn) / spec.rPull;
      else out[io.id] = -vn / spec.rPull;
    }
    return out;
  }

  /** Coupled-inductor companion conductances for a transformer: 1 H primary, turns ratio n, coupling 0.99. */
  private xfmr(part: Part, dt: number) {
    const n = Math.max(0.01, part.props.value ?? 0.1);
    const L1 = 1;
    const L2 = n * n;
    const M = 0.99 * Math.sqrt(L1 * L2);
    const det = L1 * L2 - M * M;
    return { n, g11: (dt * L2) / det, g22: (dt * L1) / det, g12: (-dt * M) / det };
  }

  private regulator(part: Part) {
    return part.type === "lm7805" ? { vout: 5, drop: 2, imax: 1.5 } : { vout: Number(part.props.variant ?? 3.3) || 3.3, drop: 1.1, imax: 1 };
  }

  /** Advance the circuit by dt seconds. */
  step(dt: number, inputs: SimInputs) {
    if (!this.powered) return;
    let v = this.v;
    for (let it = 0; it < 120; it++) {
      const s = new Stamper(this.n);
      const settled = this.stamp(s, v, dt, inputs);
      const next = solveLinear(s.G, s.i);
      let delta = 0;
      for (let i = 0; i < this.n; i++) delta = Math.max(delta, Math.abs(next[i] - v[i]) / (1e-3 + Math.abs(next[i])));
      v = next;
      if (settled && delta < 1e-6) break;
    }
    this.v = v;
    this.time += dt;
    this.afterStep(dt, inputs);
  }

  private afterStep(dt: number, inputs: SimInputs) {
    const U = (part: Part, pin: string) => this.V(this.v, this.node(part, pin));
    // Energy-storage and latch state first, so the snapshot below reports the new values.
    for (const part of this.board.parts) {
      if (this.burnt.has(part.id)) continue;
      switch (part.type) {
        case "inductor": {
          const key = `L:${part.id}`;
          const i = this.mem.get(key)?.[0] ?? 0;
          this.mem.set(key, [i + (dt / Math.max(1e-9, part.props.value ?? 10e-3)) * (U(part, "1") - U(part, "2"))]);
          break;
        }
        case "transformer": {
          const x = this.xfmr(part, dt);
          const key = `T:${part.id}`;
          const [i1, i2] = this.mem.get(key) ?? [0, 0];
          const v1 = U(part, "P1") - U(part, "P2");
          const v2 = U(part, "S1") - U(part, "S2");
          this.mem.set(key, [i1 + x.g11 * v1 + x.g12 * v2, i2 + x.g12 * v1 + x.g22 * v2]);
          break;
        }
        case "relay": {
          const ic = Math.abs(U(part, "1") - U(part, "2")) * (0.07 / (part.props.value ?? 5));
          const on = this.latch.get(part.id) ?? false;
          if (!on && ic > 0.75 * 0.07) this.latch.set(part.id, true);
          else if (on && ic < 0.3 * 0.07) this.latch.set(part.id, false);
          break;
        }
        case "servo": {
          const key = `V:${part.id}`;
          const [high, t0, width] = this.mem.get(key) ?? [0, 0, 0];
          const sig = U(part, "SIG") - U(part, "GND") > 1.5 ? 1 : 0;
          if (sig && !high) this.mem.set(key, [1, this.time, width]);
          else if (!sig && high) this.mem.set(key, [0, t0, this.time - t0]);
          break;
        }
        case "hc595": {
          const key = `S:${part.id}`;
          let [reg, out, clk, rclk] = this.mem.get(key) ?? [0, 0, 0, 0];
          const vs = U(part, "VCC") - U(part, "GND");
          const hi = (pin: string) => (U(part, pin) - U(part, "GND") > vs / 2 ? 1 : 0);
          if (vs > 2) {
            const c = hi("SRCLK");
            const r = hi("RCLK");
            if (!hi("SRCLR")) reg = 0;
            else if (c && !clk) reg = ((reg << 1) | hi("SER")) & 0xff;
            if (r && !rclk) out = reg;
            clk = c;
            rclk = r;
          }
          this.mem.set(key, [reg, out, clk, rclk]);
          break;
        }
        case "scope": {
          const key = `O:${part.id}`;
          const buf = this.mem.get(key) ?? [0];
          let acc = buf[0] + dt;
          const a = U(part, "A") - U(part, "GND");
          const b = U(part, "B") - U(part, "GND");
          const samples = buf.slice(1);
          while (acc >= SCOPE_DT) {
            acc -= SCOPE_DT;
            samples.push(a, b);
          }
          this.mem.set(key, [acc, ...samples.slice(-SCOPE_N * 2)]);
          break;
        }
      }
    }
    const snap = this.snapshot(inputs);
    for (const part of this.board.parts) {
      const P = (pin: string) => this.node(part, pin);
      if (part.type === "ceramic") this.capV.set(part.id, this.V(this.v, P("1")) - this.V(this.v, P("2")));
      if (part.type === "electrolytic") this.capV.set(part.id, this.V(this.v, P("+")) - this.V(this.v, P("-")));
      if (part.type === "timer555" && !this.burnt.has(part.id)) {
        const g = this.V(this.v, P("1"));
        const vs = this.V(this.v, P("8")) - g;
        const trig = this.V(this.v, P("2")) - g;
        const thr = this.V(this.v, P("6")) - g;
        const rst = this.V(this.v, P("4")) - g;
        let q = this.latch.get(part.id) ?? false;
        if (vs < 3) q = false;
        else if (rst < 0.7) {
          q = false;
          if (!this.resetWarned.has(part.id)) {
            this.resetWarned.add(part.id);
            this.events.push({ type: "reset-floating", partId: part.id });
          }
        } else if (trig < vs * parameter(part, "triggerRatio")) q = true;
        else if (thr > vs * parameter(part, "thresholdRatio")) q = false;
        this.latch.set(part.id, q);
      }
      const st = snap.parts[part.id];
      if (!st) continue;
      if (isMcu(part.type)) {
        // A pin over its limit is reported (the lab stops the program); the board itself never burns here.
        if (st.stress > 1) {
          if (!this.shorted.has(part.id)) {
            this.shorted.add(part.id);
            this.events.push({ type: Math.abs(st.current) > 0.5 ? "short" : "overcurrent", partId: part.id, partType: part.type } as SimEvent);
          }
        } else this.shorted.delete(part.id);
        continue;
      }
      if (sourceOf(part) || part.type === "vcc") {
        if (st.stress > 1) {
          if (!this.shorted.has(part.id)) {
            this.shorted.add(part.id);
            this.events.push({ type: "short", partId: part.id });
          }
        } else this.shorted.delete(part.id);
        continue;
      }
      if (st.reversed && !this.reversedSeen.has(part.id)) {
        this.reversedSeen.add(part.id);
        this.events.push({ type: "reversed", partId: part.id, partType: part.type });
      }
      if (this.burnt.has(part.id)) continue;
      const d = this.damage.get(part.id) ?? { over: 0 };
      const limit = part.type === "electrolytic" ? 1.5 : part.type === "led" || part.type === "sevenseg" ? 0.12 : part.type === "fuse" ? 0.05 : 0.5;
      if (st.stress > 1) {
        if (d.over === 0) this.events.push({ type: "overcurrent", partId: part.id, partType: part.type });
        d.over += dt;
      } else d.over = Math.max(0, d.over - dt);
      this.damage.set(part.id, d);
      if (d.over > limit) {
        this.burnt.add(part.id);
        this.events.push({ type: "burnt", partId: part.id, partType: part.type });
      }
    }
  }

  /** Repair a part (after the student swaps or edits it). */
  repair(partId: string) {
    this.burnt.delete(partId);
    this.damage.delete(partId);
    this.reversedSeen.delete(partId);
  }

  isBurnt(partId: string) {
    return this.burnt.has(partId);
  }

  burntIds(): string[] {
    return [...this.burnt];
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  snapshot(inputs: SimInputs): SimSnapshot {
    const netV = this.netlist.nets.map((_, i) => (this.row[i] < 0 ? 0 : this.v[this.row[i]]));
    const parts: Record<string, PartState> = {};
    const V = (part: Part, pin: string) => this.V(this.v, this.node(part, pin));
    for (const part of this.board.parts) {
      const burnt = this.burnt.has(part.id);
      const st: PartState = { current: 0, power: 0, pinCurrents: {}, glow: 0, on: false, burnt, reversed: false, stress: 0 };
      const two = (a: string, b: string, I: number) => {
        st.current = I;
        st.pinCurrents = { [a]: I, [b]: -I };
        st.power = Math.abs(I * (V(part, a) - V(part, b)));
      };
      if (!this.powered) {
        parts[part.id] = st;
        continue;
      }
      if (isMcu(part.type)) {
        const spec = BOARDS[part.type];
        const rail = usbRail(spec);
        const usb = (rail.v - (V(part, spec.usbPin) - V(part, spec.gnd))) / rail.rint;
        const pins = this.mcuPinCurrents(part, inputs);
        const worst = Math.max(0, ...Object.values(pins).map(Math.abs));
        st.current = usb;
        st.pinCurrents = pins;
        st.power = usb * rail.v;
        st.on = true;
        st.stress = Math.max(Math.abs(usb) / 0.5, worst / spec.iMax);
        st.glow = inputs.mcu?.get(part.id)?.[spec.led]?.duty ?? 0;
        parts[part.id] = st;
        continue;
      }
      const bat = sourceOf(part);
      if (bat) {
        const I = (bat.v(this.time) - (V(part, bat.p) - V(part, bat.n))) / bat.rint;
        st.current = I;
        st.pinCurrents = { [bat.p]: -I, [bat.n]: I };
        st.power = I * I * bat.rint;
        st.stress = Math.abs(I) / bat.imax;
        st.on = Math.abs(I) > 1e-4;
        parts[part.id] = st;
        continue;
      }
      if (part.type === "vcc") {
        const I = ((part.props.value ?? 5) - V(part, "1")) / 0.01;
        st.current = I;
        st.pinCurrents = { "1": -I };
        st.stress = Math.abs(I) / 10;
        st.on = Math.abs(I) > 1e-4;
        parts[part.id] = st;
        continue;
      }
      if (burnt) {
        parts[part.id] = st;
        continue;
      }
      switch (part.type) {
        case "resistor": {
          const R = Math.max(0.1, parameter(part, "value"));
          two("1", "2", (V(part, "1") - V(part, "2")) / R);
          st.stress = st.power / parameter(part, "powerRating") / 2;
          break;
        }
        case "fuse":
          two("1", "2", (V(part, "1") - V(part, "2")) / 0.05);
          st.stress = Math.abs(st.current) / (part.props.value ?? 0.5);
          break;
        case "ldr":
          two("1", "2", (V(part, "1") - V(part, "2")) / ldrOhms(inputs.ambient, part));
          st.stress = st.power / 0.1 / 2;
          break;
        case "pot": {
          const R = parameter(part, "value");
          const pos = parameter(part, "pos");
          const i1 = (V(part, "1") - V(part, "W")) / Math.max(1, R * pos);
          const i2 = (V(part, "W") - V(part, "3")) / Math.max(1, R * (1 - pos));
          st.current = Math.max(Math.abs(i1), Math.abs(i2));
          st.pinCurrents = { "1": i1, W: i2 - i1, "3": -i2 };
          st.power = i1 * i1 * R * pos + i2 * i2 * R * (1 - pos);
          st.stress = st.power / parameter(part, "powerRating") / 2;
          break;
        }
        case "button":
          two("1", "2", (V(part, "1") - V(part, "2")) * contactConductance(part, inputs.pressed));
          st.on = Boolean(part.props.normallyClosed) !== inputs.pressed.has(part.id);
          st.stress = Math.abs(st.current) / 0.5;
          break;
        case "switch":
          two("1", "2", (V(part, "1") - V(part, "2")) * contactConductance(part, inputs.pressed));
          st.on = Boolean(part.props.closed);
          st.stress = Math.abs(st.current) / 1;
          break;
        case "spdt": {
          const ia = (V(part, "COM") - V(part, "A")) * (part.props.closed ? CLOSED : OPEN);
          const ib = (V(part, "COM") - V(part, "B")) * (part.props.closed ? OPEN : CLOSED);
          st.current = ia + ib;
          st.pinCurrents = { COM: ia + ib, A: -ia, B: -ib };
          st.on = Boolean(part.props.closed);
          st.stress = Math.abs(st.current) / 1;
          break;
        }
        case "buzzer": {
          const vd = V(part, "+") - V(part, "-");
          two("+", "-", vd / parameter(part, "loadResistance"));
          st.on = vd > parameter(part, "minVoltage") && vd <= parameter(part, "maxVoltage");
          st.reversed = vd < -1;
          st.stress = Math.abs(vd) / (parameter(part, "maxVoltage") * 1.25);
          break;
        }
        case "led":
        case "diode":
        case "schottky": {
          const m = part.type === "led" ? ledModel(part) : part.type === "schottky" ? SCHOTTKY : diodeModel(part);
          const vd = V(part, "A") - V(part, "K");
          const I = m.is * Math.expm1(Math.min(vd / (m.n * VT), 80));
          two("A", "K", I);
          if (part.type === "led") {
            st.glow = I > 2e-4 && part.props.color !== "ir" ? Math.min(1, (I / parameter(part, "ratedCurrent")) ** 0.6) : 0;
            st.on = I > 2e-4;
            st.stress = I / (parameter(part, "ratedCurrent") * 2.5);
          } else st.stress = I / (part.type === "diode" ? parameter(part, "ratedCurrent") * 1.5 : 1.5);
          st.reversed = vd < -1;
          break;
        }
        case "zener": {
          const vd = V(part, "A") - V(part, "K");
          const fwd = DIODE.is * Math.expm1(Math.min(vd / (DIODE.n * VT), 80));
          const rev = ZENER.is * Math.expm1(Math.min((-vd - zenerOffset(part.props.value ?? 5.1)) / (ZENER.n * VT), 80));
          two("A", "K", fwd - rev);
          st.on = rev > 1e-4;
          st.stress = st.power / 0.5;
          break;
        }
        case "npn":
        case "pnp": {
          const sg = part.type === "npn" ? 1 : -1;
          const m = transistorModel(part);
          const vbe = sg * (V(part, "B") - V(part, "E"));
          const vbc = sg * (V(part, "B") - V(part, "C"));
          const iF = m.is * Math.expm1(Math.min(vbe / VT, 80));
          const iR = m.is * Math.expm1(Math.min(vbc / VT, 80));
          const Ic = iF - iR - iR / m.br;
          const Ib = iF / m.bf + iR / m.br;
          st.current = Ic;
          st.pinCurrents = { C: sg * Ic, B: sg * Ib, E: -sg * (Ic + Ib) };
          st.power = Math.abs(Ic * (V(part, "C") - V(part, "E")));
          st.on = Ic > 1e-4;
          st.reversed = Ic < -1e-3;
          st.stress = Math.max(Ic / m.imax, st.power / m.pmax);
          break;
        }
        case "nmos":
        case "pmos": {
          const pol = part.type === "nmos" ? 1 : -1;
          const m = MOS[part.props.variant ?? (pol === 1 ? "IRF540" : "IRF9540")] ?? MOS.IRF540;
          const swapped = pol * (V(part, "D") - V(part, "S")) < 0;
          const [d, src] = swapped ? ["S", "D"] : ["D", "S"];
          const { id } = mosI(pol * (V(part, "G") - V(part, src)), pol * (V(part, d) - V(part, src)), m);
          st.current = swapped ? -id : id;
          st.pinCurrents = { [d]: pol * id, [src]: -pol * id, G: 0 };
          st.power = Math.abs(id * (V(part, "D") - V(part, "S")));
          st.on = id > 1e-4;
          st.stress = Math.max(id / m.imax, st.power / m.pmax);
          break;
        }
        case "ceramic":
        case "electrolytic": {
          const a = part.type === "ceramic" ? "1" : "+";
          const b = part.type === "ceramic" ? "2" : "-";
          const vc = V(part, a) - V(part, b);
          st.current = 0;
          st.pinCurrents = { [a]: 0, [b]: 0 };
          st.stress = Math.abs(vc) / parameter(part, "voltageRating");
          if (part.type === "electrolytic") {
            st.reversed = vc < -1;
            st.stress = vc < -1 ? 2 : vc / parameter(part, "voltageRating");
          }
          break;
        }
        case "inductor": {
          const I = this.mem.get(`L:${part.id}`)?.[0] ?? 0;
          two("1", "2", I);
          st.stress = Math.abs(I) / 1.5;
          break;
        }
        case "transformer": {
          const [i1, i2] = this.mem.get(`T:${part.id}`) ?? [0, 0];
          const n = Math.max(0.01, part.props.value ?? 0.1);
          st.current = i1;
          st.pinCurrents = { P1: i1, P2: -i1, S1: i2, S2: -i2 };
          st.on = Math.abs(V(part, "S1") - V(part, "S2")) > 0.05;
          st.stress = Math.max(Math.abs(i1), Math.abs(i2) * n);
          break;
        }
        case "isource": {
          const I = part.props.value ?? 0.01;
          st.current = I;
          st.pinCurrents = { "+": -I, "-": I };
          st.power = Math.abs(I * (V(part, "+") - V(part, "-")));
          st.on = true;
          break;
        }
        case "voltmeter":
          two("+", "-", (V(part, "+") - V(part, "-")) * 1e-7);
          st.reading = V(part, "+") - V(part, "-");
          break;
        case "ammeter":
          two("+", "-", (V(part, "+") - V(part, "-")) * 100);
          st.reading = st.current;
          st.stress = Math.abs(st.current) / 10;
          break;
        case "multimeter": {
          const vab = V(part, "+") - V(part, "COM");
          const mode = part.props.mode ?? "V";
          if (mode === "A") {
            two("+", "COM", vab * 100);
            st.reading = st.current;
            st.stress = Math.abs(st.current) / 10;
          } else if (mode === "R") {
            const I = (1 - vab) / 1000;
            st.current = -I;
            st.pinCurrents = { "+": -I, COM: I };
            st.reading = I > 1e-9 && vab >= 0 ? vab / I : Infinity;
          } else {
            two("+", "COM", vab * 1e-7);
            st.reading = vab;
          }
          break;
        }
        case "scope": {
          const buf = this.mem.get(`O:${part.id}`) ?? [0];
          const a: number[] = [];
          const b: number[] = [];
          for (let i = 1; i + 1 < buf.length; i += 2) {
            a.push(buf[i]);
            b.push(buf[i + 1]);
          }
          st.wave = [a, b];
          st.on = true;
          st.pinCurrents = { A: (V(part, "A") - V(part, "GND")) * 1e-7, B: (V(part, "B") - V(part, "GND")) * 1e-7, GND: -(V(part, "A") + V(part, "B") - 2 * V(part, "GND")) * 1e-7 };
          break;
        }
        case "opamp": {
          const vd = V(part, "+") - V(part, "-");
          const hi = V(part, "V+") - 1.5;
          const lo = V(part, "V-");
          const T = hi <= lo ? lo : Math.max(lo, Math.min(hi, 1e4 * vd));
          const iOut = (V(part, "OUT") - T) / 50;
          const iSup = (V(part, "V+") - V(part, "V-")) / 7000;
          st.current = -iOut;
          st.pinCurrents = { OUT: iOut, "V+": iSup, "V-": -iSup - iOut, "+": 0, "-": 0 };
          st.on = V(part, "V+") - V(part, "V-") > 3;
          st.power = Math.abs(iOut) * Math.abs(V(part, "V+") - V(part, "OUT")) + iSup * (V(part, "V+") - V(part, "V-"));
          st.stress = (V(part, "V+") - V(part, "V-")) / 34;
          break;
        }
        case "lm7805":
        case "ams1117": {
          const r = this.regulator(part);
          const VIN = V(part, "IN");
          const VG = V(part, "GND");
          const VO = V(part, "OUT");
          const T = Math.min(VG + r.vout, VIN - r.drop);
          const I = Math.max(0, 20 * (T - VO));
          const iq = (VIN - VG) / 2000;
          st.current = I;
          st.pinCurrents = { IN: I + iq, OUT: -I, GND: -iq };
          st.power = I * Math.max(0, VIN - VO);
          st.on = VO - VG > 0.5;
          st.stress = Math.max(I / r.imax, st.power / 2, (VIN - VG) / (part.type === "lm7805" ? 35 : 15));
          break;
        }
        case "relay": {
          const rated = part.props.value ?? 5;
          const on = this.latch.get(part.id) ?? false;
          const ic = (V(part, "1") - V(part, "2")) * (0.07 / rated);
          const ino = (V(part, "COM") - V(part, "NO")) * (on ? CLOSED : OPEN);
          const inc = (V(part, "COM") - V(part, "NC")) * (on ? OPEN : CLOSED);
          st.current = ic;
          st.pinCurrents = { "1": ic, "2": -ic, COM: ino + inc, NO: -ino, NC: -inc };
          st.power = Math.abs(ic * (V(part, "1") - V(part, "2")));
          st.on = on;
          st.stress = Math.max(Math.abs(V(part, "1") - V(part, "2")) / (1.5 * rated), Math.abs(ino + inc) / 10);
          break;
        }
        case "opto": {
          const vd = V(part, "A") - V(part, "K");
          const If = Math.max(0, OPTO_LED.is * Math.expm1(Math.min(vd / (OPTO_LED.n * VT), 80)));
          const vce = V(part, "C") - V(part, "E");
          const Ic = OPTO_CTR * If * (vce > 0 ? 1 - Math.exp(-vce / 0.15) : vce / 0.15);
          st.current = Ic;
          st.pinCurrents = { A: If, K: -If, C: Ic, E: -Ic };
          st.power = If * vd + Ic * Math.max(0, vce);
          st.on = Ic > 1e-4;
          st.reversed = vd < -1;
          st.stress = Math.max(If / 0.06, Ic / 0.05);
          break;
        }
        case "sevenseg": {
          const m = ledModel("red");
          const ca = part.props.mode === "ca";
          const segs: number[] = [];
          let total = 0;
          let worst = 0;
          for (const seg of SEGMENTS) {
            const vd = ca ? V(part, "COM") - V(part, seg) : V(part, seg) - V(part, "COM");
            const I = m.is * Math.expm1(Math.min(vd / (m.n * VT), 80));
            segs.push(I > 2e-4 ? Math.min(1, (I / 0.02) ** 0.6) : 0);
            st.pinCurrents[seg] = ca ? -I : I;
            total += Math.max(0, I);
            worst = Math.max(worst, I);
          }
          st.pinCurrents.COM = ca ? total : -total;
          st.segs = segs;
          st.current = total;
          st.on = segs.some((g) => g > 0);
          st.stress = worst / LED_BURN_A;
          break;
        }
        case "dcmotor": {
          const rated = part.props.value ?? 6;
          const vd = V(part, "+") - V(part, "-");
          two("+", "-", (vd * 0.25) / rated);
          st.level = Math.min(1, Math.abs(vd) / rated);
          st.on = st.level > 0.05;
          st.phase = (((this.time * st.level * 3 * Math.sign(vd)) % 1) + 1) % 1;
          st.stress = Math.abs(vd) / (1.6 * rated);
          break;
        }
        case "servo": {
          const vs = V(part, "V+") - V(part, "GND");
          const width = this.mem.get(`V:${part.id}`)?.[2] ?? 0;
          two("V+", "GND", vs / 500);
          st.on = vs > 4 && vs < 7.2;
          st.level = width > 0 ? Math.max(0, Math.min(1, (width - 0.001) / 0.001)) : 0.5;
          st.stress = vs / 8;
          break;
        }
        case "hc595": {
          const vs = V(part, "VCC") - V(part, "GND");
          const [, memOut] = this.mem.get(`S:${part.id}`) ?? [0, 0];
          const out = inputs.latched?.get(part.id) ?? memOut;
          st.segs = Array.from({ length: 8 }, (_, i) => (out >> i) & 1);
          st.on = vs > 2;
          let iq = vs / 100000;
          for (let i = 0; i < 8; i++) {
            const qi = (V(part, `Q${i}`) - V(part, "GND") - (st.segs[i] && st.on ? vs : 0)) / 50;
            st.pinCurrents[`Q${i}`] = qi;
            iq -= qi;
          }
          st.pinCurrents.VCC = vs / 100000;
          st.pinCurrents.GND = -iq;
          st.stress = vs / 7;
          break;
        }
        case "pcf8574": {
          const vs = V(part, "VCC") - V(part, "GND");
          st.on = vs > 2.5;
          st.stress = vs / 7;
          break;
        }
        case "oled": {
          const vs = V(part, "VCC") - V(part, "GND");
          two("VCC", "GND", vs / 400);
          st.on = vs >= 2.8 && vs <= 5.5;
          st.stress = vs / 6.5;
          break;
        }
        case "lcd1602": {
          const vs = V(part, "VDD") - V(part, "VSS");
          const m = ledModel("white");
          const ibl = Math.max(0, m.is * Math.expm1(Math.min((V(part, "A") - V(part, "K")) / (m.n * VT), 80)));
          st.current = vs / 3300;
          st.pinCurrents = { VDD: vs / 3300, VSS: -vs / 3300, A: ibl, K: -ibl };
          st.on = vs >= 4.2 && vs <= 5.7;
          st.level = ibl > 2e-4 ? Math.min(1, (ibl / 0.02) ** 0.6) : 0;
          st.stress = Math.max(vs / 7, ibl / 0.06);
          break;
        }
        case "timer555": {
          const gnd = V(part, "1");
          const q = this.latch.get(part.id) ?? false;
          const vs = V(part, "8") - gnd;
          const target = q ? Math.max(0, vs - parameter(part, "outputDrop")) : 0;
          const iOut = ((V(part, "3") - gnd) - target) / parameter(part, "outputResistance");
          const iDis = q ? 0 : (V(part, "7") - gnd) / 10;
          const iSup = vs / 20000;
          st.on = q;
          st.current = -iOut;
          st.pinCurrents = { "3": iOut, "7": iDis, "8": iSup, "1": -(iOut + iDis + iSup) };
          st.power = Math.abs(iOut) * Math.abs(vs - (V(part, "3") - gnd)) + vs * iSup;
          st.stress = Math.abs(iOut) / 0.25;
          break;
        }
      }
      parts[part.id] = st;
    }
    return { time: this.time, groundNet: this.ground, netV, parts };
  }
}

/** Run the circuit to steady state. Parts in `burnt` start burnt, as they are on the live board. */
export function solveSteady(board: Board, inputs: Partial<SimInputs> = {}, seconds = 2, netlist?: Netlist, burnt?: ReadonlySet<string>): SimSnapshot | null {
  const sim = new Simulator(board, { burnt: new Set(burnt) }, netlist);
  if (!sim.powered) return null;
  const inp: SimInputs = { ambient: inputs.ambient ?? 0.6, pressed: inputs.pressed ?? new Set() };
  const steps = sim.dynamic ? Math.round(seconds / 0.002) : 4;
  const dt = sim.dynamic ? 0.002 : seconds / 4;
  for (let i = 0; i < steps; i++) sim.step(dt, inp);
  return sim.snapshot(inp);
}

/** Simulate for a while and sample a value every step: used to measure blink rates. */
export function sampleTransient(
  board: Board,
  seconds: number,
  dt: number,
  sample: (snap: SimSnapshot) => number,
  inputs: Partial<SimInputs> = {},
  netlist?: Netlist,
  burnt?: ReadonlySet<string>,
): number[] {
  const sim = new Simulator(board, { burnt: new Set(burnt) }, netlist);
  const inp: SimInputs = { ambient: inputs.ambient ?? 0.6, pressed: inputs.pressed ?? new Set() };
  const out: number[] = [];
  for (let t = 0; t < seconds; t += dt) {
    sim.step(dt, inp);
    out.push(sample(sim.snapshot(inp)));
  }
  return out;
}
