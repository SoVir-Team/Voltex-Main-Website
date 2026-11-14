import { MISSIONS, type Mission } from "../engine/missions.ts";
import { PROJECTS } from "../engine/projects.ts";
import { newPartId } from "../engine/parts.ts";
import { defaultProperties, validateProperties } from "../engine/properties.ts";
import { offsetFragment, placementError, type CircuitFragment } from "../engine/clipboard.ts";
import type { Board, Layer, Part, PartProps, PartType, PinRef, Pt, Rot } from "../engine/types.ts";

export type Tool = "select" | "trace" | "via" | "probe" | "delete";
export type Mode = { kind: "mission"; index: number } | { kind: "project"; index: number } | { kind: "sandbox" };
export type Selection = { kind: "part" | "trace" | "via" | "all"; id: string } | null;
type Routing = { points: Pt[]; layer: Layer } | null;

export interface LabState {
  board: Board;
  past: Board[];
  future: Board[];
  mode: Mode;
  tool: Tool;
  layer: Layer;
  width: number;
  selection: Selection;
  clipboard: CircuitFragment | null;
  pasting: boolean;
  clipboardMessage: string;
  routing: Routing;
  /** Draft checkpoints correspond to routing clicks, including auto-generated bends. */
  routePast: Routing[];
  routeFuture: Routing[];
  placing: PartType | null;
  powered: boolean;
  ambient: number;
  probed: PinRef[];
  fabSent: boolean;
  completed: string[];
  view: "design" | "fab";
  /** Boards saved per mode, so switching missions keeps work. */
  saved: Record<string, Board>;
}

export type Action =
  | { type: "copy"; all?: boolean }
  | { type: "paste-start" }
  | { type: "paste-place"; at: Pt }
  | { type: "mode"; mode: Mode }
  | { type: "tool"; tool: Tool }
  | { type: "layer"; layer?: Layer }
  | { type: "width"; width: number }
  | { type: "select"; selection: Selection }
  | { type: "placing"; part: PartType | null }
  | { type: "place"; part: PartType; at: Pt }
  | { type: "begin-edit" }
  | { type: "move"; id: string; at: Pt }
  | { type: "rotate"; id: string }
  | { type: "props"; id: string; props: PartProps; history?: boolean }
  | { type: "delete"; selection: NonNullable<Selection> }
  | { type: "route-start"; at: Pt }
  | { type: "route-add"; points: Pt[] }
  | { type: "route-finish"; points?: Pt[] }
  | { type: "route-undo" }
  | { type: "route-via" }
  | { type: "route-cancel" }
  | { type: "via"; at: Pt }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "power"; on?: boolean }
  | { type: "ambient"; value: number }
  | { type: "probe"; pins: PinRef[] }
  | { type: "fab"; sent: boolean }
  | { type: "view"; view: LabState["view"] }
  | { type: "complete"; id: string }
  | { type: "reset" };

export const TRACE_WIDTHS = [0.25, 0.4, 0.8, 1.5];

export function activeMission(m: Mode): Mission | null {
  if (m.kind === "mission") return MISSIONS[m.index] ?? null;
  if (m.kind === "project") return PROJECTS[m.index] ?? null;
  return null;
}
export const trackOf = (m: Mode) => (m.kind === "project" ? PROJECTS : MISSIONS);

export const modeKey = (m: Mode) => activeMission(m)?.id ?? "sandbox";

// 127 × 76 mm: room for the largest board in the Parts list, the Arduino Mega 2560 (101.6 × 53.3 mm).
export const SANDBOX_BOARD: Board = { w: 50, h: 30, parts: [], traces: [], vias: [] };

export function starterBoard(mode: Mode): Board {
  return structuredClone(activeMission(mode)?.board ?? SANDBOX_BOARD);
}

