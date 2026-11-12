import type { ReactNode } from "react";
import { LED_SPECS, PART_DEFS, resistorBands } from "../engine/parts.ts";
import type { PartState } from "../engine/solver.ts";
import type { Part, PartType } from "../engine/types.ts";
import { MM } from "../engine/types.ts";
import { PAD_R } from "../engine/netlist.ts";
import { SKIN, type Skin } from "./PartGlyph.tsx";
import { McuBoardIcon } from "./BoardArt.tsx";

/**
 * Pictures of parts for the Parts list, so students recognise them by sight. On the board the same parts are
 * drawn as schematic symbols (see Symbol.tsx).
 */

const PAD = PAD_R / MM;
const DRILL = 0.4 / MM;

/** The real-looking part as it sits on a board: used for the original parts in the Parts list. */
function Body({ part, st, skin }: { part: Part; st?: PartState; skin: Skin }) {
  const b = PART_DEFS[part.type].body;
  const burnt = st?.burnt;
  const dark = burnt ? "#2a2523" : undefined;
  switch (part.type) {
    case "battery9v":
      return (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.35} fill={dark ?? "#24242a"} />
          <rect x={b.x} y={b.y} width={1.5} height={b.h} rx={0.3} fill="#2ba9da" />
          <text x={b.x + 3.3} y={b.y + b.h / 2 + 0.45} fontSize={1.3} fontWeight={800} fill="#f3f6fb" textAnchor="middle">9V</text>
          <path d={`M${b.x + b.w} 0 H0 M${b.x + b.w} 2 H0`} stroke="#c94848" strokeWidth={0.12} />
          <path d={`M${b.x + b.w} 2 H0`} stroke="#1d1d1d" strokeWidth={0.12} />
        </g>
      );
    case "coincell":
      return (
        <g>
          <circle cx={2} cy={0} r={2.1} fill={dark ?? "#b9bfca"} />
          <circle cx={2} cy={0} r={1.6} fill={dark ?? "#d4d9e1"} />
          <text x={2} y={0.35} fontSize={0.9} fontWeight={800} fill="#3b3f4a" textAnchor="middle">CR2032</text>
        </g>
      );
    case "resistor": {
      const bands = resistorBands(part.props.value ?? 330);
      return (
        <g>
          <path d="M0 0 H4" stroke="#a7a9b4" strokeWidth={0.14} />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.45} fill={dark ?? "#e7cf9c"} />
          {!burnt &&
            [...bands, "#c9a33a"].map((c, i) => <rect key={i} x={1.25 + i * 0.42 + (i === 3 ? 0.25 : 0)} y={b.y} width={0.2} height={b.h} fill={c} />)}
        </g>
      );
    }
    case "led": {
      const spec = LED_SPECS[part.props.color ?? "red"];
      const glow = st?.glow ?? 0;
      return (
        <g>
          {glow > 0 && <circle cx={0.5} cy={0} r={1.4 + glow * 2.4} fill={spec.hex} opacity={0.18 + glow * 0.4} filter="url(#lab-glow)" />}
          <circle cx={0.5} cy={0} r={1} fill={burnt ? "#3a2f2f" : spec.hex} opacity={burnt ? 1 : 0.35 + glow * 0.65} stroke={skin.silk} strokeWidth={0.08} />
          <path d="M1.32 -0.58 A1 1 0 0 1 1.32 0.58" fill="none" stroke={skin.silk} strokeWidth={0.16} />
          {glow > 0.1 && <circle cx={0.3} cy={-0.3} r={0.3} fill="#fff" opacity={glow * 0.9} />}
        </g>
      );
    }
    case "diode":
      return (
        <g>
          <path d="M0 0 H4" stroke="#a7a9b4" strokeWidth={0.14} />
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.2} fill={dark ?? "#1c1c1f"} />
          <rect x={b.x + b.w - 0.45} y={b.y} width={0.25} height={b.h} fill="#c9cbd3" />
        </g>
      );
    case "ceramic":
      return <ellipse cx={0.5} cy={-0.4} rx={0.85} ry={0.5} fill={dark ?? "#d58a2c"} />;
    case "electrolytic":
      return (
        <g>
          <circle cx={0.5} cy={0} r={1.3} fill={dark ?? "#1f3f8c"} />
          <path d="M1.2 -1.08 A1.3 1.3 0 0 1 1.2 1.08 Z" fill={burnt ? "#3d3530" : "#c7d1e8"} />
          <path d="M0.5 -0.7 V0.7 M-0.2 0 H1.2" stroke="#9fb0d8" strokeWidth={0.08} opacity={0.6} />
        </g>
      );
    case "button":
      return (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.2} fill={dark ?? "#2a2a2e"} />
          <circle cx={1.5} cy={0} r={0.85} fill={st?.on ? "#1a1a1d" : "#3d3d44"} stroke="#55555e" strokeWidth={0.08} />
        </g>
      );
    case "switch":
      return (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.2} fill={dark ?? "#34343c"} />
          <rect x={part.props.closed ? 1.15 : 0.05} y={-0.45} width={0.8} height={0.9} rx={0.12} fill="#e6e8ee" />
        </g>
      );
    case "pot":
      return (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.3} fill={dark ?? "#2457a6"} />
          <circle cx={1} cy={-1.7} r={0.9} fill="#e8e9ee" />
          <path d={`M1 -1.7 L${1 + 0.8 * Math.cos(Math.PI * (0.75 + 1.5 * (part.props.pos ?? 0.5)))} ${-1.7 + 0.8 * Math.sin(Math.PI * (0.75 + 1.5 * (part.props.pos ?? 0.5)))}`} stroke="#2457a6" strokeWidth={0.18} strokeLinecap="round" />
        </g>
      );
    case "npn":
      return (
        <g>
          <path d="M-0.4 -0.3 H2.4 A1.4 1.3 0 0 0 -0.4 -0.3 Z" fill={dark ?? "#1c1c20"} transform="translate(0 -0.1)" />
          <text x={1} y={-0.75} fontSize={0.45} fill="#b9bccb" textAnchor="middle" fontWeight={700}>2N2222</text>
        </g>
      );
    case "ldr":
      return (
        <g>
          <circle cx={1} cy={0} r={1.1} fill={dark ?? "#e7d6b5"} />
          <path d="M0.3 -0.5 H1.5 V-0.2 H0.5 V0.1 H1.5 V0.4 H0.5" fill="none" stroke="#c4462e" strokeWidth={0.14} />
        </g>
      );
    case "buzzer":
      return (
        <g>
          <circle cx={1.5} cy={0} r={2.4} fill={dark ?? "#1b1b1e"} />
          <circle cx={1.5} cy={0} r={0.45} fill="#0b0b0c" />
          {st?.on && <circle cx={1.5} cy={0} r={2.4} fill="none" stroke="#2ba9da" strokeWidth={0.12} className="lab-ring" />}
        </g>
      );
    case "timer555":
      return (
        <g>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={0.12} fill={dark ?? "#18181b"} />
          <path d={`M${b.x} -1.9 A0.4 0.4 0 0 1 ${b.x} -1.1`} fill="none" stroke="#505058" strokeWidth={0.1} />
          <circle cx={b.x + 0.45} cy={-0.85} r={0.14} fill="#505058" />
          <text x={1.6} y={-1.3} fontSize={0.62} fill="#d2d4dc" textAnchor="middle" fontWeight={700}>NE555</text>
          {st?.on && <circle cx={3.1} cy={-2.1} r={0.14} fill="#3bff7a" />}
        </g>
      );
      default:
      return null;
  }
}

