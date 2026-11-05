import { readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
const env = { ...process.env };
for (const line of (await readFile("backend/.env", "utf8")).split(/\r?\n/)) {
  const index = line.indexOf("=");
  if (index > 0 && !line.startsWith("#"))
    env[line.slice(0, index)] = line.slice(index + 1);
}
const task = process.argv[2];
let script, args;
if (task === "migrate" || task === "seed" || task === "migrate-test") {
  if (task.startsWith("migrate")) {
    const credentials = JSON.parse(
      await readFile(".local/credentials.json", "utf8"),
    );
    env.MYSQL_URL = `mysql://root:${credentials.root}@127.0.0.1:3307/${task === "migrate-test" ? "gestion_stock_test" : "gestion_stock"}`;
  }
  script = path.resolve(
    `backend/scripts/${task === "migrate-test" ? "migrate" : task}.mjs`,
  );
  args = [script];
} else if (task === "test") {
  env.TEST_MYSQL_URL = env.MYSQL_URL.replace(
    /\/gestion_stock$/,
    "/gestion_stock_test",
  );
  args = [
    "--test",
    ...(await readdir("tests"))
      .filter((name) => name.endsWith(".test.mjs"))
      .map((name) => path.resolve("tests", name)),
  ];
} else
  throw Error(
    "Utilisation : node scripts/local-db-task.mjs migrate|migrate-test|seed|test",
  );
const child = spawn(process.execPath, args, {
  env,
  stdio: "inherit",
  windowsHide: true,
});
child.on("error", (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
child.on("exit", (code) => (process.exitCode = code ?? 1));
