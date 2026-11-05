import type { Pool, PoolConfig } from "pg";
export type RowDataPacket = Record<string, any>;
export type ResultSetHeader = { insertId: number; affectedRows: number };
export interface DatabaseConnection {
  query<T = RowDataPacket[]>(
    sql: string,
    values?: any[],
  ): Promise<[T, unknown]>;
  execute<T = RowDataPacket[]>(
    sql: string,
    values?: any[],
  ): Promise<[T, unknown]>;
  beginTransaction(): Promise<unknown>;
  commit(): Promise<unknown>;
  rollback(): Promise<unknown>;
  release(): void;
}
export interface Database extends DatabaseConnection {
  getConnection(): Promise<DatabaseConnection>;
  end(): Promise<void>;
  pool: Pool;
}
export function createDatabase(connectionString?: string): Database;
export function postgresConfig(
  env?: NodeJS.ProcessEnv,
  migration?: boolean,
): PoolConfig;