const LEG = "#a7adb8";
const leg = (x: number, y1: number, y2: number, k?: number) => <line key={k ?? x} x1={x} y1={y1} x2={x} y2={y2} stroke={LEG} strokeWidth={0.32} strokeLinecap="round" />;
const legs = (xs: number[], y1: number, y2: number) => xs.map((x, i) => leg(x, y1, y2, i));
const label = (x: number, y: number, text: string, size = 0.9, fill = "#e8eaf0") => (
  <text x={x} y={y} fontSize={size} fontWeight={800} fill={fill} textAnchor="middle" fontFamily="ui-sans-serif, system-ui">
    {text}
  </text>
);

/** Dual in-line chip, n pins, seen from above. */
function Dip({ n, text, body = "#1d1d22", ink = "#d9dbe3" }: { n: number; text: string; body?: string; ink?: string }) {
  const per = n / 2;
  const pitch = 7.4 / per;
  const xs = Array.from({ length: per }, (_, i) => 1.3 + pitch * (i + 0.5));
  return (
    <g>
      {xs.map((x, i) => (
        <g key={i}>
          <rect x={x - 0.22} y={2.1} width={0.44} height={0.9} fill={LEG} />
          <rect x={x - 0.22} y={7} width={0.44} height={0.9} fill={LEG} />
        </g>
      ))}
      <rect x={1.1} y={2.9} width={7.8} height={4.2} rx={0.3} fill={body} />
      <path d="M1.1 4.4 A0.6 0.6 0 0 1 1.1 5.6" fill="none" stroke="#55555e" strokeWidth={0.15} />
      {label(5, 5.35, text, text.length > 6 ? 1 : 1.2, ink)}
    </g>
  );
}

