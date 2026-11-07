"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Mood } from "./voice.ts";

/**
 * Volta: a round little chip robot with a soft white shell, a dark face screen, big glossy LED eyes, rosy cheeks, gold
 * solder-pin arms and feet, and a curly antenna with a spark on top. Mascot card: cheerful, patient lab partner.
 * Cute by proportion: a big round head, eyes set low and wide, tiny limbs. The eyes do the acting. Blinking and
 * breathing run on their own; the mouth follows the voice level.
 */

const EYE = "#5fd0ff";
const GOLD = "#e9b54f";
const SHELL = "#f4f5fb";
const SHADE = "#d6d9ee";
const SCREEN = "#1b1b3d";
const BLUSH = "#ff9ec0";
const spring = { type: "spring" as const, bounce: 0, duration: 0.4 };

function Eyes({ mood, blink }: { mood: Mood; blink: boolean }) {
  if (mood === "sleeping") {
    return (
      <g fill="none" stroke={EYE} strokeWidth={3} strokeLinecap="round">
        <path d="M38 67 q7 5 14 0 M68 67 q7 5 14 0" />
      </g>
    );
  }
  if (mood === "happy" || mood === "celebrate") {
    return (
      <g fill="none" stroke={EYE} strokeWidth={4} strokeLinecap="round">
        <path d="M37 69 q8 -12 16 0 M67 69 q8 -12 16 0" />
      </g>
    );
  }
  const worried = mood === "worried";
  const thinking = mood === "thinking";
  const ry = worried ? 8 : 10;
  return (
    <g>
      {worried && (
        <g stroke={EYE} strokeWidth={2.5} strokeLinecap="round">
          <path d="M37 52 l11 -3 M83 52 l-11 -3" />
        </g>
      )}
      <motion.g animate={{ scaleY: blink ? 0.1 : 1, x: thinking ? -3 : 0, y: thinking ? -3 : 0 }} transition={{ duration: blink ? 0.06 : 0.3 }} style={{ originY: 0.5 }}>
        {[45, 75].map((cx) => (
          <g key={cx}>
            <ellipse cx={cx} cy={66} rx={8} ry={ry} fill={EYE} />
            <circle cx={cx + 2.6} cy={61.5} r={3.3} fill="#fff" />
            <circle cx={cx - 3} cy={70.5} r={1.5} fill="#fff" opacity={0.85} />
          </g>
        ))}
      </motion.g>
    </g>
  );
}

