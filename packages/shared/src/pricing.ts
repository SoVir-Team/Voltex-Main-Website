// Pricing rules ported from the SoVir products package (productController.js).
// Prices are stored as the taxable (pre-GST) unit price in rupees. Everything a customer sees is derived
// here, so the API and the website always agree.

export type DiscountType = "none" | "percent" | "amount";
export type StockStatus = "in_stock" | "limited" | "out_of_stock";

export interface PricedInput {
  price: number;
  taxRate: number;
  discountType: DiscountType;
  discountValue: number;
}

export interface Pricing {
  listPriceInclTax: number;
  discountAmount: number;
  discountPercent: number;
  priceInclTax: number;
  unitPrice: number;
  taxAmount: number;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Customer pricing for one unit. The discount comes off the GST-inclusive list price; the selling price is then split back into taxable value and GST. */
export function pricing(p: PricedInput): Pricing {
  const listPriceInclTax = round2(p.price * (1 + p.taxRate / 100));
  const value = Number(p.discountValue) || 0;
  const discountAmount =
    p.discountType === "percent"
      ? round2((listPriceInclTax * Math.min(value, 100)) / 100)
      : p.discountType === "amount"
        ? round2(Math.min(value, listPriceInclTax))
        : 0;
  const priceInclTax = round2(listPriceInclTax - discountAmount);
  const unitPrice = round2(priceInclTax / (1 + p.taxRate / 100));
  return {
    listPriceInclTax,
    discountAmount,
    discountPercent: discountAmount && listPriceInclTax ? Math.round((discountAmount / listPriceInclTax) * 100) : 0,
    priceInclTax,
    unitPrice,
    taxAmount: round2(priceInclTax - unitPrice),
  };
}

/** Stock state shown to customers: out of stock at 0, limited at or below the product's threshold. */
export const stockStatus = (p: { stock: number; lowStockThreshold: number }): StockStatus =>
  p.stock <= 0 ? "out_of_stock" : p.stock <= p.lowStockThreshold ? "limited" : "in_stock";

/** A rupee discount cannot exceed the GST-inclusive price it comes off; a percentage must stay below 100. */
export const discountError = (p: PricedInput): string | null =>
  p.discountType === "amount" && p.discountValue > round2(p.price * (1 + p.taxRate / 100))
    ? "The discount amount cannot be more than the price incl. GST."
    : p.discountType === "percent" && p.discountValue >= 100
      ? "Discount percentage must be below 100%."
      : null;

/** One order line, priced at the moment the order is placed. */
export function priceLine(p: PricedInput, quantity: number) {
  const price = pricing(p);
  const lineTotal = round2(price.priceInclTax * quantity);
  const taxableAmount = round2(lineTotal / (1 + p.taxRate / 100));
  return {
    unitPrice: price.unitPrice,
    listPriceInclTax: price.listPriceInclTax,
    discountPerUnit: price.discountAmount,
    taxableAmount,
    taxAmount: round2(lineTotal - taxableAmount),
    lineTotal,
  };
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
export const formatINR = (n: number): string => inr.format(n);
