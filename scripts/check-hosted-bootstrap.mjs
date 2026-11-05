// Creates and removes a uniquely named disposable database; never uses an existing schema.
import mysql from "../backend/node_modules/mysql2/promise.js";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
if (process.argv.includes("--local-development")) {
  const credentials = JSON.parse(
    await readFile(".local/credentials.json", "utf8"),
  );
  process.env.MYSQL_TEST_ADMIN_URL = `mysql://root:${credentials.root}@127.0.0.1:3307/gestion_stock_test`;
}
if (!process.env.MYSQL_TEST_ADMIN_URL)
  throw Error("MYSQL_TEST_ADMIN_URL requis pour ce contrôle isolé.");
const admin = await mysql.createConnection(process.env.MYSQL_TEST_ADMIN_URL);
const name = "stock_ci_" + randomBytes(8).toString("hex");
const uri = new URL(process.env.MYSQL_TEST_ADMIN_URL);
uri.pathname = "/" + name;
const env = {
  ...process.env,
  MYSQL_URL: uri.toString(),
  MYSQL_MIGRATION_URL: uri.toString(),
  ADMIN_EMAIL: "admin@example.invalid",
  ADMIN_PASSWORD: randomBytes(24).toString("hex"),
  MANAGER_EMAIL: "manager@example.invalid",
  MANAGER_PASSWORD: randomBytes(24).toString("hex"),
  MYSQL_HOST: uri.hostname,
  MYSQL_PORT: uri.port || "3306",
  MYSQL_DATABASE: name,
  MYSQL_USER: "api_ci_" + randomBytes(6).toString("hex"),
  MYSQL_PASSWORD: randomBytes(24).toString("hex"),
  MYSQL_PROVISION_PRIVILEGES: "1",
};
async function run(file) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL("../backend/scripts/" + file, import.meta.url))],
      { env, stdio: "inherit", windowsHide: true },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error("Échec du contrôle : " + file)),
    );
  });
}
try {
  await admin.query("CREATE DATABASE `" + name + "` CHARACTER SET utf8mb4");
  await run("migrate.mjs");
  await run("provision-db-user.mjs");
  await run("bootstrap.mjs");
  const [before] = await admin.query(
    "SELECT email,password_hash FROM `" + name + "`.users ORDER BY email",
  );
  await run("migrate.mjs");
  await run("provision-db-user.mjs");
  await run("bootstrap.mjs");
  const [after] = await admin.query(
    "SELECT email,password_hash FROM `" + name + "`.users ORDER BY email",
  );
  if (JSON.stringify(before) !== JSON.stringify(after) || after.length !== 2)
    throw Error("Le redéploiement a modifié les comptes.");
  const app = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT),
    database: name,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
  });
  try {
    await app.query("SELECT id FROM users LIMIT 1");
    let denied = 0;
    for (const sql of [
      "UPDATE ledger SET quantity=quantity WHERE id=0",
      "DELETE FROM audit WHERE id=0",
      "CREATE TABLE forbidden (id INT)",
    ]) {
      try {
        await app.query(sql);
      } catch (error) {
        if (error.code === "ER_TABLEACCESS_DENIED_ERROR") denied++;
        else throw error;
      }
    }
    if (denied !== 3) throw Error("Droits API trop larges.");
  } finally {
    await app.end();
  }
  console.log(
    "Base vierge : toutes les migrations appliquées. Second lancement : données et mots de passe conservés.",
  );
} finally {
  if (!/^stock_ci_[a-f0-9]{16}$/.test(name)) throw Error("Nettoyage refusé");
  await admin.query("DROP DATABASE `" + name + "`");
  await admin.query(
    "DROP USER IF EXISTS " + admin.escape(env.MYSQL_USER) + "@'%'",
  );
  await admin.end();
}
