import type { PinDef } from "./parts.ts";

/**
 * Microcontroller boards: the header pins as they sit on the real board (0.1" pitch, one grid unit), and the
 * electrical facts the circuit solver needs to drive and read each GPIO. Figures are datasheet values:
 * ATmega328P (Arduino Uno R3) and RP2040 (Raspberry Pi Pico) at their default pin settings.
 */

export type McuBoard = "uno" | "pico";

export interface Gpio {
  /** Header pin id, e.g. "D13" or "GP15". */
  id: string;
  /** ATmega328P port and bit. */
  port?: "B" | "C" | "D";
  bit?: number;
  /** RP2040 GPIO number. */
  gp?: number;
  /** ADC channel for analog-capable pins. */
  adc?: number;
  pwm?: boolean;
  /** Other functions, shown when hovering the pin. */
  fn?: string;
}

export interface BoardSpec {
  name: string;
  /** I/O voltage. */
  vcc: number;
  /** Output driver resistance in ohms (VOH/VOL slope at the datasheet test current). */
  rOut: number;
  /** Internal pull-up / pull-down resistance in ohms. */
  rPull: number;
  /** Absolute maximum current per pin in amps. */
  iMax: number;
  /** Input thresholds in volts. */
  vih: number;
  vil: number;
  /** ADC resolution and full-scale voltage. */
  adcBits: number;
  adcRef: number;
  gpio: Gpio[];
  pins: PinDef[];
  /** Pins joined on the board itself (several GND pins, SDA = A4, ...). */
  tied: string[][];
  /** Supply pins and their voltages, relative to GND. USB is the source. */
  rails: { pin: string; v: number; rint: number }[];
  /** The 5 V input from USB, and the ground the rails refer to. */
  usbPin: string;
  gnd: string;
  /** GPIO that drives the LED soldered on the board. */
  led: string;
  /** Pins that do nothing electrically in the simulation (no warning when unconnected). */
  inert: string[];
}

const p = (id: string, x: number, y: number, label = id): PinDef => ({ id, label, x, y });

// ---------- Arduino Uno R3 ----------
// Top header, left to right as printed on the board: SCL SDA AREF GND D13..D8 | D7..D0.
const UNO_TOP = ["SCL", "SDA", "AREF", "GND", "D13", "D12", "D11", "D10", "D9", "D8"];
const UNO_TOP2 = ["D7", "D6", "D5", "D4", "D3", "D2", "D1", "D0"];
// Bottom header: power, then analog.
const UNO_POWER = ["IOREF", "RESET", "3V3", "5V", "GND.1", "GND.2", "VIN"];
const UNO_ANALOG = ["A0", "A1", "A2", "A3", "A4", "A5"];

const unoGpio: Gpio[] = [
  { id: "D0", port: "D", bit: 0, fn: "RX (serial in)" },
  { id: "D1", port: "D", bit: 1, fn: "TX (serial out)" },
  { id: "D2", port: "D", bit: 2, fn: "INT0" },
  { id: "D3", port: "D", bit: 3, pwm: true, fn: "PWM · INT1" },
  { id: "D4", port: "D", bit: 4 },
  { id: "D5", port: "D", bit: 5, pwm: true, fn: "PWM" },
  { id: "D6", port: "D", bit: 6, pwm: true, fn: "PWM" },
  { id: "D7", port: "D", bit: 7 },
  { id: "D8", port: "B", bit: 0 },
  { id: "D9", port: "B", bit: 1, pwm: true, fn: "PWM" },
  { id: "D10", port: "B", bit: 2, pwm: true, fn: "PWM · SPI SS" },
  { id: "D11", port: "B", bit: 3, pwm: true, fn: "PWM · SPI MOSI" },
  { id: "D12", port: "B", bit: 4, fn: "SPI MISO" },
  { id: "D13", port: "B", bit: 5, fn: "SPI SCK · on-board LED" },
  { id: "A0", port: "C", bit: 0, adc: 0, fn: "Analog in" },
  { id: "A1", port: "C", bit: 1, adc: 1, fn: "Analog in" },
  { id: "A2", port: "C", bit: 2, adc: 2, fn: "Analog in" },
  { id: "A3", port: "C", bit: 3, adc: 3, fn: "Analog in" },
  { id: "A4", port: "C", bit: 4, adc: 4, fn: "Analog in · I²C SDA" },
  { id: "A5", port: "C", bit: 5, adc: 5, fn: "Analog in · I²C SCL" },
];

