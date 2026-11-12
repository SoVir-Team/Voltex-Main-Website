import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { config } from "./config.ts";
import { prisma } from "./db.ts";
import { HttpError } from "./lib/http.ts";
import { productsRouter } from "./routes/products.ts";
import { enquiriesRouter } from "./routes/enquiries.ts";
import { adminRouter } from "./routes/admin.ts";
import { labRouter } from "./routes/lab.ts";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.TRUST_PROXY);

  if (config.NODE_ENV !== "test") app.use(pinoHttp({ autoLogging: { ignore: (req) => req.url === "/api/health" } }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "200kb" }));
  app.use(express.urlencoded({ extended: false, limit: "200kb" }));
  app.use(cookieParser());

  // Public form endpoints get a modest rate limit; reads are cheap and cached by the site.
  const formLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: config.NODE_ENV === "test" ? 1000 : 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again in a few minutes." },
  });

  app.get("/api/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "db_unavailable" });
    }
  });

  app.use("/api/uploads", express.static(path.join(config.uploadDir), { maxAge: "7d", index: false, dotfiles: "deny" }));
  app.use("/api/products/orders", (req, res, next) => (req.method === "POST" ? formLimiter(req, res, next) : next()));
  app.use("/api/products", productsRouter);
  app.use("/api", formLimiter, enquiriesRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/lab", labRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ message: err.message, ...err.extra });
      return;
    }
    if (err && typeof err === "object" && "type" in err && err.type === "entity.parse.failed") {
      res.status(400).json({ message: "Request body is not valid JSON." });
      return;
    }
    req.log?.error({ err }, "Unhandled error");
    if (!req.log) console.error(err);
    res.status(500).json({ message: "Server error" });
  });

  return app;
}
