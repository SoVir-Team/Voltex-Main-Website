import type { LedColor, Part, PartProps, PartType, Pt, Rot } from "./types.ts";
import { NEW_PARTS } from "./parts-extra.ts";
import { choice, num, volts } from "./units.ts";

export { choice, formatValue, num, parseSI, volts } from "./units.ts";

export interface PinDef {
  id: string;
  label: string;
  x: number;
  y: number;
}

/** An editable property shown in the inspector. Number fields accept SI suffixes such as 4.7k or 100n. */
export type FieldDef =
  | { kind: "number"; key: "value" | "freq" | "duty"; label: string; unit: string; presets: number[]; min: number; max: number; fallback: number }
  | { kind: "choice"; key: "color" | "mode" | "variant"; label: string; options: { value: string; label: string }[]; fallback: string };

export interface PartDef {
  type: PartType;
  name: string;
  prefix: string;
  category: "Power" | "Passive" | "Indicator" | "Switch" | "Active" | "Meter" | "Connector";
  pins: PinDef[];
  /** Body outline in grid units, relative to the part origin before rotation. */
  body: { x: number; y: number; w: number; h: number; round?: boolean };
  defaults: PartProps;
  polarised?: boolean;
  /** One-sentence explanation shown in the inspector. */
  learn: string;
  /** Short spec line, e.g. "9 V · 1.7 Ω internal". */
  spec: (p: PartProps) => string;
  /** Values the student can change. */
  fields?: FieldDef[];
  /** Value text drawn next to the schematic symbol, e.g. "16 V" or "4.7 kΩ". */
  label?: (p: PartProps) => string;
  /** Groups of pins joined on the part itself, such as a board's several GND pins. */
  tied?: string[][];
}

export const LED_SPECS: Record<LedColor, { vf: number; hex: string; label: string }> = {
  red: { vf: 1.9, hex: "#ff3b3b", label: "Red" },
  yellow: { vf: 2.0, hex: "#ffd23b", label: "Yellow" },
  green: { vf: 2.2, hex: "#3bff7a", label: "Green" },
  blue: { vf: 3.0, hex: "#3b8bff", label: "Blue" },
  white: { vf: 3.1, hex: "#f4f7ff", label: "White" },
  orange: { vf: 2.0, hex: "#ff8a1f", label: "Orange" },
  amber: { vf: 2.1, hex: "#ffb31f", label: "Amber" },
  pink: { vf: 3.0, hex: "#ff5fb4", label: "Pink" },
  purple: { vf: 3.2, hex: "#a35bff", label: "Purple" },
  uv: { vf: 3.4, hex: "#7a3bff", label: "Ultraviolet" },
  ir: { vf: 1.3, hex: "#7a2a2a", label: "Infrared" },
};

/** Rated LED current; past LED_BURN_A for long enough it burns out. */
export const LED_RATED_A = 0.02;
export const LED_BURN_A = 0.05;

export const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
export const RESISTOR_VALUES = [10, 22, 47, 100, 150, 220, 330, 470, 680, 1000, 2200, 4700, 10000, 22000, 47000, 68000, 100000, 1000000];
export const CAP_VALUES = [1e-9, 10e-9, 100e-9, 1e-6, 10e-6, 47e-6, 100e-6, 470e-6];

export function formatOhms(r: number): string {
  if (r >= 1e6) return `${trim(r / 1e6)} MΩ`;
  if (r >= 1e3) return `${trim(r / 1e3)} kΩ`;
  return `${trim(r)} Ω`;
}
export function formatFarads(c: number): string {
  if (c >= 1e-6) return `${trim(c * 1e6)} µF`;
  if (c >= 1e-9) return `${trim(c * 1e9)} nF`;
  return `${trim(c * 1e12)} pF`;
}
export function formatSI(v: number, unit: string): string {
  const a = Math.abs(v);
  if (a >= 1) return `${trim(v, 2)} ${unit}`;
  if (a >= 1e-3) return `${trim(v * 1e3, 1)} m${unit}`;
  if (a >= 1e-6) return `${trim(v * 1e6, 1)} µ${unit}`;
  return `0 ${unit}`;
}
function trim(n: number, digits = 2): string {
  return String(Number(n.toFixed(digits)));
}


