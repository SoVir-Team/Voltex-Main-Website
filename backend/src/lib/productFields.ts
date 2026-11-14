import { round2, HSN_RE, isDivision, divisionToDb, type DiscountType, type Division } from "@voltex/shared";
import { str } from "./http.ts";

export interface ProductFields {
  name?: string;
  sku?: string;
  brand?: string;
  division?: Division;
  category?: string;
  description?: string;
  hsnCode?: string;
  unit?: string;
  price?: number;
  taxRate?: number;
  stock?: number;
  lowStockThreshold?: number;
  discountType?: DiscountType;
  discountValue?: number;
  isActive?: boolean;
}

const toNumber = (v: unknown): number | undefined => (v === undefined || v === null || v === "" ? undefined : Number(v));

const LIMITS: Record<string, number> = { name: 160, sku: 80, brand: 80, category: 80, description: 2000, unit: 20 };

/**
 * Reads product fields from a JSON or multipart body (ported from productController.readProductFields).
 * Accepts either the taxable price (`price`) or the GST-inclusive price (`priceInclTax`).
 */
export function readProductFields(body: Record<string, unknown>, opts: { partial: boolean; currentTaxRate?: number }) {
  const errors: string[] = [];
  const out: ProductFields = {};
  for (const key of ["name", "sku", "brand", "category", "description", "hsnCode", "unit"] as const) {
    if (body[key] !== undefined) {
      out[key] = str(body[key]);
      const max = LIMITS[key];
      if (max && out[key]!.length > max) errors.push(`${key} is too long (max ${max} characters).`);
    }
  }
  if (!opts.partial || body.name !== undefined) if (!out.name) errors.push("Product name is required.");
  if (!opts.partial || body.sku !== undefined) if (!out.sku) errors.push("Model / SKU is required.");
  if (out.hsnCode && !HSN_RE.test(out.hsnCode)) errors.push("HSN code must be 4 to 8 digits.");

  if (body.division !== undefined) {
    const d = str(body.division);
    if (!isDivision(d)) errors.push("Choose Electronics, Electrical or Industrial as the product section.");
    else out.division = divisionToDb(d) as Division;
  }

  const taxRate = toNumber(body.taxRate);
  if (taxRate !== undefined) {
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 28) errors.push("GST rate must be between 0 and 28%.");
    else out.taxRate = taxRate;
  }
  const price = toNumber(body.price);
  const priceInclTax = toNumber(body.priceInclTax);
  if (price !== undefined) {
    if (!Number.isFinite(price) || price < 0) errors.push("Price must be a positive amount.");
    else out.price = round2(price);
  } else if (priceInclTax !== undefined) {
    const rate = out.taxRate ?? opts.currentTaxRate ?? 18;
    if (!Number.isFinite(priceInclTax) || priceInclTax < 0) errors.push("Price must be a positive amount.");
    else out.price = round2(priceInclTax / (1 + rate / 100));
  } else if (!opts.partial) errors.push("Price is required.");

  for (const key of ["stock", "lowStockThreshold"] as const) {
    const v = toNumber(body[key]);
    if (v === undefined) continue;
    if (!Number.isInteger(v) || v < 0 || v > 10_000_000)
      errors.push(`${key === "stock" ? "Stock" : "Low-stock alert level"} must be a whole number of 0 or more.`);
    else out[key] = v;
  }
  if (body.discountType !== undefined) {
    const type = str(body.discountType) || "none";
    if (!["none", "percent", "amount"].includes(type)) errors.push("Discount must be none, a percentage or an amount.");
    else out.discountType = type as DiscountType;
  }
  const discountValue = toNumber(body.discountValue);
  if (discountValue !== undefined) {
    if (!Number.isFinite(discountValue) || discountValue < 0) errors.push("Discount must be 0 or more.");
    else out.discountValue = round2(discountValue);
  }
  if (out.discountType === "none") out.discountValue = 0;
  if (out.discountType === "percent" && out.discountValue !== undefined && out.discountValue >= 100)
    errors.push("Discount percentage must be below 100%.");
  if (body.isActive !== undefined) out.isActive = body.isActive === true || body.isActive === "true";
  return { out, errors };
}
