import { Router } from "express";
import { ORDER_STATUSES, discountError, isDivision, divisionToDb, type DiscountType } from "@voltex/shared";
import { prisma, Prisma } from "../db.ts";
import { HttpError, badRequest, handler, isUuid, notFound } from "../lib/http.ts";
import { presentOrder, presentProduct } from "../lib/present.ts";
import { readProductFields } from "../lib/productFields.ts";
import { requireAdmin } from "../middleware/auth.ts";
import { UPLOAD_PREFIX, imageUpload, removeUploadedImage } from "../middleware/upload.ts";
import { syncCatalogue } from "../services/catalogue.ts";
import { placeOrder, updateOrderStatus } from "../services/orders.ts";

export const productsRouter = Router();

const duplicateSku = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

// ---------------- Admin (registered before "/:id" so these paths are not read as product ids) ----------------

productsRouter.get(
  "/admin/all",
  requireAdmin,
  handler(async (_req, res) => {
    const products = await prisma.product.findMany({ orderBy: { updatedAt: "desc" } });
    res.json({ data: products.map(presentProduct) });
  }),
);

productsRouter.post(
  "/admin/import-catalogue",
  requireAdmin,
  handler(async (_req, res) => {
    const { added, imagesUpdated } = await syncCatalogue();
    const parts = [];
    if (added) parts.push(`${added} product(s) added from the starter catalogue`);
    if (imagesUpdated) parts.push(`${imagesUpdated} product photo(s) updated`);
    res.json({
      message: parts.length ? `${parts.join(", ")}.` : "All starter catalogue products are already in the catalogue.",
      added,
      imagesUpdated,
    });
  }),
);

productsRouter.get(
  "/admin/orders",
  requireAdmin,
  handler(async (req, res) => {
    const status = String(req.query.status ?? "");
    const orders = await prisma.productOrder.findMany({
      where: (ORDER_STATUSES as readonly string[]).includes(status) ? { status: status as never } : {},
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ data: orders.map(presentOrder) });
  }),
);

productsRouter.patch(
  "/admin/orders/:id",
  requireAdmin,
  handler(async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!(ORDER_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, "Unknown order status.");
    if (!isUuid(req.params.id)) throw notFound("Order not found");
    await updateOrderStatus(req.params.id, status);
    res.json({ message: "Order updated", status });
  }),
);

productsRouter.post(
  "/",
  requireAdmin,
  imageUpload,
  handler(async (req, res) => {
    const { out, errors } = readProductFields(req.body ?? {}, { partial: false });
    const invalid =
      errors[0] ??
      discountError({ price: out.price!, taxRate: out.taxRate ?? 18, discountType: out.discountType ?? "none", discountValue: out.discountValue ?? 0 });
    const imageUrl = req.file ? UPLOAD_PREFIX + req.file.filename : "";
    if (invalid) {
      removeUploadedImage(imageUrl);
      throw badRequest(errors.length ? errors : [invalid]);
    }
    try {
      const product = await prisma.product.create({ data: { ...(out as Required<typeof out>), division: out.division as never, imageUrl } });
      res.status(201).json(presentProduct(product));
    } catch (e) {
      removeUploadedImage(imageUrl);
      if (duplicateSku(e)) throw new HttpError(409, `A product with model / SKU "${out.sku}" already exists.`);
      throw e;
    }
  }),
);

productsRouter.put(
  "/:id",
  requireAdmin,
  imageUpload,
  handler(async (req, res) => {
    const newImage = req.file ? UPLOAD_PREFIX + req.file.filename : null;
    try {
      const id = String(req.params.id);
      const product = isUuid(id) ? await prisma.product.findUnique({ where: { id } }) : null;
      if (!product) throw notFound("Product not found");
      const { out, errors } = readProductFields(req.body ?? {}, { partial: true, currentTaxRate: Number(product.taxRate) });
      if (errors.length) throw badRequest(errors);
      const merged = {
        price: out.price ?? Number(product.price),
        taxRate: out.taxRate ?? Number(product.taxRate),
        discountType: out.discountType ?? (product.discountType as DiscountType),
        discountValue: out.discountValue ?? Number(product.discountValue),
      };
      const invalid = discountError(merged);
      if (invalid) throw badRequest([invalid]);
      const removeImage = req.body?.removeImage === "true" || req.body?.removeImage === true;
      const imageUrl = newImage ?? (removeImage ? "" : undefined);
      const updated = await prisma.product.update({ where: { id }, data: { ...out, division: out.division as never, ...(imageUrl !== undefined && { imageUrl }) } });
      if (imageUrl !== undefined && product.imageUrl !== imageUrl) removeUploadedImage(product.imageUrl);
      res.json(presentProduct(updated));
    } catch (e) {
      removeUploadedImage(newImage);
      if (duplicateSku(e)) throw new HttpError(409, "Another product already uses this model / SKU.");
      throw e;
    }
  }),
);

/** Adds to or removes from stock without overwriting concurrent order reservations. */
productsRouter.patch(
  "/:id/stock",
  requireAdmin,
  handler(async (req, res) => {
    const change = Number(req.body?.change);
    if (!Number.isInteger(change) || change === 0) throw new HttpError(400, "Enter a whole number to add (e.g. 10) or remove (e.g. -2).");
    const id = String(req.params.id);
    if (!isUuid(id)) throw notFound("Product not found");
    const r = await prisma.product.updateMany({
      where: { id, ...(change < 0 && { stock: { gte: -change } }) },
      data: { stock: { increment: change } },
    });
    if (r.count === 0) {
      const exists = await prisma.product.count({ where: { id } });
      throw exists ? new HttpError(400, "Cannot remove more units than are in stock.") : notFound("Product not found");
    }
    res.json(presentProduct((await prisma.product.findUnique({ where: { id } }))!));
  }),
);

productsRouter.delete(
  "/:id",
  requireAdmin,
  handler(async (req, res) => {
    const id = String(req.params.id);
    if (!isUuid(id)) throw notFound("Product not found");
    const product = await prisma.product.delete({ where: { id } }).catch(() => null);
    if (!product) throw notFound("Product not found");
    removeUploadedImage(product.imageUrl);
    res.json({ message: `${product.name} deleted` });
  }),
);

// ---------------- Public ----------------

productsRouter.get(
  "/",
  handler(async (req, res) => {
    // Optional ?division=electronics|electrical|industrial|home-automation for the section pages.
    const division = isDivision(req.query.division) ? req.query.division : undefined;
    const products = await prisma.product.findMany({
      where: { isActive: true, ...(division && { division: divisionToDb(division) as never }) },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    res.json({ data: products.map(presentProduct) });
  }),
);

productsRouter.post(
  "/orders",
  handler(async (req, res) => {
    const result = await placeOrder(req.body ?? {});
    res.status(201).json({ message: "Order request received", ...result });
  }),
);

productsRouter.get(
  "/:id",
  handler(async (req, res) => {
    const id = String(req.params.id);
    const product = isUuid(id) ? await prisma.product.findFirst({ where: { id, isActive: true } }) : null;
    if (!product) throw notFound("Product not found");
    res.json(presentProduct(product));
  }),
);
