/**
 * Select a dedicated test database without letting a developer's local file
 * override the database explicitly supplied by a CI job.
 * @param {Record<string, string | undefined>} environment
 * @param {Record<string, string | undefined>} local
 */
export function resolveTestDatabaseUrl(environment, local = {}) {
  const inCi = Boolean(environment.CI && environment.CI !== "false");
  const databaseUrl = environment.TEST_DATABASE_URL
    ?? (inCi ? environment.DATABASE_URL : local.TEST_DATABASE_URL ?? environment.DATABASE_URL);

  return assertTestDatabaseUrl(databaseUrl);
}

/**
 * Integration tests truncate tables: validate the actual PostgreSQL database
 * name before migrations or connections, including when running in CI.
 * Errors deliberately omit the URL because it can contain credentials.
 * @param {string | undefined} databaseUrl
 * @returns {string}
 */
export function assertTestDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("Set TEST_DATABASE_URL to a dedicated PostgreSQL database whose name contains 'test'.");
  }

  let parsed;
  let databaseName;
  try {
    parsed = new URL(databaseUrl);
    databaseName = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error("The test database URL must be a valid PostgreSQL connection URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error("The test database URL must use the postgres or postgresql protocol.");
  }

  if (!databaseName || databaseName.includes("/") || !/test/i.test(databaseName)) {
    throw new Error("Refusing integration tests: the PostgreSQL database name must contain 'test'.");
  }

  return databaseUrl;
}
