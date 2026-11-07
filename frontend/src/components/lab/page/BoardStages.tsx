/**
 * The same small LED board at each stage of manufacture, drawn for this page. Server-rendered SVG, no script.
 */
export type Stage = "schematic" | "layout" | "copper" | "mask" | "silk" | "assembled";

const TRACES = ["M30 70 H70", "M110 70 H150 L170 90 V110", "M170 130 V150 H30 V90"];
const PADS: [number, number][] = [
  [30, 70],
  [30, 90],
  [70, 70],
  [110, 70],
  [170, 110],
  [170, 130],
];

export function BoardStage({ stage }: { stage: Stage }) {
  if (stage === "schematic") {
    return (
      <svg viewBox="0 0 200 180" className="h-full w-full" aria-hidden>
        <rect width={200} height={180} fill="#ffffff" />
        <g fill="none" stroke="#292957" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M40 60 V120 M28 60 H52 M34 70 H46" />
          <path d="M40 60 V40 H70 l6 -8 l8 16 l8 -16 l8 16 l8 -16 l6 8 H150 V80" />
          <path d="M138 80 H162 L150 100 Z M138 100 H162" />
          <path d="M150 100 V140 H40 V120" />
          <path d="M160 86 l10 -8 M163 94 l10 -8" />
        </g>
        <text x={18} y={96} fontSize={12} fontWeight={700} fill="#292957">9V</text>
      </svg>
    );
  }
  const fab = stage === "mask" || stage === "silk" || stage === "assembled";
  const board = stage === "layout" ? "#17173a" : fab ? "#0c5a3a" : "#c9b27a";
  const copper = stage === "layout" ? "#e9a23b" : fab ? "#1d7a4f" : "#d98b3a";
  const pad = stage === "layout" ? "#e3b04b" : fab ? "#d8b15a" : "#d98b3a";
  return (
    <svg viewBox="0 0 200 180" className="h-full w-full" aria-hidden>
      <rect x={10} y={20} width={180} height={150} rx={8} fill={board} />
      <g fill="none" stroke={copper} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round">
        {TRACES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {PADS.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={9} fill={pad} />
          <circle cx={x} cy={y} r={3.5} fill={stage === "copper" ? "#8a7448" : "#0f0f26"} />
        </g>
      ))}
      {(stage === "silk" || stage === "assembled" || stage === "layout") && (
        <g fill="none" stroke={stage === "layout" ? "#c9cbe3" : "#f6f7f2"} strokeWidth={2}>
          <rect x={60} y={58} width={60} height={24} />
          <circle cx={170} cy={120} r={20} />
          <path d="M18 60 H6 M12 54 V66" />
        </g>
      )}
      {(stage === "silk" || stage === "assembled") && (
        <g fill="#f6f7f2" fontSize={11} fontWeight={700}>
          <text x={80} y={52}>R1</text>
          <text x={150} y={96}>D1</text>
        </g>
      )}
      {stage === "assembled" && (
        <g>
          <rect x={72} y={60} width={36} height={20} rx={8} fill="#e7cf9c" />
          <rect x={80} y={60} width={4} height={20} fill="#ef7d16" />
          <rect x={88} y={60} width={4} height={20} fill="#ef7d16" />
          <rect x={96} y={60} width={4} height={20} fill="#7a4a1d" />
          <circle cx={170} cy={120} r={34} fill="#ff3b3b" opacity={0.22} />
          <circle cx={170} cy={120} r={17} fill="#ff3b3b" />
          <circle cx={165} cy={115} r={5} fill="#fff" opacity={0.85} />
        </g>
      )}
    </svg>
  );
}
