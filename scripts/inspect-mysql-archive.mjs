const url =
  "https://dev.mysql.com/get/Downloads/MySQL-8.4/mysql-8.4.13-winx64.zip";
const response = await fetch(url, { headers: { Range: "bytes=-65557" } });
console.log(response.status, response.headers.get("content-range"));
if (response.status !== 206) {
  await response.body.cancel();
  process.exit(1);
}
const tail = Buffer.from(await response.arrayBuffer());
let end = -1;
for (let i = tail.length - 22; i >= 0; i--)
  if (tail.readUInt32LE(i) === 0x06054b50) {
    end = i;
    break;
  }
if (end < 0) throw Error("ZIP sans répertoire");
const size = tail.readUInt32LE(end + 12),
  start = tail.readUInt32LE(end + 16);
const r = await fetch(url, {
  headers: { Range: `bytes=${start}-${start + size - 1}` },
});
if (r.status !== 206) {
  await r.body.cancel();
  throw Error("Range indisponible");
}
const directory = Buffer.from(await r.arrayBuffer());
let p = 0;
const entries = [];
while (p < directory.length && directory.readUInt32LE(p) === 0x02014b50) {
  const n = directory.readUInt16LE(p + 28),
    e = directory.readUInt16LE(p + 30),
    c = directory.readUInt16LE(p + 32);
  const name = directory.subarray(p + 46, p + 46 + n).toString();
  entries.push({
    name,
    size: directory.readUInt32LE(p + 20),
    unpacked: directory.readUInt32LE(p + 24),
    offset: directory.readUInt32LE(p + 42),
    method: directory.readUInt16LE(p + 10),
    crc: directory.readUInt32LE(p + 16),
  });
  p += 46 + n + e + c;
}
const { writeFile } = await import("node:fs/promises");
await writeFile(".local/mysql-archive-index.json", JSON.stringify(entries));
console.log(
  entries
    .filter((e) => /\/bin\/.*\.(dll|exe)$|\/share\/english\//i.test(e.name))
    .map((e) => ({ name: e.name, MB: (e.size / 1048576).toFixed(1) })),
);
