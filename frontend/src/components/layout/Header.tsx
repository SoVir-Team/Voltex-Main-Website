"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { ChevronDown, Menu, X } from "lucide-react";
import { DIVISIONS } from "@voltex/shared";
import { Logo } from "@/components/brand/Logo";
import { buttonClass } from "@/components/ui/Button";
import { NAV } from "@/lib/site";

const PRODUCTS_HREF = "/our-products";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const linkClass = (active: boolean) =>
    clsx("relative inline-flex items-center gap-1 px-3.5 py-2 text-[0.95rem] font-medium transition-colors", active ? "text-ink" : "text-muted hover:text-ink");
  const underline = (active: boolean) => (
    <span
      aria-hidden
      className={clsx(
        "absolute inset-x-3.5 -bottom-0.5 h-[3px] origin-left bg-bolt transition-transform duration-300 ease-out",
        active ? "scale-x-100" : "scale-x-0",
      )}
    />
  );

  return (
    <header className="sticky top-0 z-40 bg-ground">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-on-ink">
        Skip to content
      </a>
      <div className={clsx("frame flex h-[4.5rem] items-center justify-between gap-6 transition-[height] duration-300", scrolled && "h-16")}>
        <Link href="/" className="text-[1.15rem]" aria-label="VOLTEX home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) =>
            item.href === PRODUCTS_HREF ? (
              <ProductsMenu key={item.href} label={item.label} active={isActive(item.href)} pathname={pathname} linkClass={linkClass} underline={underline} />
            ) : (
              <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={linkClass(isActive(item.href))}>
                {item.label}
                {underline(isActive(item.href))}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/bring-your-idea" className={buttonClass("primary", "hidden min-h-11 px-5 sm:inline-flex")}>
            Bring your idea
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center text-ink lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden className="h-6 w-6" /> : <Menu aria-hidden className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <div id="mobile-nav" hidden={!open} className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-ground lg:hidden">
        <nav aria-label="Mobile" className="frame flex flex-col pt-6 pb-10">
          {[...NAV, { href: "/bring-your-idea", label: "Bring your idea" }].map((item) => (
            <div key={item.href}>
              <Link
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setOpen(false)}
                className="display block py-3 text-[2.4rem] text-ink aria-[current=page]:text-signal"
              >
                {item.label}
              </Link>
              {item.href === PRODUCTS_HREF ? (
                <ul className="mb-3 space-y-1 pl-1">
                  {DIVISIONS.map((d) => (
                    <li key={d.slug}>
                      <Link
                        href={`${PRODUCTS_HREF}/${d.slug}`}
                        aria-current={pathname === `${PRODUCTS_HREF}/${d.slug}` ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className="block py-1.5 text-[1.25rem] font-semibold text-muted aria-[current=page]:text-signal"
                      >
                        {d.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}

/**
 * "Our products" with a dropdown of the three product sections. Opens on hover or on click/keyboard via the
 * chevron button; closes on Escape, on leaving, or on choosing a section.
 */
function ProductsMenu({
  label,
  active,
  pathname,
  linkClass,
  underline,
}: {
  label: string;
  active: boolean;
  pathname: string;
  linkClass: (active: boolean) => string;
  underline: (active: boolean) => React.ReactNode;
}) {
  // Hover opens it for mouse users; the chevron pins it open for click, touch and keyboard users.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const menuOpen = hovered || pinned;
  const setMenuOpen = (v: boolean) => {
    if (!v) {
      setHovered(false);
      setPinned(false);
    }
  };
  const wrap = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        wrap.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div
      ref={wrap}
      className="relative flex items-center"
      onMouseEnter={() => {
        clearTimeout(closeTimer.current);
        setHovered(true);
      }}
      onMouseLeave={() => {
        closeTimer.current = setTimeout(() => setHovered(false), 160);
      }}
      // Close when keyboard focus moves elsewhere on the page (not when the window itself loses focus).
      onBlur={(e) => e.relatedTarget && !wrap.current?.contains(e.relatedTarget as Node) && setMenuOpen(false)}
    >
      <Link href={PRODUCTS_HREF} aria-current={pathname === PRODUCTS_HREF ? "page" : undefined} className={clsx(linkClass(active), "pr-1")}>
        {label}
        {underline(active)}
      </Link>
      <button
        type="button"
        aria-expanded={menuOpen}
        aria-controls="products-menu"
        aria-label="Show product sections"
        onClick={() => setPinned((v) => !v)}
        className="inline-flex h-9 w-7 items-center justify-center text-muted hover:text-ink"
      >
        <ChevronDown aria-hidden className={clsx("h-4 w-4 transition-transform duration-200", menuOpen && "rotate-180")} />
      </button>

      <div
        id="products-menu"
        hidden={!menuOpen}
        className="absolute left-1/2 top-full z-50 w-[22rem] -translate-x-1/2 pt-3"
      >
        <ul className="bg-ground p-2 shadow-[0_24px_48px_-16px_rgba(29,29,64,.35)] animate-[pop-in_.2s_var(--ease-out-expo)]">
          {DIVISIONS.map((d) => {
            const href = `${PRODUCTS_HREF}/${d.slug}`;
            const current = pathname === href;
            return (
              <li key={d.slug}>
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={clsx("block px-4 py-3 transition-colors", current ? "bg-surface" : "hover:bg-surface")}
                >
                  <span className="block font-semibold text-ink">{d.label}</span>
                  <span className="mt-0.5 block text-small text-muted">{d.blurb}</span>
                </Link>
              </li>
            );
          })}
          <li className="mt-1">
            <Link href={PRODUCTS_HREF} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-small font-semibold text-signal hover:bg-surface">
              All products →
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
