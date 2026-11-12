"use client";

import { clsx } from "clsx";
import { Eraser, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SimSnapshot } from "../../lab/engine/solver.ts";
import { LcdChars, OledPixels } from "../../lab/ui/BoardArt.tsx";
import { panelBtn } from "../../lab/ui/Panels.tsx";
import { lcdChar } from "../devices/hd44780.ts";
import type { BoardActivity } from "../bridge.ts";

/** Serial monitor: what the program prints, and a line to send it. */
export function SerialMonitor({ text, onSend, onClear, live }: { text: string; onSend: (s: string) => void; onClear: () => void; live: boolean }) {
  const box = useRef<HTMLPreElement>(null);
  const [line, setLine] = useState("");
  const [ending, setEnding] = useState<"\n" | "\r\n" | "">("\n");
  const [follow, setFollow] = useState(true);
  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [text, follow]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <pre
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
        }}
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all bg-[#0f1124] px-3 py-2 font-mono text-[0.8rem] leading-relaxed text-[#d7f7e0]"
        aria-label="Serial output"
        aria-live="off"
      >
        {text || <span className="text-[#7c84a8]">{live ? "Waiting for the program to print…" : "Run a program to see what it prints with Serial.println() or print()."}</span>}
      </pre>
      <form
        className="flex gap-1 border-t border-black/10 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!live) return;
          onSend(line + ending);
          setLine("");
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Send to the board</span>
          <input value={line} onChange={(e) => setLine(e.target.value)} placeholder={live ? "Send to the board" : "Run to send"} disabled={!live} className="h-9 w-full bg-surface px-2 font-mono text-[0.85rem] text-ink placeholder:text-muted/70 focus:outline-2 focus:outline-bolt disabled:opacity-60" />
        </label>
        <label className="sr-only" htmlFor="serial-ending">
          Line ending
        </label>
        <select id="serial-ending" value={JSON.stringify(ending)} onChange={(e) => setEnding(JSON.parse(e.target.value))} className="h-9 bg-surface px-1 text-[0.8rem] text-ink" title="Line ending">
          <option value={JSON.stringify("\n")}>LF</option>
          <option value={JSON.stringify("\r\n")}>CR LF</option>
          <option value={JSON.stringify("")}>None</option>
        </select>
        <button type="submit" disabled={!live} aria-label="Send" className={clsx(panelBtn, "w-9 px-0 bg-ink text-white hover:bg-ink-deep disabled:opacity-50")}>
          <Send aria-hidden className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Clear" title="Clear" onClick={onClear} className={clsx(panelBtn, "w-9 px-0 text-ink hover:bg-surface")}>
          <Eraser aria-hidden className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

const COLORS = ["#2ba9da", "#e5484d", "#16a34a", "#d97706", "#7c3aed", "#0f172a"];

/** Serial plotter: every printed line made only of numbers becomes one point per number. */
export function SerialPlotter({ text }: { text: string }) {
  const series = useMemo(() => {
    const rows: number[][] = [];
    for (const line of text.split(/\r?\n/).slice(-401, -1)) {
      const nums = line
        .trim()
        .split(/[\s,;:\t]+/)
        .filter(Boolean)
        .map(Number);
      if (nums.length && nums.length <= COLORS.length && nums.every(Number.isFinite)) rows.push(nums);
    }
    return rows.slice(-300);
  }, [text]);
  if (series.length < 2) return <p className="p-4 text-[0.875rem] text-muted">Print numbers, one reading per line (several separated by spaces or commas), and they are graphed here.</p>;
  const all = series.flat();
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 1e-9) {
    hi += 1;
    lo -= 1;
  }
  const cols = Math.max(...series.map((r) => r.length));
  const W = 300;
  const H = 160;
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  return (
    <div className="p-3">
      <svg viewBox={`-34 -6 ${W + 40} ${H + 18}`} className="w-full" role="img" aria-label="Serial plotter">
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="#e3e6ef" strokeWidth={0.8} />
            <text x={-4} y={y(v)} fontSize={9} textAnchor="end" dominantBaseline="central" fill="#6b7290">
              {Math.abs(v) >= 1000 ? v.toFixed(0) : Number(v.toPrecision(3))}
            </text>
          </g>
        ))}
        {Array.from({ length: cols }, (_, c) => (
          <polyline
            key={c}
            fill="none"
            stroke={COLORS[c]}
            strokeWidth={1.4}
            strokeLinejoin="round"
            points={series
              .map((r, i) => (r[c] === undefined ? null : `${x(i).toFixed(1)},${y(r[c]).toFixed(1)}`))
              .filter(Boolean)
              .join(" ")}
          />
        ))}
      </svg>
      <p className="mt-1 text-[0.75rem] text-muted">Last {series.length} readings.</p>
    </div>
  );
}

