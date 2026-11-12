import type { PinDef } from "./parts.ts";

/**
 * Microcontroller boards: the header pins as they sit on the real board (0.1" pitch, one grid unit), and the
 * electrical facts the circuit solver needs to drive and read each GPIO. Figures are datasheet values at the
 * default pin settings: ATmega328P (Uno R3, Nano), ATmega2560 (Mega 2560), RP2040 (Pico), ESP32 (DevKit V1,
 * ESP32-CAM), ESP32-S3, ESP32-C3 and ESP8266 (NodeMCU).
 */

/** Boards the Microcontroller Lab can emulate. */
export type McuBoard = "uno" | "pico";

/** Every board. One placed without a running program has all its GPIO as inputs. */
export type BoardType = McuBoard | "nano" | "mega" | "esp32dev30" | "esp32dev38" | "nodemcu" | "esp32cam" | "esp32s3" | "esp32c3";

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

// ---------- Boards with two rows of header pins ----------

/**
 * Two header rows `gap` grid units apart, each read top to bottom as printed on the board. A name used more
 * than once (GND, 3V3, ...) gets a suffix (GND.1, GND.2), and those pins are joined on the board.
 */
function dualRow(left: string[], right: string[], gap: number): { pins: PinDef[]; tied: string[][] } {
  const seen = new Map<string, number>();
  const id = (label: string) => {
    const n = seen.get(label) ?? 0;
    seen.set(label, n + 1);
    return n ? `${label}.${n}` : label;
  };
  const pins = [...left.map((l, i) => p(id(l), 0, i, l)), ...right.map((l, i) => p(id(l), gap, i, l))];
  const tied = [...seen].filter(([, n]) => n > 1).map(([l, n]) => [l, ...Array.from({ length: n - 1 }, (_, k) => `${l}.${k + 1}`)]);
  return { pins, tied };
}

/** The second and later copies of a repeated pin: nothing to check on them. */
const copies = (pins: PinDef[]) => pins.filter((q) => /\.\d+$/.test(q.id)).map((q) => q.id);

