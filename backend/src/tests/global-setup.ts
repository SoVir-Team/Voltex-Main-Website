import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import type { TestProject } from "vitest/node";
import { assertTestDatabaseUrl } from "../../test/database-url.mjs";

/** Brings the test database schema up to date before any test file runs. */
export default function setup(project: TestProject) {
  // Use exactly the validated connection supplied to Vitest workers.
  const databaseUrl = assertTestDatabaseUrl(project.config.env.DATABASE_URL);
  const require = createRequire(import.meta.url);
  const prismaCli = path.join(path.dirname(require.resolve("prisma/package.json")), "build/index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
