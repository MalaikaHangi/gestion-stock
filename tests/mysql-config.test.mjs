import test from "node:test";
import assert from "node:assert/strict";
import { mysqlConfig } from "../backend/lib/mysql-config.mjs";
test("La connexion privée Render sépare les comptes API et migration sans interpoler de secret dans une URL", () => {
  const env = {
    MYSQL_HOST: "mysql.internal",
    MYSQL_DATABASE: "stock",
    MYSQL_USER: "stock_api",
    MYSQL_PASSWORD: "test-app-secret",
    MYSQL_ROOT_PASSWORD: "test-root-secret",
  };
  assert.equal(mysqlConfig(env).user, "stock_api");
  assert.equal(mysqlConfig(env, true).user, "root");
  assert.equal(mysqlConfig(env, true).password, "test-root-secret");
  assert.equal(
    mysqlConfig({ ...env, MYSQL_URL: "mysql://example.invalid/stock" }).uri,
    "mysql://example.invalid/stock",
  );
  assert.throws(() => mysqlConfig({}));
  assert.throws(() => mysqlConfig({ ...env, MYSQL_PORT: "incorrect" }));
});
