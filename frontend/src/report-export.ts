export type ReportRow = {
  sku: string;
  name: string;
  opening: string;
  incoming: string;
  outgoing: string;
  closing: string;
  cost: string;
};
export async function reportBytes(
  format: "pdf" | "xlsx",
  report: {
    title: string;
    from: string;
    to: string;
    currency: string;
    rows: ReportRow[];
  },
) {
  const headers = [
    "SKU",
    "Article",
    "Ouverture",
    "Entrées",
    "Sorties",
    "Clôture",
    "Valeur (" + report.currency + ")",
  ];
  const data = report.rows.map((r) => [
    r.sku,
    r.name,
    Number(r.opening),
    Number(r.incoming),
    Number(r.outgoing),
    Number(r.closing),
    Number(r.closing) * Number(r.cost),
  ]);
  const subtitle = report.from + " au " + report.to + " (UTC)";
  if (format === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = report.title;
    const sheet = workbook.addWorksheet("Stock");
    sheet.addRow([report.title]);
    sheet.addRow([subtitle]);
    sheet.addRow(headers);
    sheet.addRows(data);
    sheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(3).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF101F48" },
    };
    sheet.columns.forEach((column, i) => {
      column.width = i === 1 ? 40 : 20;
      if (i >= 2) column.numFmt = "0.000";
    });
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    sheet.autoFilter = { from: "A3", to: "G" + Math.max(3, sheet.rowCount) };
    return new Uint8Array(await workbook.xlsx.writeBuffer());
  }
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFontSize(16);
  pdf.text(report.title, 14, 18);
  pdf.setFontSize(10);
  pdf.text(subtitle, 14, 26);
  autoTable(pdf, {
    startY: 34,
    head: [headers],
    body: data.map((row) =>
      row.map((v) =>
        typeof v === "number"
          ? v.toLocaleString("fr-FR", { maximumFractionDigits: 3 })
          : v,
      ),
    ),
    headStyles: { fillColor: [16, 31, 72] },
    styles: { fontSize: 9 },
    didDrawPage: () => {
      pdf.setFontSize(9);
      pdf.text("StockMaster · " + pdf.getNumberOfPages(), 14, 202);
    },
  });
  return new Uint8Array(pdf.output("arraybuffer"));
}
