import { PART_DEFS } from "../engine/parts.ts";
import type { PartState } from "../engine/solver.ts";
import type { Part } from "../engine/types.ts";
import { MM } from "../engine/types.ts";
import { PAD_R } from "../engine/netlist.ts";
import { PartSymbol } from "./Symbol.tsx";

const PAD = PAD_R / MM;
const DRILL = 0.4 / MM;

/** Colours for the two ways the board is drawn. */
export const SKIN = {
  design: { board: "#ffffff", grid: "#c3c8d6", silk: "#1f2340", pad: "#e3b04b", drill: "#0f0f26", top: "#c97a10", bottom: "#1f8fc0", outline: "#b9bfd0" },
  fab: { board: "#0c5a3a", grid: "transparent", silk: "#f6f7f2", pad: "#d8b15a", drill: "#1a1a1a", top: "#1d7a4f", bottom: "#0f6a44", outline: "#0a3d28" },
};
export type Skin = (typeof SKIN)["design"];

/** One placed part: a schematic symbol in design view, footprint pads and silkscreen in fab view. */
export function PartGlyph({ part, st, skin, view, selected, hot }: { part: Part; st?: PartState; skin: Skin; view: "design" | "fab"; selected: boolean; hot?: boolean }) {
  const def = PART_DEFS[part.type];
  const b = def.body;
  const stress = st && !st.burnt ? Math.max(0, Math.min(1, (st.stress - 0.6) / 0.6)) : 0;
  if (view === "design") {
    return (
      <g transform={`translate(${part.x} ${part.y}) rotate(${part.rot})`}>
        {stress > 0 && <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.3} fill="#ff4d2e" opacity={stress * 0.35} className="lab-heat" />}
        <PartSymbol part={part} st={st} ink={skin.silk} />
        {/* Connection points: where wires attach. */}
        {def.pins.map((pin) => (
          <circle key={pin.id} cx={pin.x} cy={pin.y} r={0.13} fill={skin.silk} />
        ))}
        {st?.burnt && (
          <g className="lab-smoke" pointerEvents="none">
            <circle cx={b.x + b.w / 2} cy={b.y} r={0.5} fill="#8b8b95" />
            <circle cx={b.x + b.w / 2 + 0.4} cy={b.y - 0.4} r={0.35} fill="#9a9aa3" />
          </g>
        )}
        {(selected || hot) && (
          <rect x={b.x - 0.5} y={b.y - 0.5} width={b.w + 1} height={b.h + 1} rx={0.4} fill="none" stroke={hot ? "#ff6b4a" : "#2ba9da"} strokeWidth={0.14} strokeDasharray={hot ? "0.5 0.3" : undefined} />
        )}
      </g>
    );
  }
  return (
    <g transform={`translate(${part.x} ${part.y}) rotate(${part.rot})`}>
      {/* Silkscreen courtyard */}
      {b.round ? (
        <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2 + 0.15} ry={b.h / 2 + 0.15} fill="none" stroke={skin.silk} strokeWidth={0.08} opacity={0.7} />
      ) : (
        <rect x={b.x - 0.15} y={b.y - 0.15} width={b.w + 0.3} height={b.h + 0.3} fill="none" stroke={skin.silk} strokeWidth={0.08} opacity={0.7} />
      )}
      {def.pins.map((pin) => (
        <g key={pin.id}>
          {pin.id === def.pins[0].id && def.polarised ? (
            <rect x={pin.x - PAD} y={pin.y - PAD} width={PAD * 2} height={PAD * 2} fill={skin.pad} />
          ) : (
            <circle cx={pin.x} cy={pin.y} r={PAD} fill={skin.pad} />
          )}
          <circle cx={pin.x} cy={pin.y} r={DRILL} fill={skin.drill} />
        </g>
      ))}
      {(selected || hot) && (
        <rect x={b.x - 0.5} y={b.y - 0.5} width={b.w + 1} height={b.h + 1} rx={0.4} fill="none" stroke={hot ? "#ff6b4a" : "#2ba9da"} strokeWidth={0.14} strokeDasharray={hot ? "0.5 0.3" : undefined} />
      )}
      {/* Reference designator stays upright */}
      <text
        x={b.x + b.w / 2}
        y={b.y - 0.35}
        fontSize={0.7}
        fontWeight={700}
        fill={skin.silk}
        textAnchor="middle"
        transform={part.rot ? `rotate(${-part.rot} ${b.x + b.w / 2} ${b.y - 0.35})` : undefined}
      >
        {part.id}
      </text>
    </g>
  );
}
