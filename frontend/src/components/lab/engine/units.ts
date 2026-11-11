import type { FieldDef } from "./parts.ts";
import type { PartProps } from "./types.ts";

/** Units and value fields, kept apart from the part table so part files can share them without import cycles. */

function trim(n: number, digits = 2): string {
  return String(Number(n.toFixed(digits)));
}

const PREFIXES: [number, string][] = [
  [1e9, "G"],
  [1e6, "M"],
  [1e3, "k"],
  [1, ""],
  [1e-3, "m"],
  [1e-6, "µ"],
  [1e-9, "n"],
  [1e-12, "p"],
];

/** A value with an SI prefix: 4700 Ω → "4.7 kΩ", 1e-7 F → "100 nF". Hz, % and plain ratios keep plain numbers. */
export function formatValue(v: number, unit: string): string {
  if (!Number.isFinite(v)) return "—";
  if (unit === "%" || unit === "") return `${trim(v)}${unit ? " %" : ""}`;
  if (v === 0) return `0 ${unit}`;
  const a = Math.abs(v);
  const floor = unit === "Hz" ? 1 : 1e-12;
  for (const [k, p] of PREFIXES) if (a >= k * 0.9995 || k === floor) return `${trim(v / k)} ${p}${unit}`;
  return `${trim(v)} ${unit}`;
}

const SI: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, "μ": 1e-6, m: 1e-3, "": 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };

/** Read "4.7k", "100n", "16", "16 V" or "10 µF" as a number. Returns NaN for anything else. */
export function parseSI(text: string): number {
  const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*([pnuµμmkKMG]?)\s*(?:Ω|ohms?|[a-zA-Z%]*)\s*$/.exec(text);
  if (!m) return NaN;
  return Number(m[1]) * SI[m[2]];
}

export const num = (key: "value" | "freq" | "duty", label: string, unit: string, presets: number[], fallback: number, min: number, max: number): FieldDef => ({ kind: "number", key, label, unit, presets, fallback, min, max });
export const choice = (key: "color" | "mode" | "variant", label: string, options: [string, string][]): FieldDef => ({ kind: "choice", key, label, options: options.map(([value, l]) => ({ value, label: l })), fallback: options[0][0] });
export const volts = (p: PartProps, d: number) => formatValue(p.value ?? d, "V");
