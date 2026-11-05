import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
async function run(script, args = []) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error("Commande interrompue : " + script)),
    );
  });
}
await run(fileURLToPath(new URL("./wait-for-db.mjs", import.meta.url)));
await run(fileURLToPath(new URL("./migrate.mjs", import.meta.url)));
await run(fileURLToPath(new URL("./bootstrap.mjs", import.meta.url)));
const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    "start",
    "--hostname",
    "0.0.0.0",
    "--port",
    process.env.PORT || "3000",
  ],
  {
    cwd: new URL("..", import.meta.url),
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => (process.exitCode = code ?? 1));