export const UNO: BoardSpec = {
  name: "Arduino Uno",
  vcc: 5,
  rOut: 25,
  rPull: 35000,
  iMax: 0.04,
  vih: 3.0,
  vil: 1.5,
  adcBits: 10,
  adcRef: 5,
  gpio: unoGpio,
  pins: [
    ...UNO_TOP.map((id, i) => p(id, i, 0, id.startsWith("GND") ? "GND" : id)),
    ...UNO_TOP2.map((id, i) => p(id, 11 + i, 0)),
    ...UNO_POWER.map((id, i) => p(id, 2 + i, 19, id.startsWith("GND") ? "GND" : id)),
    ...UNO_ANALOG.map((id, i) => p(id, 10 + i, 19)),
  ],
  tied: [
    ["GND", "GND.1", "GND.2"],
    ["A4", "SDA"],
    ["A5", "SCL"],
    ["5V", "IOREF"],
  ],
  rails: [
    { pin: "5V", v: 5, rint: 0.1 },
    { pin: "3V3", v: 3.3, rint: 1 },
  ],
  usbPin: "5V",
  gnd: "GND",
  led: "D13",
  inert: ["AREF", "RESET", "VIN", "IOREF", "SDA", "SCL", "GND.1", "GND.2"],
};

// ---------- Raspberry Pi Pico ----------
// Pins 1–20 down the left edge, 40–21 down the right edge, as seen from above with USB at the top.
const PICO_LEFT = ["GP0", "GP1", "GND", "GP2", "GP3", "GP4", "GP5", "GND.1", "GP6", "GP7", "GP8", "GP9", "GND.2", "GP10", "GP11", "GP12", "GP13", "GND.3", "GP14", "GP15"];
const PICO_RIGHT = ["VBUS", "VSYS", "GND.4", "3V3_EN", "3V3", "ADC_VREF", "GP28", "AGND", "GP27", "GP26", "RUN", "GP22", "GND.5", "GP21", "GP20", "GP19", "GP18", "GND.6", "GP17", "GP16"];

const PICO_FN: Record<number, string> = {
  0: "UART0 TX · I²C0 SDA · SPI0 RX",
  1: "UART0 RX · I²C0 SCL · SPI0 CS",
  2: "I²C1 SDA · SPI0 SCK",
  3: "I²C1 SCL · SPI0 TX",
  4: "UART1 TX · I²C0 SDA · SPI0 RX",
  5: "UART1 RX · I²C0 SCL · SPI0 CS",
  16: "SPI0 RX · I²C0 SDA",
  17: "SPI0 CS · I²C0 SCL",
  18: "SPI0 SCK · I²C1 SDA",
  19: "SPI0 TX · I²C1 SCL",
  26: "ADC0 · I²C1 SDA",
  27: "ADC1 · I²C1 SCL",
  28: "ADC2",
};

const picoGpio: Gpio[] = [...Array.from({ length: 23 }, (_, i) => i), 26, 27, 28].map((n) => ({
  id: `GP${n}`,
  gp: n,
  adc: n >= 26 ? n - 26 : undefined,
  pwm: true,
  fn: [PICO_FN[n], "PWM"].filter(Boolean).join(" · "),
}));

export const PICO: BoardSpec = {
  name: "Raspberry Pi Pico",
  vcc: 3.3,
  rOut: 80,
  rPull: 60000,
  iMax: 0.012,
  vih: 2.0,
  vil: 0.8,
  adcBits: 12,
  adcRef: 3.3,
  gpio: picoGpio.filter((g) => [...PICO_LEFT, ...PICO_RIGHT].includes(g.id)),
  pins: [...PICO_LEFT.map((id, i) => p(id, 0, i, id.startsWith("GND") ? "GND" : id)), ...PICO_RIGHT.map((id, i) => p(id, 7, i, id.startsWith("GND") ? "GND" : id))],
  tied: [
    ["GND", "GND.1", "GND.2", "GND.3", "GND.4", "GND.5", "GND.6", "AGND"],
    ["VBUS", "VSYS"],
  ],
  rails: [
    { pin: "VBUS", v: 5, rint: 0.1 },
    { pin: "3V3", v: 3.3, rint: 0.3 },
  ],
  usbPin: "VBUS",
  gnd: "GND",
  led: "GP25",
  inert: ["3V3_EN", "ADC_VREF", "RUN", "VSYS", "AGND", "GND.1", "GND.2", "GND.3", "GND.4", "GND.5", "GND.6"],
};

export const BOARDS: Record<McuBoard, BoardSpec> = { uno: UNO, pico: PICO };

export const isMcu = (type: string): type is McuBoard => type === "uno" || type === "pico";

/** How a running program has set a pin, and what it is driving. */
export interface PinDrive {
  mode: "out" | "in" | "pullup" | "pulldown";
  /** Fraction of time the output is high, 0..1 (1 or 0 for a steady output). */
  duty: number;
}

/** Pin drives for one board, by GPIO id. A board with no entry is not running: every pin is an input. */
export type McuDrives = ReadonlyMap<string, Readonly<Record<string, PinDrive>>>;