/** TO-92 transistor: flat face, three legs. */
function To92({ text }: { text: string }) {
  return (
    <g>
      {legs([3.8, 5, 6.2], 6.2, 9.5)}
      <path d="M2.6 6.4 H7.4 V3.6 A2.4 2.4 0 0 0 2.6 3.6 Z" fill="#1c1c20" />
      {label(5, 5.4, text, 0.85, "#b9bccb")}
    </g>
  );
}

/** TO-220 power package with its metal tab. */
function To220({ text }: { text: string }) {
  return (
    <g>
      <rect x={2.6} y={0.6} width={4.8} height={3} rx={0.2} fill="#c3c7cf" />
      <circle cx={5} cy={1.9} r={0.75} fill="#f3f4f6" />
      <rect x={2.6} y={3.3} width={4.8} height={3.6} rx={0.2} fill="#1d1d22" />
      {legs([3.7, 5, 6.3], 6.9, 9.6)}
      {label(5, 5.5, text, text.length > 5 ? 0.9 : 1.05, "#d9dbe3")}
    </g>
  );
}

/** Instrument box with a screen, for supplies, generators and the oscilloscope. */
function Bench({ screen, colour = "#d9dde4" }: { screen: ReactNode; colour?: string }) {
  return (
    <g>
      <rect x={0.5} y={1.8} width={9} height={6.6} rx={0.5} fill={colour} stroke="#9aa0ad" strokeWidth={0.15} />
      <rect x={1.2} y={2.6} width={5} height={3} rx={0.2} fill="#10231b" />
      {screen}
      <circle cx={7.7} cy={3.3} r={0.75} fill="#5d6270" />
      <circle cx={7.7} cy={5.4} r={0.55} fill="#5d6270" />
      <circle cx={2.4} cy={7.1} r={0.55} fill="#d42a2a" />
      <circle cx={4} cy={7.1} r={0.55} fill="#1d1d22" />
    </g>
  );
}

