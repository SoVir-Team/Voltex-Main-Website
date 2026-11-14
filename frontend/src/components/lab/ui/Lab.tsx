"use client";

import { clsx } from "clsx";
import { motion, useReducedMotion } from "motion/react";
import { Box, CircleDot, Download, Gauge, Layers, Maximize2, Minimize2, MousePointer2, Power, Redo2, RefreshCw, ShieldCheck, Spline, Sun, Trash2, Undo2, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { makeContext, ratsnest, type CheckItem } from "../engine/missions.ts";
import type { DrcIssue } from "../engine/drc.ts";
import { PALETTE, PART_DEFS, partBox } from "../engine/parts.ts";
import type { SimEvent } from "../engine/solver.ts";
import type { Board, PartType, Pt } from "../engine/types.ts";
import { Mascot } from "../mascot/Mascot.tsx";
import { LINE_BY_ID, VoicePlayer, type Mood } from "../mascot/voice.ts";
import { TRACE_WIDTHS, activeMission, canUndo, canRedo, loadState, modeKey, reducer, saveState, type Tool } from "../state/store.ts";
import { propertySpec } from "../engine/properties.ts";
import { CircuitAudio } from "../state/circuitAudio.ts";
import { useSimulation } from "../state/useSimulation.ts";
import { BoardCanvas, type ProbeReading } from "./BoardCanvas.tsx";
import { DrcPanel, Inspector, MissionList, MissionPanel, Palette, panelBtn } from "./Panels.tsx";
import { Dialog } from "@/components/ui/Dialog";

const TOOLS: { tool: Tool; label: string; key: string; icon: typeof Spline }[] = [
  { tool: "select", label: "Select and move", key: "S", icon: MousePointer2 },
  { tool: "trace", label: "Route trace", key: "T", icon: Spline },
  { tool: "via", label: "Place via", key: "I", icon: CircleDot },
  { tool: "probe", label: "Multimeter probe", key: "P", icon: Gauge },
  { tool: "delete", label: "Delete", key: "X", icon: Trash2 },
];

/**
 * What a Check covers: parts, values, wiring. Live controls (switch position, pot knob) are left out, so using
 * the circuit while powered doesn't make the check go stale.
 */
function designKey(board: Board): string {
  return JSON.stringify({
    parts: board.parts.map((p) => ({ ...p, props: { ...p.props, closed: undefined, pos: undefined } })),
    traces: board.traces,
    vias: board.vias,
    w: board.w,
    h: board.h,
  });
}

interface Speech {
  id: string;
  text: string;
  mood: Mood;
}

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Lab() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const reduce = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const [circuitAudio] = useState(() => new CircuitAudio());
  const [circuitSound, setCircuitSound] = useState(true);
  const [voice] = useState(() => new VoicePlayer());
  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return window.localStorage.getItem("voltex-lab-voice") !== "off";
    } catch {
      return true;
    }
  });
  const [started, setStarted] = useState(false);
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [mood, setMood] = useState<Mood>("idle");
  const [point, setPoint] = useState<number | null>(null);
  // Highlights and probe readings belong to one board; they vanish when the mode changes.
  const [marks, setMarks] = useState<{ mode: string; focus: Pt | null; hot: Set<string>; probe: ProbeReading | null }>({ mode: "", focus: null, hot: new Set(), probe: null });
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [checks, setChecks] = useState<CheckItem[]>([]);
  // The last Check: problems are only shown, and power only unlocked, from here.
  const [check, setCheck] = useState<{ key: string; issues: DrcIssue[] } | null>(null);
  const [gateMsg, setGateMsg] = useState<string | null>(null);
  const [max, setMax] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  // Bumped when a part burns, so the checks re-run with it burnt.
  const [burns, setBurns] = useState(0);

  const queue = useRef<{ id: string; at?: Pt }[]>([]);
  const busy = useRef(false);
  const said = useRef(new Map<string, number>());
  const once = useRef(new Set<string>());
  const spokenDrc = useRef(new Set<string>());

  const mission = activeMission(state.mode);
  const modeId = modeKey(state.mode);
  const current = marks.mode === modeId ? marks : { focus: null, hot: new Set<string>(), probe: null };
  const { focus, hot, probe } = current;
  const mark = useCallback(
    (patch: Partial<Omit<typeof marks, "mode">>) =>
      setMarks((m) => ({ ...(m.mode === modeId ? m : { focus: null, hot: new Set<string>(), probe: null }), ...patch, mode: modeId })),
    [modeId],
  );
  const setFocus = useCallback((focus: Pt | null) => mark({ focus }), [mark]);
  const setHot = useCallback((hot: Set<string>) => mark({ hot }), [mark]);
  const setProbe = useCallback((probe: ProbeReading | null) => mark({ probe }), [mark]);

  // ---------- Volta's voice: a short queue so lines never talk over each other ----------
  const aimAt = useCallback((at?: Pt) => {
    const svg = svgRef.current;
    const m = mascotRef.current;
    if (!at || !svg || !m) {
      setPoint(null);
      return;
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(at.x, at.y).matrixTransform(ctm);
    const r = m.getBoundingClientRect();
    setPoint((Math.atan2(p.y - (r.top + r.height * 0.43), p.x - (r.left + r.width / 2)) * 180) / Math.PI);
  }, []);

  const pumpRef = useRef<() => void>(() => {});
  const pump = useCallback(async () => {
    if (busy.current) return;
    const next = queue.current.shift();
    if (!next) return;
    const line = LINE_BY_ID.get(next.id);
    if (!line) return;
    busy.current = true;
    setSpeech({ id: line.id, text: line.text, mood: line.mood });
    setMood(line.mood === "talking" ? "talking" : line.mood);
    if (next.at) {
      setFocus(next.at);
      aimAt(next.at);
    }
    await voice.play(line.id);
    await new Promise((r) => setTimeout(r, 900));
    busy.current = false;
    setPoint(null);
    if (queue.current.length) pumpRef.current();
    else {
      setMood("idle");
      setSpeech((s) => (s?.id === line.id ? null : s));
    }
  }, [aimAt, voice, setFocus]);
  useEffect(() => {
    pumpRef.current = () => void pump();
  }, [pump]);

  const say = useCallback(
    (id: string, opts: { at?: Pt; force?: boolean; cooldown?: number } = {}) => {
      if (!LINE_BY_ID.has(id)) return;
      const now = performance.now();
      const last = said.current.get(id) ?? -Infinity;
      if (!opts.force && now - last < (opts.cooldown ?? 20000)) return;
      if (queue.current.some((q) => q.id === id)) return;
      said.current.set(id, now);
      // Corrections jump the queue; chatter waits.
      const urgent = LINE_BY_ID.get(id)!.mood === "worried";
      if (urgent) queue.current.unshift({ id, at: opts.at });
      else queue.current.push({ id, at: opts.at });
      queue.current = queue.current.slice(0, 3);
      void pump();
    },
    [pump],
  );

  const sayOnce = useCallback(
    (id: string, opts: { at?: Pt } = {}) => {
      if (once.current.has(id)) return;
      once.current.add(id);
      say(id, { ...opts, force: true });
    },
    [say],
  );

  useEffect(() => {
    void voice.load();
  }, [voice]);

  useEffect(() => {
    voice.setEnabled(voiceOn);
  }, [voiceOn, voice]);

  const partCentre = useCallback(
    (id: string): Pt | undefined => {
      const p = state.board.parts.find((q) => q.id === id);
      if (!p) return undefined;
      const b = partBox(p);
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    },
    [state.board.parts],
  );

  // ---------- Simulation and what Volta says about it ----------
  const onEvents = useCallback(
    (events: SimEvent[]) => {
      for (const e of events) {
        const at = partCentre(e.partId);
        if (e.type === "short") say("short", { at, force: true });
        else if (e.type === "burnt") say(e.partType === "led" ? "burnt-led" : e.partType === "electrolytic" ? "cap-pop" : "burnt-part", { at, force: true });
        else if (e.type === "reversed") say(e.partType === "led" ? "reversed-led" : e.partType === "electrolytic" ? "cap-pop" : "reversed", { at });
        else if (e.type === "reset-floating") say("reset-floating", { at });
        else if (e.type === "overcurrent" && e.partType === "led") say("overcurrent", { at, cooldown: 8000 });
        if (e.type === "burnt" || e.type === "short") setHot(new Set([e.partId]));
        if (e.type === "burnt") setBurns((n) => n + 1);
      }
    },
    [partCentre, say, setHot],
  );

  const sim = useSimulation(state.board, state.powered, state.ambient, pressed, onEvents);
  useEffect(() => {
    circuitAudio.update(state.board, state.powered ? sim.snap : null, circuitSound);
  }, [circuitAudio, state.board, state.powered, sim.snap, circuitSound]);
  useEffect(() => () => circuitAudio.dispose(), [circuitAudio]);

  const { burntIds } = sim;

  // ---------- Mission checks and design rules, re-run shortly after each edit ----------
  useEffect(() => {
    const t = window.setTimeout(() => {
      const ctx = makeContext(state.board, { netlist: sim.netlist, probed: state.probed, fabSent: state.fabSent, burnt: new Set(burntIds()) });
      setChecks(mission ? mission.checks(ctx) : []);
    }, 350);
    return () => window.clearTimeout(t);
  }, [state.board, state.probed, state.fabSent, sim.netlist, mission, burntIds, burns]);

  const missionDone = Boolean(mission && checks.length && checks.every((c) => c.ok));
  const celebrated = useRef(new Set<string>());
  useEffect(() => {
    if (!mission || !missionDone || celebrated.current.has(mission.id)) return;
    celebrated.current.add(mission.id);
    if (!state.completed.includes(mission.id)) dispatch({ type: "complete", id: mission.id });
    say(mission.success, { force: true, cooldown: 0 });
  }, [missionDone, mission, say, state.completed]);

  // Intro line when the mission changes.
  useEffect(() => {
    if (!started) return;
    spokenDrc.current.clear();
    say(mission ? mission.intro : "sandbox-intro", { force: true });
  }, [modeId, started]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = window.setTimeout(() => saveState(state), 400);
    return () => window.clearTimeout(t);
  }, [state]);

  // ---------- Sleep after a quiet minute, wake on activity ----------
  const lastActive = useRef(0);
  useEffect(() => {
    lastActive.current = performance.now();
    const id = window.setInterval(() => {
      if (!busy.current && performance.now() - lastActive.current > 60000) setSleeping(true);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);
  const activity = () => {
    circuitAudio.unlock();
    lastActive.current = performance.now();
    if (sleeping) {
      setSleeping(false);
      say("wake", { cooldown: 120000 });
    }
  };

  // ---------- Check, then power ----------
  const boardKey = useMemo(() => designKey(state.board), [state.board]);
  const checkStatus: "unchecked" | "stale" | "fresh" = !check ? "unchecked" : check.key === boardKey ? "fresh" : "stale";
  const issues = checkStatus === "fresh" ? check!.issues : [];
  const errorCount = issues.filter((d) => d.severity === "error").length;
  const canPower = checkStatus === "fresh" && errorCount === 0;
  const lockReason = checkStatus === "unchecked" ? "Press Check first. Power unlocks when the circuit has no errors." : checkStatus === "stale" ? "You changed the circuit. Press Check again." : `Fix ${errorCount} ${errorCount === 1 ? "error" : "errors"} to unlock the power.`;

  // Any change to the design switches the power off until it is checked again.
  useEffect(() => {
    if (state.powered && !canPower) dispatch({ type: "power", on: false });
  }, [state.powered, canPower]);

  useEffect(() => {
    if (!gateMsg) return;
    const t = window.setTimeout(() => setGateMsg(null), 3500);
    return () => window.clearTimeout(t);
  }, [gateMsg]);

  // Maximised, the lab covers the page; the page behind it shouldn't scroll.
  useEffect(() => {
    if (!max) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [max]);

  // ---------- Actions ----------
  const start = () => {
    voice.unlock();
    setStarted(true);
    sayOnce("greet");
    rootRef.current?.focus();
  };

  const runCheck = () => {
    voice.unlock();
    const ctx = makeContext(state.board, { netlist: sim.netlist, probed: state.probed, fabSent: state.fabSent, burnt: new Set(burntIds()) });
    setCheck({ key: designKey(state.board), issues: ctx.drc });
    setGateMsg(null);
    const first = ctx.drc.find((d) => d.severity === "error") ?? ctx.drc[0];
    if (!first) {
      setHot(new Set());
      say("all-clear", { force: true });
      return;
    }
    setHot(new Set(first.partIds));
    say(first.code === "overcurrent" ? "overcurrent" : first.code, { at: first.at, force: true });
  };

  const togglePower = () => {
    voice.unlock();
    if (!state.powered) {
      if (!canPower) {
        setGateMsg(lockReason);
        return;
      }
      if (!sim.hasPower) {
        say("no-power", { force: true });
        return;
      }
      sayOnce("power-on");
    } else setHot(new Set());
    dispatch({ type: "power" });
  };

  const setTool = (tool: Tool) => {
    dispatch({ type: "tool", tool });
    if (tool === "probe") sayOnce("probe-hint");
  };

  const onPress = (id: string, down: boolean) =>
    setPressed((s) => {
      const n = new Set(s);
      if (down) n.add(id);
      else n.delete(id);
      return n;
    });

  const onTraceDone = () => {
    if (state.board.traces.length === 0) sayOnce("first-trace");
  };

  useEffect(() => {
    if (state.board.vias.length > 0) sayOnce("first-via");
  }, [state.board.vias.length, sayOnce]);

  const focusIssue = (d: DrcIssue) => {
    setFocus(d.at);
    setHot(new Set(d.partIds));
    const line = d.code === "overcurrent" ? "overcurrent" : d.code;
    say(line, { at: d.at, force: true });
  };

  const sendToFab = () => {
    if (checkStatus !== "fresh") {
      setGateMsg("Press Check before you send it to fab.");
      return;
    }
    if (issues.some((d) => d.severity === "error")) {
      say("fab-blocked", { force: true });
      return;
    }
    dispatch({ type: "fab", sent: true });
    if (!(mission?.id === "fab")) sayOnce("fab-view");
  };

  const repair = (id: string) => {
    sim.repair(id);
    setHot(new Set());
    dispatch({ type: "props", id, props: {}, history: false });
  };

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const { board } = state;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("viewBox", `-1 -1 ${board.w + 2} ${board.h + 2}`);
    clone.setAttribute("width", String((board.w + 2) * 40));
    clone.setAttribute("height", String((board.h + 2) * 40));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0);
      c.toBlob((b) => b && download(`voltex-board-${modeId}.png`, b, "image/png"));
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  };

  const bom = useMemo(() => {
    const rows = new Map<string, { refs: string[]; name: string; spec: string }>();
    for (const p of state.board.parts) {
      const def = PART_DEFS[p.type];
      const key = `${def.name}|${propertySpec(p)}`;
      const row = rows.get(key) ?? { refs: [], name: def.name, spec: propertySpec(p) };
      row.refs.push(p.id);
      rows.set(key, row);
    }
    return [...rows.values()];
  }, [state.board.parts]);

  // ---------- Keyboard ----------
  const onKey = (e: React.KeyboardEvent) => {
    activity();
    const target = e.target as HTMLElement;
    if (target.closest("input, select, textarea, [contenteditable=true]")) return;
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
    if ((e.ctrlKey || e.metaKey) && ["a", "c", "v"].includes(k)) {
      e.preventDefault();
      if (k === "a") dispatch({ type: "select", selection: { kind: "all", id: "all" } });
      if (k === "c") dispatch({ type: "copy" });
      if (k === "v") dispatch({ type: "paste-start" });
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
    if (state.routing && k === "v") {
      dispatch({ type: "route-via" });
      return;
    }
    if (state.routing && k === "backspace") {
      e.preventDefault();
      dispatch({ type: "route-undo" });
      return;
    }
    if (state.routing && k === "enter") {
      dispatch({ type: "route-finish" });
      onTraceDone();
      return;
    }
    const tool = TOOLS.find((t) => t.key.toLowerCase() === k);
    if (tool) return setTool(tool.tool);
    if (k === "w") return setTool("trace");
    if (k === "l") return dispatch({ type: "layer" });
    if (k === "f") return dispatch({ type: "view", view: state.view === "fab" ? "design" : "fab" });
    if (sel?.kind === "part" && k === "r") return dispatch({ type: "rotate", id: sel.id });
    if (sel && (k === "delete" || k === "backspace")) {
      e.preventDefault();
      return dispatch({ type: "delete", selection: sel });
    }
    if (sel?.kind === "part" && k.startsWith("arrow")) {
      e.preventDefault();
      const p = state.board.parts.find((q) => q.id === sel.id);
      if (!p) return;
      const d = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k] ?? [0, 0];
      dispatch({ type: "begin-edit" });
      dispatch({ type: "move", id: p.id, at: { x: p.x + d[0], y: p.y + d[1] } });
    }
  };

  const selectedPart = state.selection?.kind === "part" ? state.board.parts.find((p) => p.id === state.selection!.id) : undefined;
  const selectedSt = selectedPart && sim.snap ? sim.snap.parts[selectedPart.id] : undefined;
  const selectedV = useMemo(() => {
    if (!selectedPart || !sim.snap) return undefined;
    const pins = PART_DEFS[selectedPart.type].pins;
    const a = sim.netlist.netOf.get(`${selectedPart.id}.${pins[0].id}`);
    const b = sim.netlist.netOf.get(`${selectedPart.id}.${pins[pins.length - 1].id}`);
    return a !== undefined && b !== undefined ? sim.snap.netV[a] - sim.snap.netV[b] : undefined;
  }, [selectedPart, sim.snap, sim.netlist]);

  const guides = useMemo(() => (mission ? ratsnest(state.board, sim.netlist, mission.nets) : []), [mission, state.board, sim.netlist]);
  const allowed: PartType[] = mission ? mission.palette : PALETTE;
  const hasLdr = state.board.parts.some((p) => p.type === "ldr");
  const shownMood: Mood = sleeping ? "sleeping" : mood;
  const fab = state.view === "fab";

  const toolBtn = (active: boolean) => clsx(panelBtn, "w-10 px-0", active ? "bg-bolt text-ink-deep" : "text-ink hover:bg-surface");

  return (
    <div
      ref={rootRef}
      data-ui
      tabIndex={-1}
      onKeyDown={onKey}
      onPointerDown={activity}
      className={clsx("flex flex-col overflow-hidden bg-white text-ink outline-none", max ? "fixed inset-0 z-[1000] h-[100svh]" : "relative lg:h-[min(86svh,860px)] lg:min-h-[640px]")}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-black/10 px-2 py-2" role="toolbar" aria-label="Lab tools">
        {TOOLS.map(({ tool, label, key, icon: Icon }) => (
          <button key={tool} type="button" aria-label={`${label} (${key})`} title={`${label} (${key})`} aria-pressed={state.tool === tool && !state.placing} className={toolBtn(state.tool === tool && !state.placing)} onClick={() => setTool(tool)}>
            <Icon aria-hidden className="h-4.5 w-4.5" />
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-black/10" aria-hidden />
        <button type="button" title="Switch copper layer (L)" className={clsx(panelBtn, "text-ink hover:bg-surface")} onClick={() => dispatch({ type: "layer" })}>
          <Layers aria-hidden className="h-4 w-4" />
          <span className="h-3 w-3" style={{ background: state.layer === "top" ? "#c97a10" : "#1f8fc0" }} aria-hidden />
          {state.layer === "top" ? "Top" : "Bottom"}
        </button>
        <label className="flex items-center gap-1.5 px-1 text-[0.8rem] text-muted">
          Width
          <select value={state.width} onChange={(e) => dispatch({ type: "width", width: Number(e.target.value) })} className="h-9 bg-surface px-1.5 text-[0.85rem] text-ink">
            {TRACE_WIDTHS.map((w) => (
              <option key={w} value={w}>
                {w} mm
              </option>
            ))}
          </select>
        </label>
        <span className="mx-1 h-6 w-px bg-black/10" aria-hidden />
        <button type="button" aria-label="Undo (Ctrl+Z)" aria-keyshortcuts="Control+z Meta+z" title={state.routing ? "Undo last wire step (Ctrl/Cmd+Z)" : "Undo last design change (Ctrl/Cmd+Z)"} disabled={!canUndo(state)} className={toolBtn(false)} onClick={() => { dispatch({ type: "undo" }); rootRef.current?.focus({ preventScroll: true }); }}>
          <Undo2 aria-hidden className="h-4.5 w-4.5" />
          Undo
        </button>
        <button type="button" aria-label="Redo (Ctrl+Y)" aria-keyshortcuts="Control+y Control+Shift+z Meta+Shift+z" title="Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)" disabled={!canRedo(state)} className={clsx(panelBtn, "text-on-ink hover:bg-white/10")} onClick={() => { dispatch({ type: "redo" }); rootRef.current?.focus({ preventScroll: true }); }}>
          <Redo2 aria-hidden className="h-4.5 w-4.5" />
          Redo
        </button>
        <button type="button" className={clsx(panelBtn, "text-on-ink hover:bg-white/10")} disabled={!state.selection} onClick={() => dispatch({ type: "copy" })} title="Copy (Ctrl/Cmd+C)">Copy</button>
        <button type="button" className={clsx(panelBtn, "text-on-ink hover:bg-white/10")} disabled={!state.board.parts.length && !state.board.traces.length && !state.board.vias.length} onClick={() => dispatch({ type: "copy", all: true })}>Copy all</button>
        <button type="button" className={clsx(panelBtn, "text-on-ink hover:bg-white/10")} disabled={!state.clipboard} onClick={() => dispatch({ type: "paste-start" })} title="Paste (Ctrl/Cmd+V)">Paste</button>
        <button type="button" className={clsx(panelBtn, "text-on-ink hover:bg-white/10")} aria-pressed={circuitSound} onClick={() => setCircuitSound((on) => !on)}>Circuit sound: {circuitSound ? "on" : "off"}</button>
        <button type="button" aria-label="Reset board" title="Reset board" className={toolBtn(false)} onClick={() => dispatch({ type: "reset" })}>
          <RefreshCw aria-hidden className="h-4.5 w-4.5" />
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {hasLdr && (
            <label className="flex items-center gap-2 px-2 text-[0.8rem] text-muted">
              <Sun aria-hidden className="h-4 w-4" />
              <span className="sr-only">Room light</span>
              <input type="range" min={0} max={1} step={0.01} value={state.ambient} onChange={(e) => dispatch({ type: "ambient", value: Number(e.target.value) })} className="w-24 accent-bolt" />
            </label>
          )}
          <button type="button" aria-pressed={fab} title="Fab view (F)" className={clsx(panelBtn, fab ? "bg-ink text-white" : "text-ink hover:bg-surface")} onClick={() => dispatch({ type: "view", view: fab ? "design" : "fab" })}>
            <Box aria-hidden className="h-4 w-4" />
            Fab view
          </button>
          <button type="button" aria-label="Export" title="Export" className={toolBtn(false)} onClick={() => setExportOpen(true)}>
            <Download aria-hidden className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            title="Check the circuit for errors"
            onClick={runCheck}
            className={clsx(panelBtn, checkStatus === "fresh" ? (errorCount ? "bg-danger text-white hover:bg-[#931c22]" : "bg-success text-white hover:bg-[#0f6a32]") : "bg-ink text-white hover:bg-ink-deep")}
          >
            <ShieldCheck aria-hidden className="h-4 w-4" />
            {checkStatus === "fresh" ? (errorCount ? `Check · ${errorCount} ${errorCount === 1 ? "error" : "errors"}` : "Check · passed") : "Check"}
          </button>
          <button
            type="button"
            aria-pressed={state.powered}
            aria-disabled={!state.powered && !canPower}
            aria-label={!state.powered && !canPower ? `Power (locked: ${lockReason})` : "Power"}
            title={!state.powered && !canPower ? lockReason : "Power"}
            onClick={togglePower}
            className={clsx(
              panelBtn,
              "min-w-28",
              state.powered ? "bg-success text-white hover:bg-[#0f6a32]" : canPower ? "bg-bolt text-ink-deep hover:bg-[#46b7e2]" : "cursor-not-allowed bg-surface-2 text-muted",
            )}
          >
            <Power aria-hidden className="h-4 w-4" />
            {state.powered ? "Power on" : "Power off"}
          </button>
          <button type="button" aria-pressed={max} aria-label={max ? "Minimize" : "Maximize"} title={max ? "Minimize (Esc)" : "Maximize"} className={toolBtn(false)} onClick={() => setMax((m) => !m)}>
            {max ? <Minimize2 aria-hidden className="h-4.5 w-4.5" /> : <Maximize2 aria-hidden className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {state.clipboardMessage && <p role="status" className="border-b border-white/10 px-4 py-2 text-[0.8rem] text-on-ink-muted">{state.clipboardMessage}</p>}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="order-2 border-black/10 lg:order-1 lg:w-56 lg:border-r">
          <Palette state={state} dispatch={dispatch} allowed={allowed} />
        </div>

        {/* Board */}
        <div
          className="relative order-1 h-[62svh] min-h-[360px] flex-1 overflow-hidden lg:order-2 lg:h-auto"
          onDragOver={(e) => e.dataTransfer.types.includes("application/x-voltex-part") && e.preventDefault()}
          onDrop={(e) => {
            const t = e.dataTransfer.getData("application/x-voltex-part") as PartType;
            const svg = svgRef.current;
            const m = svg?.getScreenCTM();
            if (!t || !m) return;
            e.preventDefault();
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
            dispatch({ type: "place", part: t, at: { x: p.x, y: p.y } });
          }}
        >
          <motion.div
            className="absolute inset-0"
            animate={fab && !reduce ? { rotateX: 32, rotateZ: -10, scale: 0.86, y: -10 } : { rotateX: 0, rotateZ: 0, scale: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0.15, duration: 0.8 }}
            style={{ transformPerspective: 1400 }}
          >
            <BoardCanvas
              key={modeId}
              state={state}
              dispatch={dispatch}
              snap={sim.snap}
              netlist={sim.netlist}
              guides={guides}
              focus={focus}
              hotParts={hot}
              marks={issues}
              onIssue={focusIssue}
              svgRef={svgRef}
              onPress={onPress}
              onProbe={(r, pins) => {
                setProbe(r);
                if (pins.length) dispatch({ type: "probe", pins });
              }}
              onTraceDone={onTraceDone}
              onBlocked={(at) => say("route-blocked", { at, cooldown: 15000 })}
            />
          </motion.div>

          {probe && (
            <div className="pointer-events-none absolute left-3 top-3 border border-black/10 bg-ground px-3 py-2 text-ink shadow-sm" role="status">
              <p className="text-[0.75rem] text-muted">{probe.label}</p>
              <p className="tabular text-[1.5rem] font-extrabold leading-none">{probe.value}</p>
            </div>
          )}
          {state.placing && <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 bg-ground px-3 py-1.5 text-[0.85rem] font-semibold text-ink">Click the board to place a {PART_DEFS[state.placing].name.toLowerCase()} · Esc to cancel</p>}
          {state.routing && <p className="pointer-events-none absolute left-1/2 top-3 max-w-[calc(100%-1.5rem)] -translate-x-1/2 bg-ground px-3 py-1.5 text-[0.85rem] font-semibold text-ink">Click to bend · finish on a pad · Undo or Ctrl/Cmd+Z to step back · V for a via · Esc to cancel</p>}
          {gateMsg && (
            <p className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 bg-danger px-3 py-1.5 text-center text-[0.85rem] font-semibold text-white" role="alert">
              {gateMsg}
            </p>
          )}

          {/* Volta */}
          <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[min(30rem,calc(100%-1.5rem))] items-end gap-2">
            <div ref={mascotRef} className="pointer-events-auto shrink-0 cursor-pointer" onClick={() => say("encourage", { cooldown: 15000 })} title="Volta">
              <Mascot mood={shownMood} level={() => voice.level()} point={point} size={104} />
            </div>
            {speech && (
              <motion.p
                key={speech.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                className="mb-10 border border-black/10 bg-ground px-4 py-3 shadow-sm text-[0.95rem] font-medium leading-snug text-ink"
                style={{ transformOrigin: "0% 100%" }}
              >
                {speech.text}
              </motion.p>
            )}
          </div>
          <p className="sr-only" aria-live="polite">
            {speech ? `Volta says: ${speech.text}` : ""}
          </p>
          <button
            type="button"
            aria-pressed={voiceOn}
            aria-label="Volta's voice"
            title={voiceOn ? "Voice on" : "Captions only"}
            onClick={() => {
              voice.unlock();
              setVoiceOn((v) => {
                try {
                  window.localStorage.setItem("voltex-lab-voice", v ? "off" : "on");
                } catch {
                  /* no storage */
                }
                return !v;
              });
            }}
            className={clsx(panelBtn, "absolute bottom-3 right-3 w-10 bg-ink px-0 text-on-ink hover:bg-ink-deep")}
          >
            {voiceOn ? <Volume2 aria-hidden className="h-4.5 w-4.5" /> : <VolumeX aria-hidden className="h-4.5 w-4.5" />}
          </button>

          {!started && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/85 p-6">
              <div className="flex max-w-md flex-col items-center text-center">
                <Mascot mood="happy" level={() => 0} point={null} size={140} />
                <p className="mt-4 text-[1.6rem] font-extrabold leading-tight">Meet Volta, your lab partner</p>
                <p className="mt-2 text-muted">She talks you through each mission and tells you when something is about to burn. Turn your sound on.</p>
                <button type="button" onClick={start} className={clsx(panelBtn, "mt-6 min-h-12 bg-bolt px-8 text-[1rem] text-ink-deep hover:bg-[#46b7e2]")}>
                  Start the lab
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <aside className="order-3 min-h-0 overflow-y-auto border-black/10 lg:w-[22rem] lg:border-l" aria-label="Mission and inspector">
          <MissionPanel state={state} dispatch={dispatch} checks={checks} onAll={() => setMissionsOpen(true)} />
          {selectedPart && <Inspector part={selectedPart} st={selectedSt} burnt={burntIds().includes(selectedPart.id)} voltage={selectedV} dispatch={dispatch} onRepair={() => repair(selectedPart.id)} />}
          <DrcPanel issues={issues} status={checkStatus} onFocus={focusIssue} onFab={sendToFab} canFab={state.board.parts.length > 0} />
          {state.fabSent && (
            <div className="mx-4 mb-4 bg-surface p-4">
              <p className="font-bold">Sent to fab</p>
              <p className="mt-1 text-[0.875rem] leading-snug text-muted">
                Want it made for real? Voltex fabricates and assembles boards like this one.{" "}
                <a href="/bring-your-idea" className="font-semibold text-signal underline underline-offset-4">
                  Bring your idea
                </a>
              </p>
            </div>
          )}
        </aside>
      </div>

      <Dialog open={missionsOpen} onClose={() => setMissionsOpen(false)} labelledBy="missions-title">
        <MissionList state={state} dispatch={dispatch} onClose={() => setMissionsOpen(false)} />
      </Dialog>
      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} labelledBy="export-title">
        <div className="p-6 sm:p-8">
          <h2 id="export-title" className="display text-[clamp(1.8rem,1.3rem+1.6vw,2.6rem)] text-ink">
            Export your board
          </h2>
          <h3 className="mt-6 font-bold text-ink">Bill of materials</h3>
          {bom.length === 0 ? (
            <p className="mt-2 text-muted">No parts yet.</p>
          ) : (
            <table className="mt-2 w-full text-left text-[0.9rem]">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Qty</th>
                  <th className="py-2 pr-4 font-semibold">References</th>
                  <th className="py-2 pr-4 font-semibold">Part</th>
                  <th className="py-2 font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                {bom.map((r) => (
                  <tr key={r.refs.join()} className="border-t border-surface-2">
                    <td className="tabular py-2 pr-4">{r.refs.length}</td>
                    <td className="py-2 pr-4">{r.refs.join(", ")}</td>
                    <td className="py-2 pr-4">{r.name}</td>
                    <td className="py-2">{r.spec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className={clsx(panelBtn, "min-h-12 bg-ink px-5 text-on-ink hover:bg-ink-deep")} onClick={exportPng}>
              Board image (PNG)
            </button>
            <button
              type="button"
              className={clsx(panelBtn, "min-h-12 bg-surface px-5 text-ink hover:bg-surface-2")}
              onClick={() => download(`voltex-bom-${modeId}.csv`, ["Qty,References,Part,Value", ...bom.map((r) => `${r.refs.length},"${r.refs.join(" ")}","${r.name}","${r.spec}"`)].join("\n"), "text/csv")}
            >
              Bill of materials (CSV)
            </button>
            <button type="button" className={clsx(panelBtn, "min-h-12 bg-surface px-5 text-ink hover:bg-surface-2")} onClick={() => download(`voltex-board-${modeId}.json`, JSON.stringify(state.board, null, 2), "application/json")}>
              Board file (JSON)
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
