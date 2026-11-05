import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import {
  type Api,
  type Catalog,
  type Product,
  type Settings,
  number,
  date,
} from "./client";
import { Confirm, Dialog, Empty, Message, Skeleton } from "./ui";
type Count = {
  id: number;
  name: string;
  sku: string;
  expected: string;
  counted: string;
  difference: string;
  author: string;
  created_at: string;
  reference: string | null;
};
export function Inventory({
  api,
  catalog,
  admin,
  online,
  changed,
  version,
  settings,
}: {
  api: Api;
  catalog: Catalog;
  admin: boolean;
  online: boolean;
  changed: () => Promise<void>;
  version: number;
  settings: Settings;
}) {
  const [rows, setRows] = useState<Count[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [product, setProduct] = useState<Product | null>(null),
    [counted, setCounted] = useState(""),
    [confirm, setConfirm] = useState(false),
    [key, setKey] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api<Count[]>("/api/inventory"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, version]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>
              <ClipboardCheck size={20} /> Inventaire physique
            </h2>
            <p>
              Comparez le stock compté au stock enregistré. Chaque écart corrigé
              reste dans l’historique.
            </p>
          </div>
        </div>
        <Message text={error} />
        {!admin && (
          <p className="report-note">
            L’administrateur enregistre les comptages et valide les corrections.
          </p>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ARTICLE</th>
                <th>STOCK ENREGISTRÉ</th>
                {admin && <th>COMPTAGE</th>}
              </tr>
            </thead>
            <tbody>
              {catalog.products
                .filter((p) => p.active)
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.name}</b>
                      <small className="block">{p.sku}</small>
                    </td>
                    <td>{number(p.quantity)}</td>
                    {admin && (
                      <td>
                        <button
                          className="outline"
                          disabled={!online}
                          onClick={() => {
                            setProduct(p);
                            setCounted(p.quantity);
                            setKey(crypto.randomUUID());
                          }}
                        >
                          Vérifier le stock réel
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
          {!catalog.products.length && (
            <Empty>Ajoutez un article pour commencer.</Empty>
          )}
        </div>
      </section>
      <section className="panel inventory-history">
        <div className="panel-title">
          <div>
            <h2>Historique des comptages</h2>
            <p>Les 100 derniers comptages, y compris ceux sans écart.</p>
          </div>
        </div>
        {loading ? (
          <Skeleton />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>DATE / ARTICLE</th>
                  <th>ENREGISTRÉ</th>
                  <th>COMPTÉ</th>
                  <th>ÉCART</th>
                  <th>AUTEUR / CORRECTION</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {date(r.created_at, settings.timezone)}
                      <b className="block">{r.name}</b>
                    </td>
                    <td>{number(r.expected)}</td>
                    <td>{number(r.counted)}</td>
                    <td
                      className={
                        Number(r.difference) < 0 ? "negative" : "positive"
                      }
                    >
                      {number(r.difference)}
                    </td>
                    <td>
                      {r.author}
                      <small className="block">
                        {r.reference || "Aucun écart"}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <Empty>Aucun comptage enregistré.</Empty>}
          </div>
        )}
      </section>
      {product && !confirm && (
        <Dialog title="Vérifier le stock réel" close={() => setProduct(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setConfirm(true);
            }}
          >
            <h3>{product.name}</h3>
            <p>
              Stock enregistré : <b>{number(product.quantity)}</b>
            </p>
            <label>
              Quantité réellement comptée
              <input
                required
                type="number"
                min="0"
                step="0.001"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
              />
            </label>
            <p>
              Écart :{" "}
              <b>{number(Number(counted) - Number(product.quantity))}</b>
            </p>
            <div className="form-actions">
              <button
                className="outline"
                type="button"
                onClick={() => setProduct(null)}
              >
                Annuler
              </button>
              <button className="primary">Vérifier et continuer</button>
            </div>
          </form>
        </Dialog>
      )}
      {product && confirm && (
        <Confirm
          title="Confirmer le comptage ?"
          description={
            "Le stock de « " +
            product.name +
            " » sera ajusté à " +
            number(counted) +
            ". Un mouvement sera créé si un écart existe."
          }
          close={() => setConfirm(false)}
          confirm={async () => {
            await api(
              "/api/inventory",
              "POST",
              { product_id: product.id, expected: product.quantity, counted },
              key,
            );
            setProduct(null);
            await changed();
            await load();
          }}
        />
      )}
    </>
  );
}