/** Logic analyser: each output pin's level, duty and frequency, measured from the chip's own pin edges. */
export function PinTable({ activity }: { activity: BoardActivity | null }) {
  if (!activity) return <p className="p-4 text-[0.875rem] text-muted">Run a program to see every pin the chip is driving, with its duty and frequency measured from the real pin edges.</p>;
  const rows = Object.entries(activity.modes)
    // Inputs, and the pull-downs every RP2040 pin has at reset, are left out: only what the program set up shows.
    .filter(([, m]) => m === "out" || m === "pullup")
    .map(([pin, mode]) => ({ pin, mode, r: activity.readings[pin] }));
  const led = Object.entries(activity.readings).filter(([pin]) => !(pin in activity.modes));
  const fmtHz = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(2)} kHz` : f >= 1 ? `${f.toFixed(f >= 100 ? 0 : 1)} Hz` : f > 0 ? `${f.toFixed(2)} Hz` : "—");
  return (
    <table className="w-full text-left text-[0.8rem]">
      <thead className="text-muted">
        <tr>
          <th className="px-3 py-2 font-semibold">Pin</th>
          <th className="py-2 pr-2 font-semibold">Mode</th>
          <th className="py-2 pr-2 font-semibold">Level</th>
          <th className="py-2 pr-2 font-semibold">Duty</th>
          <th className="py-2 pr-3 font-semibold">Freq</th>
        </tr>
      </thead>
      <tbody className="tabular">
        {[...rows, ...led.map(([pin, r]) => ({ pin, mode: "LED", r }))].map(({ pin, mode, r }) => (
          <tr key={pin} className="border-t border-surface-2">
            <td className="px-3 py-1.5 font-semibold">{pin}</td>
            <td className="py-1.5 pr-2 text-muted">{mode === "out" ? "output" : mode === "pullup" ? "pull-up" : mode === "pulldown" ? "pull-down" : mode}</td>
            <td className="py-1.5 pr-2">
              <span className={clsx("inline-block h-2.5 w-2.5", r?.level ? "bg-success" : "bg-surface-2")} aria-label={r?.level ? "high" : "low"} />
            </td>
            <td className="py-1.5 pr-2">{r ? `${Math.round(r.duty * 1000) / 10}%` : "—"}</td>
            <td className="py-1.5 pr-3">{r ? fmtHz(r.freq) : "—"}</td>
          </tr>
        ))}
        {rows.length === 0 && led.length === 0 && (
          <tr>
            <td colSpan={5} className="px-3 py-3 text-muted">
              No pins set as outputs yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Every display the program drives, shown large enough to read. */
export function Screens({ snap, ids }: { snap: SimSnapshot | null; ids: string[] }) {
  if (!ids.length) return <p className="p-4 text-[0.875rem] text-muted">Add an OLED or a 16×2 LCD and wire it to the board to see it here, full size.</p>;
  return (
    <div className="space-y-4 p-3">
      {ids.map((id) => {
        const st = snap?.parts[id];
        const sc = st?.screen;
        return (
          <figure key={id}>
            <figcaption className="mb-1 text-[0.8rem] font-semibold">{id}</figcaption>
            {sc?.kind === "oled" ? (
              <svg viewBox="0 0 128 64" className="w-full bg-[#050507]" role="img" aria-label={`${id} OLED contents`} style={{ imageRendering: "pixelated" }}>
                <OledPixels screen={sc} x={0} y={0} w={128} h={64} color="#7fd7ff" />
              </svg>
            ) : sc?.kind === "lcd" ? (
              <svg viewBox="0 0 160 40" className="w-full" role="img" aria-label={`${id} LCD: ${sc.rows.map((r) => r.map(lcdChar).join("")).join(" / ")}`} style={{ background: (st?.level ?? 0) > 0.05 ? "#b5e05a" : "#8fae4e" }}>
                <LcdChars screen={sc} x={4} y={4} w={152} h={32} ink="#1d2b12" rot={0} />
              </svg>
            ) : (
              <p className="bg-surface px-3 py-6 text-center text-[0.85rem] text-muted">{snap ? (st?.on ? "Waiting for the program to draw…" : "No power: check VCC and GND.") : "Run the program to see it."}</p>
            )}
          </figure>
        );
      })}
    </div>
  );
}