const BAND = ["#1a1a1a", "#7a4a1d", "#d42a2a", "#ef7d16", "#f2d21b", "#2c9c3f", "#2a5fd4", "#7c3fc4", "#8a8a8a", "#f7f7f7"];
/** Colour bands for a resistor value: two digits, then the multiplier. */
export function resistorBands(r: number): string[] {
  const exp = Math.floor(Math.log10(r)) - 1;
  const digits = Math.round(r / 10 ** exp);
  const d1 = Math.floor(digits / 10) % 10;
  const d2 = digits % 10;
  return [BAND[d1], BAND[d2], BAND[Math.max(0, exp)] ?? BAND[0]];
}

export const PART_DEFS: Record<PartType, PartDef> = {
  battery9v: {
    type: "battery9v",
    name: "Battery",
    prefix: "B",
    category: "Power",
    pins: [
      { id: "+", label: "+", x: 0, y: 0 },
      { id: "-", label: "−", x: 0, y: 2 },
    ],
    body: { x: -6, y: -1, w: 5.2, h: 4 },
    defaults: { value: 9 },
    polarised: true,
    learn: "A battery pushes current from + through your circuit back to −. Its small internal resistance means a short circuit dumps amps of current.",
    spec: (p) => `${volts(p, 9)} · 1.7 Ω internal`,
    fields: [num("value", "Voltage", "V", [1.5, 3, 4.5, 6, 9, 12], 9, 0.1, 48)],
    label: (p) => volts(p, 9),
  },
  coincell: {
    type: "coincell",
    name: "Coin cell",
    prefix: "B",
    category: "Power",
    pins: [
      { id: "+", label: "+", x: 0, y: 0 },
      { id: "-", label: "−", x: 4, y: 0 },
    ],
    body: { x: -0.6, y: -2.2, w: 5.2, h: 4.4, round: true },
    defaults: { value: 3 },
    polarised: true,
    learn: "A CR2032 coin cell gives 3 V. Its internal resistance is high, which is why cheap LED keychains get away without a resistor.",
    spec: (p) => `${volts(p, 3)} · 30 Ω internal`,
    fields: [num("value", "Voltage", "V", [1.5, 3], 3, 0.1, 12)],
    label: (p) => volts(p, 3),
  },
  resistor: {
    type: "resistor",
    name: "Resistor",
    prefix: "R",
    category: "Passive",
    pins: [
      { id: "1", label: "1", x: 0, y: 0 },
      { id: "2", label: "2", x: 4, y: 0 },
    ],
    body: { x: 0.8, y: -0.5, w: 2.4, h: 1 },
    defaults: { value: 330 },
    learn: "A resistor limits current. Ohm's law: current = voltage ÷ resistance. Read the colour bands: two digits, then how many zeros.",
    spec: (p) => `${formatOhms(p.value ?? 330)} · ¼ W`,
    fields: [num("value", "Resistance", "Ω", RESISTOR_VALUES, 330, 0.1, 100e6)],
    label: (p) => formatOhms(p.value ?? 330),
  },
  led: {
    type: "led",
    name: "LED",
    prefix: "D",
    category: "Indicator",
    pins: [
      { id: "A", label: "A", x: 0, y: 0 },
      { id: "K", label: "K", x: 1, y: 0 },
    ],
    body: { x: -0.5, y: -1, w: 2, h: 2, round: true },
    defaults: { color: "red" },
    polarised: true,
    learn: "An LED only conducts from anode (long leg, A) to cathode (flat side, K). It needs a series resistor: R = (supply − LED voltage) ÷ 20 mA.",
    spec: (p) => `${LED_SPECS[p.color ?? "red"].label} · Vf ${LED_SPECS[p.color ?? "red"].vf} V · 20 mA`,
    fields: [{ kind: "choice", key: "color", label: "Colour", fallback: "red", options: (Object.keys(LED_SPECS) as LedColor[]).map((c) => ({ value: c, label: `${LED_SPECS[c].label} · ${LED_SPECS[c].vf} V` })) }],
    label: (p) => LED_SPECS[p.color ?? "red"].label,
  },
  diode: {
    type: "diode",
    name: "Diode 1N4007",
    prefix: "D",
    category: "Passive",
    pins: [
      { id: "A", label: "A", x: 0, y: 0 },
      { id: "K", label: "K", x: 4, y: 0 },
    ],
    body: { x: 1, y: -0.45, w: 2, h: 0.9 },
    defaults: {},
    polarised: true,
    learn: "A diode is a one-way valve for current. The band marks the cathode. It drops about 0.7 V when conducting.",
    spec: () => "1 A · 0.7 V drop",
    label: () => "1N4007",
  },
  ceramic: {
    type: "ceramic",
    name: "Capacitor",
    prefix: "C",
    category: "Passive",
    pins: [
      { id: "1", label: "1", x: 0, y: 0 },
      { id: "2", label: "2", x: 1, y: 0 },
    ],
    body: { x: -0.3, y: -0.9, w: 1.6, h: 1, round: true },
    defaults: { value: 100e-9 },
    learn: "A capacitor stores charge. Small ceramic ones sit next to chips as decoupling, smoothing out quick dips in the supply.",
    spec: (p) => `${formatFarads(p.value ?? 100e-9)} · not polarised`,
    fields: [num("value", "Capacitance", "F", CAP_VALUES.filter((v) => v <= 1e-6), 100e-9, 1e-12, 10e-6)],
    label: (p) => formatFarads(p.value ?? 100e-9),
  },
  electrolytic: {
    type: "electrolytic",
    name: "Polarized capacitor",
    prefix: "C",
    category: "Passive",
    pins: [
      { id: "+", label: "+", x: 0, y: 0 },
      { id: "-", label: "−", x: 1, y: 0 },
    ],
    body: { x: -0.8, y: -1.3, w: 2.6, h: 2.6, round: true },
    defaults: { value: 10e-6 },
    polarised: true,
    learn: "Electrolytic capacitors hold a lot of charge but have polarity. The stripe marks −. Fit one backwards and it can bulge or pop.",
    spec: (p) => `${formatFarads(p.value ?? 10e-6)} · 25 V · polarised`,
    fields: [num("value", "Capacitance", "F", CAP_VALUES.filter((v) => v >= 1e-6), 10e-6, 0.1e-6, 0.1)],
    label: (p) => formatFarads(p.value ?? 10e-6),
  },
  button: {
    type: "button",
    name: "Push button",
    prefix: "SW",
    category: "Switch",
    pins: [
      { id: "1", label: "1", x: 0, y: 0 },
      { id: "2", label: "2", x: 3, y: 0 },
    ],
    body: { x: 0, y: -1.5, w: 3, h: 3 },
    defaults: { closed: false },
    learn: "A tactile push button connects its pins only while pressed. During simulation, press and hold it on the board.",
    spec: () => "Momentary · 50 mA",
  },
  switch: {
    type: "switch",
    name: "Switch (SPST)",
    prefix: "SW",
    category: "Switch",
    pins: [
      { id: "1", label: "1", x: 0, y: 0 },
      { id: "2", label: "2", x: 2, y: 0 },
    ],
    body: { x: -0.4, y: -0.8, w: 2.8, h: 1.6 },
    defaults: { closed: true },
    learn: "A slide switch stays where you put it. In series with a load it works like a light switch. Click it during simulation.",
    spec: (p) => (p.closed ? "On · latching" : "Off · latching"),
  },
  pot: {
    type: "pot",
    name: "Potentiometer",
    prefix: "RV",
    category: "Passive",
    pins: [
      { id: "1", label: "1", x: 0, y: 0 },
      { id: "W", label: "W", x: 1, y: 0 },
      { id: "3", label: "3", x: 2, y: 0 },
    ],
    body: { x: -0.5, y: -3, w: 3, h: 2.6, round: true },
    defaults: { value: 10000, pos: 0.5 },
    learn: "A potentiometer is a resistor with a sliding middle contact (W). Turn it to make any voltage between its two ends.",
    spec: (p) => `${formatOhms(p.value ?? 10000)} · linear`,
    fields: [num("value", "Resistance", "Ω", [1000, 5000, 10000, 50000, 100000, 1000000], 10000, 10, 10e6)],
    label: (p) => formatOhms(p.value ?? 10000),
  },
  npn: {
    type: "npn",
    name: "NPN transistor",
    prefix: "Q",
    category: "Active",
    pins: [
      { id: "E", label: "E", x: 0, y: 0 },
      { id: "B", label: "B", x: 1, y: 0 },
      { id: "C", label: "C", x: 2, y: 0 },
    ],
    body: { x: -0.4, y: -1.6, w: 2.8, h: 1.4 },
    defaults: { variant: "2N2222" },
    learn: "A small current into the base (B) lets a much bigger current flow from collector (C) to emitter (E). It is an electronic switch and an amplifier.",
    spec: (p) => (p.variant === "BC547" ? "β ≈ 300 · 100 mA" : "β ≈ 150 · 600 mA"),
    fields: [choice("variant", "Model", [["2N2222", "2N2222"], ["BC547", "BC547"]])],
    label: (p) => p.variant ?? "2N2222",
  },
  ldr: {
    type: "ldr",
    name: "Light sensor (LDR)",
    prefix: "R",
    category: "Passive",
    pins: [
      { id: "1", label: "1", x: 0, y: 0 },
      { id: "2", label: "2", x: 2, y: 0 },
    ],
    body: { x: -0.2, y: -1.1, w: 2.4, h: 2.2, round: true },
    defaults: {},
    learn: "A light-dependent resistor drops from about 1 MΩ in the dark to about 1 kΩ in bright light. Use the light slider to test it.",
    spec: () => "1 kΩ bright · 1 MΩ dark",
    label: () => "LDR",
  },
  buzzer: {
    type: "buzzer",
    name: "Active buzzer",
    prefix: "BZ",
    category: "Indicator",
    pins: [
      { id: "+", label: "+", x: 0, y: 0 },
      { id: "-", label: "−", x: 3, y: 0 },
    ],
    body: { x: -0.9, y: -2.4, w: 4.8, h: 4.8, round: true },
    defaults: {},
    polarised: true,
    learn: "An active buzzer has its own oscillator inside: give it 3 to 12 V the right way round and it beeps.",
    spec: () => "3–12 V · 25 mA",
    label: () => "Buzzer",
  },
  timer555: {
    type: "timer555",
    name: "555 timer",
    prefix: "U",
    category: "Active",
    pins: [
      { id: "1", label: "GND", x: 0, y: 0 },
      { id: "2", label: "TRIG", x: 1, y: 0 },
      { id: "3", label: "OUT", x: 2, y: 0 },
      { id: "4", label: "RST", x: 3, y: 0 },
      { id: "5", label: "CTRL", x: 3, y: -3 },
      { id: "6", label: "THR", x: 2, y: -3 },
      { id: "7", label: "DIS", x: 1, y: -3 },
      { id: "8", label: "VCC", x: 0, y: -3 },
    ],
    body: { x: -0.5, y: -2.5, w: 4, h: 2 },
    defaults: {},
    learn: "The 555 timer flips its output when a capacitor charges past ⅔ of the supply and back when it falls below ⅓. Two resistors and a capacitor set the blink rate.",
    spec: () => "4.5–15 V · 200 mA out",
    label: () => "NE555",
  },
  ...NEW_PARTS,
};

