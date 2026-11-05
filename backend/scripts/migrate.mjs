import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { postgresConfig } from "../lib/postgres.mjs";
const client = new pg.Client(postgresConfig(process.env, true));
await client.connect();
try {
  await client.query(
    "SELECT pg_advisory_lock(hashtext('stockmaster-migrations'))",
  );
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY,checksum CHAR(64) NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  for (const name of (
    await readdir(new URL("../../sql/postgres/", import.meta.url))
  )
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(
      new URL("../../sql/postgres/" + name, import.meta.url),
      "utf8",
    );
    const hash = createHash("sha256").update(sql).digest("hex");
    const { rows } = await client.query(
      "SELECT checksum FROM schema_migrations WHERE name=$1",
      [name],
    );
    if (rows[0]) {
      if (rows[0].checksum !== hash)
        throw Error("Une migration appliquée a été modifiée : " + name);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, hash],
      );
      await client.query("COMMIT");
      console.log("Migration PostgreSQL appliquée :", name);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} catch (error) {
  throw Error(
    "Migration PostgreSQL interrompue (" + (error.code || error.message) + ").",
  );
} finally {
  await client
    .query("SELECT pg_advisory_unlock(hashtext('stockmaster-migrations'))")
    .catch(() => {});
  await client.end();
}
