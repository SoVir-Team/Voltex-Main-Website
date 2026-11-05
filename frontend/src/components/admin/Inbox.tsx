"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Archive, ChevronDown, Inbox as InboxIcon, Mail, Trash2 } from "lucide-react";
import type { ContactMessage, IdeaSubmission, InboxStatus } from "@voltex/shared";
import { adminFetch } from "@/lib/admin-fetch";
import { AdminPageHead } from "./AdminShell";

type Kind = "ideas" | "messages";
type Item = (IdeaSubmission | ContactMessage) & Partial<IdeaSubmission> & Partial<ContactMessage>;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

const COPY: Record<Kind, { title: string; sub: string; empty: string }> = {
  ideas: { title: "Ideas", sub: "Product ideas from the Bring your idea form. Reply within one working day; send an NDA first when asked.", empty: "No ideas here yet." },
  messages: { title: "Messages", sub: "Messages from the contact form.", empty: "No messages here yet." },
};

export function Inbox({ kind }: { kind: Kind }) {
  const [view, setView] = useState<"" | InboxStatus>("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    adminFetch<{ data: Item[] }>(`/api/admin/${kind}${view ? `?status=${view}` : ""}`).then((r) => {
      if (alive) setItems(r.ok ? r.data.data : []);
    });
    return () => {
      alive = false;
    };
  }, [kind, view]);

  const setStatus = async (it: Item, status: InboxStatus) => {
    const r = await adminFetch(`/api/admin/${kind}/${it.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (r.ok) setItems((xs) => (xs ?? []).map((x) => (x.id === it.id ? { ...x, status } : x)).filter((x) => view === "archived" || view === x.status || (view === "" && x.status !== "archived")));
  };
  const remove = async (it: Item) => {
    if (!window.confirm("Delete this permanently?")) return;
    const r = await adminFetch(`/api/admin/${kind}/${it.id}`, { method: "DELETE" });
    if (r.ok) setItems((xs) => (xs ?? []).filter((x) => x.id !== it.id));
  };
  const expand = (it: Item) => {
    setOpen(open === it.id ? null : it.id);
    if (it.status === "new") setStatus(it, "read");
  };

  return (
    <>
      <AdminPageHead title={COPY[kind].title} sub={COPY[kind].sub} />
      <div role="group" aria-label="Filter" className="mb-4 flex flex-wrap gap-1">
        {([["", "Inbox"], ["new", "New"], ["read", "Read"], ["archived", "Archived"]] as const).map(([k, l]) => (
          <button key={l} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={clsx("h-10 px-3.5 text-[0.9rem] font-semibold", view === k ? "bg-ink text-on-ink" : "bg-ground hover:bg-surface-2")}>
            {l}
          </button>
        ))}
      </div>
      {items === null ? (
        <p className="text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 bg-ground p-8 text-muted">
          <InboxIcon aria-hidden className="h-5 w-5" /> {COPY[kind].empty}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const expanded = open === it.id;
            const subject = kind === "ideas" ? `Your idea: ${it.stage ?? ""}` : it.subject || "Your message to VOLTEX";
            return (
              <li key={it.id} className="bg-ground">
                <button type="button" onClick={() => expand(it)} aria-expanded={expanded} className="flex w-full items-center gap-3 p-4 text-left">
                  <ChevronDown aria-hidden className={clsx("h-5 w-5 shrink-0 transition-transform", expanded && "rotate-180")} />
                  <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", it.status === "new" ? "bg-bolt-deep" : "bg-transparent")} aria-label={it.status === "new" ? "New" : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className={clsx("block truncate", it.status === "new" ? "font-bold" : "font-medium")}>
                      {it.name}{it.company ? `, ${it.company}` : ""}
                      {kind === "ideas" && it.ndaRequested ? <span className="ml-2 bg-[#fdf1e2] px-2 py-0.5 text-small font-semibold text-warning">NDA requested</span> : null}
                    </span>
                    <span className="block truncate text-small text-muted">{kind === "ideas" ? `${it.stage} · ${(it.services ?? []).join(", ") || "No services chosen"}` : it.subject || it.message}</span>
                  </span>
                  <span className="hidden shrink-0 text-small text-muted sm:block">{when(it.createdAt)}</span>
                </button>
                {expanded ? (
                  <div className="grid gap-8 px-4 pb-6 lg:grid-cols-[1fr_18rem]">
                    <div>
                      <p className="whitespace-pre-line text-[1.0625rem]">{kind === "ideas" ? it.description : it.message}</p>
                      {kind === "ideas" && (it.quantity || it.timeline) ? (
                        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-2 text-[0.95rem]">
                          {it.quantity ? <div><dt className="text-small text-muted">Quantity</dt><dd>{it.quantity}</dd></div> : null}
                          {it.timeline ? <div><dt className="text-small text-muted">Timeline</dt><dd>{it.timeline}</dd></div> : null}
                        </dl>
                      ) : null}
                    </div>
                    <div className="space-y-3 text-[0.95rem]">
                      <p><a className="link" href={`mailto:${it.email}?subject=${encodeURIComponent(subject)}`}>{it.email}</a></p>
                      {it.phone ? <p><a className="link tabular" href={`tel:${it.phone.replace(/\s/g, "")}`}>{it.phone}</a></p> : null}
                      <p className="text-small text-muted sm:hidden">{when(it.createdAt)}</p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <a href={`mailto:${it.email}?subject=${encodeURIComponent(subject)}`} className="inline-flex h-10 items-center gap-2 bg-ink px-3.5 text-[0.9rem] font-semibold text-on-ink">
                          <Mail aria-hidden className="h-4 w-4" /> Reply
                        </a>
                        {it.status !== "archived" ? (
                          <button type="button" onClick={() => setStatus(it, "archived")} className="inline-flex h-10 items-center gap-2 bg-surface px-3.5 text-[0.9rem] font-semibold hover:bg-surface-2">
                            <Archive aria-hidden className="h-4 w-4" /> Archive
                          </button>
                        ) : (
                          <button type="button" onClick={() => setStatus(it, "read")} className="inline-flex h-10 items-center gap-2 bg-surface px-3.5 text-[0.9rem] font-semibold hover:bg-surface-2">
                            Restore
                          </button>
                        )}
                        <button type="button" onClick={() => remove(it)} className="inline-flex h-10 items-center gap-2 px-3.5 text-[0.9rem] font-semibold text-danger hover:bg-[#fbe9ea]" aria-label="Delete permanently">
                          <Trash2 aria-hidden className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
