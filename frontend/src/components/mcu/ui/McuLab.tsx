"use client";

import { clsx } from "clsx";
import { Cpu, Gauge, Loader2, Maximize2, Minimize2, MousePointer2, Pause, Play, Redo2, RefreshCw, ShieldCheck, Spline, Square, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { makeContext } from "../../lab/engine/missions.ts";
import type { DrcIssue } from "../../lab/engine/drc.ts";
import { BOARDS, isMcu, type McuBoard } from "../../lab/engine/mcu-boards.ts";
import { PALETTE, PART_DEFS, partBox } from "../../lab/engine/parts.ts";
import type { SimEvent } from "../../lab/engine/solver.ts";
import type { Board, PartType, Pt } from "../../lab/engine/types.ts";
import { initialState, reducer, type Action, type LabState, type Tool } from "../../lab/state/store.ts";
import { BoardCanvas, type ProbeReading } from "../../lab/ui/BoardCanvas.tsx";
import { DrcPanel, Inspector, Palette, panelBtn } from "../../lab/ui/Panels.tsx";
import { buildNetlist } from "../../lab/engine/netlist.ts";
import type { Program } from "../emu/protocol.ts";
import { CodeEditor, type CodeDiagnostic } from "./CodeEditor.tsx";
import { EXAMPLES, exampleById, type Example, type Language } from "./examples.ts";
import { PinTable, Screens, SerialMonitor, SerialPlotter } from "./Instruments.tsx";
import { useMcuRun } from "./useMcuRun.ts";

const TOOLS: { tool: Tool; label: string; key: string; icon: typeof Spline }[] = [
  { tool: "select", label: "Select and move", key: "S", icon: MousePointer2 },
  { tool: "trace", label: "Draw a wire", key: "W", icon: Spline },
  { tool: "probe", label: "Multimeter probe", key: "P", icon: Gauge },
  { tool: "delete", label: "Delete", key: "X", icon: Trash2 },
];

// The boards the lab can emulate, then every other part (the PCB Lab's other boards cannot run a program here).
const ALLOWED: PartType[] = ["uno", "pico", ...PALETTE.filter((t) => !isMcu(t))];
const STORAGE = "voltex-mcu-v1";

interface Project {
  example: string;
  language: Language;
  code: string;
}

interface Stored {
  project: Project;
  board: Board;
}

/** What Check covers: the circuit, not the live knob and switch positions. */
function designKey(board: Board): string {
  return JSON.stringify({ parts: board.parts.map((p) => ({ ...p, props: { ...p.props, closed: undefined, pos: undefined } })), traces: board.traces });
}

function load(): Stored {
  const ex = EXAMPLES[0];
  const fresh = { project: { example: ex.id, language: ex.language, code: ex.code }, board: structuredClone(ex.circuit) };
  try {
    const raw = window.localStorage.getItem(STORAGE);
    if (!raw) return fresh;
    const s = JSON.parse(raw) as Stored;
    return s.project?.code !== undefined && s.board?.parts ? s : fresh;
  } catch {
    return fresh;
  }
}

function labInit(board: Board): LabState {
  return { ...initialState(), mode: { kind: "sandbox" }, board, tool: "select" };
}

/** The PCB lab's editor, plus loading a whole example circuit as one undoable step. */
function labReducer(s: LabState, a: Action | { type: "load"; board: Board }): LabState {
  if (a.type === "load") return { ...s, board: a.board, past: [...s.past.slice(-60), s.board], future: [], selection: null, routing: null, placing: null, probed: [] };
  return reducer(s, a);
}

type Tab = "serial" | "screens" | "plot" | "pins" | "parts" | "check";

interface CompileOut {
  ok: boolean;
  program?: string;
  format?: "hex" | "uf2";
  size?: { flash: number; flashMax: number; ram: number; ramMax: number };
  diagnostics: { file: string; line: number; column: number; severity: "error" | "warning" | "note"; message: string }[];
  log: string;
}

export default function McuLab() {
  const [stored] = useState(load);
  const [project, setProject] = useState<Project>(stored.project);
  const example = exampleById(project.example);
  const [state, dispatchAny] = useReducer(labReducer, stored.board, labInit);
  const dispatch = dispatchAny as (a: Action) => void;
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("serial");
  const [max, setMax] = useState(false);
  const [check, setCheck] = useState<{ key: string; issues: DrcIssue[] } | null>(null);
  const [banner, setBanner] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [diagnostics, setDiagnostics] = useState<CodeDiagnostic[]>([]);
  const [buildLog, setBuildLog] = useState<string>("");
  const [size, setSize] = useState<CompileOut["size"]>();
  const [focus, setFocus] = useState<Pt | null>(null);
  const [hot, setHot] = useState<Set<string>>(new Set());
  const [probe, setProbe] = useState<ProbeReading | null>(null);

  const netlist = useMemo(() => buildNetlist(state.board), [state.board]);
  const mcus = state.board.parts.filter((p) => isMcu(p.type));
  const mcu = mcus[0];
  const boardType = mcu?.type as McuBoard | undefined;
  const language: Language = boardType === "uno" ? "cpp" : project.language;

  const partCentre = useCallback(
    (id: string): Pt | undefined => {
      const p = state.board.parts.find((q) => q.id === id);
      if (!p) return undefined;
      const b = partBox(p);
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    },
    [state.board.parts],
  );

  const runRef = useRef<{ pause: (p: boolean) => void } | null>(null);
  const onEvents = useCallback(
    (events: SimEvent[]) => {
      for (const e of events) {
        const p = state.board.parts.find((q) => q.id === e.partId);
        if (!p) continue;
        setHot(new Set([e.partId]));
        setFocus(partCentre(e.partId) ?? null);
        if (isMcu(p.type) && (e.type === "overcurrent" || e.type === "short")) {
          const spec = BOARDS[p.type as McuBoard];
          runRef.current?.pause(true);
          setBanner({
            tone: "error",
            text:
              e.type === "short"
                ? `${p.id} is shorted: more than 0.5 A is flowing from USB. On a real board the USB fuse would cut out. Paused.`
                : `A pin on ${p.id} is giving more than ${Math.round(spec.iMax * 1000)} mA, which damages a real chip. Add a resistor (220 Ω or more for an LED). Paused.`,
          });
        } else if (e.type === "burnt") setBanner({ tone: "error", text: `${p.id} burnt out: too much current went through it. Select it to replace it.` });
        else if (e.type === "reversed") setBanner({ tone: "info", text: `${p.id} is the wrong way round, so no current flows through it.` });
      }
    },
    [state.board.parts, partCentre],
  );

  const run = useMcuRun(state.board, netlist, state.ambient, pressed, onEvents);
  useEffect(() => {
    runRef.current = run;
  });
  const running = run.status === "running" || run.status === "paused" || run.status === "loading";

  // ---------- Check gate ----------
  const boardKey = useMemo(() => designKey(state.board), [state.board]);
  const checkStatus: "unchecked" | "stale" | "fresh" = !check ? "unchecked" : check.key === boardKey ? "fresh" : "stale";
  const issues = checkStatus === "fresh" ? check!.issues : [];
  const errorCount = issues.filter((d) => d.severity === "error").length;
  const canRun = checkStatus === "fresh" && errorCount === 0 && Boolean(mcu);
  const lockReason = !mcu
    ? "Add an Arduino Uno or a Raspberry Pi Pico from Parts first."
    : checkStatus === "unchecked"
      ? "Press Check first. Run unlocks when the circuit has no errors."
      : checkStatus === "stale"
        ? "You changed the circuit. Press Check again."
        : `Fix ${errorCount} ${errorCount === 1 ? "error" : "errors"} to unlock Run.`;

  // Changing the circuit stops the program until it is checked again.
  const stopRun = run.stop;
  useEffect(() => {
    if (running && !canRun) stopRun();
  }, [running, canRun, stopRun]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE, JSON.stringify({ project, board: state.board } satisfies Stored));
      } catch {
        /* storage blocked: nothing is remembered */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [project, state.board]);

  useEffect(() => {
    if (!max) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [max]);

  useEffect(() => {
    if (!banner || banner.tone === "error") return;
    const t = window.setTimeout(() => setBanner(null), 5000);
    return () => window.clearTimeout(t);
  }, [banner]);

  // ---------- Actions ----------
  const runCheck = () => {
    const ctx = makeContext(state.board, { netlist, probed: [], fabSent: false, burnt: new Set(run.burntIds()) });
    const list = ctx.drc;
    if (mcus.length > 1) list.push({ code: "pin-rail", severity: "warning", message: `There are ${mcus.length} boards; the program runs on ${mcu.id} only.`, at: partCentre(mcus[1].id) ?? { x: 0, y: 0 }, partIds: [mcus[1].id] } as DrcIssue);
    setCheck({ key: boardKey, issues: list });
    setTab("check");
    setBanner(null);
    const first = list.find((d) => d.severity === "error");
    setHot(new Set(first?.partIds ?? []));
    if (first) setFocus(first.at);
  };

  const loadExample = (ex: Example) => {
    run.stop();
    setProject({ example: ex.id, language: ex.language, code: ex.code });
    dispatchAny({ type: "load", board: structuredClone(ex.circuit) });
    setDiagnostics([]);
    setBuildLog("");
    setSize(undefined);
    setCheck(null);
    setHot(new Set());
    setBanner({ tone: "info", text: `${ex.title}: ${ex.summary} Press Check, then Run.` });
  };

  const start = async () => {
    if (!canRun || !mcu) {
      setBanner({ tone: "error", text: lockReason });
      return;
    }
    setBanner(null);
    setHot(new Set());
    run.clearSerial();
    if (language === "python") {
      setDiagnostics([]);
      setSize(undefined);
      await run.run({ board: "pico", kind: "python", data: project.code });
      setTab("serial");
      return;
    }
    setCompiling(true);
    setBuildLog("");
    try {
      const res = await fetch("/api/lab/compile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ board: boardType, files: [{ name: "sketch.ino", content: project.code }] }) });
      const body = (await res.json().catch(() => ({}))) as Partial<CompileOut> & { message?: string; errors?: string[] };
      if (!res.ok) {
        setBanner({ tone: "error", text: res.status === 503 ? "The compiler isn't available right now. MicroPython on the Pico still works." : res.status === 429 ? (body.message ?? "Too many compiles. Wait a moment.") : (body.errors?.join(" ") ?? body.message ?? "Compiling failed.") });
        return;
      }
      setDiagnostics((body.diagnostics ?? []).filter((d) => d.file === "sketch.ino"));
      setBuildLog(body.log ?? "");
      setSize(body.size);
      if (!body.ok || !body.program) {
        const n = (body.diagnostics ?? []).filter((d) => d.severity === "error").length;
        setBanner({ tone: "error", text: n ? `The code has ${n} ${n === 1 ? "error" : "errors"}. They are underlined in the editor.` : "The code didn't compile. See the build output." });
        setTab("check");
        return;
      }
      const program: Program = body.format === "uf2" ? { board: "pico", kind: "uf2", data: body.program } : { board: "uno", kind: "hex", data: body.program };
      await run.run(program);
      setTab(displays.length ? "screens" : "serial");
    } catch {
      setBanner({ tone: "error", text: "Couldn't reach the compiler. Check your connection and try again." });
    } finally {
      setCompiling(false);
    }
  };

  const onPress = (id: string, down: boolean) =>
    setPressed((s) => {
      const n = new Set(s);
      if (down) n.add(id);
      else n.delete(id);
      return n;
    });

  const focusIssue = (d: DrcIssue) => {
    setFocus(d.at);
    setHot(new Set(d.partIds));
  };

  const onKey = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, select, textarea, .cm-editor")) return;
    const k = e.key.toLowerCase();
    const sel = state.selection;
    if ((e.ctrlKey || e.metaKey) && k === "z") {
      e.preventDefault();
      dispatch({ type: e.shiftKey ? "redo" : "undo" });
      return;
    }
    if ((e.ctrlKey || e.metaKey) && k === "y") {
      e.preventDefault();
      dispatch({ type: "redo" });
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === "escape") {
      if (max && !state.routing && !state.placing && !state.selection) setMax(false);
      dispatch({ type: "route-cancel" });
      dispatch({ type: "select", selection: null });
      setProbe(null);
      return;
    }
    if (state.routing && k === "backspace") {
      e.preventDefault();
      dispatch({ type: "route-undo" });
      return;
    }
    if (state.routing && k === "enter") {
      dispatch({ type: "route-finish" });
      return;
    }
    const tool = TOOLS.find((t) => t.key.toLowerCase() === k);
    if (tool) return dispatch({ type: "tool", tool: tool.tool });
    if (k === "t") return dispatch({ type: "tool", tool: "trace" });
    if (sel?.kind === "part" && k === "r") return dispatch({ type: "rotate", id: sel.id });
    if (sel && (k === "delete" || k === "backspace")) {
      e.preventDefault();
      return dispatch({ type: "delete", selection: sel });
    }
  };

  const selectedPart = state.selection?.kind === "part" ? state.board.parts.find((p) => p.id === state.selection!.id) : undefined;
  const selectedSt = selectedPart && run.snap ? run.snap.parts[selectedPart.id] : undefined;
  const selectedV = useMemo(() => {
    if (!selectedPart || !run.snap) return undefined;
    const pins = PART_DEFS[selectedPart.type].pins;
    const a = netlist.netOf.get(`${selectedPart.id}.${pins[0].id}`);
    const b = netlist.netOf.get(`${selectedPart.id}.${pins[pins.length - 1].id}`);
    return a !== undefined && b !== undefined ? run.snap.netV[a] - run.snap.netV[b] : undefined;
  }, [selectedPart, run.snap, netlist]);

  const displays = state.board.parts.filter((p) => p.type === "oled" || p.type === "lcd1602").map((p) => p.id);
  const toolBtn = (active: boolean) => clsx(panelBtn, "w-10 px-0", active ? "bg-bolt text-ink-deep" : "text-ink hover:bg-surface");
  const tabs: { id: Tab; label: string }[] = [
    { id: "serial", label: "Serial" },
    ...(displays.length ? [{ id: "screens" as const, label: "Screens" }] : []),
    { id: "plot", label: "Plotter" },
    { id: "pins", label: "Pins" },
    { id: "parts", label: "Parts" },
    { id: "check", label: errorCount ? `Check · ${errorCount}` : "Check" },
  ];
  const fmtTime = (t: number) => (t < 60 ? `${t.toFixed(1)} s` : `${Math.floor(t / 60)} min ${Math.floor(t % 60)} s`);

  return (
    <div
      ref={rootRef}
      data-ui
      tabIndex={-1}
      onKeyDown={onKey}
      className={clsx("flex flex-col overflow-hidden bg-white text-ink outline-none", max ? "fixed inset-0 z-[1000] h-[100svh]" : "relative lg:h-[min(88svh,900px)] lg:min-h-[660px]")}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-black/10 px-2 py-2" role="toolbar" aria-label="Lab tools">
        <label className="flex items-center gap-1.5 px-1 text-[0.8rem] text-muted">
          <span className="sr-only sm:not-sr-only">Example</span>
          <select
            value={project.example}
            onChange={(e) => {
              const ex = exampleById(e.target.value);
              if (ex) loadExample(ex);
            }}
            className="h-9 max-w-48 bg-surface px-1.5 text-[0.85rem] text-ink"
          >
            <optgroup label="Arduino Uno · C++">
              {EXAMPLES.filter((x) => x.board === "uno").map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Raspberry Pi Pico · MicroPython">
              {EXAMPLES.filter((x) => x.board === "pico").map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <span className="mx-1 h-6 w-px bg-black/10" aria-hidden />
        {TOOLS.map(({ tool, label, key, icon: Icon }) => (
          <button key={tool} type="button" aria-label={`${label} (${key})`} title={`${label} (${key})`} aria-pressed={state.tool === tool && !state.placing} className={toolBtn(state.tool === tool && !state.placing)} onClick={() => dispatch({ type: "tool", tool })}>
            <Icon aria-hidden className="h-4.5 w-4.5" />
          </button>
        ))}
        <button type="button" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!state.past.length} className={toolBtn(false)} onClick={() => dispatch({ type: "undo" })}>
          <Undo2 aria-hidden className="h-4.5 w-4.5" />
        </button>
        <button type="button" aria-label="Redo (Ctrl+Y)" title="Redo (Ctrl+Y)" disabled={!state.future.length} className={toolBtn(false)} onClick={() => dispatch({ type: "redo" })}>
          <Redo2 aria-hidden className="h-4.5 w-4.5" />
        </button>
        <button
          type="button"
          aria-label="Reset the example"
          title="Reset the circuit and code of this example"
          className={toolBtn(false)}
          onClick={() => {
            if (example) loadExample(example);
          }}
        >
          <RefreshCw aria-hidden className="h-4.5 w-4.5" />
        </button>
        {boardType === "pico" && (
          <div className="ml-1 flex bg-surface p-0.5" role="group" aria-label="Language">
            {(["python", "cpp"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={language === l} onClick={() => setProject((p) => ({ ...p, language: l }))} className={clsx("h-8 px-2.5 text-[0.8rem] font-semibold", language === l ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")}>
                {l === "python" ? "MicroPython" : "C++"}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {running && (
            <span className="tabular px-2 text-[0.8rem] text-muted" title="Emulated time, and how fast it runs compared with real time">
              {fmtTime(run.clock.time)} · {Math.round(Math.min(run.clock.speed, 9.99) * 100)}% speed
            </span>
          )}
          <button
            type="button"
            title="Check the circuit for errors"
            onClick={runCheck}
            className={clsx(panelBtn, checkStatus === "fresh" ? (errorCount ? "bg-danger text-white hover:bg-[#931c22]" : "bg-success text-white hover:bg-[#0f6a32]") : "bg-ink text-white hover:bg-ink-deep")}
          >
            <ShieldCheck aria-hidden className="h-4 w-4" />
            {checkStatus === "fresh" ? (errorCount ? `Check · ${errorCount} ${errorCount === 1 ? "error" : "errors"}` : "Check · passed") : "Check"}
          </button>
          {running ? (
            <>
              <button type="button" aria-label={run.status === "paused" ? "Resume" : "Pause"} title={run.status === "paused" ? "Resume" : "Pause"} disabled={run.status === "loading"} className={toolBtn(run.status === "paused")} onClick={() => run.pause(run.status !== "paused")}>
                {run.status === "paused" ? <Play aria-hidden className="h-4.5 w-4.5" /> : <Pause aria-hidden className="h-4.5 w-4.5" />}
              </button>
              <button type="button" onClick={() => run.stop()} className={clsx(panelBtn, "min-w-24 bg-danger text-white hover:bg-[#931c22]")}>
                <Square aria-hidden className="h-4 w-4" />
                Stop
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-disabled={!canRun || compiling}
              title={canRun ? (language === "python" ? "Run the script" : "Compile and run") : lockReason}
              onClick={() => void start()}
              className={clsx(panelBtn, "min-w-28", compiling ? "bg-surface-2 text-ink" : canRun ? "bg-bolt text-ink-deep hover:bg-[#46b7e2]" : "cursor-not-allowed bg-surface-2 text-muted")}
            >
              {compiling ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Play aria-hidden className="h-4 w-4" />}
              {compiling ? "Compiling…" : language === "python" ? "Run" : "Compile & run"}
            </button>
          )}
          <button type="button" aria-pressed={max} aria-label={max ? "Minimize" : "Maximize"} title={max ? "Minimize (Esc)" : "Maximize"} className={toolBtn(false)} onClick={() => setMax((m) => !m)}>
            {max ? <Minimize2 aria-hidden className="h-4.5 w-4.5" /> : <Maximize2 aria-hidden className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Code */}
        <section className="order-2 flex h-[50svh] min-h-0 flex-col border-black/10 lg:order-1 lg:h-auto lg:w-[36%] lg:max-w-[560px] lg:border-r" aria-label="Code">
          <div className="flex items-center justify-between gap-2 border-b border-black/10 px-3 py-1.5">
            <p className="flex items-center gap-1.5 text-[0.8rem] font-semibold">
              <Cpu aria-hidden className="h-4 w-4 text-muted" />
              {language === "python" ? "main.py" : "sketch.ino"}
              <span className="font-normal text-muted">· {boardType ? BOARDS[boardType].name : "no board"}</span>
            </p>
            {size && (
              <p className="tabular text-[0.75rem] text-muted" title="Program memory and RAM, as the compiler reports them">
                Flash {Math.round((size.flash / size.flashMax) * 100)}% · RAM {Math.round((size.ram / size.ramMax) * 100)}%
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor value={project.code} onChange={(code) => setProject((p) => ({ ...p, code }))} language={language} diagnostics={diagnostics} label={`${language === "python" ? "MicroPython" : "Arduino C++"} code`} />
          </div>
        </section>

        {/* Breadboard */}
        <div
          className="relative order-1 h-[56svh] min-h-[360px] flex-1 overflow-hidden lg:order-2 lg:h-auto"
          onDragOver={(e) => e.dataTransfer.types.includes("application/x-voltex-part") && e.preventDefault()}
          onDrop={(e) => {
            const t = e.dataTransfer.getData("application/x-voltex-part") as PartType;
            const m = svgRef.current?.getScreenCTM();
            if (!t || !m) return;
            e.preventDefault();
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
            dispatch({ type: "place", part: t, at: { x: p.x, y: p.y } });
          }}
        >
          <BoardCanvas
            state={state}
            dispatch={dispatch}
            snap={run.snap}
            netlist={netlist}
            guides={[]}
            focus={focus}
            hotParts={hot}
            marks={issues}
            onIssue={focusIssue}
            svgRef={svgRef}
            onPress={onPress}
            onProbe={(r) => setProbe(r)}
            onTraceDone={() => {}}
            onBlocked={() => {}}
          />
          {probe && (
            <div className="pointer-events-none absolute left-3 top-3 border border-black/10 bg-ground px-3 py-2 text-ink shadow-sm" role="status">
              <p className="text-[0.75rem] text-muted">{probe.label}</p>
              <p className="tabular text-[1.5rem] font-extrabold leading-none">{probe.value}</p>
            </div>
          )}
          {state.placing && <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 border border-black/10 bg-ground px-3 py-1.5 text-[0.85rem] font-semibold text-ink">Click to place a {PART_DEFS[state.placing].name.toLowerCase()} · Esc to cancel</p>}
          {state.routing && <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 border border-black/10 bg-ground px-3 py-1.5 text-[0.85rem] font-semibold text-ink">Click to bend · finish on a pin · Esc to cancel</p>}
          {(banner || run.error) && (
            <div className={clsx("absolute inset-x-3 bottom-3 flex items-start gap-3 px-4 py-3 text-[0.9rem] font-medium shadow-sm sm:left-1/2 sm:right-auto sm:max-w-xl sm:-translate-x-1/2", (run.error || banner?.tone === "error") ? "bg-danger text-white" : "border border-black/10 bg-ground text-ink")} role="alert">
              <p className="flex-1">{run.error ? `The emulator stopped: ${run.error}` : banner?.text}</p>
              <button type="button" className="shrink-0 font-bold underline underline-offset-4" onClick={() => setBanner(null)}>
                Close
              </button>
            </div>
          )}
        </div>

        {/* Instruments */}
        <aside className="order-3 flex min-h-[320px] flex-col border-black/10 lg:w-[22rem] lg:border-l" aria-label="Instruments and parts">
          {selectedPart && (
            <div className="max-h-[45%] shrink-0 overflow-y-auto border-b border-black/10">
              <Inspector part={selectedPart} st={selectedSt} burnt={run.burntIds().includes(selectedPart.id)} voltage={selectedV} dispatch={dispatch} onRepair={() => {
                  run.repair(selectedPart.id);
                  dispatch({ type: "props", id: selectedPart.id, props: {}, history: false });
                }} />
            </div>
          )}
          <div className="flex shrink-0 border-b border-black/10" role="tablist" aria-label="Instruments">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={clsx("h-10 flex-1 border-b-2 text-[0.8rem] font-semibold", tab === t.id ? "border-bolt text-ink" : "border-transparent text-muted hover:text-ink")}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
            {tab === "serial" && <SerialMonitor text={run.serial} onSend={run.send} onClear={run.clearSerial} live={run.status === "running"} />}
            {tab === "screens" && <Screens snap={run.snap} ids={displays} />}
            {tab === "plot" && <SerialPlotter text={run.serial} />}
            {tab === "pins" && <PinTable activity={run.activity} />}
            {tab === "parts" && <Palette state={state} dispatch={dispatch} allowed={ALLOWED} />}
            {tab === "check" && (
              <>
                <DrcPanel issues={issues} status={checkStatus} onFocus={focusIssue} canFab={false} gate="run" />
                {buildLog && (
                  <details className="mx-4 mb-4">
                    <summary className="cursor-pointer text-[0.85rem] font-semibold">Build output</summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap bg-surface p-2 font-mono text-[0.72rem] leading-snug text-ink">{buildLog}</pre>
                  </details>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
