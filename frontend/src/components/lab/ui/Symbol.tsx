import type { ReactNode } from "react";
import { LED_SPECS, PART_DEFS, formatValue } from "../engine/parts.ts";
import type { PartState } from "../engine/solver.ts";
import type { Part, PartType } from "../engine/types.ts";
import { LcdChars, McuBoardArt, OledPixels } from "./BoardArt.tsx";

/**
 * Schematic symbols for the design view. Each symbol is drawn in grid units between the part's pins, inside the
 * same body box the part has always had, so wiring, selection and checks are unchanged. Polarised parts carry
 * + and − marks, and every part shows its reference and value, kept upright whatever the rotation.
 */

const W = 0.1;
const VALUE_INK = "#0b6c9b";

function arrowHead(x1: number, y1: number, x2: number, y2: number, t: number, size: number, fill: string) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const tx = x1 + dx * t;
  const ty = y1 + dy * t;
  const bx = tx - ux * size;
  const by = ty - uy * size;
  const px = -uy * size * 0.55;
  const py = ux * size * 0.55;
  return <path d={`M${tx} ${ty} L${bx + px} ${by + py} L${bx - px} ${by - py} Z`} fill={fill} />;
}

const SEG: Record<string, string> = {
  a: "M3.1 -5.8 H4.9",
  b: "M5.1 -5.6 V-4.1",
  c: "M5.1 -3.7 V-2.2",
  d: "M3.1 -2 H4.9",
  e: "M2.9 -3.7 V-2.2",
  f: "M2.9 -5.6 V-4.1",
  g: "M3.1 -3.9 H4.9",
};

/** Where the reference and value go, in the part's own coordinates. Default: reference above, value below. */
const LABEL_AT: Partial<Record<PartType, { ref: [number, number, "start" | "middle" | "end"]; value: [number, number, "start" | "middle" | "end"] }>> = {
  dcsource: { ref: [1.6, 1.8, "start"], value: [1.6, 2.6, "start"] },
  acsource: { ref: [1.6, 1.8, "start"], value: [1.6, 2.6, "start"] },
  pulsegen: { ref: [1.6, 1.8, "start"], value: [1.6, 2.6, "start"] },
  isource: { ref: [1.6, 1.8, "start"], value: [1.6, 2.6, "start"] },
  vcc: { ref: [0, -2.2, "middle"], value: [0, -1.15, "middle"] },
  relay: { ref: [-0.7, 1.6, "end"], value: [-0.7, 2.4, "end"] },
  transformer: { ref: [2, -0.25, "middle"], value: [2, 4.7, "middle"] },
  scope: { ref: [4.1, -0.95, "middle"], value: [4.1, 5.35, "middle"] },
};

function fmtReading(part: Part, st?: PartState): string | null {
  if (st?.reading === undefined) return null;
  const mode = part.type === "multimeter" ? (part.props.mode ?? "V") : part.type === "ammeter" ? "A" : "V";
  if (mode === "R") return Number.isFinite(st.reading) ? formatValue(st.reading, "Ω") : "OL";
  return formatValue(Math.abs(st.reading) < 1e-6 ? 0 : st.reading, mode);
}

