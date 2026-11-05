import assert from "node:assert/strict";
import { test } from "node:test";
import { assertTestDatabaseUrl, resolveTestDatabaseUrl } from "./database-url.mjs";

const database = "postgresql://localhost:5432/voltex_test";
const otherDatabase = "postgresql://localhost:5432/another_test";

test("an explicit test database takes precedence over other configuration", () => {
  assert.equal(resolveTestDatabaseUrl({ TEST_DATABASE_URL: database, DATABASE_URL: otherDatabase }, {
    TEST_DATABASE_URL: otherDatabase,
  }), database);
});

test("local development reads the dedicated test database from the local file", () => {
  assert.equal(resolveTestDatabaseUrl({ DATABASE_URL: "postgresql://localhost/voltex" }, {
    TEST_DATABASE_URL: database,
  }), database);
});

test("CI uses its explicit database instead of a developer's local file", () => {
  assert.equal(resolveTestDatabaseUrl({ CI: "true", DATABASE_URL: database }, {
    TEST_DATABASE_URL: otherDatabase,
  }), database);
});

test("CI also gives its explicit test database precedence", () => {
  assert.equal(resolveTestDatabaseUrl({ CI: "true", TEST_DATABASE_URL: database, DATABASE_URL: otherDatabase }, {
    TEST_DATABASE_URL: otherDatabase,
  }), database);
});

test("CI cannot silently fall back to a developer's local test database", () => {
  assert.throws(() => resolveTestDatabaseUrl({ CI: "true" }, { TEST_DATABASE_URL: database }), /Set TEST_DATABASE_URL/);
});

test("CI cannot bypass the database name guard", () => {
  assert.throws(() => resolveTestDatabaseUrl({ CI: "true", DATABASE_URL: "postgresql://localhost/voltex" }), /database name/);
});

test("an explicitly supplied dedicated DATABASE_URL is supported", () => {
  assert.equal(resolveTestDatabaseUrl({ DATABASE_URL: database }), database);
});

test("CI=false retains local development configuration", () => {
  assert.equal(resolveTestDatabaseUrl({ CI: "false" }, { TEST_DATABASE_URL: database }), database);
});

test("missing and empty database settings fail before connecting", () => {
  assert.throws(() => assertTestDatabaseUrl(undefined), /Set TEST_DATABASE_URL/);
  assert.throws(() => assertTestDatabaseUrl(""), /Set TEST_DATABASE_URL/);
});

test("malformed URLs and non-PostgreSQL protocols are rejected", () => {
  assert.throws(() => assertTestDatabaseUrl("not a url"), /valid PostgreSQL/);
  assert.throws(() => assertTestDatabaseUrl("https://localhost/voltex_test"), /protocol/);
  assert.throws(() => assertTestDatabaseUrl("postgresql://localhost/%ZZ_test"), /valid PostgreSQL/);
});

test("a test marker in credentials, hostname, query or fragment cannot authorize truncation", () => {
  for (const unsafeUrl of [
    "postgresql://test_user@localhost/voltex",
    "postgresql://user:test_password@localhost/voltex",
    "postgresql://test.example.com/voltex",
    "postgresql://localhost/voltex?schema=test",
    "postgresql://localhost/voltex#test",
  ]) {
    assert.throws(() => assertTestDatabaseUrl(unsafeUrl), /database name/);
  }
});

test("the parsed database name must be present and cannot contain another path", () => {
  assert.throws(() => assertTestDatabaseUrl("postgresql://localhost/?schema=test"), /database name/);
  assert.throws(() => assertTestDatabaseUrl("postgresql://localhost/test/production"), /database name/);
  assert.throws(() => assertTestDatabaseUrl("postgresql://localhost/test%2Fproduction"), /database name/);
});

test("valid PostgreSQL variants and encoded database names are accepted", () => {
  for (const safeUrl of [database, "postgres://localhost/VOLTEX_TEST", "postgresql://localhost/voltex_%74est"]) {
    assert.equal(assertTestDatabaseUrl(safeUrl), safeUrl);
  }
});

test("validation errors do not expose credentials", () => {
  const credential = "private-database-password";
  assert.throws(() => assertTestDatabaseUrl(`postgresql://user:${credential}@localhost/production`), (error) => {
    assert.equal(error.message.includes(credential), false);
    assert.equal(error.message.includes("postgresql://"), false);
    return true;
  });
});
