import { LED_SPECS, PART_DEFS, resistorBands } from "../engine/parts.ts";
import type { PartState } from "../engine/solver.ts";
import type { Part } from "../engine/types.ts";
import { MM } from "../engine/types.ts";
import { PAD_R } from "../engine/netlist.ts";

const PAD = PAD_R / MM;
const DRILL = 0.4 / MM;

/** Colours for the two ways the board is drawn. */
export const SKIN = {
  design: { board: "#17173a", grid: "#2c2c5c", silk: "#c9cbe3", pad: "#e3b04b", drill: "#0f0f26", top: "#e9a23b", bottom: "#2ba9da", outline: "#5a5d8f" },
  fab: { board: "#0c5a3a", grid: "transparent", silk: "#f6f7f2", pad: "#d8b15a", drill: "#1a1a1a", top: "#1d7a4f", bottom: "#0f6a44", outline: "#0a3d28" },
};
export type Skin = (typeof SKIN)["design"];

function Body({ part, st, skin }: { part: Part; st?: PartState; skin: Skin }) {
  const b = PART_DEFS[part.type].body;
  const burnt = st?.burnt;
  const dark = burnt ? "#2a2523" : undefined;
  switch (part.type) {
    case "battery9v":
      return (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.35} fill={dark ?? "#24242a"} />
          <rect x={b.x} y={b.y} width={1.5} height={b.h} rx={0.3} fill="#2ba9da" />
          <text x={b.x + 3.3} y={b.y + b.h / 2 + 0.45} fontSize={1.3} fontWeight={800} fill="#f3f6fb" textAnchor="middle">9V</text>
          <path d={`M${b.x + b.w} 0 H0 M${b.x + b.w} 2 H0`} stroke="#c94848" strokeWidth={0.12} />
          <path d={`M${b.x + b.w} 2 H0`} stroke="#1d1d1d" strokeWidth={0.12} />
        </g>
      );
    case "coincell":
      return (
        <g>
          <circle cx={2} cy={0} r={2.1} fill={dark ?? "#b9bfca"} />
          <circle cx={2} cy={0} r={1.6} fill={dark ?? "#d4d9e1"} />
          <text x={2} y={0.35} fontSize={0.9} fontWeight={800} fill="#3b3f4a" textAnchor="middle">CR2032</text>
        </g>
      );
    case "resistor": {
      const bands = resistorBands(part.props.value ?? 330);
      return (
        <g>
          <path d="M0 0 H4" stroke="#a7a9b4" strokeWidth={0.14} />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.45} fill={dark ?? "#e7cf9c"} />
          {!burnt &&
            [...bands, "#c9a33a"].map((c, i) => <rect key={i} x={1.25 + i * 0.42 + (i === 3 ? 0.25 : 0)} y={b.y} width={0.2} height={b.h} fill={c} />)}
        </g>
      );
    }
    case "led": {
      const spec = LED_SPECS[part.props.color ?? "red"];
      const glow = st?.glow ?? 0;
      return (
        <g>
          {glow > 0 && <circle cx={0.5} cy={0} r={1.4 + glow * 2.4} fill={spec.hex} opacity={0.18 + glow * 0.4} filter="url(#lab-glow)" />}
          <circle cx={0.5} cy={0} r={1} fill={burnt ? "#3a2f2f" : spec.hex} opacity={burnt ? 1 : 0.35 + glow * 0.65} stroke={skin.silk} strokeWidth={0.08} />
          <path d="M1.32 -0.58 A1 1 0 0 1 1.32 0.58" fill="none" stroke={skin.silk} strokeWidth={0.16} />
          {glow > 0.1 && <circle cx={0.3} cy={-0.3} r={0.3} fill="#fff" opacity={glow * 0.9} />}
        </g>
      );
    }
    case "diode":
      return (
        <g>
          <path d="M0 0 H4" stroke="#a7a9b4" strokeWidth={0.14} />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.2} fill={dark ?? "#1c1c1f"} />
          <rect x={b.x + b.w - 0.45} y={b.y} width={0.25} height={b.h} fill="#c9cbd3" />
        </g>
      );
    case "ceramic":
      return <ellipse cx={0.5} cy={-0.4} rx={0.85} ry={0.5} fill={dark ?? "#d58a2c"} />;
    case "electrolytic":
      return (
        <g>
          <circle cx={0.5} cy={0} r={1.3} fill={dark ?? "#1f3f8c"} />
          <path d="M1.2 -1.08 A1.3 1.3 0 0 1 1.2 1.08 Z" fill={burnt ? "#3d3530" : "#c7d1e8"} />
          <path d="M0.5 -0.7 V0.7 M-0.2 0 H1.2" stroke="#9fb0d8" strokeWidth={0.08} opacity={0.6} />
        </g>
      );
    case "button":
      return (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.2} fill={dark ?? "#2a2a2e"} />
          <circle cx={1.5} cy={0} r={0.85} fill={st?.on ? "#1a1a1d" : "#3d3d44"} stroke="#55555e" strokeWidth={0.08} />
        </g>
      );
    case "switch":
      return (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.2} fill={dark ?? "#34343c"} />
          <rect x={part.props.closed ? 1.15 : 0.05} y={-0.45} width={0.8} height={0.9} rx={0.12} fill="#e6e8ee" />
        </g>
      );
    case "pot":
      return (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.3} fill={dark ?? "#2457a6"} />
          <circle cx={1} cy={-1.7} r={0.9} fill="#e8e9ee" />
          <path d={`M1 -1.7 L${1 + 0.8 * Math.cos(Math.PI * (0.75 + 1.5 * (part.props.pos ?? 0.5)))} ${-1.7 + 0.8 * Math.sin(Math.PI * (0.75 + 1.5 * (part.props.pos ?? 0.5)))}`} stroke="#2457a6" strokeWidth={0.18} strokeLinecap="round" />
        </g>
      );
    case "npn":
      return (
        <g>
          <path d="M-0.4 -0.3 H2.4 A1.4 1.3 0 0 0 -0.4 -0.3 Z" fill={dark ?? "#1c1c20"} transform="translate(0 -0.1)" />
          <text x={1} y={-0.75} fontSize={0.45} fill="#b9bccb" textAnchor="middle" fontWeight={700}>2N2222</text>
        </g>
      );
    case "ldr":
      return (
        <g>
          <circle cx={1} cy={0} r={1.1} fill={dark ?? "#e7d6b5"} />
          <path d="M0.3 -0.5 H1.5 V-0.2 H0.5 V0.1 H1.5 V0.4 H0.5" fill="none" stroke="#c4462e" strokeWidth={0.14} />
        </g>
      );
    case "buzzer":
      return (
        <g>
          <circle cx={1.5} cy={0} r={2.4} fill={dark ?? "#1b1b1e"} />
          <circle cx={1.5} cy={0} r={0.45} fill="#0b0b0c" />
          {st?.on && <circle cx={1.5} cy={0} r={2.4} fill="none" stroke="#2ba9da" strokeWidth={0.12} className="lab-ring" />}
        </g>
      );
    case "timer555":
      return (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.12} fill={dark ?? "#18181b"} />
          <path d={`M${b.x} -1.9 A0.4 0.4 0 0 1 ${b.x} -1.1`} fill="none" stroke="#505058" strokeWidth={0.1} />
          <circle cx={b.x + 0.45} cy={-0.85} r={0.14} fill="#505058" />
          <text x={1.6} y={-1.3} fontSize={0.62} fill="#d2d4dc" textAnchor="middle" fontWeight={700}>NE555</text>
          {st?.on && <circle cx={3.1} cy={-2.1} r={0.14} fill="#3bff7a" />}
        </g>
      );
  }
}

/** One placed part: footprint pads, silkscreen and (in design view) the component body. */
export function PartGlyph({ part, st, skin, view, selected, hot }: { part: Part; st?: PartState; skin: Skin; view: "design" | "fab"; selected: boolean; hot?: boolean }) {
  const def = PART_DEFS[part.type];
  const b = def.body;
  const stress = st && !st.burnt ? Math.max(0, Math.min(1, (st.stress - 0.6) / 0.6)) : 0;
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
      {view === "design" && <Body part={part} st={st} skin={skin} />}
      {view === "design" && stress > 0 && <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.3} fill="#ff4d2e" opacity={stress * 0.55} className="lab-heat" />}
      {st?.burnt && view === "design" && (
        <g className="lab-smoke" pointerEvents="none">
          <circle cx={b.x + b.w / 2} cy={b.y} r={0.5} fill="#8b8b95" />
          <circle cx={b.x + b.w / 2 + 0.4} cy={b.y - 0.4} r={0.35} fill="#9a9aa3" />
        </g>
      )}
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
