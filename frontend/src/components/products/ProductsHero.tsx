"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { DIVISIONS, formatINR, type Division, type Product } from "@voltex/shared";
import { DivisionNav } from "./DivisionNav";
import { ProductImage, StockBadge } from "./parts";
import { usePrefersReducedMotion } from "@/lib/browser-stores";

const ROTATE_MS = 5500;

/** Ported from the SoVir products hero: a rotating plate of in-stock items with photographs, with pause and keyboard controls. */
export function ProductsHero({ products, onView, division }: { products: Product[]; onView: (id: string) => void; division?: Division }) {
  const section = DIVISIONS.find((d) => d.slug === division);
  const featured = useMemo(() => products.filter((p) => p.imageUrl.includes("/photos/") && p.stockStatus !== "out_of_stock").slice(0, 8), [products]);
  const [i, setI] = useState(0);
  // Paused by default for visitors who prefer reduced motion; either way the visitor can play or pause.
  const reduced = usePrefersReducedMotion();
  const [userPaused, setPaused] = useState<boolean | null>(null);
  const paused = userPaused ?? reduced;
  const [hovered, setHovered] = useState(false);
  const categories = new Set(products.map((p) => p.category)).size;

  useEffect(() => {
    if (paused || hovered || featured.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % featured.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, hovered, featured.length]);

  const active = featured[i % Math.max(1, featured.length)];
  const go = (d: number) => setI((n) => (n + d + featured.length) % featured.length);

  return (
    <section aria-labelledby="products-title" className="frame grid-12 items-center gap-y-10 pt-10 pb-12 lg:min-h-[78svh] lg:pt-6">
      <div className="col-span-12 lg:col-span-5">
        <h1 id="products-title" className="display text-[clamp(3rem,1.5rem+5.5vw,6.5rem)]">
          {section ? section.label : "Our products"}
        </h1>
        <p className="mt-8 max-w-[30rem] text-lead text-ink">
          {section
            ? `${section.blurb} Priced with GST and ready to order.`
            : "Electronics, electrical and industrial products from trusted makers, priced with GST and ready to order."}
        </p>
        <DivisionNav current={division} className="mt-8" />
        <p className="tabular mt-6 text-muted">
          {products.length} products across {categories} categories. Send an order request and we confirm stock and delivery with you.
        </p>
        <a href="#catalogue-title" className="link mt-8 inline-block font-medium" onClick={(e) => { e.preventDefault(); document.getElementById("catalogue-title")?.parentElement?.scrollIntoView({ behavior: "smooth" }); }}>
          Browse the catalogue
        </a>
      </div>

      {active ? (
        <div
          className="col-span-12 min-w-0 lg:col-span-6 lg:col-start-7"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setHovered(true)}
          onBlurCapture={() => setHovered(false)}
          aria-roledescription="carousel"
          aria-label="Featured products"
        >
          <div className="relative grid bg-ink text-on-ink sm:grid-cols-[1.1fr_1fr]">
            <button type="button" onClick={() => onView(active.id)} className="relative aspect-square bg-ground" aria-label={`View ${active.name}`}>
              {featured.map((p, k) => (
                <div key={p.id} aria-hidden={k !== i} className={clsx("absolute inset-0 transition-opacity duration-700", k === i ? "opacity-100" : "opacity-0")}>
                  <ProductImage product={p} sizes="(max-width: 1024px) 100vw, 28vw" priority={k === 0} />
                </div>
              ))}
            </button>
            <div className="flex flex-col justify-between gap-8 p-7" aria-live={paused ? "polite" : "off"}>
              <div>
                <p className="text-small text-on-ink-muted">
                  {active.brand} · <span className="tabular">{active.sku}</span>
                </p>
                <p className="mt-2 text-[1.35rem] font-semibold leading-snug">{active.name}</p>
              </div>
              <div>
                <p className="tabular text-[1.75rem] font-bold">{formatINR(active.priceInclTax)}</p>
                <p className="text-small text-on-ink-muted">incl. {active.taxRate}% GST</p>
                <StockBadge product={active} className="mt-3 !text-bolt" />
                <button type="button" onClick={() => onView(active.id)} className="mt-6 inline-flex min-h-12 w-full items-center justify-between bg-bolt px-5 font-semibold text-ink-deep transition-colors hover:bg-[#46b7e2]">
                  View product <span aria-hidden>→</span>
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="tabular text-small text-muted">
              {i + 1} / {featured.length}
            </p>
            <div className="flex gap-1">
              <button type="button" onClick={() => go(-1)} className="inline-flex h-11 w-11 items-center justify-center bg-surface hover:bg-surface-2" aria-label="Previous product">
                <ChevronLeft aria-hidden className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => setPaused(!paused)} className="inline-flex h-11 w-11 items-center justify-center bg-surface hover:bg-surface-2" aria-label={paused ? "Play slideshow" : "Pause slideshow"}>
                {paused ? <Play aria-hidden className="h-4.5 w-4.5" /> : <Pause aria-hidden className="h-4.5 w-4.5" />}
              </button>
              <button type="button" onClick={() => go(1)} className="inline-flex h-11 w-11 items-center justify-center bg-surface hover:bg-surface-2" aria-label="Next product">
                <ChevronRight aria-hidden className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
