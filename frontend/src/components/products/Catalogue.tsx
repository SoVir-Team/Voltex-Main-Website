"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useLocalStorageJson } from "@/lib/browser-stores";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { Minus, Plus, Search, ShoppingBag, Trash2, Check } from "lucide-react";
import { formatINR, indianPhone, EMAIL_RE, GSTIN_RE, round2, type Division, type Product } from "@voltex/shared";
import { Dialog } from "@/components/ui/Dialog";
import { Button, buttonClass } from "@/components/ui/Button";
import { TextArea, TextField } from "@/components/ui/Field";
import { postJson } from "@/lib/client-api";
import { PriceBlock, ProductImage, StockBadge } from "./parts";
import { ProductsHero } from "./ProductsHero";
import { Reveal } from "@/components/motion/Reveal";

const CART_KEY = "voltex-cart-v1";
type Cart = Record<string, number>;

const SORTS = {
  featured: { label: "Featured", fn: (a: Product, b: Product) => rank(a) - rank(b) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name) },
  "price-asc": { label: "Price: low to high", fn: (a: Product, b: Product) => a.priceInclTax - b.priceInclTax },
  "price-desc": { label: "Price: high to low", fn: (a: Product, b: Product) => b.priceInclTax - a.priceInclTax },
  name: { label: "Name A–Z", fn: (a: Product, b: Product) => a.name.localeCompare(b.name) },
} as const;
type SortKey = keyof typeof SORTS;
// In-stock items with photographs first, out-of-stock last.
const rank = (p: Product) => (p.stockStatus === "out_of_stock" ? 2 : p.imageUrl.includes("/photos/") ? 0 : 1);

const EMPTY_CART: Cart = {};

/**
 * The product catalogue. `division` limits what is shown to one section (Electronics, Electrical or Industrial);
 * the full list is still loaded so the shared cart can show items added from any section.
 */
