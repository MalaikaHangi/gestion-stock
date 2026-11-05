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
  await run("bootstrap.mjs");
  const [before] = await admin.query(
    "SELECT email,password_hash FROM `" + name + "`.users ORDER BY email",
  );
  await run("migrate.mjs");
  await run("bootstrap.mjs");
  const [after] = await admin.query(
    "SELECT email,password_hash FROM `" + name + "`.users ORDER BY email",
  );
  if (JSON.stringify(before) !== JSON.stringify(after) || after.length !== 2)
    throw Error("Le redéploiement a modifié les comptes.");
  console.log(
    "Base vierge : toutes les migrations appliquées. Second lancement : données et mots de passe conservés.",
  );
} finally {
  if (!/^stock_ci_[a-f0-9]{16}$/.test(name)) throw Error("Nettoyage refusé");
  await admin.query("DROP DATABASE `" + name + "`");
  await admin.end();
}
