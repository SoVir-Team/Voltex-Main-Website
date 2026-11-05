"use client";

import { useState } from "react";
import Image from "next/image";
import { clsx } from "clsx";
import { Cpu } from "lucide-react";
import { formatINR, type Product, type StockStatus } from "@voltex/shared";

export const STOCK_LABEL: Record<StockStatus, string> = {
  in_stock: "In stock",
  limited: "Limited stock",
  out_of_stock: "Out of stock",
};

const STOCK_STYLE: Record<StockStatus, string> = {
  in_stock: "text-success",
  limited: "text-warning",
  out_of_stock: "text-danger",
};

export function StockBadge({ product, className }: { product: Pick<Product, "stockStatus" | "stock" | "unit">; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 text-small font-semibold", STOCK_STYLE[product.stockStatus], className)}>
      <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
      {STOCK_LABEL[product.stockStatus]}
      {product.stockStatus === "limited" ? <span className="font-normal">· {product.stock} {product.unit} left</span> : null}
    </span>
  );
}

/** Product image with a drawn fallback when a photo is missing or fails to load. */
export function ProductImage({ product, sizes, priority, className }: { product: Pick<Product, "imageUrl" | "name">; sizes: string; priority?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  // SVG illustrations need no optimising, and uploaded photos (/api/uploads) are already shrunk before upload.
  const isSvg = product.imageUrl.endsWith(".svg") || product.imageUrl.startsWith("/api/");
  if (!product.imageUrl || failed) {
    return (
      <div className={clsx("flex h-full w-full items-center justify-center bg-surface text-[#9aa6c4]", className)}>
        <Cpu aria-hidden className="h-1/3 w-1/3" strokeWidth={1.2} />
      </div>
    );
  }
  return (
    <Image
      src={product.imageUrl}
      alt={product.name}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={isSvg}
      onError={() => setFailed(true)}
      className={clsx("object-contain p-[8%] mix-blend-multiply", className)}
    />
  );
}

export function PriceBlock({ product, large = false }: { product: Product; large?: boolean }) {
  const discounted = product.discountAmount > 0;
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={clsx("tabular font-bold text-ink", large ? "text-[1.75rem]" : "text-[1.25rem]")}>{formatINR(product.priceInclTax)}</span>
        {discounted ? (
          <>
            <s className="tabular text-small text-muted">{formatINR(product.listPriceInclTax)}</s>
            <span className="text-small font-semibold text-success">{product.discountPercent}% off</span>
          </>
        ) : null}
      </p>
      <p className="tabular text-small text-muted">
        incl. {product.taxRate}% GST · {formatINR(product.unitPrice)} + GST per {product.unit === "Nos" ? "unit" : product.unit}
      </p>
    </div>
  );
}
