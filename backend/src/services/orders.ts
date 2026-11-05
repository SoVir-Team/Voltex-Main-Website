import { randomBytes } from "node:crypto";
import { EMAIL_RE, GSTIN_RE, indianPhone, priceLine, round2, type DiscountType } from "@voltex/shared";
import { prisma, type Prisma } from "../db.ts";
import { HttpError, badRequest, isUuid, str } from "../lib/http.ts";

const LIMITS = { name: 120, email: 160, company: 160, address: 500, notes: 1000 };

export function readCustomer(raw: unknown) {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const customer = {
    name: str(c.name),
    email: str(c.email).toLowerCase(),
    phone: indianPhone(c.phone),
    company: str(c.company),
    gstin: str(c.gstin).toUpperCase(),
    address: str(c.address),
    notes: str(c.notes),
  };
  const errors: string[] = [];
  if (!customer.name) errors.push("Your name is required.");
  if (!EMAIL_RE.test(customer.email)) errors.push("A valid email address is required.");
  if (!customer.phone) errors.push("Enter a 10-digit phone number.");
  if (customer.gstin && !GSTIN_RE.test(customer.gstin)) errors.push("GSTIN must be 15 characters (for example 29ABCDE1234F1Z5).");
  for (const [k, max] of Object.entries(LIMITS)) {
    if (customer[k as keyof typeof customer].length > max) errors.push(`${k} is too long (max ${max} characters).`);
  }
  return { customer, errors };
}

/** Merges repeated cart lines for the same product and validates quantities. */
export function readItems(items: unknown) {
  const errors: string[] = [];
  const wanted = new Map<string, number>();
  if (!Array.isArray(items) || items.length === 0) errors.push("Your cart is empty.");
  else if (items.length > 50) errors.push("An order can have at most 50 different products.");
  else {
    for (const item of items) {
      const qty = Number(item?.quantity);
      if (!item || !isUuid(item.productId) || !Number.isInteger(qty) || qty < 1 || qty > 100_000) {
        errors.push("Each item needs a product and a whole-number quantity of at least 1.");
        break;
      }
      wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + qty);
    }
  }
  return { wanted, errors };
}

const orderNumber = () => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `VX-PO-${stamp}-${randomBytes(4).toString("hex").slice(0, 5).toUpperCase()}`;
};

/**
 * Places an order request. Stock is reserved per line inside one transaction; if any line cannot be filled
 * the whole transaction rolls back and the customer is told what is available.
 */
export async function placeOrder(body: { customer?: unknown; items?: unknown }) {
  const { customer, errors: customerErrors } = readCustomer(body.customer);
  const { wanted, errors: itemErrors } = readItems(body.items);
  const errors = [...customerErrors, ...itemErrors];
  if (errors.length) throw badRequest(errors);

  type Line = ReturnType<typeof priceLine> & { productId: string; sku: string; name: string; hsnCode: string; quantity: number; taxRate: Prisma.Decimal };
  return prisma.$transaction(async (tx) => {
    const lines: Line[] = [];
    for (const [id, qty] of wanted) {
      const reserved = await tx.product.updateMany({
        where: { id, isActive: true, stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      });
      if (reserved.count === 0) {
        const current = await tx.product.findUnique({ where: { id } });
        const unavailable = !current || !current.isActive;
        throw new HttpError(
          409,
          unavailable
            ? "One of the products in your cart is no longer available."
            : current.stock <= 0
              ? `${current.name} is out of stock.`
              : `Only ${current.stock} ${current.unit} of ${current.name} available.`,
          { productId: id, available: unavailable ? 0 : current.stock },
        );
      }
      const p = (await tx.product.findUnique({ where: { id } }))!;
      const priced = priceLine(
        { price: Number(p.price), taxRate: Number(p.taxRate), discountType: p.discountType as DiscountType, discountValue: Number(p.discountValue) },
        qty,
      );
      lines.push({ productId: p.id, sku: p.sku, name: p.name, hsnCode: p.hsnCode, quantity: qty, taxRate: p.taxRate, ...priced });
    }
    const sum = (f: (l: Line) => number) => round2(lines.reduce((s, l) => s + f(l), 0));
    const order = await tx.productOrder.create({
      data: {
        orderNumber: orderNumber(),
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerCompany: customer.company,
        customerGstin: customer.gstin,
        customerAddress: customer.address,
        customerNotes: customer.notes,
        taxableTotal: sum((l) => l.taxableAmount),
        taxTotal: sum((l) => l.taxAmount),
        discountTotal: sum((l) => l.discountPerUnit * l.quantity),
        grandTotal: sum((l) => l.lineTotal),
        items: { create: lines },
      },
    });
    return { orderNumber: order.orderNumber, grandTotal: Number(order.grandTotal) };
  });
}

/** Cancelling an order returns its reserved units to stock; re-opening a cancelled order is not allowed. */
export async function updateOrderStatus(id: string, status: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.productOrder.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new HttpError(404, "Order not found");
    if (order.status === "cancelled") throw new HttpError(400, "A cancelled order cannot be changed.");
    await tx.productOrder.update({ where: { id }, data: { status: status as never } });
    if (status === "cancelled") {
      for (const i of order.items) {
        if (i.productId) await tx.product.updateMany({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
      }
    }
    return status;
  });
}
