import { partBox } from "./parts.ts";
import type { Board, Pt } from "./types.ts";

export type CircuitFragment = Pick<Board, "parts" | "traces" | "vias">;

export function fragmentBounds(fragment: CircuitFragment) {
  const boxes = fragment.parts.map(partBox);
  const points = [...fragment.traces.flatMap((t) => t.points), ...fragment.vias];
  if (!boxes.length && !points.length) return null;
  return {
    x: Math.floor(Math.min(...boxes.map((b) => b.x), ...points.map((p) => p.x - 0.4))),
    y: Math.floor(Math.min(...boxes.map((b) => b.y), ...points.map((p) => p.y - 0.4))),
    right: Math.max(...boxes.map((b) => b.x + b.w), ...points.map((p) => p.x + 0.4)),
    bottom: Math.max(...boxes.map((b) => b.y + b.h), ...points.map((p) => p.y + 0.4)),
  };
}

export function offsetFragment(fragment: CircuitFragment, at: Pt): CircuitFragment {
  const bounds = fragmentBounds(fragment);
  if (!bounds) return structuredClone(fragment);
  const dx = Math.round(at.x) - bounds.x;
  const dy = Math.round(at.y) - bounds.y;
  const translate = (p: Pt) => ({ x: p.x + dx, y: p.y + dy });
  return {
    parts: fragment.parts.map((p) => ({ ...p, ...translate(p), props: { ...p.props } })),
    traces: fragment.traces.map((t) => ({ ...t, points: t.points.map(translate) })),
    vias: fragment.vias.map((v) => ({ ...v, ...translate(v) })),
  };
}

export function placementError(board: Board, fragment: CircuitFragment): string | null {
  const bounds = fragmentBounds(fragment);
  if (!bounds) return "Nothing to paste.";
  if (bounds.x < 0 || bounds.y < 0 || bounds.right > board.w || bounds.bottom > board.h) return "Keep the pasted circuit inside the board.";
  for (const part of fragment.parts) {
    const a = partBox(part);
    for (const existing of board.parts) {
      const b = partBox(existing);
      if (a.x < b.x + b.w - 0.05 && b.x < a.x + a.w - 0.05 && a.y < b.y + b.h - 0.05 && b.y < a.y + a.h - 0.05)
        return "Move the pasted components away from existing components.";
    }
  }
  return null;
}
