"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type PointerEvent as RPointerEvent, type RefObject } from "react";
import { segmentCurrents, type DrcIssue } from "../engine/drc.ts";
import { VIA_R, netAt, pointSegDist, type Netlist } from "../engine/netlist.ts";
import { routeLeg } from "../engine/router.ts";
import { partBox, pinPositions } from "../engine/parts.ts";
import type { SimSnapshot } from "../engine/solver.ts";
import type { Board, Part, Pt } from "../engine/types.ts";
import { MM } from "../engine/types.ts";
import { bend, type Action, type LabState } from "../state/store.ts";
import { PartGlyph, SKIN } from "./PartGlyph.tsx";

export type Hit = { kind: "part"; part: Part } | { kind: "trace"; id: string } | { kind: "via"; id: string } | null;

export interface ProbeReading {
  at: Pt;
  label: string;
  value: string;
}

const half = (v: number) => Math.round(v * 2) / 2;

function pinAt(board: Board, p: Pt): Pt | null {
  let best: Pt | null = null;
  let d = 0.55;
  for (const part of board.parts) {
    for (const pin of pinPositions(part)) {
      const dd = Math.hypot(pin.x - p.x, pin.y - p.y);
      if (dd < d) {
        d = dd;
        best = { x: pin.x, y: pin.y };
      }
    }
  }
  return best;
}

function hitTest(board: Board, p: Pt): Hit {
  for (const v of board.vias) if (Math.hypot(v.x - p.x, v.y - p.y) < 0.4) return { kind: "via", id: v.id };
  for (const t of [...board.traces].reverse()) {
    for (let i = 0; i < t.points.length - 1; i++) {
      if (pointSegDist(p, t.points[i], t.points[i + 1]) < Math.max(0.3, t.width / MM / 2 + 0.12)) return { kind: "trace", id: t.id };
    }
  }
  for (const part of [...board.parts].reverse()) {
    const b = partBox(part);
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return { kind: "part", part };
  }
  return null;
}

/** Which net a point of copper belongs to, if any. */

export function fmtV(v: number) {
  return `${v.toFixed(Math.abs(v) < 10 ? 2 : 1)} V`;
}
export function fmtA(i: number) {
  const a = Math.abs(i);
  if (a >= 1) return `${a.toFixed(2)} A`;
  if (a >= 1e-3) return `${(a * 1e3).toFixed(1)} mA`;
  return `${(a * 1e6).toFixed(0)} µA`;
}