// ---------- Arduino Nano ----------
// USB at the top. Left row: pins 15 down to 1 (D12 … TX); right row: pins 16 to 30 (D13 … VIN). Rows 0.6" apart.
const NANO_PINS = dualRow(
  ["D12", "D11", "D10", "D9", "D8", "D7", "D6", "D5", "D4", "D3", "D2", "GND", "RESET", "D0", "D1"],
  ["D13", "3V3", "AREF", "A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "5V", "RESET", "GND", "VIN"],
  6,
);

export const NANO: BoardSpec = {
  ...UNO,
  name: "Arduino Nano",
  // The Uno's ATmega328P, plus A6 and A7, which are analog inputs only.
  gpio: [...unoGpio, { id: "A6", adc: 6, fn: "Analog in only" }, { id: "A7", adc: 7, fn: "Analog in only" }],
  pins: NANO_PINS.pins,
  tied: NANO_PINS.tied,
  // 3.3 V comes from the USB-serial chip, good for about 50 mA.
  rails: [
    { pin: "5V", v: 5, rint: 0.1 },
    { pin: "3V3", v: 3.3, rint: 2 },
  ],
  inert: ["AREF", "RESET", "VIN", ...copies(NANO_PINS.pins)],
};

// ---------- Arduino Mega 2560 ----------
// The Uno's layout, plus D14–D21 on the top edge, A8–A15 on the bottom edge and a 2×18 header (D22–D53) on the right.
const MEGA_TOP = ["SCL", "SDA", "AREF", "GND", "D13", "D12", "D11", "D10", "D9", "D8"];
const MEGA_TOP2 = ["D7", "D6", "D5", "D4", "D3", "D2", "D1", "D0"];
const MEGA_TOP3 = ["D14", "D15", "D16", "D17", "D18", "D19", "D20", "D21"];
const MEGA_POWER = ["IOREF", "RESET", "3V3", "5V", "GND.1", "GND.2", "VIN"];
const MEGA_ANALOG = Array.from({ length: 16 }, (_, i) => `A${i}`);
const MEGA_DOUBLE = [["5V.1", "5V.2"], ...Array.from({ length: 16 }, (_, i) => [`D${22 + 2 * i}`, `D${23 + 2 * i}`]), ["GND.3", "GND.4"]];
const MEGA_FN: Record<number, string> = {
  0: "RX0 (serial in)",
  1: "TX0 (serial out)",
  2: "PWM · interrupt",
  3: "PWM · interrupt",
  13: "PWM · on-board LED",
  14: "TX3",
  15: "RX3",
  16: "TX2",
  17: "RX2",
  18: "TX1 · interrupt",
  19: "RX1 · interrupt",
  20: "I²C SDA · interrupt",
  21: "I²C SCL · interrupt",
  50: "SPI MISO",
  51: "SPI MOSI",
  52: "SPI SCK",
  53: "SPI SS",
};
const megaPwm = (n: number) => (n >= 2 && n <= 13) || (n >= 44 && n <= 46);
const base = (id: string) => id.replace(/\.\d+$/, "");

export const MEGA: BoardSpec = {
  ...UNO,
  name: "Arduino Mega 2560",
  gpio: [
    ...Array.from({ length: 54 }, (_, n) => ({ id: `D${n}`, pwm: megaPwm(n), fn: MEGA_FN[n] ?? (megaPwm(n) ? "PWM" : undefined) })),
    ...MEGA_ANALOG.map((id, i) => ({ id, adc: i, fn: "Analog in" })),
  ],
  pins: [
    ...MEGA_TOP.map((id, i) => p(id, i, 0)),
    ...MEGA_TOP2.map((id, i) => p(id, 11 + i, 0)),
    ...MEGA_TOP3.map((id, i) => p(id, 20 + i, 0)),
    ...MEGA_POWER.map((id, i) => p(id, 2 + i, 19, base(id))),
    ...MEGA_ANALOG.map((id, i) => p(id, 10 + i + (i >= 8 ? 1 : 0), 19)),
    ...MEGA_DOUBLE.flatMap(([a, b], i) => [p(a, 31, 1 + i, base(a)), p(b, 32, 1 + i, base(b))]),
  ],
  tied: [
    ["GND", "GND.1", "GND.2", "GND.3", "GND.4"],
    ["5V", "5V.1", "5V.2", "IOREF"],
    ["D20", "SDA"],
    ["D21", "SCL"],
  ],
  // 3.3 V from a 150 mA regulator.
  rails: [
    { pin: "5V", v: 5, rint: 0.1 },
    { pin: "3V3", v: 3.3, rint: 1 },
  ],
  inert: ["AREF", "RESET", "VIN", "IOREF", "SDA", "SCL", "GND.1", "GND.2", "GND.3", "GND.4", "5V.1", "5V.2"],
};

// ---------- ESP32 family ----------
// From the ESP32, ESP32-S3 and ESP32-C3 datasheets: an input reads high above 0.75·VDD and low below 0.25·VDD. At the
// default drive strength (2) a pin gives about 20 mA for a 0.66 V drop, and 40 mA at most (strength 3). The internal
// pull-ups are about 45 kΩ. The ADC is 12-bit and reads up to about 3.1 V at the default 11 dB attenuation.
const ESP = { vcc: 3.3, rOut: 33, rPull: 45000, iMax: 0.04, vih: 2.475, vil: 0.825, adcBits: 12, adcRef: 3.3 };

/** GPIO entries for a board's GPIO pins, with each pin's functions from the table. */
function espGpio(pins: PinDef[], gpioOf: (label: string) => number | undefined, fn: Record<number, string>, adc: Record<number, number>, inputOnly: number[] = []): Gpio[] {
  const out: Gpio[] = [];
  for (const q of pins) {
    const n = gpioOf(q.label);
    if (n === undefined) continue;
    out.push({ id: q.id, adc: adc[n], pwm: !inputOnly.includes(n), fn: [`GPIO${n}`, fn[n]].filter(Boolean).join(" · ") });
  }
  return out;
}

/** Reads the GPIO number from a label: "D23" is 23, "IO4" is 4, "5" is 5, plus the board's named pins (TX0, VP, ...). */
const gpioNumber = (named: Record<string, number>) => (label: string) => {
  if (label in named) return named[label];
  const m = /^(?:D|IO)?(\d+)$/.exec(label);
  return m ? Number(m[1]) : undefined;
};

// The original ESP32 (ESP32-WROOM-32 module). GPIO 6–11 run the flash chip and must not be used. ADC2 stops
// working while Wi-Fi is on.
const ESP32_FN: Record<number, string> = {
  0: "Boot strap (BOOT button) · ADC2 · touch",
  1: "UART0 TX (USB serial)",
  2: "Boot strap · on-board LED · ADC2 · touch",
  3: "UART0 RX (USB serial)",
  4: "ADC2 · touch",
  5: "Boot strap · VSPI SS",
  12: "Boot strap: keep low at reset · ADC2 · touch",
  13: "ADC2 · touch",
  14: "ADC2 · touch",
  15: "Boot strap · ADC2 · touch",
  16: "UART2 RX",
  17: "UART2 TX",
  18: "VSPI SCK",
  19: "VSPI MISO",
  21: "I²C SDA",
  22: "I²C SCL",
  23: "VSPI MOSI",
  25: "DAC1 · ADC2",
  26: "DAC2 · ADC2",
  27: "ADC2 · touch",
  32: "ADC1 · touch",
  33: "ADC1 · touch",
  34: "Input only · ADC1",
  35: "Input only · ADC1",
  36: "Input only · ADC1",
  39: "Input only · ADC1",
};
const ESP32_ADC1: Record<number, number> = { 36: 0, 39: 3, 32: 4, 33: 5, 34: 6, 35: 7 };
const ESP32_INPUT_ONLY = [34, 35, 36, 39];
const ESP32_NAMED: Record<string, number> = { VP: 36, VN: 39, TX0: 1, RX0: 3, TX2: 17, RX2: 16, TX: 1, RX: 3 };

// ---------- ESP32 DevKit V1, 30 pins ----------
// Module (antenna) at the top, micro-USB at the bottom. Rows 0.9" apart.
const DEV30 = dualRow(
  ["EN", "VP", "VN", "D34", "D35", "D32", "D33", "D25", "D26", "D27", "D14", "D12", "D13", "GND", "VIN"],
  ["D23", "D22", "TX0", "RX0", "D21", "D19", "D18", "D5", "TX2", "RX2", "D4", "D2", "D15", "GND", "3V3"],
  9,
);

export const ESP32_DEV30: BoardSpec = {
  name: "ESP32 DevKit V1 (30-pin)",
  ...ESP,
  gpio: espGpio(DEV30.pins, gpioNumber(ESP32_NAMED), ESP32_FN, ESP32_ADC1, ESP32_INPUT_ONLY),
  pins: DEV30.pins,
  tied: DEV30.tied,
  // VIN is USB 5 V after the board's protection diode; an AMS1117 makes the 3.3 V.
  rails: [
    { pin: "VIN", v: 4.7, rint: 0.1 },
    { pin: "3V3", v: 3.3, rint: 0.3 },
  ],
  usbPin: "VIN",
  gnd: "GND",
  led: "D2",
  inert: ["EN", ...copies(DEV30.pins)],
};

// ---------- ESP32 DevKit V1, 38 pins (the DevKitC pinout) ----------
// Rows 1.0" apart. SD0–SD3, CMD and CLK are the flash chip's pins (GPIO 6–11).
const DEV38 = dualRow(
  ["3V3", "EN", "VP", "VN", "D34", "D35", "D32", "D33", "D25", "D26", "D27", "D14", "D12", "GND", "D13", "SD2", "SD3", "CMD", "5V"],
  ["GND", "D23", "D22", "TX", "RX", "D21", "GND", "D19", "D18", "D5", "D17", "D16", "D4", "D0", "D2", "D15", "SD1", "SD0", "CLK"],
  10,
);

export const ESP32_DEV38: BoardSpec = {
  name: "ESP32 DevKit V1 (38-pin)",
  ...ESP,
  gpio: espGpio(DEV38.pins, gpioNumber(ESP32_NAMED), ESP32_FN, ESP32_ADC1, ESP32_INPUT_ONLY),
  pins: DEV38.pins,
  tied: DEV38.tied,
  rails: [
    { pin: "5V", v: 4.7, rint: 0.1 },
    { pin: "3V3", v: 3.3, rint: 0.3 },
  ],
  usbPin: "5V",
  gnd: "GND",
  led: "D2",
  inert: ["EN", "SD0", "SD1", "SD2", "SD3", "CMD", "CLK", ...copies(DEV38.pins)],
};

// ---------- ESP32-CAM (AI-Thinker) ----------
// Camera at the top, the 2×8 header at the bottom end. It has no USB socket: the ESP32-CAM-MB base you program it
// through supplies 5 V. The microSD slot uses GPIO 2, 4 and 12–15; GPIO 0 is the camera clock.
const CAM = dualRow(["IO4", "IO2", "IO14", "IO15", "IO13", "IO12", "GND", "5V"], ["GND", "U0T", "U0R", "VCC", "GND", "IO0", "IO16", "3V3"], 9);
const CAM_FN: Record<number, string> = {
  0: "Camera clock · boot strap: tie to GND to flash",
  1: "UART0 TX",
  2: "microSD D0 · boot strap",
  3: "UART0 RX",
  4: "microSD D1 · flash LED",
  12: "microSD D2 · boot strap: keep low at reset",
  13: "microSD D3",
  14: "microSD CLK",
  15: "microSD CMD · boot strap",
  16: "PSRAM chip select: avoid",
};

export const ESP32_CAM: BoardSpec = {
  name: "ESP32-CAM",
  ...ESP,
  gpio: espGpio(CAM.pins, gpioNumber({ U0T: 1, U0R: 3 }), CAM_FN, {}),
  pins: CAM.pins,
  tied: CAM.tied,
  rails: [
    { pin: "5V", v: 5, rint: 0.1 },
    { pin: "3V3", v: 3.3, rint: 0.3 },
  ],
  usbPin: "5V",
  gnd: "GND",
  led: "IO4",
  // VCC gives 3.3 V or 5 V, set by a solder jumper.
  inert: ["VCC", ...copies(CAM.pins)],
};

// ---------- ESP32-S3-DevKitC-1 ----------
// Header J1 on the left, J3 on the right, USB ports at the bottom. Rows 0.9" apart.
const S3 = dualRow(
  ["3V3", "3V3", "RST", "4", "5", "6", "7", "15", "16", "17", "18", "8", "3", "46", "9", "10", "11", "12", "13", "14", "5V", "GND"],
  ["GND", "TX", "RX", "1", "2", "42", "41", "40", "39", "38", "37", "36", "35", "0", "45", "48", "47", "21", "20", "19", "GND", "GND"],
  9,
);
const S3_FN: Record<number, string> = {
  0: "Boot strap (BOOT button)",
  3: "Boot strap · ADC1 · touch",
  19: "USB D− · ADC2",
  20: "USB D+ · ADC2",
  35: "Octal PSRAM on R8 modules: avoid",
  36: "Octal PSRAM on R8 modules: avoid",
  37: "Octal PSRAM on R8 modules: avoid",
  39: "JTAG MTCK",
  40: "JTAG MTDO",
  41: "JTAG MTDI",
  42: "JTAG MTMS",
  43: "UART0 TX (USB serial)",
  44: "UART0 RX (USB serial)",
  45: "Boot strap",
  46: "Boot strap",
  48: "RGB LED (WS2812)",
};
for (let n = 1; n <= 18; n++) S3_FN[n] ??= n <= 10 ? "ADC1 · touch" : n <= 14 ? "ADC2 · touch" : "ADC2";
const S3_ADC1: Record<number, number> = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, i]));

