import type { NextFunction, Request, RequestHandler, Response } from "express";

/** An error with an HTTP status and a message that is safe to show to the user. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const badRequest = (errors: string[]) => new HttpError(400, errors[0] ?? "Invalid request", { errors });
export const notFound = (what = "Not found") => new HttpError(404, what);

/** Express 5 forwards rejected promises to the error handler; this keeps handler signatures tidy. */
export const handler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown): RequestHandler =>
  async (req, res, next) => {
    await fn(req, res, next);
  };

/** UUID check so malformed ids answer 404 instead of a database error. */
export const isUuid = (id: unknown): id is string =>
  typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v).trim());
