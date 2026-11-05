import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { INBOX_STATUSES } from "@voltex/shared";
import { prisma } from "../db.ts";
import { HttpError, badRequest, handler, isUuid, notFound } from "../lib/http.ts";
import { requireAdmin } from "../middleware/auth.ts";
import { SESSION_COOKIE, authenticate, cookieOptions, signSession } from "../services/auth.ts";

export const adminRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many sign-in attempts. Try again in 15 minutes." },
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter your admin email."),
  password: z.string().min(1, "Enter your password.").max(200),
});

adminRouter.post(
  "/login",
  loginLimiter,
  handler(async (req, res) => {
    const r = loginSchema.safeParse(req.body ?? {});
    if (!r.success) throw badRequest(r.error.issues.map((i) => i.message));
    const user = await authenticate(r.data.email, r.data.password);
    if (!user) throw new HttpError(401, "Email or password is incorrect.");
    res.cookie(SESSION_COOKIE, signSession(user), cookieOptions());
    res.json({ user: { email: user.email, name: user.name } });
  }),
);

adminRouter.post("/logout", (_req, res) => {
  const { maxAge: _m, ...opts } = cookieOptions();
  res.clearCookie(SESSION_COOKIE, opts);
  res.json({ message: "Signed out" });
});

adminRouter.get(
  "/me",
  requireAdmin,
  handler(async (req, res) => {
    const user = await prisma.adminUser.findUnique({ where: { id: req.admin!.sub }, select: { email: true, name: true, lastLoginAt: true } });
    if (!user) throw new HttpError(401, "Please sign in as an administrator.");
    res.json({ user });
  }),
);

/** Numbers for the dashboard cards. */
adminRouter.get(
  "/summary",
  requireAdmin,
  handler(async (_req, res) => {
    const [products, hidden, outOfStock, lowStock, pendingOrders, orders, newIdeas, newMessages] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isActive: false } }),
      prisma.product.count({ where: { stock: { lte: 0 } } }),
      prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count FROM "Product" WHERE stock > 0 AND stock <= "lowStockThreshold"`,
      prisma.productOrder.count({ where: { status: "pending" } }),
      prisma.productOrder.aggregate({ _count: true, _sum: { grandTotal: true }, where: { status: { not: "cancelled" } } }),
      prisma.ideaSubmission.count({ where: { status: "new" } }),
      prisma.contactMessage.count({ where: { status: "new" } }),
    ]);
    res.json({
      products,
      hidden,
      outOfStock,
      lowStock: Number(lowStock[0]?.count ?? 0),
      pendingOrders,
      orderCount: orders._count,
      orderValue: Number(orders._sum.grandTotal ?? 0),
      newIdeas,
      newMessages,
    });
  }),
);

// ---------------- Inboxes: idea submissions and contact messages ----------------

const inbox = (kind: "ideas" | "messages") => {
  const model = (kind === "ideas" ? prisma.ideaSubmission : prisma.contactMessage) as unknown as {
    findMany(a: unknown): Promise<unknown[]>;
    update(a: unknown): Promise<unknown>;
    delete(a: unknown): Promise<unknown>;
  };
  adminRouter.get(
    `/${kind}`,
    requireAdmin,
    handler(async (req, res) => {
      const status = String(req.query.status ?? "");
      const where = (INBOX_STATUSES as readonly string[]).includes(status) ? { status } : { status: { not: "archived" } };
      res.json({ data: await model.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 }) });
    }),
  );
  adminRouter.patch(
    `/${kind}/:id`,
    requireAdmin,
    handler(async (req, res) => {
      const status = String(req.body?.status ?? "");
      if (!(INBOX_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, "Unknown status.");
      if (!isUuid(req.params.id)) throw notFound();
      const item = await model.update({ where: { id: req.params.id }, data: { status } }).catch(() => null);
      if (!item) throw notFound();
      res.json({ data: item });
    }),
  );
  adminRouter.delete(
    `/${kind}/:id`,
    requireAdmin,
    handler(async (req, res) => {
      if (!isUuid(req.params.id)) throw notFound();
      const item = await model.delete({ where: { id: req.params.id } }).catch(() => null);
      if (!item) throw notFound();
      res.json({ message: "Deleted" });
    }),
  );
};
inbox("ideas");
inbox("messages");
