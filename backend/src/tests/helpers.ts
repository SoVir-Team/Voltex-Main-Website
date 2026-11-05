import request from "supertest";
import { createApp } from "../app.ts";
import { prisma } from "../db.ts";
import { upsertAdmin } from "../services/auth.ts";

export const app = createApp();
export const ADMIN = { email: "admin@test.local", password: "correct-horse-battery-9" };
export const customer = { name: "Asha Rao", email: "asha@example.invalid", phone: "+91 98450 00000", company: "Acme Foods" };

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "OrderItem", "ProductOrder", "Product", "IdeaSubmission", "ContactMessage", "AdminUser", "AppSetting" RESTART IDENTITY CASCADE`,
  );
}

/** A supertest agent that carries a signed-in admin session cookie. */
export async function adminAgent() {
  await upsertAdmin(ADMIN.email, ADMIN.password);
  const agent = request.agent(app);
  const res = await agent.post("/api/admin/login").send(ADMIN);
  if (res.status !== 200) throw new Error(`Admin login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export { request, prisma };
