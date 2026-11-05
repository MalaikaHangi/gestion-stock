import pg from "pg";
import { postgresConfig } from "../lib/postgres.mjs";
for (let attempt = 0; attempt < 40; attempt++) {
  const client = new pg.Client(postgresConfig(process.env, true));
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    console.log("PostgreSQL disponible.");
    break;
  } catch (error) {
    await client.end().catch(() => {});
    if (attempt === 39 || ["28P01", "28000"].includes(error.code))
      throw Error(
        "Connexion PostgreSQL impossible (" +
          (error.code || "CONNECTION") +
          ").",
      );
    if (attempt % 10 === 0) console.log("Attente de PostgreSQL…");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