/** Analog panel meter with a needle. */
function Meter({ letter }: { letter: string }) {
  return (
    <g>
      <rect x={0.8} y={1.2} width={8.4} height={7.6} rx={0.5} fill="#2b2d36" />
      <rect x={1.5} y={1.9} width={7} height={5} rx={0.3} fill="#f4f1e6" />
      <path d="M2.4 5.6 A3 3 0 0 1 7.6 5.6" fill="none" stroke="#2b2d36" strokeWidth={0.15} />
      <line x1={5} y1={6.6} x2={6.6} y2={3.6} stroke="#d42a2a" strokeWidth={0.18} />
      {label(5, 6.5, letter, 1.2, "#2b2d36")}
      <circle cx={3} cy={7.9} r={0.4} fill="#d42a2a" />
      <circle cx={7} cy={7.9} r={0.4} fill="#111" />
    </g>
  );
}

/** Small breakout board with a header along one edge. */
function Module({ pins, children, colour = "#1f5fbf" }: { pins: number; children: ReactNode; colour?: string }) {
  const xs = Array.from({ length: pins }, (_, i) => 5 - ((pins - 1) * 0.7) / 2 + i * 0.7);
  return (
    <g>
      <rect x={0.6} y={1} width={8.8} height={8} rx={0.4} fill={colour} />
      {xs.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={1.8} r={0.25} fill="#e3b04b" />
          <circle cx={x} cy={1.8} r={0.1} fill="#1d1d22" />
        </g>
      ))}
      {children}
    </g>
  );
}

const seg = (on: boolean) => (on ? "#ff3b3b" : "#3a2a2a");

