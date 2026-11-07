"use client";

import { clsx } from "clsx";
import { Check, ChevronLeft, ChevronRight, Factory, Lightbulb, RefreshCw, RotateCw, Trash2, Wrench } from "lucide-react";
import { useState, type Dispatch, type ReactNode } from "react";
import type { DrcIssue } from "../engine/drc.ts";
import type { CheckItem } from "../engine/missions.ts";
import { MISSIONS } from "../engine/missions.ts";
import { PROJECTS } from "../engine/projects.ts";
import { CAP_VALUES, LED_SPECS, PALETTE, PART_DEFS, RESISTOR_VALUES, formatFarads, formatOhms } from "../engine/parts.ts";
import type { PartState } from "../engine/solver.ts";
import type { LedColor, Part, PartType } from "../engine/types.ts";
import { activeMission, trackOf, type Action, type LabState, type Mode } from "../state/store.ts";
import { PartGlyph, SKIN } from "./PartGlyph.tsx";
import { fmtA, fmtV } from "./BoardCanvas.tsx";

export const panelBtn =
  "inline-flex min-h-10 items-center justify-center gap-2 px-3 text-[0.875rem] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer";

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-white/10 px-4 py-4 first:border-t-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[0.95rem] font-bold text-on-ink">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A small render of a part for the palette. */
function Thumb({ type }: { type: PartType }) {
  const def = PART_DEFS[type];
  const xs = [def.body.x, def.body.x + def.body.w, ...def.pins.map((p) => p.x)];
  const ys = [def.body.y, def.body.y + def.body.h, ...def.pins.map((p) => p.y)];
  const x = Math.min(...xs) - 0.8;
  const y = Math.min(...ys) - 0.8;
  const w = Math.max(...xs) - x + 0.8;
  const h = Math.max(...ys) - y + 0.8;
  const s = Math.max(w, h);
  return (
    <svg viewBox={`${x + w / 2 - s / 2} ${y + h / 2 - s / 2} ${s} ${s}`} className="h-11 w-11 shrink-0" aria-hidden>
      <PartGlyph part={{ id: "", type, x: 0, y: 0, rot: 0, props: { ...def.defaults } }} skin={{ ...SKIN.design, silk: "transparent" }} view="design" selected={false} />
    </svg>
  );
}

