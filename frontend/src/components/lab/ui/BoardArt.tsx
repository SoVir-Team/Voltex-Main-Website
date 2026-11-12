import { useMemo } from "react";
import { lcdChar } from "../../mcu/devices/hd44780.ts";
import { BOARDS, type BoardType } from "../engine/mcu-boards.ts";
import type { PartState, Screen } from "../engine/solver.ts";

/**
 * The microcontroller boards as they look from above, at real size on the 0.1" grid: header strips with
 * every pin labelled, the chip or module, the USB socket and the on-board LED, which lights with the program.
 */

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

function Label({ x, y, text, size, anchor = "middle", fill = "#ffffff", rotate }: { x: number; y: number; text: string; size: number; anchor?: "start" | "middle" | "end"; fill?: string; rotate?: number }) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={700} fill={fill} textAnchor={anchor} dominantBaseline="central" fontFamily={mono} transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined} pointerEvents="none">
      {text}
    </text>
  );
}

function Uno({ glow, on }: { glow: number; on: boolean }) {
  const spec = BOARDS.uno;
  const top = spec.pins.filter((p) => p.y === 0);
  const bottom = spec.pins.filter((p) => p.y !== 0);
  return (
    <g>
      <path d="M-6.2 -1.4 H19.6 L20.4 -0.6 V19.6 L19.6 20.4 H-6.2 Z" fill="#00878f" stroke="#005f66" strokeWidth={0.12} />
      {/* USB-B socket and barrel jack on the left edge */}
      <rect x={-6.9} y={1.2} width={4.4} height={4.4} fill="#c9ced6" stroke="#8a9099" strokeWidth={0.1} />
      <rect x={-6.6} y={13.6} width={5} height={3.8} fill="#1d1d22" />
      {/* Header strips */}
      <rect x={-0.5} y={-0.5} width={10} height={1} fill="#151518" />
      <rect x={10.5} y={-0.5} width={8} height={1} fill="#151518" />
      <rect x={1.5} y={18.5} width={7} height={1} fill="#151518" />
      <rect x={9.5} y={18.5} width={6} height={1} fill="#151518" />
      {top.map((p) => (
        <Label key={p.id} x={p.x} y={2.1} text={p.label.replace(/^D/, "")} size={0.42} rotate={-90} />
      ))}
      {bottom.map((p) => (
        <Label key={p.id} x={p.x} y={16.9} text={p.label.replace(/\.\d$/, "")} size={0.42} rotate={-90} />
      ))}
      <Label x={14.8} y={3.9} text="DIGITAL (PWM ~ 3 5 6 9 10 11)" size={0.42} />
      <Label x={5} y={15.1} text="POWER" size={0.42} />
      <Label x={12.5} y={15.1} text="ANALOG IN" size={0.42} />
      {/* ATmega328P in its DIP socket */}
      <rect x={5.6} y={10.6} width={12.4} height={2.6} fill="#1d1d22" />
      <circle cx={6.2} cy={11.9} r={0.25} fill="#3a3a40" />
      <Label x={11.8} y={11.9} text="ATMEGA328P" size={0.55} fill="#b8bcc6" />
      {/* 16 MHz crystal */}
      <rect x={-0.8} y={8.4} width={2.6} height={1} rx={0.5} fill="#c9ced6" />
      {/* "L" LED on pin 13, power LED */}
      <rect x={2.5} y={2.6} width={1} height={0.6} fill={glow > 0.02 ? "#ffb020" : "#6b5a33"} />
      {glow > 0.02 && <circle cx={3} cy={2.9} r={1.2} fill="#ffb020" opacity={Math.min(0.6, glow * 0.6)} pointerEvents="none" />}
      <Label x={3} y={3.8} text="L" size={0.4} />
      <rect x={-4.6} y={7.4} width={1} height={0.6} fill={on ? "#38e07b" : "#2f5a3f"} />
      <Label x={-4.1} y={8.6} text="ON" size={0.4} />
      <Label x={-1.5} y={19.4} text="ARDUINO UNO" size={0.7} />
    </g>
  );
}

