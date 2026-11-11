import { copperGap, sharesLayer, type Netlist } from "./netlist.ts";
import { PART_DEFS, partBox } from "./parts.ts";
import { sourceOf, type SimSnapshot } from "./solver.ts";
import type { Board, Pt } from "./types.ts";
import { MM } from "./types.ts";

export type DrcCode =
  | "short"
  | "no-resistor"
  | "overcurrent"
  | "reversed"
  | "floating-pin"
  | "trace-width"
  | "clearance"
  | "overlap"
  | "edge"
  | "acute-angle"
  | "reset-floating";

export interface DrcIssue {
  code: DrcCode;
  severity: "error" | "warning";
  message: string;
  /** Where to point, in grid units. */
  at: Pt;
  partIds: string[];
}

/** Minimum copper gap a typical board house can make reliably, in mm. */
export const MIN_CLEARANCE = 0.2;
const EDGE_MM = 0.5;

/** IPC-2221 external-layer width in mm for a current, 1 oz copper, 10 °C rise. */
export function requiredTraceWidth(amps: number): number {
  if (amps <= 0) return 0;
  const areaMil2 = (amps / (0.048 * 10 ** 0.44)) ** (1 / 0.725);
  return (areaMil2 / 1.378) * 0.0254;
}

/** Series resistor for an LED: (supply − forward voltage) ÷ current. */
export function ledResistor(supply: number, vf: number, amps = 0.02): number {
  return Math.max(0, (supply - vf) / amps);
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function runDrc(board: Board, nl: Netlist, snap: SimSnapshot | null): DrcIssue[] {
  const issues: DrcIssue[] = [];
  const byId = new Map(board.parts.map((p) => [p.id, p]));
  const at = (id: string): Pt => {
    const b = partBox(byId.get(id)!);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  };

  // Placement: parts must sit inside the board and must not overlap.
  const boxes = board.parts.map((p) => ({ p, b: partBox(p) }));
  for (const { p, b } of boxes) {
    const m = EDGE_MM / MM;
    if (b.x < m || b.y < m || b.x + b.w > board.w - m || b.y + b.h > board.h - m) {
      issues.push({ code: "edge", severity: "error", message: `${p.id} hangs over the board edge.`, at: at(p.id), partIds: [p.id] });
    }
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].b;
      const c = boxes[j].b;
      if (a.x < c.x + c.w - 0.05 && c.x < a.x + a.w - 0.05 && a.y < c.y + c.h - 0.05 && c.y < a.y + a.h - 0.05) {
        issues.push({ code: "overlap", severity: "error", message: `${boxes[i].p.id} and ${boxes[j].p.id} overlap.`, at: at(boxes[i].p.id), partIds: [boxes[i].p.id, boxes[j].p.id] });
      }
    }
  }

  // Clearance: copper of different nets too close, but not touching (touching is already a short).
  const copper = nl.copper;
  const netKey = (key: string) => nl.itemNet.get(key) ?? `iso:${key}`;
  const seenPair = new Set<string>();
  for (let i = 0; i < copper.length; i++) {
    for (let j = i + 1; j < copper.length; j++) {
      const a = copper[i];
      const b = copper[j];
      if (a.kind !== "seg" && b.kind !== "seg") continue;
      if (!sharesLayer(a, b)) continue;
      if (netKey(a.key) === netKey(b.key)) continue;
      const gap = copperGap(a, b);
      if (gap >= -1e-6 && gap < MIN_CLEARANCE) {
        const pair = [netKey(a.key), netKey(b.key)].sort().join("|");
        if (seenPair.has(pair)) continue;
        seenPair.add(pair);
        const pa = a.kind === "seg" ? mid(a.a, a.b) : a.c;
        issues.push({
          code: "clearance",
          severity: "warning",
          message: `Copper gap is ${Math.max(0, gap).toFixed(2)} mm; keep at least ${MIN_CLEARANCE} mm between different nets.`,
          at: { x: pa.x / MM, y: pa.y / MM },
          partIds: [],
        });
      }
    }
  }

  // Sharp trace corners trap etchant.
  for (const t of board.traces) {
    for (let i = 1; i < t.points.length - 1; i++) {
      const [p0, p1, p2] = [t.points[i - 1], t.points[i], t.points[i + 1]];
      const v1 = { x: p0.x - p1.x, y: p0.y - p1.y };
      const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
      const l = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
      if (l === 0) continue;
      const angle = (Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / l))) * 180) / Math.PI;
      if (angle < 89) issues.push({ code: "acute-angle", severity: "warning", message: `Trace bends at ${Math.round(angle)}°. Use 45° or 90° corners.`, at: p1, partIds: [] });
    }
  }

  // Unconnected pins, ignoring the 555 control pin which is normally left alone.
  for (const part of board.parts) {
    for (const pin of PART_DEFS[part.type].pins) {
      if (part.type === "timer555" && pin.id === "5") continue;
      const net = nl.netOf.get(`${part.id}.${pin.id}`);
      if (net !== undefined && nl.nets[net].pins.length === 1) {
        issues.push({ code: "floating-pin", severity: "warning", message: `${part.id} pin ${pin.label} is not connected.`, at: at(part.id), partIds: [part.id] });
      }
    }
  }

  if (!snap) return issues;

  // Electrical checks need the simulation.
  for (const part of board.parts) {
    const st = snap.parts[part.id];
    if (!st) continue;
    if ((sourceOf(part) || part.type === "vcc") && st.stress > 1) {
      issues.push({ code: "short", severity: "error", message: `Short circuit: ${part.id} is pushing ${st.current.toFixed(1)} A.`, at: at(part.id), partIds: [part.id] });
    }
    if (part.type === "led" && (st.burnt || st.stress > 1)) {
      const net = nl.netOf.get(`${part.id}.A`);
      const hasResistor = net !== undefined && nl.nets[net].pins.some((p) => byId.get(p.split(".")[0])?.type === "resistor");
      issues.push({
        code: hasResistor ? "overcurrent" : "no-resistor",
        severity: "error",
        message: hasResistor ? `${part.id} gets too much current. Use a bigger resistor.` : `${part.id} has no current-limiting resistor.`,
        at: at(part.id),
        partIds: [part.id],
      });
    } else if (part.type !== "led" && st.burnt) {
      issues.push({ code: "overcurrent", severity: "error", message: `${part.id} burnt out from overload.`, at: at(part.id), partIds: [part.id] });
    }
    if (st.reversed) issues.push({ code: "reversed", severity: "error", message: `${part.id} is fitted the wrong way round.`, at: at(part.id), partIds: [part.id] });
    if (part.type === "timer555" && !st.burnt) {
      const gnd = snap.netV[nl.netOf.get(`${part.id}.1`) ?? 0] ?? 0;
      const rst = (snap.netV[nl.netOf.get(`${part.id}.4`) ?? 0] ?? 0) - gnd;
      const vs = (snap.netV[nl.netOf.get(`${part.id}.8`) ?? 0] ?? 0) - gnd;
      if (vs > 3 && rst < 0.7) issues.push({ code: "reset-floating", severity: "error", message: `${part.id} RESET is low. Tie pin 4 to VCC.`, at: at(part.id), partIds: [part.id] });
    }
  }

  // Trace width against the current each trace actually carries.
  const flows = traceCurrents(board, nl, snap);
  for (const t of board.traces) {
    const amps = flows.get(t.id) ?? 0;
    const need = requiredTraceWidth(amps);
    if (need > t.width) {
      issues.push({
        code: "trace-width",
        severity: "warning",
        message: `Trace carries ${amps.toFixed(2)} A; it should be at least ${need.toFixed(2)} mm wide.`,
        at: t.points[Math.floor(t.points.length / 2)],
        partIds: [],
      });
    }
  }
  return issues;
}

