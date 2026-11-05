import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { csv, number, type Api, type Catalog, type Settings } from "./client";
import { Empty, Message } from "./ui";
type Row = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  opening: string;
  incoming: string;
  outgoing: string;
  closing: string;
  cost: string;
  minimum: string;
};
export function Reports({
  api,
  catalog,
  settings,
  version,
}: {
  api: Api;
  catalog: Catalog;
  settings: Settings;
  version: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01"),
    [to, setTo] = useState(today),
    [warehouse, setWarehouse] = useState(""),
    [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [period, setPeriod] = useState({ from: "", to: "" });
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const result = await api<{ items: Row[]; from: string; to: string }>(
        "/api/stock?" +
          new URLSearchParams({ from, to, warehouse_id: warehouse }),
      );
      setRows(result.items);
      setPeriod({ from: result.from, to: result.to });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [api, version, from, to, warehouse]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>État du stock par période</h2>
          <p>Ouverture + entrées − sorties = clôture · journées UTC</p>
        </div>
        <button
          className="outline"
          disabled={busy || !!error}
          onClick={() =>
            csv("etat-stock-" + period.to, [
              [
                "SKU",
                "Article",
                "Unité",
                "Ouverture",
                "Entrées",
                "Sorties",
                "Clôture",
                "Du UTC",
                "Au UTC",
              ],
              ...rows.map((r) => [
                r.sku,
                r.name,
                r.unit,
                r.opening,
                r.incoming,
                r.outgoing,
                r.closing,
                period.from,
                period.to,
              ]),
            ])
          }
        >
          <Download size={16} /> Exporter CSV
        </button>
      </div>
      <div className="report-filters">
        <label>
          Du (UTC)
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Au (UTC)
          <input
            type="date"
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          Dépôt
          <select
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
          >
            <option value="">Tous les dépôts</option>
            {catalog.warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Message text={error} />
      {busy && <p className="loading">Calcul de l’état…</p>}
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
                  <small className="block">
                    {r.sku} · {r.unit}
                  </small>
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
        {!rows.length && !busy && (
          <Empty>Aucun article dans le catalogue.</Empty>
        )}
      </div>
      <p className="report-note">
        Les brouillons et documents annulés sont exclus. Les transferts
        apparaissent dans chaque dépôt ; les contrepassations sont prises en
        compte à leur date de validation.
      </p>
    </section>
  );
}