function Pico({ glow }: { glow: number }) {
  const spec = BOARDS.pico;
  return (
    <g>
      <rect x={-0.65} y={-1.6} width={8.3} height={21.4} rx={0.3} fill="#1e7b45" stroke="#145530" strokeWidth={0.1} />
      {/* Micro-USB at the top edge */}
      <rect x={2.3} y={-2.2} width={2.4} height={1.6} fill="#c9ced6" stroke="#8a9099" strokeWidth={0.08} />
      {spec.pins.map((p) => (
        <Label key={p.id} x={p.x === 0 ? 0.55 : 6.45} y={p.y} text={p.label.replace(/\.\d$/, "")} size={0.34} anchor={p.x === 0 ? "start" : "end"} fill={p.label.startsWith("GND") || p.label === "AGND" ? "#cfe9d8" : "#ffffff"} />
      ))}
      {/* RP2040 and its flash chip */}
      <rect x={2.2} y={8.2} width={2.6} height={2.6} fill="#1d1d22" />
      <Label x={3.5} y={9.5} text="RP2040" size={0.42} fill="#b8bcc6" />
      <rect x={2.6} y={12.4} width={1.8} height={1.2} fill="#1d1d22" />
      {/* BOOTSEL button and the LED on GP25 */}
      <rect x={2.9} y={4.6} width={1.2} height={1.2} fill="#e9e9ee" />
      <rect x={4.6} y={0.3} width={0.8} height={0.5} fill={glow > 0.02 ? "#5dff7a" : "#2d5a3a"} />
      {glow > 0.02 && <circle cx={5} cy={0.55} r={1} fill="#5dff7a" opacity={Math.min(0.6, glow * 0.6)} pointerEvents="none" />}
      <Label x={3.5} y={17.8} text="PICO" size={0.6} />
    </g>
  );
}

function Mega({ glow, on }: { glow: number; on: boolean }) {
  const spec = BOARDS.mega;
  const top = spec.pins.filter((p) => p.y === 0);
  const bottom = spec.pins.filter((p) => p.y === 19);
  const double = spec.pins.filter((p) => p.x >= 31 && p.y > 0 && p.y < 19);
  return (
    <g>
      <path d="M-6.2 -1.4 H33 L33.8 -0.6 V19.6 L33 20.4 H-6.2 Z" fill="#00878f" stroke="#005f66" strokeWidth={0.12} />
      <rect x={-6.9} y={1.2} width={4.4} height={4.4} fill="#c9ced6" stroke="#8a9099" strokeWidth={0.1} />
      <rect x={-6.6} y={13.6} width={5} height={3.8} fill="#1d1d22" />
      {/* Header strips: three on top, three on the bottom, the 2×18 on the right */}
      <rect x={-0.5} y={-0.5} width={10} height={1} fill="#151518" />
      <rect x={10.5} y={-0.5} width={8} height={1} fill="#151518" />
      <rect x={19.5} y={-0.5} width={8} height={1} fill="#151518" />
      <rect x={1.5} y={18.5} width={7} height={1} fill="#151518" />
      <rect x={9.5} y={18.5} width={8} height={1} fill="#151518" />
      <rect x={18.5} y={18.5} width={8} height={1} fill="#151518" />
      <rect x={30.5} y={0.5} width={3} height={18} fill="#151518" />
      {top.map((p) => (
        <Label key={p.id} x={p.x} y={2.1} text={p.label.replace(/^D/, "")} size={0.42} rotate={-90} />
      ))}
      {bottom.map((p) => (
        <Label key={p.id} x={p.x} y={16.9} text={p.label} size={0.42} rotate={-90} />
      ))}
      {double.map((p) => (
        <Label key={p.id} x={p.x === 31 ? 30.1 : 32.9} y={p.y} text={p.label.replace(/^D/, "")} size={0.36} anchor={p.x === 31 ? "end" : "start"} />
      ))}
      <Label x={14.8} y={3.9} text="DIGITAL (PWM ~ 2–13)" size={0.42} />
      <Label x={23.5} y={3.9} text="COMMUNICATION" size={0.42} />
      <Label x={5} y={15.1} text="POWER" size={0.42} />
      <Label x={18} y={15.1} text="ANALOG IN" size={0.42} />
      {/* ATmega2560 (TQFP-100) and the 16 MHz crystal */}
      <rect x={14.2} y={8.2} width={4.6} height={4.6} fill="#1d1d22" transform="rotate(45 16.5 10.5)" />
      <Label x={16.5} y={10.5} text="ATMEGA2560" size={0.42} fill="#b8bcc6" />
      <rect x={-0.8} y={8.4} width={2.6} height={1} rx={0.5} fill="#c9ced6" />
      <rect x={2.5} y={2.6} width={1} height={0.6} fill={glow > 0.02 ? "#ffb020" : "#6b5a33"} />
      {glow > 0.02 && <circle cx={3} cy={2.9} r={1.2} fill="#ffb020" opacity={Math.min(0.6, glow * 0.6)} pointerEvents="none" />}
      <Label x={3} y={3.8} text="L" size={0.4} />
      <rect x={-4.6} y={7.4} width={1} height={0.6} fill={on ? "#38e07b" : "#2f5a3f"} />
      <Label x={-4.1} y={8.6} text="ON" size={0.4} />
      <Label x={-1.5} y={19.4} text="MEGA 2560" size={0.7} />
    </g>
  );
}