/** Pictures of the parts added for the full component list, in a 10 × 10 box. */
function NewImage({ type }: { type: PartType }): ReactNode {
  switch (type) {
    case "dcsource":
      return <Bench screen={label(3.7, 4.55, "5.00V", 1.3, "#45f08a")} />;
    case "acsource":
      return <Bench screen={<path d="M1.6 4.1 C2.2 2.6 2.8 2.6 3.4 4.1 S4.6 5.6 5.2 4.1" fill="none" stroke="#45f08a" strokeWidth={0.2} />} />;
    case "pulsegen":
      return <Bench colour="#c8d4e6" screen={<path d="M1.6 4.8 H2.4 V3.2 H3.6 V4.8 H4.6 V3.2 H5.8" fill="none" stroke="#45f08a" strokeWidth={0.2} />} />;
    case "isource":
      return <Bench colour="#e6dcc8" screen={label(3.7, 4.55, "10mA", 1.2, "#45f08a")} />;
    case "vcc":
      return (
        <g>
          <rect x={1.5} y={3} width={7} height={4} rx={0.6} fill="#d42a2a" />
          {label(5, 5.6, "VCC", 1.8, "#fff")}
          <path d="M5 0.8 L6.4 2.6 H3.6 Z" fill="#d42a2a" />
        </g>
      );
    case "gnd":
      return (
        <g>
          <rect x={1.5} y={1} width={7} height={8} rx={0.6} fill="#1f8a4c" />
          <path d="M5 2.2 V4.8 M2.8 4.8 H7.2 M3.6 6 H6.4 M4.4 7.2 H5.6" stroke="#fff" strokeWidth={0.45} strokeLinecap="round" />
        </g>
      );
    case "inductor":
      return (
        <g>
          {leg(3, 6.5, 9.6)}
          {leg(7, 6.5, 9.6)}
          <circle cx={5} cy={4.6} r={3.3} fill="none" stroke="#3a3a3a" strokeWidth={1.7} />
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            return <line key={i} x1={5 + 2.3 * Math.cos(a)} y1={4.6 + 2.3 * Math.sin(a)} x2={5 + 4.2 * Math.cos(a)} y2={4.6 + 4.2 * Math.sin(a)} stroke="#c87533" strokeWidth={0.35} />;
          })}
        </g>
      );
    case "spdt":
      return (
        <g>
          {legs([3, 5, 7], 6.4, 9.4)}
          <rect x={1.2} y={3.6} width={7.6} height={3} rx={0.2} fill="#34343c" />
          <rect x={5.4} y={2.4} width={1.6} height={2} rx={0.2} fill="#e6e8ee" />
        </g>
      );
    case "schottky":
    case "zener":
      return (
        <g>
          <line x1={0.4} y1={5} x2={9.6} y2={5} stroke={LEG} strokeWidth={0.32} />
          <rect x={2.8} y={3.9} width={4.4} height={2.2} rx={0.4} fill={type === "zener" ? "#e8a06a" : "#262629"} />
          <rect x={6} y={3.9} width={0.6} height={2.2} fill={type === "zener" ? "#1d1d22" : "#c9cbd3"} />
        </g>
      );
    case "fuse":
      return (
        <g>
          <rect x={2.6} y={3.6} width={4.8} height={2.8} fill="#dff1fb" stroke="#a9c6d6" strokeWidth={0.15} />
          <line x1={2.6} y1={5} x2={7.4} y2={5} stroke="#8a8f99" strokeWidth={0.12} />
          <rect x={0.8} y={3.4} width={1.9} height={3.2} rx={0.25} fill="#c3c7cf" />
          <rect x={7.3} y={3.4} width={1.9} height={3.2} rx={0.25} fill="#c3c7cf" />
        </g>
      );
    case "voltmeter":
      return <Meter letter="V" />;
    case "ammeter":
      return <Meter letter="A" />;
    case "multimeter":
      return (
        <g>
          <rect x={2} y={0.4} width={6} height={9.2} rx={0.8} fill="#f2c218" />
          <rect x={2.6} y={1.1} width={4.8} height={2.4} rx={0.2} fill="#c9d3c0" />
          {label(5, 2.75, "8.88", 1.3, "#2b2d36")}
          <circle cx={5} cy={5.6} r={1.5} fill="#2b2d36" />
          <line x1={5} y1={5.6} x2={5.9} y2={4.7} stroke="#f3f4f6" strokeWidth={0.25} />
          <circle cx={3.6} cy={8.4} r={0.45} fill="#d42a2a" />
          <circle cx={6.4} cy={8.4} r={0.45} fill="#111" />
        </g>
      );
    case "scope":
      return (
        <Bench
          colour="#b9c0cc"
          screen={
            <g>
              <path d="M1.4 4.1 C2 2.8 2.6 2.8 3.2 4.1 S4.4 5.4 5 4.1" fill="none" stroke="#ffd23b" strokeWidth={0.18} />
              <path d="M1.4 5 H2.6 V3.4 H3.8 V5 H5" fill="none" stroke="#3be0ff" strokeWidth={0.14} />
            </g>
          }
        />
      );
    case "pnp":
      return <To92 text="PNP" />;
    case "nmos":
      return <To220 text="IRF540" />;
    case "pmos":
      return <To220 text="IRF9540" />;
    case "opamp":
      return <Dip n={8} text="LM358" />;
    case "lm7805":
      return <To220 text="7805" />;
    case "ams1117":
      return (
        <g>
          <rect x={2.6} y={1.2} width={4.8} height={1.6} fill="#c3c7cf" />
          <rect x={2} y={2.6} width={6} height={4.4} rx={0.3} fill="#1d1d22" />
          {legs([3.4, 5, 6.6], 7, 8.8)}
          {label(5, 5.2, "1117", 1.1, "#d9dbe3")}
        </g>
      );
    case "relay":
      return (
        <g>
          {legs([2.5, 4, 6, 7.5], 8.2, 9.6)}
          <rect x={1.2} y={1.2} width={7.6} height={7} rx={0.3} fill="#2b62c4" />
          {label(5, 4.4, "RELAY", 1.2, "#fff")}
          {label(5, 6, "5V DC", 0.9, "#cfe0ff")}
        </g>
      );
    case "opto":
      return <Dip n={4} text="PC817" body="#ececea" ink="#2b2d36" />;
    case "transformer":
      return (
        <g>
          {legs([2.2, 3.4, 6.6, 7.8], 8.4, 9.7)}
          <rect x={0.8} y={1.6} width={8.4} height={6.8} fill="#6d727d" />
          {[2.2, 3, 3.8, 4.6, 5.4, 6.2, 7].map((y) => (
            <line key={y} x1={0.8} y1={y} x2={9.2} y2={y} stroke="#555a64" strokeWidth={0.12} />
          ))}
          <rect x={3} y={1.2} width={4} height={7.6} rx={0.6} fill="#c87533" />
          <rect x={3} y={4.7} width={4} height={0.6} fill="#9a5520" />
        </g>
      );
    case "sevenseg":
      return (
        <g>
          <rect x={1.6} y={0.6} width={6.8} height={8.8} rx={0.3} fill="#1b1b1f" />
          <g strokeWidth={0.65} strokeLinecap="round">
            <line x1={3.6} y1={2} x2={6.2} y2={2} stroke={seg(true)} />
            <line x1={6.5} y1={2.4} x2={6.3} y2={4.6} stroke={seg(true)} />
            <line x1={6.3} y1={5.4} x2={6.1} y2={7.6} stroke={seg(true)} />
            <line x1={3.4} y1={8} x2={5.9} y2={8} stroke={seg(true)} />
            <line x1={3.2} y1={5.4} x2={3} y2={7.6} stroke={seg(false)} />
            <line x1={3.5} y1={2.4} x2={3.3} y2={4.6} stroke={seg(false)} />
            <line x1={3.4} y1={5} x2={6} y2={5} stroke={seg(true)} />
          </g>
          <circle cx={7.2} cy={8} r={0.35} fill={seg(false)} />
        </g>
      );
    case "dcmotor":
      return (
        <g>
          <rect x={1} y={2.4} width={6.6} height={5.2} rx={1} fill="#c9ccd3" />
          <rect x={1} y={2.4} width={1.6} height={5.2} rx={0.6} fill="#9aa0ad" />
          <rect x={7.4} y={3.9} width={1.4} height={2.2} rx={0.3} fill="#9aa0ad" />
          <line x1={8.8} y1={5} x2={9.8} y2={5} stroke="#6d727d" strokeWidth={0.4} />
          <rect x={1.6} y={3.2} width={0.5} height={0.9} fill="#d42a2a" />
          <rect x={1.6} y={5.9} width={0.5} height={0.9} fill="#1d1d22" />
        </g>
      );
    case "servo":
      return (
        <g>
          <rect x={1.4} y={3} width={7.2} height={5.2} rx={0.3} fill="#2756c5" />
          <rect x={0.6} y={4.2} width={8.8} height={0.8} fill="#2756c5" />
          <circle cx={3.6} cy={3.4} r={1.1} fill="#f3f4f6" />
          <path d="M3.6 3.4 L8 2" stroke="#f3f4f6" strokeWidth={0.9} strokeLinecap="round" />
          {label(5, 7, "SG90", 0.9, "#dbe5ff")}
        </g>
      );
    case "hc595":
      return <Dip n={16} text="74HC595" />;
    case "pcf8574":
      return (
        <Module pins={6}>
          <rect x={3} y={3.6} width={4} height={4} fill="#1d1d22" />
          {label(5, 5.9, "8574", 0.9, "#d9dbe3")}
        </Module>
      );
    case "oled":
      return (
        <Module pins={4} colour="#1d1d22">
          <rect x={1.2} y={2.8} width={7.6} height={5.4} fill="#071728" />
          {label(5, 5, "Hello", 1.2, "#7fd7ff")}
          <path d="M2 6.4 H8 M2 7.2 H6" stroke="#7fd7ff" strokeWidth={0.2} />
        </Module>
      );
    case "lcd1602":
      return (
        <g>
          <rect x={0.2} y={1.6} width={9.6} height={6.8} rx={0.3} fill="#1f6f3f" />
          <rect x={0.8} y={2.8} width={8.4} height={4.4} fill="#1d1d22" />
          <rect x={1.2} y={3.3} width={7.6} height={3.4} fill="#9bc53d" />
          {[0, 1].map((r) => [0, 1, 2, 3, 4, 5, 6, 7].map((c) => <rect key={`${r}-${c}`} x={1.5 + c * 0.9} y={3.7 + r * 1.5} width={0.7} height={1.1} fill="#86ad31" />))}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <circle key={i} cx={1.6 + i * 0.5} cy={2.2} r={0.15} fill="#e3b04b" />
          ))}
        </g>
      );
    case "header":
      return (
        <g>
          <rect x={0.8} y={4} width={8.4} height={2} fill="#1d1d22" />
          {[2, 4, 6, 8].map((x) => (
            <rect key={x} x={x - 0.3} y={1.2} width={0.6} height={7.6} fill="#e3b04b" />
          ))}
        </g>
      );
    case "usb":
      return (
        <g>
          <rect x={1} y={2.4} width={8} height={5.2} rx={0.3} fill="#c3c7cf" stroke="#8a8f99" strokeWidth={0.15} />
          <rect x={2} y={3.6} width={6} height={1.6} fill="#1d1d22" />
          <rect x={2} y={5.2} width={6} height={1.2} fill="#f3f4f6" />
        </g>
      );
    case "uno":
    case "pico":
    case "nano":
    case "mega":
    case "esp32dev30":
    case "esp32dev38":
    case "nodemcu":
    case "esp32cam":
    case "esp32s3":
    case "esp32c3":
      return <McuBoardIcon type={type} />;
    case "screwterm":
      return (
        <g>
          <rect x={1.2} y={2} width={7.6} height={6} rx={0.3} fill="#2f9a55" />
          {[3.2, 6.8].map((x) => (
            <g key={x}>
              <circle cx={x} cy={4.4} r={1.2} fill="#c3c7cf" />
              <line x1={x - 0.8} y1={4.4} x2={x + 0.8} y2={4.4} stroke="#6d727d" strokeWidth={0.3} />
              <rect x={x - 0.9} y={6.2} width={1.8} height={1.2} fill="#1d1d22" />
            </g>
          ))}
        </g>
      );
    default:
      return null;
  }
}

