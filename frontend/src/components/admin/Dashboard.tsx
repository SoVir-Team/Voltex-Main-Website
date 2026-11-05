"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { formatINR } from "@voltex/shared";
import { adminFetch } from "@/lib/admin-fetch";
import { AdminPageHead } from "./AdminShell";

type Summary = {
  products: number;
  hidden: number;
  outOfStock: number;
  lowStock: number;
  pendingOrders: number;
  orderCount: number;
  orderValue: number;
  newIdeas: number;
  newMessages: number;
};

/** The dashboard: what needs attention first, then catalogue health (ported from ProductsSummary.jsx). */
export function Dashboard() {
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    adminFetch<Summary>("/api/admin/summary").then((r) => (r.ok ? setS(r.data) : setError(r.data.message ?? "Could not load the summary.")));
  }, []);

  const card = (label: string, value: string | number, href: string, note?: string, alert?: boolean) => (
    <Link href={href} className="group block bg-ground p-6 transition-colors hover:bg-[#fbfcfe]">
      <p className="text-[0.95rem] font-medium text-muted">{label}</p>
      <p className={clsx("tabular mt-3 text-[2.4rem] font-bold leading-none", alert ? "text-warning" : "text-ink")}>{value}</p>
      {note ? <p className="mt-3 text-small text-muted">{note}</p> : null}
      <p className="mt-4 text-small font-semibold text-signal group-hover:underline">Open →</p>
    </Link>
  );

  return (
    <>
      <AdminPageHead title="Dashboard" sub="What needs your attention today." />
      {error ? <p role="alert" className="bg-[#fbe9ea] px-4 py-3 text-danger">{error}</p> : null}
      {!s && !error ? <p className="text-muted">Loading…</p> : null}
      {s ? (
        <>
          <h2 className="mb-3 text-[1.1rem] font-bold">Inbox</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {card("Pending order requests", s.pendingOrders, "/admin/orders?status=pending", `${s.orderCount} active requests worth ${formatINR(s.orderValue)}`, s.pendingOrders > 0)}
            {card("New ideas", s.newIdeas, "/admin/ideas", "Product ideas from the Bring your idea form", s.newIdeas > 0)}
            {card("New messages", s.newMessages, "/admin/messages", "From the contact form", s.newMessages > 0)}
          </div>
          <h2 className="mt-10 mb-3 text-[1.1rem] font-bold">Catalogue</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {card("Products", s.products, "/admin/products", `${s.hidden} hidden from the website`)}
            {card("Low stock", s.lowStock, "/admin/products?stock=limited", "At or below their alert level", s.lowStock > 0)}
            {card("Out of stock", s.outOfStock, "/admin/products?stock=out_of_stock", "Customers can ask about restock", s.outOfStock > 0)}
            {card("Website", "Live", "/our-products", "See the Our products page")}
          </div>
        </>
      ) : null}
    </>
  );
}