type Box = { x: number; y: number; w: number; h: number };

/** How a two-row board looks: its outline, module or chip, USB socket, LEDs and name. */
interface DualLook {
  pcb: string;
  edge: string;
  body: Box;
  /** A shielded module: the antenna strip on top, then the metal can. */
  module?: Box & { antenna: number; text: string };
  /** A bare chip. */
  chip?: Box & { text: string };
  camera?: { x: number; y: number };
  usb: Box[];
  title: { x: number; y: number; text: string; size: number };
  /** The LED the program drives. */
  led: { x: number; y: number; color: string };
  /** The power LED. */
  power: { x: number; y: number };
}

const DUAL: Record<Exclude<BoardType, "uno" | "pico" | "mega">, DualLook> = {
  nano: {
    pcb: "#00878f",
    edge: "#005f66",
    body: { x: -0.55, y: -1.86, w: 7.1, h: 17.72 },
    chip: { x: 2.1, y: 6.3, w: 1.8, h: 1.8, text: "328P" },
    usb: [{ x: 2.1, y: -2.5, w: 1.8, h: 1.6 }],
    title: { x: 3, y: 12.6, text: "NANO", size: 0.5 },
    led: { x: 3, y: 1.6, color: "#ffb020" },
    power: { x: 3, y: 3 },
  },
  esp32dev30: {
    pcb: "#1f2a44",
    edge: "#121a2c",
    body: { x: -1.07, y: -4.6, w: 11.14, h: 20.28 },
    module: { x: 0.95, y: -4.6, w: 7.1, h: 10.04, antenna: 2.4, text: "ESP32-WROOM-32" },
    usb: [{ x: 3.7, y: 15.1, w: 1.6, h: 1.2 }],
    title: { x: 4.5, y: 8.6, text: "ESP32 DEVKIT V1", size: 0.42 },
    led: { x: 6.2, y: 12.2, color: "#4d8dff" },
    power: { x: 2.8, y: 12.2 },
  },
  esp32dev38: {
    pcb: "#1d1f24",
    edge: "#0f1013",
    body: { x: -0.5, y: -2.6, w: 11, h: 21.65 },
    module: { x: 1.45, y: -2.6, w: 7.1, h: 10.04, antenna: 2.4, text: "ESP32-WROOM-32" },
    usb: [{ x: 4.2, y: 18.5, w: 1.6, h: 1.2 }],
    title: { x: 5, y: 11.2, text: "ESP32 DEVKIT", size: 0.42 },
    led: { x: 6.8, y: 15.4, color: "#4d8dff" },
    power: { x: 3.2, y: 15.4 },
  },
  nodemcu: {
    pcb: "#202329",
    edge: "#101215",
    body: { x: -0.62, y: -3.4, w: 10.24, h: 18.9 },
    module: { x: 1.35, y: -3.4, w: 6.3, h: 9.45, antenna: 2.4, text: "ESP8266MOD" },
    chip: { x: 3.6, y: 10.2, w: 1.8, h: 1.8, text: "CP2102" },
    usb: [{ x: 3.7, y: 14.9, w: 1.6, h: 1.2 }],
    title: { x: 4.5, y: 8, text: "NodeMCU", size: 0.5 },
    led: { x: 6.9, y: -0.4, color: "#4d8dff" },
    power: { x: 2.4, y: 13 },
  },
  esp32cam: {
    pcb: "#1b1b1f",
    edge: "#0c0c0e",
    body: { x: -0.81, y: -8.14, w: 10.63, h: 15.94 },
    module: { x: 0.6, y: -7.7, w: 7.8, h: 10.6, antenna: 0, text: "ESP32-S" },
    camera: { x: 4.5, y: -4.6 },
    usb: [],
    title: { x: 4.5, y: 4.4, text: "ESP32-CAM", size: 0.5 },
    led: { x: 1.8, y: 4.4, color: "#fff4c2" },
    power: { x: 7.4, y: 4.4 },
  },
  esp32s3: {
    pcb: "#1d1f24",
    edge: "#0f1013",
    body: { x: -0.5, y: -2.7, w: 10, h: 24.7 },
    module: { x: 0.95, y: -2.7, w: 7.1, h: 10.04, antenna: 2.3, text: "ESP32-S3-WROOM-1" },
    usb: [
      { x: 1.9, y: 21.3, w: 1.8, h: 1.2 },
      { x: 5.3, y: 21.3, w: 1.8, h: 1.2 },
    ],
    title: { x: 4.5, y: 11.5, text: "ESP32-S3-DevKitC-1", size: 0.4 },
    led: { x: 4.5, y: 16.4, color: "#ff5cf0" },
    power: { x: 6.4, y: 18.6 },
  },
  esp32c3: {
    pcb: "#1d1f24",
    edge: "#0f1013",
    body: { x: -0.5, y: -3.4, w: 10, h: 18.9 },
    module: { x: 1.9, y: -3.4, w: 5.2, h: 6.54, antenna: 1.9, text: "C3-MINI-1" },
    usb: [{ x: 3.7, y: 14.9, w: 1.6, h: 1.2 }],
    title: { x: 4.5, y: 6.4, text: "ESP32-C3-DevKitM-1", size: 0.38 },
    led: { x: 4.5, y: 9.6, color: "#ff5cf0" },
    power: { x: 6.4, y: 12.2 },
  },
};

