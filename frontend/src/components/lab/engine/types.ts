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
  | "timer555"
  | "dcsource"
  | "gnd"
  | "vcc"
  | "inductor"
  | "spdt"
  | "schottky"
  | "zener"
  | "fuse"
  | "acsource"
  | "pulsegen"
  | "isource"
  | "voltmeter"
  | "ammeter"
  | "multimeter"
  | "scope"
  | "pnp"
  | "nmos"
  | "pmos"
  | "opamp"
  | "lm7805"
  | "ams1117"
  | "relay"
  | "opto"
  | "transformer"
  | "sevenseg"
  | "dcmotor"
  | "servo"
  | "hc595"
  | "pcf8574"
  | "oled"
  | "lcd1602"
  | "header"
  | "usb"
  | "screwterm"
  | "uno"
  | "pico"
  | "nano"
  | "mega"
  | "esp32dev30"
  | "esp32dev38"
  | "nodemcu"
  | "esp32cam"
  | "esp32s3"
  | "esp32c3";

export type LedColor = "red" | "green" | "blue" | "white" | "yellow" | "orange" | "amber" | "pink" | "purple" | "uv" | "ir";

export interface PartProps {
  /**
   * The part's main value: ohms for resistors and pots, farads for capacitors, henries for inductors, volts for
   * sources, amps for current sources and fuses, the turns ratio for a transformer.
   */
  value?: number;
  color?: LedColor;
  /** Switch or button contact closed. For an SPDT switch, true means COM is thrown to A. */
  closed?: boolean;
  /** Potentiometer wiper position, 0..1. */
  pos?: number;
  /** Frequency in hertz for AC and pulse sources. */
  freq?: number;
  /** Pulse duty cycle in percent. */
  duty?: number;
  /** Multimeter function, a part model (e.g. "BC547"), or 7-segment wiring ("cc" or "ca"). */
  mode?: string;
  variant?: string;
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
