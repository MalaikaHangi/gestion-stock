import test from "node:test";
import assert from "node:assert/strict";
import { postgresConfig } from "../backend/lib/postgres.mjs";
test("PostgreSQL : TLS vérifié sur la connexion hébergée et connexion de migration distincte", () => {
  const options = postgresConfig({
    DATABASE_URL:
      "postgresql://user:test@example.invalid/stock?sslmode=require",
  });
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.ok(!options.connectionString.includes("sslmode="));
  assert.equal(
    postgresConfig({ DATABASE_URL: "postgresql://localhost/test" }).ssl,
    false,
  );
  assert.equal(
    new URL(
      postgresConfig(
        {
          DATABASE_URL: "postgresql://localhost/app",
          DATABASE_MIGRATION_URL: "postgresql://localhost/migrations",
        },
        true,
      ).connectionString,
    ).pathname,
    "/migrations",
  );
  assert.throws(() => postgresConfig({}));
  assert.throws(() =>
    postgresConfig({ DATABASE_URL: "mysql://localhost/test" }),
  );
});
