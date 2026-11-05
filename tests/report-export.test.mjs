import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { reportBytes } from "../frontend/src/report-export.ts";
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const report = {
  title: "Entreprise — Rapport de stock",
  from: "2026-01-01",
  to: "2026-12-31",
  currency: "USD",
  rows: [
    {
      sku: "ART-00000001",
      name: "=Article de contrôle",
      opening: "12.500",
      incoming: "4.000",
      outgoing: "2.500",
      closing: "14.000",
      cost: "2.2500",
    },
  ],
};
test("Rapport Excel réel : période, texte sans formule et nombres exploitables", async () => {
  const Excel = require("exceljs");
  const wb = new Excel.Workbook();
  await wb.xlsx.load(await reportBytes("xlsx", report));
  const sheet = wb.getWorksheet("Stock");
  assert.match(sheet.getCell("A2").value, /2026-01-01 au 2026-12-31/);
  assert.equal(sheet.getCell("B4").value, "=Article de contrôle");
  assert.equal(sheet.getCell("F4").value, 14);
  assert.equal(sheet.getCell("G4").value, 31.5);
});
test("Rapport PDF réel : document valide et pagination de nombreuses lignes", async () => {
  const bytes = await reportBytes("pdf", {
    ...report,
    rows: Array.from({ length: 140 }, (_, i) => ({
      ...report.rows[0],
      name: "Article " + i,
    })),
  });
  const text = new TextDecoder("latin1").decode(bytes);
  assert.ok(text.startsWith("%PDF-"));
  assert.ok((text.match(/\/Type \/Page\b/g) || []).length > 1);
  assert.match(text, /2026-01-01 au 2026-12-31/);
});
