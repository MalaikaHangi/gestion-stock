import { readFile, writeFile, mkdir, stat, unlink } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createInflateRaw } from "node:zlib";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import net from "node:net";
if (process.platform !== "win32") throw new Error("Ce script cible Windows.");
const root = path.resolve(".local");
const archive = path.join(root, "mysql-8.4.13-winx64.zip");
const home = path.join(process.env.LOCALAPPDATA, "StockMaster");
const version = "mysql-8.4.13-winx64";
await mkdir(home, { recursive: true });
await mkdir(root, { recursive: true });
const binary = path.join(home, version, "bin", "mysqld.exe");
const data = path.join(home, "data");
if (!(await stat(path.join(root, "mysql-minimal.json")).catch(() => null))) {
  const hash = createHash("md5");
  for await (const part of createReadStream(archive)) hash.update(part);
  if (hash.digest("hex") !== "7b94489d5524dea9b27097068bea25a8")
    throw new Error(
      "Archive officielle absente ou incorrecte. Exécutez download-mysql.mjs.",
    );
}
if (!(await stat(binary).catch(() => null))) {
  console.log("Extraction de l’archive officielle MySQL…");
  // Standard ZIP central directory; extraction is confined to the installation directory.
  const zip = await readFile(archive);
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--)
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("Archive ZIP non reconnue");
  let offset = zip.readUInt32LE(end + 16);
  const count = zip.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Entrée ZIP invalide");
    const method = zip.readUInt16LE(offset + 10),
      size = zip.readUInt32LE(offset + 20),
      nameLength = zip.readUInt16LE(offset + 28),
      extra = zip.readUInt16LE(offset + 30),
      comment = zip.readUInt16LE(offset + 32),
      local = zip.readUInt32LE(offset + 42);
    const name = zip
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    offset += 46 + nameLength + extra + comment;
    const target = path.resolve(home, name);
    if (!target.startsWith(home + path.sep))
      throw new Error("Chemin ZIP refusé");
    if (name.endsWith("/")) {
      await mkdir(target, { recursive: true });
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    const begin =
      local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    if (!size) {
      await writeFile(target, "");
      continue;
    }
    const source = createReadStream(archive, {
      start: begin,
      end: begin + size - 1,
    });
    if (method === 8)
      await pipeline(source, createInflateRaw(), createWriteStream(target));
    else if (method === 0) await pipeline(source, createWriteStream(target));
    else throw new Error("Compression ZIP non supportée");
  }
}
const credentialsPath = path.join(root, "credentials.json");
let credentials;
try {
  credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
} catch {
  credentials = {
    root: randomBytes(24).toString("hex"),
    app: randomBytes(24).toString("hex"),
    admin: randomBytes(20).toString("hex"),
    port: 3307,
  };
  await writeFile(credentialsPath, JSON.stringify(credentials, null, 2), {
    flag: "wx",
  });
}
const run = (args) =>
  new Promise((resolve, reject) => {
    const proc = spawn(binary, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let errors = "";
    proc.stderr.on("data", (d) => (errors += d));
    proc.on("error", reject);
    proc.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            Error(
              "MySQL initialisation échouée : " +
                errors.replace(/temporary password.*$/gim, "[masqué]"),
            ),
          ),
    );
  });
if (!(await stat(path.join(data, "mysql")).catch(() => null))) {
  await mkdir(data, { recursive: true });
  console.log("Initialisation du serveur local…");
  await run([
    "--no-defaults",
    "--initialize-insecure",
    "--basedir=" + path.dirname(path.dirname(binary)),
    "--datadir=" + data,
    "--console",
  ]);
}
const bootstrap = path.join(home, "bootstrap.sql");
await writeFile(
  bootstrap,
  [
    `ALTER USER 'root'@'localhost' IDENTIFIED BY '${credentials.root}';`,
    `CREATE DATABASE IF NOT EXISTS gestion_stock CHARACTER SET utf8mb4;`,
    `CREATE DATABASE IF NOT EXISTS gestion_stock_test CHARACTER SET utf8mb4;`,
    `CREATE USER IF NOT EXISTS 'stock_local'@'127.0.0.1' IDENTIFIED BY '${credentials.app}';`,
    `CREATE USER IF NOT EXISTS 'stock_local'@'localhost' IDENTIFIED BY '${credentials.app}';`,
    ...["127.0.0.1", "localhost"].flatMap((host) => [
      `GRANT ALL PRIVILEGES ON gestion_stock.* TO 'stock_local'@'${host}';`,
      `GRANT ALL PRIVILEGES ON gestion_stock_test.* TO 'stock_local'@'${host}';`,
    ]),
  ].join("\n"),
);
const serverArgs = [
  "--no-defaults",
  "--basedir=" + path.dirname(path.dirname(binary)),
  "--datadir=" + data,
  "--bind-address=127.0.0.1",
  "--port=3307",
  "--mysqlx=0",
  "--log-error=" + path.join(home, "mysql.log"),
];
const canConnect = () =>
  new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: 3307 });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
if (await canConnect())
  throw new Error(
    "Le port 3307 est déjà utilisé. Aucun serveur existant n’a été modifié.",
  );
const proc = spawn(binary, [...serverArgs, "--init-file=" + bootstrap], {
  windowsHide: true,
  detached: true,
  stdio: "ignore",
});
proc.unref();
for (let i = 0; i < 60; i++) {
  if (await canConnect()) break;
  await new Promise((r) => setTimeout(r, 500));
}
if (!(await canConnect()))
  throw new Error(
    "MySQL ne démarre pas. Consultez " + path.join(home, "mysql.log"),
  );
await unlink(bootstrap);
await writeFile(
  path.join(root, "mysql-runtime.json"),
  JSON.stringify({ binary, args: serverArgs, home }, null, 2),
);
await writeFile(
  path.resolve("backend/.env"),
  `MYSQL_URL=mysql://stock_local:${credentials.app}@127.0.0.1:3307/gestion_stock\nALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173\nADMIN_EMAIL=admin@stockmaster.local\nADMIN_PASSWORD=${credentials.admin}\n`,
);
console.log(
  "MySQL écoute sur 127.0.0.1:3307. Bases gestion_stock et gestion_stock_test préparées.",
);
console.log(
  "Paramètres privés enregistrés dans backend/.env et .local/credentials.json (ignorés par Git).",
);
