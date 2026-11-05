// Receives credentials through hidden stdin. Never writes or prints connection strings.
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.setEncoding("utf8");
console.log(
  "Ready for private database configuration on stdin (input is hidden).",
);
const input = await new Promise((resolve) => {
  let data = "";
  process.stdin.on("data", (chunk) => {
    data += chunk;
    if (/[\r\n]/.test(data)) {
      process.stdin.pause();
      resolve(data.split(/[\r\n]/)[0]);
    }
  });
});
const config = JSON.parse(input);
const env = {
  ...process.env,
  DATABASE_URL: config.databaseUrl,
  DATABASE_MIGRATION_URL: config.databaseUrl,
  TEST_DATABASE_URL: config.databaseUrl,
};
if (config.adminEmail) env.ADMIN_EMAIL = config.adminEmail;
if (config.adminPassword) env.ADMIN_PASSWORD = config.adminPassword;
const task = process.argv[2];
let args;
if (task === "migrate" || task === "bootstrap")
  args = [path.resolve("backend/scripts/" + task + ".mjs")];
else if (task === "test")
  args = [
    "--test",
    ...(await readdir("tests"))
      .filter((n) => n.endsWith(".test.mjs"))
      .map((n) => path.resolve("tests", n)),
  ];
else throw Error("Tâche inconnue.");
const child = spawn(process.execPath, args, {
  env,
  stdio: ["ignore", "inherit", "inherit"],
  windowsHide: true,
});
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", () => {
  console.error("Impossible de lancer le contrôle.");
  process.exit(1);
});
