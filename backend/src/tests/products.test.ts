// Ported from the SoVir products package tests (products.test.js), now on PostgreSQL with a real admin session.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Agent } from "supertest";
import { adminAgent, app, customer, prisma, request, resetDb } from "./helpers.ts";

let admin: Agent;

beforeEach(async () => {
  await resetDb();
  admin = await adminAgent();
});
afterAll(async () => {
  await prisma.$disconnect();
});

const order = (items: { productId: string; quantity: number }[], c: object = customer) =>
  request(app).post("/api/products/orders").send({ customer: c, items });

describe("products", () => {
  it("starter catalogue import adds 28 products once with unit prices and stock", async () => {
    const first = await admin.post("/api/products/admin/import-catalogue");
    expect(first.body.added).toBe(28);
    expect((await admin.post("/api/products/admin/import-catalogue")).body.added).toBe(0);
    const { body } = await request(app).get("/api/products");
    expect(body.data).toHaveLength(28);
    const plc = body.data.find((p: { sku: string }) => p.sku === "CP2E-S30DT1-D");
    expect(plc).toMatchObject({ price: 10000, priceInclTax: 11800, stock: 2, stockStatus: "limited" });
    expect(body.data.find((p: { sku: string }) => p.sku === "CS94106BOOO").stockStatus).toBe("in_stock");
  });

  it("admin can create from a GST-inclusive price, edit, adjust stock, hide and delete", async () => {
    const created = await admin.post("/api/products").send({ name: "Test Relay", sku: "TR-1", priceInclTax: 118, taxRate: 18, stock: 4, hsnCode: "85364100" });
    expect(created.status).toBe(201);
    expect(created.body.price).toBe(100);
    expect((await admin.post("/api/products").send({ name: "Dup", sku: "TR-1", price: 1 })).status).toBe(409);
    expect((await admin.post("/api/products").send({ name: "Bad", sku: "B-1", price: 1, hsnCode: "abc" })).status).toBe(400);
    const id = created.body.id;
    const edited = await admin.put(`/api/products/${id}`).send({ price: 200, description: "Updated" });
    expect(edited.body).toMatchObject({ priceInclTax: 236, description: "Updated" });
    expect((await admin.patch(`/api/products/${id}/stock`).send({ change: -10 })).status).toBe(400);
    expect((await admin.patch(`/api/products/${id}/stock`).send({ change: -4 })).body.stockStatus).toBe("out_of_stock");
    await admin.put(`/api/products/${id}`).send({ isActive: false });
    expect((await request(app).get("/api/products")).body.data).toHaveLength(0);
    expect((await admin.get("/api/products/admin/all")).body.data).toHaveLength(1);
    expect((await admin.delete(`/api/products/${id}`)).status).toBe(200);
    expect((await admin.get("/api/products/admin/all")).body.data).toHaveLength(0);
  });

  it("orders reserve stock, refuse more than available, roll back partial carts and restock on cancel", async () => {
    const a = (await admin.post("/api/products").send({ name: "Sensor", sku: "S-1", price: 1000, stock: 5 })).body;
    const b = (await admin.post("/api/products").send({ name: "Valve", sku: "V-1", price: 50, stock: 1 })).body;
    const placed = await order([{ productId: a.id, quantity: 3 }]);
    expect(placed.status).toBe(201);
    expect(placed.body.grandTotal).toBe(3540);
    expect(placed.body.orderNumber).toMatch(/^VX-PO-\d{8}-[0-9A-F]{5}$/);
    expect((await prisma.product.findUnique({ where: { id: a.id } }))!.stock).toBe(2);

    const tooMany = await order([{ productId: a.id, quantity: 1 }, { productId: b.id, quantity: 2 }]);
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.available).toBe(1);
    expect((await prisma.product.findUnique({ where: { id: a.id } }))!.stock).toBe(2);

    expect((await order([{ productId: a.id, quantity: 1 }], { ...customer, email: "nope" })).status).toBe(400);

    const [saved] = (await admin.get("/api/products/admin/orders")).body.data;
    expect((await admin.patch(`/api/products/admin/orders/${saved.id}`).send({ status: "cancelled" })).status).toBe(200);
    expect((await prisma.product.findUnique({ where: { id: a.id } }))!.stock).toBe(5);
    expect((await admin.patch(`/api/products/admin/orders/${saved.id}`).send({ status: "confirmed" })).status).toBe(400);
  });

  it("concurrent orders never oversell the last units", async () => {
    const p = (await admin.post("/api/products").send({ name: "Last", sku: "L-1", price: 10, stock: 3 })).body;
    const results = await Promise.all(Array.from({ length: 6 }, () => order([{ productId: p.id, quantity: 1 }])));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect((await prisma.product.findUnique({ where: { id: p.id } }))!.stock).toBe(0);
    const out = await order([{ productId: p.id, quantity: 1 }]);
    expect(out.body.message).toMatch(/out of stock/);
  });

  it("discounts by percent or amount come off the GST-inclusive price and carry into orders", async () => {
    const p = (await admin.post("/api/products").send({ name: "Drive", sku: "D-1", price: 1000, stock: 10, discountType: "percent", discountValue: 10 })).body;
    expect(p).toMatchObject({ listPriceInclTax: 1180, discountAmount: 118, priceInclTax: 1062, discountPercent: 10 });
    const byAmount = (await admin.put(`/api/products/${p.id}`).send({ discountType: "amount", discountValue: 180 })).body;
    expect(byAmount).toMatchObject({ priceInclTax: 1000, unitPrice: 847.46, discountPercent: 15 });
    expect((await admin.put(`/api/products/${p.id}`).send({ discountValue: 5000 })).status).toBe(400);
    expect((await admin.put(`/api/products/${p.id}`).send({ discountType: "percent", discountValue: 100 })).status).toBe(400);
    const placed = await order([{ productId: p.id, quantity: 2 }]);
    expect(placed.body.grandTotal).toBe(2000);
    const [saved] = (await admin.get("/api/products/admin/orders")).body.data;
    expect(saved.discountTotal).toBe(360);
    expect(saved.items[0].listPriceInclTax).toBe(1180);
    expect(saved.taxableTotal + saved.taxTotal).toBeCloseTo(2000, 2);
    const cleared = (await admin.put(`/api/products/${p.id}`).send({ discountType: "none" })).body;
    expect(cleared).toMatchObject({ priceInclTax: 1180, discountValue: 0 });
  });

  it("order phone numbers must be 10 Indian digits and are stored with +91", async () => {
    const p = (await admin.post("/api/products").send({ name: "Cable", sku: "C-1", price: 10, stock: 10 })).body;
    const withPhone = (phone: string) => order([{ productId: p.id, quantity: 1 }], { ...customer, phone });
    expect((await withPhone("98450 0000")).status).toBe(400);
    expect((await withPhone("+1 415 555 0100 22")).status).toBe(400);
    expect((await withPhone("9845000000")).status).toBe(201);
    expect((await prisma.productOrder.findFirst())!.customerPhone).toBe("+91 9845000000");
  });

  it("products belong to a division and the public list can be filtered by it", async () => {
    await admin.post("/api/products/admin/import-catalogue");
    const count = async (d: string) => (await request(app).get(`/api/products?division=${d}`)).body.data.length;
    expect([await count("electronics"), await count("electrical"), await count("industrial")]).toEqual([10, 9, 9]);
    expect((await request(app).get("/api/products?division=nonsense")).body.data).toHaveLength(28);

    const made = await admin.post("/api/products").send({ name: "Copper wire", sku: "W-1", price: 100, division: "electrical" });
    expect(made.body.division).toBe("electrical");
    expect((await admin.post("/api/products").send({ name: "X", sku: "X-1", price: 1, division: "space" })).status).toBe(400);
    expect((await admin.put(`/api/products/${made.body.id}`).send({ division: "electronics" })).body.division).toBe("electronics");
    expect((await admin.post("/api/products").send({ name: "Y", sku: "Y-1", price: 1 })).body.division).toBe("industrial");
  });

  it("malformed ids answer 404, not a server error", async () => {
    expect((await request(app).get("/api/products/not-a-uuid")).status).toBe(404);
    expect((await admin.put("/api/products/not-a-uuid").send({ price: 1 })).status).toBe(404);
  });
});
