"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Mascot } from "../mascot/Mascot.tsx";

gsap.registerPlugin(useGSAP);

/** Traces of a small board draw themselves in, then current pulses run along them, and Volta waves hello. */
const TRACES = [
  "M60 300 H180 L230 250 H360",
  "M360 250 H470 L520 300 V380",
  "M520 380 H640",
  "M60 300 V420 H300 L340 460 H640",
  "M180 120 H300 L340 160 V250",
  "M470 250 V160 L510 120 H640",
  "M640 380 V460",
  "M640 120 V300",
];
const PADS: [number, number][] = [
  [60, 300], [180, 300], [360, 250], [470, 250], [520, 380], [640, 380], [640, 460], [60, 420], [300, 420],
  [180, 120], [340, 250], [640, 120], [640, 300], [300, 120],
];

export function HeroCircuit() {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const paths = gsap.utils.toArray<SVGPathElement>("[data-trace]");
        paths.forEach((p) => {
          const len = p.getTotalLength();
          gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
        });
        const tl = gsap.timeline({ delay: 0.3 });
        tl.to(paths, { strokeDashoffset: 0, duration: 1.4, ease: "expo.out", stagger: 0.09 });
        tl.from("[data-pad]", { scale: 0, transformOrigin: "50% 50%", duration: 0.5, ease: "back.out(2)", stagger: 0.03 }, 0.4);
        tl.from("[data-chip]", { opacity: 0, y: 18, duration: 0.8, ease: "expo.out", stagger: 0.08 }, 0.7);
        gsap.utils.toArray<SVGPathElement>("[data-pulse]").forEach((p, i) => {
          const len = p.getTotalLength();
          gsap.set(p, { strokeDasharray: `18 ${len}`, strokeDashoffset: 18 });
          gsap.to(p, { strokeDashoffset: -len, duration: 2.2 + (i % 3) * 0.5, ease: "none", repeat: -1, delay: 1.8 + i * 0.35 });
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative h-full w-full">
      <svg viewBox="0 0 700 560" className="h-full w-full" role="img" aria-label="A small circuit board drawing its copper traces, with current flowing through them">
        <rect x={20} y={60} width={660} height={460} rx={18} fill="#17173a" />
        <g fill="none" stroke="#e9a23b" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round">
          {TRACES.map((d) => (
            <path key={d} d={d} data-trace />
          ))}
        </g>
        <g fill="none" stroke="#ffffff" strokeWidth={5} strokeLinecap="round">
          {TRACES.slice(0, 6).map((d) => (
            <path key={d} d={d} data-pulse opacity={0.9} />
          ))}
        </g>
        {PADS.map(([x, y]) => (
          <g key={`${x}-${y}`} data-pad>
            <circle cx={x} cy={y} r={15} fill="#e3b04b" />
            <circle cx={x} cy={y} r={6} fill="#0f0f26" />
          </g>
        ))}
        <g data-chip>
          <rect x={210} y={180} width={110} height={44} rx={8} fill="#e7cf9c" />
          {["#ef7d16", "#ef7d16", "#7a4a1d", "#c9a33a"].map((c, i) => (
            <rect key={i} x={234 + i * 18 + (i === 3 ? 10 : 0)} y={180} width={8} height={44} fill={c} />
          ))}
        </g>
        <g data-chip>
          <circle cx={580} cy={330} r={30} fill="#ff3b3b" opacity={0.95} />
          <circle cx={580} cy={330} r={60} fill="#ff3b3b" opacity={0.18} />
          <circle cx={570} cy={320} r={9} fill="#fff" opacity={0.85} />
        </g>
        <g data-chip>
          <rect x={390} y={400} width={150} height={70} rx={6} fill="#18181b" />
          <text x={465} y={443} textAnchor="middle" fontSize={22} fontWeight={800} fill="#d2d4dc">
            NE555
          </text>
        </g>
      </svg>
      <div className="absolute -bottom-2 left-[4%] w-[22%] max-w-40 min-w-24" data-chip>
        <Mascot mood="happy" level={() => 0} point={-60} size={160} />
      </div>
    </div>
  );
}
