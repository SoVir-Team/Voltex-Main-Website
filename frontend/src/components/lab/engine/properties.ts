import { CAP_VALUES, LED_SPECS, PART_DEFS, RESISTOR_VALUES } from "./parts.ts";
import type { Part, PartProps, PartType } from "./types.ts";

export type NumericProp = { [K in keyof PartProps]-?: NonNullable<PartProps[K]> extends number ? K : never }[keyof PartProps];
export interface PropertyDef {
  key: NumericProp;
  label: string;
  unit: string;
  default: number;
  min: number;
  max: number;
  /** Display multiplier: the persisted and simulated value always uses SI units. */
  scale?: number;
  presets?: number[];
}
const field = (key: NumericProp, label: string, unit: string, value: number, min: number, max: number, scale = 1): PropertyDef =>
  ({ key, label, unit, default: value, min, max, scale });
const resistance = (value: number) => ({ ...field("value", "Resistance", "Ω", value, 0.1, 1e9), presets: RESISTOR_VALUES });
const power = () => field("powerRating", "Power rating", "W", 0.25, 0.001, 1000);
const contact = () => field("contactResistance", "Contact resistance", "Ω", 0.05, 0.001, 1000);
const capacitor = (value: number, ceramic: boolean): PropertyDef[] => [
  { ...field("value", "Capacitance", ceramic ? "nF" : "µF", value, 1e-12, 1, ceramic ? 1e9 : 1e6), presets: CAP_VALUES.filter((v) => ceramic ? v <= 1e-6 : v >= 1e-6) },
  field("voltageRating", "Voltage rating", "V", 25, 0.1, 1000),
];

const ORIGINAL_PROPERTY_DEFS: Partial<Record<PartType, PropertyDef[]>> = {
  battery9v: [field("voltage", "Supply voltage", "V", 9, 0.1, 100), field("internalResistance", "Internal resistance", "Ω", 1.7, 0.001, 1e6)],
  coincell: [field("voltage", "Supply voltage", "V", 3, 0.1, 100), field("internalResistance", "Internal resistance", "Ω", 30, 0.001, 1e6)],
  resistor: [resistance(330), power()],
  ceramic: capacitor(100e-9, true),
  electrolytic: capacitor(10e-6, false),
  led: [field("forwardVoltage", "Forward voltage", "V", 1.9, 0.1, 10), field("ratedCurrent", "Rated current", "mA", 0.02, 1e-6, 1, 1000)],
  button: [contact()],
  switch: [contact()],
  pot: [resistance(10000), field("pos", "Wiper position", "%", 0.5, 0, 1, 100), power()],
  ldr: [field("brightResistance", "Bright resistance", "Ω", 1000, 0.1, 1e9), field("darkResistance", "Dark resistance", "Ω", 1e6, 0.1, 1e9)],
  npn: [field("gain", "Forward current gain", "β", 150, 1, 1000), field("ratedCurrent", "Collector current rating", "mA", 0.6, 1e-6, 10, 1000)],
  diode: [field("forwardVoltage", "Forward voltage at rated current", "V", 1.75 * 0.02585 * Math.log1p(1 / 2.5e-9), 0.1, 5), field("ratedCurrent", "Rated current", "A", 1, 1e-6, 100)],
  buzzer: [field("minVoltage", "Minimum operating voltage", "V", 2.5, 0.1, 100), field("maxVoltage", "Maximum rated voltage", "V", 12, 0.1, 100), field("loadResistance", "Load resistance", "Ω", 360, 1, 1e6), field("frequency", "Tone frequency", "Hz", 2400, 20, 20000)],
  timer555: [field("triggerRatio", "Trigger ratio", "% supply", 1 / 3, 0.01, 0.99, 100), field("thresholdRatio", "Threshold ratio", "% supply", 2 / 3, 0.01, 0.99, 100), field("outputResistance", "Output resistance", "Ω", 15, 0.1, 10000), field("outputDrop", "Output voltage drop", "V", 1.7, 0, 20)],
};

export const PROPERTY_DEFS = Object.fromEntries(Object.entries(PART_DEFS).map(([type, def]) => [type,
  ORIGINAL_PROPERTY_DEFS[type as PartType] ?? (def.fields ?? []).flatMap((f) => f.kind === "number"
    ? [{ key: f.key, label: f.label, unit: f.unit, default: f.fallback, min: f.min, max: f.max, presets: f.presets }]
    : []),
])) as Record<PartType, PropertyDef[]>;

export function propertyValue(part: Pick<Part, "type" | "props">, key: NumericProp): number {
  const def = PROPERTY_DEFS[part.type].find((f) => f.key === key);
  if (!def) throw new Error(`Unsupported property ${part.type}.${key}`);
  const fallback = key === "forwardVoltage" && part.type === "led" ? LED_SPECS[part.props.color ?? "red"].vf : def.default;
  const value = part.props[key] ?? (key === "voltage" ? part.props.value : undefined) ?? fallback;
  return Number.isFinite(value) && value >= def.min && value <= def.max ? value : fallback;
}

export function validateProperties(part: Part, patch: PartProps): string | null {
  const next = { ...part, props: { ...part.props, ...patch } };
  for (const def of PROPERTY_DEFS[part.type]) {
    const value = next.props[def.key];
    if (value !== undefined && (!Number.isFinite(value) || value < def.min || value > def.max))
      return `${def.label} must be between ${def.min * (def.scale ?? 1)} and ${def.max * (def.scale ?? 1)} ${def.unit}.`;
  }
  const n = (key: NumericProp) => propertyValue(next, key);
  if (part.type === "buzzer" && n("minVoltage") >= n("maxVoltage")) return "Minimum voltage must be below maximum voltage.";
  if (part.type === "ldr" && n("brightResistance") > n("darkResistance")) return "Bright resistance must not exceed dark resistance.";
  if (part.type === "timer555" && n("triggerRatio") >= n("thresholdRatio")) return "Trigger ratio must be below threshold ratio.";
  return null;
}

export function propertySpec(part: Part): string {
  const values = PROPERTY_DEFS[part.type].map((def) => `${def.label}: ${Number((propertyValue(part, def.key) * (def.scale ?? 1)).toPrecision(5))} ${def.unit}`);
  if (part.type === "led") values.unshift(LED_SPECS[part.props.color ?? "red"].label);
  if (part.type === "switch") values.unshift(part.props.closed ? "On" : "Off");
  if (part.type === "button") values.unshift(part.props.normallyClosed ? "Normally closed" : "Normally open");
  if (!values.length) return PART_DEFS[part.type].spec(part.props);
  return values.join(" · ");
}

export function defaultProperties(type: PartType): PartProps {
  return { ...Object.fromEntries(PROPERTY_DEFS[type].map((def) => [def.key, def.default])), ...PART_DEFS[type].defaults };
}
