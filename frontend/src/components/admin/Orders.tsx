"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { ORDER_STATUSES, formatINR, type OrderStatus, type ProductOrder } from "@voltex/shared";
import { adminFetch } from "@/lib/admin-fetch";
import { AdminPageHead } from "./AdminShell";

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-[#fdf1e2] text-warning",
  confirmed: "bg-[#e3f1f8] text-signal",
  dispatched: "bg-[#e9e9f5] text-ink",
  completed: "bg-[#e5f4ea] text-success",
  cancelled: "bg-[#fbe9ea] text-danger",
};
const label = (s: string) => s[0].toUpperCase() + s.slice(1);
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function Orders() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get("status") ?? "";
  const [orders, setOrders] = useState<ProductOrder[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    adminFetch<{ data: ProductOrder[] }>(`/api/products/admin/orders${status ? `?status=${status}` : ""}`).then((r) => {
      if (!alive) return;
      if (r.ok) setOrders(r.data.data);
      else setFlash({ kind: "error", text: r.data.message ?? "Could not load orders." });
    });
    return () => {
      alive = false;
    };
  }, [status]);

  const change = async (o: ProductOrder, next: OrderStatus) => {
    if (next === o.status) return;
    if (next === "cancelled" && !window.confirm(`Cancel ${o.orderNumber}? Its units go back into stock and it cannot be reopened.`)) return;
    const r = await adminFetch(`/api/products/admin/orders/${o.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    if (r.ok) {
      setOrders((os) => os?.map((x) => (x.id === o.id ? { ...x, status: next } : x)) ?? null);
      setFlash({ kind: "ok", text: `${o.orderNumber} marked ${next}.` });
    } else setFlash({ kind: "error", text: r.data.message ?? "Could not update." });
  };

  return (
    <>
      <AdminPageHead title="Order requests" sub="Requests from the Our products page. Confirm stock, delivery and payment with the customer, then move the request along." />
      <div role="group" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1">
        {["", ...ORDER_STATUSES].map((s) => (
          <button
            key={s || "all"}
            type="button"
            aria-pressed={status === s}
            onClick={() => router.replace(`/admin/orders${s ? `?status=${s}` : ""}`)}
            className={clsx("h-10 px-3.5 text-[0.9rem] font-semibold", status === s ? "bg-ink text-on-ink" : "bg-ground hover:bg-surface-2")}
          >
            {s ? label(s) : "All"}
          </button>
        ))}
      </div>
      {flash ? (
        <p role={flash.kind === "error" ? "alert" : "status"} className={clsx("mb-4 px-4 py-3 font-medium", flash.kind === "ok" ? "bg-[#e5f4ea] text-success" : "bg-[#fbe9ea] text-danger")}>
          {flash.text}
        </p>
      ) : null}
      {orders === null ? (
        <p className="text-muted">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="bg-ground p-8 text-muted">No order requests{status ? ` with status “${status}”` : ""} yet.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const expanded = open === o.id;
            return (
              <li key={o.id} className="bg-ground">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                  <button type="button" onClick={() => setOpen(expanded ? null : o.id)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <ChevronDown aria-hidden className={clsx("h-5 w-5 shrink-0 transition-transform", expanded && "rotate-180")} />
                    <span className="min-w-0">
                      <span className="tabular block font-bold">{o.orderNumber}</span>
                      <span className="block truncate text-small text-muted">
                        {o.customer.name}{o.customer.company ? `, ${o.customer.company}` : ""} · {when(o.createdAt)}
                      </span>
                    </span>
                  </button>
                  <span className="tabular font-bold">{formatINR(o.grandTotal)}</span>
                  <span className={clsx("px-2.5 py-1 text-small font-semibold", STATUS_STYLE[o.status])}>{label(o.status)}</span>
                  <label className="flex items-center gap-2 text-small">
                    <span className="sr-only">Change status of {o.orderNumber}</span>
                    <select value={o.status} disabled={o.status === "cancelled"} onChange={(e) => change(o, e.target.value as OrderStatus)} className="h-10 bg-surface px-2 font-semibold disabled:opacity-50">
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                    </select>
                  </label>
                </div>
                {expanded ? (
                  <div className="grid gap-8 px-4 pb-6 pt-2 lg:grid-cols-[1fr_20rem]">
                    <table className="w-full text-[0.95rem]">
                      <thead className="text-small text-muted">
                        <tr className="border-b border-surface-2 text-left">
                          <th className="py-2 font-semibold">Item</th>
                          <th className="py-2 text-right font-semibold">Qty</th>
                          <th className="py-2 text-right font-semibold">Price incl. GST</th>
                          <th className="py-2 text-right font-semibold">Line total</th>
                        </tr>
                      </thead>
                      <tbody className="tabular">
                        {o.items.map((i) => (
                          <tr key={i.sku} className="border-b border-surface">
                            <td className="py-2">
                              {i.name}
                              <span className="block text-small text-muted">{i.sku}{i.hsnCode ? ` · HSN ${i.hsnCode}` : ""} · GST {i.taxRate}%</span>
                            </td>
                            <td className="py-2 text-right">{i.quantity}</td>
                            <td className="py-2 text-right">{formatINR(i.lineTotal / i.quantity)}</td>
                            <td className="py-2 text-right font-semibold">{formatINR(i.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="tabular">
                        <tr><td colSpan={3} className="pt-3 text-right text-muted">Taxable value</td><td className="pt-3 text-right">{formatINR(o.taxableTotal)}</td></tr>
                        <tr><td colSpan={3} className="text-right text-muted">GST</td><td className="text-right">{formatINR(o.taxTotal)}</td></tr>
                        {o.discountTotal ? <tr><td colSpan={3} className="text-right text-muted">Discounts given</td><td className="text-right text-success">−{formatINR(o.discountTotal)}</td></tr> : null}
                        <tr><td colSpan={3} className="pt-1 text-right font-bold">Total</td><td className="pt-1 text-right font-bold">{formatINR(o.grandTotal)}</td></tr>
                      </tfoot>
                    </table>
                    <dl className="space-y-3 text-[0.95rem]">
                      <div><dt className="text-small text-muted">Customer</dt><dd className="font-semibold">{o.customer.name}</dd></div>
                      <div><dt className="text-small text-muted">Email</dt><dd><a className="link" href={`mailto:${o.customer.email}?subject=${encodeURIComponent(`Your order request ${o.orderNumber}`)}`}>{o.customer.email}</a></dd></div>
                      <div><dt className="text-small text-muted">Phone</dt><dd><a className="link tabular" href={`tel:${o.customer.phone.replace(/\s/g, "")}`}>{o.customer.phone}</a></dd></div>
                      {o.customer.company ? <div><dt className="text-small text-muted">Company</dt><dd>{o.customer.company}</dd></div> : null}
                      {o.customer.gstin ? <div><dt className="text-small text-muted">GSTIN</dt><dd className="tabular">{o.customer.gstin}</dd></div> : null}
                      {o.customer.address ? <div><dt className="text-small text-muted">Address</dt><dd className="whitespace-pre-line">{o.customer.address}</dd></div> : null}
                      {o.customer.notes ? <div><dt className="text-small text-muted">Notes</dt><dd className="whitespace-pre-line">{o.customer.notes}</dd></div> : null}
                    </dl>
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
