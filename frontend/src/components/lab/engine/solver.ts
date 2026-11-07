import { buildNetlist, type Netlist } from "./netlist.ts";
import { LED_BURN_A, LED_SPECS } from "./parts.ts";
import type { Board, Part } from "./types.ts";

/**
 * Circuit simulation by modified nodal analysis. Every element stamps conductances and current sources into
 * G·v = i. Diodes, LEDs and the transistor are exponential and solved by Newton–Raphson with SPICE-style
 * junction limiting. Capacitors use backward-Euler companion models; the 555 is a behavioural latch.
 * Batteries are Norton sources (voltage behind internal resistance), so no extra branch rows are needed.
 */

const VT = 0.02585;
const GMIN = 1e-9;
const OPEN = 1e-9;
const CLOSED = 1 / 0.05;

export interface SimInputs {
  /** Room light for LDRs, 0 dark .. 1 bright. */
  ambient: number;
  /** Buttons currently held down. */
  pressed: ReadonlySet<string>;
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
}

export type SimEvent =
  | { type: "burnt"; partId: string; partType: Part["type"] }
  | { type: "short"; partId: string }
  | { type: "reversed"; partId: string; partType: Part["type"] }
  | { type: "overcurrent"; partId: string; partType: Part["type"] }
  | { type: "reset-floating"; partId: string };

export interface SimSnapshot {
  time: number;
  groundNet: number;
  /** Voltage of each net relative to the battery's negative terminal. */
  netV: number[];
  parts: Record<string, PartState>;
}

interface DiodeModel {
  is: number;
  n: number;
}

const LED_N = 2;
function ledModel(color: Part["props"]["color"]): DiodeModel {
  const vf = LED_SPECS[color ?? "red"].vf;
  return { n: LED_N, is: 0.02 / Math.expm1(vf / (LED_N * VT)) };
}
const DIODE: DiodeModel = { is: 2.5e-9, n: 1.75 };
const NPN = { is: 1e-14, bf: 150, br: 2 };

export function batteryOf(type: Part["type"]): { v: number; rint: number } | null {
  if (type === "battery9v") return { v: 9, rint: 1.7 };
  if (type === "coincell") return { v: 3, rint: 30 };
  return null;
}