/** A board with two rows of header pins, every pin labelled beside it. */
function DualRowBoard({ type, glow, on }: { type: keyof typeof DUAL; glow: number; on: boolean }) {
  const look = DUAL[type];
  const pins = BOARDS[type].pins;
  const gap = Math.max(...pins.map((p) => p.x));
  const { body, module, chip, camera, led } = look;
  return (
    <g>
      <rect x={body.x} y={body.y} width={body.w} height={body.h} rx={0.3} fill={look.pcb} stroke={look.edge} strokeWidth={0.1} />
      {look.usb.map((u, i) => (
        <rect key={i} x={u.x} y={u.y} width={u.w} height={u.h} fill="#c9ced6" stroke="#8a9099" strokeWidth={0.08} />
      ))}
      {module && (
        <g>
          {module.antenna > 0 && (
            <g>
              <rect x={module.x} y={module.y} width={module.w} height={module.antenna} fill="#2b313b" />
              <path d={`M${module.x + 0.5} ${module.y + module.antenna - 0.5} h1 v-1.2 h1 v1.2 h1 v-1.2 h1 v1.2 h1`} fill="none" stroke="#b8933f" strokeWidth={0.12} />
            </g>
          )}
          <rect x={module.x} y={module.y + module.antenna} width={module.w} height={module.h - module.antenna} fill="#c9ced6" stroke="#9aa0a9" strokeWidth={0.08} />
          <Label x={module.x + module.w / 2} y={module.y + module.antenna + 1.2} text={module.text} size={0.4} fill="#4a4f58" />
        </g>
      )}
      {camera && (
        <g>
          <rect x={camera.x - 1.7} y={camera.y - 1.7} width={3.4} height={3.4} fill="#1d1d22" />
          <circle cx={camera.x} cy={camera.y} r={1.1} fill="#2c3a58" stroke="#5b6b8f" strokeWidth={0.12} />
          <circle cx={camera.x - 0.35} cy={camera.y - 0.35} r={0.25} fill="#9fb4e0" opacity={0.7} />
        </g>
      )}
      {chip && (
        <g>
          <rect x={chip.x} y={chip.y} width={chip.w} height={chip.h} fill="#1d1d22" />
          <Label x={chip.x + chip.w / 2} y={chip.y + chip.h / 2} text={chip.text} size={0.3} fill="#b8bcc6" />
        </g>
      )}
      {pins.map((p) => (
        <text
          key={p.id}
          x={p.x === 0 ? 0.55 : gap - 0.55}
          y={p.y}
          fontSize={0.32}
          fontWeight={700}
          fill={p.label === "GND" ? "#cfe9d8" : "#ffffff"}
          stroke={look.pcb}
          strokeWidth={0.12}
          paintOrder="stroke"
          textAnchor={p.x === 0 ? "start" : "end"}
          dominantBaseline="central"
          fontFamily={mono}
          pointerEvents="none"
        >
          {p.label}
        </text>
      ))}
      <rect x={led.x - 0.4} y={led.y - 0.25} width={0.8} height={0.5} fill={glow > 0.02 ? led.color : "#3a3f48"} />
      {glow > 0.02 && <circle cx={led.x} cy={led.y} r={1} fill={led.color} opacity={Math.min(0.6, glow * 0.6)} pointerEvents="none" />}
      <rect x={look.power.x - 0.4} y={look.power.y - 0.25} width={0.8} height={0.5} fill={on ? "#ff4a4a" : "#5a2f2f"} />
      <Label x={look.title.x} y={look.title.y} text={look.title.text} size={look.title.size} />
    </g>
  );
}