/**
 * Current in each trace. Within a net the copper is treated as a tree: the current through a link is the sum of the
 * pin currents on its far side. Loops are rare on student boards; their extra links carry no animated current.
 */
export function traceCurrents(board: Board, nl: Netlist, snap: SimSnapshot): Map<string, number> {
  const signed = segmentCurrents(board, nl, snap);
  const out = new Map<string, number>();
  for (const [key, i] of signed) {
    const id = key.split(":")[1];
    out.set(id, Math.max(out.get(id) ?? 0, Math.abs(i)));
  }
  return out;
}

/** Signed current per segment key ("seg:<trace>:<i>"), positive from point i to point i+1. */
export function segmentCurrents(board: Board, nl: Netlist, snap: SimSnapshot): Map<string, number> {
  const out = new Map<string, number>();
  const pinI = (pin: string) => {
    const [pid, ...rest] = pin.split(".");
    return -(snap.parts[pid]?.pinCurrents[rest.join(".")] ?? 0);
  };
  for (const net of nl.nets) {
    const items = net.items;
    const adj: number[][] = items.map(() => []);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (a.kind === "pad" && b.kind === "pad") continue;
        if (!sharesLayer(a, b)) continue;
        if (copperGap(a, b) < -1e-6) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }
    const visited = new Array(items.length).fill(false);
    const parent = new Array(items.length).fill(-1);
    const order: number[] = [];
    for (let s = 0; s < items.length; s++) {
      if (visited[s]) continue;
      visited[s] = true;
      const stack = [s];
      while (stack.length) {
        const u = stack.pop()!;
        order.push(u);
        for (const w of adj[u]) {
          if (!visited[w]) {
            visited[w] = true;
            parent[w] = u;
            stack.push(w);
          }
        }
      }
    }
    // Injection into the copper at each pad: the current that leaves the part into the net.
    const sub = items.map((c) => (c.kind === "pad" ? pinI(c.pin) : 0));
    for (let k = order.length - 1; k >= 0; k--) {
      const u = order[k];
      const p = parent[u];
      if (p < 0) continue;
      const c = items[u];
      const pc = items[p];
      // A segment carries its whole subtree's current on towards its parent.
      if (c.kind === "seg") out.set(c.key, signedAlong(c, pc, sub[u]));
      sub[p] += sub[u];
    }
  }
  return out;
}

/** A segment carries `flow` towards `towards`; return it signed along the segment's a→b direction. */
function signedAlong(seg: Extract<Netlist["copper"][number], { kind: "seg" }>, towards: Netlist["copper"][number], flow: number): number {
  const target = towards.kind === "seg" ? mid(towards.a, towards.b) : towards.c;
  const da = Math.hypot(seg.a.x - target.x, seg.a.y - target.y);
  const db = Math.hypot(seg.b.x - target.x, seg.b.y - target.y);
  return db < da ? flow : -flow;
}
