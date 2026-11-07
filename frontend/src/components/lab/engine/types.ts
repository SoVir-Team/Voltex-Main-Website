/**
 * Board model for the Student Lab. Positions are in grid units: 1 unit = 2.54 mm (0.1 in), the pitch of
 * through-hole parts. Parts sit on whole units; traces and vias may use half units.
 */
export type Layer = "top" | "bottom";
export type Rot = 0 | 90 | 180 | 270;

export type PartType =
  | "battery9v"
  | "coincell"
  | "resistor"
  | "led"
  | "diode"
  | "ceramic"
  | "electrolytic"
  | "button"
  | "switch"
  | "pot"
  | "npn"
  | "ldr"
  | "buzzer"
  | "timer555";

export type LedColor = "red" | "green" | "blue" | "white" | "yellow";

export interface PartProps {
  /** Ohms for resistors and pots, farads for capacitors. */
  value?: number;
  color?: LedColor;
  /** Switch or button contact closed. */
  closed?: boolean;
  /** Potentiometer wiper position, 0..1. */
  pos?: number;
}

export interface Part {
  id: string;
  type: PartType;
  x: number;
  y: number;
  rot: Rot;
  props: PartProps;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Trace {
  id: string;
  layer: Layer;
  /** Copper width in millimetres. */
  width: number;
  points: Pt[];
}

export interface Via {
  id: string;
  x: number;
  y: number;
}

export interface Board {
  w: number;
  h: number;
  parts: Part[];
  traces: Trace[];
  vias: Via[];
}

/** A pin reference such as "R1.1" or "B1.+". */
export type PinRef = string;

export const MM = 2.54;