export function McuBoardArt({ type, st }: { type: BoardType; st?: PartState }) {
  const glow = st?.glow ?? 0;
  const on = Boolean(st);
  if (type === "uno") return <Uno glow={glow} on={on} />;
  if (type === "pico") return <Pico glow={glow} />;
  if (type === "mega") return <Mega glow={glow} on={on} />;
  return <DualRowBoard type={type} glow={glow} on={on} />;
}

/** A small two-row board for the Parts list: header pins down both sides, then a module, chip or camera. */
function DualIcon({ pcb, top, usbTop }: { pcb: string; top: "can" | "chip" | "camera"; usbTop?: boolean }) {
  return (
    <g>
      <rect x={2.8} y={0.6} width={4.4} height={8.8} rx={0.2} fill={pcb} />
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <circle cx={3.25} cy={1.4 + i} r={0.17} fill="#e3b04b" />
          <circle cx={6.75} cy={1.4 + i} r={0.17} fill="#e3b04b" />
        </g>
      ))}
      {top === "can" && <rect x={3.7} y={0.6} width={2.6} height={4} fill="#c9ced6" />}
      {top === "chip" && <rect x={4.3} y={4.1} width={1.4} height={1.4} fill="#1d1d22" transform="rotate(45 5 4.8)" />}
      {top === "camera" && (
        <g>
          <rect x={3.6} y={0.9} width={2.8} height={5.4} fill="#c9ced6" />
          <rect x={4.2} y={1.6} width={1.6} height={1.6} fill="#1d1d22" />
          <circle cx={5} cy={2.4} r={0.55} fill="#2c3a58" />
        </g>
      )}
      {top !== "camera" && <rect x={4.3} y={usbTop ? 0.2 : 8.9} width={1.4} height={0.8} fill="#c9ced6" />}
    </g>
  );
}

/** Small pictures for the Parts list, in a 10 × 10 box. */
export function McuBoardIcon({ type }: { type: BoardType }) {
  if (type === "mega")
    return (
      <g>
        <rect x={0.2} y={2.4} width={9.6} height={5.2} rx={0.3} fill="#00878f" />
        <rect x={0} y={3} width={1.2} height={1.2} fill="#c9ced6" />
        <rect x={2} y={2.7} width={6.2} height={0.4} fill="#151518" />
        <rect x={2.6} y={6.9} width={5.6} height={0.4} fill="#151518" />
        <rect x={8.6} y={3.1} width={0.9} height={4} fill="#151518" />
        <rect x={4.4} y={4.2} width={1.6} height={1.6} fill="#1d1d22" transform="rotate(45 5.2 5)" />
      </g>
    );
  if (type === "nano") return <DualIcon pcb="#00878f" top="chip" usbTop />;
  if (type === "esp32cam") return <DualIcon pcb="#1b1b1f" top="camera" />;
  if (type !== "uno" && type !== "pico") return <DualIcon pcb={DUAL[type].pcb} top="can" />;
  return type === "uno" ? (
    <g>
      <rect x={0.8} y={1.8} width={8.6} height={6.6} rx={0.3} fill="#00878f" />
      <rect x={0.4} y={2.6} width={1.6} height={1.6} fill="#c9ced6" />
      <rect x={3} y={2.1} width={6} height={0.5} fill="#151518" />
      <rect x={3.6} y={7.6} width={5} height={0.5} fill="#151518" />
      <rect x={4} y={4.8} width={4.6} height={1} fill="#1d1d22" />
    </g>
  ) : (
    <g>
      <rect x={3} y={0.8} width={4} height={8.6} rx={0.2} fill="#1e7b45" />
      <rect x={4.4} y={0.4} width={1.2} height={0.8} fill="#c9ced6" />
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <circle cx={3.35} cy={1.8 + i} r={0.18} fill="#e3b04b" />
          <circle cx={6.65} cy={1.8 + i} r={0.18} fill="#e3b04b" />
        </g>
      ))}
      <rect x={4.3} y={4.4} width={1.4} height={1.4} fill="#1d1d22" />
    </g>
  );
}

