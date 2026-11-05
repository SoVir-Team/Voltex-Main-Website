import type { NextFunction, Request, Response } from "express";
import { config } from "../config.ts";
import { SESSION_COOKIE, verifySession, type Session } from "../services/auth.ts";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: Session;
    }
  }
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Rejects anyone without a valid admin session cookie. For state-changing requests it also checks the
 * Origin header against the site's own origin, as a CSRF guard on top of the SameSite=Lax cookie.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = verifySession(req.cookies?.[SESSION_COOKIE] ?? "");
  if (!session) {
    res.status(401).json({ message: "Please sign in as an administrator." });
    return;
  }
  if (!SAFE.has(req.method)) {
    const origin = req.get("origin");
    if (origin && !config.corsOrigins.includes(origin)) {
      res.status(403).json({ message: "Request origin not allowed." });
      return;
    }
  }
  req.admin = session;
  next();
}
