"use client";

import { useState } from "react";
import { ledResistor, requiredTraceWidth } from "../engine/drc.ts";
import { E12, LED_SPECS, formatOhms } from "../engine/parts.ts";
import type { LedColor } from "../engine/types.ts";

/** Nearest standard E12 value at or above r, so the LED is never over-driven. */
function nextE12(r: number): number {
  if (r <= 0) return 0;
  const decade = 10 ** Math.floor(Math.log10(r));
  const v = E12.find((m) => m * decade >= r - 1e-9);
  return (v ?? 10) * decade;
}

const field = "mt-1 h-12 w-full bg-surface px-3 text-[1.0625rem] text-ink focus:outline-3 focus:outline-bolt-deep";
const out = "tabular text-[clamp(2.4rem,1.6rem+2.6vw,4rem)] font-extrabold leading-none tracking-[-0.03em] text-ink";

export function LedCalculator() {
  const [supply, setSupply] = useState(9);
  const [color, setColor] = useState<LedColor>("red");
  const [ma, setMa] = useState(20);
  const r = ledResistor(supply, LED_SPECS[color].vf, ma / 1000);
  const std = nextE12(r);
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <label className="block text-small text-muted">
        Supply
        <select className={field} value={supply} onChange={(e) => setSupply(Number(e.target.value))}>
          {[3, 3.3, 5, 9, 12].map((v) => (
            <option key={v} value={v}>
              {v} V
            </option>
          ))}
        </select>
      </label>
      <label className="block text-small text-muted">
        LED
        <select className={field} value={color} onChange={(e) => setColor(e.target.value as LedColor)}>
          {(Object.keys(LED_SPECS) as LedColor[]).map((c) => (
            <option key={c} value={c}>
              {LED_SPECS[c].label} · {LED_SPECS[c].vf} V
            </option>
          ))}
        </select>
      </label>
      <label className="block text-small text-muted">
        Current {ma} mA
        <input type="range" min={2} max={30} value={ma} onChange={(e) => setMa(Number(e.target.value))} className="mt-4 w-full accent-ink" />
      </label>
      <output className="sm:col-span-3" aria-live="polite">
        <span className={out}>{r <= 0 ? "No resistor fits" : formatOhms(Math.round(r))}</span>
        <span className="mt-2 block text-muted">{r <= 0 ? "The supply is below the LED's forward voltage, so it will not light." : `Use the next standard value up: ${formatOhms(std)}.`}</span>
      </output>
    </div>
  );
}

export function OhmCalculator() {
  const [v, setV] = useState(9);
  const [r, setR] = useState(1000);
  const i = v / r;
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <label className="block text-small text-muted">
        Voltage {v} V
        <input type="range" min={1} max={24} step={0.5} value={v} onChange={(e) => setV(Number(e.target.value))} className="mt-4 w-full accent-ink" />
      </label>
      <label className="block text-small text-muted">
        Resistance {formatOhms(r)}
        <input type="range" min={1} max={6} step={0.01} value={Math.log10(r)} onChange={(e) => setR(Math.round(10 ** Number(e.target.value)))} className="mt-4 w-full accent-ink" />
      </label>
      <output className="sm:col-span-2" aria-live="polite">
        <span className={out}>{i >= 1 ? `${i.toFixed(2)} A` : i >= 1e-3 ? `${(i * 1000).toFixed(1)} mA` : `${(i * 1e6).toFixed(0)} µA`}</span>
        <span className="mt-2 block text-muted">Power in the resistor: {(v * i * 1000).toFixed(v * i < 0.01 ? 2 : 0)} mW{v * i > 0.25 ? ", too much for a ¼ W resistor." : "."}</span>
      </output>
    </div>
  );
}

export function TraceCalculator() {
  const [amps, setAmps] = useState(1);
  const w = requiredTraceWidth(amps);
  return (
    <div className="grid gap-6">
      <label className="block text-small text-muted">
        Current {amps.toFixed(1)} A
        <input type="range" min={0.1} max={10} step={0.1} value={amps} onChange={(e) => setAmps(Number(e.target.value))} className="mt-4 w-full accent-ink" />
      </label>
      <output aria-live="polite">
        <span className={out}>{w.toFixed(2)} mm</span>
        <span className="mt-2 block text-muted">Minimum outer-layer width for 1 oz copper and a 10 °C rise (IPC-2221).</span>
      </output>
      <div aria-hidden className="h-6 bg-surface">
        <div className="h-full bg-[#e9a23b] transition-[width] duration-300 ease-out" style={{ width: `${Math.min(100, (w / 8) * 100)}%` }} />
      </div>
    </div>
  );
}
