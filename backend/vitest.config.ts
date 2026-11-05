import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";
import { resolveTestDatabaseUrl } from "./test/database-url.mjs";

// Read local settings without promoting them into process.env. CI must use its
// explicit database configuration, never a developer's local connection.
const local = loadEnv({ path: ".env", quiet: true, processEnv: {} }).parsed ?? {};
const databaseUrl = resolveTestDatabaseUrl(process.env, local);

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      TEST_DATABASE_URL: databaseUrl,
      JWT_SECRET: "test-secret-test-secret-test-secret-test-secret",
      CORS_ORIGIN: "http://localhost:3000",
      UPLOAD_DIR: "./uploads-test",
      AUTO_SEED: "false",
    },
  },
});