export function BoardCanvas({
  state,
  dispatch,
  snap,
  netlist,
  guides,
  focus,
  hotParts,
  marks,
  onIssue,
  svgRef,
  onPress,
  onProbe,
  onTraceDone,
  onBlocked,
}: {
  state: LabState;
  dispatch: Dispatch<Action>;
  snap: SimSnapshot | null;
  netlist: Netlist;
  guides: [Pt, Pt][];
  focus: Pt | null;
  hotParts: Set<string>;
  /** Problems found by the last Check, marked on the board. */
  marks: DrcIssue[];
  onIssue: (issue: DrcIssue) => void;
  svgRef: RefObject<SVGSVGElement | null>;
  onPress: (id: string, down: boolean) => void;
  onProbe: (r: ProbeReading | null, pins: string[]) => void;
  onTraceDone: () => void;
  /** The router found no clean path for a leg, so it was drawn straight and may short. */
  onBlocked: (at: Pt) => void;
}) {
  const { board, view } = state;
  const skin = SKIN[view];
  // Overlay ink: dark on the white design sheet, white on the green fab board.
  const ink = view === "fab" ? "#ffffff" : "#1d1d40";
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [panning, setPanning] = useState(false);
  const [vb, setVb] = useState(() => ({ x: -2, y: -2, w: board.w + 4, h: board.h + 4 }));
  const drag = useRef<{ kind: "part"; id: string; dx: number; dy: number; moved: boolean } | { kind: "pan"; sx: number; sy: number; vx: number; vy: number } | { kind: "press"; id: string } | null>(null);
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef<{ d: number; vb: typeof vb } | null>(null);

  const toGrid = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const flows = useMemo(() => (snap ? segmentCurrents(board, netlist, snap) : new Map<string, number>()), [snap, board, netlist]);

  const route = (from: Pt, to: Pt) => routeLeg(from, to, board, netlist, state.routing?.layer ?? state.layer, state.width);
  const snapRoute = (p: Pt): Pt => pinAt(board, p) ?? { x: half(p.x), y: half(p.y) };

  function onDown(e: RPointerEvent<SVGSVGElement>) {
    const p = toGrid(e);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), vb };
      drag.current = null;
      return;
    }
    if (e.button === 1 || e.button === 2) {
      drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: vb.x, vy: vb.y };
      return;
    }
    if (state.placing) {
      dispatch({ type: "place", part: state.placing, at: p });
      return;
    }
    const hit = hitTest(board, p);
    switch (state.tool) {
      case "trace": {
        const q = snapRoute(p);
        if (!state.routing) {
          dispatch({ type: "route-start", at: q });
        } else {
          const last = state.routing.points[state.routing.points.length - 1];
          if (last.x === q.x && last.y === q.y) {
            dispatch({ type: "route-finish" });
            onTraceDone();
            return;
          }
          const routed = route(last, q);
          if (!routed) onBlocked(q);
          const pts = routed ?? bend(last, q);
          const onPin = pinAt(board, p) !== null;
          const start = state.routing.points[0];
          const onCopper = netAt(netlist, q) !== undefined && !(q.x === start.x && q.y === start.y);
          if (onPin || onCopper) {
            dispatch({ type: "route-finish", points: pts });
            onTraceDone();
          } else dispatch({ type: "route-add", points: pts });
        }
        return;
      }
      case "via":
        dispatch({ type: "via", at: { x: half(p.x), y: half(p.y) } });
        return;
      case "probe": {
        if (!snap) {
          onProbe({ at: p, label: "Power is off", value: "—" }, []);
          return;
        }
        const net = netAt(netlist, p);
        if (net !== undefined) {
          onProbe({ at: p, label: "Voltage", value: fmtV(snap.netV[net]) }, netlist.nets[net].pins);
          return;
        }
        if (hit?.kind === "part") {
          const st = snap.parts[hit.part.id];
          onProbe({ at: p, label: `${hit.part.id} current`, value: st ? `${fmtA(st.current)} · ${(st.power * 1000).toFixed(0)} mW` : "—" }, []);
          return;
        }
        onProbe(null, []);
        return;
      }
      case "delete":
        if (hit) dispatch({ type: "delete", selection: hit.kind === "part" ? { kind: "part", id: hit.part.id } : hit });
        return;
      case "select": {
        if (hit?.kind === "part") {
          if (state.powered && hit.part.type === "button") {
            onPress(hit.part.id, true);
            drag.current = { kind: "press", id: hit.part.id };
            return;
          }
          if (state.powered && (hit.part.type === "switch" || hit.part.type === "spdt")) {
            dispatch({ type: "props", id: hit.part.id, props: { closed: !hit.part.props.closed }, history: false });
            return;
          }
          dispatch({ type: "select", selection: { kind: "part", id: hit.part.id } });
          drag.current = { kind: "part", id: hit.part.id, dx: p.x - hit.part.x, dy: p.y - hit.part.y, moved: false };
          return;
        }
        if (hit) {
          dispatch({ type: "select", selection: hit });
          return;
        }
        dispatch({ type: "select", selection: null });
        drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: vb.x, vy: vb.y };
        setPanning(true);
      }
    }
  }

  function onMove(e: RPointerEvent<SVGSVGElement>) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const k = pinch.current.d / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const o = pinch.current.vb;
      const w = Math.min(120, Math.max(6, o.w * k));
      const h = (o.h * w) / o.w;
      setVb({ x: o.x + (o.w - w) / 2, y: o.y + (o.h - h) / 2, w, h });
      return;
    }
    const p = toGrid(e);
    setCursor(p);
    const d = drag.current;
    if (!d) return;
    if (d.kind === "part") {
      const part = board.parts.find((q) => q.id === d.id);
      if (!part) return;
      const nx = Math.round(p.x - d.dx);
      const ny = Math.round(p.y - d.dy);
      if (nx === part.x && ny === part.y) return;
      if (!d.moved) {
        dispatch({ type: "begin-edit" });
        d.moved = true;
      }
      dispatch({ type: "move", id: d.id, at: { x: nx, y: ny } });
    } else if (d.kind === "pan") {
      const svg = svgRef.current;
      if (!svg) return;
      const scale = vb.w / svg.clientWidth;
      setVb((v) => ({ ...v, x: d.vx - (e.clientX - d.sx) * scale, y: d.vy - (e.clientY - d.sy) * scale }));
    }
  }

  function onUp(e: RPointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    if (d?.kind === "press") onPress(d.id, false);
    drag.current = null;
    setPanning(false);
  }

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      const k = Math.exp(e.deltaY * 0.0015);
      setVb((v) => {
        const w = Math.min(120, Math.max(6, v.w * k));
        const s = w / v.w;
        return { x: p.x - (p.x - v.x) * s, y: p.y - (p.y - v.y) * s, w, h: v.h * s };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [svgRef]);

  // The preview reroutes only when the snapped target moves to another half-grid point, not on every pixel.
  const target = state.routing && cursor ? snapRoute(cursor) : null;
  const tx = target?.x;
  const ty = target?.y;
  const routing = state.routing;
  const routingPreview = useMemo(() => {
    if (!routing || tx === undefined || ty === undefined) return null;
    const last = routing.points[routing.points.length - 1];
    const to = { x: tx, y: ty };
    return [...routing.points, ...(routeLeg(last, to, board, netlist, routing.layer, state.width) ?? bend(last, to))];
  }, [routing, tx, ty, board, netlist, state.width]);
  const layerColor = (l: "top" | "bottom") => (l === "top" ? skin.top : skin.bottom);
  const activeFirst = state.layer === "top" ? (["bottom", "top"] as const) : (["top", "bottom"] as const);

  const cursorClass =
    state.placing || state.tool === "trace" || state.tool === "via" ? "cursor-crosshair" : state.tool === "probe" ? "cursor-help" : state.tool === "delete" ? "cursor-not-allowed" : panning ? "cursor-grabbing" : "cursor-default";

  return (
    <svg
      ref={svgRef}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className={`block h-full w-full touch-none select-none ${cursorClass}`}
      role="application"
      aria-label={`Circuit board, ${board.parts.length} parts and ${board.traces.length} traces. Use the toolbar or keyboard shortcuts to edit.`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => setCursor(null)}
      onDoubleClick={() => {
        if (state.routing) {
          dispatch({ type: "route-finish" });
          onTraceDone();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <pattern id="lab-dots" width={1} height={1} patternUnits="userSpaceOnUse">
          <circle cx={0} cy={0} r={0.06} fill={skin.grid} />
        </pattern>
        <filter id="lab-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation={0.6} />
        </filter>
      </defs>
      <rect x={0} y={0} width={board.w} height={board.h} rx={0.6} fill={skin.board} stroke={skin.outline} strokeWidth={0.15} />
      {view === "design" && <rect x={0} y={0} width={board.w} height={board.h} fill="url(#lab-dots)" pointerEvents="none" />}

      {activeFirst.map((layer) => (
        <g key={layer} opacity={view === "fab" ? 1 : layer === state.layer ? 1 : 0.42}>
          {board.traces
            .filter((t) => t.layer === layer)
            .map((t) => {
              const sel = state.selection?.kind === "trace" && state.selection.id === t.id;
              return (
                <polyline
                  key={t.id}
                  points={t.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={sel ? (view === "fab" ? "#ffffff" : "#7c3aed") : layerColor(layer)}
                  strokeWidth={t.width / MM}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
        </g>
      ))}

      {board.vias.map((v) => (
        <g key={v.id}>
          <circle cx={v.x} cy={v.y} r={VIA_R / MM} fill={skin.pad} stroke={state.selection?.id === v.id ? ink : "none"} strokeWidth={0.08} />
          <circle cx={v.x} cy={v.y} r={0.2 / MM} fill={skin.drill} />
        </g>
      ))}

      {board.parts.map((p) => (
        <PartGlyph key={p.id} part={p} st={snap?.parts[p.id]} skin={skin} view={view} selected={state.selection?.kind === "part" && state.selection.id === p.id} hot={hotParts.has(p.id)} />
      ))}

      {/* Current flowing in the copper: dash speed follows the current. */}
      {view === "design" &&
        snap &&
        netlist.copper.map((c) => {
          if (c.kind !== "seg") return null;
          const i = flows.get(c.key) ?? 0;
          if (Math.abs(i) < 2e-4) return null;
          const dur = Math.max(0.25, Math.min(3.5, 0.9 * (0.02 / Math.abs(i)) ** 0.35));
          return (
            <line
              key={c.key}
              x1={c.a.x / MM}
              y1={c.a.y / MM}
              x2={c.b.x / MM}
              y2={c.b.y / MM}
              stroke={ink}
              strokeOpacity={0.75}
              strokeWidth={Math.min(0.18, c.r / MM)}
              strokeLinecap="round"
              strokeDasharray="0.08 0.92"
              className="lab-flow"
              style={{ animationDuration: `${dur}s`, animationDirection: i < 0 ? "reverse" : "normal" }}
              pointerEvents="none"
            />
          );
        })}

      {/* Fab view: one pass of light across the solder mask, clipped to the board. */}
      {view === "fab" && (
        <g clipPath="url(#lab-board-clip)" pointerEvents="none">
          <clipPath id="lab-board-clip">
            <rect x={0} y={0} width={board.w} height={board.h} rx={0.6} />
          </clipPath>
          <rect className="lab-sweep" x={-board.w * 0.3} y={-board.h * 0.2} width={board.w * 0.22} height={board.h * 1.4} fill="#fff" opacity={0.14} />
        </g>
      )}

      {/* Ratsnest: connections the schematic wants but the copper doesn't make yet. */}
      {view === "design" &&
        guides.map(([a, b], i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#4d5175" strokeOpacity={0.7} strokeWidth={0.07} strokeDasharray="0.25 0.2" pointerEvents="none" />)}

      {routingPreview && (
        <polyline
          points={routingPreview.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={layerColor(state.routing!.layer)}
          strokeOpacity={0.75}
          strokeWidth={state.width / MM}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
      {cursor && (state.tool === "trace" || state.tool === "via") && !state.placing && (
        <circle cx={snapRoute(cursor).x} cy={snapRoute(cursor).y} r={0.22} fill="none" stroke={ink} strokeWidth={0.06} pointerEvents="none" />
      )}
      {state.placing && cursor && (
        <g opacity={0.6} pointerEvents="none">
          <PartGlyph part={{ id: "?", type: state.placing, x: Math.round(cursor.x), y: Math.round(cursor.y), rot: 0, props: {} }} skin={skin} view="design" selected={false} />
        </g>
      )}
      {/* Check results: a ring around each part with a problem and a badge to click for the details. */}
      {marks.map((d, k) => {
        const colour = d.severity === "error" ? "#d42a2a" : "#c27400";
        const boxes = d.partIds.flatMap((id) => {
          const p = board.parts.find((q) => q.id === id);
          return p ? [partBox(p)] : [];
        });
        const at = boxes.length ? { x: boxes[0].x + boxes[0].w + 0.2, y: boxes[0].y - 0.2 } : d.at;
        const nth = marks.slice(0, k).filter((o) => o.partIds[0] !== undefined && o.partIds[0] === d.partIds[0]).length;
        return (
          <g key={`${d.code}-${k}`}>
            {boxes.map((b, i) => (
              <rect key={i} x={b.x - 0.3} y={b.y - 0.3} width={b.w + 0.6} height={b.h + 0.6} rx={0.4} fill={colour} fillOpacity={0.06} stroke={colour} strokeWidth={0.12} strokeDasharray={d.severity === "error" ? undefined : "0.4 0.25"} pointerEvents="none" />
            ))}
            {!boxes.length && <circle cx={at.x} cy={at.y} r={0.9} fill="none" stroke={colour} strokeWidth={0.12} pointerEvents="none" />}
            <g
              className="cursor-pointer"
              role="button"
              aria-label={`${d.severity}: ${d.message}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                onIssue(d);
              }}
            >
              <title>{d.message}</title>
              <circle cx={at.x + nth * 0.95} cy={at.y} r={0.42} fill={colour} stroke="#fff" strokeWidth={0.08} />
              <text x={at.x + nth * 0.95} y={at.y} fontSize={0.6} fontWeight={800} fill="#fff" textAnchor="middle" dominantBaseline="central">
                {d.severity === "error" ? "!" : "?"}
              </text>
            </g>
          </g>
        );
      })}
      {focus && <circle cx={focus.x} cy={focus.y} r={1.6} fill="none" stroke="#ff6b4a" strokeWidth={0.15} className="lab-focus" pointerEvents="none" />}
      <title>Student Lab board</title>
    </svg>
  );
}
