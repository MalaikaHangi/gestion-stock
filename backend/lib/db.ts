import mysql from "mysql2/promise";
import type { PoolConnection } from "mysql2";
import { mysqlConfig } from "./mysql-config.mjs";
const globalDb = globalThis as unknown as { stockPool?: mysql.Pool };
export function db() {
  if (globalDb.stockPool) return globalDb.stockPool;
  const pool = mysql.createPool({
    ...mysqlConfig(),
    connectionLimit: 5,
    decimalNumbers: false,
    timezone: "Z",
  });
  pool.pool.on("connection", (connection: PoolConnection) => {
    connection.query("SET time_zone = '+00:00'", (error) => {
      if (error) connection.destroy();
    });
  });
  globalDb.stockPool = pool;
  return pool;
}
