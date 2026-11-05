import pg from "pg";
const idTables = new Set([
  "users",
  "categories",
  "units",
  "warehouses",
  "locations",
  "partners",
  "products",
  "documents",
  "document_lines",
  "ledger",
  "audit",
  "stock_counts",
]);
export function postgresConfig(env = process.env, migration = false) {
  const connectionString = migration
    ? env.DATABASE_MIGRATION_URL || env.DATABASE_URL
    : env.DATABASE_URL;
  if (!connectionString) throw Error("DATABASE_URL non configurée.");
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw Error("Une connexion PostgreSQL est requise.");
  const sslRequested = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    url.hostname,
  );
  const ssl =
    local || env.DATABASE_SSL === "disable" || sslRequested === "disable"
      ? false
      : {
          rejectUnauthorized: true,
          ...(env.DATABASE_SSL_CA
            ? { ca: env.DATABASE_SSL_CA.replace(/\\n/g, "\n") }
            : {}),
        };
  return {
    connectionString: url.toString(),
    ssl,
    max: 5,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 15000,
    options: "-c timezone=UTC",
  };
}
function sqlParameters(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => "$" + ++index);
}
function facade(target, release) {
  async function query(sql, values = []) {
    const table = sql
      .match(/^\s*INSERT\s+INTO\s+([a-z_]+)/i)?.[1]
      ?.toLowerCase();
    if (table && idTables.has(table) && !/\bRETURNING\b/i.test(sql))
      sql += " RETURNING id";
    const result = await target.query(
      sqlParameters(sql),
      values.map((v) => (typeof v === "boolean" ? Number(v) : v)),
    );
    return result.command === "SELECT"
      ? [result.rows, []]
      : [
          {
            insertId: result.rows[0]?.id || 0,
            affectedRows: result.rowCount || 0,
          },
          [],
        ];
  }
  return {
    query,
    execute: query,
    beginTransaction: () => target.query("BEGIN"),
    commit: () => target.query("COMMIT"),
    rollback: () => target.query("ROLLBACK"),
    release,
  };
}
export function createDatabase(connectionString) {
  const pool = new pg.Pool(
    postgresConfig(
      connectionString
        ? { ...process.env, DATABASE_URL: connectionString }
        : process.env,
    ),
  );
  pool.on("error", (error) =>
    console.error("[PostgreSQL pool]", error.code || "CONNECTION_ERROR"),
  );
  return {
    ...facade(pool, () => {}),
    getConnection: async () => {
      const client = await pool.connect();
      return facade(client, () => client.release());
    },
    end: () => pool.end(),
    pool,
  };
}
