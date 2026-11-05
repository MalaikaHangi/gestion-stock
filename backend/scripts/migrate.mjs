import mysql from "mysql2/promise";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { splitStatements } from "./sql-statements.mjs";
import { mysqlConfig } from "../lib/mysql-config.mjs";
const connection = await mysql.createConnection({
  ...mysqlConfig(process.env, true),
  multipleStatements: true,
});
let lock;
try {
  const [[database]] = await connection.query("SELECT DATABASE() name");
  lock = "stock-migrate:" + database.name;
  const [[locked]] = await connection.execute(
    "SELECT GET_LOCK(?,60) acquired",
    [lock],
  );
  if (locked.acquired !== 1) throw Error("Une autre migration est en cours.");
  await connection.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
  );
  await connection.query(
    "CREATE TABLE IF NOT EXISTS schema_migration_steps (name VARCHAR(190) NOT NULL,step INT NOT NULL,checksum CHAR(64) NOT NULL,PRIMARY KEY(name,step))",
  );
  for (const file of (await readdir(new URL("../../sql/", import.meta.url)))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const [rows] = await connection.execute(
      "SELECT name FROM schema_migrations WHERE name=?",
      [file],
    );
    if (rows.length) continue;
    const sql = await readFile(
      new URL("../../sql/" + file, import.meta.url),
      "utf8",
    );
    const statements = sql.includes("DELIMITER $$")
      ? sql
          .split("DELIMITER $$")[1]
          .split("DELIMITER ;")[0]
          .split("$$")
          .map((s) => s.trim())
          .filter(Boolean)
      : splitStatements(sql);
    for (let step = 0; step < statements.length; step++) {
      const statement = statements[step];
      const hash = createHash("sha256").update(statement).digest("hex");
      const [done] = await connection.execute(
        "SELECT checksum FROM schema_migration_steps WHERE name=? AND step=?",
        [file, step],
      );
      if (done[0]) {
        if (done[0].checksum !== hash)
          throw Error("Migration partielle modifiée : " + file);
        continue;
      }
      await connection.query(statement);
      await connection.execute(
        "INSERT INTO schema_migration_steps(name,step,checksum) VALUES(?,?,?)",
        [file, step, hash],
      );
    }
    await connection.execute("INSERT INTO schema_migrations(name) VALUES (?)", [
      file,
    ]);
    console.log("Migration appliquée :", file);
  }
} finally {
  if (lock)
    await connection.execute("SELECT RELEASE_LOCK(?)", [lock]).catch(() => {});
  await connection.end();
}