export function Mascot({ mood, level, point, size = 132 }: { mood: Mood; level: () => number; point: number | null; size?: number }) {
  const reduce = useReducedMotion();
  const [blink, setBlink] = useState(false);
  const mouth = useRef<SVGEllipseElement>(null);
  const smile = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (reduce || mood === "sleeping") return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 130);
        loop();
      }, 2600 + Math.random() * 2600);
    };
    loop();
    return () => window.clearTimeout(t);
  }, [reduce, mood]);

  // Lip-sync straight to the DOM: no React render per frame.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const m = mouth.current;
      const sm = smile.current;
      if (m && sm) {
        const open = mood === "sleeping" ? 0 : level();
        const talking = open > 0.06;
        m.setAttribute("ry", String(talking ? 1.6 + open * 4.4 : 0));
        m.setAttribute("rx", String(talking ? 4 + open * 1.5 : 0));
        sm.style.opacity = talking ? "0" : "1";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [level, mood]);

  const celebrate = mood === "celebrate" && !reduce;
  const armL = point !== null && point > 90 && point < 270 ? point - 180 : -20;
  const armR = point !== null && !(point > 90 && point < 270) ? point : 20;

  return (
    <motion.svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      aria-hidden
      animate={celebrate ? { y: [0, -14, 0, -8, 0] } : { y: 0 }}
      transition={celebrate ? { duration: 0.9, ease: "easeOut" } : spring}
      style={{ overflow: "visible" }}
    >
      <motion.g animate={reduce || mood === "sleeping" ? { y: 0 } : { y: [0, 1.6, 0] }} transition={reduce ? { duration: 0 } : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>
        {/* Curly antenna with a spark on top */}
        <path d="M60 26 C60 18 54 17 56 11" fill="none" stroke="#c9cbe3" strokeWidth={2.6} strokeLinecap="round" />
        <circle cx={56.5} cy={8.5} r={7} fill={EYE} opacity={0.28} />
        <motion.path
          d="M58.5 2 L52.5 9.5 h4 l-2.2 6 l7.2 -8.5 h-4 l2.4 -5 z"
          fill="#2ba9da"
          animate={reduce ? {} : { opacity: mood === "sleeping" ? 0.35 : [0.75, 1, 0.75], scale: mood === "celebrate" ? 1.25 : 1 }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ originX: 0.5, originY: 0.5 }}
        />
        {/* Solder-pin arms, which point at the problem */}
        <motion.g animate={{ rotate: armL }} transition={spring} style={{ originX: 1, originY: 0.5 }}>
          <rect x={5} y={72.5} width={16} height={7} rx={3.5} fill={GOLD} />
          <circle cx={6} cy={76} r={4.2} fill={GOLD} />
        </motion.g>
        <motion.g animate={{ rotate: armR }} transition={spring} style={{ originX: 0, originY: 0.5 }}>
          <rect x={99} y={72.5} width={16} height={7} rx={3.5} fill={GOLD} />
          <circle cx={114} cy={76} r={4.2} fill={GOLD} />
        </motion.g>
        {/* Round little feet */}
        <ellipse cx={46} cy={111} rx={9} ry={5} fill={GOLD} />
        <ellipse cx={74} cy={111} rx={9} ry={5} fill={GOLD} />
        {/* Shell: a soft rounded chip */}
        <rect x={17} y={24} width={86} height={84} rx={36} fill={SHELL} />
        <path d="M17 76 a36 36 0 0 0 36 32 h14 a36 36 0 0 0 36 -32 z" fill={SHADE} opacity={0.6} />
        <ellipse cx={42} cy={34} rx={11} ry={4} fill="#fff" opacity={0.9} />
        {/* Hair clip: a tiny bolt */}
        <path d="M88 26 l-6 8 h4.5 l-2.5 6.5 l8 -9 h-4.5 l2.5 -5.5 z" fill="#2ba9da" stroke={SHELL} strokeWidth={1} strokeLinejoin="round" />
        {/* Face screen */}
        <rect x={26} y={42} width={68} height={52} rx={24} fill={SCREEN} />
        <Eyes mood={mood} blink={blink} />
        <g fill={BLUSH} opacity={mood === "happy" || mood === "celebrate" ? 0.75 : 0.45}>
          <ellipse cx={34.5} cy={80} rx={5} ry={3} />
          <ellipse cx={85.5} cy={80} rx={5} ry={3} />
        </g>
        <path ref={smile} d={mood === "worried" ? "M55 84 q5 -3.5 10 0" : "M55 81.5 q5 4.5 10 0"} fill="none" stroke={EYE} strokeWidth={2.4} strokeLinecap="round" />
        <ellipse ref={mouth} cx={60} cy={83} rx={0} ry={0} fill="#ff8fb1" />
      </motion.g>
      {mood === "sleeping" && (
        <text x={96} y={24} fontSize={13} fontWeight={800} fill="#9fa3c7">
          z
        </text>
      )}
      {celebrate && (
        <g fill="#2ba9da">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.circle
              key={i}
              cx={60}
              cy={40}
              r={2.6}
              initial={{ opacity: 1, x: 0, y: 0 }}
              animate={{ opacity: 0, x: Math.cos((i / 6) * Math.PI * 2) * 52, y: Math.sin((i / 6) * Math.PI * 2) * 40 - 20 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          ))}
        </g>
      )}
    </motion.svg>
  );
}
