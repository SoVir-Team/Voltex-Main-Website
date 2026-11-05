import catalogue from "../data/catalogue.json" with { type: "json" };
import { prisma } from "../db.ts";

const SEED_MARKER = "starterCatalogueSeeded";

type Item = (typeof catalogue)[number];
const toData = (p: Item) => ({
  name: p.name,
  sku: p.sku,
  brand: p.brand,
  division: p.division as "electronics" | "electrical" | "industrial",
  category: p.category,
  description: p.description,
  hsnCode: p.hsnCode,
  unit: p.unit,
  imageUrl: p.imageUrl,
  price: p.price,
  taxRate: p.taxRate,
  stock: p.stock,
  lowStockThreshold: p.lowStockThreshold,
  isActive: p.isActive,
});

/**
 * Adds catalogue products whose SKU is not in the database yet, and refreshes starter images
 * (files under /images/products/) to the current ones. Admin edits and uploaded photos are never overwritten.
 */
export async function syncCatalogue() {
  const existing = new Set((await prisma.product.findMany({ select: { sku: true } })).map((p) => p.sku));
  const missing = catalogue.filter((p) => !existing.has(p.sku));
  const added = missing.length ? (await prisma.product.createMany({ data: missing.map(toData), skipDuplicates: true })).count : 0;

  let imagesUpdated = 0;
  for (const p of catalogue) {
    const r = await prisma.product.updateMany({
      where: { sku: p.sku, imageUrl: { startsWith: "/images/products/", not: p.imageUrl } },
      data: { imageUrl: p.imageUrl },
    });
    imagesUpdated += r.count;
  }
  return { added, imagesUpdated };
}

/** Loads the starter catalogue the first time the API runs against a database. A marker stops it re-adding items an admin deletes later. */
export async function autoSeed(log: (msg: string) => void = console.log) {
  const marker = await prisma.appSetting.findUnique({ where: { key: SEED_MARKER } });
  if (marker) return;
  const { added } = await syncCatalogue();
  await prisma.appSetting.upsert({
    where: { key: SEED_MARKER },
    create: { key: SEED_MARKER, value: { at: new Date().toISOString(), added } },
    update: {},
  });
  log(`Starter catalogue loaded: ${added} product(s).`);
}

export const CATALOGUE_SIZE = catalogue.length;
