import { MIN_CLEARANCE } from "./drc.ts";
import { layersOf, netAt, pointSegDist, type Copper, type Netlist } from "./netlist.ts";
import { MM, type Board, type Layer, type Pt } from "./types.ts";

/**
 * Walk-around routing for one trace leg, like the interactive router in a real PCB tool. Searches the half grid in
 * eight directions for the shortest path that keeps design-rule clearance from copper on other nets. Copper on the
 * leg's own nets is free to touch. Sharp turns cost extra, and acute ones (which the DRC flags) cost a lot.
 * Returns the corner points after `from`, ending at `to`, or null when no clean path exists.
 */
export function routeLeg(from: Pt, to: Pt, board: Board, nl: Netlist, layer: Layer, widthMm: number): Pt[] | null {
  const own = new Set([netAt(nl, from), netAt(nl, to)].filter((n) => n !== undefined));
  const near = (c: Copper, p: Pt) => (c.kind === "seg" ? pointSegDist(p, c.a, c.b) : Math.hypot(p.x - c.c.x, p.y - c.c.y)) - c.r;
  const fromMm = { x: from.x * MM, y: from.y * MM };
  const toMm = { x: to.x * MM, y: to.y * MM };
  const blockers = nl.copper.filter((c) => {
    if (!layersOf(c).includes(layer)) return false;
    const n = nl.itemNet.get(c.key);
    if (n !== undefined && own.has(n)) return false;
    return near(c, fromMm) > 0.05 && near(c, toMm) > 0.05;
  });
  const keep = widthMm / 2 + MIN_CLEARANCE;
  const S = 0.5;
  const W = Math.round(board.w / S);
  const H = Math.round(board.h / S);
  const si = Math.round(from.x / S), sj = Math.round(from.y / S);
  const ti = Math.round(to.x / S), tj = Math.round(to.y / S);
  if (si === ti && sj === tj) return [to];

  const freeCache = new Map<number, boolean>();
  const free = (x: number, y: number) => {
    const key = Math.round(x * 4) * 100000 + Math.round(y * 4);
    let ok = freeCache.get(key);
    if (ok === undefined) {
      const p = { x: x * MM, y: y * MM };
      ok = blockers.every((c) => near(c, p) >= keep);
      freeCache.set(key, ok);
    }
    return ok;
  };

  // A target inside another net's clearance can never be reached cleanly: say so now instead of searching the board.
  if (ti < 1 || tj < 1 || ti > W - 1 || tj > H - 1 || !free(to.x, to.y)) return null;

  const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const turnCost = [0, 0.15, 0.6, 50, 50];
  const h = (i: number, j: number) => {
    const dx = Math.abs(i - ti), dy = Math.abs(j - tj);
    return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * S;
  };
  const id = (i: number, j: number, d: number) => ((j * (W + 1) + i) << 3) | d;
  const best = new Map<number, number>();
  const prev = new Map<number, number>();
  // Small binary heap of [f, g, state].
  const heap: [number, number, number][] = [];
  const push = (e: [number, number, number]) => {
    heap.push(e);
    for (let k = heap.length - 1; k > 0; ) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ; ) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };

  for (let d = 0; d < 8; d++) {
    const s = id(si, sj, d);
    best.set(s, 0);
    push([h(si, sj), 0, s]);
  }
  let goal = -1;
  for (let guard = 0; heap.length && guard < 200000; guard++) {
    const [, g, s] = pop();
    if (g > (best.get(s) ?? Infinity)) continue;
    const d = s & 7;
    const cell = s >> 3;
    const i = cell % (W + 1), j = Math.floor(cell / (W + 1));
    if (i === ti && j === tj) {
      goal = s;
      break;
    }
    for (let nd = 0; nd < 8; nd++) {
      const turn = Math.min((nd - d + 8) % 8, (d - nd + 8) % 8);
      const atStart = i === si && j === sj;
      if (!atStart && turn >= 3) continue;
      const [dx, dy] = DIRS[nd];
      const ni = i + dx, nj = j + dy;
      if (ni < 1 || nj < 1 || ni > W - 1 || nj > H - 1) continue;
      const goalCell = ni === ti && nj === tj;
      if (!goalCell && !free(ni * S, nj * S)) continue;
      if (!free((i + ni) * S / 2, (j + nj) * S / 2)) continue;
      const ng = g + (dx && dy ? Math.SQRT2 : 1) * S + (atStart ? 0 : turnCost[turn]);
      const ns = id(ni, nj, nd);
      if (ng < (best.get(ns) ?? Infinity)) {
        best.set(ns, ng);
        prev.set(ns, s);
        push([ng + h(ni, nj), ng, ns]);
      }
    }
  }
  if (goal < 0) return null;

  const cells: Pt[] = [];
  for (let s: number | undefined = goal; s !== undefined; s = prev.get(s)) {
    const cell = s >> 3;
    cells.push({ x: (cell % (W + 1)) * S, y: Math.floor(cell / (W + 1)) * S });
  }
  cells.reverse();
  cells[cells.length - 1] = to;
  // Keep only the corners.
  const out: Pt[] = [];
  for (let k = 1; k < cells.length; k++) {
    const a = cells[k - 1], b = cells[k], c = cells[k + 1];
    if (!c || Math.sign(b.x - a.x) !== Math.sign(c.x - b.x) || Math.sign(b.y - a.y) !== Math.sign(c.y - b.y)) out.push(b);
  }
  return out;
}
