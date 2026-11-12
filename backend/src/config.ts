import path from "node:path";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  UPLOAD_DIR: z.string().default("./uploads"),
  /** Where the app is served from, used for absolute links. */
  SITE_URL: z.string().default("http://localhost:3000"),
  /** Set to "false" to skip loading the starter catalogue on an empty database. */
  AUTO_SEED: z.string().default("true"),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  /** Number of proxies in front of the app (Nginx = 1), so rate limits see the real client IP. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  /** Student Lab compiler: the arduino-cli binary and its data/user directories. Leave unset to disable compiling. */
  ARDUINO_CLI: z.string().optional(),
  ARDUINO_DATA_DIR: z.string().optional(),
  ARDUINO_USER_DIR: z.string().optional(),
  COMPILE_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  COMPILE_CONCURRENCY: z.coerce.number().int().positive().default(2),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  uploadDir: path.resolve(parsed.data.UPLOAD_DIR),
  corsOrigins: parsed.data.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
};
