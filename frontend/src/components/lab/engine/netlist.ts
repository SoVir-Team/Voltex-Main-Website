import { PART_DEFS, pinPositions } from "./parts.ts";
import type { Board, Layer, PinRef, Pt } from "./types.ts";
import { MM } from "./types.ts";

/** Copper on the board, in millimetres. Pads and vias are plated through, so they sit on both layers. */
export type Copper =
  | { kind: "pad"; key: string; pin: PinRef; partId: string; c: Pt; r: number }
  | { kind: "via"; key: string; id: string; c: Pt; r: number }
  | { kind: "seg"; key: string; traceId: string; layer: Layer; a: Pt; b: Pt; r: number };

export const PAD_R = 0.8;
export const VIA_R = 0.45;

export interface Net {
  index: number;
  pins: PinRef[];
  items: Copper[];
}

export interface Netlist {
  nets: Net[];
  /** Pin reference to net index. */
  netOf: Map<PinRef, number>;
  copper: Copper[];
  /** Copper item key to net index (only for nets that reach a pad). */
  itemNet: Map<string, number>;
}

const toMm = (p: Pt): Pt => ({ x: p.x * MM, y: p.y * MM });

export function collectCopper(board: Board): Copper[] {
  const out: Copper[] = [];
  for (const part of board.parts) {
    for (const pin of pinPositions(part)) {
      const pin_ = `${part.id}.${pin.id}`;
      out.push({ kind: "pad", key: `pad:${pin_}`, pin: pin_, partId: part.id, c: toMm(pin), r: PAD_R });
    }
  }
  for (const v of board.vias) out.push({ kind: "via", key: `via:${v.id}`, id: v.id, c: toMm(v), r: VIA_R });
  for (const t of board.traces) {
    for (let i = 0; i < t.points.length - 1; i++) {
      out.push({ kind: "seg", key: `seg:${t.id}:${i}`, traceId: t.id, layer: t.layer, a: toMm(t.points[i]), b: toMm(t.points[i + 1]), r: t.width / 2 });
    }
  }
  return out;
}

export function layersOf(c: Copper): Layer[] {
  return c.kind === "seg" ? [c.layer] : ["top", "bottom"];
}

export function sharesLayer(a: Copper, b: Copper): boolean {
  const la = layersOf(a);
  return layersOf(b).some((l) => la.includes(l));
}

/** Edge-to-edge gap between two copper shapes in mm. Negative or zero means the copper touches. */
export function copperGap(a: Copper, b: Copper): number {
  const sa = a.kind === "seg" ? [a.a, a.b] : [a.c, a.c];
  const sb = b.kind === "seg" ? [b.a, b.b] : [b.c, b.c];
  return segSegDist(sa[0], sa[1], sb[0], sb[1]) - a.r - b.r;
}

export function pointSegDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function cross(o: Pt, a: Pt, b: Pt) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function segSegDist(a: Pt, b: Pt, c: Pt, d: Pt): number {
  const d1 = cross(a, b, c);
  const d2 = cross(a, b, d);
  const d3 = cross(c, d, a);
  const d4 = cross(c, d, b);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(pointSegDist(a, c, d), pointSegDist(b, c, d), pointSegDist(c, a, b), pointSegDist(d, a, b));
}

class UnionFind {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  union(a: number, b: number) {
    this.parent[this.find(a)] = this.find(b);
  }
}

/** Copper that overlaps is one conductor, whether you meant it or not: that is how real shorts happen. */
export function buildNetlist(board: Board): Netlist {
  const copper = collectCopper(board);
  const uf = new UnionFind(copper.length);
  for (let i = 0; i < copper.length; i++) {
    for (let j = i + 1; j < copper.length; j++) {
      const a = copper[i];
      const b = copper[j];
      if (a.kind === "pad" && b.kind === "pad" && a.partId === b.partId) continue;
      if (!sharesLayer(a, b)) continue;
      if (copperGap(a, b) < -1e-6) uf.union(i, j);
    }
  }
  // Power symbols are global labels: every ground is one node, and so is every VCC of the same voltage.
  const types = new Map(board.parts.map((p) => [p.id, p]));
  const labels = new Map<string, number>();
  copper.forEach((c, i) => {
    if (c.kind !== "pad") return;
    const part = types.get(c.partId);
    const key = part?.type === "gnd" ? "gnd" : part?.type === "vcc" ? `vcc:${part.props.value ?? 5}` : null;
    if (!key) return;
    const first = labels.get(key);
    if (first === undefined) labels.set(key, i);
    else uf.union(i, first);
  });
  // Pins joined on the part itself (a board's GND pins) are one node too.
  const padAt = new Map<string, number>();
  copper.forEach((c, i) => c.kind === "pad" && padAt.set(c.pin, i));
  for (const part of board.parts) {
    for (const group of PART_DEFS[part.type].tied ?? []) {
      const idx = group.map((pin) => padAt.get(`${part.id}.${pin}`)).filter((i): i is number => i !== undefined);
      for (const i of idx.slice(1)) uf.union(i, idx[0]);
    }
  }
  const groups = new Map<number, Copper[]>();
  copper.forEach((c, i) => {
    const root = uf.find(i);
    const g = groups.get(root);
    if (g) g.push(c);
    else groups.set(root, [c]);
  });
  const nets: Net[] = [];
  const netOf = new Map<PinRef, number>();
  const itemNet = new Map<string, number>();
  for (const items of groups.values()) {
    const pins = items.flatMap((c) => (c.kind === "pad" ? [c.pin] : []));
    if (pins.length === 0) continue;
    const index = nets.length;
    nets.push({ index, pins, items });
    for (const p of pins) netOf.set(p, index);
    for (const c of items) itemNet.set(c.key, index);
  }
  return { nets, netOf, copper, itemNet };
}

/** True when every listed pin shares one net. */
export function connected(nl: Netlist, pins: PinRef[]): boolean {
  const first = nl.netOf.get(pins[0]);
  return first !== undefined && pins.every((p) => nl.netOf.get(p) === first);
}

/** Net of the copper under a board point (grid units), if that copper reaches a pad. */
export function netAt(nl: Netlist, p: Pt): number | undefined {
  const mm = { x: p.x * MM, y: p.y * MM };
  for (const c of nl.copper) {
    const d = c.kind === "seg" ? pointSegDist(mm, c.a, c.b) : Math.hypot(mm.x - c.c.x, mm.y - c.c.y);
    if (d <= c.r + 0.35) {
      const n = nl.itemNet.get(c.key);
      if (n !== undefined) return n;
    }
  }
  return undefined;
}