export function initialState(): LabState {
  const mode: Mode = { kind: "mission", index: 0 };
  return {
    board: starterBoard(mode),
    past: [],
    future: [],
    mode,
    tool: "trace",
    layer: "top",
    width: 0.4,
    selection: null,
    clipboard: null,
    pasting: false,
    clipboardMessage: "",
    routing: null,
    routePast: [],
    routeFuture: [],
    placing: null,
    powered: false,
    ambient: 0.6,
    probed: [],
    fabSent: false,
    completed: [],
    view: "design",
    saved: {},
  };
}

let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

const samePt = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;

/** Drop repeated points and merge straight runs, so a trace is its corners only. */
export function simplify(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    if (out.length && samePt(out[out.length - 1], p)) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      const forward = (b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) > 0;
      if (Math.abs(cross) < 1e-9 && forward) out[out.length - 1] = p;
      else out.push(p);
    } else out.push(p);
  }
  return out;
}

/** 45° router: diagonal first, then straight. */
export function bend(from: Pt, to: Pt): Pt[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.min(Math.abs(dx), Math.abs(dy));
  const mid = { x: from.x + Math.sign(dx) * d, y: from.y + Math.sign(dy) * d };
  return samePt(mid, from) || samePt(mid, to) ? [to] : [mid, to];
}

function commit(s: LabState, board: Board, extra: Partial<LabState> = {}): LabState {
  return { ...s, ...extra, board, past: [...s.past.slice(-60), s.board], future: [], routePast: [], routeFuture: [], fabSent: false };
}

export const canUndo = (s: LabState) => s.routing !== null || s.past.length > 0;
export const canRedo = (s: LabState) => s.routeFuture.length > 0 || (s.routing === null && s.future.length > 0);

function updatePart(board: Board, id: string, f: (p: Part) => Part): Board {
  return { ...board, parts: board.parts.map((p) => (p.id === id ? f(p) : p)) };
}

