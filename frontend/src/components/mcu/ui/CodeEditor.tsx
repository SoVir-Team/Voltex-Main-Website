"use client";

import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { indentUnit } from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import type { Language } from "./examples.ts";

export interface CodeDiagnostic {
  line: number;
  column: number;
  severity: "error" | "warning" | "note";
  message: string;
}

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "13.5px", backgroundColor: "#ffffff" },
  ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", lineHeight: "1.55" },
  ".cm-gutters": { backgroundColor: "#f5f6fa", border: "none", color: "#8a90a6" },
  ".cm-activeLine": { backgroundColor: "#f2f7fc" },
  ".cm-activeLineGutter": { backgroundColor: "#e8f1fa" },
  "&.cm-focused": { outline: "none" },
});

/** A real code editor: syntax colours, brackets, search, undo, and compiler errors underlined on their line. */
export function CodeEditor({ value, onChange, language, diagnostics, label }: { value: string; onChange: (v: string) => void; language: Language; diagnostics: CodeDiagnostic[]; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const lang = useRef(new Compartment());
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          lintGutter(),
          theme,
          lang.current.of(language === "python" ? [python(), indentUnit.of("    ")] : [cpp(), indentUnit.of("  ")]),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // The editor is created once; later changes arrive through the effects below.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Replace the text when it changes from outside (an example was loaded).
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: lang.current.reconfigure(language === "python" ? [python(), indentUnit.of("    ")] : [cpp(), indentUnit.of("  ")]) });
  }, [language]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const doc = v.state.doc;
    const marks: CmDiagnostic[] = diagnostics
      .filter((d) => d.line >= 1 && d.line <= doc.lines)
      .map((d) => {
        const line = doc.line(d.line);
        const from = Math.min(line.to, line.from + Math.max(0, d.column - 1));
        const word = /^[\w.]+/.exec(doc.sliceString(from, line.to))?.[0].length ?? 0;
        return { from, to: Math.min(line.to, from + Math.max(1, word)), severity: d.severity === "note" ? "info" : d.severity, message: d.message };
      });
    v.dispatch(setDiagnostics(v.state, marks));
  }, [diagnostics]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}