export const PALETTE: PartType[] = [
  "battery9v",
  "coincell",
  "dcsource",
  "acsource",
  "pulsegen",
  "isource",
  "vcc",
  "gnd",
  "resistor",
  "led",
  "button",
  "switch",
  "spdt",
  "pot",
  "ldr",
  "npn",
  "pnp",
  "nmos",
  "pmos",
  "ceramic",
  "electrolytic",
  "inductor",
  "diode",
  "schottky",
  "zener",
  "fuse",
  "buzzer",
  "timer555",
  "opamp",
  "lm7805",
  "ams1117",
  "relay",
  "opto",
  "transformer",
  "sevenseg",
  "dcmotor",
  "servo",
  "hc595",
  "pcf8574",
  "oled",
  "lcd1602",
  "voltmeter",
  "ammeter",
  "multimeter",
  "scope",
  "header",
  "usb",
  "screwterm",
];

export function rotatePt(p: Pt, rot: Rot): Pt {
  switch (rot) {
    case 90:
      return { x: -p.y, y: p.x };
    case 180:
      return { x: -p.x, y: -p.y };
    case 270:
      return { x: p.y, y: -p.x };
    default:
      return { x: p.x, y: p.y };
  }
}

/** Absolute pin positions for a placed part, in grid units. */
export function pinPositions(part: Part): { id: string; label: string; x: number; y: number }[] {
  return PART_DEFS[part.type].pins.map((pin) => {
    const r = rotatePt(pin, part.rot);
    return { id: pin.id, label: pin.label, x: part.x + r.x, y: part.y + r.y };
  });
}

/** Axis-aligned footprint box after rotation, in grid units. */
export function partBox(part: Part): { x: number; y: number; w: number; h: number } {
  const b = PART_DEFS[part.type].body;
  const pins = PART_DEFS[part.type].pins;
  const pts = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    ...pins.flatMap((p) => [
      { x: p.x - 0.4, y: p.y - 0.4 },
      { x: p.x + 0.4, y: p.y + 0.4 },
    ]),
  ].map((p) => rotatePt(p, part.rot));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x: part.x + x, y: part.y + y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function newPartId(type: PartType, parts: Part[]): string {
  const prefix = PART_DEFS[type].prefix;
  let n = 1;
  while (parts.some((p) => p.id === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
