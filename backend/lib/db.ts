import { createDatabase } from "./postgres.mjs";
import type { Database } from "./postgres.mjs";
const state = globalThis as unknown as { stockPostgres?: Database };
export function db() {
  return (state.stockPostgres ??= createDatabase());
}
export type {
  RowDataPacket,
  ResultSetHeader,
  DatabaseConnection as PoolConnection,
} from "./postgres.mjs";
