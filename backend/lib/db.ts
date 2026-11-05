import mysql from "mysql2/promise";
import type { PoolConnection } from "mysql2";
const globalDb = globalThis as unknown as { stockPool?: mysql.Pool };
export function db() {
  if (!process.env.MYSQL_URL) throw new Error("MYSQL_URL non configurée");
  if (globalDb.stockPool) return globalDb.stockPool;
  const pool = mysql.createPool({
    uri: process.env.MYSQL_URL,
    connectionLimit: 5,
    decimalNumbers: false,
    timezone: "Z",
    ...(process.env.MYSQL_SSL_CA
      ? {
          ssl: {
            ca: process.env.MYSQL_SSL_CA.replace(/\\n/g, "\n"),
            rejectUnauthorized: true,
          },
        }
      : {}),
  });
  pool.pool.on("connection", (connection: PoolConnection) => {
    connection.query("SET time_zone = '+00:00'", (error) => {
      if (error) connection.destroy();
    });
  });
  globalDb.stockPool = pool;
  return pool;
}
