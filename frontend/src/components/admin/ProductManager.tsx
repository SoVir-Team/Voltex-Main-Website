"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Download, Eye, EyeOff, ImagePlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { DIVISIONS, formatINR, pricing, round2, type DiscountType, type Division, type Product, type StockStatus } from "@voltex/shared";
import { Button, buttonClass } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { ProductImage, STOCK_LABEL } from "@/components/products/parts";
import { adminFetch, PHOTO_PICK_MAX_BYTES, shrinkPhoto } from "@/lib/admin-fetch";
import { AdminPageHead } from "./AdminShell";

type StockFilter = "all" | StockStatus | "hidden";
const GST_RATES = [0, 5, 12, 18, 28];

export function ProductManager() {
  const params = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [stock, setStock] = useState<StockFilter>((params.get("stock") as StockFilter) ?? "all");
  const [section, setSection] = useState<Division | "all">("all");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);
  useEffect(() => {
    let alive = true;
    adminFetch<{ data: Product[] }>("/api/products/admin/all").then((r) => {
      if (!alive) return;
      if (r.ok) setProducts(r.data.data);
      else setFlash({ kind: "error", text: r.data.message ?? "Could not load products." });
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const say = (kind: "ok" | "error", text: string) => {
    setFlash({ kind, text });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const replace = (p: Product) => setProducts((ps) => (ps.some((x) => x.id === p.id) ? ps.map((x) => (x.id === p.id ? p : x)) : [p, ...ps]));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => section === "all" || p.division === section)
      .filter((p) => (stock === "all" ? true : stock === "hidden" ? !p.isActive : p.stockStatus === stock))
      .filter((p) => !q || [p.name, p.sku, p.brand, p.category, p.hsnCode].some((v) => v.toLowerCase().includes(q)));
  }, [products, query, stock, section]);

  const counts = useMemo(
    () => ({
      all: products.length,
      in_stock: products.filter((p) => p.stockStatus === "in_stock").length,
      limited: products.filter((p) => p.stockStatus === "limited").length,
      out_of_stock: products.filter((p) => p.stockStatus === "out_of_stock").length,
      hidden: products.filter((p) => !p.isActive).length,
    }),
    [products],
  );

  const importCatalogue = async () => {
    const r = await adminFetch<{ message: string }>("/api/products/admin/import-catalogue", { method: "POST" });
    say(r.ok ? "ok" : "error", r.data.message ?? "Import failed.");
    if (r.ok) load();
  };
  const toggleVisible = async (p: Product) => {
    const r = await adminFetch<Product>(`/api/products/${p.id}`, { method: "PUT", body: JSON.stringify({ isActive: !p.isActive }) });
    if (r.ok) {
      replace(r.data);
      say("ok", `${p.name} is now ${r.data.isActive ? "shown on" : "hidden from"} the website.`);
    } else say("error", r.data.message ?? "Could not update.");
  };

  return (
    <>
      <AdminPageHead
        title="Products"
        sub="Everything on the Our products page. Prices are entered before or after GST; customers always see the GST-inclusive price."
        actions={
          <>
            <Button variant="light" onClick={importCatalogue}>
              <Download aria-hidden className="h-4.5 w-4.5" /> Import starter catalogue
            </Button>
            <Button onClick={() => setEditing("new")}>
              <Plus aria-hidden className="h-4.5 w-4.5" /> Add product
            </Button>
          </>
        }
      />

      {flash ? (
        <p role={flash.kind === "error" ? "alert" : "status"} className={clsx("mb-6 px-4 py-3 font-medium", flash.kind === "ok" ? "bg-[#e5f4ea] text-success" : "bg-[#fbe9ea] text-danger")}>
          {flash.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 bg-ground p-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <span className="sr-only">Search products</span>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search name, model, brand, category or HSN" className="h-11 w-full bg-surface pl-10 pr-3 outline-none focus:shadow-[inset_0_0_0_2px_var(--color-signal)]" />
        </label>
        <label className="flex h-11 items-center gap-2 bg-surface pl-3.5 text-[0.9rem] font-semibold">
          <span className="text-muted">Section</span>
          <select value={section} onChange={(e) => setSection(e.target.value as Division | "all")} className="h-full cursor-pointer bg-transparent pr-3 outline-none">
            <option value="all">All sections</option>
            {DIVISIONS.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.short} ({products.filter((p) => p.division === d.slug).length})
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Filter by stock" className="flex flex-wrap gap-1">
          {(["all", "in_stock", "limited", "out_of_stock", "hidden"] as StockFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={stock === k}
              onClick={() => setStock(k)}
              className={clsx("h-11 px-3.5 text-[0.9rem] font-semibold transition-colors", stock === k ? "bg-ink text-on-ink" : "bg-surface text-ink hover:bg-surface-2")}
            >
              {k === "all" ? "All" : k === "hidden" ? "Hidden" : STOCK_LABEL[k]} <span className="tabular opacity-70">{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto bg-ground">
        <table className="w-full min-w-[56rem] text-left text-[0.95rem]">
          <thead className="text-small text-muted">
            <tr className="border-b border-surface-2">
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Section / category</th>
              <th className="px-4 py-3 text-right font-semibold">Price incl. GST</th>
              <th className="px-4 py-3 text-right font-semibold">Stock</th>
              <th className="px-4 py-3 font-semibold">Website</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">Loading…</td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">No products match. Add one, or import the starter catalogue.</td>
              </tr>
            ) : (
              visible.map((p) => (
                <tr key={p.id} className={clsx("border-b border-surface last:border-0", !p.isActive && "bg-[#fafbfd]")}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 bg-surface">
                        <ProductImage product={p} sizes="48px" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold leading-snug">{p.name}</p>
                        <p className="tabular text-small text-muted">{p.sku}{p.brand ? ` · ${p.brand}` : ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{DIVISIONS.find((d) => d.slug === p.division)?.short}</span>
                    <span className="block text-small text-muted">{p.category}</span>
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    <span className="font-semibold">{formatINR(p.priceInclTax)}</span>
                    {p.discountAmount ? <span className="block text-small text-success">{p.discountPercent}% off</span> : null}
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    <button type="button" onClick={() => setAdjusting(p)} className="font-semibold underline decoration-dotted underline-offset-4 hover:text-signal" title="Update stock">
                      {p.stock} {p.unit}
                    </button>
                    <span className={clsx("block text-small", p.stockStatus === "in_stock" ? "text-success" : p.stockStatus === "limited" ? "text-warning" : "text-danger")}>
                      {STOCK_LABEL[p.stockStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => toggleVisible(p)} className="inline-flex items-center gap-1.5 font-medium hover:text-signal" title={p.isActive ? "Hide from website" : "Show on website"}>
                      {p.isActive ? <Eye aria-hidden className="h-4 w-4" /> : <EyeOff aria-hidden className="h-4 w-4" />}
                      {p.isActive ? "Shown" : "Hidden"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEditing(p)} className="inline-flex h-10 w-10 items-center justify-center hover:bg-surface" aria-label={`Edit ${p.name}`} title="Edit">
                        <Pencil aria-hidden className="h-4.5 w-4.5" />
                      </button>
                      <button type="button" onClick={() => setDeleting(p)} className="inline-flex h-10 w-10 items-center justify-center text-danger hover:bg-[#fbe9ea]" aria-label={`Delete ${p.name}`} title="Delete">
                        <Trash2 aria-hidden className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} labelledBy="product-form-title">
        {editing !== null ? (
          <ProductForm
            product={editing === "new" ? null : editing}
            categories={Array.from(new Set(products.map((p) => p.category))).sort()}
            onSaved={(p, created) => {
              replace(p);
              setEditing(null);
              say("ok", `${p.name} ${created ? "added" : "saved"}.`);
            }}
          />
        ) : null}
      </Dialog>

      <Dialog open={adjusting !== null} onClose={() => setAdjusting(null)} labelledBy="stock-title" className="!w-[min(28rem,calc(100vw-2rem))]">
        {adjusting ? (
          <StockForm
            product={adjusting}
            onDone={(p) => {
              replace(p);
              setAdjusting(null);
              say("ok", `Stock for ${p.name} is now ${p.stock}.`);
            }}
          />
        ) : null}
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} labelledBy="delete-title" className="!w-[min(28rem,calc(100vw-2rem))]">
        {deleting ? (
          <div className="p-7">
            <h2 id="delete-title" className="pr-10 text-[1.4rem] font-bold">Delete product?</h2>
            <p className="mt-3 text-muted">
              {deleting.name} will be removed from the catalogue. Past order requests keep their copy of it. To take it off the website temporarily, hide it instead.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="light" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button
                className="!bg-danger hover:!bg-[#951c22]"
                onClick={async () => {
                  const r = await adminFetch(`/api/products/${deleting.id}`, { method: "DELETE" });
                  if (r.ok) {
                    setProducts((ps) => ps.filter((x) => x.id !== deleting.id));
                    say("ok", `${deleting.name} deleted.`);
                  } else say("error", r.data.message ?? "Could not delete.");
                  setDeleting(null);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

function StockForm({ product, onDone }: { product: Product; onDone: (p: Product) => void }) {
  const [change, setChange] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(change);
    if (!Number.isInteger(n) || n === 0) return setError("Enter a whole number to add (e.g. 10) or remove (e.g. -2).");
    const r = await adminFetch<Product>(`/api/products/${product.id}/stock`, { method: "PATCH", body: JSON.stringify({ change: n }) });
    if (r.ok) onDone(r.data);
    else setError(r.data.message ?? "Could not update stock.");
  };
  return (
    <form onSubmit={submit} className="p-7">
      <h2 id="stock-title" className="pr-10 text-[1.4rem] font-bold">Update stock</h2>
      <p className="mt-1 text-muted">{product.name}: <span className="tabular font-semibold text-ink">{product.stock} {product.unit}</span> in stock.</p>
      <TextField className="mt-6" label="Add or remove units" name="change" type="number" inputMode="numeric" required value={change} onChange={(e) => { setChange(e.target.value); setError(""); }} error={error} hint="Use a minus sign to remove, e.g. -2. Reservations from open orders are kept." />
      <div className="mt-6 flex justify-end">
        <Button type="submit">Update stock</Button>
      </div>
    </form>
  );
}

function ProductForm({ product, categories, onSaved }: { product: Product | null; categories: string[]; onSaved: (p: Product, created: boolean) => void }) {
  const [v, setV] = useState(() => ({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    brand: product?.brand ?? "",
    division: (product?.division ?? "") as Division | "",
    category: product?.category ?? "",
    description: product?.description ?? "",
    hsnCode: product?.hsnCode ?? "",
    unit: product?.unit ?? "Nos",
    taxRate: String(product?.taxRate ?? 18),
    priceMode: "incl" as "incl" | "excl",
    priceValue: product ? String(product.listPriceInclTax) : "",
    discountType: (product?.discountType ?? "none") as DiscountType,
    discountValue: String(product?.discountValue ?? ""),
    stock: String(product?.stock ?? 0),
    lowStockThreshold: String(product?.lowStockThreshold ?? 3),
    isActive: product?.isActive ?? true,
  }));
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>(product?.imageUrl ?? "");
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => () => { if (preview.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  const rate = Number(v.taxRate) || 0;
  const typed = Number(v.priceValue) || 0;
  const taxable = v.priceMode === "incl" ? round2(typed / (1 + rate / 100)) : round2(typed);
  const live = pricing({ price: taxable, taxRate: rate, discountType: v.discountType, discountValue: Number(v.discountValue) || 0 });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > PHOTO_PICK_MAX_BYTES) return setErrors(["That photo is larger than 25 MB."]);
    try {
      const small = await shrinkPhoto(file);
      setImage(small);
      setPreview(URL.createObjectURL(small));
      setRemoveImage(false);
      setErrors([]);
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.division) {
      setErrors(["Choose which product section this belongs to: Electronics, Electrical or Industrial."]);
      document.getElementById("division")?.focus();
      return;
    }
    setBusy(true);
    const fd = new FormData();
    for (const k of ["name", "sku", "brand", "division", "category", "description", "hsnCode", "unit", "taxRate", "discountType", "stock", "lowStockThreshold"] as const) fd.set(k, v[k]);
    fd.set(v.priceMode === "incl" ? "priceInclTax" : "price", v.priceValue);
    fd.set("discountValue", v.discountType === "none" ? "0" : v.discountValue || "0");
    fd.set("isActive", String(v.isActive));
    if (image) fd.set("image", image);
    if (removeImage) fd.set("removeImage", "true");
    const r = await adminFetch<Product & { errors?: string[] }>(product ? `/api/products/${product.id}` : "/api/products", { method: product ? "PUT" : "POST", body: fd });
    setBusy(false);
    if (r.ok) onSaved(r.data, !product);
    else setErrors(r.data.errors ?? [r.data.message ?? "Could not save."]);
  };

  return (
    <form onSubmit={submit} noValidate className="p-7 sm:p-9">
      <h2 id="product-form-title" className="pr-10 text-[1.6rem] font-bold">{product ? "Edit product" : "Add product"}</h2>
      {errors.length ? (
        <ul role="alert" className="mt-5 space-y-1 bg-[#fbe9ea] px-4 py-3 font-medium text-danger">
          {errors.map((er) => <li key={er}>{er}</li>)}
        </ul>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_15rem]">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField className="sm:col-span-2" label="Product name" name="name" required value={v.name} onChange={set("name")} />
          <TextField label="Model / SKU" name="sku" required value={v.sku} onChange={set("sku")} />
          <TextField label="Brand" name="brand" value={v.brand} onChange={set("brand")} />
          <SelectField
            label="Product section"
            name="division"
            required
            value={v.division}
            onChange={set("division")}
            hint="Which Our products page it appears on."
          >
            <option value="" disabled>
              Choose a section
            </option>
            {DIVISIONS.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.label}
              </option>
            ))}
          </SelectField>
          <div>
            <TextField label="Category" name="category" list="category-options" value={v.category} onChange={set("category")} placeholder="e.g. Sensors" />
            <datalist id="category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <TextField label="HSN code" name="hsnCode" inputMode="numeric" value={v.hsnCode} onChange={set("hsnCode")} hint="4 to 8 digits." />
          <TextArea className="sm:col-span-2" label="Product description" name="description" rows={3} value={v.description} onChange={set("description")} />

          <fieldset className="sm:col-span-2">
            <legend className="text-[0.95rem] font-semibold">Price tag</legend>
            <div className="mt-2 inline-flex">
              {(["incl", "excl"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={v.priceMode === m} onClick={() => setV((x) => ({ ...x, priceMode: m, priceValue: x.priceValue ? String(m === "incl" ? live.listPriceInclTax : taxable) : "" }))} className={clsx("px-4 py-2 text-[0.9rem] font-semibold", v.priceMode === m ? "bg-ink text-on-ink" : "bg-surface")}>
                  {m === "incl" ? "Price incl. GST" : "Price before GST"}
                </button>
              ))}
            </div>
          </fieldset>
          <TextField label={v.priceMode === "incl" ? "Price incl. GST (₹)" : "Price before GST (₹)"} name="price" type="number" inputMode="decimal" min={0} step="0.01" required value={v.priceValue} onChange={set("priceValue")} />
          <SelectField label="GST rate" name="taxRate" required value={v.taxRate} onChange={set("taxRate")}>
            {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
          </SelectField>
          <SelectField label="Discount type" name="discountType" value={v.discountType} onChange={set("discountType")}>
            <option value="none">No discount</option>
            <option value="percent">Percentage off</option>
            <option value="amount">Rupees off per unit</option>
          </SelectField>
          <TextField label={v.discountType === "amount" ? "Discount (₹)" : "Discount (%)"} name="discountValue" type="number" inputMode="decimal" min={0} disabled={v.discountType === "none"} value={v.discountType === "none" ? "" : v.discountValue} onChange={set("discountValue")} />
          <TextField label="Stock available" name="stock" type="number" inputMode="numeric" min={0} value={v.stock} onChange={set("stock")} hint={product ? "To add or remove units safely while orders come in, use Update stock." : undefined} />
          <TextField label="Low-stock alert at" name="lowStockThreshold" type="number" inputMode="numeric" min={0} value={v.lowStockThreshold} onChange={set("lowStockThreshold")} />
          <TextField label="Unit" name="unit" value={v.unit} onChange={set("unit")} hint="e.g. Nos, m, set" />
          <label className="flex cursor-pointer items-center gap-3 self-end pb-3">
            <input type="checkbox" checked={v.isActive} onChange={(e) => setV((x) => ({ ...x, isActive: e.target.checked }))} className="h-5 w-5 accent-[var(--color-ink)]" />
            <span className="font-medium">Show on website</span>
          </label>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-[0.95rem] font-semibold">Product image</p>
            <div className="relative mt-2 aspect-square bg-surface">
              {preview && !removeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Product preview" className="absolute inset-0 h-full w-full object-contain p-3 mix-blend-multiply" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted">
                  <ImagePlus aria-hidden className="h-10 w-10" />
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="product-image" onChange={(e) => pick(e.target.files?.[0])} />
            <div className="mt-2 flex gap-2">
              <label htmlFor="product-image" className={buttonClass("ghost", "min-h-10 flex-1 cursor-pointer px-3 text-[0.9rem]")}>Upload image</label>
              {preview && !removeImage ? (
                <Button type="button" variant="light" className="min-h-10 px-3 text-[0.9rem]" onClick={() => { setImage(null); setRemoveImage(true); if (fileRef.current) fileRef.current.value = ""; }}>
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="mt-1.5 text-small text-muted">JPG, PNG or WEBP. Large photos are shrunk before upload.</p>
          </div>
          <div className="bg-surface p-4">
            <p className="text-small font-semibold text-muted">Customers see</p>
            <p className="tabular mt-1 text-[1.5rem] font-bold">{formatINR(live.priceInclTax)}</p>
            {live.discountAmount ? <p className="tabular text-small"><s className="text-muted">{formatINR(live.listPriceInclTax)}</s> <span className="font-semibold text-success">{live.discountPercent}% off</span></p> : null}
            <p className="tabular mt-1 text-small text-muted">{formatINR(live.unitPrice)} + {formatINR(live.taxAmount)} GST</p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end gap-2">
        <Button type="submit" disabled={busy} className="min-w-40">{busy ? "Saving…" : product ? "Save changes" : "Add product"}</Button>
      </div>
    </form>
  );
}