/** The OLED's pixels, drawn as one path of lit runs per row, inside the glass at (x, y), w wide. */
export function OledPixels({ screen, x, y, w, h, color }: { screen: Extract<Screen, { kind: "oled" }>; x: number; y: number; w: number; h: number; color: string }) {
  const d = useMemo(() => {
    if (!screen.on) return "";
    const s = Math.min(w / screen.w, h / screen.h);
    const ox = x + (w - screen.w * s) / 2;
    const oy = y + (h - screen.h * s) / 2;
    let out = "";
    for (let row = 0; row < screen.h; row++) {
      let run = -1;
      for (let col = 0; col <= screen.w; col++) {
        const lit = col < screen.w && (((screen.fb[(row >> 3) * screen.w + col] >> (row & 7)) & 1) === 1) !== screen.invert;
        if (lit && run < 0) run = col;
        else if (!lit && run >= 0) {
          out += `M${(ox + run * s).toFixed(3)} ${(oy + row * s).toFixed(3)}h${((col - run) * s).toFixed(3)}v${s.toFixed(3)}h${(-(col - run) * s).toFixed(3)}z`;
          run = -1;
        }
      }
    }
    return out;
  }, [screen, x, y, w, h]);
  return <path d={d} fill={color} pointerEvents="none" />;
}

/** The LCD's 16×2 characters, with custom characters drawn from their CGRAM bitmaps. */
export function LcdChars({ screen, x, y, w, h, ink, rot }: { screen: Extract<Screen, { kind: "lcd" }>; x: number; y: number; w: number; h: number; ink: string; rot: number }) {
  if (!screen.on) return null;
  const cw = w / 16;
  const rh = h / 2;
  return (
    <g pointerEvents="none">
      {screen.rows.map((codes, r) =>
        codes.map((code, c) => {
          const cx = x + c * cw;
          const cy = y + r * rh;
          const cursor = screen.cursor && screen.cursor.row === r && screen.cursor.col === c ? screen.cursor : null;
          const px = (cw * 0.8) / 5;
          const py = (rh * 0.8) / 8;
          return (
            <g key={`${r}-${c}`}>
              {code < 16 ? (
                Array.from({ length: 8 }, (_, yy) =>
                  Array.from({ length: 5 }, (_, xx) =>
                    (screen.cgram[(code & 7) * 8 + yy] >> (4 - xx)) & 1 ? <rect key={`${yy}-${xx}`} x={cx + cw * 0.1 + xx * px} y={cy + rh * 0.1 + yy * py} width={px * 0.92} height={py * 0.92} fill={ink} /> : null,
                  ),
                )
              ) : code !== 0x20 ? (
                <text x={cx + cw / 2} y={cy + rh / 2} fontSize={rh * 0.78} fontFamily={mono} fontWeight={700} fill={ink} textAnchor="middle" dominantBaseline="central" transform={rot ? `rotate(${-rot} ${cx + cw / 2} ${cy + rh / 2})` : undefined}>
                  {lcdChar(code)}
                </text>
              ) : null}
              {cursor?.show && <rect x={cx + cw * 0.1} y={cy + rh * 0.86} width={cw * 0.8} height={rh * 0.08} fill={ink} />}
              {cursor?.blink && <rect x={cx + cw * 0.1} y={cy + rh * 0.1} width={cw * 0.8} height={rh * 0.8} fill={ink} opacity={0.55} className="lab-blink" />}
            </g>
          );
        }),
      )}
    </g>
  );
}