export function ldrOhms(ambient: number): number {
  return 10 ** (6 - 3 * Math.max(0, Math.min(1, ambient)));
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
  /**
   * Linearised nonlinear terminal current: I(v) ≈ I0 + Σ g·(vj − vj0), flowing from node `row` into the device,
   * where vj = v(p) − v(n) for each controlling junction.
   */
  nl(row: number, I0: number, terms: { p: number; n: number; g: number; v0: number }[]) {
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

export class Simulator {
  readonly board: Board;
  readonly netlist: Netlist;
  readonly ground: number;
  /** Net index to matrix row, -1 for ground. */
  private row: number[];
  private n: number;
  private v: Float64Array;
  readonly dynamic: boolean;
  time = 0;
  private capV = new Map<string, number>();
  private latch = new Map<string, boolean>();
  private junction = new Map<string, number>();
  private damage = new Map<string, Damage>();
  private burnt: Set<string>;
  private shorted = new Set<string>();
  private reversedSeen = new Set<string>();
  private resetWarned = new Set<string>();
  events: SimEvent[] = [];

  constructor(board: Board, carry?: { burnt?: Set<string>; capV?: Map<string, number>; latch?: Map<string, boolean> }, netlist?: Netlist) {
    this.board = board;
    this.netlist = netlist ?? buildNetlist(board);
    this.burnt = new Set(carry?.burnt ?? []);
    if (carry?.capV) this.capV = new Map(carry.capV);
    if (carry?.latch) this.latch = new Map(carry.latch);
    const battery = [...board.parts].filter((p) => batteryOf(p.type)).sort((a, b) => a.id.localeCompare(b.id))[0];
    this.ground = battery ? (this.netlist.netOf.get(`${battery.id}.-`) ?? -1) : -1;
    this.row = [];
    let k = 0;
    for (let i = 0; i < this.netlist.nets.length; i++) this.row.push(i === this.ground ? -1 : k++);
    this.n = k;
    this.v = new Float64Array(k);
    this.dynamic = board.parts.some((p) => p.type === "ceramic" || p.type === "electrolytic" || p.type === "timer555");
  }

  get powered(): boolean {
    return this.ground >= 0;
  }

  /** State that should survive rebuilding the simulator after an edit. */
  carry() {
    return { burnt: this.burnt, capV: this.capV, latch: this.latch };
  }

  private node(part: Part, pin: string): number {
    const net = this.netlist.netOf.get(`${part.id}.${pin}`);
    return net === undefined ? -1 : this.row[net];
  }

  private V(v: Float64Array, node: number): number {
    return node < 0 ? 0 : v[node];
  }

  private diode(s: Stamper, v: Float64Array, key: string, a: number, k: number, m: DiodeModel) {
    const nvt = m.n * VT;
    const vcrit = nvt * Math.log(nvt / (Math.SQRT2 * m.is));
    const raw = this.V(v, a) - this.V(v, k);
    const old = this.junction.get(key) ?? 0;
    const vd = pnjlim(raw, old, nvt, vcrit);
    this.junction.set(key, vd);
    const e = Math.exp(Math.min(vd / nvt, 80));
    const I = m.is * (e - 1);
    const g = (m.is / nvt) * e + GMIN;
    s.nl(a, I, [{ p: a, n: k, g, v0: vd }]);
    s.nl(k, -I, [{ p: a, n: k, g: -g, v0: vd }]);
    return Math.abs(vd - raw) < 1e-9;
  }

  private bjt(s: Stamper, v: Float64Array, key: string, c: number, b: number, e: number) {
    const vcrit = VT * Math.log(VT / (Math.SQRT2 * NPN.is));
    const rbe = this.V(v, b) - this.V(v, e);
    const rbc = this.V(v, b) - this.V(v, c);
    const vbe = pnjlim(rbe, this.junction.get(key + ":be") ?? 0, VT, vcrit);
    const vbc = pnjlim(rbc, this.junction.get(key + ":bc") ?? 0, VT, vcrit);
    this.junction.set(key + ":be", vbe);
    this.junction.set(key + ":bc", vbc);
    const ef = Math.exp(Math.min(vbe / VT, 80));
    const er = Math.exp(Math.min(vbc / VT, 80));
    const iF = NPN.is * (ef - 1);
    const iR = NPN.is * (er - 1);
    const gF = (NPN.is / VT) * ef + GMIN;
    const gR = (NPN.is / VT) * er + GMIN;
    const Ic = iF - iR - iR / NPN.br;
    const Ib = iF / NPN.bf + iR / NPN.br;
    const be = { p: b, n: e, v0: vbe };
    const bc = { p: b, n: c, v0: vbc };
    const dIc = [{ ...be, g: gF }, { ...bc, g: -gR * (1 + 1 / NPN.br) }];
    const dIb = [{ ...be, g: gF / NPN.bf }, { ...bc, g: gR / NPN.br }];
    s.nl(c, Ic, dIc);
    s.nl(b, Ib, dIb);
    s.nl(e, -(Ic + Ib), [...dIc, ...dIb].map((t) => ({ ...t, g: -t.g })));
    return Math.abs(vbe - rbe) < 1e-9 && Math.abs(vbc - rbc) < 1e-9;
  }

  private stamp(s: Stamper, v: Float64Array, dt: number, inputs: SimInputs): boolean {
    let settled = true;
    for (let i = 0; i < this.n; i++) s.G[i][i] += GMIN;
    for (const part of this.board.parts) {
      const P = (pin: string) => this.node(part, pin);
      const dead = this.burnt.has(part.id);
      const bat = batteryOf(part.type);
      if (bat) {
        const g = 1 / bat.rint;
        s.g(P("+"), P("-"), g);
        s.src(P("-"), P("+"), bat.v * g);
        continue;
      }
      if (dead) continue;
      switch (part.type) {
        case "resistor":
          s.g(P("1"), P("2"), 1 / Math.max(0.1, part.props.value ?? 330));
          break;
        case "ldr":
          s.g(P("1"), P("2"), 1 / ldrOhms(inputs.ambient));
          break;
        case "pot": {
          const R = part.props.value ?? 10000;
          const pos = part.props.pos ?? 0.5;
          s.g(P("1"), P("W"), 1 / Math.max(1, R * pos));
          s.g(P("W"), P("3"), 1 / Math.max(1, R * (1 - pos)));
          break;
        }
        case "button":
          s.g(P("1"), P("2"), inputs.pressed.has(part.id) ? CLOSED : OPEN);
          break;
        case "switch":
          s.g(P("1"), P("2"), part.props.closed ? CLOSED : OPEN);
          break;
        case "buzzer":
          s.g(P("+"), P("-"), 1 / 360);
          break;
        case "led":
          settled = this.diode(s, v, part.id, P("A"), P("K"), ledModel(part.props.color)) && settled;
          break;
        case "diode":
          settled = this.diode(s, v, part.id, P("A"), P("K"), DIODE) && settled;
          break;
        case "npn":
          settled = this.bjt(s, v, part.id, P("C"), P("B"), P("E")) && settled;
          break;
        case "ceramic":
        case "electrolytic": {
          const a = part.type === "ceramic" ? P("1") : P("+");
          const b = part.type === "ceramic" ? P("2") : P("-");
          const g = (part.props.value ?? 1e-6) / dt;
          s.g(a, b, g);
          s.src(b, a, g * (this.capV.get(part.id) ?? 0));
          break;
        }
        case "timer555": {
          const gnd = P("1");
          const vs = this.V(v, P("8")) - this.V(v, gnd);
          s.g(P("8"), gnd, 1 / 20000);
          const q = this.latch.get(part.id) ?? false;
          const target = q ? Math.max(0, vs - 1.7) : 0;
          const gOut = 1 / 15;
          s.g(P("3"), gnd, gOut);
          s.src(gnd, P("3"), target * gOut);
          s.g(P("7"), gnd, q ? OPEN : 1 / 10);
          break;
        }
      }
    }
    return settled;
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
        } else if (trig < vs / 3) q = true;
        else if (thr > (2 * vs) / 3) q = false;
        this.latch.set(part.id, q);
      }
      const st = snap.parts[part.id];
      if (!st) continue;
      if (batteryOf(part.type)) {
        const bat = batteryOf(part.type)!;
        if (st.current > (0.6 * bat.v) / bat.rint) {
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
      const limit = part.type === "electrolytic" ? 1.5 : part.type === "led" ? 0.12 : 0.5;
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
      const bat = batteryOf(part.type);
      if (bat) {
        const I = (bat.v - (V(part, "+") - V(part, "-"))) / bat.rint;
        st.current = I;
        st.pinCurrents = { "+": -I, "-": I };
        st.power = I * I * bat.rint;
        st.stress = I / ((0.6 * bat.v) / bat.rint);
        st.on = I > 1e-4;
        parts[part.id] = st;
        continue;
      }
      if (burnt) {
        parts[part.id] = st;
        continue;
      }
      switch (part.type) {
        case "resistor": {
          const R = Math.max(0.1, part.props.value ?? 330);
          two("1", "2", (V(part, "1") - V(part, "2")) / R);
          st.stress = st.power / 0.25 / 2;
          break;
        }
        case "ldr":
          two("1", "2", (V(part, "1") - V(part, "2")) / ldrOhms(inputs.ambient));
          st.stress = st.power / 0.1 / 2;
          break;
        case "pot": {
          const R = part.props.value ?? 10000;
          const pos = part.props.pos ?? 0.5;
          const i1 = (V(part, "1") - V(part, "W")) / Math.max(1, R * pos);
          const i2 = (V(part, "W") - V(part, "3")) / Math.max(1, R * (1 - pos));
          st.current = Math.max(Math.abs(i1), Math.abs(i2));
          st.pinCurrents = { "1": i1, W: i2 - i1, "3": -i2 };
          st.power = i1 * i1 * R * pos + i2 * i2 * R * (1 - pos);
          st.stress = st.power / 0.25 / 2;
          break;
        }
        case "button":
          two("1", "2", (V(part, "1") - V(part, "2")) * (inputs.pressed.has(part.id) ? CLOSED : OPEN));
          st.on = inputs.pressed.has(part.id);
          st.stress = Math.abs(st.current) / 0.5;
          break;
        case "switch":
          two("1", "2", (V(part, "1") - V(part, "2")) * (part.props.closed ? CLOSED : OPEN));
          st.on = Boolean(part.props.closed);
          st.stress = Math.abs(st.current) / 1;
          break;
        case "buzzer": {
          const vd = V(part, "+") - V(part, "-");
          two("+", "-", vd / 360);
          st.on = vd > 2.5;
          st.reversed = vd < -1;
          st.stress = vd / 15;
          break;
        }
        case "led":
        case "diode": {
          const m = part.type === "led" ? ledModel(part.props.color) : DIODE;
          const vd = V(part, "A") - V(part, "K");
          const I = m.is * Math.expm1(Math.min(vd / (m.n * VT), 80));
          two("A", "K", I);
          if (part.type === "led") {
            st.glow = I > 2e-4 ? Math.min(1, (I / 0.02) ** 0.6) : 0;
            st.on = st.glow > 0;
            st.stress = I / LED_BURN_A;
          } else st.stress = I / 1.5;
          st.reversed = vd < -1;
          break;
        }
        case "npn": {
          const vbe = V(part, "B") - V(part, "E");
          const vbc = V(part, "B") - V(part, "C");
          const iF = NPN.is * Math.expm1(Math.min(vbe / VT, 80));
          const iR = NPN.is * Math.expm1(Math.min(vbc / VT, 80));
          const Ic = iF - iR - iR / NPN.br;
          const Ib = iF / NPN.bf + iR / NPN.br;
          st.current = Ic;
          st.pinCurrents = { C: Ic, B: Ib, E: -(Ic + Ib) };
          st.power = Math.abs(Ic * (V(part, "C") - V(part, "E")));
          st.on = Ic > 1e-4;
          st.reversed = Ic < -1e-3;
          st.stress = Math.max(Ic / 0.8, st.power / 0.625);
          break;
        }
        case "ceramic":
        case "electrolytic": {
          const a = part.type === "ceramic" ? "1" : "+";
          const b = part.type === "ceramic" ? "2" : "-";
          const vc = V(part, a) - V(part, b);
          st.current = 0;
          st.pinCurrents = { [a]: 0, [b]: 0 };
          if (part.type === "electrolytic") {
            st.reversed = vc < -1;
            st.stress = vc < -1 ? 2 : vc / 25;
          }
          break;
        }
        case "timer555": {
          const gnd = V(part, "1");
          const q = this.latch.get(part.id) ?? false;
          const vs = V(part, "8") - gnd;
          const target = q ? Math.max(0, vs - 1.7) : 0;
          const iOut = ((V(part, "3") - gnd) - target) / 15;
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

/** Run a circuit to steady state, handy for checks and tests. */
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