/** A part as a schematic symbol, with its reference designator and value. */
export function PartSymbol({ part, st, ink }: { part: Part; st?: PartState; ink: string }) {
  const def = PART_DEFS[part.type];
  const b = def.body;
  const rot = part.rot;
  const burnt = Boolean(st?.burnt);
  const line = burnt ? "#7a5a52" : ink;
  const S = { stroke: line, strokeWidth: W, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const P = (d: string, extra: Record<string, unknown> = {}) => <path d={d} {...S} {...extra} />;
  /** Text that stays upright when the part is rotated. */
  const T = (x: number, y: number, text: ReactNode, size = 0.5, opts: { anchor?: "start" | "middle" | "end"; fill?: string; weight?: number; key?: string | number; mono?: boolean } = {}) => (
    <text
      key={opts.key}
      x={x}
      y={y}
      fontSize={size}
      fontWeight={opts.weight ?? 700}
      fill={opts.fill ?? line}
      textAnchor={opts.anchor ?? "middle"}
      dominantBaseline="central"
      fontFamily={opts.mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined}
      transform={rot ? `rotate(${-rot} ${x} ${y})` : undefined}
      pointerEvents="none"
    >
      {text}
    </text>
  );
  const plus = (x: number, y: number) => T(x, y, "+", 0.5, { weight: 800 });
  const minus = (x: number, y: number) => T(x, y, "−", 0.5, { weight: 800 });

  let body: ReactNode = null;
  switch (part.type) {
    case "battery9v":
      body = (
        <g>
          {P("M0 0 H-3 V0.55 M-3 1.45 V2 H0")}
          {P("M-3.8 0.55 H-2.2 M-3.8 1.15 H-2.2")}
          {P("M-3.4 0.85 H-2.6 M-3.4 1.45 H-2.6", { strokeWidth: W * 2 })}
          {plus(-4.3, 0.55)}
          {minus(-4.3, 1.5)}
        </g>
      );
      break;
    case "coincell":
      body = (
        <g>
          {P("M0 0 H1.75 M2.25 0 H4 M1.75 -0.8 V0.8")}
          {P("M2.25 -0.45 V0.45", { strokeWidth: W * 2 })}
          {plus(1.25, -0.75)}
          {minus(2.8, -0.75)}
        </g>
      );
      break;
    case "dcsource":
    case "acsource":
    case "pulsegen":
    case "isource":
      body = (
        <g>
          <circle cx={0} cy={2} r={1.2} {...S} />
          {P("M0 0 V0.8 M0 3.2 V4")}
          {part.type === "dcsource" && (
            <>
              {T(0, 1.45, "+", 0.6, { weight: 800 })}
              {T(0, 2.6, "−", 0.6, { weight: 800 })}
            </>
          )}
          {part.type === "acsource" && P("M-0.7 2 C-0.45 1.3 -0.15 1.3 0 2 S0.45 2.7 0.7 2")}
          {part.type === "pulsegen" && P("M-0.75 2.4 H-0.35 V1.6 H0.25 V2.4 H0.75")}
          {part.type === "isource" && (
            <>
              {P("M0 2.75 V1.45")}
              {arrowHead(0, 2.75, 0, 1.2, 1, 0.35, line)}
            </>
          )}
          {part.type !== "dcsource" && part.type !== "acsource" && (
            <>
              {plus(0.45, 0.35)}
              {minus(0.45, 3.65)}
            </>
          )}
        </g>
      );
      break;
    case "gnd":
      body = P("M0 0 V0.6 M-0.7 0.6 H0.7 M-0.45 0.9 H0.45 M-0.2 1.2 H0.2");
      break;
    case "vcc":
      body = P("M0 0 V-0.75 M-0.6 -0.75 H0.6");
      break;
    case "resistor":
      body = (
        <g>
          {P("M0 0 H1 M3 0 H4")}
          <rect x={1} y={-0.35} width={2} height={0.7} {...S} />
        </g>
      );
      break;
    case "ldr":
      body = (
        <g>
          {P("M0 0 H0.4 M1.6 0 H2")}
          <rect x={0.4} y={-0.28} width={1.2} height={0.56} {...S} />
          <circle cx={1} cy={0} r={0.85} {...S} />
          {P("M0.05 -1.15 L0.45 -0.75 M0.45 -1.3 L0.85 -0.9")}
          {arrowHead(0.05, -1.15, 0.5, -0.7, 1, 0.22, line)}
          {arrowHead(0.45, -1.3, 0.9, -0.85, 1, 0.22, line)}
        </g>
      );
      break;
    case "pot": {
      const wx = 0.35 + 1.3 * (part.props.pos ?? 0.5);
      body = (
        <g>
          <rect x={0.2} y={-2.35} width={1.6} height={0.6} {...S} />
          {P(`M0 0 V-2.05 H0.2 M2 0 V-2.05 H1.8 M1 0 V-1.05 H${wx} V-1.65`)}
          {arrowHead(wx, -1.05, wx, -1.75, 1, 0.28, line)}
        </g>
      );
      break;
    }
    case "inductor":
      body = P("M0 0 H1 a0.25 0.25 0 0 1 0.5 0 a0.25 0.25 0 0 1 0.5 0 a0.25 0.25 0 0 1 0.5 0 a0.25 0.25 0 0 1 0.5 0 H4");
      break;
    case "ceramic":
      body = P("M0 0 H0.38 M0.62 0 H1 M0.38 -0.55 V0.55 M0.62 -0.55 V0.55");
      break;
    case "electrolytic":
      body = (
        <g>
          {P("M0 0 H0.38 M0.66 0 H1 M0.38 -0.55 V0.55 M0.74 -0.55 Q0.56 0 0.74 0.55")}
          {plus(0.05, -0.75)}
          {minus(0.98, -0.75)}
        </g>
      );
      break;
    case "led": {
      const spec = LED_SPECS[part.props.color ?? "red"];
      const glow = st?.glow ?? 0;
      body = (
        <g>
          {glow > 0 && <circle cx={0.5} cy={0} r={0.9 + glow * 1.6} fill={spec.hex} opacity={0.15 + glow * 0.35} filter="url(#lab-glow)" />}
          {P("M0 0 H0.08 M0.88 0 H1")}
          <path d="M0.08 -0.42 L0.84 0 L0.08 0.42 Z" fill={burnt ? "#3a2f2f" : spec.hex} fillOpacity={burnt ? 1 : 0.35 + glow * 0.65} stroke={line} strokeWidth={W} strokeLinejoin="round" />
          {P("M0.88 -0.45 V0.45")}
          {P("M0.5 -0.55 L0.8 -0.9 M0.78 -0.42 L1.08 -0.77")}
          {arrowHead(0.5, -0.55, 0.85, -0.95, 1, 0.16, line)}
          {arrowHead(0.78, -0.42, 1.13, -0.82, 1, 0.16, line)}
          {plus(-0.1, -0.55)}
          {minus(1.1, 0.55)}
        </g>
      );
      break;
    }
    case "diode":
    case "schottky":
    case "zener": {
      const bar = part.type === "schottky" ? "M2.25 -0.3 V-0.5 H2.45 V0.5 H2.65 V0.3" : part.type === "zener" ? "M2.25 -0.62 L2.45 -0.5 V0.5 L2.65 0.62" : "M2.45 -0.5 V0.5";
      body = (
        <g>
          {P("M0 0 H1.55 M2.45 0 H4")}
          <path d="M1.55 -0.5 L2.45 0 L1.55 0.5 Z" fill={line} fillOpacity={0.12} stroke={line} strokeWidth={W} strokeLinejoin="round" />
          {P(bar)}
          {plus(0.7, -0.45)}
          {minus(3.3, -0.45)}
        </g>
      );
      break;
    }
    case "fuse":
      body = (
        <g>
          <rect x={1} y={-0.3} width={2} height={0.6} {...S} />
          {P(burnt ? "M0 0 H1.8 M2.2 0 H4" : "M0 0 H4")}
        </g>
      );
      break;
    case "button": {
      const y = st?.on ? -0.18 : -0.6;
      body = (
        <g>
          {P(`M0 0 H0.8 M2.2 0 H3 M0.75 ${y} H2.25 M1.5 ${y} V${y - 0.55} M1.2 ${y - 0.55} H1.8`)}
          <circle cx={0.9} cy={0} r={0.1} {...S} />
          <circle cx={2.1} cy={0} r={0.1} {...S} />
        </g>
      );
      break;
    }
    case "switch":
      body = (
        <g>
          {P(`M0 0 H0.4 M1.6 0 H2 M0.58 -0.05 L${part.props.closed ? "1.42 -0.12" : "1.35 -0.7"}`)}
          <circle cx={0.5} cy={0} r={0.1} {...S} />
          <circle cx={1.5} cy={0} r={0.1} {...S} />
        </g>
      );
      break;
    case "spdt":
      body = (
        <g>
          {P(`M0 0 H1.1 M2.9 -1 H4 M2.9 1 H4 M1.28 -0.05 L${part.props.closed ? "2.72 -0.88" : "2.72 0.88"}`)}
          <circle cx={1.2} cy={0} r={0.1} {...S} />
          <circle cx={2.8} cy={-1} r={0.1} {...S} />
          <circle cx={2.8} cy={1} r={0.1} {...S} />
          {T(3.5, -1.35, "A", 0.38)}
          {T(3.5, 1.35, "B", 0.38)}
        </g>
      );
      break;
    case "npn":
    case "pnp": {
      body = (
        <g>
          <circle cx={1} cy={-0.85} r={0.75} {...S} />
          {P("M1 0 V-0.55 M0.75 -0.55 L0.3 -1.2 H0 V0 M1.25 -0.55 L1.7 -1.2 H2 V0")}
          {P("M0.5 -0.55 H1.5", { strokeWidth: W * 1.8 })}
          {part.type === "npn" ? arrowHead(0.75, -0.55, 0.3, -1.2, 0.85, 0.22, line) : arrowHead(0.3, -1.2, 0.75, -0.55, 0.75, 0.22, line)}
          {T(0, 0.65, "E", 0.32, { weight: 600 })}
          {T(1, 0.65, "B", 0.32, { weight: 600 })}
          {T(2, 0.65, "C", 0.32, { weight: 600 })}
        </g>
      );
      break;
    }
    case "nmos":
    case "pmos":
      body = (
        <g>
          <circle cx={1} cy={-0.85} r={0.75} {...S} />
          {P("M1 0 V-0.4 M0.55 -0.4 H1.45 M0.68 -0.62 V-1.2 H0 V0 M1.32 -0.62 V-1.2 H2 V0 M1 -0.62 V-1.2 H0.68")}
          {P("M0.55 -0.62 H0.8 M0.9 -0.62 H1.1 M1.2 -0.62 H1.45", { strokeWidth: W * 1.8 })}
          {part.type === "nmos" ? arrowHead(1, -1.2, 1, -0.62, 0.9, 0.2, line) : arrowHead(1, -0.62, 1, -1.2, 0.9, 0.2, line)}
          {T(0, 0.65, "S", 0.32, { weight: 600 })}
          {T(1, 0.65, "G", 0.32, { weight: 600 })}
          {T(2, 0.65, "D", 0.32, { weight: 600 })}
        </g>
      );
      break;
    case "opamp":
      body = (
        <g>
          <path d="M0.6 -2 L4.2 0 L0.6 2 Z" {...S} />
          {P("M0 -1 H0.6 M0 1 H0.6 M4.2 0 H5 M2 -2 V-1.22 M2 2 V1.22")}
          {T(0.95, -1, "−", 0.6, { weight: 800 })}
          {T(0.95, 1, "+", 0.6, { weight: 800 })}
          {T(2.45, -1.75, "V+", 0.32, { anchor: "start" })}
          {T(2.45, 1.75, "V−", 0.32, { anchor: "start" })}
        </g>
      );
      break;
    case "lm7805":
    case "ams1117":
      body = (
        <g>
          <rect x={0.7} y={-0.9} width={2.6} height={2} {...S} />
          {P("M0 0 H0.7 M3.3 0 H4 M2 1.1 V2")}
          {T(2, -0.45, part.type === "lm7805" ? "7805" : "1117", 0.45)}
          {T(0.85, 0.15, "IN", 0.3, { anchor: "start" })}
          {T(3.15, 0.15, "OUT", 0.3, { anchor: "end" })}
          {T(2, 0.75, "GND", 0.3)}
        </g>
      );
      break;
    case "relay": {
      const on = Boolean(st?.on);
      body = (
        <g>
          <rect x={-0.45} y={1.2} width={0.9} height={1.6} {...S} />
          {P("M-0.45 2.8 L0.45 1.2 M0 0 V1.2 M0 2.8 V4 M3 0 V0.8 M2 4 V3.2 M4 4 V3.2")}
          {P(`M3 0.8 L${on ? "3.9 3.1" : "2.1 3.1"}`)}
          {P("M0.45 2 H2.5", { strokeDasharray: "0.15 0.15" })}
          <circle cx={3} cy={0.8} r={0.08} fill={line} />
          {T(3.25, 0.3, "COM", 0.3, { anchor: "start" })}
          {T(1.85, 3.5, "NC", 0.3, { anchor: "end" })}
          {T(4.15, 3.5, "NO", 0.3, { anchor: "start" })}
        </g>
      );
      break;
    }
    case "opto":
      body = (
        <g>
          <rect x={0.5} y={-0.5} width={3} height={4} {...S} />
          {P("M0 0 H1.2 V1 M1.2 1.85 V3 H0 M0.8 1.85 H1.6 M2.6 0.9 V2.1 M2.6 1.2 L3.3 0.6 V0 H4 M2.6 1.8 L3.3 2.4 V3 H4")}
          <path d="M0.8 1 L1.6 1 L1.2 1.8 Z" {...S} />
          {P("M1.75 1.2 L2.3 1.2 M1.75 1.6 L2.3 1.6")}
          {arrowHead(1.75, 1.2, 2.4, 1.2, 1, 0.18, line)}
          {arrowHead(1.75, 1.6, 2.4, 1.6, 1, 0.18, line)}
          {arrowHead(2.6, 1.8, 3.3, 2.4, 0.8, 0.2, line)}
          {plus(-0.3, -0.4)}
          {minus(-0.3, 2.6)}
        </g>
      );
      break;
    case "transformer": {
      const bumps = (x: number, sweep: 0 | 1) => `M${x} 0.6 ${"a0.35 0.35 0 0 " + sweep + " 0 0.7 ".repeat(4)}`;
      body = (
        <g>
          {P(`${bumps(1.2, 1)} ${bumps(2.8, 0)} M0 0 H1.2 V0.6 M1.2 3.4 V4 H0 M4 0 H2.8 V0.6 M2.8 3.4 V4 H4`)}
          {P("M1.85 0.5 V3.5 M2.15 0.5 V3.5")}
          <circle cx={1.5} cy={0.45} r={0.08} fill={line} />
          <circle cx={2.5} cy={0.45} r={0.08} fill={line} />
        </g>
      );
      break;
    }
    case "voltmeter":
    case "ammeter":
      body = (
        <g>
          <circle cx={2} cy={0} r={1} {...S} />
          {P("M0 0 H1 M3 0 H4")}
          {T(2, 0, part.type === "voltmeter" ? "V" : "A", 0.8, { weight: 800 })}
          {plus(0.55, -0.4)}
          {minus(3.45, -0.4)}
        </g>
      );
      break;
    case "multimeter": {
      const reading = fmtReading(part, st);
      const mode = part.props.mode ?? "V";
      body = (
        <g>
          <rect x={-0.6} y={-3.4} width={4.2} height={2.8} rx={0.25} {...S} />
          <rect x={-0.25} y={-3.1} width={3.5} height={1.25} rx={0.1} fill="#e9efe4" stroke={line} strokeWidth={W * 0.7} />
          {T(1.5, -2.47, reading ?? "— —", 0.6, { mono: true })}
          {T(1.5, -1.25, mode === "R" ? "Ω" : mode, 0.5, { weight: 800 })}
          {P("M0 0 V-0.6 M3 0 V-0.6")}
          {T(0.35, -0.95, "+", 0.4, { anchor: "start" })}
          {T(2.65, -0.95, "COM", 0.3, { anchor: "end" })}
        </g>
      );
      break;
    }
    case "scope": {
      const [a, bb] = st?.wave ?? [[], []];
      const all = [...a, ...bb].map(Math.abs);
      const span = Math.max(1, ...all) * 1.15;
      const trace = (vs: number[]) => vs.map((v, i) => `${i ? "L" : "M"}${(1.1 + (6 * i) / 249).toFixed(3)} ${(2 - (v / span) * 2).toFixed(3)}`).join(" ");
      body = (
        <g>
          <rect x={0.6} y={-0.6} width={7} height={5.2} rx={0.25} {...S} />
          <rect x={1.1} y={-0.2} width={6} height={4.4} fill="#0b1f1a" />
          {[1, 2, 3].map((k) => (
            <line key={k} x1={1.1} y1={-0.2 + k * 1.1} x2={7.1} y2={-0.2 + k * 1.1} stroke="#1f3d33" strokeWidth={0.04} />
          ))}
          {[1, 2, 3, 4, 5].map((k) => (
            <line key={`v${k}`} x1={1.1 + k} y1={-0.2} x2={1.1 + k} y2={4.2} stroke="#1f3d33" strokeWidth={0.04} />
          ))}
          {a.length > 1 && <path d={trace(a)} fill="none" stroke="#ffd23b" strokeWidth={0.07} />}
          {bb.length > 1 && <path d={trace(bb)} fill="none" stroke="#3be0ff" strokeWidth={0.07} />}
          {P("M0 0 H0.6 M0 2 H0.6 M0 4 H0.6")}
          {T(0.85, 0, "A", 0.3, { fill: "#a07e00" })}
          {T(0.85, 2, "B", 0.3, { fill: "#0b8aa6" })}
          {T(0.85, 4, "⏚", 0.35)}
          {a.length > 1 && T(7, 3.85, `±${formatValue(span, "V")}`, 0.3, { anchor: "end", fill: "#9fe3c8" })}
        </g>
      );
      break;
    }
    case "sevenseg": {
      const segs = st?.segs ?? [];
      const names = ["a", "b", "c", "d", "e", "f", "g"];
      body = (
        <g>
          <rect x={-0.4} y={-6.6} width={8.8} height={6} rx={0.2} fill="#1b1b1f" stroke={line} strokeWidth={W} />
          {names.map((n, i) => (
            <path key={n} d={SEG[n]} stroke={(segs[i] ?? 0) > 0.05 ? "#ff3b3b" : "#3a2a2a"} strokeOpacity={(segs[i] ?? 0) > 0.05 ? 0.4 + segs[i] * 0.6 : 1} strokeWidth={0.35} strokeLinecap="round" />
          ))}
          <circle cx={5.6} cy={-2} r={0.2} fill={(segs[7] ?? 0) > 0.05 ? "#ff3b3b" : "#3a2a2a"} />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <path key={`l${i}`} d={`M${i} 0 V-0.6`} {...S} />
          ))}
          {[...names, "dp", "COM"].map((n, i) => T(i, -1, n, 0.32, { key: `t${n}`, fill: "#c9cbe3" }))}
          {T(7.6, -6.05, part.props.mode === "ca" ? "CA" : "CC", 0.32, { fill: "#c9cbe3" })}
        </g>
      );
      break;
    }
    case "dcmotor": {
      const ang = (st?.phase ?? 0) * Math.PI * 2;
      body = (
        <g>
          <circle cx={2} cy={0} r={1} {...S} />
          {P("M0 0 H1 M3 0 H4")}
          {T(2, 0, "M", 0.8, { weight: 800 })}
          {st?.on && <circle cx={2 + 0.78 * Math.cos(ang)} cy={0.78 * Math.sin(ang)} r={0.1} fill={VALUE_INK} />}
          {plus(0.55, -0.4)}
          {minus(3.45, -0.4)}
        </g>
      );
      break;
    }
    case "servo": {
      const ang = Math.PI * (1 - (st?.level ?? 0.5));
      body = (
        <g>
          <rect x={-0.6} y={-3.4} width={3.2} height={2.8} rx={0.2} {...S} />
          <circle cx={1} cy={-2.4} r={0.3} {...S} />
          {P(`M1 -2.4 L${1 + 0.9 * Math.cos(ang)} ${-2.4 - 0.9 * Math.sin(ang)}`, { strokeWidth: W * 2.5 })}
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${i} 0 V-0.6`} {...S} />
          ))}
          {T(0, -0.9, "GND", 0.28)}
          {T(1, -0.9, "V+", 0.28)}
          {T(2, -0.9, "SIG", 0.28)}
          {st?.on && T(1, -1.45, `${Math.round((st.level ?? 0.5) * 180)}°`, 0.36, { fill: VALUE_INK })}
        </g>
      );
      break;
    }
    case "hc595":
    case "pcf8574":
      body = (
        <g>
          <rect x={0.7} y={-0.8} width={4.6} height={8.6} {...S} />
          {def.pins.map((pin) => (
            <g key={pin.id}>
              {P(pin.x === 0 ? `M0 ${pin.y} H0.7` : `M6 ${pin.y} H5.3`)}
              {T(pin.x === 0 ? 0.85 : 5.15, pin.y, pin.label, 0.34, { anchor: pin.x === 0 ? "start" : "end", weight: 600 })}
              {part.type === "hc595" && pin.x === 6 && st?.segs?.[Number(pin.id.slice(1))] === 1 && st.on && <circle cx={5.65} cy={pin.y} r={0.12} fill="#e5484d" />}
            </g>
          ))}
        </g>
      );
      break;
    case "oled": {
      const on = Boolean(st?.on);
      body = (
        <g>
          <rect x={-0.6} y={-4.4} width={4.2} height={3.8} rx={0.2} fill="#16161a" stroke={line} strokeWidth={W} />
          <rect x={-0.3} y={-4.1} width={3.6} height={2.3} fill={on ? "#071728" : "#050507"} />
          {on && st?.screen?.kind === "oled" && <OledPixels screen={st.screen} x={-0.3} y={-4.1} w={3.6} h={2.3} color="#7fd7ff" />}
          {on && !st?.screen && T(1.5, -3.35, "VOLTEX", 0.5, { fill: "#7fd7ff", weight: 800 })}
          {on && !st?.screen && <path d="M0 -2.6 H3 M0 -2.2 H2" stroke="#7fd7ff" strokeWidth={0.08} />}
          {def.pins.map((pin) => (
            <g key={pin.id}>
              <path d={`M${pin.x} 0 V-0.6`} {...S} />
              {T(pin.x, -1.05, pin.label, 0.28, { fill: "#c9cbe3" })}
            </g>
          ))}
        </g>
      );
      break;
    }
    case "lcd1602": {
      const on = Boolean(st?.on);
      const lit = st?.level ?? 0;
      body = (
        <g>
          <rect x={-0.6} y={-5} width={16.2} height={4.4} rx={0.2} fill="#1f6f3f" stroke={line} strokeWidth={W} />
          <rect x={0.4} y={-4.6} width={14.2} height={2.7} fill={lit > 0.05 ? "#b5e05a" : "#6f8f3e"} />
          {on && st?.screen?.kind === "lcd" && <LcdChars screen={st.screen} x={0.5} y={-4.55} w={14} h={2.6} ink="#1d2b12" rot={rot} />}
          {on && !st?.screen && T(7.5, -3.95, "HELLO, VOLTEX!", 0.7, { mono: true, fill: "#1d2b12" })}
          {on && !st?.screen && T(7.5, -2.75, "16x2 LCD READY", 0.7, { mono: true, fill: "#1d2b12" })}
          {def.pins.map((pin) => (
            <g key={pin.id}>
              <path d={`M${pin.x} 0 V-0.6`} {...S} />
              {T(pin.x, -1.2, pin.label, 0.26, { fill: "#d8f0d0" })}
            </g>
          ))}
        </g>
      );
      break;
    }
    case "header":
      body = (
        <g>
          <rect x={-1.6} y={-0.6} width={1.2} height={4.2} {...S} />
          {def.pins.map((pin) => (
            <g key={pin.id}>
              {P(`M-0.4 ${pin.y} H0`)}
              <rect x={-1.2} y={pin.y - 0.15} width={0.3} height={0.3} fill={line} />
              {T(-0.6, pin.y - 0.3, pin.label, 0.26)}
            </g>
          ))}
        </g>
      );
      break;
    case "usb":
      body = (
        <g>
          <rect x={-2.6} y={-0.6} width={2.2} height={4.2} {...S} />
          {def.pins.map((pin) => (
            <g key={pin.id}>
              {P(`M-0.4 ${pin.y} H0`)}
              {T(-0.55, pin.y, pin.label.replace("-", "−"), 0.3, { anchor: "end", weight: 600 })}
            </g>
          ))}
          {T(-2.1, 1.5, "USB", 0.38, { weight: 800 })}
        </g>
      );
      break;
    case "screwterm":
      body = (
        <g>
          <rect x={-1.8} y={-0.8} width={1.4} height={3.6} {...S} />
          {[0, 2].map((y) => (
            <g key={y}>
              <circle cx={-1.1} cy={y} r={0.4} {...S} />
              {P(`M-1.38 ${y + 0.28} L-0.82 ${y - 0.28} M-0.4 ${y} H0`)}
            </g>
          ))}
        </g>
      );
      break;
    case "buzzer":
      body = (
        <g>
          {P("M0 0 H0.9 V-0.3 M3 0 H2.1 V-0.3 M0.6 -0.3 H2.4 A0.9 0.9 0 0 0 0.6 -0.3")}
          {st?.on && P("M2.75 -1.15 A1.2 1.2 0 0 1 2.75 0.05 M3.15 -1.45 A1.6 1.6 0 0 1 3.15 0.35", { stroke: VALUE_INK })}
          {plus(0.3, -0.5)}
          {minus(2.75, 0.45)}
        </g>
      );
      break;
    case "uno":
    case "pico":
    case "nano":
    case "mega":
    case "esp32dev30":
    case "esp32dev38":
    case "nodemcu":
    case "esp32cam":
    case "esp32s3":
    case "esp32c3":
      body = <McuBoardArt type={part.type} st={st} />;
      break;
    case "timer555": {
      const bottom = ["GND", "TRIG", "OUT", "RST"];
      const top = ["VCC", "DIS", "THR", "CTRL"];
      body = (
        <g>
          <rect x={-0.5} y={-2.5} width={4} height={2} {...S} />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${i} 0 V-0.5 M${i} -3 V-2.5`} {...S} />
          ))}
          {bottom.map((l, i) => T(i, -0.75, l, 0.26, { key: `b${l}`, weight: 600 }))}
          {top.map((l, i) => T(i, -2.25, l, 0.26, { key: `t${l}`, weight: 600 }))}
          {T(1.5, -1.5, "555", 0.5, { weight: 800 })}
          {st?.on && <circle cx={3.15} cy={-1.5} r={0.12} fill="#22c55e" />}
        </g>
      );
      break;
    }
  }

  const reading = fmtReading(part, st);
  const value = part.type === "voltmeter" || part.type === "ammeter" ? (reading ?? "—") : part.type === "multimeter" ? null : (def.label?.(part.props) ?? null);
  const at = LABEL_AT[part.type] ?? { ref: [b.x + b.w / 2, b.y - 0.45, "middle"], value: [b.x + b.w / 2, b.y + b.h + 0.55, "middle"] };
  const showRef = part.type !== "gnd" && part.type !== "vcc" && part.id !== "?";
  return (
    <g>
      {body}
      {showRef && T(at.ref[0], at.ref[1], part.id, 0.55, { anchor: at.ref[2], weight: 800 })}
      {value && T(at.value[0], at.value[1], value, 0.5, { anchor: at.value[2], fill: burnt ? line : VALUE_INK, weight: 700 })}
    </g>
  );
}
