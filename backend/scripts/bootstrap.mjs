import pg from "pg";
import { scryptSync, randomBytes } from "node:crypto";
import { postgresConfig } from "../lib/postgres.mjs";
const client = new pg.Client(postgresConfig(process.env, true));
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('stockmaster-bootstrap'))",
  );
  for (const [prefix, role, name] of [
    ["ADMIN", "admin", "Administrateur"],
    ["MANAGER", "manager", "Responsable"],
  ]) {
    const email = process.env[prefix + "_EMAIL"],
      password = process.env[prefix + "_PASSWORD"];
    if (!email && !password) continue;
    if (!email || !password || password.length < 12)
      throw Error("Identifiants initiaux incomplets : " + prefix);
    const { rows } = await client.query(
      "SELECT id FROM users WHERE lower(email)=lower($1)",
      [email],
    );
    if (rows.length) continue;
    const salt = randomBytes(16).toString("hex");
    await client.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4)",
      [
        name,
        email,
        salt + ":" + scryptSync(password, salt, 64).toString("hex"),
        role,
      ],
    );
    console.log(name + " initialisé.");
  }
  const { rows } = await client.query(
    "SELECT id FROM users WHERE role='admin' AND active=1 LIMIT 1",
  );
  if (!rows.length)
    throw Error(
      "Configurez ADMIN_EMAIL et ADMIN_PASSWORD pour le premier lancement.",
    );
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw Error(
    "Initialisation interrompue (" + (error.code || error.message) + ").",
  );
} finally {
  await client.end();
}
