// Creates or resets the admin account from ADMIN_EMAIL / ADMIN_PASSWORD.
// Usage: npm run admin:create -w @voltex/api   (on the server: set the two variables first)
import { prisma } from "../db.ts";
import { upsertAdmin } from "../services/auth.ts";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) first.");
  process.exit(1);
}
const admin = await upsertAdmin(email, password);
console.log(`Admin ready: ${admin.email}`);
await prisma.$disconnect();
