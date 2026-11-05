"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { ExternalLink, LayoutDashboard, Lightbulb, LogOut, Mail, Menu, Package, ReceiptText, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { adminFetch } from "@/lib/admin-fetch";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Order requests", icon: ReceiptText },
  { href: "/admin/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/admin/messages", label: "Messages", icon: Mail },
];

export function AdminShell({ admin, children }: { admin: { email: string; name: string }; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const signOut = async () => {
    await adminFetch("/api/admin/logout", { method: "POST" });
    // Full reload so no admin data stays in the client cache after signing out.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/admin/login";
  };
  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 text-[0.95rem] font-medium transition-colors",
              active ? "bg-ink text-on-ink" : "text-ink hover:bg-surface-2",
            )}
          >
            <Icon aria-hidden className="h-4.5 w-4.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
  const foot = (
    <div className="space-y-1 text-[0.95rem]">
      <a href="/" target="_blank" className="flex items-center gap-3 px-3 py-2.5 text-ink hover:bg-surface-2">
        <ExternalLink aria-hidden className="h-4.5 w-4.5" /> View website
      </a>
      <button type="button" onClick={signOut} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-ink hover:bg-surface-2">
        <LogOut aria-hidden className="h-4.5 w-4.5" /> Sign out
      </button>
      <p className="truncate px-3 pt-3 text-small text-muted" title={admin.email}>
        {admin.email}
      </p>
    </div>
  );

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[16rem_1fr]">
      <aside className="hidden flex-col justify-between bg-ground p-5 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <div>
          <Link href="/admin" className="mb-8 block px-3 pt-1 text-[1.1rem]">
            <Logo />
          </Link>
          {nav}
        </div>
        {foot}
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ground px-4 lg:hidden">
        <Logo />
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"} className="inline-flex h-11 w-11 items-center justify-center">
          {open ? <X aria-hidden className="h-6 w-6" /> : <Menu aria-hidden className="h-6 w-6" />}
        </button>
      </div>
      {open ? (
        <div className="fixed inset-x-0 top-14 bottom-0 z-30 flex flex-col justify-between overflow-y-auto bg-ground p-4 lg:hidden">
          {nav}
          {foot}
        </div>
      ) : null}

      <main id="main" className="min-w-0 p-4 sm:p-6 lg:p-10">
        {children}
      </main>
    </div>
  );
}

export function AdminPageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.9rem] font-bold leading-tight">{title}</h1>
        {sub ? <p className="mt-1 text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