export function Catalogue({ initial, division }: { initial: Product[] | null; division?: Division }) {
  const basePath = division ? `/our-products/${division}` : "/our-products";
  const router = useRouter();
  const params = useSearchParams();
  const [products, setProducts] = useState<Product[]>(initial ?? []);
  const [loadError, setLoadError] = useState(initial === null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("featured");
  // The cart persists across visits and tabs.
  const [cart, setCart] = useLocalStorageJson<Cart>(CART_KEY, EMPTY_CART);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const viewingId = params.get("product");
  const viewing = products.find((p) => p.id === viewingId) ?? null;
  const openProduct = (id: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (id) sp.set("product", id);
    else sp.delete("product");
    router.replace(`${basePath}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  const retry = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error();
      setProducts((await res.json()).data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  };

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shown = useMemo(() => (division ? products.filter((p) => p.division === division) : products), [products, division]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(shown.map((p) => p.category))).sort()], [shown]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shown
      .filter((p) => category === "All" || p.category === category)
      .filter((p) => !inStockOnly || p.stockStatus !== "out_of_stock")
      .filter((p) => !q || [p.name, p.sku, p.brand, p.category, p.hsnCode, p.description].some((v) => v.toLowerCase().includes(q)))
      .sort(SORTS[sort].fn);
  }, [shown, query, category, inStockOnly, sort]);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ product: byId.get(id)!, qty }))
        .filter((l) => l.product && l.qty > 0),
    [cart, byId],
  );
  const totals = useMemo(() => {
    const grand = round2(lines.reduce((s, l) => s + l.product.priceInclTax * l.qty, 0));
    const taxable = round2(lines.reduce((s, l) => s + (l.product.priceInclTax * l.qty) / (1 + l.product.taxRate / 100), 0));
    return { grand, taxable, tax: round2(grand - taxable), count: lines.reduce((s, l) => s + l.qty, 0) };
  }, [lines]);

  const add = (p: Product, qty: number) => {
    const current = cart[p.id] ?? 0;
    const next = Math.min(p.stock, current + qty);
    if (next === current) return notify(`No more ${p.name} available.`);
    setCart((c) => ({ ...c, [p.id]: next }));
    notify(`${p.name} added to your cart.`);
  };
  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const max = byId.get(id)?.stock ?? 0;
      const v = Math.max(0, Math.min(max, qty));
      const rest = Object.fromEntries(Object.entries(c).filter(([k]) => k !== id));
      return v > 0 ? { ...rest, [id]: v } : rest;
    });
  const onStockConflict = (id: string, available: number) => {
    setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, stock: available, stockStatus: available <= 0 ? "out_of_stock" : available <= p.lowStockThreshold ? "limited" : "in_stock" } : p)));
    setQty(id, available);
  };

  return (
    <>
      <ProductsHero products={shown} division={division} onView={(id) => openProduct(id)} />

      <section aria-labelledby="catalogue-title" className="frame pb-[clamp(4rem,8vw,6rem)]">
        <h2 id="catalogue-title" className="sr-only">
          Product catalogue
        </h2>

        <div className="z-30 lg:sticky lg:top-16 -mx-[clamp(1.25rem,3vw,2.5rem)] bg-ground px-[clamp(1.25rem,3vw,2.5rem)] pt-4 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-0 flex-1 basis-64">
              <span className="sr-only">Search products</span>
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, model, brand or HSN"
                className="h-12 w-full bg-surface pl-11 pr-4 text-[1rem] outline-none focus:bg-ground focus:shadow-[inset_0_0_0_2px_var(--color-signal)]"
              />
            </label>
            <label className="flex h-12 cursor-pointer items-center gap-2.5 bg-surface px-4 text-[0.95rem] font-medium">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="h-4.5 w-4.5 accent-[var(--color-ink)]" />
              In stock only
            </label>
            <label className="flex h-12 items-center gap-2 bg-surface pl-4 text-[0.95rem] font-medium">
              <span className="text-muted">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-full cursor-pointer bg-transparent pr-3 font-semibold outline-none">
                {Object.entries(SORTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className={buttonClass("primary", "relative h-12")}
              aria-label={`Open cart, ${totals.count} item${totals.count === 1 ? "" : "s"}`}
            >
              <ShoppingBag aria-hidden className="h-5 w-5" />
              <span className="tabular">{totals.count ? formatINR(totals.grand) : "Cart"}</span>
              {totals.count ? (
                <span className="tabular absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-bolt px-1.5 text-small font-bold text-ink-deep">
                  {totals.count}
                </span>
              ) : null}
            </button>
          </div>
          <div role="group" aria-label="Product categories" className="mt-3 flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={clsx(
                  "shrink-0 px-4 py-2 text-[0.95rem] font-semibold transition-colors",
                  category === c ? "bg-ink text-on-ink" : "bg-surface text-ink hover:bg-surface-2",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <p className="tabular mt-6 text-small text-muted" aria-live="polite">
          {loadError ? "" : `${visible.length} product${visible.length === 1 ? "" : "s"}${category !== "All" ? ` in ${category}` : ""}`}
        </p>

        {loadError ? (
          <div className="mt-10 bg-surface p-10">
            <h3 className="text-heading font-bold">The catalogue could not be loaded</h3>
            <p className="mt-3 text-muted">Please check your connection and try again.</p>
            <Button className="mt-6" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : visible.length === 0 && shown.length === 0 && division ? (
          <div className="mt-10 bg-surface p-10">
            <h3 className="text-heading font-bold">Products coming soon</h3>
            <p className="mt-3 max-w-[36rem] text-muted">We are preparing this range. Tell us what you need and an engineer will get back to you.</p>
            <Link href="/contact?subject=Home%20automation%20enquiry" className={buttonClass("primary", "mt-6")}>
              Make an enquiry
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-10 bg-surface p-10">
            <h3 className="text-heading font-bold">No products match</h3>
            <p className="mt-3 text-muted">Try another search or category, or tell us what you need.</p>
            <Button
              variant="ghost"
              className="mt-6"
              onClick={() => {
                setQuery("");
                setCategory("All");
                setInStockOnly(false);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <Reveal as="ul" key={category + sort + query + String(inStockOnly)} className="mt-6 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} inCart={cart[p.id] ?? 0} onAdd={(q) => add(p, q)} onView={() => openProduct(p.id)} />
            ))}
          </Reveal>
        )}

      </section>

      <section aria-labelledby="unlisted-title" className="frame py-[clamp(5rem,10vw,8rem)]">
        <div className="grid-12 items-end gap-y-6 bg-surface p-[clamp(2rem,5vw,4rem)]">
          <div className="col-span-12 lg:col-span-7">
            <h2 id="unlisted-title" className="text-heading font-bold">Need a part that isn’t listed?</h2>
            <p className="mt-4 max-w-[38rem] text-muted">
              We source automation components, sensors and electronics beyond this catalogue, and we design custom boards when nothing
              off the shelf fits.
            </p>
          </div>
          <div className="col-span-12 flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <Link href="/contact?subject=Part%20enquiry" className={buttonClass("primary")}>
              Ask for a part
            </Link>
            <Link href="/bring-your-idea" className={buttonClass("light")}>
              Design a custom board
            </Link>
          </div>
        </div>
      </section>

      <Dialog open={Boolean(viewing)} onClose={() => openProduct(null)} labelledBy="product-detail-title" closeLabel="Close product details">
        {viewing ? <ProductDetail product={viewing} inCart={cart[viewing.id] ?? 0} onAdd={(q) => add(viewing, q)} /> : null}
      </Dialog>

      <Dialog open={cartOpen} onClose={() => setCartOpen(false)} labelledBy="cart-title" variant="drawer" closeLabel="Close cart">
        <CartPanel
          lines={lines}
          totals={totals}
          onQty={setQty}
          onPlaced={() => setCart({})}
          onStockConflict={onStockConflict}
          onClose={() => setCartOpen(false)}
        />
      </Dialog>

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
        {toast ? (
          <p className="pointer-events-auto flex items-center gap-2 bg-ink px-5 py-3 text-[0.95rem] font-medium text-on-ink shadow-[0_12px_32px_-12px_rgba(29,29,64,.6)] animate-[pop-in_.25s_var(--ease-out-expo)]">
            <Check aria-hidden className="h-4.5 w-4.5 text-bolt" /> {toast}
          </p>
        ) : null}
      </div>
    </>
  );
}

function QuantityStepper({ value, max, onChange, label }: { value: number; max: number; onChange: (n: number) => void; label: string }) {
  const btn = "inline-flex h-11 w-11 items-center justify-center bg-surface text-ink transition-colors hover:bg-surface-2 disabled:opacity-40";
  return (
    <div className="inline-flex items-stretch">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={`Decrease quantity of ${label}`}>
        <Minus aria-hidden className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(n);
        }}
        aria-label={`Quantity of ${label}`}
        className="tabular h-11 w-14 bg-surface text-center font-semibold outline-none [appearance:textfield] focus:bg-ground focus:shadow-[inset_0_0_0_2px_var(--color-signal)] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Increase quantity of ${label}`}>
        <Plus aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProductCard({ product, inCart, onAdd, onView }: { product: Product; inCart: number; onAdd: (q: number) => void; onView: () => void }) {
  const [qty, setQty] = useState(1);
  const left = product.stock - inCart;
  const out = product.stockStatus === "out_of_stock";
  return (
    <li data-reveal className="group flex flex-col">
      <button type="button" onClick={onView} className="relative block aspect-square w-full overflow-hidden bg-surface transition-colors duration-300 hover:bg-surface-2" aria-label={`View details of ${product.name}`}>
        <ProductImage product={product} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw" className="transition-transform duration-500 group-hover:scale-[1.04]" />
        {product.discountPercent ? (
          <span className="absolute left-3 top-3 bg-success px-2.5 py-1 text-small font-bold text-white">{product.discountPercent}% off</span>
        ) : null}
      </button>
      <p className="mt-4 text-small text-muted">
        {product.brand} · <span className="tabular">{product.sku}</span>
      </p>
      <h3 className="mt-1 text-[1.0625rem] font-semibold leading-snug">
        <button type="button" onClick={onView} className="text-left hover:text-signal">
          {product.name}
        </button>
      </h3>
      <div className="mt-3">
        <PriceBlock product={product} />
      </div>
      <StockBadge product={product} className="mt-2" />
      <div className="mt-auto flex items-center gap-2 pt-5">
        {out ? (
          <Link href={`/contact?subject=${encodeURIComponent(`Restock: ${product.name}`)}`} className={buttonClass("ghost", "w-full")}>
            Ask about restock
          </Link>
        ) : (
          <>
            <QuantityStepper value={Math.min(qty, Math.max(1, left))} max={Math.max(1, left)} onChange={(n) => setQty(Math.max(1, Math.min(Math.max(1, left), n)))} label={product.name} />
            <Button className="flex-1 px-4" disabled={left <= 0} onClick={() => { onAdd(qty); setQty(1); }}>
              {left <= 0 ? "All in cart" : inCart ? "Add more" : "Add to cart"}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function ProductDetail({ product, inCart, onAdd }: { product: Product; inCart: number; onAdd: (q: number) => void }) {
  const [qty, setQty] = useState(1);
  const left = product.stock - inCart;
  const out = product.stockStatus === "out_of_stock";
  return (
    <div className="grid md:grid-cols-2">
      <div className="relative aspect-square bg-surface md:aspect-auto md:min-h-[32rem]">
        <ProductImage product={product} sizes="(max-width: 768px) 100vw, 50vw" priority />
      </div>
      <div className="flex flex-col p-7 sm:p-10">
        <p className="text-small text-muted">
          {product.brand} · {product.category}
        </p>
        <h2 id="product-detail-title" className="mt-2 pr-10 text-[1.75rem] font-bold leading-tight">
          {product.name}
        </h2>
        <div className="mt-5">
          <PriceBlock product={product} large />
        </div>
        <StockBadge product={product} className="mt-3" />
        {product.description ? <p className="mt-6 text-muted">{product.description}</p> : null}
        <dl className="tabular mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[0.95rem]">
          <dt className="text-muted">Model / SKU</dt>
          <dd className="font-semibold">{product.sku}</dd>
          {product.hsnCode ? (
            <>
              <dt className="text-muted">HSN code</dt>
              <dd className="font-semibold">{product.hsnCode}</dd>
            </>
          ) : null}
          <dt className="text-muted">GST</dt>
          <dd className="font-semibold">{product.taxRate}%</dd>
          <dt className="text-muted">Unit</dt>
          <dd className="font-semibold">{product.unit}</dd>
        </dl>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
          {out ? (
            <Link href={`/contact?subject=${encodeURIComponent(`Restock: ${product.name}`)}`} className={buttonClass("primary")}>
              Ask about restock
            </Link>
          ) : (
            <>
              <QuantityStepper value={Math.min(qty, Math.max(1, left))} max={Math.max(1, left)} onChange={(n) => setQty(Math.max(1, Math.min(Math.max(1, left), n)))} label={product.name} />
              <Button disabled={left <= 0} onClick={() => { onAdd(qty); setQty(1); }}>
                {left <= 0 ? "All available units are in your cart" : "Add to cart"}
              </Button>
            </>
          )}
        </div>
        {inCart ? <p className="mt-3 text-small text-muted">{inCart} already in your cart.</p> : null}
      </div>
    </div>
  );
}

type Line = { product: Product; qty: number };
const emptyCustomer = { name: "", email: "", phone: "", company: "", gstin: "", address: "", notes: "" };
type CustomerErrors = Partial<Record<keyof typeof emptyCustomer, string>>;

function validateCustomer(c: typeof emptyCustomer): CustomerErrors {
  const e: CustomerErrors = {};
  if (!c.name.trim()) e.name = "Enter your name.";
  if (!EMAIL_RE.test(c.email.trim())) e.email = "Enter a valid email address.";
  if (!indianPhone(c.phone)) e.phone = "Enter a 10-digit mobile number.";
  if (c.gstin.trim() && !GSTIN_RE.test(c.gstin.trim().toUpperCase())) e.gstin = "GSTIN is 15 characters, for example 29ABCDE1234F1Z5.";
  return e;
}

function CartPanel({
  lines,
  totals,
  onQty,
  onPlaced,
  onStockConflict,
  onClose,
}: {
  lines: Line[];
  totals: { grand: number; taxable: number; tax: number; count: number };
  onQty: (id: string, qty: number) => void;
  onPlaced: () => void;
  onStockConflict: (id: string, available: number) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"cart" | "checkout" | "done">("cart");
  const [customer, setCustomer] = useState(emptyCustomer);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [placed, setPlaced] = useState<{ orderNumber: string; grandTotal: number; whatsapp?: string } | null>(null);
  const firstError = useRef<HTMLDivElement>(null);

  const set = (k: keyof typeof emptyCustomer) => (e: { target: { value: string } }) => {
    setCustomer((c) => ({ ...c, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateCustomer(customer);
    setErrors(found);
    if (Object.keys(found).length) {
      const key = Object.keys(found)[0];
      document.getElementById(`co-${key}`)?.focus();
      return;
    }
    setSubmitting(true);
    setServerError("");
    const sentLines = lines;
    const sentTotals = totals;
    const res = await postJson<{ orderNumber: string; grandTotal: number; productId?: string; available?: number }>("/api/products/orders", {
      customer,
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
    });
    setSubmitting(false);
    if (res.status === 409 && res.data.productId) {
      onStockConflict(res.data.productId, res.data.available ?? 0);
      setServerError(`${res.data.message ?? "Stock changed."} Your cart has been updated; please review it.`);
      setStep("cart");
      return;
    }
    if (!res.ok) {
      setServerError(res.data.message ?? "Could not place the order request.");
      firstError.current?.focus();
      return;
    }
    const wa = process.env.NEXT_PUBLIC_SALES_WHATSAPP;
    const summary = [
      `Order request ${res.data.orderNumber}`,
      ...sentLines.map((l) => `${l.qty} × ${l.product.name} (${l.product.sku})`),
      `Total ${formatINR(sentTotals.grand)} incl. GST`,
      `${customer.name}, ${customer.company || ""}`.trim(),
    ].join("\n");
    setPlaced({ ...res.data, whatsapp: wa ? `https://wa.me/${wa}?text=${encodeURIComponent(summary)}` : undefined });
    setStep("done");
    onPlaced();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-7 pt-6 pb-4">
        <h2 id="cart-title" className="text-[1.5rem] font-bold">
          {step === "checkout" ? "Order request" : step === "done" ? "Request received" : "Your cart"}
        </h2>
        {step === "cart" && totals.count ? <p className="tabular mt-1 text-small text-muted">{totals.count} item{totals.count === 1 ? "" : "s"}</p> : null}
      </div>

      {step === "done" && placed ? (
        <div className="flex-1 overflow-y-auto px-7 pb-8">
          <div className="flex h-14 w-14 items-center justify-center bg-success text-white">
            <Check aria-hidden className="h-7 w-7" />
          </div>
          <p className="mt-6 text-lead font-semibold">Thank you. We have your order request.</p>
          <dl className="tabular mt-6 space-y-1">
            <div className="flex justify-between">
              <dt className="text-muted">Request number</dt>
              <dd className="font-bold">{placed.orderNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Total incl. GST</dt>
              <dd className="font-bold">{formatINR(placed.grandTotal)}</dd>
            </div>
          </dl>
          <p className="mt-6 text-muted">
            Our team will confirm stock, delivery and payment by email or phone within one working day. Nothing is charged until you confirm.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            {placed.whatsapp ? (
              <a href={placed.whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>
                Send the summary on WhatsApp
              </a>
            ) : null}
            <Button variant="ghost" onClick={() => { setStep("cart"); setPlaced(null); onClose(); }}>
              Continue browsing
            </Button>
          </div>
        </div>
      ) : step === "checkout" ? (
        <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-7 pb-6">
            {serverError ? (
              <div ref={firstError} tabIndex={-1} role="alert" className="bg-[#fbe9ea] px-4 py-3 text-[0.95rem] font-medium text-danger">
                {serverError}
              </div>
            ) : null}
            <TextField label="Full name" name="co-name" required autoComplete="name" value={customer.name} onChange={set("name")} error={errors.name} />
            <TextField label="Email" name="co-email" type="email" required autoComplete="email" value={customer.email} onChange={set("email")} error={errors.email} />
            <TextField
              label="Mobile number"
              name="co-phone"
              type="tel"
              required
              autoComplete="tel-national"
              inputMode="tel"
              value={customer.phone}
              onChange={set("phone")}
              error={errors.phone}
              hint="Indian number, 10 digits. We add +91."
            />
            <TextField label="Company" name="co-company" autoComplete="organization" value={customer.company} onChange={set("company")} />
            <TextField label="GSTIN" name="co-gstin" value={customer.gstin} onChange={set("gstin")} error={errors.gstin} hint="For a GST invoice." className="uppercase" />
            <TextArea label="Delivery address" name="co-address" autoComplete="street-address" rows={3} value={customer.address} onChange={set("address")} />
            <TextArea label="Notes" name="co-notes" rows={2} value={customer.notes} onChange={set("notes")} />
          </div>
          <div className="bg-surface px-7 py-5">
            <p className="tabular flex justify-between text-lead font-bold">
              <span>Total</span>
              <span>{formatINR(totals.grand)}</span>
            </p>
            <p className="tabular text-small text-muted">Includes {formatINR(totals.tax)} GST. No payment now.</p>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="light" onClick={() => setStep("cart")}>
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? "Sending…" : "Send order request"}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-7 pb-6">
            {serverError ? (
              <div role="alert" className="mb-4 bg-[#fdf1e2] px-4 py-3 text-[0.95rem] font-medium text-warning">
                {serverError}
              </div>
            ) : null}
            {lines.length === 0 ? (
              <div className="py-10">
                <p className="text-lead font-semibold">Your cart is empty.</p>
                <p className="mt-2 text-muted">Add products from the catalogue to send an order request.</p>
              </div>
            ) : (
              <ul className="space-y-5">
                {lines.map(({ product, qty }) => (
                  <li key={product.id} className="flex gap-4">
                    <div className="relative h-20 w-20 shrink-0 bg-surface">
                      <ProductImage product={product} sizes="80px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-snug">{product.name}</p>
                      <p className="tabular text-small text-muted">{formatINR(product.priceInclTax)} each</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <QuantityStepper value={qty} max={product.stock} onChange={(n) => onQty(product.id, n)} label={product.name} />
                        <button type="button" onClick={() => onQty(product.id, 0)} className="inline-flex h-11 w-11 items-center justify-center text-muted hover:bg-surface hover:text-danger" aria-label={`Remove ${product.name} from cart`}>
                          <Trash2 aria-hidden className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {lines.length ? (
            <div className="bg-surface px-7 py-5">
              <dl className="tabular space-y-1 text-[0.95rem]">
                <div className="flex justify-between">
                  <dt className="text-muted">Taxable value</dt>
                  <dd>{formatINR(totals.taxable)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">GST</dt>
                  <dd>{formatINR(totals.tax)}</dd>
                </div>
                <div className="flex justify-between pt-1 text-lead font-bold">
                  <dt>Total</dt>
                  <dd>{formatINR(totals.grand)}</dd>
                </div>
              </dl>
              <Button className="mt-4 w-full" onClick={() => { setServerError(""); setStep("checkout"); }}>
                Continue to order request
              </Button>
              <p className="mt-2 text-center text-small text-muted">No payment is taken online. We confirm everything with you first.</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
