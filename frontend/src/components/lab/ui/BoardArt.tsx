import { useMemo } from "react";
import { lcdChar } from "../../mcu/devices/hd44780.ts";
import { BOARDS, type McuBoard } from "../engine/mcu-boards.ts";
import type { PartState, Screen } from "../engine/solver.ts";

/**
 * The two microcontroller boards as they look from above, at real size on the 0.1" grid: header strips with
 * every pin labelled, the chip, the USB socket and the on-board LED, which lights with the program.
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

export function McuBoardArt({ type, st }: { type: McuBoard; st?: PartState }) {
  const glow = st?.glow ?? 0;
  const on = Boolean(st);
  return type === "uno" ? <Uno glow={glow} on={on} /> : <Pico glow={glow} />;
}

/** Small pictures for the Parts list, in a 10 × 10 box. */
export function McuBoardIcon({ type }: { type: McuBoard }) {
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
