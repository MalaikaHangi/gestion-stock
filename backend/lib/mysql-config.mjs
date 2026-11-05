export function mysqlConfig(env = process.env, migration = false) {
  const uri = migration
    ? env.MYSQL_MIGRATION_URL || env.MYSQL_URL
    : env.MYSQL_URL;
  const options = uri
    ? { uri }
    : {
        host: env.MYSQL_HOST,
        port: Number(env.MYSQL_PORT || 3306),
        database: env.MYSQL_DATABASE,
        user: migration && env.MYSQL_ROOT_PASSWORD ? "root" : env.MYSQL_USER,
        password:
          migration && env.MYSQL_ROOT_PASSWORD
            ? env.MYSQL_ROOT_PASSWORD
            : env.MYSQL_PASSWORD,
      };
  if (
    !uri &&
    (!options.host || !options.database || !options.user || !options.password)
  )
    throw Error("Connexion MySQL non configurée.");
  if (
    !uri &&
    (!Number.isInteger(options.port) ||
      options.port < 1 ||
      options.port > 65535)
  )
    throw Error("Port MySQL invalide.");
  return {
    ...options,
    timezone: "Z",
    connectTimeout: 10000,
    ...(env.MYSQL_SSL_CA
      ? {
          ssl: {
            ca: env.MYSQL_SSL_CA.replace(/\\n/g, "\n"),
            rejectUnauthorized: true,
          },
        }
      : {}),
  };
}
