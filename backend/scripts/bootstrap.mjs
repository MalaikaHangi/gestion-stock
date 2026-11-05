// One-time hosted bootstrap. Repeated deploys never overwrite an existing user.
import mysql from "mysql2/promise";
import { scryptSync, randomBytes } from "node:crypto";
import { mysqlConfig } from "../lib/mysql-config.mjs";
const db = await mysql.createConnection({
  ...mysqlConfig(process.env, true),
});
try {
  const [[database]] = await db.query("SELECT DATABASE() name");
  const [[lock]] = await db.execute("SELECT GET_LOCK(?,60) acquired", [
    "stock-bootstrap:" + database.name,
  ]);
  if (lock.acquired !== 1) throw Error("Initialisation déjà en cours.");
  for (const [prefix, role, label] of [
    ["ADMIN", "admin", "Administrateur"],
    ["MANAGER", "manager", "Responsable"],
  ]) {
    const email = process.env[prefix + "_EMAIL"],
      password = process.env[prefix + "_PASSWORD"];
    if (!email && !password) continue;
    if (!email || !password || password.length < 12)
      throw Error(
        prefix + " : e-mail et mot de passe de 12 caractères minimum requis.",
      );
    const [exists] = await db.execute("SELECT id FROM users WHERE email=?", [
      email,
    ]);
    if (exists.length) {
      console.log(label + " déjà présent ; compte conservé.");
      continue;
    }
    const salt = randomBytes(16).toString("hex");
    await db.execute(
      "INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)",
      [
        label,
        email,
        salt + ":" + scryptSync(password, salt, 64).toString("hex"),
        role,
      ],
    );
    console.log(label + " initialisé.");
  }
  const [[admins]] = await db.query(
    "SELECT COUNT(*) total FROM users WHERE active=1 AND role='admin'",
  );
  if (!admins.total)
    throw Error(
      "Aucun administrateur : configurez ADMIN_EMAIL et ADMIN_PASSWORD avant le premier déploiement.",
    );
} finally {
  await db.end();
}
