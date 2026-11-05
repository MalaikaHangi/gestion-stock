import mysql from "mysql2/promise";
import { mysqlConfig } from "../lib/mysql-config.mjs";
if (process.env.MYSQL_PROVISION_PRIVILEGES === "1") {
  const database = process.env.MYSQL_DATABASE,
    user = process.env.MYSQL_USER,
    password = process.env.MYSQL_PASSWORD;
  if (
    !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(database || "") ||
    !/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(user || "") ||
    !password
  )
    throw Error("Compte MySQL applicatif invalide.");
  const db = await mysql.createConnection(mysqlConfig(process.env, true));
  try {
    const [[locked]] = await db.execute("SELECT GET_LOCK(?,60) acquired", [
      "stock-api-grants:" + database,
    ]);
    if (locked.acquired !== 1) throw Error("LOCK_TIMEOUT");
    const [done] = await db.query(
      "SELECT name FROM schema_migrations WHERE name='_api_privileges_v1'",
    );
    if (done.length) {
      console.log("Droits API déjà configurés.");
      await db.end();
      process.exit(0);
    }
    const account = db.escape(user) + "@'%'";
    const scope = "`" + database + "`";
    await db.query(
      "CREATE USER IF NOT EXISTS " + account + " IDENTIFIED BY ?",
      [password],
    );
    try {
      await db.query(
        "REVOKE ALL PRIVILEGES ON " + scope + ".* FROM " + account,
      );
    } catch (error) {
      if (error.code !== "ER_NONEXISTING_GRANT") throw error;
    }
    for (const table of [
      "users",
      "sessions",
      "login_attempts",
      "categories",
      "units",
      "warehouses",
      "locations",
      "partners",
      "products",
      "documents",
      "document_lines",
      "app_settings",
    ])
      await db.query(
        "GRANT SELECT,INSERT,UPDATE,DELETE ON " +
          scope +
          ".`" +
          table +
          "` TO " +
          account,
      );
    for (const table of ["ledger", "stock_balances"])
      await db.query(
        "GRANT SELECT ON " + scope + ".`" + table + "` TO " + account,
      );
    await db.query("GRANT SELECT,INSERT ON " + scope + ".audit TO " + account);
    await db.query("GRANT EXECUTE ON " + scope + ".* TO " + account);
    await db.query(
      "INSERT INTO schema_migrations(name) VALUES ('_api_privileges_v1')",
    );
    console.log("Droits du compte API configurés.");
  } catch (error) {
    throw Error(
      "Configuration des droits MySQL impossible (" +
        (error.code || "CONFIGURATION") +
        ").",
    );
  } finally {
    await db.end();
  }
}
