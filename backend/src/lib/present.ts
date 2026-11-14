import { pricing, stockStatus, type Product, type ProductOrder, type DiscountType, type Division, divisionFromDb } from "@voltex/shared";
import type { Product as DbProduct, ProductOrder as DbOrder, OrderItem as DbItem } from "../generated/prisma/client.ts";

const n = (d: unknown): number => Number(d ?? 0);

/** Database product → API shape with the customer pricing and stock state worked out. */
export function presentProduct(p: DbProduct): Product {
  const base = {
    price: n(p.price),
    taxRate: n(p.taxRate),
    discountType: p.discountType as DiscountType,
    discountValue: n(p.discountValue),
  };
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    brand: p.brand,
    division: divisionFromDb(p.division),
    category: p.category,
    description: p.description,
    hsnCode: p.hsnCode,
    unit: p.unit,
    imageUrl: p.imageUrl,
    ...base,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    isActive: p.isActive,
    ...pricing(base),
    stockStatus: stockStatus(p),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function presentOrder(o: DbOrder & { items: DbItem[] }): ProductOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customer: {
      name: o.customerName,
      email: o.customerEmail,
      phone: o.customerPhone,
      company: o.customerCompany,
      gstin: o.customerGstin,
      address: o.customerAddress,
      notes: o.customerNotes,
    },
    items: o.items.map((i) => ({
      productId: i.productId,
      sku: i.sku,
      name: i.name,
      hsnCode: i.hsnCode,
      quantity: i.quantity,
      unitPrice: n(i.unitPrice),
      listPriceInclTax: n(i.listPriceInclTax),
      discountPerUnit: n(i.discountPerUnit),
      taxRate: n(i.taxRate),
      taxableAmount: n(i.taxableAmount),
      taxAmount: n(i.taxAmount),
      lineTotal: n(i.lineTotal),
    })),
    taxableTotal: n(o.taxableTotal),
    taxTotal: n(o.taxTotal),
    discountTotal: n(o.discountTotal),
    grandTotal: n(o.grandTotal),
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}
