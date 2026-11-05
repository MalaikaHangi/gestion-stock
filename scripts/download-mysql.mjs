import { mkdir, stat } from "node:fs/promises";
import { createWriteStream, createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const directory = path.resolve(".local");
await mkdir(directory, { recursive: true });
const target = path.join(directory, "mysql-8.4.13-winx64.zip");
const expected = "7b94489d5524dea9b27097068bea25a8";
async function checksum() {
  const hash = createHash("md5");
  for await (const chunk of createReadStream(target)) hash.update(chunk);
  return hash.digest("hex");
}
if (await stat(target).catch(() => null)) {
  if ((await checksum()) === expected) {
    console.log("Archive MySQL déjà téléchargée et vérifiée.");
    process.exit(0);
  }
}
const response = await fetch(
  "https://dev.mysql.com/get/Downloads/MySQL-8.4/mysql-8.4.13-winx64.zip",
);
if (!response.ok)
  throw new Error("Téléchargement MySQL : HTTP " + response.status);
console.log("Téléchargement de MySQL depuis le site officiel…");
await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
if ((await checksum()) !== expected)
  throw new Error(
    "Somme de contrôle MySQL incorrecte : archive non exécutable.",
  );
console.log("Archive MySQL vérifiée :", target);
