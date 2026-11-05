import { useCallback, useEffect, useState } from "react";
import { reportBytes } from "./report-export";
import { Download } from "lucide-react";
import { number, type Api, type Catalog, type Settings } from "./client";
import { Empty, Message, Skeleton, Spinner } from "./ui";
type Row = {
  id: number;
  sku: string;
  name: string;
  opening: string;
  incoming: string;
  outgoing: string;
  closing: string;
  cost: string;
};
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Reports({
  api,
  settings,
  version,
}: {
  api: Api;
  catalog: Catalog;
  settings: Settings;
  version: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState("month"),
    [anchor, setAnchor] = useState(today),
    [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [exporting, setExporting] = useState(""),
    [period, setPeriod] = useState({ from: "", to: "" });
  const year = anchor.slice(0, 4),
    month = anchor.slice(0, 7);
  const from =
    mode === "day" ? anchor : mode === "year" ? year + "-01-01" : month + "-01";
  const to =
    mode === "day"
      ? anchor
      : mode === "year"
        ? year + "-12-31"
        : new Date(Date.UTC(Number(year), Number(anchor.slice(5, 7)), 0))
            .toISOString()
            .slice(0, 10);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api<{ items: Row[]; from: string; to: string }>(
        "/api/stock?" + new URLSearchParams({ from, to }),
      );
      setRows(r.items);
      setPeriod({ from: r.from, to: r.to });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [api, version, from, to]);
  useEffect(() => {
    void load();
  }, [load]);
  const exportReport = async (format: "pdf" | "xlsx") => {
    setExporting(format);
    setError("");
    try {
      const bytes = await reportBytes(format, {
        title: settings.organisation + " — Rapport de stock",
        from: period.from,
        to: period.to,
        currency: settings.currency,
        rows,
      });
      download(
        new Blob([bytes as BlobPart], {
          type:
            format === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        "rapport-stock-" + period.from + "-" + period.to + "." + format,
      );
    } catch (e) {
      setError("Export impossible : " + (e as Error).message);
    } finally {
      setExporting("");
    }
  };
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>Rapports de stock</h2>
          <p>Rapports journaliers, mensuels et annuels · journées UTC</p>
        </div>
        <div className="row-actions">
          {(["pdf", "xlsx"] as const).map((f) => (
            <button
              className="outline"
              key={f}
              disabled={busy || !!error || !!exporting}
              onClick={() => void exportReport(f)}
            >
              {exporting === f ? <Spinner /> : <Download size={16} />}{" "}
              {f === "pdf" ? "PDF" : "Excel"}
            </button>
          ))}
        </div>
      </div>
      <div className="report-filters">
        <label>
          Périodicité
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="day">Journalier</option>
            <option value="month">Mensuel</option>
            <option value="year">Annuel</option>
          </select>
        </label>
        <label>
          {mode === "year" ? "Année" : mode === "month" ? "Mois" : "Journée"}
          {mode === "year" ? (
            <select
              value={year}
              onChange={(e) => setAnchor(e.target.value + "-01-01")}
            >
              {Array.from({length:101},(_,i)=>String(2000+i)).map(value=><option key={value}>{value}</option>)}
            </select>
          ) : (
            <input
              required
              type={mode === "month" ? "month" : "date"}
              value={mode === "month" ? month : anchor}
              onChange={(e) => {
                if (e.target.value)
                  setAnchor(e.target.value + (mode === "month" ? "-01" : ""));
              }}
            />
          )}
        </label>
      </div>
      <Message text={error} />
      {busy ? (
        <Skeleton />
      ) : (
        <>
          <p className="report-note">
            Du {period.from} au {period.to} · Ouverture + entrées − sorties =
            clôture
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ARTICLE</th>
                  <th>OUVERTURE</th>
                  <th>ENTRÉES</th>
                  <th>SORTIES</th>
                  <th>CLÔTURE</th>
                  <th>VALEUR INDICATIVE</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.name}</b>
                      <small className="block">{r.sku}</small>
                    </td>
                    <td>{number(r.opening)}</td>
                    <td className="positive">+ {number(r.incoming)}</td>
                    <td className="negative">− {number(r.outgoing)}</td>
                    <td>
                      <b>{number(r.closing)}</b>
                    </td>
                    <td>
                      {number(Number(r.closing) * Number(r.cost))}{" "}
                      {settings.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <Empty>Aucun article dans le catalogue.</Empty>}
          </div>
        </>
      )}
      <p className="report-note">
        Seuls les mouvements validés sont comptabilisés. Les corrections
        d’inventaire et contrepassations sont prises en compte à leur date de
        validation.
      </p>
    </section>
  );
}
