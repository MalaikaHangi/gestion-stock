import type { ConnectionOptions } from "mysql2";
export function mysqlConfig(
  env?: NodeJS.ProcessEnv,
  migration?: boolean,
): ConnectionOptions;