export const ESP32_S3: BoardSpec = {
  name: "ESP32-S3 DevKit",
  ...ESP,
  gpio: espGpio(S3.pins, gpioNumber({ TX: 43, RX: 44 }), S3_FN, S3_ADC1),
  pins: S3.pins,
  tied: S3.tied,
  rails: [
    { pin: "5V", v: 5, rint: 0.1 },
    { pin: "3V3", v: 3.3, rint: 0.3 },
  ],
  usbPin: "5V",
  gnd: "GND",
  led: "48",
  inert: ["RST", ...copies(S3.pins)],
};

// ---------- ESP32-C3-DevKitM-1 ----------
// Header J1 on the left, J3 on the right, micro-USB at the bottom. Rows 0.9" apart.
const C3 = dualRow(
  ["GND", "3V3", "3V3", "IO2", "IO3", "GND", "RST", "GND", "IO0", "IO1", "IO10", "GND", "5V", "5V", "GND"],
  ["GND", "TX", "RX", "GND", "IO9", "IO8", "GND", "IO7", "IO6", "IO5", "IO4", "GND", "IO18", "IO19", "GND"],
  9,
);
const C3_FN: Record<number, string> = {
  0: "ADC1",
  1: "ADC1",
  2: "Boot strap · ADC1",
  3: "ADC1",
  4: "ADC1 · JTAG MTMS",
  5: "ADC2 · JTAG MTDI",
  6: "JTAG MTCK",
  7: "JTAG MTDO",
  8: "Boot strap · RGB LED (WS2812)",
  9: "Boot strap (BOOT button)",
  18: "USB D−",
  19: "USB D+",
  20: "UART0 RX (USB serial)",
  21: "UART0 TX (USB serial)",
};

