import { test } from "node:test";
import assert from "node:assert/strict";
import { pricing, priceLine, stockStatus, discountError } from "./pricing.js";
import { indianPhone } from "./validation.js";

test("GST-inclusive price with no discount", () => {
  const p = pricing({ price: 10000, taxRate: 18, discountType: "none", discountValue: 0 });
  assert.equal(p.listPriceInclTax, 11800);
  assert.equal(p.priceInclTax, 11800);
  assert.equal(p.unitPrice, 10000);
  assert.equal(p.taxAmount, 1800);
});

test("percent discount comes off the GST-inclusive price", () => {
  const p = pricing({ price: 10000, taxRate: 18, discountType: "percent", discountValue: 10 });
  assert.equal(p.discountAmount, 1180);
  assert.equal(p.priceInclTax, 10620);
  assert.equal(p.discountPercent, 10);
});

test("discount validation", () => {
  assert.equal(
    discountError({ price: 100, taxRate: 18, discountType: "amount", discountValue: 200 }),
    "The discount amount cannot be more than the price incl. GST.",
  );
  assert.equal(
    discountError({ price: 100, taxRate: 18, discountType: "percent", discountValue: 100 }),
    "Discount percentage must be below 100%.",
  );
  assert.equal(discountError({ price: 100, taxRate: 18, discountType: "amount", discountValue: 18 }), null);
});

test("order line totals", () => {
  const l = priceLine({ price: 10000, taxRate: 18, discountType: "none", discountValue: 0 }, 2);
  assert.equal(l.lineTotal, 23600);
  assert.equal(l.taxableAmount, 20000);
  assert.equal(l.taxAmount, 3600);
});

test("stock status thresholds", () => {
  assert.equal(stockStatus({ stock: 0, lowStockThreshold: 3 }), "out_of_stock");
  assert.equal(stockStatus({ stock: 3, lowStockThreshold: 3 }), "limited");
  assert.equal(stockStatus({ stock: 4, lowStockThreshold: 3 }), "in_stock");
});

test("indian phone normalisation", () => {
  assert.equal(indianPhone("+91 98450 00000"), "+91 9845000000");
  assert.equal(indianPhone("09845000000"), "+91 9845000000");
  assert.equal(indianPhone("12345"), "");
});
