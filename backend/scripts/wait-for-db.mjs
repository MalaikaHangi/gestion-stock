import mysql from "mysql2/promise";
import { mysqlConfig } from "../lib/mysql-config.mjs";
for (let attempt = 0; attempt < 60; attempt++) {
  let connection;
  try {
    connection = await mysql.createConnection(mysqlConfig(process.env, true));
    await connection.query("SELECT 1");
    await connection.end();
    console.log("MySQL disponible.");
    break;
  } catch (error) {
    await connection?.end().catch(() => {});
    if (
      ![
        "ECONNREFUSED",
        "ENOTFOUND",
        "EAI_AGAIN",
        "ETIMEDOUT",
        "PROTOCOL_CONNECTION_LOST",
        "ER_BAD_DB_ERROR",
      ].includes(error.code) ||
      attempt === 59
    )
      throw Error(
        "Connexion MySQL impossible (" + (error.code || "CONFIGURATION") + ").",
      );
    if (attempt % 10 === 0) console.log("Attente de MySQL…");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
