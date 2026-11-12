import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.ts";
import { badRequest, handler } from "../lib/http.ts";
import { checkSources, compile, compilerAvailable } from "../services/compiler.ts";

export const labRouter = Router();

// A compile is a few seconds of CPU: generous for a class, tight for a script.
const compileLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.NODE_ENV === "test" ? 1000 : 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many compiles in a minute. Wait a moment and try again." },
});

const compileSchema = z.object({
  board: z.enum(["uno", "pico"]),
  files: z
    .array(z.object({ name: z.string().max(60), content: z.string().max(70_000) }))
    .min(1)
    .max(12),
});

labRouter.get("/compiler", (_req, res) => {
  res.json({ available: compilerAvailable(), boards: ["uno", "pico"] });
});

labRouter.post(
  "/compile",
  compileLimiter,
  handler(async (req, res) => {
    const parsed = compileSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message));
    const problems = checkSources(parsed.data.files);
    if (problems.length) throw badRequest(problems);
    res.json(await compile(parsed.data.board, parsed.data.files));
  }),
);