export const ESP32_C3: BoardSpec = {
  name: "ESP32-C3 DevKit",
  ...ESP,
  gpio: espGpio(C3.pins, gpioNumber({ TX: 21, RX: 20 }), C3_FN, { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 }),
  pins: C3.pins,
  tied: C3.tied,
  rails: [
    { pin: "5V", v: 5, rint: 0.1 },
    { pin: "3V3", v: 3.3, rint: 0.3 },
  ],
  usbPin: "5V",
  gnd: "GND",
  led: "IO8",
  inert: ["RST", ...copies(C3.pins)],
};

// ---------- ESP8266 NodeMCU (v2, Amica) ----------
// Antenna at the top, micro-USB at the bottom. Rows 0.9" apart. SD0–SD3, CMD and CLK run the flash chip.
const NODEMCU_PINS = dualRow(
  ["A0", "RSV", "RSV", "SD3", "SD2", "SD1", "CMD", "SD0", "CLK", "GND", "3V3", "EN", "RST", "GND", "VIN"],
  ["D0", "D1", "D2", "D3", "D4", "3V3", "GND", "D5", "D6", "D7", "D8", "RX", "TX", "GND", "3V3"],
  9,
);

export const NODEMCU: BoardSpec = {
  name: "ESP8266 NodeMCU",
  // ESP8266EX: 3.3 V I/O with thresholds at 0.75·VDD and 0.25·VDD, 12 mA per pin at most, pull-ups of about 50 kΩ.
  // The ADC is 10-bit; the board's 220k/100k divider scales A0 to read 0–3.3 V.
  vcc: 3.3,
  rOut: 55,
  rPull: 50000,
  iMax: 0.012,
  vih: 2.475,
  vil: 0.825,
  adcBits: 10,
  adcRef: 3.3,
  gpio: [
    { id: "D0", fn: "GPIO16 · wake from deep sleep · no PWM or interrupt" },
    { id: "D1", pwm: true, fn: "GPIO5 · I²C SCL" },
    { id: "D2", pwm: true, fn: "GPIO4 · I²C SDA" },
    { id: "D3", pwm: true, fn: "GPIO0 · boot strap (FLASH button)" },
    { id: "D4", pwm: true, fn: "GPIO2 · boot strap · on-board LED (lit when low)" },
    { id: "D5", pwm: true, fn: "GPIO14 · SPI SCK" },
    { id: "D6", pwm: true, fn: "GPIO12 · SPI MISO" },
    { id: "D7", pwm: true, fn: "GPIO13 · SPI MOSI" },
    { id: "D8", pwm: true, fn: "GPIO15 · boot strap: keep low · SPI CS" },
    { id: "RX", pwm: true, fn: "GPIO3 · UART RX (USB serial)" },
    { id: "TX", pwm: true, fn: "GPIO1 · UART TX (USB serial)" },
    { id: "A0", adc: 0, fn: "Analog in, 0–3.3 V" },
  ],
  pins: NODEMCU_PINS.pins,
  // The two RSV pins are unconnected, not joined.
  tied: NODEMCU_PINS.tied.filter((t) => t[0] !== "RSV"),
  rails: [
    { pin: "VIN", v: 4.7, rint: 0.1 },
    { pin: "3V3", v: 3.3, rint: 0.3 },
  ],
  usbPin: "VIN",
  gnd: "GND",
  led: "D4",
  inert: ["RSV", "RSV.1", "SD0", "SD1", "SD2", "SD3", "CMD", "CLK", "EN", "RST", ...copies(NODEMCU_PINS.pins)],
};

export const BOARDS: Record<BoardType, BoardSpec> = {
  uno: UNO,
  pico: PICO,
  nano: NANO,
  mega: MEGA,
  esp32dev30: ESP32_DEV30,
  esp32dev38: ESP32_DEV38,
  nodemcu: NODEMCU,
  esp32cam: ESP32_CAM,
  esp32s3: ESP32_S3,
  esp32c3: ESP32_C3,
};

/** The rail the board's USB input feeds. */
export const usbRail = (spec: BoardSpec) => spec.rails.find((r) => r.pin === spec.usbPin)!;

/** True for every board part. */
export const isMcu = (type: string): type is BoardType => Object.hasOwn(BOARDS, type);

/** How a running program has set a pin, and what it is driving. */
export interface PinDrive {
  mode: "out" | "in" | "pullup" | "pulldown";
  /** Fraction of time the output is high, 0..1 (1 or 0 for a steady output). */
  duty: number;
}

/** Pin drives for one board, by GPIO id. A board with no entry is not running: every pin is an input. */
export type McuDrives = ReadonlyMap<string, Readonly<Record<string, PinDrive>>>;