export function Palette({ state, dispatch, allowed }: { state: LabState; dispatch: Dispatch<Action>; allowed: PartType[] }) {
  const [q, setQ] = useState("");
  const list = PALETTE.filter((t) => allowed.includes(t) && PART_DEFS[t].name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pt-4">
        <h3 className="text-[0.95rem] font-bold text-on-ink">Parts</h3>
        {allowed.length > 6 && (
          <label className="mt-3 block">
            <span className="sr-only">Search parts</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search parts" className="h-10 w-full bg-white/8 px-3 text-[0.875rem] text-on-ink placeholder:text-on-ink-muted/70 focus:outline-2 focus:outline-bolt" />
          </label>
        )}
      </div>
      {allowed.length === 0 ? (
        <p className="px-4 pt-3 text-[0.875rem] leading-snug text-on-ink-muted">This mission gives you every part you need. Route them together.</p>
      ) : (
        <ul className="mt-3 flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:overflow-y-auto">
          {list.map((t) => (
            <li key={t} className="shrink-0">
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-voltex-part", t);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => dispatch({ type: "placing", part: state.placing === t ? null : t })}
                aria-pressed={state.placing === t}
                className={clsx(
                  "flex w-full items-center gap-3 px-2 py-1.5 text-left transition-colors duration-150",
                  state.placing === t ? "bg-bolt/25 text-on-ink" : "text-on-ink-muted hover:bg-white/8 hover:text-on-ink",
                )}
              >
                <Thumb type={t} />
                <span className="hidden text-[0.875rem] font-semibold leading-tight lg:block">{PART_DEFS[t].name}</span>
                <span className="sr-only lg:hidden">{PART_DEFS[t].name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MissionPanel({ state, dispatch, checks, onAll }: { state: LabState; dispatch: Dispatch<Action>; checks: CheckItem[]; onAll: () => void }) {
  const [hints, setHints] = useState(0);
  if (state.mode.kind === "sandbox") {
    return (
      <Section title="Free build" aside={<button type="button" className={clsx(panelBtn, "bg-white/8 text-on-ink hover:bg-white/14")} onClick={onAll}>Missions</button>}>
        <p className="text-[0.9rem] leading-snug text-on-ink-muted">Every part is unlocked. Build anything, power it, then clear the design-rule check and send it to fab.</p>
      </Section>
    );
  }
  const kind = state.mode.kind;
  const i = state.mode.index;
  const m = activeMission(state.mode)!;
  const track = trackOf(state.mode);
  const go = (index: number): Mode => ({ kind, index });
  const done = checks.length > 0 && checks.every((c) => c.ok);
  return (
    <Section
      title={m.title}
      aside={
        <div className="flex">
          <button type="button" aria-label="Previous" disabled={i === 0} className={clsx(panelBtn, "w-10 px-0 text-on-ink hover:bg-white/10")} onClick={() => dispatch({ type: "mode", mode: go(i - 1) })}>
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </button>
          <button type="button" className={clsx(panelBtn, "text-on-ink hover:bg-white/10")} onClick={onAll}>
            {kind === "project" ? "Project " : ""}
            {i + 1}/{track.length}
          </button>
          <button type="button" aria-label="Next" disabled={i === track.length - 1} className={clsx(panelBtn, "w-10 px-0 text-on-ink hover:bg-white/10")} onClick={() => dispatch({ type: "mode", mode: go(i + 1) })}>
            <ChevronRight aria-hidden className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <p className="text-[0.8rem] font-semibold text-bolt">{m.skill}</p>
      <p className="mt-2 text-[0.9rem] leading-snug text-on-ink">{m.brief}</p>
      <ul className="mt-4 space-y-2" aria-live="polite">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2.5 text-[0.875rem] leading-snug">
            <span className={clsx("mt-0.5 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center transition-colors duration-200", c.ok ? "bg-success text-white" : "bg-white/12")}>
              {c.ok && <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <span className={c.ok ? "text-on-ink" : "text-on-ink-muted"}>
              {c.label}
              <span className="sr-only">{c.ok ? ", done" : ", not yet"}</span>
            </span>
          </li>
        ))}
      </ul>
      {done ? (
        <div className="mt-4 bg-success/25 p-3">
          <p className="text-[0.875rem] font-bold text-on-ink">Mission complete</p>
          <p className="mt-1 text-[0.85rem] leading-snug text-on-ink-muted">{m.why}</p>
          {i < track.length - 1 ? (
            <button type="button" className={clsx(panelBtn, "mt-3 w-full bg-bolt text-ink-deep hover:bg-[#46b7e2]")} onClick={() => dispatch({ type: "mode", mode: go(i + 1) })}>
              Next: {track[i + 1].title}
            </button>
          ) : (
            <button
              type="button"
              className={clsx(panelBtn, "mt-3 w-full bg-bolt text-ink-deep hover:bg-[#46b7e2]")}
              onClick={() => dispatch({ type: "mode", mode: kind === "mission" ? { kind: "project", index: 0 } : { kind: "sandbox" } })}
            >
              {kind === "mission" ? "On to the project library" : "Open free build"}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {m.hints.slice(0, hints).map((h) => (
            <p key={h} className="mb-2 flex gap-2 text-[0.85rem] leading-snug text-on-ink-muted">
              <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-bolt" />
              {h}
            </p>
          ))}
          {hints < m.hints.length && (
            <button type="button" className={clsx(panelBtn, "bg-white/8 text-on-ink hover:bg-white/14")} onClick={() => setHints((h) => h + 1)}>
              <Lightbulb aria-hidden className="h-4 w-4" />
              {hints === 0 ? "Show a hint" : "Another hint"}
            </button>
          )}
        </div>
      )}
    </Section>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/6 px-3 py-2">
      <dt className="text-[0.75rem] text-on-ink-muted">{label}</dt>
      <dd className="tabular text-[1rem] font-bold text-on-ink">{value}</dd>
    </div>
  );
}

export function Inspector({ part, st, burnt, voltage, dispatch, onRepair }: { part: Part; st?: PartState; burnt: boolean; voltage?: number; dispatch: Dispatch<Action>; onRepair: () => void }) {
  const def = PART_DEFS[part.type];
  const set = (props: Part["props"]) => dispatch({ type: "props", id: part.id, props });
  const field = "h-10 w-full bg-white/8 px-2 text-[0.875rem] text-on-ink focus:outline-2 focus:outline-bolt";
  return (
    <Section
      title={`${part.id} · ${def.name}`}
      aside={
        <div className="flex">
          <button type="button" aria-label="Rotate (R)" title="Rotate (R)" className={clsx(panelBtn, "w-10 px-0 text-on-ink hover:bg-white/10")} onClick={() => dispatch({ type: "rotate", id: part.id })}>
            <RotateCw aria-hidden className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Delete (Del)" title="Delete (Del)" className={clsx(panelBtn, "w-10 px-0 text-on-ink hover:bg-danger/60")} onClick={() => dispatch({ type: "delete", selection: { kind: "part", id: part.id } })}>
            <Trash2 aria-hidden className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <p className="text-[0.8rem] font-semibold text-bolt">{def.spec(part.props)}</p>
      <p className="mt-2 text-[0.875rem] leading-snug text-on-ink-muted">{def.learn}</p>
      <div className="mt-3 grid gap-3">
        {(part.type === "resistor" || part.type === "pot") && (
          <label className="block text-[0.8rem] text-on-ink-muted">
            Resistance
            <select className={field} value={part.props.value} onChange={(e) => set({ value: Number(e.target.value) })}>
              {RESISTOR_VALUES.map((v) => (
                <option key={v} value={v}>
                  {formatOhms(v)}
                </option>
              ))}
            </select>
          </label>
        )}
        {(part.type === "ceramic" || part.type === "electrolytic") && (
          <label className="block text-[0.8rem] text-on-ink-muted">
            Capacitance
            <select className={field} value={part.props.value} onChange={(e) => set({ value: Number(e.target.value) })}>
              {CAP_VALUES.filter((v) => (part.type === "ceramic" ? v <= 1e-6 : v >= 1e-6)).map((v) => (
                <option key={v} value={v}>
                  {formatFarads(v)}
                </option>
              ))}
            </select>
          </label>
        )}
        {part.type === "led" && (
          <label className="block text-[0.8rem] text-on-ink-muted">
            Colour
            <select className={field} value={part.props.color} onChange={(e) => set({ color: e.target.value as LedColor })}>
              {(Object.keys(LED_SPECS) as LedColor[]).map((c) => (
                <option key={c} value={c}>
                  {LED_SPECS[c].label} · {LED_SPECS[c].vf} V
                </option>
              ))}
            </select>
          </label>
        )}
        {part.type === "pot" && (
          <label className="block text-[0.8rem] text-on-ink-muted">
            Knob position {Math.round((part.props.pos ?? 0.5) * 100)}%
            <input type="range" min={0} max={1} step={0.01} value={part.props.pos ?? 0.5} onChange={(e) => dispatch({ type: "props", id: part.id, props: { pos: Number(e.target.value) }, history: false })} className="mt-1 w-full accent-bolt" />
          </label>
        )}
        {part.type === "switch" && (
          <button type="button" className={clsx(panelBtn, "bg-white/8 text-on-ink hover:bg-white/14")} onClick={() => dispatch({ type: "props", id: part.id, props: { closed: !part.props.closed }, history: false })}>
            Switch {part.props.closed ? "off" : "on"}
          </button>
        )}
      </div>
      {st && (
        <dl className="mt-3 grid grid-cols-2 gap-1.5">
          <Reading label="Current" value={fmtA(st.current)} />
          <Reading label="Power" value={`${(st.power * 1000).toFixed(st.power < 0.01 ? 1 : 0)} mW`} />
          {voltage !== undefined && <Reading label="Voltage across" value={fmtV(voltage)} />}
          <Reading label="Load" value={st.burnt ? "Burnt out" : `${Math.round(Math.min(9.99, st.stress) * 100)}%`} />
        </dl>
      )}
      {burnt && (
        <button type="button" className={clsx(panelBtn, "mt-3 w-full bg-bolt text-ink-deep hover:bg-[#46b7e2]")} onClick={onRepair}>
          <Wrench aria-hidden className="h-4 w-4" />
          Replace part
        </button>
      )}
    </Section>
  );
}

export function DrcPanel({ issues, onFocus, onFab, canFab }: { issues: DrcIssue[]; onFocus: (i: DrcIssue) => void; onFab: () => void; canFab: boolean }) {
  const errors = issues.filter((i) => i.severity === "error").length;
  return (
    <Section
      title="Design-rule check"
      aside={
        <span className={clsx("px-2 py-0.5 text-[0.75rem] font-bold", issues.length === 0 ? "bg-success text-white" : errors ? "bg-danger text-white" : "bg-warning text-white")}>
          {issues.length === 0 ? "Clean" : `${errors} ${errors === 1 ? "error" : "errors"} · ${issues.length - errors} ${issues.length - errors === 1 ? "warning" : "warnings"}`}
        </span>
      }
    >
      {issues.length === 0 ? (
        <p className="text-[0.875rem] text-on-ink-muted">No problems found. This board could go to the factory.</p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto" aria-live="polite">
          {issues.map((d, k) => (
            <li key={`${d.code}-${k}`}>
              <button type="button" onClick={() => onFocus(d)} className="flex w-full gap-2 px-2 py-1.5 text-left text-[0.85rem] leading-snug text-on-ink-muted transition-colors hover:bg-white/8 hover:text-on-ink">
                <span className={clsx("mt-1.5 h-2 w-2 shrink-0", d.severity === "error" ? "bg-danger" : "bg-warning")} aria-hidden />
                <span>
                  <span className="sr-only">{d.severity}: </span>
                  {d.message}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" disabled={!canFab} onClick={onFab} className={clsx(panelBtn, "mt-4 w-full", errors ? "bg-white/8 text-on-ink hover:bg-white/14" : "bg-bolt text-ink-deep hover:bg-[#46b7e2]")}>
        <Factory aria-hidden className="h-4 w-4" />
        Send to fab
      </button>
    </Section>
  );
}

export function MissionList({ state, dispatch, onClose }: { state: LabState; dispatch: Dispatch<Action>; onClose: () => void }) {
  const group = (kind: "mission" | "project", list: typeof MISSIONS, title: string, lead: string) => (
    <>
      <h3 className="mt-8 text-[1.15rem] font-bold text-ink first:mt-6">{title}</h3>
      <p className="mt-1 text-muted">{lead}</p>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {list.map((m, i) => {
          const done = state.completed.includes(m.id);
          const current = state.mode.kind === kind && state.mode.index === i;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "mode", mode: { kind, index: i } });
                  onClose();
                }}
                className={clsx("flex w-full items-start gap-3 p-4 text-left transition-colors", current ? "bg-ink text-on-ink" : "bg-surface text-ink hover:bg-surface-2")}
              >
                <span className={clsx("mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center text-[0.8rem] font-bold", done ? "bg-success text-white" : current ? "bg-bolt text-ink-deep" : "bg-ground text-ink")}>
                  {done ? <Check aria-hidden className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <span>
                  <span className="block font-bold">{m.title}</span>
                  <span className={clsx("block text-[0.875rem]", current ? "text-on-ink-muted" : "text-muted")}>{m.skill}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
  const total = MISSIONS.length + PROJECTS.length;
  const done = state.completed.length;
  return (
    <div className="p-6 sm:p-8">
      <h2 id="missions-title" className="display text-[clamp(1.8rem,1.3rem+1.6vw,2.6rem)] text-ink">
        What do you want to build?
      </h2>
      <p className="mt-2 text-muted">
        {done} of {total} builds complete.
      </p>
      {group("mission", MISSIONS, "Missions", "Start here. Each one teaches a skill the next one needs.")}
      {group("project", PROJECTS, "Project library", "Real gadgets to build once you know the basics.")}
      <button
        type="button"
        onClick={() => {
          dispatch({ type: "mode", mode: { kind: "sandbox" } });
          onClose();
        }}
        className="mt-6 flex w-full items-center justify-between bg-bolt p-4 text-left font-bold text-ink-deep transition-colors hover:bg-[#46b7e2]"
      >
        Free build: every part unlocked, no rules
        <RefreshCw aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
