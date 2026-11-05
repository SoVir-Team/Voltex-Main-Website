import Link from "next/link";
import { clsx } from "clsx";
import { DIVISIONS, type Division } from "@voltex/shared";

/** Switches between All products and the three product sections. Real links, so each section has its own URL. */
export function DivisionNav({ current, className }: { current?: Division; className?: string }) {
  const items = [{ href: "/our-products", label: "All products", active: !current }, ...DIVISIONS.map((d) => ({ href: `/our-products/${d.slug}`, label: d.short, active: current === d.slug }))];
  return (
    <nav aria-label="Product sections" className={clsx("flex flex-wrap gap-1.5", className)}>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          className={clsx(
            "px-4 py-2.5 text-[0.95rem] font-semibold transition-colors",
            it.active ? "bg-ink text-on-ink" : "bg-surface text-ink hover:bg-surface-2",
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