export function reducer(s: LabState, a: Action): LabState {
  switch (a.type) {
    case "copy": {
      const all = a.all || s.selection?.kind === "all";
      const fragment = all ? s.board : {
        parts: s.board.parts.filter((p) => s.selection?.kind === "part" && p.id === s.selection.id),
        traces: s.board.traces.filter((t) => s.selection?.kind === "trace" && t.id === s.selection.id),
        vias: s.board.vias.filter((v) => s.selection?.kind === "via" && v.id === s.selection.id),
      };
      if (!fragment.parts.length && !fragment.traces.length && !fragment.vias.length) return { ...s, clipboardMessage: "Select a component or copy all first." };
      return { ...s, clipboard: structuredClone({ parts: fragment.parts, traces: fragment.traces, vias: fragment.vias }), clipboardMessage: "Copied. Choose Paste, then click the board." };
    }
    case "paste-start": {
      if (!s.clipboard) return s;
      const mission = activeMission(s.mode);
      if (mission && s.clipboard.parts.some((p) => !mission.palette.includes(p.type))) return { ...s, clipboardMessage: "This mission does not allow those components. Paste them in Free build." };
      return { ...s, pasting: true, placing: null, routing: null, routePast: [], routeFuture: [], tool: "select", clipboardMessage: "Click the board to paste · Esc to cancel" };
    }
    case "paste-place": {
      if (!s.pasting || !s.clipboard) return s;
      const fragment = offsetFragment(s.clipboard, a.at);
      const error = placementError(s.board, fragment);
      if (error) return { ...s, clipboardMessage: error };
      const parts = [...s.board.parts];
      for (const part of fragment.parts) parts.push({ ...part, id: newPartId(part.type, parts) });
      return commit(s, {
        ...s.board, parts,
        traces: [...s.board.traces, ...fragment.traces.map((t) => ({ ...t, id: uid("t") }))],
        vias: [...s.board.vias, ...fragment.vias.map((v) => ({ ...v, id: uid("v") }))],
      }, { pasting: false, selection: null, clipboardMessage: "Pasted. Paste again to place another copy." });
    }
    case "mode": {
      const saved = { ...s.saved, [modeKey(s.mode)]: s.board };
      const board = saved[modeKey(a.mode)] ?? starterBoard(a.mode);
      return { ...s, saved, mode: a.mode, board, pasting: false, clipboardMessage: "", past: [], future: [], routePast: [], routeFuture: [], selection: null, routing: null, placing: null, powered: false, probed: [], fabSent: false, view: "design", tool: a.mode.kind === "sandbox" ? "select" : "trace" };
    }
    case "tool":
      return { ...s, tool: a.tool, routing: null, routePast: [], routeFuture: [], placing: null, pasting: false, clipboardMessage: "" };
    case "layer": {
      const layer = a.layer ?? (s.layer === "top" ? "bottom" : "top");
      if (layer === s.layer) return s;
      return { ...s, layer, routing: s.routing ? { ...s.routing, layer } : null, routePast: s.routing ? [...s.routePast, s.routing] : [], routeFuture: [] };
    }
    case "width":
      return { ...s, width: a.width };
    case "select":
      return { ...s, selection: a.selection };
    case "placing":
      return { ...s, placing: a.part, pasting: false, routing: null, routePast: [], routeFuture: [] };
    case "place": {
      const id = newPartId(a.part, s.board.parts);
      const part: Part = { id, type: a.part, x: Math.round(a.at.x), y: Math.round(a.at.y), rot: 0, props: defaultProperties(a.part) };
      return commit(s, { ...s.board, parts: [...s.board.parts, part] }, { selection: { kind: "part", id }, placing: null, tool: "select" });
    }
    case "begin-edit":
      return { ...s, past: [...s.past.slice(-60), s.board], future: [], fabSent: false };
    case "move":
      return { ...s, board: updatePart(s.board, a.id, (p) => ({ ...p, x: Math.round(a.at.x), y: Math.round(a.at.y) })) };
    case "rotate":
      return commit(s, updatePart(s.board, a.id, (p) => ({ ...p, rot: (((p.rot + 90) % 360) as Rot) })));
    case "props": {
      const part = s.board.parts.find((p) => p.id === a.id);
      if (!part || validateProperties(part, a.props)) return s;
      const board = updatePart(s.board, a.id, (p) => ({ ...p, props: { ...p.props, ...a.props } }));
      return a.history === false ? { ...s, board } : commit(s, board);
    }
    case "delete": {
      const { kind, id } = a.selection;
      if (kind === "all") return commit(s, { ...s.board, parts: [], traces: [], vias: [] }, { selection: null });
      const board: Board = {
        ...s.board,
        parts: kind === "part" ? s.board.parts.filter((p) => p.id !== id) : s.board.parts,
        traces: kind === "trace" ? s.board.traces.filter((t) => t.id !== id) : s.board.traces,
        vias: kind === "via" ? s.board.vias.filter((v) => v.id !== id) : s.board.vias,
      };
      return commit(s, board, { selection: null });
    }
    case "route-start":
      return { ...s, routing: { points: [a.at], layer: s.layer }, routePast: [null], routeFuture: [], selection: null };
    case "route-add":
      if (!s.routing) return s;
      return { ...s, routing: { ...s.routing, points: simplify([...s.routing.points, ...a.points]) }, routePast: [...s.routePast, s.routing], routeFuture: [] };
    case "route-undo": {
      if (!s.routing) return s;
      return reducer(s, { type: "undo" });
    }
    case "route-finish": {
      if (!s.routing) return s;
      const points = simplify([...s.routing.points, ...(a.points ?? [])]);
      if (points.length < 2) return { ...s, routing: null, routePast: [], routeFuture: [] };
      const trace = { id: uid("t"), layer: s.routing.layer, width: s.width, points };
      return commit(s, { ...s.board, traces: [...s.board.traces, trace] }, { routing: null });
    }
    case "route-via": {
      // Finish the copper so far, drop a via, and carry on from it on the other layer.
      if (!s.routing) return s;
      const points = simplify(s.routing.points);
      const at = points[points.length - 1];
      const layer: Layer = s.routing.layer === "top" ? "bottom" : "top";
      const traces = points.length >= 2 ? [...s.board.traces, { id: uid("t"), layer: s.routing.layer, width: s.width, points }] : s.board.traces;
      const vias = s.board.vias.some((v) => samePt(v, at)) ? s.board.vias : [...s.board.vias, { id: uid("v"), x: at.x, y: at.y }];
      return commit(s, { ...s.board, traces, vias }, { routing: { points: [at], layer }, layer });
    }
    case "route-cancel":
      return { ...s, routing: null, routePast: [], routeFuture: [], placing: null, pasting: false, clipboardMessage: "" };
    case "via":
      if (s.board.vias.some((v) => samePt(v, a.at))) return s;
      return commit(s, { ...s.board, vias: [...s.board.vias, { id: uid("v"), x: a.at.x, y: a.at.y }] });
    case "undo": {
      if (s.routing && (s.routePast.length || !s.past.length)) {
        const routing = s.routePast[s.routePast.length - 1] ?? null;
        return { ...s, routing, layer: routing?.layer ?? s.layer, routePast: s.routePast.slice(0, -1), routeFuture: [s.routing, ...s.routeFuture] };
      }
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return { ...s, board: prev, past: s.past.slice(0, -1), future: [s.board, ...s.future], selection: null, routing: null, routePast: [], routeFuture: [], placing: null, pasting: false, fabSent: false, clipboardMessage: "" };
    }
    case "redo": {
      if (s.routeFuture.length) {
        const routing = s.routeFuture[0];
        return { ...s, routing, layer: routing?.layer ?? s.layer, routePast: [...s.routePast, s.routing], routeFuture: s.routeFuture.slice(1) };
      }
      if (s.routing) return s;
      const next = s.future[0];
      if (!next) return s;
      return { ...s, board: next, future: s.future.slice(1), past: [...s.past, s.board], selection: null, routing: null, routePast: [], routeFuture: [], placing: null, pasting: false, fabSent: false, clipboardMessage: "" };
    }
    case "power":
      return { ...s, powered: a.on ?? !s.powered };
    case "ambient":
      return { ...s, ambient: a.value };
    case "probe":
      return { ...s, probed: [...new Set([...s.probed, ...a.pins])] };
    case "fab":
      return { ...s, fabSent: a.sent, view: a.sent ? "fab" : s.view };
    case "view":
      return { ...s, view: a.view };
    case "complete":
      return s.completed.includes(a.id) ? s : { ...s, completed: [...s.completed, a.id] };
    case "reset":
      return commit(s, starterBoard(s.mode), { pasting: false, selection: null, routing: null, powered: false, probed: [] });
  }
}

const STORAGE = "voltex-lab-v1";

export function loadState(): LabState {
  const base = initialState();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(STORAGE);
    if (!raw) return base;
    const data = JSON.parse(raw) as { mode: Mode; saved: Record<string, Board>; completed: string[] };
    const mode = data.mode.kind !== "sandbox" && !activeMission(data.mode) ? base.mode : data.mode;
    const saved = data.saved ?? {};
    return { ...base, mode, saved, completed: data.completed ?? [], board: saved[modeKey(mode)] ?? starterBoard(mode), tool: mode.kind === "sandbox" ? "select" : "trace" };
  } catch {
    return base;
  }
}

export function saveState(s: LabState) {
  try {
    const saved = { ...s.saved, [modeKey(s.mode)]: s.board };
    window.localStorage.setItem(STORAGE, JSON.stringify({ mode: s.mode, saved, completed: s.completed }));
  } catch {
    // Storage full or blocked: the lab still works, it just won't remember.
  }
}