/** A small picture of a part for the Parts list. */
export function PartImage({ type, className = "h-11 w-11 shrink-0" }: { type: PartType; className?: string }) {
  const def = PART_DEFS[type];
  const fresh = NewImage({ type });
  if (fresh) {
    return (
      <svg viewBox="0 0 10 10" className={className} aria-hidden>
        {fresh}
      </svg>
    );
  }
  // The original parts are drawn as they sit on a board: pads plus the real body.
  const xs = [def.body.x, def.body.x + def.body.w, ...def.pins.map((p) => p.x)];
  const ys = [def.body.y, def.body.y + def.body.h, ...def.pins.map((p) => p.y)];
  const x = Math.min(...xs) - 0.8;
  const y = Math.min(...ys) - 0.8;
  const w = Math.max(...xs) - x + 0.8;
  const h = Math.max(...ys) - y + 0.8;
  const s = Math.max(w, h);
  const part: Part = { id: "", type, x: 0, y: 0, rot: 0, props: { ...def.defaults } };
  const skin: Skin = { ...SKIN.design, silk: "transparent" };
  return (
    <svg viewBox={`${x + w / 2 - s / 2} ${y + h / 2 - s / 2} ${s} ${s}`} className={className} aria-hidden>
      {def.pins.map((pin) => (
        <g key={pin.id}>
          {pin.id === def.pins[0].id && def.polarised ? <rect x={pin.x - PAD} y={pin.y - PAD} width={PAD * 2} height={PAD * 2} fill="#e3b04b" /> : <circle cx={pin.x} cy={pin.y} r={PAD} fill="#e3b04b" />}
          <circle cx={pin.x} cy={pin.y} r={DRILL} fill="#0f0f26" />
        </g>
      ))}
      <Body part={part} skin={skin} />
    </svg>
  );
}
