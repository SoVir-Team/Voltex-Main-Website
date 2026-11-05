// Adds any starter-catalogue products that are missing. Safe to run repeatedly.
import { prisma } from "../db.ts";
import { syncCatalogue } from "../services/catalogue.ts";

const { added, imagesUpdated } = await syncCatalogue();
console.log(`Catalogue sync: ${added} added, ${imagesUpdated} image(s) refreshed.`);
await prisma.$disconnect();
